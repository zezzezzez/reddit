import { NextResponse } from 'next/server';
import { getPosts, getComments, savePosts, deletePost, deleteComments, deleteScanResults } from '@/lib/store';
import { mockPosts, mockComments } from '@/lib/mock-data';
import { calcCommentInfluenceScore } from '@/lib/sentiment';

function getDataSources() {
  const storePosts = getPosts();
  const useMock = storePosts.length === 0;
  const posts = useMock ? mockPosts : storePosts;
  return { posts, useMock };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const level = searchParams.get('level');
    const search = searchParams.get('search');
    const sort = searchParams.get('sort') || 'alert';
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const subreddit = searchParams.get('subreddit');

    const { posts: allPosts, useMock } = getDataSources();
    let posts = [...allPosts];

    // Pre-calculate influence score for sorting (attach temporarily)
    posts.forEach(post => {
      let comments;
      if (useMock) {
        comments = mockComments[post.id] || [];
      } else {
        comments = getComments(post.id);
      }
      const allFlagged = comments.filter(c => c.isFlagged);
      (post as any)._totalInfluenceScore = allFlagged.reduce(
        (sum, c) => sum + calcCommentInfluenceScore(c.score, c.sentimentScore), 0
      );
    });

    // Filter by alert level (兼容旧数据 high/low)
    if (level && level !== 'all') {
      const levelMap: Record<string, string[]> = {
        critical: ['critical', 'high'],
        medium: ['medium'],
        safe: ['safe', 'low'],
      };
      const allowedLevels = levelMap[level] || [level];
      posts = posts.filter(p => allowedLevels.includes(p.alertLevel));
    }

    // Filter by date range
    if (dateFrom) {
      const from = new Date(dateFrom);
      from.setHours(0, 0, 0, 0);
      posts = posts.filter(p => new Date(p.createdAt) >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      posts = posts.filter(p => new Date(p.createdAt) <= to);
    }

    // Filter by subreddit
    if (subreddit) {
      posts = posts.filter(p => p.subreddit === subreddit);
    }

    // Search
    if (search) {
      const q = search.toLowerCase();
      posts = posts.filter(p =>
        p.title.toLowerCase().includes(q) ||
        p.subreddit.toLowerCase().includes(q) ||
        p.redditUrl.toLowerCase().includes(q)
      );
    }

    // Sort
    switch (sort) {
      case 'alert':
        const alertOrder = { critical: 0, high: 1, medium: 2, low: 3, safe: 4 };
        posts.sort((a, b) => alertOrder[a.alertLevel] - alertOrder[b.alertLevel]);
        break;
      case 'date':
        posts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'comments':
        posts.sort((a, b) => b.commentCount - a.commentCount);
        break;
      case 'influence':
        posts.sort((a, b) => ((b as any)._totalInfluenceScore || 0) - ((a as any)._totalInfluenceScore || 0));
        break;
      case 'negative':
        // 按负面占比排序（恶意评论数 / 总评论数）
        posts.sort((a, b) => {
          const aComments = useMock ? mockComments[a.id] || [] : getComments(a.id);
          const bComments = useMock ? mockComments[b.id] || [] : getComments(b.id);
          const aNegativeRatio = aComments.length > 0 ? aComments.filter(c => c.isFlagged).length / aComments.length : 0;
          const bNegativeRatio = bComments.length > 0 ? bComments.filter(c => c.isFlagged).length / bComments.length : 0;
          return bNegativeRatio - aNegativeRatio; // 负面占比高的排前面
        });
        break;
    }

    // Add comment stats for each post
    const postsWithStats = posts.map(post => {
      let comments;
      if (useMock) {
        comments = mockComments[post.id] || [];
      } else {
        comments = getComments(post.id);
      }
      const flagged = comments.filter(c => c.isFlagged).length;
      return {
        ...post,
        totalCommentsFetched: comments.length,
        flaggedComments: flagged,
        flaggedRatio: comments.length > 0 ? (flagged / comments.length * 100).toFixed(0) : '0',
        totalInfluenceScore: parseFloat(((post as any)._totalInfluenceScore || 0).toFixed(2)),
      };
    });

    return NextResponse.json({ posts: postsWithStats, total: postsWithStats.length });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { postId } = body;

    if (!postId) {
      return NextResponse.json({ success: false, message: '缺少帖子 ID' }, { status: 400 });
    }

    // 删除帖子
    deletePost(postId);
    
    // 删除相关评论
    deleteComments(postId);
    
    // 删除相关扫描记录
    deleteScanResults(postId);

    return NextResponse.json({ success: true, message: '帖子已删除' });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message || '删除失败' }, { status: 500 });
  }
}
