// Feishu Notification Module
// Sends daily alert summaries to Feishu group/person via Webhook or App API

import { getPosts, getComments, getConfig } from './store';
import { FeishuNotifyConfig, RedditPost, RedditComment, AlertLevel } from './types';

const ALERT_LABELS: Record<string, string> = {
  critical: '🔴 严重',
  medium: '🟡 中等',
  safe: '🟢 安全',
};

const CATEGORY_LABELS: Record<string, string> = {
  brand_attack: '品牌攻击',
  product_hate: '产品差评',
  negative_sentiment: '负面情绪',
  call_to_action_negative: '号召抵制',
  competitor_push: '竞品推荐',
};

// Render a visual bar using Unicode block characters
function renderBar(percent: number, totalBars = 10): string {
  const filled = Math.round((percent / 100) * totalBars);
  const empty = totalBars - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

// Calculate overall sentiment health score (0-100)
// 基于负面评论数，按帖子等级差异化扣分
function calcHealthScore(
  totalComments: number,
  negative: number,
  criticalPosts: number,
  mediumPosts: number,
  flaggedRatio: number
): { score: number; label: string; emoji: string } {
  if (totalComments === 0) return { score: 100, label: '暂无数据', emoji: '⚪' };
  
  // 严重帖子扣分：每条扣 4 分（封顶 60 分）
  const criticalPenalty = criticalPosts * 4;
  
  // 中等帖子扣分：每条扣 1.5 分（封顶 25 分）
  const mediumPenalty = mediumPosts * 1.5;
  
  // 恶意评论率扣分：每 1% 扣 0.5 分（封顶 15 分）
  const flaggedPenalty = flaggedRatio * 0.5;
  
  let score = Math.max(0, Math.round(100 - Math.min(criticalPenalty, 60) - Math.min(mediumPenalty, 25) - Math.min(flaggedPenalty, 15)));
  score = Math.min(100, Math.max(0, score));
  if (score >= 80) return { score, label: '健康', emoji: '🟢' };
  if (score >= 60) return { score, label: '一般', emoji: '🟡' };
  if (score >= 40) return { score, label: '预警', emoji: '🟠' };
  return { score, label: '高危', emoji: '🔴' };
}

// Flatten nested comments
function flattenComments(comments: RedditComment[]): RedditComment[] {
  const result: RedditComment[] = [];
  for (const c of comments) {
    result.push(c);
    if (c.replies && Array.isArray(c.replies)) {
      result.push(...flattenComments(c.replies));
    }
  }
  return result;
}

// Get the base URL for this monitoring system (dynamically from config)
function getSystemBaseUrl(): string {
  const config = getConfig();
  // Use tunnelUrl from config if available, fallback to localhost
  return (config as any).tunnelUrl || 'http://localhost:3000';
}

// Build the alert message content
export function buildAlertMessage(): {
  hasAlerts: boolean;
  text: string;
  richText: any;
  postCount: number;
} {
  const posts = getPosts();
  const allComments = getComments();
  const config = getConfig();
  const notifyLevels = config.feishuNotify?.notifyLevels || ['critical'];

  const alertPosts = posts.filter(p =>
    notifyLevels.includes(p.alertLevel) && p.lastScanned
  ).sort((a, b) => {
    const order: Record<string, number> = { critical: 0, medium: 1, safe: 2 };
    return (order[a.alertLevel] ?? 99) - (order[b.alertLevel] ?? 99);
  });

  // Always generate daily report (even with 0 alert posts)
  const now = new Date();
  const dateStr = now.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
  const baseUrl = getSystemBaseUrl();

  // === Global dashboard stats ===
  const totalPosts = posts.length;
  const criticalPosts = posts.filter(p => p.alertLevel === 'critical').length;
  const mediumPosts = posts.filter(p => p.alertLevel === 'medium').length;
  const safePosts = posts.filter(p => p.alertLevel === 'safe' || p.alertLevel === 'low').length;
  const flaggedComments = allComments.filter(c => c.isFlagged);
  const positive = allComments.filter(c => c.sentimentScore > 0.1).length;
  const neutral = allComments.filter(c => c.sentimentScore >= -0.1 && c.sentimentScore <= 0.1).length;
  const negative = allComments.filter(c => c.sentimentScore < -0.1).length;
  const flaggedRatio = allComments.length > 0 ? (flaggedComments.length / allComments.length * 100).toFixed(1) : '0';

  // Category breakdown
  const categoryCount: Record<string, number> = {};
  flaggedComments.forEach(c => {
    c.flagReasons.forEach(r => {
      categoryCount[r] = (categoryCount[r] || 0) + 1;
    });
  });

  const posPct = allComments.length > 0 ? (positive/allComments.length*100) : 0;
  const neuPct = allComments.length > 0 ? (neutral/allComments.length*100) : 0;
  const negPct = allComments.length > 0 ? (negative/allComments.length*100) : 0;
  const health = calcHealthScore(allComments.length, negative, criticalPosts, mediumPosts, parseFloat(flaggedRatio));

  // Build plain text version - Summary report only
  let text = `📢 Reddit品牌声誉日报 · ${dateStr}\n`;
  text += `━━━━━━━━━━━━━━━━━━━━\n\n`;

  // Overall health score
  text += `**${health.emoji} 舆情健康度: ${health.score}/100 (${health.label})**\n`;
  text += `${renderBar(health.score, 20)}\n\n`;

  // Dashboard overview
  text += `📊 **整体舆情概况**\n`;
  text += `  监控帖子: ${totalPosts} | 总评论: ${allComments.length}\n`;
  text += `  严重: ${criticalPosts} | 中等: ${mediumPosts} | 安全: ${safePosts}\n`;
  text += `  情感分布:\n`;
  text += `    🟢 正面 ${renderBar(posPct)} ${posPct.toFixed(1)}% (${positive})\n`;
  text += `    ⚪ 中性 ${renderBar(neuPct)} ${neuPct.toFixed(1)}% (${neutral})\n`;
  text += `    🔴 负面 ${renderBar(negPct)} ${negPct.toFixed(1)}% (${negative})\n`;
  text += `  恶意评论: ${flaggedComments.length}条 (${flaggedRatio}%)\n`;

  const catEntries = Object.entries(categoryCount).sort((a, b) => b[1] - a[1]);
  if (catEntries.length > 0) {
    text += `  主要风险: ${catEntries.map(([k, v]) => `${CATEGORY_LABELS[k] || k}(${v})`).join(' | ')}\n`;
  }

  // Overall sentiment analysis summary
  const dominantSentiment = negative > positive ? '偏负面' : positive > negative ? '偏正面' : '中性';
  const riskLevel = criticalPosts > 0 ? '高风险' : mediumPosts > 0 ? '中风险' : '低风险';
  text += `\n📈 **舆情研判**: 整体情感${dominantSentiment}，当前${riskLevel}。`;
  if (criticalPosts > 0) {
    text += `存在${criticalPosts}个严重风险帖子，需重点关注。`;
  } else if (mediumPosts > 0) {
    text += `存在${mediumPosts}个中等风险帖子，建议关注。`;
  }
  text += `\n`;

  // Alert posts summary (just titles, no details)
  if (alertPosts.length > 0) {
    text += `\n⚠️ **严重帖子汇总** (${alertPosts.length}个)\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n`;
    for (let i = 0; i < alertPosts.length; i++) {
      const post = alertPosts[i];
      const label = ALERT_LABELS[post.alertLevel] || post.alertLevel;
      const detailUrl = `${baseUrl}/posts/${post.id}`;
      text += `  ${i + 1}. ${label} | r/${post.subreddit} | ${post.title}\n`;
      text += `     🔗 ${detailUrl}\n`;
    }
    text += `\n`;
  }

  text += `━━━━━━━━━━━━━━━━━━━━\n`;
  text += `🖥️ 监控面板: ${baseUrl}\n`;
  text += `📋 帖子管理: ${baseUrl}/posts\n\n`;
  text += `数据更新时间: ${now.toLocaleString('zh-CN')}\n`;
  text += `此消息由 Hisense Reddit 品牌声誉监控系统自动发送`;

  // Build Feishu rich text (interactive card) for webhook
  const richText = buildFeishuCard(posts, allComments, alertPosts, flaggedComments, categoryCount, dateStr, now, baseUrl);

  // Always generate daily report
  return { hasAlerts: alertPosts.length > 0, text, richText, postCount: alertPosts.length };
}

// Build Feishu Interactive Card message
function buildFeishuCard(
  allPosts: RedditPost[],
  allComments: RedditComment[],
  alertPosts: RedditPost[],
  flaggedComments: RedditComment[],
  categoryCount: Record<string, number>,
  dateStr: string,
  now: Date,
  baseUrl: string
): any {
  const criticalCount = alertPosts.filter(p => p.alertLevel === 'critical').length;

  // Global stats
  const totalPosts = allPosts.length;
  const totalComments = allComments.length;
  const flaggedCount = flaggedComments.length;
  const flaggedRatio = totalComments > 0 ? (flaggedCount / totalComments * 100).toFixed(1) : '0';
  const positive = allComments.filter(c => c.sentimentScore > 0.1).length;
  const neutral = allComments.filter(c => c.sentimentScore >= -0.1 && c.sentimentScore <= 0.1).length;
  const negative = allComments.filter(c => c.sentimentScore < -0.1).length;

  const catEntries = Object.entries(categoryCount).sort((a, b) => b[1] - a[1]);
  const catText = catEntries.map(([k, v]) => `${CATEGORY_LABELS[k] || k}(${v})`).join('  ');

  const posPct = totalComments > 0 ? (positive/totalComments*100) : 0;
  const neuPct = totalComments > 0 ? (neutral/totalComments*100) : 0;
  const negPct = totalComments > 0 ? (negative/totalComments*100) : 0;
  const mediumCount = allPosts.filter(p => p.alertLevel === 'medium').length;
  const health = calcHealthScore(totalComments, negative, criticalCount, mediumCount, parseFloat(flaggedRatio));
  const dominantSentiment = negative > positive ? '偏负面' : positive > negative ? '偏正面' : '中性';
  const riskLevel = criticalCount > 0 ? '高风险' : mediumCount > 0 ? '中风险' : '低风险';

  const elements: any[] = [];

  // Health Score Section - most prominent
  elements.push({
    tag: 'div',
    text: {
      tag: 'lark_md',
      content: `${health.emoji} **舆情健康度 ${health.score}/100 (${health.label})**\n`
        + `${renderBar(health.score, 20)}`,
    },
  });

  // Dashboard Overview Section
  elements.push({
    tag: 'div',
    text: {
      tag: 'lark_md',
      content: `**📊 整体舆情概况**\n`
        + `监控帖子 **${totalPosts}**  |  总评论 **${totalComments}**\n`
        + `严重 **${criticalCount}**  |  中等 **${allPosts.filter(p => p.alertLevel === 'medium').length}**  |  安全 **${allPosts.filter(p => p.alertLevel === 'safe' || p.alertLevel === 'low').length}**\n`
        + `恶意评论 **${flaggedCount}** (${flaggedRatio}%)`,
    },
  });

  // Sentiment distribution with visual bars
  elements.push({
    tag: 'div',
    text: {
      tag: 'lark_md',
      content: `**💬 情感分布**\n`
        + `🟢 正面 ${renderBar(posPct)} ${posPct.toFixed(1)}% (${positive})\n`
        + `⚪ 中性 ${renderBar(neuPct)} ${neuPct.toFixed(1)}% (${neutral})\n`
        + `🔴 负面 ${renderBar(negPct)} ${negPct.toFixed(1)}% (${negative})`,
    },
  });

  if (catText) {
    elements.push({
      tag: 'div',
      text: { tag: 'lark_md', content: `主要风险: ${catText}` },
    });
  }

  // Overall sentiment analysis summary
  elements.push({
    tag: 'div',
    text: {
      tag: 'lark_md',
      content: `**📈 舆情研判**: 整体情感${dominantSentiment}，当前${riskLevel}。${criticalCount > 0 ? `存在${criticalCount}个严重风险帖子，需重点关注。` : mediumCount > 0 ? `存在${mediumCount}个中等风险帖子，建议关注。` : '整体舆情平稳。'}`,
    },
  });

  // System link button
  elements.push({
    tag: 'action',
    actions: [{
      tag: 'button',
      text: { tag: 'plain_text', content: '🖥️ 打开监控面板' },
      url: baseUrl,
      type: 'primary' as const,
    }, {
      tag: 'button',
      text: { tag: 'plain_text', content: '📋 帖子管理' },
      url: `${baseUrl}/posts`,
      type: 'default' as const,
    }],
  });

  if (alertPosts.length > 0) {
    elements.push({ tag: 'hr' });

    // Alert posts summary list (titles only)
    let alertList = `**⚠️ 严重帖子汇总** (${alertPosts.length}个)\n`;
    for (let i = 0; i < Math.min(alertPosts.length, 15); i++) {
      const post = alertPosts[i];
      const levelEmoji = post.alertLevel === 'critical' ? '🔴' : '🟡';
      const detailUrl = `${baseUrl}/posts/${post.id}`;
      alertList += `${i + 1}. ${levelEmoji} [${post.title}](${detailUrl})\n`;
    }
    if (alertPosts.length > 15) {
      alertList += `...还有 ${alertPosts.length - 15} 个帖子，[点击查看全部](${baseUrl}/posts)`;
    }

    elements.push({
      tag: 'div',
      text: { tag: 'lark_md', content: alertList },
    });
  }

  // Footer
  elements.push({ tag: 'hr' });
  elements.push({
    tag: 'note',
    elements: [{
      tag: 'lark_md',
      content: `📡 Hisense Reddit品牌声誉监控系统 | ${now.toLocaleString('zh-CN')}`,
    }],
  });

  return {
    msg_type: 'interactive',
    card: {
      header: {
        title: {
          tag: 'plain_text',
          content: '📢 Reddit品牌声誉日报',
        },
        template: criticalCount > 0 ? 'red' : 'blue',
      },
      elements,
    },
  };
}

// Send notification via Webhook
async function sendWebhook(webhookUrl: string, card: any): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(card),
    });

    const data = await response.json();
    if (data.code === 0 || data.StatusCode === 0) {
      return { success: true, message: '飞书推送成功' };
    } else {
      return { success: false, message: `飞书返回错误: ${data.msg || data.StatusMessage || JSON.stringify(data)}` };
    }
  } catch (error: any) {
    return { success: false, message: `飞书推送失败: ${error.message}` };
  }
}

// Send notification via Feishu App API (personal message)
async function sendAppMessage(config: FeishuNotifyConfig, text: string): Promise<{ success: boolean; message: string }> {
  const feishuConfig = getConfig().feishu;

  if (!feishuConfig.appId || !feishuConfig.appSecret) {
    return { success: false, message: '请先配置飞书应用凭证(App ID和Secret)' };
  }

  try {
    // 1. Get tenant access token
    const tokenRes = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_id: feishuConfig.appId,
        app_secret: feishuConfig.appSecret,
      }),
    });

    const tokenData = await tokenRes.json();
    if (tokenData.code !== 0) {
      return { success: false, message: `获取飞书Token失败: ${tokenData.msg}` };
    }

    const token = tokenData.tenant_access_token;

    // 2. Send message
    const receiveId = config.receiveUserId || config.receiveChatId;
    if (!receiveId) {
      return { success: false, message: '请配置接收人ID或群ID' };
    }

    const msgBody: any = {
      receive_id: receiveId,
      msg_type: 'text',
      content: JSON.stringify({ text }),
    };

    // If chat_id is provided, use chat type
    const idType = config.receiveChatId ? 'chat_id' : 'open_id';

    const sendRes = await fetch(
      `https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=${idType}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(msgBody),
      }
    );

    const sendData = await sendRes.json();
    if (sendData.code === 0) {
      return { success: true, message: '飞书消息发送成功' };
    } else {
      return { success: false, message: `发送失败: ${sendData.msg}` };
    }
  } catch (error: any) {
    return { success: false, message: `飞书应用消息发送失败: ${error.message}` };
  }
}

// Main: Send daily alert notification
export async function sendDailyAlert(): Promise<{ success: boolean; message: string; postCount: number }> {
  const config = getConfig();
  const notifyConfig = config.feishuNotify;

  if (!notifyConfig?.enabled) {
    return { success: false, message: '飞书通知未启用', postCount: 0 };
  }

  const { hasAlerts, text, richText, postCount } = buildAlertMessage();

  // Always send daily report (manual push or scheduled push always delivers)
  if (notifyConfig.mode === 'webhook') {
    if (!notifyConfig.webhookUrl) {
      return { success: false, message: '请先配置飞书机器人Webhook地址', postCount };
    }
    const result = await sendWebhook(notifyConfig.webhookUrl, richText);
    return { ...result, postCount };
  } else {
    const result = await sendAppMessage(notifyConfig, text);
    return { ...result, postCount };
  }
}

// Test notification connection
export async function testFeishuNotify(config: FeishuNotifyConfig): Promise<{ success: boolean; message: string }> {
  const testCard = {
    msg_type: 'interactive',
    card: {
      header: {
        title: { tag: 'plain_text', content: '🧪 飞书通知测试' },
        template: 'blue',
      },
      elements: [{
        tag: 'div',
        text: { tag: 'lark_md', content: '**测试消息**\n飞书通知连接成功！此消息来自 Hisense Reddit 品牌声誉监控系统。' },
      }],
    },
  };

  if (config.mode === 'webhook') {
    if (!config.webhookUrl) {
      return { success: false, message: '请先填写Webhook地址' };
    }
    return await sendWebhook(config.webhookUrl, testCard);
  } else {
    // For app mode, just test token acquisition
    const feishuConfig = getConfig().feishu;
    if (!feishuConfig.appId || !feishuConfig.appSecret) {
      return { success: false, message: '应用消息模式需要先配置飞书应用凭证' };
    }
    try {
      const tokenRes = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app_id: feishuConfig.appId, app_secret: feishuConfig.appSecret }),
      });
      const data = await tokenRes.json();
      if (data.code === 0) {
        return { success: true, message: '飞书应用连接成功，Token获取正常' };
      }
      return { success: false, message: `Token获取失败: ${data.msg}` };
    } catch (error: any) {
      return { success: false, message: `连接失败: ${error.message}` };
    }
  }
}
