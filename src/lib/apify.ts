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

// ─── 按关键词搜索帖子（subreddit + keywords）─────────────────────

/** 将 Apify 原始 item 转换为统一帖子格式 */
function normalizeApifyItem(item: any, fallbackSubreddit: string): ApifySubredditPost {
  let permalink = item.permalink || item.postPermalink || '';
  if (!permalink && item.url && typeof item.url === 'string' && item.url.includes('reddit.com')) {
    permalink = item.url;
  }
  return {
    id: item.id || item.postId || '',
    title: item.title || '',
    author: item.author || '[deleted]',
    score: Number(item.score) || 0,
    commentCount: Number(item.num_comments ?? item.numComments ?? item.commentsCount ?? 0),
    subreddit: item.subreddit || fallbackSubreddit || '',
    createdAt: item.created_utc_iso || (item.created_utc
      ? new Date(Number(item.created_utc) * 1000).toISOString()
      : new Date().toISOString()),
    permalink: permalink
      ? (permalink.startsWith('http') ? permalink : `https://www.reddit.com${permalink}`)
      : '',
    selftext: item.text || item.selftext || item.body || '',
  };
}

/** 判断帖子是否包含任一关键词（标题 + 正文） */
function postMatchesKeywords(post: ApifySubredditPost, keywords: string[]): boolean {
  const haystack = `${post.title} ${post.selftext}`.toLowerCase();
  return keywords.some(kw => haystack.includes(kw.toLowerCase()));
}

/**
 * 通过 spry_wholemeal/reddit-scraper 按关键词搜索帖子
 * 混合策略：search 模式 + scrape 兜底
 * 1. 先用 search 模式（Reddit 原生搜索）
 * 2. 如果结果不够且有 subreddit，用 scrape 模式抓最新帖子再按关键词过滤
 */
export async function fetchSearchViaApify(
  subreddit: string,
  keywords: string[],
  limit: number = 25,
  timeframe: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all' = 'month'
): Promise<{ posts: ApifySubredditPost[]; error?: string; rawItemCount: number; filteredPostCount: number; firstItemKeys?: string[]; firstItemSample?: string; usedFallback?: boolean }> {
  try {
    const keywordQuery = keywords.join(' ');
    const kwLower = keywords.map(k => k.toLowerCase());

    const cacheKey = `search:${subreddit}:${keywords.join(',')}:${timeframe}:${limit}`;
    const cached = getCachedResult(subredditCache, cacheKey, SUBREDDIT_CACHE_TTL);
    if (cached) return { posts: cached, rawItemCount: cached.length, filteredPostCount: cached.length };

    await throttle();

    console.log(`[Apify] Searching "${keywordQuery}" in r/${subreddit || '(global)'} (limit: ${limit}, timeframe: ${timeframe})`);

    const client = getClient();

    // ── 第一步：search 模式（Reddit 原生搜索）──
    const actorInput: Record<string, any> = {
      mode: 'search',
      searchTargets: [{ query: keywordQuery, maxResults: Math.min(limit, 100) }],
      searchSort: 'relevance',
      timeframe,
      includeCommentsMode: 'none',
      proxyConfiguration: PROXY_CONFIG,
    };
    if (subreddit) {
      actorInput.restrictToSubreddit = subreddit;
    }

    console.log(`[Apify] Search actor input:`, JSON.stringify(actorInput));

    const runPromise = client.actor('spry_wholemeal/reddit-scraper').call(actorInput);
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Apify Actor 运行超时（2 分钟），请稍后重试')), 2 * 60 * 1000)
    );
    const run = await Promise.race([runPromise, timeoutPromise]);
    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    console.log(`[Apify] Search raw items returned: ${items?.length || 0}`);

    if (items && items.length > 0) {
      console.log(`[Apify] First raw item keys:`, Object.keys(items[0] as any));
    }

    // 过滤 + 转换
    const postItems = (items || []).filter((item: any) => {
      if (item.depth !== undefined || item.parent_id) return false;
      return item.title || item.id || item.postId;
    });
    const searchPosts = postItems.slice(0, limit).map(item => normalizeApifyItem(item, subreddit));

    console.log(`[Apify] Search mode: ${searchPosts.length} posts (raw ${items?.length || 0})`);

    // ── 第二步：结果不够 + 有 subreddit → scrape 兜底 ──
    if (searchPosts.length < limit && subreddit) {
      console.log(`[Apify] Search returned ${searchPosts.length}/${limit}, falling back to scrape mode for r/${subreddit}`);

      await throttle();

      // 抓 3 倍数量，给关键词过滤留余量
      const scrapeLimit = Math.min(limit * 3, 100);
      const scrapeActorInput = {
        mode: 'scrape',
        listings: [{ subreddit, maxPosts: scrapeLimit }],
        sort: 'new' as const,
        timeframe: 'all' as const,
        includeCommentsMode: 'none' as const,
        proxyConfiguration: PROXY_CONFIG,
      };

      console.log(`[Apify] Scrape fallback input:`, JSON.stringify(scrapeActorInput));

      const scrapeRunPromise = client.actor('spry_wholemeal/reddit-scraper').call(scrapeActorInput);
      const scrapeTimeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Apify scrape 超时（2 分钟）')), 2 * 60 * 1000)
      );
      const scrapeRun = await Promise.race([scrapeRunPromise, scrapeTimeoutPromise]);
      const { items: scrapeItems } = await client.dataset(scrapeRun.defaultDatasetId).listItems();

      console.log(`[Apify] Scrape raw items: ${scrapeItems?.length || 0}`);

      if (scrapeItems && scrapeItems.length > 0) {
        // 过滤评论 + 转换
        const scrapePostItems = scrapeItems.filter((item: any) => {
          if (item.depth !== undefined || item.parent_id) return false;
          return item.title || item.id || item.postId;
        });
        const allScrapePosts = scrapePostItems.map(item => normalizeApifyItem(item, subreddit));

        // 按关键词过滤（标题 + 正文匹配任一关键词）
        const matchedPosts = allScrapePosts.filter(p => postMatchesKeywords(p, kwLower));

        console.log(`[Apify] Scrape fallback: ${matchedPosts.length} matched (from ${allScrapePosts.length} posts, ${scrapeItems.length} raw)`);

        // 合并：search 结果 + scrape 结果，按 id 去重
        const seenIds = new Set(searchPosts.map(p => p.id).filter(Boolean));
        const combined = [...searchPosts];
        for (const p of matchedPosts) {
          if (p.id && !seenIds.has(p.id)) {
            combined.push(p);
            seenIds.add(p.id);
          }
          if (combined.length >= limit) break;
        }

        console.log(`[Apify] Combined: ${combined.length} posts (search ${searchPosts.length} + scrape ${combined.length - searchPosts.length})`);

        if (combined.length === 0) {
          return {
            posts: [],
            error: `在 r/${subreddit} 最新 ${scrapeLimit} 条帖子中未找到包含 "${keywordQuery}" 的内容`,
            rawItemCount: (items?.length || 0) + (scrapeItems?.length || 0),
            filteredPostCount: 0,
            usedFallback: true,
          };
        }

        const finalPosts = combined.slice(0, limit);
        setCacheResult(subredditCache, cacheKey, finalPosts);
        return {
          posts: finalPosts,
          rawItemCount: (items?.length || 0) + (scrapeItems?.length || 0),
          filteredPostCount: finalPosts.length,
          usedFallback: true,
        };
      }
    }

    // search 模式结果够用，或没有 subreddit 无法 fallback
    if (searchPosts.length === 0) {
      return {
        posts: [],
        error: `未找到匹配 "${keywordQuery}" 的帖子`,
        rawItemCount: items?.length || 0,
        filteredPostCount: 0,
      };
    }

    setCacheResult(subredditCache, cacheKey, searchPosts);
    return {
      posts: searchPosts,
      rawItemCount: items?.length || 0,
      filteredPostCount: postItems.length,
      firstItemKeys: items && items.length > 0 ? Object.keys(items[0] as any) : undefined,
      firstItemSample: items && items.length > 0 ? JSON.stringify(items[0]).slice(0, 500) : undefined,
    };
  } catch (error: any) {
    console.error(`[Apify] Error searching "${keywords.join(' ')}":`, error.message);
    return { posts: [], error: error.message || 'Apify 调用失败', rawItemCount: 0, filteredPostCount: 0 };
  }
}


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

    // neatrat/reddit-scraper 返回结构：
    // 帖子和评论在同一个 dataset item 中，评论嵌套在 item.comments 数组里
    const postItem = items[0] as any;
    const subreddit = extractSubredditFromUrl(redditUrl);
    const postId = extractPostIdFromUrl(redditUrl) || ourPostId;

    console.log(`[Apify] dataType: ${postItem.dataType}, comments: ${postItem.comments?.length || 0}`);

    // 提取帖子数据
    const postData: Partial<RedditPost> = {
      id: (postItem.id || postId || ourPostId || '') as string,
      title: (postItem.title || '') as string,
      author: (postItem.author || '[deleted]') as string,
      score: Number(postItem.score ?? 0),
      commentCount: Number(postItem.commentCount ?? postItem.commentCountFromTree ?? 0),
      subreddit: (postItem.subreddit || subreddit || '') as string,
      thumbnailUrl: postItem.media?.thumbnail || undefined,
      createdAt: (postItem.createdAt || new Date().toISOString()) as string,
    };

    // 递归提取评论（包括嵌套的 children）
    const redditComments: RedditComment[] = [];
    function extractComments(comments: any[]) {
      if (!Array.isArray(comments)) return;
      for (const c of comments) {
        if (!c) continue;
        redditComments.push({
          id: (c.id || '') as string,
          postId: (ourPostId || postId || '') as string,
          author: (c.author || '[deleted]') as string,
          body: (c.bodyText || '') as string,
          score: Number(c.score ?? 0),
          createdAt: (c.createdAt || new Date().toISOString()) as string,
          sentimentScore: 0,
          isFlagged: false,
          flagReasons: [],
          permalink: (c.permalink || '') as string,
        });
        // 递归处理子评论
        if (c.children && Array.isArray(c.children)) {
          extractComments(c.children);
        }
      }
    }
    extractComments(postItem.comments || []);

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
