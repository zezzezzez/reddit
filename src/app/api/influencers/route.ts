import { NextResponse } from 'next/server';
import { getPosts, getComments } from '@/lib/store';
import { calcCommentInfluenceScore } from '@/lib/sentiment';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const subreddit = searchParams.get('subreddit') || '';
  const keyword = searchParams.get('keyword') || '';
  const author = searchParams.get('author') || '';
  const commentDateFrom = searchParams.get('commentDateFrom') || '';
  const commentDateTo = searchParams.get('commentDateTo') || '';
  const postDateFrom = searchParams.get('postDateFrom') || '';
  const postDateTo = searchParams.get('postDateTo') || '';

  const posts = getPosts();
  const allComments = getComments();

  // Build post lookup map
  const postMap = new Map<string, any>();
  posts.forEach(p => postMap.set(p.id, p));

  // Flatten all comments (including replies)
  function flattenComments(comments: any[]): any[] {
    const result: any[] = [];
    for (const c of comments) {
      result.push(c);
      if (c.replies && Array.isArray(c.replies)) {
        result.push(...flattenComments(c.replies));
      }
    }
    return result;
  }

  // Get all flagged comments with post info
  let flaggedComments: any[] = [];
  for (const post of posts) {
    const postComments = allComments.filter(c => c.postId === post.id);
    const flatComments = flattenComments(postComments);
    const flagged = flatComments.filter(c => c.isFlagged);
    
    for (const c of flagged) {
      const influenceScore = calcCommentInfluenceScore(c.score, c.sentimentScore);
      flaggedComments.push({
        ...c,
        postId: post.id,
        postTitle: post.title,
        subreddit: post.subreddit,
        postCreatedAt: post.createdAt,
        postUrl: post.redditUrl,
        influenceScore,
      });
    }
  }

  // Apply filters
  if (subreddit) {
    flaggedComments = flaggedComments.filter(c => 
      c.subreddit.toLowerCase().includes(subreddit.toLowerCase())
    );
  }
  
  if (keyword) {
    const kw = keyword.toLowerCase();
    flaggedComments = flaggedComments.filter(c => 
      c.body.toLowerCase().includes(kw) ||
      c.postTitle.toLowerCase().includes(kw)
    );
  }

  if (author) {
    const authorLower = author.toLowerCase();
    flaggedComments = flaggedComments.filter(c => 
      c.author.toLowerCase().includes(authorLower)
    );
  }

  if (commentDateFrom) {
    const from = new Date(commentDateFrom);
    from.setHours(0, 0, 0, 0);
    flaggedComments = flaggedComments.filter(c => new Date(c.createdAt) >= from);
  }
  if (commentDateTo) {
    const to = new Date(commentDateTo);
    to.setHours(23, 59, 59, 999);
    flaggedComments = flaggedComments.filter(c => new Date(c.createdAt) <= to);
  }

  if (postDateFrom) {
    const from = new Date(postDateFrom);
    from.setHours(0, 0, 0, 0);
    flaggedComments = flaggedComments.filter(c => new Date(c.postCreatedAt) >= from);
  }
  if (postDateTo) {
    const to = new Date(postDateTo);
    to.setHours(23, 59, 59, 999);
    flaggedComments = flaggedComments.filter(c => new Date(c.postCreatedAt) <= to);
  }

  // Sort by influence score (descending)
  flaggedComments.sort((a, b) => b.influenceScore - a.influenceScore);

  // Get unique subreddits for filter
  const subreddits = [...new Set(posts.map(p => p.subreddit))].sort();

  return NextResponse.json({ 
    comments: flaggedComments,
    total: flaggedComments.length,
    subreddits,
  });
}
