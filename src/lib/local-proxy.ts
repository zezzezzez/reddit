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
 * 使用 undici.request（底层 API）+ ProxyAgent，兼容 Next.js 生产构建
 */
export async function proxyFetch(url: string, init?: RequestInit): Promise<Response> {
  const agent = await getProxyAgent();
  if (agent) {
    try {
      console.log(`[Proxy] Using proxy for: ${url.substring(0, 80)}`);
      const undici = await import('undici');

      // 构建 undici.request 选项
      const reqOptions: any = {
        method: init?.method || 'GET',
        headers: init?.headers as any,
      };

      // 处理 AbortController signal
      if (init?.signal) {
        reqOptions.signal = init.signal;
      }

      const resp = await undici.request(url, {
        ...reqOptions,
        dispatcher: agent,
      });

      // 读取响应体
      const body = await resp.body.text();

      console.log(`[Proxy] Response status: ${resp.statusCode} for ${url.substring(0, 60)}`);

      // 手动构造 Response 对象
      const responseHeaders = new Headers();
      for (const [key, value] of Object.entries(resp.headers)) {
        if (Array.isArray(value)) {
          value.forEach(v => responseHeaders.append(key, v));
        } else {
          responseHeaders.set(key, value as string);
        }
      }

      return new Response(body, {
        status: resp.statusCode,
        statusText: resp.statusText || '',
        headers: responseHeaders,
      });
    } catch (error: any) {
      console.error(`[Proxy] undici.request failed:`, error.message);
      throw error;
    }
  }
  console.log(`[Proxy] No proxy configured, using direct fetch`);
  return fetch(url, init);
}
