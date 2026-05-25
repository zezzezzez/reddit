import { NextResponse } from 'next/server';
import { getConfig, saveConfig } from '@/lib/store';

export async function GET() {
  try {
    const config = getConfig();
    return NextResponse.json({
      success: true,
      rules: config.detectionRules || {
        brand_attack: true,
        product_hate: true,
        negative_sentiment: true,
        call_to_action_negative: true,
        competitor_push: true,
      },
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: error.message || '获取检测规则失败',
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const config = getConfig();
    config.detectionRules = {
      brand_attack: body.brand_attack ?? true,
      product_hate: body.product_hate ?? true,
      negative_sentiment: body.negative_sentiment ?? true,
      call_to_action_negative: body.call_to_action_negative ?? true,
      competitor_push: body.competitor_push ?? true,
    };
    saveConfig(config);
    return NextResponse.json({
      success: true,
      message: '检测规则已保存',
      rules: config.detectionRules,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: error.message || '保存检测规则失败',
    }, { status: 500 });
  }
}
