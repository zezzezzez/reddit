import { NextResponse } from 'next/server';
import { getPosts, savePosts } from '@/lib/store';
import { RedditPost } from '@/lib/types';
import { generatePostSummary } from '@/lib/summary';
import { proxyFetch } from '@/lib/proxy';
import * as XLSX from 'xlsx';

// Extract Reddit URL from a cell value
function extractRedditUrl(value: any): string | null {
  if (!value) return null;
  const str = String(value).trim();
  // Remove BOM if present
  const cleaned = str.replace(/^\uFEFF/, '');
  if (!cleaned) return null;

  // Match various Reddit URL formats
  if (
    cleaned.includes('reddit.com') ||
    cleaned.includes('redd.it') ||
    cleaned.includes('/r/') && cleaned.includes('/comments/') ||
    cleaned.match(/^https?:\/\/.*reddit/i)
  ) {
    return cleaned;
  }

  return null;
}

// Extract post ID from URL
function extractPostIdFromUrl(url: string): string {
  // Standard format: /comments/abc123/
  const commentsMatch = url.match(/\/comments\/([a-z0-9]+)/i);
  if (commentsMatch) return commentsMatch[1];

  // Short format: /s/xyz
  if (url.includes('/s/')) {
    const parts = url.split('/s/');
    if (parts[1]) return `short_${parts[1].split(/[/?#]/)[0]}`;
  }

  // redd.it format
  const reddItMatch = url.match(/redd\.it\/([a-z0-9]+)/i);
  if (reddItMatch) return reddItMatch[1];

  // Fallback: use hash of URL
  return `imported_${Buffer.from(url).toString('base64url').slice(0, 12)}`;
}

// Extract subreddit from URL
function extractSubredditFromUrl(url: string): string {
  const match = url.match(/\/r\/([a-zA-Z0-9_]+)/);
  return match ? match[1] : '';
}

// Try to find the column that contains Reddit URLs
function findRedditUrlColumn(headers: string[], rows: any[][]): number {
  // First, try by column name (exact or partial match)
  const urlKeywords = ['post link', 'url', 'link', 'reddit', '帖子', '链接', 'post url', 'post', '地址', 'reddit url', 'reddit link'];
  const exactMatches = ['post link', 'reddit url', 'reddit link', 'post url'];

  // Priority 1: Exact column name matches
  for (let i = 0; i < headers.length; i++) {
    const header = String(headers[i] || '').toLowerCase().trim();
    if (exactMatches.some(k => header === k)) {
      return i;
    }
  }

  // Priority 2: Partial column name matches
  for (let i = 0; i < headers.length; i++) {
    const header = String(headers[i] || '').toLowerCase().trim();
    if (urlKeywords.some(k => header.includes(k))) {
      // Verify column has at least one Reddit URL in first 20 rows
      const sampleValues = rows.slice(0, 20).map(r => r[i]).filter(v => v != null && String(v).trim() !== '');
      const hasReddit = sampleValues.some(v => {
        const str = String(v);
        return str.includes('reddit.com') || str.includes('redd.it');
      });
      if (hasReddit) {
        return i;
      }
      // Even if no Reddit URL found in sample, if column name is a strong match, use it
      if (['post link', 'reddit url', 'reddit link', 'post url'].some(k => header.includes(k))) {
        return i;
      }
    }
  }

  // Priority 3: Scan ALL columns for Reddit URLs
  let bestCol = -1;
  let bestCount = 0;
  for (let col = 0; col < Math.max(headers.length, ...rows.slice(0, 50).map(r => r.length)); col++) {
    const sampleValues = rows.slice(0, 50).map(r => r[col]).filter(v => v != null && String(v).trim() !== '');
    const redditCount = sampleValues.filter(v => {
      const str = String(v);
      return str.includes('reddit.com') || str.includes('redd.it');
    }).length;
    if (redditCount > bestCount) {
      bestCount = redditCount;
      bestCol = col;
    }
  }

  return bestCol;
}

// Find a column by name keywords
function findColumnByKeywords(headers: string[], keywords: string[]): number {
  for (let i = 0; i < headers.length; i++) {
    const header = String(headers[i] || '').toLowerCase();
    if (keywords.some(k => header.includes(k))) {
      return i;
    }
  }
  return -1;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ success: false, message: '请选择文件' }, { status: 400 });
    }

    const fileName = file.name.toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());

    let headers: string[] = [];
    let rows: any[][] = [];

    // Use xlsx library for ALL file types (CSV + Excel)
    // xlsx handles CSV parsing much more robustly than a hand-written parser
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as any[][];

    if (jsonData.length < 2) {
      return NextResponse.json({ success: false, message: '文件为空或只有表头' }, { status: 400 });
    }

    // Clean headers (remove BOM, trim)
    headers = (jsonData[0] || []).map((h: any) => String(h || '').replace(/^\uFEFF/, '').trim());
    rows = jsonData.slice(1).filter((r: any[]) =>
      r.some(cell => cell != null && String(cell).trim() !== '')
    );

    if (headers.length === 0 || rows.length === 0) {
      return NextResponse.json({ success: false, message: '文件中没有有效数据' }, { status: 400 });
    }

    // Find the Reddit URL column
    const urlColIndex = findRedditUrlColumn(headers, rows);
    if (urlColIndex === -1) {
      return NextResponse.json({
        success: false,
        message: `未找到包含Reddit链接的列。表头为: ${headers.join(', ')}。请确保有一列包含 reddit.com 链接。`,
      }, { status: 400 });
    }

    // Find optional columns
    const titleColIndex = findColumnByKeywords(headers, ['title', '标题', '帖子标题', 'post title', 'name']);
    const subredditColIndex = findColumnByKeywords(headers, ['subreddit', '子版块', '板块', '版块']);
    const authorColIndex = findColumnByKeywords(headers, ['author', '作者', 'user', '发布者']);

    // Convert rows to posts
    const existingPosts = getPosts();
    const newPosts: RedditPost[] = [];
    let skippedCount = 0;
    let duplicateCount = 0;

    for (const row of rows) {
      const urlCell = row[urlColIndex];
      const redditUrl = extractRedditUrl(urlCell);

      if (!redditUrl) {
        skippedCount++;
        continue;
      }

      const postId = extractPostIdFromUrl(redditUrl);

      // Check if already exists
      const exists = existingPosts.find(p => p.id === postId || p.redditUrl === redditUrl);
      if (exists) {
        duplicateCount++;
        continue;
      }

      const post: RedditPost = {
        id: postId,
        redditUrl,
        title: titleColIndex >= 0 ? String(row[titleColIndex] || '') : redditUrl,
        subreddit: subredditColIndex >= 0 ? String(row[subredditColIndex] || '') : extractSubredditFromUrl(redditUrl),
        author: authorColIndex >= 0 ? String(row[authorColIndex] || '') : '',
        score: 0,
        commentCount: 0,
        createdAt: new Date().toISOString(),
        lastScanned: null,
        alertLevel: 'safe',
        alertReasons: [],
        summary: generatePostSummary({
          title: titleColIndex >= 0 ? String(row[titleColIndex] || '') : redditUrl,
          subreddit: subredditColIndex >= 0 ? String(row[subredditColIndex] || '') : extractSubredditFromUrl(redditUrl),
          alertLevel: 'safe',
          alertReasons: [],
          commentCount: 0,
          lastScanned: null,
        }),
      };

      newPosts.push(post);
    }

    // Merge with existing and save
    const mergedPosts = [...existingPosts, ...newPosts];
    savePosts(mergedPosts);

    // Auto-scan: try to scan new posts in background
    let autoScanStatus = 'pending';
    const newPostIds = newPosts.map(p => p.id);

    if (newPostIds.length > 0) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        await proxyFetch('https://www.reddit.com/.json?limit=1', {
          signal: controller.signal,
          headers: { 'User-Agent': 'HisenseRedditMonitor/1.0' },
        });
        clearTimeout(timeoutId);

        // Connectivity OK - trigger auto scan via internal call
        autoScanStatus = 'triggered';

        // Fire and forget - scan in background
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
      message: `导入成功！新增 ${newPosts.length} 个帖子，${duplicateCount} 个已存在，跳过 ${skippedCount} 行无效数据${
        autoScanStatus === 'triggered' ? '，已自动开始扫描评论' :
        autoScanStatus === 'no_proxy' ? '，但无法连接Reddit，请开启代理后手动扫描' : ''
      }`,
      autoScanStatus,
      totalRows: rows.length,
      newPosts: newPosts.length,
      duplicatePosts: duplicateCount,
      skippedRows: skippedCount,
      existingPostsBefore: existingPosts.length,
      totalPostsAfter: mergedPosts.length,
      detectedColumns: {
        urlColumn: headers[urlColIndex],
        titleColumn: titleColIndex >= 0 ? headers[titleColIndex] : null,
        subredditColumn: subredditColIndex >= 0 ? headers[subredditColIndex] : null,
        authorColumn: authorColIndex >= 0 ? headers[authorColIndex] : null,
      },
    });
  } catch (error: any) {
    console.error('Import error:', error);
    return NextResponse.json({
      success: false,
      message: error.message || '文件导入失败',
    }, { status: 500 });
  }
}
