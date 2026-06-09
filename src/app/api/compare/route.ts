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
    const flagged = subComments.filter(c => c.isFlagged).length;

    const positiveRate = total > 0 ? Math.round(positive / total * 1000) / 10 : 0;
    const neutralRate = total > 0 ? Math.round(neutral / total * 1000) / 10 : 0;
    const negativeRate = total > 0 ? Math.round(negative / total * 1000) / 10 : 0;

    // Health score: consistent with dashboard calculation
    // Factors: post alert levels + flagged comment ratio
    const criticalPosts = subPosts.filter(p => p.alertLevel === 'critical').length;
    const mediumPosts = subPosts.filter(p => p.alertLevel === 'medium').length;
    const flaggedRatio = total > 0 ? (flagged / total * 100) : 0;

    const criticalPenalty = criticalPosts * 4;
    const mediumPenalty = mediumPosts * 1.5;
    const flaggedPenalty = flaggedRatio * 0.5;

    let healthScore = Math.max(0, Math.round(100 - Math.min(criticalPenalty, 60) - Math.min(mediumPenalty, 25) - Math.min(flaggedPenalty, 15)));
    healthScore = Math.min(100, Math.max(0, healthScore));

    return {
      subreddit: sub.subreddit,
      totalPosts: subPosts.length,
      totalComments: total,
      positiveRate,
      neutralRate,
      negativeRate,
      flaggedComments: flagged,
      criticalPosts,
      mediumPosts,
      topKeywords: [] as string[],
      healthScore,
    };
  }).sort((a, b) => b.totalComments - a.totalComments);

  return NextResponse.json({ subreddits: stats });
}
