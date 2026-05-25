import { NextResponse } from 'next/server';
import { getPosts, getComments } from '@/lib/store';

export async function GET() {
  const posts = getPosts();
  const comments = getComments();

  // Group posts by subreddit
  const subreddits = new Map<string, {
    subreddit: string;
    postIds: string[];
  }>();

  for (const p of posts) {
    const sub = p.subreddit || 'unknown';
    if (!subreddits.has(sub)) {
      subreddits.set(sub, { subreddit: sub, postIds: [] });
    }
    subreddits.get(sub)!.postIds.push(p.id);
  }

  const stats = Array.from(subreddits.values()).map(sub => {
    const subPosts = posts.filter(p => p.subreddit === sub.subreddit);
    const subComments = comments.filter(c =>
      subPosts.some(p => p.id === c.postId)
    );

    const total = subComments.length;
    const positive = subComments.filter(c => c.sentimentScore > 0.1).length;
    const neutral = subComments.filter(c => c.sentimentScore >= -0.1 && c.sentimentScore <= 0.1).length;
    const negative = subComments.filter(c => c.sentimentScore < -0.1).length;

    const positiveRate = total > 0 ? Math.round(positive / total * 1000) / 10 : 0;
    const neutralRate = total > 0 ? Math.round(neutral / total * 1000) / 10 : 0;
    const negativeRate = total > 0 ? Math.round(negative / total * 1000) / 10 : 0;

    // Simple health score for this subreddit
    const healthScore = total > 0
      ? Math.max(0, Math.min(100, Math.round(100 - negativeRate * 0.6 - (total > 0 ? (negative / total * 100 * 0.4) : 0))))
      : 100;

    return {
      subreddit: sub.subreddit,
      totalPosts: subPosts.length,
      totalComments: total,
      positiveRate,
      neutralRate,
      negativeRate,
      topKeywords: [] as string[],
      healthScore,
    };
  }).sort((a, b) => b.totalComments - a.totalComments);

  return NextResponse.json({ subreddits: stats });
}
