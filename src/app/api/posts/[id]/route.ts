import { NextResponse } from 'next/server';
import { getPosts, getPostById, getComments } from '@/lib/store';
import { mockPosts, mockComments } from '@/lib/mock-data';
import { RedditComment } from '@/lib/types';
import { calcCommentInfluenceScore } from '@/lib/sentiment';

// Flatten nested comments (with replies) into a single list for accurate counting
function flattenAllComments(comments: RedditComment[]): RedditComment[] {
  const result: RedditComment[] = [];
  for (const c of comments) {
    result.push(c);
    if (c.replies && Array.isArray(c.replies)) {
      result.push(...flattenAllComments(c.replies));
    }
  }
  return result;
}

// 为评论树中的每条评论注入影响力得分
function injectInfluenceScore(comments: RedditComment[]): RedditComment[] {
  return comments.map(c => ({
    ...c,
    influenceScore: c.isFlagged
      ? calcCommentInfluenceScore(c.score, c.sentimentScore)
      : undefined,
    replies: c.replies ? injectInfluenceScore(c.replies) : undefined,
  }));
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Try store first, fallback to mock
    const storePosts = getPosts();
    const useMock = storePosts.length === 0;

    let post;
    let comments;

    if (useMock) {
      post = mockPosts.find(p => p.id === id);
      comments = mockComments[id] || [];
    } else {
      post = getPostById(id);
      comments = getComments(id);
    }

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // Flatten all comments including replies for accurate counts
    const allComments = flattenAllComments(comments);
    // 恶意判定与 UI 标红一致：命中硬性关键词 或 情感得分 < 0 均视为恶意
    const isCommentNegative = (c: any) => c.isFlagged || (c.sentimentScore ?? 0) < 0;
    const flaggedComments = allComments.filter(isCommentNegative);

    // Sentiment summary (using ALL comments including replies) — 严格按零分界
    const positive = allComments.filter(c => c.sentimentScore > 0).length;
    const neutral = allComments.filter(c => c.sentimentScore === 0).length;
    const negative = allComments.filter(c => c.sentimentScore < 0).length;

    // Category breakdown
    const categoryCount: Record<string, number> = {};
    flaggedComments.forEach(c => {
      c.flagReasons.forEach(r => {
        categoryCount[r] = (categoryCount[r] || 0) + 1;
      });
    });

    return NextResponse.json({
      post,
      comments: injectInfluenceScore(comments).sort((a, b) => {
        // 恶意（score < 0）置顶；同类内越负越靠前，其余按点赞高的靠前
        const aNeg = isCommentNegative(a) ? 1 : 0;
        const bNeg = isCommentNegative(b) ? 1 : 0;
        if (aNeg !== bNeg) return bNeg - aNeg;
        if (aNeg === 1) return (a.sentimentScore ?? 0) - (b.sentimentScore ?? 0);
        return b.score - a.score;
      }),
      summary: {
        total: allComments.length,
        flagged: flaggedComments.length,
        positive,
        neutral,
        negative,
        categories: categoryCount,
        avgSentiment: allComments.length > 0
          ? (allComments.reduce((sum, c) => sum + c.sentimentScore, 0) / allComments.length).toFixed(2)
          : '0',
        totalInfluenceScore: parseFloat(
          flaggedComments.reduce((sum, c) => sum + calcCommentInfluenceScore(c.score, c.sentimentScore), 0).toFixed(2)
        ),
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch post detail' }, { status: 500 });
  }
}
