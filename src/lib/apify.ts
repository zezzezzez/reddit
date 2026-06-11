// Apify Reddit Integration
// 单帖抓取: neatrat/reddit-scraper（按 URL 精确抓取，自带代理）
// 版块抓取: spry_wholemeal/reddit-scraper（FREE Actor）
// 文档: https://apify.com/neatrat/reddit-scraper

import { ApifyClient } from 'apify-client';
import { RedditComment, RedditPost } from './types';

const APIFY_TOKEN = process.env.APIFY_TOKEN;

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
  lastRequestTime = now;
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

// ─── 代理配置（版块抓取用）──────────────────────────────────
const PROXY_CONFIG = {
  useApifyProxy: true,
  apifyProxyGroups: ['RESIDENTIAL'],
};

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

// ─── 抓取单个帖子 + 评论（neatrat/reddit-scraper Actor）──────

/**
 * 通过 neatrat/reddit-scraper Actor 按 URL 精确抓取指定帖子及其评论
 * Actor 自带住宅代理，无需额外配置
 */
export async function fetchPostViaApify(
  redditUrl: string,
  ourPostId?: string
): Promise<{ postData: Partial<RedditPost>; comments: RedditComment[] } | null> {
  try {
    // 检查缓存
    const cached = getCachedResult(postCache, redditUrl, POST_CACHE_TTL);
    if (cached) return cached;

    // 限流
    await throttle();

    console.log(`[Apify] Fetching post via neatrat/reddit-scraper: ${redditUrl}`);

    const client = getClient();

    // 构造 Actor 输入：传入帖子 URL，精确抓取
    const actorInput = {
      startUrls: [{ url: redditUrl }],
      pages: 3,                    // 深度抓取评论
      maxCommentsPerPost: 200,     // 每个帖子最多 200 条评论
      maxItems: 1,                 // 只要 1 个帖子
      requestTimeoutSecs: 60,
    };

    console.log(`[Apify] Actor input:`, JSON.stringify(actorInput));

    // 调用 neatrat/reddit-scraper
    const run = await client.actor('neatrat/reddit-scraper').call(actorInput);
    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    console.log(`[Apify] Raw items returned: ${items?.length || 0}`);

    if (!items || items.length === 0) {
      console.warn(`[Apify] No data returned for: ${redditUrl}`);
      return null;
    }

    // 从返回数据中分离帖子和评论
    const subreddit = extractSubredditFromUrl(redditUrl);
    const postId = extractPostIdFromUrl(redditUrl) || ourPostId;

    let postData: Partial<RedditPost> | null = null;
    const redditComments: RedditComment[] = [];

    for (const rawItem of items) {
      const item = rawItem as any;
      const dataType = item.dataType || item.type;

      if (dataType === 'post' || dataType === 'post-full' || (!dataType && item.title)) {
        // 帖子数据
        postData = {
          id: (item.parsedId || item.id || postId || ourPostId || '') as string,
          title: (item.itemTitle || item.title || '') as string,
          author: (item.username || item.author || '[deleted]') as string,
          score: Number(item.upVotes ?? item.score ?? 0),
          commentCount: Number(item.numberOfComments ?? item.numComments ?? 0),
          subreddit: String(item.parsedCommunityName || item.communityName || subreddit || '').replace(/^r\//, ''),
          thumbnailUrl: item.imageUrls?.[0] || item.thumbnailUrl || undefined,
          createdAt: (item.createdAt || new Date().toISOString()) as string,
        };
      } else if (dataType === 'comment' || dataType === 'comment-permalink' || item.parentId || item.body) {
        // 评论数据
        redditComments.push({
          id: (item.parsedId || item.id || '') as string,
          postId: (ourPostId || postId || '') as string,
          author: (item.username || item.author || '[deleted]') as string,
          body: (item.body || '') as string,
          score: Number(item.upVotes ?? item.score ?? 0),
          createdAt: (item.createdAt || new Date().toISOString()) as string,
          sentimentScore: 0,
          isFlagged: false,
          flagReasons: [],
          permalink: (item.url || '') as string,
        });
      }
    }

    // 如果没有识别到帖子，尝试从第一个 item 构造
    if (!postData) {
      const first = items[0] as any;
      postData = {
        id: (first.parsedId || first.id || postId || ourPostId || '') as string,
        title: (first.itemTitle || first.title || '') as string,
        author: (first.username || first.author || '[deleted]') as string,
        score: Number(first.upVotes ?? first.score ?? 0),
        commentCount: Number(first.numberOfComments ?? first.numComments ?? redditComments.length),
        subreddit: String(first.parsedCommunityName || first.communityName || subreddit || '').replace(/^r\//, ''),
        createdAt: (first.createdAt || new Date().toISOString()) as string,
      };
    }

    console.log(`[Apify] Got post "${postData.title?.substring(0, 50)}" with ${redditComments.length} comments`);

    // 写入缓存
    const result = { postData, comments: redditComments };
    setCacheResult(postCache, redditUrl, result);

    return result;
  } catch (error: any) {
    console.error(`[Apify] Error fetching post ${redditUrl}:`, error.message);
    return null;
  }
}
