// POST /api/feishu-auth/revoke
// 撤销飞书用户授权（清除本地保存的 user_access_token / refresh_token）
// 注意：这只是清除本地凭证，真实撤销需要在飞书开放平台操作
//   https://open.feishu.cn/app -> 权限管理 -> 用户授权列表

import { NextResponse } from 'next/server';
import { clearUserAuth, getAuthStatus } from '@/lib/feishu-auth';

export async function POST() {
  try {
    const before = getAuthStatus();
    clearUserAuth();
    const after = getAuthStatus();

    return NextResponse.json({
      success: true,
      message: `已撤销${before.userName || '用户'}的飞书授权`,
      before,
      after,
    });
  } catch (error: any) {
    console.error('[FeishuAuth] 撤销授权失败:', error);
    return NextResponse.json({
      success: false,
      message: error.message || '撤销授权失败',
    }, { status: 500 });
  }
}
