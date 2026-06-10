// GET /api/feishu-auth/url
// 返回飞书 OAuth 用户授权 URL
// 前端拿到 URL 后引导用户跳转，完成飞书账号授权

import { NextResponse } from 'next/server';
import { generateAuthorizationUrl, getRedirectUri } from '@/lib/feishu-auth';

export async function GET(request: Request) {
  try {
    // 优先从 Host 头获取 origin，避免 Next.js request.url 返回 0.0.0.0 或 localhost
    const host = request.headers.get('host') || request.headers.get('x-forwarded-host');
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const origin = host ? `${protocol}://${host}` : new URL(request.url).origin;
    const redirectUri = `${origin}/api/feishu-auth/callback`;

    // 临时覆盖环境变量，让 generateAuthorizationUrl 使用动态 origin
    const originalEnv = process.env.FEISHU_REDIRECT_URI;
    process.env.FEISHU_REDIRECT_URI = redirectUri;

    const authUrl = generateAuthorizationUrl();

    // 恢复原值
    if (originalEnv === undefined) {
      delete process.env.FEISHU_REDIRECT_URI;
    } else {
      process.env.FEISHU_REDIRECT_URI = originalEnv;
    }

    return NextResponse.json({
      success: true,
      authUrl,
      redirectUri,
    });
  } catch (error: any) {
    console.error('[FeishuAuth] 生成授权 URL 失败:', error);
    return NextResponse.json({
      success: false,
      message: error.message || '生成授权 URL 失败',
    }, { status: 500 });
  }
}
