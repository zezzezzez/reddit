import { NextResponse } from 'next/server';
import { isApifyConfigured } from '@/lib/apify';

export async function GET() {
  try {
    if (!isApifyConfigured()) {
      return NextResponse.json({
        connected: false,
        message: 'Apify 未配置，请设置 APIFY_TOKEN 环境变量',
      });
    }

    return NextResponse.json({
      connected: true,
      message: 'Apify 已配置，可以扫描 Reddit 帖子',
      apifyConfigured: true,
    });
  } catch (error: any) {
    return NextResponse.json({
      connected: false,
      message: `连接检查失败: ${error.message}`,
    });
  }
}
