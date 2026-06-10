import { NextResponse } from 'next/server';
import { getConfig, saveConfig } from '@/lib/store';
import { initScheduler } from '@/lib/scheduler';

// GET: Get scan schedule config
export async function GET() {
  const config = getConfig();
  return NextResponse.json({
    autoScanEnabled: config.autoScanEnabled ?? false,
    scanTime: config.scanTime ?? '00:00',
    scanSchedule: config.scanSchedule ?? '0 9 * * *',
    sentimentThreshold: config.sentimentThreshold ?? -0.3,
  });
}

// POST: Save scan schedule config
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const config = getConfig();

    if (typeof body.autoScanEnabled === 'boolean') {
      config.autoScanEnabled = body.autoScanEnabled;
    }
    if (body.scanTime) {
      config.scanTime = body.scanTime;
    }
    if (body.scanSchedule) {
      config.scanSchedule = body.scanSchedule;
    }
    if (typeof body.sentimentThreshold === 'number') {
      config.sentimentThreshold = body.sentimentThreshold;
    }

    saveConfig(config);

    // Re-initialize scheduler with new config
    initScheduler();

    return NextResponse.json({
      success: true,
      message: config.autoScanEnabled
        ? `自动扫描已开启，将于每日 ${config.scanTime} 执行扫描`
        : '自动扫描已关闭',
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: error.message || '保存失败',
    }, { status: 500 });
  }
}
