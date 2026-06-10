import { NextResponse } from 'next/server';
import {
  fetchAllBitableRecords,
  fetchAllBitableRecordsWithUserToken,
  convertBitableRecordsToPosts,
  testFeishuConnection,
} from '@/lib/feishu';
import { getPosts, savePosts, saveConfig, getConfig } from '@/lib/store';
import { FeishuConfig } from '@/lib/types';

// ============================================================
// POST: Sync data from Feishu Bitable
// 支持两种模式：
//   1. tenant_access_token (默认): 本租户文档
//   2. user_access_token   (useUserToken=true): 跨租户外部文档
// ============================================================
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const useUserToken = body.useUserToken === true;

    // ─── 模式一：user_access_token 跨租户同步 ──────────────
    if (useUserToken) {
      return await syncWithUserToken();
    }

    // ─── 模式二：tenant_access_token 本租户同步（兼容旧版） ──
    return await syncWithTenantToken(body);
  } catch (error: any) {
    console.error('Feishu sync error:', error);
    return NextResponse.json({
      success: false,
      message: error.message || '同步失败',
    }, { status: 500 });
  }
}

// ============================================================
// user_access_token 模式：跨租户外部文档同步
// ============================================================
async function syncWithUserToken() {
  const config = getConfig();
  const userAuth = config.feishuUserAuth;

  // 1. 校验 OAuth 授权
  if (!userAuth?.accessToken) {
    return NextResponse.json({
      success: false,
      message: '未完成飞书 OAuth 授权，请先点击「飞书授权」按钮',
    });
  }

  // 2. 校验外部文档配置
  const externalAppToken = userAuth.externalAppToken;
  const externalTableId = userAuth.externalTableId;
  if (!externalAppToken || !externalTableId) {
    return NextResponse.json({
      success: false,
      message: '未配置外部文档（externalAppToken / externalTableId）',
    });
  }

  // 3. URL 字段名：默认 "Reddit URL"，可被 feishu.urlFieldName 覆盖
  const urlFieldName = config.feishu.urlFieldName || 'Reddit URL';

  // 4. 获取记录（feishu-auth.ts 内部会自动处理 token 刷新）
  let records;
  try {
    records = await fetchAllBitableRecordsWithUserToken(externalAppToken, externalTableId);
  } catch (e: any) {
    return NextResponse.json({
      success: false,
      message: `外部文档拉取失败: ${e.message}。如果 token 过期请重新授权。`,
    });
  }

  if (records.length === 0) {
    return NextResponse.json({
      success: true,
      mode: 'user_token',
      message: '外部飞书表格中没有记录',
      syncedPosts: 0,
      newPosts: 0,
      updatedPosts: 0,
    });
  }

  // 5. 转换为 posts 并合并
  const existingPosts = getPosts();
  const newPosts = convertBitableRecordsToPosts(records, urlFieldName, existingPosts);

  let newCount = 0;
  let updatedCount = 0;
  const mergedPosts = [...existingPosts];

  for (const post of newPosts) {
    const existIndex = mergedPosts.findIndex(
      p => p.id === post.id || p.redditUrl === post.redditUrl
    );
    if (existIndex >= 0) {
      // 更新来自飞书的字段，保留扫描结果
      mergedPosts[existIndex] = {
        ...mergedPosts[existIndex],
        redditUrl: post.redditUrl,
        title: post.title !== mergedPosts[existIndex].title && mergedPosts[existIndex].title === mergedPosts[existIndex].redditUrl
          ? post.title
          : mergedPosts[existIndex].title,
        subreddit: post.subreddit || mergedPosts[existIndex].subreddit,
      };
      updatedCount++;
    } else {
      mergedPosts.push(post);
      newCount++;
    }
  }

  savePosts(mergedPosts);

  return NextResponse.json({
    success: true,
    mode: 'user_token',
    message: `外部飞书文档同步成功，共 ${records.length} 条。请手动点击「扫描全部帖子」按钮进行扫描。`,
    syncedPosts: newPosts.length,
    newPosts: newCount,
    updatedPosts: updatedCount,
  });
}

// ============================================================
// tenant_access_token 模式：本租户文档同步（兼容旧版）
// ============================================================
async function syncWithTenantToken(body: any) {
  const feishuConfig: FeishuConfig = {
    appId: body.appId || '',
    appSecret: body.appSecret || '',
    appToken: body.appToken || '',
    tableId: body.tableId || '',
    urlFieldName: body.urlFieldName || 'Reddit URL',
  };

  if (!feishuConfig.appId || !feishuConfig.appSecret || !feishuConfig.appToken || !feishuConfig.tableId) {
    return NextResponse.json({
      success: false,
      message: '请填写完整的飞书应用凭证',
    });
  }

  const config = getConfig();
  config.feishu = feishuConfig;
  saveConfig(config);

  const records = await fetchAllBitableRecords(feishuConfig);

  if (records.length === 0) {
    return NextResponse.json({
      success: true,
      mode: 'tenant_token',
      message: '飞书表格中没有记录',
      syncedPosts: 0,
      newPosts: 0,
      updatedPosts: 0,
    });
  }

  const existingPosts = getPosts();
  const newPosts = convertBitableRecordsToPosts(records, feishuConfig.urlFieldName, existingPosts);

  let newCount = 0;
  let updatedCount = 0;
  const mergedPosts = [...existingPosts];

  for (const post of newPosts) {
    const existIndex = mergedPosts.findIndex(
      p => p.id === post.id || p.redditUrl === post.redditUrl
    );
    if (existIndex >= 0) {
      mergedPosts[existIndex] = {
        ...mergedPosts[existIndex],
        redditUrl: post.redditUrl,
        title: post.title !== mergedPosts[existIndex].title && mergedPosts[existIndex].title === mergedPosts[existIndex].redditUrl
          ? post.title
          : mergedPosts[existIndex].title,
        subreddit: post.subreddit || mergedPosts[existIndex].subreddit,
      };
      updatedCount++;
    } else {
      mergedPosts.push(post);
      newCount++;
    }
  }

  savePosts(mergedPosts);

  return NextResponse.json({
    success: true,
    mode: 'tenant_token',
    message: `飞书数据同步成功。请手动点击「扫描全部帖子」按钮进行扫描。`,
    syncedPosts: newPosts.length,
    newPosts: newCount,
    updatedPosts: updatedCount,
  });
}

// ============================================================
// PUT: Test Feishu connection
// 支持两种模式（通过 body.useUserToken 切换）
// ============================================================
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const useUserToken = body.useUserToken === true;

    if (useUserToken) {
      // user_access_token 模式
      const result = await testFeishuConnection({} as FeishuConfig, 'user');
      return NextResponse.json(result);
    }

    // tenant_access_token 模式
    const feishuConfig: FeishuConfig = {
      appId: body.appId || '',
      appSecret: body.appSecret || '',
      appToken: body.appToken || '',
      tableId: body.tableId || '',
      urlFieldName: body.urlFieldName || 'Reddit URL',
    };

    const result = await testFeishuConnection(feishuConfig, 'tenant');
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: error.message || '连接测试失败',
    }, { status: 500 });
  }
}
