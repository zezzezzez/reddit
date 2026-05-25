import { NextResponse } from 'next/server';
import { fetchAllBitableRecords, convertBitableRecordsToPosts, testFeishuConnection } from '@/lib/feishu';
import { getPosts, savePosts, saveConfig, getConfig } from '@/lib/store';
import { generatePostSummary } from '@/lib/summary';
import { proxyFetch, initProxy } from '@/lib/proxy';
import { FeishuConfig } from '@/lib/types';

// POST: Sync data from Feishu Bitable
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const feishuConfig: FeishuConfig = {
      appId: body.appId || '',
      appSecret: body.appSecret || '',
      appToken: body.appToken || '',
      tableId: body.tableId || '',
      urlFieldName: body.urlFieldName || 'Reddit URL',
    };

    // Validate
    if (!feishuConfig.appId || !feishuConfig.appSecret || !feishuConfig.appToken || !feishuConfig.tableId) {
      return NextResponse.json({
        success: false,
        message: '请填写完整的飞书应用凭证',
      });
    }

    // Save config
    const config = getConfig();
    config.feishu = feishuConfig;
    saveConfig(config);

    // Fetch records from Feishu
    const records = await fetchAllBitableRecords(feishuConfig);

    if (records.length === 0) {
      return NextResponse.json({
        success: true,
        message: '飞书表格中没有记录',
        syncedPosts: 0,
        newPosts: 0,
        updatedPosts: 0,
      });
    }

    // Convert to posts and merge with existing
    const existingPosts = getPosts();
    const newPosts = convertBitableRecordsToPosts(records, feishuConfig.urlFieldName, existingPosts);

    // Merge: update existing + add new
    let newCount = 0;
    let updatedCount = 0;
    const mergedPosts = [...existingPosts];

    for (const post of newPosts) {
      const existIndex = mergedPosts.findIndex(p => p.id === post.id || p.redditUrl === post.redditUrl);
      if (existIndex >= 0) {
        // Update only fields from Feishu, keep scan results
        mergedPosts[existIndex] = {
          ...mergedPosts[existIndex],
          redditUrl: post.redditUrl,
          title: post.title !== mergedPosts[existIndex].title && mergedPosts[existIndex].title === mergedPosts[existIndex].redditUrl ? post.title : mergedPosts[existIndex].title,
          subreddit: post.subreddit || mergedPosts[existIndex].subreddit,
        };
        updatedCount++;
      } else {
        mergedPosts.push(post);
        newCount++;
      }
    }

    savePosts(mergedPosts);

    // Auto-scan: try to scan new posts in background
    let autoScanStatus = 'pending';
    if (newCount > 0) {
      try {
        await initProxy();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        await proxyFetch('https://www.reddit.com/.json?limit=1', {
          signal: controller.signal,
          headers: { 'User-Agent': 'HisenseRedditMonitor/1.0' },
        });
        clearTimeout(timeoutId);

        autoScanStatus = 'triggered';
        const newPostIds = mergedPosts.filter(p => !p.lastScanned).map(p => p.id);
        fetch('/api/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ postIds: newPostIds }),
        }).catch(() => {});
      } catch {
        autoScanStatus = 'no_proxy';
      }
    }

    return NextResponse.json({
      success: true,
      message: `飞书数据同步成功${
        autoScanStatus === 'triggered' ? '，已自动开始扫描评论' :
        autoScanStatus === 'no_proxy' ? '，但无法连接Reddit，请开启代理后手动扫描' : ''
      }`,
      syncedPosts: newPosts.length,
      newPosts: newCount,
      updatedPosts: updatedCount,
      autoScanStatus,
    });
  } catch (error: any) {
    console.error('Feishu sync error:', error);
    return NextResponse.json({
      success: false,
      message: error.message || '同步失败',
    }, { status: 500 });
  }
}

// PUT: Test Feishu connection
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const feishuConfig: FeishuConfig = {
      appId: body.appId || '',
      appSecret: body.appSecret || '',
      appToken: body.appToken || '',
      tableId: body.tableId || '',
      urlFieldName: body.urlFieldName || 'Reddit URL',
    };

    const result = await testFeishuConnection(feishuConfig);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: error.message || '连接测试失败',
    }, { status: 500 });
  }
}
