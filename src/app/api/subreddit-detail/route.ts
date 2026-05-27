import { NextResponse } from 'next/server';
import { getPosts, getComments } from '@/lib/store';
import { calcCommentInfluenceScore } from '@/lib/sentiment';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const subreddit = searchParams.get('subreddit');

    const posts = getPosts();
    
    // Filter posts by subreddit
    const filteredPosts = subreddit 
      ? posts.filter(p => p.subreddit === subreddit)
      : posts;

    // Get posts with flagged comments
    const postsWithMaliciousComments: any[] = [];

    for (const post of filteredPosts) {
      const comments = getComments(post.id);
      const flaggedComments = comments.filter(c => c.isFlagged);

      if (flaggedComments.length > 0) {
        // Calculate total influence score
        const totalInfluenceScore = flaggedComments.reduce(
          (sum, c) => sum + calcCommentInfluenceScore(c.score, c.sentimentScore), 0
        );

        postsWithMaliciousComments.push({
          id: post.id,
          title: post.title,
          redditUrl: post.redditUrl,
          alertLevel: post.alertLevel,
          commentCount: post.commentCount,
          flaggedCommentCount: flaggedComments.length,
          influenceScore: parseFloat(totalInfluenceScore.toFixed(2)),
          maliciousComments: flaggedComments.map(c => ({
            id: c.id,
            author: c.author,
            body: c.body,
            score: c.score,
            sentimentScore: c.sentimentScore,
            influenceScore: parseFloat(calcCommentInfluenceScore(c.score, c.sentimentScore).toFixed(2)),
            flagReasons: c.flagReasons,
            permalink: c.permalink,
          })),
        });
      }
    }

    // Sort by influence score (highest first)
    postsWithMaliciousComments.sort((a, b) => b.influenceScore - a.influenceScore);

    return NextResponse.json({
      posts: postsWithMaliciousComments,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

