import { NextResponse } from 'next/server';
import { getProxyUrl, proxyFetch } from '@/lib/local-proxy';

export async function GET() {
  const results: any = {
    envCheck: {},
    proxyExitIp: null,
    redditViaProxy: null,
    redditDirect: null,
    redditOldViaProxy: null,
  };

  // 1. Check environment variables
  results.envCheck = {
    HTTP_PROXY: process.env.HTTP_PROXY ? 'SET (' + process.env.HTTP_PROXY.substring(0, 30) + '...)' : 'NOT SET',
    HTTPS_PROXY: process.env.HTTPS_PROXY ? 'SET (' + process.env.HTTPS_PROXY.substring(0, 30) + '...)' : 'NOT SET',
    NODE_ENV: process.env.NODE_ENV || 'not set',
  };

  const proxyUrl = getProxyUrl();
  const modernUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

  // 2. Test proxy exit IP via httpbin
  if (proxyUrl) {
    try {
      const undici = await import('undici');
      const agent = new undici.ProxyAgent(proxyUrl);
      const startTime = Date.now();
      const resp = await undici.request('https://httpbin.org/ip', {
        dispatcher: agent,
        method: 'GET',
        headers: { 'User-Agent': modernUA },
      });
      const elapsed = Date.now() - startTime;
      const body = await resp.body.text();
      
      if (resp.statusCode === 200) {
        const ipData = JSON.parse(body);
        results.proxyExitIp = {
          success: true,
          exitIp: ipData.origin,
          elapsed: elapsed + 'ms',
        };
      } else {
        results.proxyExitIp = {
          success: false,
          status: resp.statusCode,
          body: body.substring(0, 200),
          elapsed: elapsed + 'ms',
        };
      }
    } catch (e: any) {
      results.proxyExitIp = { success: false, error: e.message };
    }
  } else {
    results.proxyExitIp = { success: false, error: 'No proxy configured' };
  }

  // 3. Test Reddit API via proxy (using proxyFetch - the same function used in scanning)
  try {
    const startTime = Date.now();
    const resp = await proxyFetch('https://www.reddit.com/r/Hisense.json?limit=1', {
      headers: {
        'User-Agent': modernUA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    const elapsed = Date.now() - startTime;
    const body = await resp.clone().text();

    results.redditViaProxy = {
      success: resp.ok,
      status: resp.status,
      statusText: resp.statusText,
      elapsed: elapsed + 'ms',
      contentType: resp.headers.get('content-type'),
      server: resp.headers.get('server'),
      bodyPreview: body.substring(0, 500),
    };
  } catch (e: any) {
    results.redditViaProxy = { success: false, error: e.message };
  }

  // 4. Test old.reddit.com via proxy (sometimes less strict blocking)
  try {
    const startTime = Date.now();
    const resp = await proxyFetch('https://old.reddit.com/r/Hisense.json?limit=1', {
      headers: {
        'User-Agent': modernUA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    const elapsed = Date.now() - startTime;
    const body = await resp.clone().text();

    results.redditOldViaProxy = {
      success: resp.ok,
      status: resp.status,
      statusText: resp.statusText,
      elapsed: elapsed + 'ms',
      bodyPreview: body.substring(0, 500),
    };
  } catch (e: any) {
    results.redditOldViaProxy = { success: false, error: e.message };
  }

  // 5. Test direct Reddit access (no proxy, for comparison)
  try {
    const startTime = Date.now();
    const resp = await fetch('https://www.reddit.com/r/Hisense.json?limit=1', {
      headers: { 'User-Agent': modernUA },
      signal: AbortSignal.timeout(10000),
    });
    const elapsed = Date.now() - startTime;
    const body = await resp.clone().text();
    
    results.redditDirect = {
      success: resp.ok,
      status: resp.status,
      elapsed: elapsed + 'ms',
      bodyPreview: body.substring(0, 300),
    };
  } catch (e: any) {
    results.redditDirect = { success: false, error: e.message };
  }

  return NextResponse.json(results);
}
