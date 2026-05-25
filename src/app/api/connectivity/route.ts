import { NextResponse } from 'next/server';
import { proxyFetch, initProxy } from '@/lib/proxy';
import { getConfig } from '@/lib/store';

export async function GET() {
  try {
    const config = getConfig();
    const proxy = config.proxy;

    // Step 1: Check proxy configuration
    if (!proxy || !proxy.enabled || !proxy.host || !proxy.port) {
      return NextResponse.json({
        connected: false,
        message: '未配置外网代理，请在设置中配置代理后重试',
        proxyConfigured: false,
      });
    }

    // Step 2: Initialize proxy
    await initProxy();

    // Step 3: Test actual Reddit connectivity with short timeout
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
        // Rate limited = network IS working, just being throttled
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
