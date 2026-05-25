// Data store for Reddit Monitor
// Uses file-based persistence for storing posts, comments, and scan results

import { RedditPost, RedditComment, ScanResult, DailyScanReport, MonitorConfig } from './types';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const DATA_DIR = join(process.cwd(), 'data');
const POSTS_FILE = join(DATA_DIR, 'posts.json');
const COMMENTS_FILE = join(DATA_DIR, 'comments.json');
const SCANS_FILE = join(DATA_DIR, 'scans.json');
const CONFIG_FILE = join(DATA_DIR, 'config.json');
const REPORTS_FILE = join(DATA_DIR, 'reports.json');

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
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
  ensureDataDir();
  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// Posts
export function getPosts(): RedditPost[] {
  return readJsonFile<RedditPost[]>(POSTS_FILE, []);
}

export function getPostById(id: string): RedditPost | undefined {
  return getPosts().find(p => p.id === id);
}

export function savePosts(posts: RedditPost[]) {
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

// Comments
export function getComments(postId?: string): RedditComment[] {
  const all = readJsonFile<RedditComment[]>(COMMENTS_FILE, []);
  if (postId) return all.filter(c => c.postId === postId);
  return all;
}

export function saveComments(postId: string, comments: RedditComment[]) {
  const all = getComments();
  const filtered = all.filter(c => c.postId !== postId);
  filtered.push(...comments);
  writeJsonFile(COMMENTS_FILE, filtered);
}

// Scan Results
export function getScanResults(postId?: string): ScanResult[] {
  const all = readJsonFile<ScanResult[]>(SCANS_FILE, []);
  if (postId) return all.filter(s => s.postId === postId);
  return all;
}

export function saveScanResult(result: ScanResult) {
  const all = getScanResults();
  all.push(result);
  writeJsonFile(SCANS_FILE, all);
}

// Daily Reports
export function getDailyReports(): DailyScanReport[] {
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
  writeJsonFile(REPORTS_FILE, reports);
}

// Config
const DEFAULT_CONFIG: MonitorConfig = {
  feishu: {
    appId: '',
    appSecret: '',
    appToken: '',
    tableId: '',
    urlFieldName: 'Reddit URL',
  },
  scanSchedule: '0 9 * * *', // Daily at 9am
  keywords: [],
  sentimentThreshold: -0.3,
  openaiApiKey: '',
  openaiModel: 'gpt-4o-mini',
  proxy: {
    enabled: false,
    host: '127.0.0.1',
    port: 7890,
    protocol: 'http',
  },
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

export function getConfig(): MonitorConfig {
  return readJsonFile<MonitorConfig>(CONFIG_FILE, DEFAULT_CONFIG);
}

export function saveConfig(config: MonitorConfig) {
  writeJsonFile(CONFIG_FILE, config);
}
