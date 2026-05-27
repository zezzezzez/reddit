import { NextResponse } from 'next/server';
import { getPosts, getComments } from '@/lib/store';
import { calcCommentInfluenceScore } from '@/lib/sentiment';
import { CONTROLLED_VOCAB, KEYWORD_CATEGORIES } from '@/lib/summary';

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
          influenceScore: Math.round(totalInfluenceScore),
          maliciousComments: flaggedComments.map(c => ({
            id: c.id,
            author: c.author,
            body: c.body,
            score: c.score,
            sentimentScore: c.sentimentScore,
            influenceScore: Math.round(calcCommentInfluenceScore(c.score, c.sentimentScore)),
            flagReasons: c.flagReasons,
            permalink: c.permalink,
          })),
        });
      }
    }

    // Sort by influence score (highest first)
    postsWithMaliciousComments.sort((a, b) => b.influenceScore - a.influenceScore);

    // Count keywords using controlled vocab
    const keywordCount: Record<string, { count: number; category: string }> = {};

    // Initialize all controlled vocab keywords
    for (const [category, vocabData] of Object.entries(KEYWORD_CATEGORIES)) {
      for (const kw of vocabData.keywords) {
        keywordCount[kw] = { count: 0, category: vocabData.label };
      }
    }

    // Count occurrences in comments
    for (const post of filteredPosts) {
      const comments = getComments(post.id);
      
      for (const comment of comments) {
        const text = comment.body.toLowerCase();
        
        // Match against controlled vocab
        for (const [label, keywords] of Object.entries(CONTROLLED_VOCAB)) {
          for (const kw of keywords) {
            if (text.includes(kw.toLowerCase())) {
              if (!keywordCount[label]) {
                keywordCount[label] = { count: 0, category: getCategoryForLabel(label) };
              }
              keywordCount[label].count++;
            }
          }
        }
      }
    }

    // Convert to array, filter zero counts, sort by count
    const keywords = Object.entries(keywordCount)
      .filter(([_, data]) => data.count > 0)
      .map(([word, data]) => ({
        word,
        count: data.count,
        category: data.category,
      }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      posts: postsWithMaliciousComments,
      keywords,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function getCategoryForLabel(label: string): string {
  for (const [category, data] of Object.entries(KEYWORD_CATEGORIES)) {
    if (data.keywords.includes(label)) {
      return data.label;
    }
  }
  return '其他';
}
