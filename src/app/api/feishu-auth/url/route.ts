// GET /api/feishu-auth/url
// 返回飞书 OAuth 用户授权 URL
// 前端拿到 URL 后引导用户跳转，完成飞书账号授权

import { NextResponse } from 'next/server';
import { generateAuthorizationUrl, getRedirectUri } from '@/lib/feishu-auth';

export async function GET() {
  try {
    const authUrl = generateAuthorizationUrl();
    const redirectUri = getRedirectUri();

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
