import { NextResponse } from 'next/server';
import { proxyFetch } from '@/lib/proxy';

export async function GET() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await proxyFetch('https://www.reddit.com/.json?limit=1', {
      signal: controller.signal,
      headers: { 'User-Agent': 'HisenseRedditMonitor/1.0' },
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      return NextResponse.json({
        connected: true,
        message: '网络连接正常，可以访问 Reddit（法兰克福服务器直接连接）',
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
    } else {
      return NextResponse.json({
        connected: false,
        message: `无法访问 Reddit (状态码 ${response.status})`,
        proxyConfigured: false,
      });
    }
  } catch (fetchError: any) {
    const errorMsg = fetchError.name === 'AbortError' ? '连接超时' : fetchError.message;
    return NextResponse.json({
      connected: false,
      message: `无法连接 Reddit: ${errorMsg}`,
      proxyConfigured: false,
    });
  }
}
