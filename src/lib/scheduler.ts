// Scheduled Task Manager
// Handles daily Feishu alert push at configured time using node-cron
// Also handles daily auto-scan at midnight (00:00) to update sentiment trend

import * as cron from 'node-cron';
import { getConfig } from './store';
import { sendDailyAlert } from './feishu-notify';

let scheduledTask: cron.ScheduledTask | null = null;
let midnightScanTask: cron.ScheduledTask | null = null;
let lastPushTime: string | null = null;
let lastPushResult: { success: boolean; message: string; postCount: number } | null = null;

// Convert "HH:MM" to cron expression "M H * * *"
function timeToCron(time: string): string {
  const parts = time.split(':');
  if (parts.length !== 2) return '0 9 * * *'; // default 9:00
  const hour = parseInt(parts[0]) || 9;
  const minute = parseInt(parts[1]) || 0;
  return `${minute} ${hour} * * *`;
}

// Execute the daily push
async function executeDailyPush() {
  console.log(`[Scheduler] Starting daily push at ${new Date().toLocaleString('zh-CN')}...`);
  try {
    const result = await sendDailyAlert();
    lastPushTime = new Date().toISOString();
    lastPushResult = result;
    console.log(`[Scheduler] Push result: ${result.success ? 'SUCCESS' : 'FAILED'} - ${result.message} (${result.postCount} posts)`);
  } catch (error: any) {
    lastPushTime = new Date().toISOString();
    lastPushResult = { success: false, message: error.message || '推送异常', postCount: 0 };
    console.error(`[Scheduler] Push error: ${error.message}`);
  }
}

// Execute midnight auto-scan to update sentiment trend
async function executeMidnightScan() {
  console.log(`[Scheduler] Starting midnight auto-scan at ${new Date().toLocaleString('zh-CN')}...`);
  try {
    // Call the scan API internally
    const { POST: scanHandler } = await import('@/app/api/scan/route');
    const { NextRequest } = await import('next/server');
    
    // Create a mock request
    const mockRequest = new NextRequest('http://localhost/api/scan', {
      method: 'POST',
      body: JSON.stringify({ scanAll: true }),
    });
    
    const response = await scanHandler(mockRequest);
    const result = await response.json();
    
    console.log(`[Scheduler] Midnight scan result: ${result.success ? 'SUCCESS' : 'FAILED'} - ${result.message}`);
  } catch (error: any) {
    console.error(`[Scheduler] Midnight scan error: ${error.message}`);
  }
}

// Initialize or update the scheduled task
let initialized = false;

export function initScheduler(): void {
  // 防止重复初始化（热重载时很重要）
  if (initialized) {
    console.log('[Scheduler] Already initialized, skipping...');
    return;
  }
  
  // Stop existing tasks if any
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }
  if (midnightScanTask) {
    midnightScanTask.stop();
    midnightScanTask = null;
  }

  const config = getConfig();
  const notifyConfig = config.feishuNotify;

  // 1. Schedule daily Feishu push
  if (notifyConfig?.enabled) {
    const cronExpression = timeToCron(notifyConfig.notifyTime || '09:00');

    if (!cron.validate(cronExpression)) {
      console.error(`[Scheduler] Invalid cron expression: ${cronExpression}`);
    } else {
      scheduledTask = cron.schedule(cronExpression, executeDailyPush);
      console.log(`[Scheduler] Daily push scheduled at ${notifyConfig.notifyTime} (cron: ${cronExpression})`);
    }
  } else {
    console.log('[Scheduler] Feishu notification is disabled, no push task');
  }

  // 2. Schedule midnight auto-scan (00:00 every day)
  midnightScanTask = cron.schedule('0 0 * * *', executeMidnightScan);
  console.log('[Scheduler] Midnight auto-scan scheduled at 00:00 (cron: 0 0 * * *)');
  
  initialized = true;
}

// Get scheduler status
export function getSchedulerStatus(): {
  enabled: boolean;
  scheduledTime: string | null;
  cronExpression: string | null;
  lastPushTime: string | null;
  lastPushResult: { success: boolean; message: string; postCount: number } | null;
} {
  const config = getConfig();
  const notifyConfig = config.feishuNotify;

  return {
    enabled: notifyConfig?.enabled || false,
    scheduledTime: notifyConfig?.notifyTime || null,
    cronExpression: scheduledTask ? timeToCron(notifyConfig?.notifyTime || '09:00') : null,
    lastPushTime,
    lastPushResult,
  };
}

// Manually trigger the push now
export async function triggerManualPush(): Promise<{ success: boolean; message: string; postCount: number }> {
  const result = await sendDailyAlert();
  lastPushTime = new Date().toISOString();
  lastPushResult = result;
  return result;
}
