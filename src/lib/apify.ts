// Apify Web Scraper Integration
// 分层代理策略：
//   - 版块列表页 → DATACENTER（BUYPROXIES94952，低成本 $0.25/GB）
//   - 帖子详情页 → RESIDENTIAL 住宅代理（高成功率，仅正文抓取消耗流量）
// 配套：内存缓存 + 限流 + 跳过已扫描帖子
// 文档: https://apify.com/apify/web-scraper

import { ApifyClient } from 'apify-client';
import { RedditComment, RedditPost } from './types';

const APIFY_TOKEN = process.env.APIFY_TOKEN;

// ─── 代理组配置 ──────────────────────────────────────────────
// 列表页用低成本数据中心代理
const DATACENTER_PROXY = ['BUYPROXIES94952'];
// 帖子详情页用住宅代理（高成功率）
const RESIDENTIAL_PROXY = ['RESIDENTIAL'];

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

// ─── Web Scraper pageFunction（帖子详情） ─────────────────────
// 使用 https://example.com/ 作为起始页
// 在浏览器上下文中通过 fetch 访问 Reddit .json 端点获取完整帖子+评论
const POST_PAGE_FUNCTION = `async function pageFunction(context) {
  const targetUrl = context.request.userData.targetUrl;
  const jsonUrl = targetUrl.split('?')[0].replace(/\\/$/, '') + '/.json';
  const resp = await context.page.evaluate(async (url) => {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
    });
    if (!r.ok) return { error: 'HTTP ' + r.status };
    return { data: await r.json() };
  }, jsonUrl);

  if (resp.error) return { url: targetUrl, error: resp.error, type: 'error' };
  if (!resp.data) return { url: targetUrl, error: 'No data', type: 'error' };

  const arr = Array.isArray(resp.data) ? resp.data : [resp.data];
  const postData = arr[0]?.data?.children?.[0]?.data || {};
  const commentsArr = arr[1]?.data?.children || [];

  function flatten(replies) {
    if (!replies || !replies.data || !replies.data.children) return [];
    const out = [];
    for (const c of replies.data.children) {
      if (c.kind !== 'comment') continue;
      const cd = c.data;
      out.push({
        id: cd.id, author: cd.author, body: cd.body || '',
        score: cd.score, created_utc: cd.created_utc, permalink: cd.permalink
      });
      out.push(...flatten(cd.replies));
    }
    return out;
  }

  const comments = [];
  for (const c of commentsArr) {
    if (c.kind !== 'comment') continue;
    const cd = c.data;
    comments.push({
      id: cd.id, author: cd.author, body: cd.body || '',
      score: cd.score, created_utc: cd.created_utc, permalink: cd.permalink
    });
    comments.push(...flatten(cd.replies));
  }

  return {
    type: 'post', url: targetUrl,
    id: postData.id, title: postData.title, author: postData.author,
    score: postData.score, num_comments: postData.num_comments,
    created_utc: postData.created_utc, subreddit: postData.subreddit,
    permalink: postData.permalink, selftext: postData.selftext || '',
    thumbnail: postData.thumbnail,
    comments
  };
}`;

// ─── Web Scraper pageFunction（版块列表） ─────────────────────
// 只获取帖子链接和基本信息，不抓正文
const LISTING_PAGE_FUNCTION = `async function pageFunction(context) {
  const targetUrl = context.request.userData.targetUrl;
  const jsonUrl = targetUrl.split('?')[0].replace(/\\/$/, '') + '.json';
  const resp = await context.page.evaluate(async (url) => {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
    });
    if (!r.ok) return { error: 'HTTP ' + r.status };
    return { data: await r.json() };
  }, jsonUrl);

  if (resp.error) return { url: targetUrl, error: resp.error, type: 'error' };
  if (!resp.data || !resp.data.data || !resp.data.data.children) {
    return { url: targetUrl, error: 'Blocked or no data', type: 'error' };
  }

  const posts = resp.data.data.children
    .filter(c => c.kind === 't3')
    .map(c => {
      const d = c.data;
      return {
        type: 'listing_post', id: d.id, title: d.title, author: d.author,
        score: d.score, num_comments: d.num_comments,
        created_utc: d.created_utc, subreddit: d.subreddit,
        permalink: d.permalink, selftext: d.selftext || '',
        thumbnail: d.thumbnail
      };
    });

  return posts;
}`;

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

// ─── 抓取单个帖子 + 评论（RESIDENTIAL 住宅代理） ──────────────

/**
 * 通过 Apify Web Scraper 抓取指定帖子及其评论
 * 使用 RESIDENTIAL 住宅代理（高成功率，仅需要正文时消耗流量）
 * 内置缓存：同一帖子 30 分钟内不重复抓取
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

    console.log(`[Apify] Fetching post via Web Scraper (RESIDENTIAL proxy): ${resolvedUrl}`);

    const client = getClient();

    const run = await client.actor('apify/web-scraper').call({
      startUrls: [{ url: 'https://example.com/', userData: { targetUrl: resolvedUrl } }],
      pageFunction: POST_PAGE_FUNCTION,
      // 帖子详情页使用 RESIDENTIAL 住宅代理（高成功率）
      proxyConfiguration: { useApifyProxy: true, apifyProxyGroups: RESIDENTIAL_PROXY },
      maxPages: 1,
      linkSelector: '',
    });

    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    if (!items || items.length === 0) {
      console.warn(`[Apify] No data returned for ${redditUrl}`);
      return null;
    }

    const result = items[0] as any;

    if (result.type === 'error' || !result.type) {
      console.warn(`[Apify] Scraper error: ${result.error || 'Unknown error'} for ${redditUrl}`);
      return null;
    }

    if (result.type !== 'post') {
      console.warn(`[Apify] Unexpected result type: ${result.type} for ${redditUrl}`);
      return null;
    }

    // 构造帖子数据
    const postData: Partial<RedditPost> = {
      id: result.id || ourPostId || '',
      title: result.title || '',
      author: result.author || '[deleted]',
      score: result.score || 0,
      commentCount: result.num_comments || result.comments?.length || 0,
      subreddit: result.subreddit || '',
      thumbnailUrl: result.thumbnail?.startsWith('http') ? result.thumbnail : undefined,
      createdAt: result.created_utc
        ? new Date(result.created_utc * 1000).toISOString()
        : new Date().toISOString(),
    };

    // 转换评论
    const rawComments: any[] = result.comments || [];
    const redditComments: RedditComment[] = rawComments.map((c: any) => ({
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
      permalink: c.permalink ? `https://www.reddit.com${c.permalink}` : '',
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

// ─── 抓取板块帖子列表（DATACENTER 低成本代理） ────────────────

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

/**
 * 通过 Apify Web Scraper 抓取指定板块的帖子列表
 * 使用 DATACENTER 数据中心代理（低成本，只拿帖子链接不耗住宅流量）
 * 内置缓存：同一板块 10 分钟内不重复抓取
 */
export async function fetchSubredditViaApify(
  subreddit: string,
  limit: number = 100,
  sort: 'hot' | 'new' | 'top' = 'new'
): Promise<ApifySubredditPost[]> {
  try {
    const searchUrl = `https://www.reddit.com/r/${subreddit}/${sort}/`;
    const cacheKey = `${subreddit}:${sort}:${limit}`;

    // 检查缓存
    const cached = getCachedResult(subredditCache, cacheKey, SUBREDDIT_CACHE_TTL);
    if (cached) return cached;

    // 限流
    await throttle();

    console.log(`[Apify] Fetching ${sort} posts from r/${subreddit} via Web Scraper (DATACENTER proxy, limit: ${limit})`);

    const client = getClient();

    const run = await client.actor('apify/web-scraper').call({
      startUrls: [{ url: 'https://example.com/', userData: { targetUrl: searchUrl } }],
      pageFunction: LISTING_PAGE_FUNCTION,
      // 列表页使用 DATACENTER 数据中心代理（低成本）
      proxyConfiguration: { useApifyProxy: true, apifyProxyGroups: DATACENTER_PROXY },
      maxPages: 1,
      linkSelector: '',
    });

    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    if (!items || items.length === 0) {
      console.warn(`[Apify] No posts returned for r/${subreddit}`);
      return [];
    }

    const allPosts: any[] = [];
    for (const item of items) {
      if (Array.isArray(item)) {
        allPosts.push(...item);
      } else if ((item as any).type === 'listing_post') {
        allPosts.push(item);
      }
    }

    const posts: ApifySubredditPost[] = allPosts
      .slice(0, limit)
      .map((item: any) => ({
        id: item.id || '',
        title: item.title || '',
        author: item.author || '[deleted]',
        score: item.score || 0,
        commentCount: item.num_comments || 0,
        subreddit: item.subreddit || subreddit,
        createdAt: item.created_utc
          ? new Date(item.created_utc * 1000).toISOString()
          : new Date().toISOString(),
        permalink: item.permalink ? `https://www.reddit.com${item.permalink}` : '',
        selftext: item.selftext || '',
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
