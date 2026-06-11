// Apify Reddit Integration
// 使用 spry_wholemeal/reddit-scraper（FREE，内置智能代理，5.0 评分）
// 替代之前的 Web Scraper 方案，专用 Reddit actor 成功率更高
// 文档: https://apify.com/spry_wholemeal/reddit-scraper

import { ApifyClient } from 'apify-client';
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
    const response = await fetch(url, {
      method: 'HEAD',
      redirect: 'manual',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (response.status === 301 || response.status === 302) {
      const location = response.headers.get('location');
      if (location) {
        const resolved = location.startsWith('http') ? location : `https://www.reddit.com${location}`;
        console.log(`[Apify] Resolved short URL -> ${resolved}`);
        return resolved;
      }
    }

    const getResponse = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

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

// ─── 抓取单个帖子 + 评论 ────────────────────────────────────

/**
 * 通过 spry_wholemeal/reddit-scraper 抓取指定帖子及其评论
 * 从帖子 URL 提取 subreddit，抓取带评论的帖子列表，然后匹配目标帖子
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

    console.log(`[Apify] Fetching post via reddit-scraper: ${resolvedUrl}`);

    // 从 URL 提取 subreddit 和 post ID
    const subreddit = extractSubredditFromUrl(resolvedUrl);
    const postId = extractPostIdFromUrl(resolvedUrl) || ourPostId;

    if (!subreddit) {
      console.error(`[Apify] Cannot extract subreddit from URL: ${resolvedUrl}`);
      return null;
    }

    const client = getClient();

    // 抓取该版块的帖子（带评论）
    const actorInput = {
      mode: 'scrape',
      listings: [{ subreddit, maxPosts: 25, sort: 'new' }],
      sort: 'new',
      timeframe: 'week',
      includeCommentsMode: 'all' as const,
      maxTopLevelComments: 100,
      maxRepliesDepth: 3,
      proxyConfiguration: PROXY_CONFIG,
    };

    console.log(`[Apify] Actor input for post:`, JSON.stringify(actorInput));

    const run = await client.actor('spry_wholemeal/reddit-scraper').call(actorInput);
    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    console.log(`[Apify] Raw items returned: ${items?.length || 0}`);

    if (!items || items.length === 0) {
      console.warn(`[Apify] No data returned for ${resolvedUrl}`);
      return null;
    }

    // 在返回的结果中找到目标帖子
    // actor 可能把所有帖子放在一个 item 中，也可能每个帖子一个 item
    let targetPost: any = null;

    for (const item of items) {
      // 检查是否是包含帖子列表的聚合结果
      if (item.posts && Array.isArray(item.posts)) {
        targetPost = item.posts.find((p: any) => {
          const postPermalink = p.permalink || '';
          const postIdMatch = postId && postPermalink.includes(postId);
          const urlMatch = resolvedUrl.includes(postPermalink.replace('https://www.reddit.com', ''));
          return postIdMatch || urlMatch;
        });
        if (targetPost) break;
      }

      // 检查 item 本身是否是帖子
      const itemPermalink: string = String(item.permalink || item.url || '');
      const itemId: string = String(item.id || '');
      if (
        (postId && (itemId === postId || itemPermalink.includes(postId))) ||
        itemPermalink === resolvedUrl.replace('https://www.reddit.com', '') ||
        itemPermalink === resolvedUrl
      ) {
        targetPost = item;
        break;
      }
    }

    // 如果没找到精确匹配，取第一个有评论的帖子
    if (!targetPost) {
      console.warn(`[Apify] Target post not found in results, trying first item with comments`);
      targetPost = items.find((item: any) => item.comments && item.comments.length > 0) || items[0];
    }

    if (!targetPost) {
      console.warn(`[Apify] No usable post data for ${resolvedUrl}`);
      return null;
    }

    console.log(`[Apify] Found target post: "${(targetPost.title || '').substring(0, 50)}"`);

    // 构造帖子数据
    const postData: Partial<RedditPost> = {
      id: targetPost.id || postId || ourPostId || '',
      title: targetPost.title || '',
      author: targetPost.author || '[deleted]',
      score: targetPost.score || 0,
      commentCount: targetPost.num_comments || targetPost.comments?.length || 0,
      subreddit: targetPost.subreddit || subreddit,
      thumbnailUrl: undefined,
      createdAt: targetPost.created_utc_iso || (targetPost.created_utc
        ? new Date(targetPost.created_utc * 1000).toISOString()
        : new Date().toISOString()),
    };

    // 转换评论
    const rawComments: any[] = targetPost.comments || [];
    const redditComments: RedditComment[] = rawComments.map((c: any) => ({
      id: c.id || '',
      postId: ourPostId || postData.id || '',
      author: c.author || '[deleted]',
      body: c.text || c.body || '',
      score: c.score || 0,
      createdAt: c.created_utc_iso || (c.created_utc
        ? new Date(c.created_utc * 1000).toISOString()
        : new Date().toISOString()),
      sentimentScore: 0,
      isFlagged: false,
      flagReasons: [],
      permalink: c.permalink
        ? (c.permalink.startsWith('http') ? c.permalink : `https://www.reddit.com${c.permalink}`)
        : '',
    }));

    console.log(`[Apify] Got post "${postData.title?.substring(0, 50)}" with ${redditComments.length} comments`);

    // 写入缓存
    const result_data = { postData, comments: redditComments };
    setCacheResult(postCache, resolvedUrl, result_data);

    return result_data;
  } catch (error: any) {
    console.error(`[Apify] Error fetching post ${redditUrl}:`, error.message);
    return null;
  }
}
