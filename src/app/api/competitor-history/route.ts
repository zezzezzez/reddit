import { NextRequest, NextResponse } from 'next/server';
import { getCompetitorHistory, deleteCompetitorRecord, saveCompetitorRecord } from '@/lib/store';

// GET /api/competitor-history - 获取历史记录列表或单条详情
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const history = getCompetitorHistory();
  
  // 如果指定了 id，返回完整记录
  if (id) {
    const record = history.find(r => r.id === id);
    if (!record) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }
    return NextResponse.json({ record });
  }
  
  // 否则返回摘要列表
  return NextResponse.json({ 
    history: history.map(record => ({
      id: record.id,
      subreddit: record.subreddit,
      brands: record.brands,
      timeRange: record.timeRange,
      timestamp: record.timestamp,
      // 不返回完整 data，只返回摘要
      summary: {
        brandCount: Object.keys(record.data.brands || {}).length,
        hisenseFlaggedCount: (record.data.hisenseFlaggedPosts || []).length,
      }
    }))
  });
}

// POST /api/competitor-history - 保存新的分析记录
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const record = {
      id: body.id || `record_${Date.now()}`,
      subreddit: body.subreddit,
      brands: body.brands,
      timeRange: body.timeRange,
      timestamp: body.timestamp || new Date().toISOString(),
      data: body.data,
    };
    
    saveCompetitorRecord(record);
    
    return NextResponse.json({ success: true, id: record.id });
  } catch (error) {
    console.error('Failed to save competitor record:', error);
    return NextResponse.json({ error: 'Failed to save record' }, { status: 500 });
  }
}

// DELETE /api/competitor-history?id=xxx - 删除指定记录
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  
  if (!id) {
    return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });
  }
  
  deleteCompetitorRecord(id);
  
  return NextResponse.json({ success: true });
}
