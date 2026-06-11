// Apify Web Scraper Integration
// 使用 Apify Web Scraper Actor 抓取 Reddit 帖子和评论
// 通过 Reddit .json 端点获取结构化数据，强制使用 DATACENTER 代理
// 文档: https://apify.com/apify/web-scraper

import { ApifyClient } from 'apify-client';
import { RedditComment, RedditPost } from './types';

const APIFY_TOKEN = process.env.APIFY_TOKEN;

// 懒加载 Apify 客户端
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

// ─── Web Scraper pageFunction ────────────────────────────────
// 在浏览器上下文中执行，通过 fetch 访问 Reddit .json 端点获取结构化数据
// 支持两种场景：帖子详情页（含评论）和板块列表页

const PAGE_FUNCTION = `async function pageFunction(context) {
  const requestUrl = context.request.url;
  const isPostPage = /\\/comments\\//.test(requestUrl);

  if (isPostPage) {
    const jsonUrl = requestUrl.split('?')[0].replace(/\\/$/, '') + '/.json';
    const resp = await context.page.evaluate(async (url) => {
      const r = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
      });
      if (!r.ok) return { error: 'HTTP ' + r.status };
      return { data: await r.json() };
    }, jsonUrl);

    if (resp.error) return { url: requestUrl, error: resp.error, type: 'error' };
    if (!resp.data) return { url: requestUrl, error: 'No data', type: 'error' };

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
      type: 'post', url: requestUrl,
      id: postData.id, title: postData.title, author: postData.author,
      score: postData.score, num_comments: postData.num_comments,
      created_utc: postData.created_utc, subreddit: postData.subreddit,
      permalink: postData.permalink, selftext: postData.selftext || '',
      thumbnail: postData.thumbnail,
      comments
    };
  } else {
    const jsonUrl = requestUrl.split('?')[0].replace(/\\/$/, '') + '.json';
    const resp = await context.page.evaluate(async (url) => {
      const r = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
      });
      if (!r.ok) return { error: 'HTTP ' + r.status };
      return { data: await r.json() };
    }, jsonUrl);

    if (resp.error) return { url: requestUrl, error: resp.error, type: 'error' };
    if (!resp.data || !resp.data.data || !resp.data.data.children) {
      return { url: requestUrl, error: 'Blocked or no data', type: 'error' };
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
  }
}`;

// ─── 短链接解析 ────────────────────────────────────────────

/**
 * 检测并解析 Reddit 短链接 (/s/ 格式) 为标准完整 URL
 * 短链接格式: https://www.reddit.com/r/xxx/s/xxxxx
 * 标准格式:   https://www.reddit.com/r/xxx/comments/xxxxx/title/
 */
async function resolveRedditShortUrl(url: string): Promise<string> {
  // 只处理 /s/ 短链接
  if (!url.includes('/s/')) {
    return url;
  }

  console.log(`[Apify] Detected short URL, resolving: ${url}`);

  try {
    // 使用 HEAD 请求跟随重定向获取完整 URL
    const response = await fetch(url, {
      method: 'HEAD',
      redirect: 'manual', // 手动处理重定向以获取 Location
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    // 301/302 重定向
    if (response.status === 301 || response.status === 302) {
      const location = response.headers.get('location');
      if (location) {
        const resolved = location.startsWith('http') ? location : `https://www.reddit.com${location}`;
        console.log(`[Apify] Resolved short URL -> ${resolved}`);
        return resolved;
      }
    }

    // 如果 HEAD 没拿到重定向，尝试 GET（跟随重定向）
    console.log(`[Apify] HEAD did not return redirect, trying GET...`);
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

    console.warn(`[Apify] Could not resolve short URL (status: ${response.status}), using original`);
  } catch (error: any) {
    console.warn(`[Apify] Error resolving short URL: ${error.message}, using original`);
  }

  return url;
}

// ─── 抓取单个帖子 + 评论 ───────────────────────────────────

/**
 * 通过 Apify Web Scraper 抓取指定帖子及其评论
 * 使用 Reddit .json 端点获取完整评论树，强制 DATACENTER 代理
 * @param redditUrl Reddit 帖子 URL
 * @param ourPostId 我们系统中的帖子 ID（用于关联评论）
 */
export async function fetchPostViaApify(
  redditUrl: string,
  ourPostId?: string
): Promise<{ postData: Partial<RedditPost>; comments: RedditComment[] } | null> {
  try {
    // 如果是短链接，先解析为标准 URL
    const resolvedUrl = await resolveRedditShortUrl(redditUrl);

    console.log(`[Apify] Fetching post via Web Scraper: ${resolvedUrl}`);

    const client = getClient();

    // 使用 apify/web-scraper（完整浏览器，原生支持 proxyConfiguration）
    const run = await client.actor('apify/web-scraper').call({
      startUrls: [{ url: resolvedUrl }],
      pageFunction: PAGE_FUNCTION,
      // 强制 DATACENTER 代理（$0.25/GB，最便宜）
      proxyConfiguration: { useApifyProxy: true, apifyProxyGroups: ['DATACENTER'] },
      maxPages: 1, // 只抓一个页面
      // 不跟踪页面内链接
      linkSelector: '',
    });

    // 获取结果
    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    if (!items || items.length === 0) {
      console.warn(`[Apify] No data returned for ${redditUrl}`);
      return null;
    }

    // Web Scraper 返回 pageFunction 的结果
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
    return { postData, comments: redditComments };
  } catch (error: any) {
    console.error(`[Apify] Error fetching post ${redditUrl}:`, error.message);
    return null;
  }
}

// ─── 抓取板块帖子列表 ──────────────────────────────────────

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
 * 使用 Reddit .json 端点，强制 DATACENTER 代理
 * @param subreddit 板块名称（如 "Hisense"）
 * @param limit 最大帖子数
 * @param sort 排序方式
 */
export async function fetchSubredditViaApify(
  subreddit: string,
  limit: number = 100,
  sort: 'hot' | 'new' | 'top' = 'new'
): Promise<ApifySubredditPost[]> {
  try {
    const searchUrl = `https://www.reddit.com/r/${subreddit}/${sort}/`;
    console.log(`[Apify] Fetching ${sort} posts from r/${subreddit} via Web Scraper (limit: ${limit})`);

    const client = getClient();

    const run = await client.actor('apify/web-scraper').call({
      startUrls: [{ url: searchUrl }],
      pageFunction: PAGE_FUNCTION,
      // 强制 DATACENTER 代理（$0.25/GB，最便宜）
      proxyConfiguration: { useApifyProxy: true, apifyProxyGroups: ['DATACENTER'] },
      maxPages: 1,
      linkSelector: '',
    });

    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    if (!items || items.length === 0) {
      console.warn(`[Apify] No posts returned for r/${subreddit}`);
      return [];
    }

    // pageFunction 对列表页返回数组（可能被展平为多个 dataset items）
    // 也可能整个数组作为单个 item 返回
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
    return posts;
  } catch (error: any) {
    console.error(`[Apify] Error fetching subreddit r/${subreddit}:`, error.message);
    return [];
  }
}
