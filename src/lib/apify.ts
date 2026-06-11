// Apify Reddit Integration
// 单帖抓取: Reddit .json 公开端点（按 URL 精确抓取，无需 Actor）
// 版块抓取: spry_wholemeal/reddit-scraper（FREE Actor）
// 文档: https://apify.com/spry_wholemeal/reddit-scraper

import { ApifyClient } from 'apify-client';
import { ProxyAgent } from 'undici';
import { RedditComment, RedditPost } from './types';

const APIFY_TOKEN = process.env.APIFY_TOKEN;

// ─── 代理配置 ──────────────────────────────────────────────
// 使用 Apify 内置 RESIDENTIAL 代理（Reddit 不封禁）
const PROXY_CONFIG = {
  useApifyProxy: true,
  apifyProxyGroups: ['RESIDENTIAL'],
};

// ─── 内存缓存 ──────────────────────────────────────────────
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const SUBREDDIT_CACHE_TTL = 10 * 60 * 1000; // 版块列表缓存 10 分钟
const POST_CACHE_TTL = 30 * 60 * 1000;      // 帖子详情缓存 30 分钟

const subredditCache = new Map<string, CacheEntry<any>>();
const postCache = new Map<string, CacheEntry<any>>();

function getCachedResult<T>(cache: Map<string, CacheEntry<T>>, key: string, ttl: number): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < ttl) {
    console.log(`[Apify] Cache hit: ${key}`);
    return entry.data;
  }
  cache.delete(key);
  return null;
}

function setCacheResult<T>(cache: Map<string, CacheEntry<T>>, key: string, data: T) {
  cache.set(key, { data, timestamp: Date.now() });
}

// ─── 限流 ──────────────────────────────────────────────────
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 2000; // 最少 2 秒间隔

async function throttle() {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_REQUEST_INTERVAL) {
    const wait = MIN_REQUEST_INTERVAL - elapsed;
    console.log(`[Apify] Rate limit: waiting ${wait}ms`);
    await new Promise(resolve => setTimeout(resolve, wait));
  }
  lastRequestTime = Date.now();
}

// ─── Apify 客户端 ──────────────────────────────────────────
let _client: ApifyClient | null = null;
function getClient(): ApifyClient {
  if (!_client) {
    if (!APIFY_TOKEN) {
      throw new Error('[Apify] APIFY_TOKEN not configured');
    }
    _client = new ApifyClient({ token: APIFY_TOKEN });
  }
  return _client;
}

export function isApifyConfigured(): boolean {
  return !!APIFY_TOKEN;
}

// ─── 短链接解析 ────────────────────────────────────────────

async function resolveRedditShortUrl(url: string): Promise<string> {
  if (!url.includes('/s/')) return url;

  console.log(`[Apify] Detected short URL, resolving: ${url}`);

  try {
    const response = await redditFetch(url, { method: 'HEAD', redirect: 'manual' });

    if (response.status === 301 || response.status === 302) {
      const location = response.headers.get('location');
      if (location) {
        const resolved = location.startsWith('http') ? location : `https://www.reddit.com${location}`;
        console.log(`[Apify] Resolved short URL -> ${resolved}`);
        return resolved;
      }
    }

    const getResponse = await redditFetch(url, { redirect: 'manual' });

    if (getResponse.status === 301 || getResponse.status === 302) {
      const location = getResponse.headers.get('location');
      if (location) {
        const resolved = location.startsWith('http') ? location : `https://www.reddit.com${location}`;
        console.log(`[Apify] Resolved short URL via GET -> ${resolved}`);
        return resolved;
      }
    }

    console.warn(`[Apify] Could not resolve short URL (status: ${response.status})`);
  } catch (error: any) {
    console.warn(`[Apify] Error resolving short URL: ${error.message}`);
  }

  return url;
}

// ─── 从 Reddit URL 提取 subreddit ──────────────────────────

function extractSubredditFromUrl(url: string): string | null {
  const match = url.match(/reddit\.com\/r\/([^/]+)/);
  return match ? match[1] : null;
}

function extractPostIdFromUrl(url: string): string | null {
  const match = url.match(/\/comments\/([a-z0-9]+)/);
  return match ? match[1] : null;
}

// ─── Subreddit 帖子列表类型 ────────────────────────────────

export interface ApifySubredditPost {
  id: string;
  title: string;
  author: string;
  score: number;
  commentCount: number;
  subreddit: string;
  createdAt: string;
  permalink: string;
  selftext: string;
}

// ─── 抓取板块帖子列表 ──────────────────────────────────────

/**
 * 通过 spry_wholemeal/reddit-scraper 抓取指定板块的帖子列表
 * 使用 RESIDENTIAL 代理，FREE actor
 */
export async function fetchSubredditViaApify(
  subreddit: string,
  limit: number = 100,
  sort: 'hot' | 'new' | 'top' = 'new'
): Promise<ApifySubredditPost[]> {
  try {
    const cacheKey = `${subreddit}:${sort}:${limit}`;

    // 检查缓存
    const cached = getCachedResult(subredditCache, cacheKey, SUBREDDIT_CACHE_TTL);
    if (cached) return cached;

    // 限流
    await throttle();

    console.log(`[Apify] Fetching ${sort} posts from r/${subreddit} via reddit-scraper (limit: ${limit})`);

    const client = getClient();

    const actorInput = {
      mode: 'scrape',
      listings: [{ subreddit, maxPosts: Math.min(limit, 100) }],
      sort,
      timeframe: 'week',
      includeCommentsMode: 'none' as const,
      proxyConfiguration: PROXY_CONFIG,
    };

    console.log(`[Apify] Actor input:`, JSON.stringify(actorInput));

    const run = await client.actor('spry_wholemeal/reddit-scraper').call(actorInput);
    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    console.log(`[Apify] Raw items returned: ${items?.length || 0}`);

    if (!items || items.length === 0) {
      console.warn(`[Apify] No posts returned for r/${subreddit}`);
      return [];
    }

    // 过滤帖子类型的结果（actor 可能返回多种数据集视图）
    const posts: ApifySubredditPost[] = items
      .filter((item: any) => item.permalink || item.id || item.title)
      .slice(0, limit)
      .map((item: any) => ({
        id: item.id || '',
        title: item.title || '',
        author: item.author || '[deleted]',
        score: item.score || 0,
        commentCount: item.num_comments || 0,
        subreddit: item.subreddit || subreddit,
        createdAt: item.created_utc_iso || (item.created_utc
          ? new Date(item.created_utc * 1000).toISOString()
          : new Date().toISOString()),
        permalink: item.permalink
          ? (item.permalink.startsWith('http') ? item.permalink : `https://www.reddit.com${item.permalink}`)
          : '',
        selftext: item.text || item.selftext || '',
      }));

    console.log(`[Apify] Got ${posts.length} posts from r/${subreddit}`);

    // 写入缓存
    setCacheResult(subredditCache, cacheKey, posts);

    return posts;
  } catch (error: any) {
    console.error(`[Apify] Error fetching subreddit r/${subreddit}:`, error.message);
    return [];
  }
}

// ─── 代理 fetch 工具 ─────────────────────────────────────────

/**
 * 获取 fetch 的 dispatcher（代理配置）
 * 如果环境变量设置了 HTTP_PROXY/HTTPS_PROXY，使用 undici ProxyAgent
 */
function getFetchDispatcher(): { dispatcher?: ProxyAgent } {
  const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
  if (proxyUrl) {
    console.log(`[Reddit] Using proxy: ${proxyUrl.replace(/\/\/.*@/, '//***@')}`);
    return { dispatcher: new ProxyAgent(proxyUrl) };
  }
  return {};
}

/**
 * 带代理和反检测 headers 的 fetch 封装
 */
async function redditFetch(url: string, init?: RequestInit): Promise<Response> {
  const opts = getFetchDispatcher();
  return fetch(url, {
    ...opts,
    ...init,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json',
      ...init?.headers,
    },
  });
}

// ─── 构造 Reddit .json URL ──────────────────────────────────

/**
 * 将 Reddit 帖子 URL 转为 .json 端点
 * 关键: 必须先去除查询参数和末尾斜杠，再拼 .json
 * 例: https://www.reddit.com/r/xxx/comments/abc123/title/?share_id=yyy
 *   → https://www.reddit.com/r/xxx/comments/abc123/title.json
 */
function buildJsonUrl(redditUrl: string): string {
  // 去除查询参数
  const cleanUrl = redditUrl.split('?')[0];
  // 去除末尾斜杠
  const trimmed = cleanUrl.replace(/\/+$/, '');
  return `${trimmed}.json`;
}

// ─── 抓取单个帖子 + 评论 ────────────────────────────────────

/**
 * 通过 Reddit .json 公开端点精确抓取指定帖子及其评论
 * 任何 Reddit 帖子 URL 后加 .json 即可获取完整数据，无需 API 密钥
 * 支持代理（通过 HTTP_PROXY 环境变量）
 */
export async function fetchPostViaApify(
  redditUrl: string,
  ourPostId?: string
): Promise<{ postData: Partial<RedditPost>; comments: RedditComment[] } | null> {
  try {
    const resolvedUrl = await resolveRedditShortUrl(redditUrl);

    // 检查缓存
    const cached = getCachedResult(postCache, resolvedUrl, POST_CACHE_TTL);
    if (cached) return cached;

    // 限流
    await throttle();

    console.log(`[Reddit] Fetching post via .json endpoint: ${resolvedUrl}`);

    // 从 URL 提取 subreddit 和 post ID
    const subreddit = extractSubredditFromUrl(resolvedUrl);
    const postId = extractPostIdFromUrl(resolvedUrl) || ourPostId;

    if (!subreddit) {
      console.error(`[Reddit] Cannot extract subreddit from URL: ${resolvedUrl}`);
      return null;
    }

    // 构造 .json URL（关键：先清查询参数，再拼 .json）
    const jsonUrl = buildJsonUrl(resolvedUrl);
    console.log(`[Reddit] JSON URL: ${jsonUrl}`);

    // 请求 Reddit .json 端点
    const response = await redditFetch(jsonUrl);

    if (!response.ok) {
      console.error(`[Reddit] .json endpoint returned ${response.status} for: ${jsonUrl}`);
      return null;
    }

    const data = await response.json();

    if (!Array.isArray(data) || data.length < 2) {
      console.error(`[Reddit] Unexpected .json response format`);
      return null;
    }

    // ─── 解析帖子数据 ──────────────────────────────────────
    const postListing = data[0]?.data?.children?.[0]?.data;
    if (!postListing) {
      console.error(`[Reddit] No post data in .json response`);
      return null;
    }

    const postData: Partial<RedditPost> = {
      id: postListing.id || postId || ourPostId || '',
      title: postListing.title || '',
      author: postListing.author || '[deleted]',
      score: postListing.score || 0,
      commentCount: postListing.num_comments || 0,
      subreddit: postListing.subreddit || subreddit,
      thumbnailUrl: postListing.thumbnail && postListing.thumbnail.startsWith('http')
        ? postListing.thumbnail : undefined,
      createdAt: postListing.created_utc
        ? new Date(postListing.created_utc * 1000).toISOString()
        : new Date().toISOString(),
    };

    console.log(`[Reddit] Got post: "${postData.title?.substring(0, 50)}" (${postData.commentCount} comments)`);

    // ─── 解析评论树 ────────────────────────────────────────
    const commentListing = data[1]?.data?.children;
    if (!commentListing || !Array.isArray(commentListing)) {
      console.warn(`[Reddit] No comments in .json response`);
      const result = { postData, comments: [] as RedditComment[] };
      setCacheResult(postCache, resolvedUrl, result);
      return result;
    }

    // 递归展平评论树
    const flatComments: any[] = [];
    function flattenComments(children: any[], depth: number = 0) {
      for (const child of children) {
        if (child.kind === 'more') continue; // 跳过 "load more" 占位
        const comment = child.data;
        if (!comment) continue;
        flatComments.push({ ...comment, depth });
        if (child.data.replies?.data?.children) {
          flattenComments(child.data.replies.data.children, depth + 1);
        }
      }
    }
    flattenComments(commentListing);

    // 转换评论格式
    const redditComments: RedditComment[] = flatComments.map((c: any) => ({
      id: c.id || '',
      postId: ourPostId || postData.id || '',
      author: c.author || '[deleted]',
      body: c.body || '',
      score: c.score || 0,
      createdAt: c.created_utc
        ? new Date(c.created_utc * 1000).toISOString()
        : new Date().toISOString(),
      sentimentScore: 0,
      isFlagged: false,
      flagReasons: [],
      permalink: c.permalink
        ? (c.permalink.startsWith('http') ? c.permalink : `https://www.reddit.com${c.permalink}`)
        : '',
    }));

    console.log(`[Reddit] Got post "${postData.title?.substring(0, 50)}" with ${redditComments.length} comments`);

    // 写入缓存
    const result_data = { postData, comments: redditComments };
    setCacheResult(postCache, resolvedUrl, result_data);

    return result_data;
  } catch (error: any) {
    console.error(`[Reddit] Error fetching post ${redditUrl}:`, error.message);
    return null;
  }
}
