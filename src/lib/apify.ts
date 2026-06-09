// Apify Reddit Scraper Integration
// 使用 Apify 平台的 Reddit Scraper Actor 抓取帖子和评论
// 文档: https://apify.com/trudax/reddit-scraper-lite

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

// ─── 类型定义 ───────────────────────────────────────────────

interface ApifyRedditPostResult {
  id: string;
  title: string;
  author: string;
  score: number;
  num_comments: number;
  created_utc: number;
  subreddit: string;
  permalink: string;
  selftext?: string;
  thumbnail?: string;
  url?: string;
}

interface ApifyRedditCommentResult {
  id: string;
  author: string;
  body: string;
  score: number;
  created_utc: number;
  permalink: string;
  replies?: ApifyRedditCommentResult[];
}

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
 * 通过 Apify Reddit Scraper 抓取指定帖子及其评论
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

    console.log(`[Apify] Fetching post via Apify: ${resolvedUrl}`);

    const client = getClient();

    // 使用 trudax/reddit-scraper-lite Actor（原 apify/reddit-scraper 已更名）
    const run = await client.actor('trudax/reddit-scraper-lite').call({
      startUrls: [{ url: resolvedUrl }],
      maxPostCount: 1,
      maxItems: 500, // 增加结果上限，默认只有10条（1帖子+9评论），导致评论获取不全
      maxComments: 500, // 单独设置评论上限，默认只有10条，必须显式设置才能获取更多评论
      skipComments: false,
      sort: 'new',
      scrollTimeout: 120, // 增加滚动超时到120秒，让页面加载全部评论包括嵌套评论
    });

    // 等待完成并获取结果（分页获取所有结果）
    const allItems: any[] = [];
    let offset = 0;
    const batchSize = 100;
    while (true) {
      const { items } = await client.dataset(run.defaultDatasetId).listItems({ offset, limit: batchSize });
      if (!items || items.length === 0) break;
      allItems.push(...items);
      offset += batchSize;
      if (items.length < batchSize) break; // 最后一批
    }

    if (!allItems || allItems.length === 0) {
      console.warn(`[Apify] No data returned for ${redditUrl}`);
      return null;
    }

    // 分离帖子和评论（使用 dataType 字段区分）
    const posts = allItems.filter((item: any) => item.dataType === 'post' || (item.title && !item.body));
    const comments = allItems.filter((item: any) => item.dataType === 'comment' || (item.body && item.dataType !== 'post'));

    if (posts.length === 0) {
      console.warn(`[Apify] No post data found in results for ${redditUrl}`);
      return null;
    }

    const post = posts[0] as any;
    const postData: Partial<RedditPost> = {
      id: post.id || ourPostId || '',
      title: post.title || '',
      author: post.username || post.author || '[deleted]',
      score: post.score || post.upVotes || 0,
      commentCount: post.numberOfComments || post.num_comments || comments.length || 0,
      subreddit: post.communityName || post.subreddit || '',
      thumbnailUrl: post.thumbnail?.startsWith('http') ? post.thumbnail : undefined,
      createdAt: post.createdAt
        ? new Date(post.createdAt).toISOString()
        : post.created_utc
        ? new Date(post.created_utc * 1000).toISOString()
        : new Date().toISOString(),
    };

    // 转换评论
    const redditComments: RedditComment[] = comments.map((c: any) => ({
      id: c.id || '',
      postId: ourPostId || postData.id || '',
      author: c.username || c.author || '[deleted]',
      body: c.body || '',
      score: c.score || c.upVotes || 0,
      createdAt: c.createdAt
        ? new Date(c.createdAt).toISOString()
        : c.created_utc
        ? new Date(c.created_utc * 1000).toISOString()
        : new Date().toISOString(),
      sentimentScore: 0,
      isFlagged: false,
      flagReasons: [],
      permalink: c.url || '',
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
 * 通过 Apify Reddit Scraper 抓取指定板块的帖子列表
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
    console.log(`[Apify] Fetching ${sort} posts from r/${subreddit} via Apify (limit: ${limit})`);

    const client = getClient();

    const run = await client.actor('trudax/reddit-scraper-lite').call({
      startUrls: [{ url: searchUrl }],
      maxPostCount: Math.min(limit, 100), // Apify 免费额度限制
      skipComments: true, // 列表模式不抓评论
      sort,
    });

    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    if (!items || items.length === 0) {
      console.warn(`[Apify] No posts returned for r/${subreddit}`);
      return [];
    }

    const posts: ApifySubredditPost[] = items
      .filter((item: any) => item.dataType === 'post' || item.title) // 只要帖子
      .map((item: any) => ({
        id: item.id || '',
        title: item.title || '',
        author: item.username || item.author || '[deleted]',
        score: item.score || item.upVotes || 0,
        commentCount: item.numberOfComments || item.num_comments || 0,
        subreddit: item.communityName || item.subreddit || subreddit,
        createdAt: item.createdAt
          ? new Date(item.createdAt).toISOString()
          : item.created_utc
          ? new Date(item.created_utc * 1000).toISOString()
          : new Date().toISOString(),
        permalink: item.url || '',
        selftext: item.body || item.selftext || '',
      }));

    console.log(`[Apify] Got ${posts.length} posts from r/${subreddit}`);
    return posts;
  } catch (error: any) {
    console.error(`[Apify] Error fetching subreddit r/${subreddit}:`, error.message);
    return [];
  }
}
