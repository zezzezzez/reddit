import { NextResponse } from 'next/server';
import { getPosts, getComments } from '@/lib/store';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const subreddit = searchParams.get('subreddit');

    const posts = getPosts();
    
    // Filter posts by subreddit if specified
    let filteredPosts = subreddit 
      ? posts.filter(p => p.subreddit === subreddit)
      : posts;

    // Get all comments from these posts
    const allComments: any[] = [];
    filteredPosts.forEach(post => {
      const comments = getComments(post.id);
      allComments.push(...comments);
    });

    // Extract keywords from summaries and count occurrences
    const keywordCount: Record<string, { count: number; category: string }> = {};

    allComments.forEach(comment => {
      if (comment.summary) {
        // Simple keyword extraction from summary
        const words = comment.summary.split(/[\s,，、;；]+/);
        words.forEach((word: string) => {
          const cleanWord = word.trim().toLowerCase();
          if (cleanWord.length > 1) {
            if (!keywordCount[cleanWord]) {
              keywordCount[cleanWord] = { count: 0, category: 'general' };
            }
            keywordCount[cleanWord].count++;
          }
        });
      }
    });

    // Convert to array and sort by count
    const keywords = Object.entries(keywordCount)
      .map(([keyword, data]) => ({
        keyword,
        count: data.count,
        category: data.category,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20); // Top 20 keywords

    return NextResponse.json({ keywords });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
