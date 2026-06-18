import { NextResponse } from 'next/server';
import { getPosts, getComments, getDailyReports } from '@/lib/store';
import { mockPosts, mockComments, mockDailyReports } from '@/lib/mock-data';
import { assignAlertLevelByPercentile, calcPostFlaggedRatio } from '@/lib/sentiment';

function getDataSources() {
  const storePosts = getPosts();
  const useMock = storePosts.length === 0;
  const posts = useMock ? mockPosts : storePosts;
  const reports = useMock ? mockDailyReports : getDailyReports();
  return { posts, reports, useMock };
}

export async function GET() {
  try {
    const { posts: rawPosts, reports, useMock } = getDataSources();
    // 全局分位分级：按所有帖子恶意评论比例重算 alertLevel（临时覆写，不污染 store）
    const posts = rawPosts.map(p => ({ ...p }));
    {
      const ratios = new Map<string, number>();
      for (const p of posts) {
        const cs = useMock ? (mockComments[p.id] || []) : getComments(p.id);
        ratios.set(p.id, calcPostFlaggedRatio(cs));
      }
      assignAlertLevelByPercentile(posts, ratios);
    }

    // Calculate stats
    const totalPosts = posts.length;
    const criticalPosts = posts.filter(p => p.alertLevel === 'critical').length;
    const mediumPosts = posts.filter(p => p.alertLevel === 'medium').length;
    const safePosts = posts.filter(p => p.alertLevel === 'safe' || p.alertLevel === 'low').length;

    // Get all flagged comments
    let allComments;
    if (useMock) {
      allComments = Object.values(mockComments).flat();
    } else {
      allComments = getComments();
    }
    const flaggedComments = allComments.filter(c => c.isFlagged);

    // Sentiment distribution
    // positive: score > 0.1 (clearly positive)
    // neutral: -0.1 <= score <= 0.1
    // negative: score < -0.1 (clearly negative)
    const sentimentDistribution = {
      positive: allComments.filter(c => c.sentimentScore > 0.1).length,
      neutral: allComments.filter(c => c.sentimentScore >= -0.1 && c.sentimentScore <= 0.1).length,
      negative: allComments.filter(c => c.sentimentScore < -0.1).length,
    };

    // Category breakdown
    const categoryCount: Record<string, number> = {};
    flaggedComments.forEach(c => {
      c.flagReasons.forEach(r => {
        categoryCount[r] = (categoryCount[r] || 0) + 1;
      });
    });

    // Top flagged posts
    const topFlaggedPosts = posts
      .filter(p => p.alertLevel !== 'safe' && p.alertLevel !== 'low')
      .sort((a, b) => {
        const order = { critical: 0, medium: 1 };
        return ((order as any)[a.alertLevel] ?? 99) - ((order as any)[b.alertLevel] ?? 99);
      })
      .slice(0, 5);

    // Recent flagged comments
    const recentFlagged = flaggedComments
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);

    // Trend data - last 7 days from daily reports
    let trendData;
    if (reports.length > 0) {
      // Sort by date and take last 7 days
      const sortedReports = [...reports].sort((a, b) => a.date.localeCompare(b.date));
      const last7Days = sortedReports.slice(-7);
      trendData = last7Days.map(r => ({
        date: r.date,
        positive: r.sentimentTrend[0]?.positive || 0,
        neutral: r.sentimentTrend[0]?.neutral || 0,
        negative: r.sentimentTrend[0]?.negative || 0,
        flagged: r.flaggedComments,
      }));
    } else {
      // Generate minimal trend from current data
      trendData = [{
        date: new Date().toISOString().slice(0, 10),
        positive: sentimentDistribution.positive,
        neutral: sentimentDistribution.neutral,
        negative: sentimentDistribution.negative,
        flagged: flaggedComments.length,
      }];
    }

    return NextResponse.json({
      stats: {
        totalPosts,
        criticalAlerts: criticalPosts,
        mediumAlerts: mediumPosts,
        safePosts,
        totalComments: allComments.length,
        flaggedComments: flaggedComments.length,
        flaggedRatio: allComments.length > 0 ? (flaggedComments.length / allComments.length * 100).toFixed(1) : '0',
      },
      sentimentDistribution,
      categoryBreakdown: categoryCount,
      topFlaggedPosts,
      recentFlagged,
      trendData,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
  }
}
