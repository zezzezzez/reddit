// Feishu User Authorization Module
// Implements OAuth 2.0 user authorization flow to obtain user_access_token
// 用于跨租户访问（如访问外部公司 bluefocus.feishu.cn 下的 Bitable 文档）
//
// 流程：
// 1. 前端调用 /api/feishu-auth/url 获取授权 URL
// 2. 用户在飞书授权页面确认授权
// 3. 飞书回调到 /api/feishu-auth/callback 携带 code
// 4. 后端用 code 换取 user_access_token + refresh_token
// 5. 自动用 user_access_token 访问跨租户资源
// 6. 过期前用 refresh_token 自动刷新

import { getConfig, saveConfig } from './store';
import { FeishuUserAuth } from './types';

// 飞书 OAuth 端点
const FEISHU_AUTH_URL = 'https://open.feishu.cn/open-apis/authen/v1/index';
const FEISHU_TOKEN_URL = 'https://open.feishu.cn/open-apis/authen/v2/oauth/token';
const FEISHU_REFRESH_URL = 'https://open.feishu.cn/open-apis/authen/v2/oauth/token';

// 内存中的 token 缓存（避免每次都从 config 读取）
let cachedToken: { token: string; expiresAt: number } | null = null;

// 飞书 user_access_token 有效期默认 2 小时（7200 秒），我们提前 10 分钟刷新
const TOKEN_REFRESH_BUFFER = 10 * 60 * 1000; // 10 minutes

// ============================================================
// 配置与 URL 生成
// ============================================================

/**
 * 获取飞书 OAuth 回调地址
 * 优先级：环境变量 > 默认 EC2 公网地址
 */
export function getRedirectUri(): string {
  // 优先从环境变量读取（部署时可灵活配置）
  if (process.env.FEISHU_REDIRECT_URI) {
    return process.env.FEISHU_REDIRECT_URI;
  }
  // 默认使用当前域名拼接（生产环境需在飞书后台配置对应 redirect_uri）
  return 'http://localhost:3000/api/feishu-auth/callback';
}

/**
 * 生成飞书用户授权 URL
 * 用户点击后跳转到飞书授权页面
 */
export function generateAuthorizationUrl(state?: string): string {
  const config = getConfig();
  const feishuCfg = config.feishu;

  if (!feishuCfg.appId) {
    throw new Error('请先在系统设置中配置飞书应用 App ID');
  }

  // 飞书 OAuth 授权 scope：
  // - bitable:app:readonly - 只读访问多维表格
  // - bitable:app - 读写多维表格
  // 我们只需要读取文档，所以用只读权限即可
  const scope = 'bitable:app:readonly';

  const params = new URLSearchParams({
    app_id: feishuCfg.appId,
    redirect_uri: getRedirectUri(),
    scope,
    state: state || randomState(),
  });

  return `${FEISHU_AUTH_URL}?${params.toString()}`;
}

/**
 * 生成随机 state 字符串（防 CSRF）
 */
function randomState(): string {
  return Math.random().toString(36).substring(2, 15) +
         Math.random().toString(36).substring(2, 15);
}

// ============================================================
// Token 交换与刷新
// ============================================================

interface TokenResponse {
  code: number;
  msg: string;
  data?: {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;         // access_token 有效期（秒）
    refresh_expires_in: number; // refresh_token 有效期（秒）
    scope: string;
  };
}

/**
 * 用授权码 code 换取 user_access_token
 */
export async function exchangeCodeForToken(code: string): Promise<FeishuUserAuth> {
  const config = getConfig();
  const feishuCfg = config.feishu;

  if (!feishuCfg.appId || !feishuCfg.appSecret) {
    throw new Error('请先在系统设置中配置飞书应用 App ID 和 App Secret');
  }

  // 飞书 v2 OAuth token 端点使用 app_secret_basic 认证
  const basicAuth = Buffer.from(`${feishuCfg.appId}:${feishuCfg.appSecret}`).toString('base64');

  const response = await fetch(FEISHU_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
    }).toString(),
  });

  const data: TokenResponse = await response.json();

  if (data.code !== 0 || !data.data) {
    throw new Error(`飞书授权失败: ${data.msg || JSON.stringify(data)}`);
  }

  const now = Date.now();
  const tokenInfo: FeishuUserAuth = {
    accessToken: data.data.access_token,
    refreshToken: data.data.refresh_token,
    openId: '', // 需要额外调用 user info 接口获取
    unionId: '',
    scope: data.data.scope,
    expiresAt: now + data.data.expires_in * 1000,
    refreshExpiresAt: now + data.data.refresh_expires_in * 1000,
    authorizedAt: now,
    userName: '',
    externalAppToken: config.feishuUserAuth?.externalAppToken || '',
    externalTableId: config.feishuUserAuth?.externalTableId || '',
  };

  // 获取用户信息（open_id 等）
  try {
    const userInfo = await fetchUserInfo(tokenInfo.accessToken);
    if (userInfo) {
      tokenInfo.openId = userInfo.open_id || '';
      tokenInfo.unionId = userInfo.union_id || '';
      tokenInfo.userName = userInfo.name || userInfo.en_name || '';
    }
  } catch (e) {
    console.warn('[FeishuAuth] 获取用户信息失败:', e);
    // 不影响主流程
  }

  // 保存到 config
  config.feishuUserAuth = tokenInfo;
  saveConfig(config);

  // 重置内存缓存
  cachedToken = null;

  console.log(`[FeishuAuth] OAuth 授权成功: openId=${tokenInfo.openId}, expires at ${new Date(tokenInfo.expiresAt).toLocaleString('zh-CN')}`);

  return tokenInfo;
}

interface UserInfoResponse {
  code: number;
  msg: string;
  data?: {
    union_id: string;
    open_id: string;
    name: string;
    en_name: string;
    email?: string;
    avatar_url?: string;
  };
}

/**
 * 用 user_access_token 获取用户信息
 */
async function fetchUserInfo(accessToken: string): Promise<UserInfoResponse['data'] | null> {
  const response = await fetch('https://open.feishu.cn/open-apis/authen/v1/user_info', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  const data: UserInfoResponse = await response.json();

  if (data.code !== 0 || !data.data) {
    return null;
  }

  return data.data;
}

/**
 * 用 refresh_token 刷新 access_token
 */
export async function refreshUserToken(): Promise<FeishuUserAuth> {
  const config = getConfig();
  const auth = config.feishuUserAuth;

  if (!auth?.refreshToken) {
    throw new Error('未找到 refresh_token，请重新授权');
  }

  // 检查 refresh_token 是否过期
  if (auth.refreshExpiresAt && auth.refreshExpiresAt < Date.now()) {
    throw new Error('refresh_token 已过期（飞书默认30天），请重新授权');
  }

  const feishuCfg = config.feishu;
  const basicAuth = Buffer.from(`${feishuCfg.appId}:${feishuCfg.appSecret}`).toString('base64');

  const response = await fetch(FEISHU_REFRESH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: auth.refreshToken,
    }).toString(),
  });

  const data: TokenResponse = await response.json();

  if (data.code !== 0 || !data.data) {
    throw new Error(`刷新 token 失败: ${data.msg || JSON.stringify(data)}`);
  }

  const now = Date.now();
  const updated: FeishuUserAuth = {
    ...auth,
    accessToken: data.data.access_token,
    refreshToken: data.data.refresh_token, // 飞书会同时返回新的 refresh_token
    scope: data.data.scope,
    expiresAt: now + data.data.expires_in * 1000,
    refreshExpiresAt: now + data.data.refresh_expires_in * 1000,
  };

  config.feishuUserAuth = updated;
  saveConfig(config);

  // 重置缓存
  cachedToken = null;

  console.log(`[FeishuAuth] Token 刷新成功: expires at ${new Date(updated.expiresAt).toLocaleString('zh-CN')}`);

  return updated;
}

/**
 * 获取当前有效的 user_access_token
 * - 如果内存缓存有效，直接返回
 * - 如果过期，自动刷新
 * - 抛出错误则需要重新授权
 */
export async function getValidUserAccessToken(): Promise<string> {
  // 检查内存缓存
  if (cachedToken && cachedToken.expiresAt > Date.now() + TOKEN_REFRESH_BUFFER) {
    return cachedToken.token;
  }

  const config = getConfig();
  const auth = config.feishuUserAuth;

  if (!auth?.accessToken) {
    throw new Error('未授权：请先完成飞书 OAuth 授权');
  }

  // 检查是否过期（提前 10 分钟判定为需要刷新）
  if (auth.expiresAt > Date.now() + TOKEN_REFRESH_BUFFER) {
    // 未过期，更新缓存并返回
    cachedToken = { token: auth.accessToken, expiresAt: auth.expiresAt };
    return auth.accessToken;
  }

  // 已过期或即将过期，尝试刷新
  console.log('[FeishuAuth] access_token 已过期，尝试 refresh...');
  const refreshed = await refreshUserToken();
  cachedToken = { token: refreshed.accessToken, expiresAt: refreshed.expiresAt };
  return refreshed.accessToken;
}

/**
 * 清除授权信息（用户主动撤销授权时使用）
 */
export function clearUserAuth(): void {
  const config = getConfig();
  config.feishuUserAuth = undefined;
  saveConfig(config);
  cachedToken = null;
  console.log('[FeishuAuth] 已清除飞书用户授权信息');
}

/**
 * 获取授权状态（供前端展示）
 */
export function getAuthStatus(): {
  authorized: boolean;
  openId: string;
  userName: string;
  expiresAt: string | null;
  refreshExpiresAt: string | null;
  isExpired: boolean;
  needsRefresh: boolean;
  externalAppToken: string;
  externalTableId: string;
} {
  const config = getConfig();
  const auth = config.feishuUserAuth;

  if (!auth?.accessToken) {
    return {
      authorized: false,
      openId: '',
      userName: '',
      expiresAt: null,
      refreshExpiresAt: null,
      isExpired: true,
      needsRefresh: true,
      externalAppToken: auth?.externalAppToken || '',
      externalTableId: auth?.externalTableId || '',
    };
  }

  const now = Date.now();
  return {
    authorized: true,
    openId: auth.openId,
    userName: auth.userName || '',
    expiresAt: new Date(auth.expiresAt).toISOString(),
    refreshExpiresAt: auth.refreshExpiresAt ? new Date(auth.refreshExpiresAt).toISOString() : null,
    isExpired: auth.expiresAt < now,
    needsRefresh: auth.expiresAt < now + TOKEN_REFRESH_BUFFER,
    externalAppToken: auth.externalAppToken || '',
    externalTableId: auth.externalTableId || '',
  };
}
