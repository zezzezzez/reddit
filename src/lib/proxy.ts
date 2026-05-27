// Proxy-aware fetch utility for server-side requests
// Frankfurt EC2: Direct access to Reddit (no proxy needed)

import { getConfig } from './store';
import { ProxyConfig } from './types';

// Cache the dispatcher to avoid re-creating on every request
let cachedDispatcher: any = null;
let cachedProxyUrl: string | null = null;
let initialized = false;

function getProxyUrl(): string | null {
  const config = getConfig();
  const proxy = config.proxy;

  if (!proxy || !proxy.enabled || !proxy.host || !proxy.port) {
    return null;
  }

  return `${proxy.protocol}://${proxy.host}:${proxy.port}`;
}

async function setupProxy(proxyUrl: string) {
  // Return cached if same proxy URL
  if (cachedDispatcher && cachedProxyUrl === proxyUrl) {
    return cachedDispatcher;
  }

  try {
    const undici = await import('undici');
    const dispatcher = new undici.ProxyAgent(proxyUrl);
    cachedDispatcher = dispatcher;
    cachedProxyUrl = proxyUrl;

    // Set as global dispatcher so ALL fetch calls use it
    undici.setGlobalDispatcher(dispatcher);

    console.log(`[Proxy] Set global dispatcher: ${proxyUrl}`);
    return dispatcher;
  } catch (error) {
    console.error('[Proxy] Failed to create ProxyAgent:', error);
    process.env.HTTP_PROXY = proxyUrl;
    process.env.HTTPS_PROXY = proxyUrl;
    return null;
  }
}

// Initialize proxy from config - call this once on startup
export async function initProxy(): Promise<boolean> {
  initialized = true;
  const proxyUrl = getProxyUrl();

  if (!proxyUrl) {
    // Clear proxy if previously set
    if (cachedDispatcher) {
      try {
        const undici = await import('undici');
        // Reset to default dispatcher
        const { Agent } = await import('undici');
        undici.setGlobalDispatcher(new Agent());
        cachedDispatcher = null;
        cachedProxyUrl = null;
        console.log('[Proxy] Cleared proxy (no proxy configured)');
      } catch {}
    }
    return false;
  }

  const dispatcher = await setupProxy(proxyUrl);
  return !!dispatcher;
}

// Direct fetch - no proxy needed for Frankfurt EC2
export async function proxyFetch(url: string, options: RequestInit = {}): Promise<Response> {
  // Frankfurt EC2 has direct internet access, no proxy needed
  return fetch(url, options);
}

// Test proxy connectivity
export async function testProxyConnection(proxyConfig: ProxyConfig): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch('https://www.reddit.com/.json?limit=1', {
      signal: controller.signal,
      headers: {
        'User-Agent': 'HisenseRedditMonitor/1.0',
      },
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      return {
        success: true,
        message: '直接连接成功，可以访问 Reddit（法兰克福服务器无需代理）',
      };
    } else {
      return {
        success: false,
        message: `Reddit 返回状态码 ${response.status}`,
      };
    }
  } catch (error: any) {
    const errorMsg = error.name === 'AbortError'
      ? '连接超时(15秒)'
      : `连接失败: ${error.message}`;
    return {
      success: false,
      message: errorMsg,
    };
  }
}

// Auto-detect system proxy from Windows registry
export function detectSystemProxy(): ProxyConfig | null {
  return null;
}
