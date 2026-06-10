// GET /api/feishu-auth/status
// 返回当前飞书用户授权状态（供前端设置页展示）

import { NextResponse } from 'next/server';
import { getAuthStatus, getValidUserAccessToken } from '@/lib/feishu-auth';

export async function GET() {
  try {
    const status = getAuthStatus();

    // 如果已授权，尝试获取有效 token（这会触发自动刷新）
    let tokenValid = false;
    let tokenError: string | null = null;
    if (status.authorized) {
      try {
        await getValidUserAccessToken();
        tokenValid = true;
      } catch (e: any) {
        tokenValid = false;
        tokenError = e.message || 'token 无效';
      }
    }

    return NextResponse.json({
      success: true,
      ...status,
      tokenValid,
      tokenError,
    });
  } catch (error: any) {
    console.error('[FeishuAuth] 查询授权状态失败:', error);
    return NextResponse.json({
      success: false,
      message: error.message || '查询授权状态失败',
    }, { status: 500 });
  }
}
