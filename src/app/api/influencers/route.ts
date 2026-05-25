import { NextResponse } from 'next/server';
import { getComments } from '@/lib/store';

export async function GET() {
  const comments = getComments();

  // Aggregate by author
  const authorMap = new Map<string, {
    author: string;
    totalComments: number;
    totalScore: number;
    flaggedCount: number;
    mostNegativeScore: number;
    mostNegativeBody: string;
  }>();

  for (const c of comments) {
    const key = c.author || '[deleted]';
    const existing = authorMap.get(key) || {
      author: key,
      totalComments: 0,
      totalScore: 0,
      flaggedCount: 0,
      mostNegativeScore: 0,
      mostNegativeBody: '',
    };

    existing.totalComments++;
    existing.totalScore += c.score;
    if (c.isFlagged) existing.flaggedCount++;
    if (c.sentimentScore < existing.mostNegativeScore) {
      existing.mostNegativeScore = c.sentimentScore;
      existing.mostNegativeBody = c.body;
    }

    authorMap.set(key, existing);
  }

  // Calculate influence score and sort
  const influencers = Array.from(authorMap.values())
    .filter(a => a.totalComments >= 1)
    .map(a => {
      const avgScore = a.totalComments > 0 ? a.totalScore / a.totalComments : 0;
      // Influence = comment volume (primary) + capped upvote reach + negative risk weight
      // Use totalScore with cap to prevent single viral comment from dominating
      const influenceScore = Math.round(
        a.totalComments * 5 +
        Math.min(Math.max(0, a.totalScore), 100) +
        a.flaggedCount * 15
      );
      return {
        author: a.author,
        totalComments: a.totalComments,
        avgScore: Math.round(avgScore * 10) / 10,
        flaggedCount: a.flaggedCount,
        topNegativeComment: a.mostNegativeBody.length > 150
          ? a.mostNegativeBody.slice(0, 150) + '...'
          : a.mostNegativeBody,
        influenceScore,
      };
    })
    .sort((a, b) => b.influenceScore - a.influenceScore);

  return NextResponse.json({ influencers: influencers.slice(0, 50) });
}
