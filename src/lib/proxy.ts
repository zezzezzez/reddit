// Proxy-aware fetch utility for server-side requests
// Node.js built-in fetch (undici) does NOT respect system proxy settings
// This module provides a proxyFetch function that routes through configured proxy
// On Vercel: servers are in the US, can access Reddit directly without proxy

import { getConfig } from './store';
import { ProxyConfig } from './types';

const isVercel = !!process.env.VERCEL;

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

// Proxy-aware fetch - wraps standard fetch with proxy support
export async function proxyFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const proxyUrl = getProxyUrl();

  // On Vercel without proxy configured, use direct fetch (Vercel can access Reddit directly)
  if (!proxyUrl && isVercel) {
    return fetch(url, options);
  }

  if (proxyUrl) {
    // Ensure proxy dispatcher is set (safe to call repeatedly, uses cache)
    await setupProxy(proxyUrl);
  } else if (!initialized) {
    // First call with no config - try init once
    await initProxy();
  }

  // Use standard fetch - with undici ProxyAgent set as global dispatcher,
  // all fetch calls will automatically go through the proxy
  return fetch(url, options);
}

// Test proxy connectivity
export async function testProxyConnection(proxyConfig: ProxyConfig): Promise<{
  success: boolean;
  message: string;
}> {
  const proxyUrl = `${proxyConfig.protocol}://${proxyConfig.host}:${proxyConfig.port}`;

  try {
    const { ProxyAgent } = await import('undici');
    const testDispatcher = new ProxyAgent(proxyUrl);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch('https://www.reddit.com/.json?limit=1', {
      dispatcher: testDispatcher,
      signal: controller.signal,
      headers: {
        'User-Agent': 'HisenseRedditMonitor/1.0',
      },
    } as any);

    clearTimeout(timeoutId);

    if (response.ok) {
      return {
        success: true,
        message: `代理连接成功 (${proxyConfig.protocol}://${proxyConfig.host}:${proxyConfig.port})，可以访问 Reddit`,
      };
    } else {
      return {
        success: false,
        message: `代理已连接但 Reddit 返回状态码 ${response.status}`,
      };
    }
  } catch (error: any) {
    const errorMsg = error.name === 'AbortError'
      ? '连接超时(15秒)，请检查代理地址和端口是否正确'
      : `连接失败: ${error.message}`;
    return {
      success: false,
      message: errorMsg,
    };
  }
}

// Auto-detect system proxy from Windows registry
// Not applicable on Vercel (no Windows registry access)
export function detectSystemProxy(): ProxyConfig | null {
  if (isVercel) return null;
  try {
    const { execSync } = require('child_process');
    const result = execSync(
      'powershell -Command "(Get-ItemProperty \'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings\').ProxyServer"',
      { encoding: 'utf-8', timeout: 5000 }
    ).trim();

    if (!result) return null;

    // Parse proxy string like "10.19.193.99:443" or "http=10.19.193.99:443;https=..."
    let host = '';
    let port = 443;
    let protocol = 'http';

    // Simple format: host:port
    const simpleMatch = result.match(/^([\d.]+):(\d+)$/);
    if (simpleMatch) {
      host = simpleMatch[1];
      port = parseInt(simpleMatch[2]);
    } else {
      // Try to extract http/https proxy
      const httpMatch = result.match(/https?=([\d.]+):(\d+)/i);
      if (httpMatch) {
        host = httpMatch[1];
        port = parseInt(httpMatch[2]);
      }
    }

    if (!host) return null;

    return { enabled: true, host, port, protocol: protocol as 'http' | 'https' | 'socks5' };
  } catch {
    return null;
  }
}
