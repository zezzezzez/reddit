// GET /api/feishu-auth/callback
// 飞书 OAuth 授权回调端点
// 飞书会带上 ?code=xxx&state=yyy 跳转到此
// 后端用 code 换取 user_access_token，然后重定向回设置页面

import { NextResponse } from 'next/server';
import { exchangeCodeForToken, getAuthStatus } from '@/lib/feishu-auth';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // 飞书可能返回 error（用户拒绝授权等）
    if (error) {
      console.error('[FeishuAuth] 飞书返回错误:', error);
      return redirectWithMessage(request, 'error', `飞书授权失败: ${error}`);
    }

    if (!code) {
      return redirectWithMessage(request, 'error', '未收到授权码 (code)');
    }

    console.log(`[FeishuAuth] 收到回调: code=${code.substring(0, 8)}..., state=${state}`);

    // 用 code 换取 token 并保存（传入与授权时一致的 redirect_uri）
    const host = request.headers.get('host') || request.headers.get('x-forwarded-host');
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const origin = host ? `${protocol}://${host}` : new URL(request.url).origin;
    const redirectUri = `${origin}/api/feishu-auth/callback`;
    await exchangeCodeForToken(code, redirectUri);

    const status = getAuthStatus();

    return redirectWithMessage(request, 'success', `授权成功: ${status.userName || status.openId || '用户'}`, {
      ...(status.userName ? { userName: status.userName } : {}),
      ...(status.expiresAt ? { expiresAt: status.expiresAt } : {}),
    });
  } catch (error: any) {
    console.error('[FeishuAuth] 回调处理失败:', error);
    return redirectWithMessage(request, 'error', error.message || '授权回调处理失败');
  }
}

/**
 * 重定向到前端设置页，并附带状态信息
 * 通过 query string 传递结果，避免使用 cookie 或 session
 */
function redirectWithMessage(
  request: Request,
  status: 'success' | 'error',
  message: string,
  extra: Record<string, string> = {}
): NextResponse {
  // 优先从 Host 头获取 origin，避免 request.url 返回 0.0.0.0
  const host = request.headers.get('host') || request.headers.get('x-forwarded-host');
  const protocol = request.headers.get('x-forwarded-proto') || 'http';
  const origin = host ? `${protocol}://${host}` : new URL(request.url).origin;

  const params = new URLSearchParams({
    feishu_auth: status,
    feishu_msg: message,
  });

  for (const [k, v] of Object.entries(extra)) {
    if (v) params.set(`feishu_${k}`, v);
  }

  return NextResponse.redirect(`${origin}/settings?${params.toString()}`);
}
