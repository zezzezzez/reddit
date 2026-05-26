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

export interface ProxyConfig {
  enabled: boolean;
  host: string; // e.g. '127.0.0.1'
  port: number; // e.g. 7890
  protocol: 'http' | 'https' | 'socks5'; // default http
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
  scanSchedule: string; // cron expression
  keywords: string[];
  sentimentThreshold: number; // -1 to 1, threshold for flagging
  openaiApiKey?: string;
  openaiModel?: string;
  proxy?: ProxyConfig;
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
