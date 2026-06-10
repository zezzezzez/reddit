// POST /api/feishu-auth/external
// 保存/更新外部飞书文档配置（externalAppToken, externalTableId）
// 用于跨租户同步：访问外部公司租户（如 bluefocus.feishu.cn）下的 Bitable 文档

import { NextResponse } from 'next/server';
import { getConfig, saveConfig } from '@/lib/store';

interface ExternalDocBody {
  externalAppToken?: string;
  externalTableId?: string;
  urlFieldName?: string;   // 可选：自定义 URL 字段名，默认 "Reddit URL"
}

export async function POST(request: Request) {
  try {
    const body: ExternalDocBody = await request.json();
    const config = getConfig();

    // 确保 feishuUserAuth 对象存在
    if (!config.feishuUserAuth) {
      config.feishuUserAuth = {
        accessToken: '',
        refreshToken: '',
        openId: '',
        expiresAt: 0,
        authorizedAt: 0,
        externalAppToken: body.externalAppToken || '',
        externalTableId: body.externalTableId || '',
      };
    } else {
      // 仅更新外部文档字段
      if (body.externalAppToken !== undefined) {
        config.feishuUserAuth.externalAppToken = body.externalAppToken;
      }
      if (body.externalTableId !== undefined) {
        config.feishuUserAuth.externalTableId = body.externalTableId;
      }
    }

    saveConfig(config);

    return NextResponse.json({
      success: true,
      message: '外部文档配置已保存',
      externalAppToken: config.feishuUserAuth.externalAppToken,
      externalTableId: config.feishuUserAuth.externalTableId,
    });
  } catch (error: any) {
    console.error('[FeishuAuth] 保存外部文档配置失败:', error);
    return NextResponse.json({
      success: false,
      message: error.message || '保存失败',
    }, { status: 500 });
  }
}

// GET /api/feishu-auth/external
// 查询当前外部文档配置
export async function GET() {
  try {
    const config = getConfig();
    const auth = config.feishuUserAuth;

    return NextResponse.json({
      success: true,
      externalAppToken: auth?.externalAppToken || '',
      externalTableId: auth?.externalTableId || '',
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: error.message || '查询失败',
    }, { status: 500 });
  }
}
