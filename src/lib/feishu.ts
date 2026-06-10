// Feishu Bitable / Sheet Integration
// Fetches Reddit post URLs from a Feishu Bitable (multi-dimensional table) or Sheet (spreadsheet)
// Supports two access modes:
//   1. tenant_access_token  - 本租户访问（默认）
//   2. user_access_token    - 跨租户访问（通过 OAuth 用户授权，可访问外部租户文档）

import { FeishuConfig, FeishuDocType, RedditPost } from './types';
import { getValidUserAccessToken } from './feishu-auth';
import { getConfig } from './store';

let cachedAccessToken: { token: string; expiresAt: number } | null = null;
let cachedUserAccessToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(config: FeishuConfig): Promise<string> {
  // Check cache
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now()) {
    return cachedAccessToken.token;
  }

  const response = await fetch(
    'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_id: config.appId,
        app_secret: config.appSecret,
      }),
    }
  );

  const data = await response.json();

  if (data.code !== 0) {
    throw new Error(`Feishu auth failed: ${data.msg}`);
  }

  const token = data.tenant_access_token;
  const expiresIn = data.expire - 300; // 5 min buffer

  cachedAccessToken = {
    token,
    expiresAt: Date.now() + expiresIn * 1000,
  };

  return token;
}

/**
 * 使用 user_access_token 获取 Bitable 记录（跨租户访问）
 * @param appToken 目标文档的 appToken（可能是跨租户的）
 * @param tableId 目标表格 ID
 */
export async function fetchBitableRecordsWithUserToken(
  appToken: string,
  tableId: string,
  pageToken?: string
): Promise<{ records: FeishuBitableRecord[]; hasMore: boolean; pageToken?: string }> {
  // 获取有效的 user_access_token（自动刷新）
  const token = await getValidUserAccessToken();

  let url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records?page_size=100`;
  if (pageToken) {
    url += `&page_token=${pageToken}`;
  }

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json();

  if (data.code !== 0) {
    throw new Error(`Feishu bitable (user token) fetch failed: ${data.msg}`);
  }

  return {
    records: data.data.items || [],
    hasMore: data.data.has_more || false,
    pageToken: data.data.page_token,
  };
}

/**
 * 分页获取所有 Bitable 记录（使用 user_access_token）
 */
export async function fetchAllBitableRecordsWithUserToken(
  appToken: string,
  tableId: string
): Promise<FeishuBitableRecord[]> {
  const allRecords: FeishuBitableRecord[] = [];
  let pageToken: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const result = await fetchBitableRecordsWithUserToken(appToken, tableId, pageToken);
    allRecords.push(...result.records);
    hasMore = result.hasMore;
    pageToken = result.pageToken;
  }

  return allRecords;
}

export interface FeishuBitableRecord {
  record_id: string;
  fields: Record<string, any>;
}

// ============================================================
// Sheet (电子表格) 系列 API - 使用 user_access_token 跨租户访问
// ============================================================
export interface FeishuSheetRecord {
  record_id: string;        // 行号，格式 "row_<rowIndex>"
  fields: Record<string, any>;
}

export interface FeishuSheetValueRange {
  range: string;            // 例如 "9dRNBr!A1:Z1000"
  values: string[][];       // 二维数组，首行为表头
}

/**
 * 使用 user_access_token 读取 Sheet 工作表内容
 * 走 v2 values 接口，简单直接。
 * @param spreadsheetToken 飞书电子表格 token（obj_token）
 * @param sheetId           工作表 ID（如 "9dRNBr"）
 * @param range             可选，读取范围，默认 A1:Z1000
 */
export async function fetchSheetValuesWithUserToken(
  spreadsheetToken: string,
  sheetId: string,
  range: string = 'A1:Z1000'
): Promise<string[][]> {
  const token = await getValidUserAccessToken();

  // 飞书 v2 values 接口：路径是 spreadsheet token + 工作表 ID + 范围
  const url = `https://open.feishu.cn/open-apis/sheets/v2/spreadsheets/${spreadsheetToken}/values/${encodeURIComponent(sheetId)}?valueRenderOption=ToString&range=${encodeURIComponent(range)}`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json();

  if (data.code !== 0) {
    throw new Error(`Feishu sheet (user token) fetch failed: ${data.msg}`);
  }

  // v2 返回结构: { data: { valueRange: { range, values: [[...], [...]] } } }
  const values = data?.data?.valueRange?.values || [];
  return values;
}

/**
 * 将 Sheet 二维数组转成 RedditPost 列表
 * 约定：首行（index 0）是表头，后续每行是一条记录
 * 根据 urlFieldName（中文表头，如 "发布完成后反链"）查找 URL
 */
export function convertSheetValuesToPosts(
  values: string[][],
  urlFieldName: string,
  existingPosts: RedditPost[] = []
): RedditPost[] {
  if (!values || values.length === 0) return [];

  const headers = values[0] || [];
  const urlColIdx = headers.findIndex(h => String(h).trim() === urlFieldName.trim());
  if (urlColIdx < 0) {
    throw new Error(`Sheet 中未找到表头「${urlFieldName}」，请检查 urlFieldName 或确认首行是表头`);
  }

  const posts: RedditPost[] = [];

  for (let i = 1; i < values.length; i++) {
    const row = values[i] || [];
    const cell = row[urlColIdx];
    if (!cell) continue;
    const redditUrl = String(cell).trim();
    if (!redditUrl || !redditUrl.includes('reddit.com')) continue;

    const existing = existingPosts.find(p => p.redditUrl === redditUrl);
    const postId = extractPostIdFromUrl(redditUrl);

    // 把整行也作为 fields 保留，方便后续按列名取值
    const fields: Record<string, any> = {};
    headers.forEach((h, idx) => {
      if (h != null && h !== '') fields[String(h).trim()] = row[idx] ?? '';
    });

    posts.push({
      id: postId || `sheet_row_${i}`,
      redditUrl,
      title: existing?.title || extractStringField({ record_id: '', fields }, 'Title')
              || extractStringField({ record_id: '', fields }, '标题')
              || redditUrl,
      subreddit: existing?.subreddit || extractSubredditFromUrl(redditUrl) || '',
      author: existing?.author || extractStringField({ record_id: '', fields }, 'Author') || '',
      score: existing?.score || 0,
      commentCount: existing?.commentCount || 0,
      createdAt: existing?.createdAt || new Date().toISOString(),
      lastScanned: existing?.lastScanned || null,
      alertLevel: existing?.alertLevel || 'safe',
      alertReasons: existing?.alertReasons || [],
    });
  }

  return posts;
}

export async function fetchBitableRecords(
  config: FeishuConfig,
  pageToken?: string
): Promise<{ records: FeishuBitableRecord[]; hasMore: boolean; pageToken?: string }> {
  const token = await getAccessToken(config);

  let url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${config.appToken}/tables/${config.tableId}/records?page_size=100`;
  if (pageToken) {
    url += `&page_token=${pageToken}`;
  }

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json();

  if (data.code !== 0) {
    throw new Error(`Feishu bitable fetch failed: ${data.msg}`);
  }

  return {
    records: data.data.items || [],
    hasMore: data.data.has_more || false,
    pageToken: data.data.page_token,
  };
}

export async function fetchAllBitableRecords(config: FeishuConfig): Promise<FeishuBitableRecord[]> {
  const allRecords: FeishuBitableRecord[] = [];
  let pageToken: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const result = await fetchBitableRecords(config, pageToken);
    allRecords.push(...result.records);
    hasMore = result.hasMore;
    pageToken = result.pageToken;
  }

  return allRecords;
}

// Extract Reddit URL from a Feishu record
function extractRedditUrl(record: FeishuBitableRecord, urlFieldName: string): string | null {
  const field = record.fields[urlFieldName];
  if (!field) return null;

  // Handle different field types
  if (typeof field === 'string') {
    return field.trim();
  }

  // Handle URL type field (Feishu returns object with link and text)
  if (typeof field === 'object' && field.link) {
    return field.link;
  }

  // Handle text field that might contain URL
  if (Array.isArray(field)) {
    for (const item of field) {
      if (typeof item === 'string' && item.includes('reddit.com')) {
        return item.trim();
      }
      if (typeof item === 'object' && item.text) {
        return item.text.trim();
      }
      if (typeof item === 'object' && item.link) {
        return item.link;
      }
    }
  }

  return null;
}

// Get additional fields from Feishu record
function extractStringField(record: FeishuBitableRecord, fieldName: string): string {
  const field = record.fields[fieldName];
  if (!field) return '';
  if (typeof field === 'string') return field;
  if (Array.isArray(field)) {
    return field.map((item: any) => item.text || item).join('');
  }
  return String(field);
}

// Convert Feishu records to Reddit posts
export function convertBitableRecordsToPosts(
  records: FeishuBitableRecord[],
  urlFieldName: string,
  existingPosts: RedditPost[] = []
): RedditPost[] {
  const posts: RedditPost[] = [];

  for (const record of records) {
    const redditUrl = extractRedditUrl(record, urlFieldName);
    if (!redditUrl || !redditUrl.includes('reddit.com')) continue;

    // Check if we already have this post
    const existing = existingPosts.find(p => p.redditUrl === redditUrl);

    // Extract post ID from URL
    const postId = extractPostIdFromUrl(redditUrl);

    posts.push({
      id: postId || record.record_id,
      redditUrl,
      title: existing?.title || extractStringField(record, 'Title') || extractStringField(record, '标题') || redditUrl,
      subreddit: existing?.subreddit || extractSubredditFromUrl(redditUrl) || '',
      author: existing?.author || extractStringField(record, 'Author') || '',
      score: existing?.score || 0,
      commentCount: existing?.commentCount || 0,
      createdAt: existing?.createdAt || new Date().toISOString(),
      lastScanned: existing?.lastScanned || null,
      alertLevel: existing?.alertLevel || 'safe',
      alertReasons: existing?.alertReasons || [],
    });
  }

  return posts;
}

function extractPostIdFromUrl(url: string): string | null {
  // Handle various Reddit URL formats:
  // https://www.reddit.com/r/subreddit/comments/abc123/post_title/
  // https://www.reddit.com/r/subreddit/s/shortId
  // https://redd.it/abc123

  try {
    const patterns = [
      /\/comments\/([a-z0-9]+)/i,
      /redd\.it\/([a-z0-9]+)/i,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }

    // For short links /s/ format, we'll use the URL itself as identifier
    if (url.includes('/s/')) {
      const parts = url.split('/s/');
      if (parts[1]) return `short_${parts[1].split(/[/?#]/)[0]}`;
    }

    return null;
  } catch {
    return null;
  }
}

function extractSubredditFromUrl(url: string): string | null {
  try {
    const match = url.match(/\/r\/([a-zA-Z0-9_]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

// Test Feishu connection
// mode: 'tenant' (默认，tenant_access_token) | 'user' (user_access_token，跨租户)
export async function testFeishuConnection(
  config: FeishuConfig,
  mode: 'tenant' | 'user' = 'tenant'
): Promise<{
  success: boolean;
  message: string;
  recordCount?: number;
}> {
  try {
    if (mode === 'user') {
      // user_access_token 模式：需要外部文档配置
      const userAuth = getConfig().feishuUserAuth;
      if (!userAuth?.accessToken) {
        return { success: false, message: '未授权：请先完成飞书 OAuth 用户授权' };
      }
      if (!userAuth.externalAppToken || !userAuth.externalTableId) {
        return { success: false, message: '未配置外部文档（externalAppToken / externalTableId）' };
      }
      const token = await getValidUserAccessToken();
      if (!token) {
        return { success: false, message: '获取 user_access_token 失败' };
      }
      // 根据文档类型走不同 API
      const docType: FeishuDocType = userAuth.externalDocType || 'bitable';
      if (docType === 'sheet') {
        const values = await fetchSheetValuesWithUserToken(
          userAuth.externalAppToken,
          userAuth.externalTableId
        );
        return {
          success: true,
          message: `连接成功（user token · sheet），共 ${values.length - 1} 行数据（不含表头）`,
          recordCount: Math.max(values.length - 1, 0),
        };
      }
      const result = await fetchBitableRecordsWithUserToken(
        userAuth.externalAppToken,
        userAuth.externalTableId
      );
      return {
        success: true,
        message: `连接成功（user token · bitable），共 ${result.records.length} 条记录`,
        recordCount: result.records.length,
      };
    }

    // tenant_access_token 模式（默认）
    const token = await getAccessToken(config);
    if (!token) {
      return { success: false, message: '获取访问令牌失败' };
    }

    const result = await fetchBitableRecords(config);
    return {
      success: true,
      message: `连接成功，共 ${result.records.length} 条记录`,
      recordCount: result.records.length,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || '连接失败',
    };
  }
}
