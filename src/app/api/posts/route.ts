import { NextResponse } from 'next/server';
import { getPosts, getComments } from '@/lib/store';
import { mockPosts, mockComments } from '@/lib/mock-data';

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

    const { posts: allPosts, useMock } = getDataSources();
    let posts = [...allPosts];

    // Filter by alert level
    if (level && level !== 'all') {
      posts = posts.filter(p => p.alertLevel === level);
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
      };
    });

    return NextResponse.json({ posts: postsWithStats, total: postsWithStats.length });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 });
  }
}
