// 本地开发环境代理配置
// 仅在本地开发时使用，生产环境（EC2/Vercel）不使用

const PROXY_CONFIG = {
  enabled: process.env.NODE_ENV !== 'production', // 仅开发环境启用
  host: '10.19.193.99',
  port: 443,
  protocol: 'http' as const,
};

export function getLocalProxyConfig() {
  if (!PROXY_CONFIG.enabled) {
    return null;
  }
  
  return PROXY_CONFIG;
}

export function isLocalDevelopment() {
  return process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
}
