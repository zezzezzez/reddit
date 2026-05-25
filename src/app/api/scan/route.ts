import { NextResponse } from 'next/server';
import { getPosts, savePosts, getComments, saveComments, saveScanResult, getConfig, getDailyReports, saveDailyReport } from '@/lib/store';
import { fetchRedditPost } from '@/lib/reddit';
import { analyzeCommentSentiment, calculatePostAlertLevel } from '@/lib/sentiment';
import { generateDetailedSummary } from '@/lib/summary';
import { proxyFetch, initProxy } from '@/lib/proxy';
import { analyzeSentimentWithLLM } from '@/lib/llm';
import { RedditComment } from '@/lib/types';

// Global scan progress (in-memory, single-process only)
let scanProgress = {
  isRunning: false,
  current: 0,
  total: 0,
  postTitle: '',
  message: '',
};

export async function POST(request: Request) {
  try {
    // Initialize proxy and check Reddit connectivity
    await initProxy();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      await proxyFetch('https://www.reddit.com/.json?limit=1', {
        signal: controller.signal,
        headers: { 'User-Agent': 'HisenseRedditMonitor/1.0' },
      });
      clearTimeout(timeoutId);
    } catch {
      return NextResponse.json({
        success: false,
        message: '无法连接 Reddit，请在设置中配置外网代理后重试',
      }, { status: 503 });
    }

    const body = await request.json();
    const { postIds, scanAll, quickScan } = body;

    const allPosts = getPosts();
    if (allPosts.length === 0) {
      return NextResponse.json({
        success: false,
        message: '没有可扫描的帖子，请先导入数据',
      });
    }

    let postsToScan: typeof allPosts;

    if (quickScan) {
      // Quick scan: scan the 5 most recent posts that haven't been scanned recently
      postsToScan = allPosts
        .filter(p => !p.lastScanned || new Date(p.lastScanned).getTime() < Date.now() - 24 * 60 * 60 * 1000)
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
        .slice(0, 5);
      if (postsToScan.length === 0) {
        // If all recently scanned, just take the 5 most recent
        postsToScan = [...allPosts]
          .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
          .slice(0, 5);
      }
    } else if (scanAll || !postIds || postIds.length === 0) {
      postsToScan = allPosts;
    } else {
      postsToScan = allPosts.filter(p => postIds.includes(p.id));
    }

    if (postsToScan.length === 0) {
      return NextResponse.json({
        success: false,
        message: '未找到指定的帖子',
      });
    }

    console.log(`[Scan] Starting scan of ${postsToScan.length} posts...`);

    // Initialize scan progress
    scanProgress = {
      isRunning: true,
      current: 0,
      total: postsToScan.length,
      postTitle: '',
      message: '准备扫描...',
    };

    const results = [];
    let totalNewComments = 0;
    let totalFlagged = 0;

    for (let i = 0; i < postsToScan.length; i++) {
      const post = postsToScan[i];
      scanProgress.current = i + 1;
      scanProgress.postTitle = post.title || post.redditUrl;
      scanProgress.message = `正在扫描: ${post.title || post.redditUrl}`;
      console.log(`[Scan] ${i + 1}/${postsToScan.length} Scanning: ${post.redditUrl}`);

      try {
        // Fetch from Reddit (pass our post ID for comment linking)
        const redditData = await fetchRedditPost(post.redditUrl, post.id);

        if (!redditData) {
          results.push({
            postId: post.id,
            status: 'failed',
            error: '无法获取Reddit数据',
          });
          // Save progress even on failure
          savePosts(allPosts);
          continue;
        }

        // Update post data from Reddit
        if (redditData.postData.title) post.title = redditData.postData.title;
        if (redditData.postData.author) post.author = redditData.postData.author!;
        if (redditData.postData.score) post.score = redditData.postData.score!;
        if (redditData.postData.commentCount) post.commentCount = redditData.postData.commentCount!;
        if (redditData.postData.subreddit) post.subreddit = redditData.postData.subreddit!;
        if (redditData.postData.createdAt) post.createdAt = redditData.postData.createdAt!;
        post.lastScanned = new Date().toISOString();

        // Analyze sentiment for each comment
        // Use LLM if configured, otherwise use keyword-based analysis
        const llmConfig = getConfig().llm;
        const detectionRules = getConfig().detectionRules;
        const useLLM = llmConfig?.enabled && llmConfig.apiKey;

        let analyzedComments: RedditComment[];

        if (useLLM) {
          console.log(`[Scan] Using LLM (${llmConfig!.provider}/${llmConfig!.model}) for sentiment analysis`);
          analyzedComments = [];
          for (let ci = 0; ci < redditData.comments.length; ci++) {
            const comment = redditData.comments[ci];
            try {
              const llmResult = await analyzeSentimentWithLLM(
                llmConfig!,
                comment.body,
                post.title,
              );
              analyzedComments.push({
                ...comment,
                sentimentScore: llmResult.score,
                isFlagged: llmResult.isFlagged,
                flagReasons: llmResult.flagReasons,
              });
              console.log(`[Scan]   Comment ${ci + 1}/${redditData.comments.length}: score=${llmResult.score.toFixed(2)} flagged=${llmResult.isFlagged} ${llmResult.explanation ? '(' + llmResult.explanation + ')' : ''}`);
            } catch (llmError: any) {
              // Fallback to keyword analysis on LLM error
              console.warn(`[Scan]   LLM error for comment ${ci + 1}, falling back to keywords:`, llmError.message);
              const sentiment = analyzeCommentSentiment(comment, detectionRules);
              analyzedComments.push({
                ...comment,
                sentimentScore: sentiment.score,
                isFlagged: sentiment.isFlagged,
                flagReasons: sentiment.flagReasons,
              });
            }
            // Rate limiting for LLM calls
            if (ci < redditData.comments.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 300));
            }
          }
        } else {
          analyzedComments = redditData.comments.map(comment => {
            const sentiment = analyzeCommentSentiment(comment, detectionRules);
            return {
              ...comment,
              sentimentScore: sentiment.score,
              isFlagged: sentiment.isFlagged,
              flagReasons: sentiment.flagReasons,
            };
          });
        }

        // Calculate post alert level
        const { level, reasons, flaggedCount } = calculatePostAlertLevel(analyzedComments, detectionRules);
        post.alertLevel = level;
        post.alertReasons = reasons;

        // Generate Chinese summary
        post.summary = generateDetailedSummary(post.title, post.subreddit, analyzedComments);

        // Save comments immediately
        saveComments(post.id, analyzedComments);

        // Save scan result
        const flaggedComments = analyzedComments.filter(c => c.isFlagged);
        saveScanResult({
          postId: post.id,
          scanTime: new Date().toISOString(),
          totalComments: analyzedComments.length,
          flaggedComments: flaggedCount,
          alertLevel: level,
          sentimentSummary: {
            positive: analyzedComments.filter(c => c.sentimentScore > 0.1).length,
            neutral: analyzedComments.filter(c => c.sentimentScore >= -0.1 && c.sentimentScore <= 0.1).length,
            negative: analyzedComments.filter(c => c.sentimentScore < -0.1).length,
          },
          topFlaggedComments: flaggedComments.slice(0, 5),
        });

        // Save posts progress after each scan
        savePosts(allPosts);

        totalNewComments += analyzedComments.length;
        totalFlagged += flaggedCount;

        results.push({
          postId: post.id,
          status: 'scanned',
          newComments: analyzedComments.length,
          flaggedCount,
          alertLevel: level,
          timestamp: new Date().toISOString(),
        });

        console.log(`[Scan] ${i + 1}/${postsToScan.length} Done: ${analyzedComments.length} comments, ${flaggedCount} flagged`);

        // Rate limiting: 3 seconds between Reddit requests to avoid 429
        if (i < postsToScan.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      } catch (error: any) {
        results.push({
          postId: post.id,
          status: 'error',
          error: error.message,
        });
        // Save progress even on error
        savePosts(allPosts);
      }
    }

    console.log(`[Scan] Complete: ${results.length} posts, ${totalNewComments} comments, ${totalFlagged} flagged`);

    scanProgress.message = '扫描完成，正在保存报告...';

    // Save daily report for trend tracking
    const today = new Date().toISOString().slice(0, 10);
    const updatedPosts = getPosts();
    const updatedComments = getComments();
    const criticalCount = updatedPosts.filter(p => p.alertLevel === 'critical').length;
    const highCount = updatedPosts.filter(p => p.alertLevel === 'high').length;
    const mediumCount = updatedPosts.filter(p => p.alertLevel === 'medium').length;
    const safeCount = updatedPosts.filter(p => p.alertLevel === 'safe' || p.alertLevel === 'low').length;
    const flaggedCount = updatedComments.filter(c => c.isFlagged).length;

    saveDailyReport({
      date: today,
      totalPosts: updatedPosts.length,
      totalComments: updatedComments.length,
      flaggedComments: flaggedCount,
      criticalAlerts: criticalCount,
      highAlerts: highCount,
      mediumAlerts: mediumCount,
      safePosts: safeCount,
      sentimentTrend: [{
        date: today,
        positive: updatedComments.filter(c => c.sentimentScore > 0.1).length,
        neutral: updatedComments.filter(c => c.sentimentScore >= -0.1 && c.sentimentScore <= 0.1).length,
        negative: updatedComments.filter(c => c.sentimentScore < -0.1).length,
      }],
    });
    console.log(`[Scan] Daily report saved for ${today}`);

    return NextResponse.json({
      success: true,
      message: `扫描完成！共处理 ${results.length} 个帖子，发现 ${totalNewComments} 条评论，${totalFlagged} 条预警`,
      results,
      scanTime: new Date().toISOString(),
    });
  } catch (error: any) {
    scanProgress.isRunning = false;
    scanProgress.message = '扫描失败: ' + (error.message || '未知错误');
    return NextResponse.json({ error: error.message || 'Scan failed' }, { status: 500 });
  } finally {
    scanProgress.isRunning = false;
    scanProgress.message = '扫描结束';
  }
}

export async function GET() {
  return NextResponse.json(scanProgress);
}
