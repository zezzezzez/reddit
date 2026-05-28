import { NextResponse } from 'next/server';
import { getPosts } from '@/lib/store';

export async function GET() {
  try {
    // 获取所有唯一的板块
    const posts = getPosts();
    const subreddits = [...new Set(posts.map(p => p.subreddit))].sort();
    
    return NextResponse.json({ subreddits });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch subreddits' }, { status: 500 });
  }
}