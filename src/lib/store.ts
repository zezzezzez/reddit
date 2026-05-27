// Data store for Reddit Monitor
// Local: file-based persistence | Vercel: in-memory + env vars

import { RedditPost, RedditComment, ScanResult, DailyScanReport, MonitorConfig, AlertLevel } from './types';

const isVercel = !!process.env.VERCEL;

// ─── File-based storage (local dev) ─────────────────────────
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const DATA_DIR = join(process.cwd(), 'data');
const POSTS_FILE = join(DATA_DIR, 'posts.json');
const COMMENTS_FILE = join(DATA_DIR, 'comments.json');
const SCANS_FILE = join(DATA_DIR, 'scans.json');
const CONFIG_FILE = join(DATA_DIR, 'config.json');
const REPORTS_FILE = join(DATA_DIR, 'reports.json');

function ensureDataDir() {
  try {
    if (!existsSync(DATA_DIR)) {
      mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch {
    // Read-only filesystem (Vercel)
  }
}

function readJsonFile<T>(filePath: string, defaultValue: T): T {
  try {
    if (existsSync(filePath)) {
      const data = readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    }
  } catch {
    // ignore parse errors
  }
  return defaultValue;
}

function writeJsonFile<T>(filePath: string, data: T) {
  // On Vercel, never attempt file writes (read-only filesystem)
  if (isVercel) return;
  try {
    ensureDataDir();
    writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch {
    // Silently fail on read-only filesystem
  }
}

// ─── In-memory storage (Vercel serverless) ───────────────────
const memoryStore: Record<string, any> = {
  posts: [],
  comments: [],
  scans: [],
  reports: [],
  config: null,
};

// ─── Posts ───────────────────────────────────────────────────
export function getPosts(): RedditPost[] {
  if (isVercel) return memoryStore.posts as RedditPost[];
  return readJsonFile<RedditPost[]>(POSTS_FILE, []);
}

export function getPostById(id: string): RedditPost | undefined {
  return getPosts().find(p => p.id === id);
}

export function savePosts(posts: RedditPost[]) {
  if (isVercel) { memoryStore.posts = posts; return; }
  writeJsonFile(POSTS_FILE, posts);
}

export function upsertPost(post: RedditPost) {
  const posts = getPosts();
  const index = posts.findIndex(p => p.id === post.id);
  if (index >= 0) {
    posts[index] = post;
  } else {
    posts.push(post);
  }
  savePosts(posts);
}

export function deletePost(id: string) {
  const posts = getPosts().filter(p => p.id !== id);
  savePosts(posts);
}

// ─── Comments ────────────────────────────────────────────────
export function getComments(postId?: string): RedditComment[] {
  const all = isVercel ? (memoryStore.comments as RedditComment[]) : readJsonFile<RedditComment[]>(COMMENTS_FILE, []);
  if (postId) return all.filter(c => c.postId === postId);
  return all;
}

export function saveComments(postId: string, comments: RedditComment[]) {
  const all = getComments();
  const filtered = all.filter(c => c.postId !== postId);
  filtered.push(...comments);
  if (isVercel) { memoryStore.comments = filtered; return; }
  writeJsonFile(COMMENTS_FILE, filtered);
}

// ─── Scan Results ────────────────────────────────────────────
export function getScanResults(postId?: string): ScanResult[] {
  const all = isVercel ? (memoryStore.scans as ScanResult[]) : readJsonFile<ScanResult[]>(SCANS_FILE, []);
  if (postId) return all.filter(s => s.postId === postId);
  return all;
}

export function saveScanResult(result: ScanResult) {
  const all = getScanResults();
  all.push(result);
  if (isVercel) { memoryStore.scans = all; return; }
  writeJsonFile(SCANS_FILE, all);
}

// ─── Daily Reports ───────────────────────────────────────────
export function getDailyReports(): DailyScanReport[] {
  if (isVercel) return memoryStore.reports as DailyScanReport[];
  return readJsonFile<DailyScanReport[]>(REPORTS_FILE, []);
}

export function saveDailyReport(report: DailyScanReport) {
  const reports = getDailyReports();
  const index = reports.findIndex(r => r.date === report.date);
  if (index >= 0) {
    reports[index] = report;
  } else {
    reports.push(report);
  }
  if (isVercel) { memoryStore.reports = reports; return; }
  writeJsonFile(REPORTS_FILE, reports);
}

// ─── Config ──────────────────────────────────────────────────
const DEFAULT_CONFIG: MonitorConfig = {
  feishu: {
    appId: '',
    appSecret: '',
    appToken: '',
    tableId: '',
    urlFieldName: 'Reddit URL',
  },
  scanSchedule: '0 9 * * *',
  keywords: [],
  sentimentThreshold: -0.3,
  openaiApiKey: '',
  openaiModel: 'gpt-4o-mini',
  llm: {
    enabled: false,
    provider: 'openai',
    apiKey: '',
    model: 'gpt-4o-mini',
    baseUrl: 'https://api.openai.com/v1',
    maxTokens: 1024,
    temperature: 0.1,
  },
  feishuNotify: {
    enabled: false,
    mode: 'webhook',
    webhookUrl: '',
    notifyTime: '09:00',
    notifyLevels: ['critical', 'high'],
  },
  detectionRules: {
    brand_attack: true,
    product_hate: true,
    negative_sentiment: true,
    call_to_action_negative: true,
    competitor_push: true,
  },
};

// On Vercel, merge environment variables into config
function applyEnvOverrides(config: MonitorConfig): MonitorConfig {
  if (!isVercel) return config;

  // Feishu webhook from env var
  if (process.env.FEISHU_WEBHOOK_URL) {
    config.feishuNotify = {
      enabled: true,
      mode: 'webhook',
      webhookUrl: process.env.FEISHU_WEBHOOK_URL,
      notifyTime: process.env.FEISHU_NOTIFY_TIME || '09:00',
      notifyLevels: (process.env.FEISHU_NOTIFY_LEVELS || 'critical,high').split(',') as AlertLevel[],
    };
  }

  // LLM from env vars
  if (process.env.LLM_API_KEY) {
    config.llm = {
      enabled: process.env.LLM_ENABLED !== 'false',
      provider: (process.env.LLM_PROVIDER || 'openai') as any,
      apiKey: process.env.LLM_API_KEY,
      model: process.env.LLM_MODEL || 'gpt-4o-mini',
      baseUrl: process.env.LLM_BASE_URL || 'https://api.openai.com/v1',
      maxTokens: parseInt(process.env.LLM_MAX_TOKENS || '1024'),
      temperature: parseFloat(process.env.LLM_TEMPERATURE || '0.1'),
    };
  }

  // Tunnel URL from env var
  if (process.env.TUNNEL_URL) {
    (config as any).tunnelUrl = process.env.TUNNEL_URL;
  }

  return config;
}

export function getConfig(): MonitorConfig {
  if (isVercel) {
    if (!memoryStore.config) {
      memoryStore.config = applyEnvOverrides({ ...DEFAULT_CONFIG });
    }
    return memoryStore.config as MonitorConfig;
  }
  return readJsonFile<MonitorConfig>(CONFIG_FILE, DEFAULT_CONFIG);
}

export function saveConfig(config: MonitorConfig) {
  if (isVercel) { memoryStore.config = config; return; }
  writeJsonFile(CONFIG_FILE, config);
}
