import { NextResponse } from 'next/server';
import { getConfig, saveConfig } from '@/lib/store';
import { testProxyConnection, detectSystemProxy } from '@/lib/proxy';
import { ProxyConfig } from '@/lib/types';

// GET: Get current proxy config or detect system proxy
export async function GET(request: Request) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action');

  // Auto-detect system proxy
  if (action === 'detect') {
    const detected = detectSystemProxy();
    return NextResponse.json({
      proxy: detected,
      message: detected
        ? `检测到系统代理: ${detected.protocol}://${detected.host}:${detected.port}`
        : '未检测到系统代理配置',
    });
  }

  const config = getConfig();
  return NextResponse.json({
    proxy: config.proxy || { enabled: false, host: '127.0.0.1', port: 7890, protocol: 'http' },
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
      message: proxyConfig.enabled
        ? `代理配置已保存: ${proxyConfig.protocol}://${proxyConfig.host}:${proxyConfig.port}`
        : '代理已关闭',
      proxy: proxyConfig,
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
