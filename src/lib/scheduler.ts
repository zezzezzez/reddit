// Scheduled Task Manager
// Handles daily Feishu alert push at configured time using node-cron

import * as cron from 'node-cron';
import { getConfig } from './store';
import { sendDailyAlert } from './feishu-notify';

let scheduledTask: cron.ScheduledTask | null = null;
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

// Initialize or update the scheduled task
export function initScheduler(): void {
  // Stop existing task if any
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
  }

  const config = getConfig();
  const notifyConfig = config.feishuNotify;

  if (!notifyConfig?.enabled) {
    console.log('[Scheduler] Feishu notification is disabled, no scheduled task');
    return;
  }

  const cronExpression = timeToCron(notifyConfig.notifyTime || '09:00');

  if (!cron.validate(cronExpression)) {
    console.error(`[Scheduler] Invalid cron expression: ${cronExpression}`);
    return;
  }

  scheduledTask = cron.schedule(cronExpression, executeDailyPush);

  console.log(`[Scheduler] Daily push scheduled at ${notifyConfig.notifyTime} (cron: ${cronExpression})`);
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
