// Core types for Reddit Comment Monitor

// 三级告警：严重 / 中等 / 安全
// critical=严重, medium=中等, safe=安全
// 兼容旧数据：high 映射为 critical，low 映射为 safe
export type AlertLevel = 'critical' | 'high' | 'medium' | 'low' | 'safe';
export type AlertStatus = 'pending' | 'processing' | 'resolved' | 'ignored';

export interface RedditPost {
  id: string;
  redditUrl: string;
  title: string;
  subreddit: string;
  author: string;
  score: number;
  commentCount: number;
  createdAt: string;
  lastScanned: string | null;
  alertLevel: AlertLevel;
  alertReasons: string[];
  thumbnailUrl?: string;
  summary?: string;
  alertStatus?: AlertStatus;
  handler?: string;
  handleTime?: string;
  handleNote?: string;
  scanError?: string; // 扫描失败时的错误信息
  nextScanTime?: string; // 智能延迟：下次应扫描的时间，未到期则跳过
}

export interface RedditComment {
  id: string;
  postId: string;
  author: string;
  body: string;
  score: number;
  createdAt: string;
  sentimentScore: number; // -1 to 1, negative = hostile
  isFlagged: boolean;
  flagReasons: string[];
  permalink: string;
  influenceScore?: number; // 影响力得分：点赞数 × |情感得分| 加权，仅恶意评论有效
  replies?: RedditComment[];
}

export interface ScanResult {
  postId: string;
  scanTime: string;
  totalComments: number;
  flaggedComments: number;
  alertLevel: AlertLevel;
  sentimentSummary: {
    positive: number;
    neutral: number;
    negative: number;
  };
  topFlaggedComments: RedditComment[];
}

export interface DailyScanReport {
  date: string;
  totalPosts: number;
  totalComments: number;
  flaggedComments: number;
  criticalAlerts: number;
  highAlerts: number;
  mediumAlerts: number;
  safePosts: number;
  sentimentTrend: {
    date: string;
    positive: number;
    neutral: number;
    negative: number;
  }[];
}

export interface FeishuConfig {
  appId: string;
  appSecret: string;
  appToken: string;
  tableId: string;
  urlFieldName: string; // field name in bitable that contains Reddit URL
}

// 飞书用户授权信息（用于跨租户访问 Bitable / Sheet 文档）
// 通过 OAuth 用户授权流程获取，可访问任意租户下被授权用户有权限的资源
export type FeishuDocType = 'bitable' | 'sheet';

export interface FeishuUserAuth {
  accessToken: string;        // user_access_token
  refreshToken: string;       // 用于刷新 access_token
  openId: string;             // 授权用户 open_id
  unionId?: string;           // 授权用户 union_id
  scope?: string;             // 授权 scope
  expiresAt: number;          // access_token 过期时间戳（ms）
  refreshExpiresAt?: number;  // refresh_token 过期时间戳（ms），飞书默认 30 天
  authorizedAt: number;       // 首次授权时间戳（ms）
  userName?: string;          // 授权用户名（可选，用于展示）
  // 外部租户文档目标（要同步的外部文档）
  externalDocType?: FeishuDocType;  // 'bitable'（多维表格）或 'sheet'（电子表格），默认 'bitable'
  externalAppToken?: string;        // bitable: appToken; sheet: spreadsheet_token
  externalTableId?: string;         // bitable: tableId;    sheet: sheetId（工作表 ID）
}

export type LLMProvider = 
  | 'openai'       // GPT-4o, GPT-4o-mini
  | 'anthropic'    // Claude 3.5 Sonnet, Haiku
  | 'google'       // Gemini Pro, Flash
  | 'deepseek'     // DeepSeek V3, R1
  | 'zhipu'        // 智谱 GLM-4
  | 'moonshot'     // 月之暗面 Kimi
  | 'qwen'         // 通义千问
  | 'doubao'       // 豆包(字节)
  | 'ollama'       // 本地模型
  | 'custom';      // 自定义 OpenAI 兼容接口

export interface LLMConfig {
  enabled: boolean;
  provider: LLMProvider;
  apiKey: string;
  model: string;
  baseUrl: string;      // API base URL, e.g. 'https://api.openai.com/v1'
  maxTokens: number;   // max tokens for response
  temperature: number; // 0-1
}

export interface FeishuNotifyConfig {
  enabled: boolean;
  mode: 'webhook' | 'app';       // webhook=群机器人, app=应用消息
  webhookUrl: string;              // 自定义机器人Webhook地址
  notifyTime: string;              // 每日推送时间，如 '09:00'
  notifyLevels: AlertLevel[];     // 推送哪些级别，默认['critical','high']
  // 应用消息模式（给个人发）
  receiveUserId?: string;          // 接收人user_id或open_id
  receiveChatId?: string;          // 接收群chat_id
}

export interface DetectionRules {
  brand_attack: boolean;
  product_hate: boolean;
  negative_sentiment: boolean;
  call_to_action_negative: boolean;
  competitor_push: boolean;
}

export interface MonitorConfig {
  feishu: FeishuConfig;
  feishuUserAuth?: FeishuUserAuth; // 飞书用户授权（跨租户访问用）
  scanSchedule: string; // cron expression
  autoScanEnabled: boolean; // whether auto-scan is enabled
  scanTime: string; // "HH:MM" format, time for daily auto-scan
  keywords: string[];
  sentimentThreshold: number; // -1 to 1, threshold for flagging
  openaiApiKey?: string;
  openaiModel?: string;
  llm?: LLMConfig;
  feishuNotify?: FeishuNotifyConfig;
  detectionRules?: DetectionRules;
}

export interface PostDetail {
  post: RedditPost;
  comments: RedditComment[];
  scanHistory: ScanResult[];
}

export interface InfluentialUser {
  author: string;
  totalComments: number;
  avgScore: number;
  flaggedCount: number;
  topNegativeComment: string;
  influenceScore: number;
}

export interface KeywordTrend {
  word: string;
  count: number;
  trend: 'up' | 'down' | 'stable';
  category: 'brand' | 'product' | 'sentiment' | 'other';
  watched: boolean;
}

export interface SubredditStats {
  subreddit: string;
  totalPosts: number;
  totalComments: number;
  positiveRate: number;
  negativeRate: number;
  flaggedRate: number;
  topKeywords: string[];
  healthScore: number;
}
