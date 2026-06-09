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
 * 返回的 Response 对象包含 .url 属性（跟踪重定向后的最终 URL）
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
        maxRedirections: 0, // 不自动跟随重定向，手动处理
      };

      // 处理 AbortController signal
      if (init?.signal) {
        reqOptions.signal = init.signal;
      }

      const resp = await undici.request(url, {
        ...reqOptions,
        dispatcher: agent,
      });

      // 手动处理 301/302/303/307/308 重定向
      if ([301, 302, 303, 307, 308].includes(resp.statusCode)) {
        const location = resp.headers['location'] as string | undefined;
        if (location) {
          // 解析相对路径为绝对 URL
          const redirectUrl = new URL(location, url).href;
          console.log(`[Proxy] Following redirect: ${resp.statusCode} -> ${redirectUrl.substring(0, 80)}`);
          // 递归请求重定向 URL（不传 signal 以避免冲突）
          return proxyFetch(redirectUrl, {
            ...init,
            signal: undefined,
          });
        }
      }

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

      const response = new Response(body, {
        status: resp.statusCode,
        statusText: resp.statusText || '',
        headers: responseHeaders,
      });

      // 设置 response.url（原生 Response 构造函数不支持此属性，手动定义）
      Object.defineProperty(response, 'url', {
        value: url,
        writable: false,
        configurable: true,
      });

      return response;
    } catch (error: any) {
      console.error(`[Proxy] undici.request failed:`, error.message);
      throw error;
    }
  }
  console.log(`[Proxy] No proxy configured, using direct fetch`);
  return fetch(url, init);
}
