import { NextResponse } from 'next/server';
import { getConfig, saveConfig } from '@/lib/store';
import { testProxyConnection, detectSystemProxy } from '@/lib/proxy';
import { ProxyConfig } from '@/lib/types';

const isVercel = !!process.env.VERCEL;

// GET: Get current proxy config or detect system proxy
export async function GET(request: Request) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action');

  // Auto-detect system proxy (only works on local dev, not Vercel)
  if (action === 'detect') {
    const detected = detectSystemProxy();
    return NextResponse.json({
      proxy: detected,
      message: detected
        ? `检测到系统代理: ${detected.protocol}://${detected.host}:${detected.port}`
        : isVercel
          ? 'Vercel 环境不支持自动检测，请通过环境变量配置代理'
          : '未检测到系统代理配置',
    });
  }

  const config = getConfig();
  return NextResponse.json({
    proxy: config.proxy || { enabled: false, host: '127.0.0.1', port: 7890, protocol: 'http' },
    isVercel,
  });
}

// POST: Save proxy config
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const proxyConfig: ProxyConfig = {
      enabled: body.enabled ?? false,
      host: body.host || '127.0.0.1',
      port: body.port || 7890,
      protocol: body.protocol || 'http',
    };

    const config = getConfig();
    config.proxy = proxyConfig;
    saveConfig(config);

    return NextResponse.json({
      success: true,
      message: isVercel
        ? '代理配置已保存（Vercel环境：配置仅保存在当前会话内存中，如需持久化请设置环境变量 PROXY_HOST/PROXY_PORT）'
        : proxyConfig.enabled
          ? `代理配置已保存: ${proxyConfig.protocol}://${proxyConfig.host}:${proxyConfig.port}`
          : '代理已关闭',
      proxy: proxyConfig,
      isVercel,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: error.message || '保存代理配置失败',
    }, { status: 500 });
  }
}

// PUT: Test proxy connection
export async function PUT(request: Request) {
  try {
    const body = await request.json();

    // On Vercel, try direct access first (Vercel servers can access Reddit directly)
    if (isVercel && !(body.enabled && body.host && body.port)) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        const response = await fetch('https://www.reddit.com/.json?limit=1', {
          signal: controller.signal,
          headers: { 'User-Agent': 'HisenseRedditMonitor/1.0' },
        });
        clearTimeout(timeoutId);

        if (response.ok || response.status === 429) {
          return NextResponse.json({
            success: true,
            message: 'Vercel 服务器可直接访问 Reddit（无需代理配置）',
          });
        }
      } catch {
        // Direct access failed
      }
    }

    const proxyConfig: ProxyConfig = {
      enabled: true,
      host: body.host || '127.0.0.1',
      port: body.port || 7890,
      protocol: body.protocol || 'http',
    };

    const result = await testProxyConnection(proxyConfig);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: error.message || '代理测试失败',
    }, { status: 500 });
  }
}
