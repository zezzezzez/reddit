// 代理配置 - 统一使用 Decodo 住宅代理
// 代理 URL 从环境变量 HTTP_PROXY / HTTPS_PROXY 读取

export function getProxyUrl(): string | null {
  return process.env.HTTP_PROXY || process.env.HTTPS_PROXY || null;
}

export function isLocalDevelopment() {
  return process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
}
