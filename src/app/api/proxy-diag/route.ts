import { NextResponse } from 'next/server';
import { getProxyUrl } from '@/lib/local-proxy';

export async function GET() {
  const results: any = {
    envCheck: {},
    proxyTest: null,
    directTest: null,
    redditApiTest: null,
  };

  // 1. Check environment variables
  results.envCheck = {
    HTTP_PROXY: process.env.HTTP_PROXY ? 'SET (' + process.env.HTTP_PROXY.substring(0, 30) + '...)' : 'NOT SET',
    HTTPS_PROXY: process.env.HTTPS_PROXY ? 'SET (' + process.env.HTTPS_PROXY.substring(0, 30) + '...)' : 'NOT SET',
    NODE_ENV: process.env.NODE_ENV || 'not set',
  };

  const proxyUrl = getProxyUrl();

  // 2. Test proxy connection to a simple endpoint first
  try {
    const undici = await import('undici');
    const agent = new undici.ProxyAgent(proxyUrl || '');
    
    // Test with httpbin to check proxy exit IP
    const proxyStartTime = Date.now();
    const proxyRes = await (undici.fetch as any)('https://httpbin.org/ip', {
      dispatcher: agent,
      timeout: 15000,
    });
    const proxyElapsed = Date.now() - proxyStartTime;
    
    if (proxyRes.ok) {
      const ipData = await proxyRes.json();
      results.proxyTest = {
        success: true,
        exitIp: ipData.origin,
        elapsed: proxyElapsed + 'ms',
      };
    } else {
      results.proxyTest = {
        success: false,
        status: proxyRes.status,
        elapsed: proxyElapsed + 'ms',
      };
    }
  } catch (e: any) {
    results.proxyTest = { success: false, error: e.message };
  }

  // 3. Test Reddit via proxy with detailed error info
  try {
    const undici = await import('undici');
    const agent = new undici.ProxyAgent(proxyUrl || '');
    
    const redditStartTime = Date.now();
    const redditRes = await (undici.fetch as any)('https://www.reddit.com/r/Hisense.json?limit=1', {
      dispatcher: agent,
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
    });
    const redditElapsed = Date.now() - redditStartTime;

    let bodyPreview = '';
    try {
      const text = await redditRes.text();
      bodyPreview = text.substring(0, 500);
    } catch {}

    results.redditApiTest = {
      success: redditRes.ok,
      status: redditRes.status,
      statusText: redditRes.statusText,
      elapsed: redditElapsed + 'ms',
      headers: {
        contentType: redditRes.headers.get('content-type'),
        server: redditRes.headers.get('server'),
      },
      bodyPreview,
    };
  } catch (e: any) {
    results.redditApiTest = { success: false, error: e.message };
  }

  // 4. Test direct Reddit access (no proxy)
  try {
    const directStartTime = Date.now();
    const directRes = await fetch('https://www.reddit.com/r/Hisense.json?limit=1', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(10000),
    });
    const directElapsed = Date.now() - directStartTime;
    
    results.directTest = {
      success: directRes.ok,
      status: directRes.status,
      elapsed: directElapsed + 'ms',
    };
  } catch (e: any) {
    results.directTest = { success: false, error: e.message };
  }

  return NextResponse.json(results);
}
