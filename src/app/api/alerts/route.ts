import { NextResponse } from 'next/server';
import { getPosts, savePosts } from '@/lib/store';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');

  const posts = getPosts();
  // 包含严重和中等预警
  const alertPosts = posts.filter(p => p.lastScanned && (p.alertLevel === 'critical' || p.alertLevel === 'medium'));

  let filtered = alertPosts;
  if (status && status !== 'all') {
    filtered = alertPosts.filter(p => (p.alertStatus || 'pending') === status);
  }

  // Ensure all posts have alertStatus
  const result = filtered.map(p => ({
    ...p,
    alertStatus: p.alertStatus || 'pending',
  }));

  // Stats
  const pendingPosts = alertPosts.filter(p => (p.alertStatus || 'pending') === 'pending');
  const stats = {
    pending: pendingPosts.length,
    pendingCritical: pendingPosts.filter(p => p.alertLevel === 'critical').length,
    pendingMedium: pendingPosts.filter(p => p.alertLevel === 'medium').length,
    processing: alertPosts.filter(p => p.alertStatus === 'processing').length,
    resolved: alertPosts.filter(p => p.alertStatus === 'resolved').length,
    ignored: alertPosts.filter(p => p.alertStatus === 'ignored').length,
  };

  return NextResponse.json({ posts: result, stats });
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const { postId, alertStatus, handler, handleNote } = body;

  if (!postId || !alertStatus) {
    return NextResponse.json({ error: 'Missing postId or alertStatus' }, { status: 400 });
  }

  const posts = getPosts();
  const post = posts.find(p => p.id === postId);
  if (!post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  }

  post.alertStatus = alertStatus;
  if (handler !== undefined) post.handler = handler;
  if (handleNote !== undefined) post.handleNote = handleNote;
  if (alertStatus === 'resolved' || alertStatus === 'processing') {
    post.handleTime = new Date().toISOString();
  }

  savePosts(posts);

  return NextResponse.json({ success: true, post });
}
