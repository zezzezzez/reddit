// 代理配置 - 统一使用 Decodo 住宅代理
// 代理 URL 从环境变量 HTTP_PROXY / HTTPS_PROXY 读取

let cachedProxyAgent: any = null;

export function getProxyUrl(): string | null {
  return process.env.HTTP_PROXY || process.env.HTTPS_PROXY || null;
}

export function isLocalDevelopment() {
  return process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
}

/**
 * 获取 undici ProxyAgent（懒加载单例）
 * 如果没有配置代理，返回 null
 */
export async function getProxyAgent(): Promise<any> {
  const proxyUrl = getProxyUrl();
  if (!proxyUrl) return null;
  if (!cachedProxyAgent) {
    const undici = await import('undici');
    cachedProxyAgent = new undici.ProxyAgent(proxyUrl);
  }
  return cachedProxyAgent;
}

/**
 * 带代理支持的 fetch 包装器
 * 优先使用 undici.fetch + ProxyAgent，解决 Node.js 内置 fetch 不走 npm undici 全局 dispatcher 的问题
 */
export async function proxyFetch(url: string, init?: RequestInit): Promise<Response> {
  const agent = await getProxyAgent();
  if (agent) {
    try {
      console.log(`[Proxy] Using proxy fetch for: ${url.substring(0, 80)}...`);
      // 使用 undici.fetch，它尊重 dispatcher 选项
      const undici = await import('undici');
      const result = await (undici.fetch as any)(url, {
        ...(init as any),
        dispatcher: agent,
      });
      console.log(`[Proxy] Response status: ${result.status}`);
      return result;
    } catch (error: any) {
      console.error(`[Proxy] undici.fetch failed:`, error.message, error.cause || '');
      throw error;
    }
  }
  console.log(`[Proxy] No proxy configured, using direct fetch`);
  // 没有代理时使用全局 fetch
  return fetch(url, init);
}
