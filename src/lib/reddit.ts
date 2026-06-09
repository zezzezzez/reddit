// Reddit API Integration
// Fetches comments from Reddit posts
// 数据源: 仅使用 Apify

import { RedditComment, RedditPost } from './types';

// Apify 集成
import { isApifyConfigured, fetchPostViaApify, fetchSubredditViaApify } from './apify';

// Fetch post data and comments from Reddit (仅使用 Apify)
export async function fetchRedditPost(url: string, ourPostId?: string): Promise<{
  postData: Partial<RedditPost>;
  comments: RedditComment[];
} | null> {
  if (!isApifyConfigured()) {
    console.error('[Reddit] Apify is not configured. Please set APIFY_TOKEN environment variable.');
    return null;
  }

  console.log(`[Reddit] Fetching via Apify: ${url}`);
  const result = await fetchPostViaApify(url, ourPostId);
  if (result) {
    console.log(`[Reddit] Apify success for: ${url}`);
    return result;
  }
  console.warn(`[Reddit] Apify returned no data for: ${url}`);
  return null;
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

// Fetch posts from a subreddit (仅使用 Apify)
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
  if (!isApifyConfigured()) {
    console.error('[Reddit] Apify is not configured. Please set APIFY_TOKEN environment variable.');
    return [];
  }

  console.log(`[Reddit] Fetching ${sort} posts from r/${subreddit} via Apify`);
  const apifyPosts = await fetchSubredditViaApify(subreddit, limit, sort);
  console.log(`[Reddit] Apify returned ${apifyPosts.length} posts for r/${subreddit}`);
  return apifyPosts;
}

// Randomly select N posts from array
export function selectRandomPosts<T>(posts: T[], count: number): T[] {
  if (posts.length <= count) return posts;
  
  const shuffled = [...posts].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}
