import { NextRequest, NextResponse } from 'next/server';
import { fetchSearchViaApify } from '@/lib/apify';
import { getPosts, savePosts } from '@/lib/store';
import { RedditPost } from '@/lib/types';

// POST /api/reddit-search  ——  按关键词搜索 Reddit 帖子
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { keywords, subreddit, limit, timeframe } = body as {
      keywords: string[];
      subreddit?: string;
      limit?: number;
      timeframe?: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
    };

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0 || keywords.every(k => !k.trim())) {
      return NextResponse.json(
        { success: false, message: '请至少输入一个关键词' },
        { status: 400 }
      );
    }

    const cleanKeywords = keywords.map(k => k.trim()).filter(Boolean);
    const cleanSubreddit = (subreddit || '').trim().replace(/^r\//, '');
    const safeLimit = Math.min(Math.max(Number(limit) || 25, 1), 100);
    const safeTimeframe = timeframe || 'month';

    console.log(`[RedditSearch] keywords=${JSON.stringify(cleanKeywords)} subreddit=${cleanSubreddit || '(global)'} limit=${safeLimit} timeframe=${safeTimeframe}`);

    const posts = await fetchSearchViaApify(cleanSubreddit, cleanKeywords, safeLimit, safeTimeframe);

    return NextResponse.json({
      success: true,
      count: posts.length,
      posts,
    });
  } catch (error: any) {
    console.error('[RedditSearch] Error:', error);
    return NextResponse.json(
      { success: false, message: error.message || '搜索失败' },
      { status: 500 }
    );
  }
}

// PUT /api/reddit-search  ——  把搜索结果导入帖子管理
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { posts } = body as {
      posts: Array<{
        id: string;
        title: string;
        author: string;
        score: number;
        commentCount: number;
        subreddit: string;
        createdAt: string;
        permalink: string;
        selftext?: string;
      }>;
    };

    if (!posts || !Array.isArray(posts) || posts.length === 0) {
      return NextResponse.json(
        { success: false, message: '没有可导入的帖子' },
        { status: 400 }
      );
    }

    const existing = getPosts();
    const existingIds = new Set(existing.map(p => p.id));

    const newPosts: RedditPost[] = [];
    let skipped = 0;
    for (const p of posts) {
      if (!p.id || !p.title) continue;
      if (existingIds.has(p.id)) {
        skipped++;
        continue;
      }
      newPosts.push({
        id: p.id,
        redditUrl: p.permalink.startsWith('http') ? p.permalink : `https://www.reddit.com${p.permalink}`,
        title: p.title,
        subreddit: p.subreddit || '',
        author: p.author || '[deleted]',
        score: Number(p.score) || 0,
        commentCount: Number(p.commentCount) || 0,
        createdAt: p.createdAt || new Date().toISOString(),
        lastScanned: null,
        alertLevel: 'safe',
        alertReasons: [],
        summary: p.selftext ? p.selftext.slice(0, 400) : undefined,
      });
    }

    if (newPosts.length > 0) {
      savePosts([...existing, ...newPosts]);
    }

    return NextResponse.json({
      success: true,
      imported: newPosts.length,
      skipped,
      message: `成功导入 ${newPosts.length} 个帖子${skipped > 0 ? `，跳过 ${skipped} 个已存在` : ''}`,
    });
  } catch (error: any) {
    console.error('[RedditSearch] Import error:', error);
    return NextResponse.json(
      { success: false, message: error.message || '导入失败' },
      { status: 500 }
    );
  }
}
