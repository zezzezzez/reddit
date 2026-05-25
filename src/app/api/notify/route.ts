import { NextResponse } from 'next/server';
import { getConfig, saveConfig } from '@/lib/store';
import { sendDailyAlert, testFeishuNotify, buildAlertMessage } from '@/lib/feishu-notify';
import { FeishuNotifyConfig } from '@/lib/types';
import { initScheduler, getSchedulerStatus, triggerManualPush } from '@/lib/scheduler';

// Lazy-init scheduler on first API call
let schedulerInitialized = false;
function ensureScheduler() {
  if (!schedulerInitialized) {
    schedulerInitialized = true;
    initScheduler();
  }
}

// GET: Get notification config and preview
export async function GET() {
  ensureScheduler();
  const config = getConfig();
  const notifyConfig = config.feishuNotify || {
    enabled: false,
    mode: 'webhook',
    webhookUrl: '',
    notifyTime: '09:00',
    notifyLevels: ['critical', 'high'],
  };

  // Build preview of current alerts
  const preview = buildAlertMessage();
  const scheduler = getSchedulerStatus();

  return NextResponse.json({
    config: notifyConfig,
    preview: {
      hasAlerts: preview.hasAlerts,
      postCount: preview.postCount,
      textPreview: preview.text ? preview.text.slice(0, 500) : '',
    },
    scheduler: {
      enabled: scheduler.enabled,
      scheduledTime: scheduler.scheduledTime,
      lastPushTime: scheduler.lastPushTime,
      lastPushResult: scheduler.lastPushResult,
    },
  });
}

// POST: Save notification config
export async function POST(request: Request) {
  ensureScheduler();
  try {
    const body = await request.json();
    const notifyConfig: FeishuNotifyConfig = {
      enabled: body.enabled ?? false,
      mode: body.mode || 'webhook',
      webhookUrl: body.webhookUrl || '',
      notifyTime: body.notifyTime || '09:00',
      notifyLevels: body.notifyLevels || ['critical', 'high'],
      receiveUserId: body.receiveUserId,
      receiveChatId: body.receiveChatId,
    };

    const config = getConfig();
    config.feishuNotify = notifyConfig;
    saveConfig(config);

    // Re-initialize scheduler with new config
    initScheduler();

    return NextResponse.json({
      success: true,
      message: notifyConfig.enabled
        ? `飞书通知已开启，将于每日${notifyConfig.notifyTime}推送预警`
        : '飞书通知已关闭',
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: error.message || '保存失败',
    }, { status: 500 });
  }
}

// PUT: Test notification
export async function PUT() {
  try {
    const config = getConfig();
    const notifyConfig = config.feishuNotify;

    if (!notifyConfig?.enabled) {
      return NextResponse.json({
        success: false,
        message: '请先开启飞书通知',
      });
    }

    const result = await testFeishuNotify(notifyConfig);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: error.message || '测试失败',
    }, { status: 500 });
  }
}

// PATCH: Send daily alert now (manual trigger)
export async function PATCH() {
  try {
    const result = await triggerManualPush();
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: error.message || '推送失败',
    }, { status: 500 });
  }
}
