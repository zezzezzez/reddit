// Reddit API Integration
// Fetches comments from Reddit posts

import { RedditComment, RedditPost } from './types';

// 使用代理 fetch（解决 Node.js 内置 fetch 不走 npm undici 全局 dispatcher 的问题）
import { getProxyUrl, proxyFetch } from './local-proxy';

// 使用更真实的浏览器 User-Agent，避免被 Reddit 阻止
const REDDIT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// 配置代理（从环境变量读取）
const PROXY_URL = process.env.HTTP_PROXY || process.env.HTTPS_PROXY;

interface RedditPostData {
  title: string;
  author: string;
  score: number;
  num_comments: number;
  created_utc: number;
  subreddit: string;
  thumbnail: string;
  permalink: string;
  selftext: string;
}

interface RedditCommentData {
  id: string;
  author: string;
  body: string;
  score: number;
  created_utc: number;
  permalink: string;
  replies?: any;
}

// Resolve short URLs to full Reddit URLs
export async function resolveShortUrl(url: string): Promise<string> {
  if (!url.includes('/s/')) return url;

  try {
    const response = await proxyFetch(url, {
      redirect: 'follow',
      headers: { 
        'User-Agent': REDDIT_USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    return response.url;
  } catch {
    return url;
  }
}

// Fetch post data and comments from Reddit
export async function fetchRedditPost(url: string, ourPostId?: string): Promise<{
  postData: Partial<RedditPost>;
  comments: RedditComment[];
} | null> {
  try {
    // Resolve short URLs first
    const resolvedUrl = await resolveShortUrl(url);

    // Convert to JSON API URL
    // Clean URL: remove query parameters and trailing slashes, then append .json
    let cleanUrl = resolvedUrl.split('?')[0].replace(/\/$/, '');
    const jsonUrl = cleanUrl + '.json';
    console.log(`[Reddit] Fetching: ${jsonUrl}`);

    // 添加超时控制（30秒）
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await proxyFetch(jsonUrl, {
      headers: {
        'User-Agent': REDDIT_USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      // If rate limited (429), wait longer and retry up to 3 times
      if (response.status === 429) {
        let retries = 0;
        const maxRetries = 3;
        while (retries < maxRetries) {
          const waitTime = (retries + 1) * 15000; // 15s, 30s, 45s
          console.warn(`[Reddit] Rate limited (429), waiting ${waitTime/1000}s before retry ${retries + 1}/${maxRetries}...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          const retryResponse = await proxyFetch(jsonUrl, {
            headers: {
              'User-Agent': REDDIT_USER_AGENT,
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.9',
              'Accept-Encoding': 'gzip, deflate, br',
              'Connection': 'keep-alive',
              'Upgrade-Insecure-Requests': '1',
              'Sec-Fetch-Dest': 'document',
              'Sec-Fetch-Mode': 'navigate',
              'Sec-Fetch-Site': 'none',
              'Sec-Fetch-User': '?1',
            },
          });
          if (retryResponse.ok) {
            const retryData = await retryResponse.json();
            if (!Array.isArray(retryData) || retryData.length < 2) return null;
            const retryPostData = extractPostData(retryData[0]);
            const retryComments = extractComments(retryData[1], ourPostId || retryPostData.id || '');
            return { postData: retryPostData, comments: retryComments };
          }
          retries++;
        }
        console.error(`[Reddit] Rate limited after ${maxRetries} retries for ${url}`);
        return null;
      }
      console.error(`Reddit API returned ${response.status} for ${url}`);
      return null;
    }

    const data = await response.json();

    if (!Array.isArray(data) || data.length < 2) {
      return null;
    }

    // Extract post data
    const postListing = data[0];
    const postData = extractPostData(postListing);

    // Extract comments - use our post ID instead of Reddit's internal ID
    const commentListing = data[1];
    const comments = extractComments(commentListing, ourPostId || postData.id || '');

    return { postData, comments };
  } catch (error: any) {
    // 处理超时错误
    if (error.name === 'AbortError') {
      console.error(`[Reddit] Timeout fetching post ${url} (30s)`);
    } else {
      console.error(`Error fetching Reddit post ${url}:`, error);
    }
    return null;
  }
}

function extractPostData(listing: any): Partial<RedditPost> {
  try {
    const child = listing?.data?.children?.[0]?.data;
    if (!child) return {};

    return {
      id: child.id,
      title: child.title || '',
      author: child.author || '[deleted]',
      score: child.score || 0,
      commentCount: child.num_comments || 0,
      subreddit: child.subreddit || '',
      thumbnailUrl: child.thumbnail?.startsWith('http') ? child.thumbnail : undefined,
      createdAt: new Date(child.created_utc * 1000).toISOString(),
    };
  } catch {
    return {};
  }
}

function extractComments(listing: any, postId: string, depth = 0): RedditComment[] {
  const comments: RedditComment[] = [];

  try {
    const children = listing?.data?.children || [];

    for (const child of children) {
      if (child.kind !== 't1') continue; // Skip non-comment items

      const data: RedditCommentData = child.data;
      if (!data || data.body === '[deleted]' || data.body === '[removed]') continue;

      const comment: RedditComment = {
        id: data.id,
        postId,
        author: data.author || '[deleted]',
        body: data.body,
        score: data.score || 0,
        createdAt: new Date(data.created_utc * 1000).toISOString(),
        sentimentScore: 0,
        isFlagged: false,
        flagReasons: [],
        permalink: `https://www.reddit.com${data.permalink}`,
      };

      // Recursively extract replies (limit depth)
      if (data.replies && typeof data.replies === 'object' && depth < 3) {
        comment.replies = extractComments(data.replies, postId, depth + 1);
      }

      comments.push(comment);
    }
  } catch (error) {
    console.error('Error extracting comments:', error);
  }

  return comments;
}

// Fetch multiple posts in sequence (with rate limiting)
export async function fetchMultiplePosts(
  posts: RedditPost[],
  onProgress?: (current: number, total: number, postId: string) => void
): Promise<Map<string, { postData: Partial<RedditPost>; comments: RedditComment[] }>> {
  const results = new Map<string, { postData: Partial<RedditPost>; comments: RedditComment[] }>();

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];

    if (onProgress) {
      onProgress(i + 1, posts.length, post.id);
    }

    try {
      const result = await fetchRedditPost(post.redditUrl);
      if (result) {
        results.set(post.id, result);
      }
    } catch (error) {
      console.error(`Failed to fetch post ${post.id}:`, error);
    }

    // Rate limiting: wait 2 seconds between requests
    if (i < posts.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  return results;
}

// Fetch posts from a subreddit (using public API)
export interface SubredditPost {
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

export async function fetchSubredditPosts(
  subreddit: string,
  limit: number = 100,
  sort: 'hot' | 'new' | 'top' = 'hot'
): Promise<SubredditPost[]> {
  try {
    const url = `https://www.reddit.com/r/${subreddit}/${sort}.json?limit=${limit}`;
    console.log(`[Reddit] Fetching ${sort} posts from r/${subreddit}: ${url}`);

    let response: any;
    
    // 使用 undici setGlobalDispatcher 设置的全局代理（所有环境统一走 Decodo 住宅代理）
    const proxyUrl = getProxyUrl();
    if (proxyUrl) {
      console.log(`[Reddit] Using proxy (global dispatcher)`);
    }
    
    response = await proxyFetch(url, {
      headers: {
        'User-Agent': REDDIT_USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
      },
    });

    if (!response.ok) {
      console.error(`[Reddit] Failed to fetch subreddit posts: ${response.status} ${response.statusText}`);
      return [];
    }

    const data = await response.json() as any;
    const posts: SubredditPost[] = [];

    if (data?.data?.children) {
      for (const child of data.data.children) {
        if (child.kind === 't3') { // t3 = post
          const post = child.data;
          posts.push({
            id: post.id,
            title: post.title || '',
            author: post.author || '[deleted]',
            score: post.score || 0,
            commentCount: post.num_comments || 0,
            subreddit: post.subreddit || subreddit,
            createdAt: new Date(post.created_utc * 1000).toISOString(),
            permalink: `https://www.reddit.com${post.permalink}`,
            selftext: post.selftext || '',
          });
        }
      }
    }

    console.log(`[Reddit] Fetched ${posts.length} posts from r/${subreddit}`);
    return posts;
  } catch (error) {
    console.error(`[Reddit] Error fetching subreddit posts:`, error);
    return [];
  }
}

// Randomly select N posts from array
export function selectRandomPosts<T>(posts: T[], count: number): T[] {
  if (posts.length <= count) return posts;
  
  const shuffled = [...posts].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}
