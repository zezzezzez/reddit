import { NextResponse } from 'next/server';
import { proxyFetch, initProxy } from '@/lib/proxy';
import { getConfig } from '@/lib/store';

const isVercel = !!process.env.VERCEL;

export async function GET() {
  try {
    const config = getConfig();
    const proxy = config.proxy;

    // On Vercel or when proxy is disabled, try direct access first
    // Vercel servers are in the US and can access Reddit directly
    if (!proxy || !proxy.enabled || !proxy.host || !proxy.port) {
      if (isVercel) {
        // Vercel environment: try direct access (no proxy needed)
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000);
          const response = await fetch('https://www.reddit.com/.json?limit=1', {
            signal: controller.signal,
            headers: { 'User-Agent': 'HisenseRedditMonitor/1.0' },
          });
          clearTimeout(timeoutId);

          if (response.ok) {
            return NextResponse.json({
              connected: true,
              message: 'Vercel 服务器可直接访问 Reddit（无需代理）',
              proxyConfigured: false,
              directAccess: true,
            });
          } else if (response.status === 429) {
            return NextResponse.json({
              connected: true,
              message: '网络正常，但 Reddit 请求频率受限',
              rateLimited: true,
              proxyConfigured: false,
              directAccess: true,
            });
          }
        } catch {
          // Direct access failed on Vercel
        }
      }

      return NextResponse.json({
        connected: false,
        message: isVercel
          ? 'Vercel 无法直接访问 Reddit，请通过环境变量配置代理（PROXY_HOST, PROXY_PORT）'
          : '未配置外网代理，请在设置中配置代理后重试',
        proxyConfigured: false,
      });
    }

    // Proxy is configured - test with proxy
    await initProxy();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await proxyFetch('https://www.reddit.com/.json?limit=1', {
        signal: controller.signal,
        headers: {
          'User-Agent': 'HisenseRedditMonitor/1.0',
        },
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        return NextResponse.json({
          connected: true,
          message: '网络连接正常，可以访问 Reddit',
          proxyConfigured: true,
        });
      } else if (response.status === 429) {
        return NextResponse.json({
          connected: true,
          message: '网络正常，但 Reddit 请求频率受限，请稍后再扫描',
          rateLimited: true,
          proxyConfigured: true,
        });
      } else {
        return NextResponse.json({
          connected: false,
          message: `代理已配置但无法访问 Reddit (状态码 ${response.status})，请检查代理设置`,
          proxyConfigured: true,
        });
      }
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      const errorMsg = fetchError.name === 'AbortError' ? '连接超时' : fetchError.message;
      return NextResponse.json({
        connected: false,
        message: `代理已配置但无法连接 Reddit: ${errorMsg}，请检查代理地址和端口`,
        proxyConfigured: true,
      });
    }
  } catch (error: any) {
    return NextResponse.json({
      connected: false,
      message: `检测失败: ${error.message}`,
      proxyConfigured: false,
    });
  }
}
