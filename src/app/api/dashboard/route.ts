import { NextResponse } from 'next/server';
import { getPosts, getComments, getDailyReports } from '@/lib/store';
import { mockPosts, mockComments, mockDailyReports } from '@/lib/mock-data';

function getDataSources() {
  const storePosts = getPosts();
  const useMock = storePosts.length === 0;
  const posts = useMock ? mockPosts : storePosts;
  const reports = useMock ? mockDailyReports : getDailyReports();
  return { posts, reports, useMock };
}

export async function GET() {
  try {
    const { posts, reports, useMock } = getDataSources();

    // Calculate stats
    const totalPosts = posts.length;
    const criticalPosts = posts.filter(p => p.alertLevel === 'critical').length;
    const highPosts = posts.filter(p => p.alertLevel === 'high').length;
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
      .filter(p => p.alertLevel !== 'safe')
      .sort((a, b) => {
        const order = { critical: 0, high: 1, medium: 2, low: 3, safe: 4 };
        return order[a.alertLevel] - order[b.alertLevel];
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
        highAlerts: highPosts,
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
