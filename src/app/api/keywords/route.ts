import { NextResponse } from 'next/server';
import { getPosts, getComments } from '@/lib/store';
import { CONTROLLED_VOCAB, KEYWORD_CATEGORIES } from '@/lib/summary';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const subreddit = searchParams.get('subreddit') || '';
  const keywordFilter = searchParams.get('keyword') || '';
  const commentDateFrom = searchParams.get('commentDateFrom') || '';
  const commentDateTo = searchParams.get('commentDateTo') || '';
  const postDateFrom = searchParams.get('postDateFrom') || '';
  const postDateTo = searchParams.get('postDateTo') || '';
  
  // 分类筛选参数（逗号分隔的关键词列表）
  const brandKeywords = searchParams.get('brandKeywords') || '';
  const sceneKeywords = searchParams.get('sceneKeywords') || '';
  const modelKeywords = searchParams.get('modelKeywords') || '';
  const qualityKeywords = searchParams.get('qualityKeywords') || '';

  const posts = getPosts();
  const allComments = getComments();

  // Build post lookup
  const postMap = new Map<string, any>();
  posts.forEach(p => postMap.set(p.id, p));

  // Flatten comments
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

  // Filter posts by subreddit and date
  let filteredPosts = posts;
  if (subreddit) {
    filteredPosts = filteredPosts.filter(p => 
      p.subreddit.toLowerCase().includes(subreddit.toLowerCase())
    );
  }
  if (postDateFrom) {
    const from = new Date(postDateFrom);
    from.setHours(0, 0, 0, 0);
    filteredPosts = filteredPosts.filter(p => new Date(p.createdAt) >= from);
  }
  if (postDateTo) {
    const to = new Date(postDateTo);
    to.setHours(23, 59, 59, 999);
    filteredPosts = filteredPosts.filter(p => new Date(p.createdAt) <= to);
  }

  const filteredPostIds = new Set(filteredPosts.map(p => p.id));

  // Collect all comments from filtered posts
  let comments: any[] = [];
  for (const post of filteredPosts) {
    const postComments = allComments.filter(c => c.postId === post.id);
    comments.push(...flattenComments(postComments));
  }

  // Filter comments by date
  if (commentDateFrom) {
    const from = new Date(commentDateFrom);
    from.setHours(0, 0, 0, 0);
    comments = comments.filter(c => new Date(c.createdAt) >= from);
  }
  if (commentDateTo) {
    const to = new Date(commentDateTo);
    to.setHours(23, 59, 59, 999);
    comments = comments.filter(c => new Date(c.createdAt) <= to);
  }

  // Count keyword frequencies using CONTROLLED_VOCAB
  const keywordCount: Record<string, number> = {};
  
  // Initialize all keywords with 0
  for (const label of Object.keys(CONTROLLED_VOCAB)) {
    keywordCount[label] = 0;
  }

  // Count occurrences
  for (const c of comments) {
    const lower = c.body.toLowerCase();
    const titleLower = (c.postTitle || '').toLowerCase();
    const text = lower + ' ' + titleLower;

    // Check each controlled vocab keyword
    const matchedLabels = new Set<string>();
    for (const [label, keywords] of Object.entries(CONTROLLED_VOCAB)) {
      for (const kw of keywords) {
        if (text.includes(kw)) {
          matchedLabels.add(label);
          break; // One match per label per comment
        }
      }
    }

    // Increment count for each matched label
    for (const label of matchedLabels) {
      keywordCount[label]++;
    }
  }

  // Convert to array and sort by count
  let keywords = Object.entries(keywordCount)
    .map(([word, count]) => ({ word, count }))
    .filter(k => k.count > 0);

  // 应用分类筛选（如果任一分类有选中，则只显示选中的关键词）
  const selectedKeywords = new Set<string>();
  if (brandKeywords) brandKeywords.split(',').forEach(k => selectedKeywords.add(k));
  if (sceneKeywords) sceneKeywords.split(',').forEach(k => selectedKeywords.add(k));
  if (modelKeywords) modelKeywords.split(',').forEach(k => selectedKeywords.add(k));
  if (qualityKeywords) qualityKeywords.split(',').forEach(k => selectedKeywords.add(k));

  if (selectedKeywords.size > 0) {
    keywords = keywords.filter(k => selectedKeywords.has(k.word));
  }

  // Filter by keyword search
  if (keywordFilter) {
    const kw = keywordFilter.toLowerCase();
    keywords = keywords.filter(k => k.word.toLowerCase().includes(kw));
  }

  // Sort by count
  keywords.sort((a, b) => b.count - a.count);

  // 动态构建分类信息（只包含实际出现的关键词）
  const dynamicCategories: Record<string, string[]> = {};
  for (const [catKey, catInfo] of Object.entries(KEYWORD_CATEGORIES)) {
    // 只保留实际有数据的关键词
    const appearedKeywords = catInfo.keywords.filter(kw => 
      keywordCount[kw] && keywordCount[kw] > 0
    );
    if (appearedKeywords.length > 0) {
      dynamicCategories[catKey] = appearedKeywords;
    }
  }

  // Get unique subreddits for filter
  const subreddits = [...new Set(posts.map(p => p.subreddit))].sort();

  return NextResponse.json({ 
    keywords,
    total: keywords.length,
    subreddits,
    categories: dynamicCategories, // 动态分类信息
  });
}
