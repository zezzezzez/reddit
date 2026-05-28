'use client';

import { useState } from 'react';
import { TrendingUp, AlertTriangle, BarChart3, ExternalLink } from 'lucide-react';

interface BrandData {
  brand: string;
  posts: any[];
  totalComments: number;
  flaggedComments: number;
  avgSentiment: number;
  positiveCount: number;
  neutralCount: number;
  negativeCount: number;
  totalInfluenceScore: number;
  keywords: Record<string, number>;
}

const BRAND_COLORS: Record<string, { bg: string; text: string; border: string; badge: string }> = {
  Hisense: { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200', badge: 'bg-cyan-500' },
  TCL: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', badge: 'bg-blue-500' },
  Samsung: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', badge: 'bg-indigo-500' },
  Sony: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', badge: 'bg-purple-500' },
};

export default function CompetitorPage() {
  const [subreddit, setSubreddit] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [data, setData] = useState<{
    subreddit: string;
    brands: Record<string, BrandData>;
    timestamp: string;
  } | null>(null);

  const handleAnalyze = async () => {
    if (!subreddit) return;

    setLoading(true);
    setProgress('正在获取板块帖子...');
    setData(null);

    try {
      const response = await fetch(
        `/api/competitor-analysis?subreddit=${subreddit}&postsPerBrand=5`
      );
      const result = await response.json();

      if (result.error) {
        alert(result.error);
        return;
      }

      setProgress('分析完成！');
      setData(result);
    } catch (error) {
      console.error('Analysis failed:', error);
      alert('分析失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const getSentimentLabel = (score: number) => {
    if (score > 0.1) return '正面';
    if (score < -0.1) return '负面';
    return '中性';
  };

  const getSentimentColor = (score: number) => {
    if (score > 0.1) return 'text-green-600';
    if (score < -0.1) return 'text-red-600';
    return 'text-gray-600';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">竞品舆情对比</h1>
          <p className="text-sm text-gray-500 mt-1">
            对比同一板块下各品牌帖子的舆情表现
          </p>
        </div>
      </div>

      {/* Input Section */}
      <div className="bg-white rounded-lg p-5 border border-gray-100 shadow-sm">
        <div className="flex gap-3">
          <input
            type="text"
            value={subreddit}
            onChange={(e) => setSubreddit(e.target.value)}
            placeholder="输入 Reddit 板块名称（如 costco）"
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
            onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
          />
          <button
            onClick={handleAnalyze}
            disabled={loading || !subreddit}
            className="px-6 py-2.5 bg-primary text-white rounded-lg hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm flex items-center gap-2 transition-colors"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                分析中...
              </>
            ) : (
              <>
                <BarChart3 className="w-4 h-4" />
                开始分析
              </>
            )}
          </button>
        </div>
        {progress && (
          <p className="text-xs text-gray-500 mt-2">{progress}</p>
        )}
      </div>

      {/* Results */}
      {data && (
        <div className="space-y-6">
          {/* Brand Comparison Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(data.brands).map(([brandName, brandData]) => {
              const colors = BRAND_COLORS[brandName] || BRAND_COLORS['Hisense'];
              const totalComments = brandData.totalComments;
              const flaggedRatio = totalComments > 0 
                ? (brandData.flaggedComments / totalComments * 100).toFixed(1)
                : '0';

              return (
                <div key={brandName} className="bg-white rounded-lg p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className={`text-lg font-semibold ${colors.text}`}>{brandName}</h3>
                    <span className={`px-2.5 py-1 rounded text-xs font-semibold text-white ${colors.badge}`}>
                      {brandData.posts.length} 帖子
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">平均情感</span>
                      <span className={`text-sm font-semibold ${getSentimentColor(brandData.avgSentiment)}`}>
                        {getSentimentLabel(brandData.avgSentiment)} ({brandData.avgSentiment.toFixed(2)})
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">总评论数</span>
                      <span className="text-sm font-semibold text-gray-900">{totalComments}</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">恶意评论</span>
                      <span className="text-sm font-semibold text-red-600">
                        {brandData.flaggedComments} ({flaggedRatio}%)
                      </span>
                    </div>

                    {/* Sentiment Distribution */}
                    <div className="pt-3 border-t border-gray-100">
                      <p className="text-xs text-gray-500 mb-2">情感分布</p>
                      <div className="flex gap-1 h-2 rounded-full overflow-hidden bg-gray-100">
                        {totalComments > 0 && (
                          <>
                            <div
                              className="bg-green-500"
                              style={{ width: `${(brandData.positiveCount / totalComments) * 100}%` }}
                              title={`正面: ${brandData.positiveCount}`}
                            />
                            <div
                              className="bg-gray-400"
                              style={{ width: `${(brandData.neutralCount / totalComments) * 100}%` }}
                              title={`中性: ${brandData.neutralCount}`}
                            />
                            <div
                              className="bg-red-500"
                              style={{ width: `${(brandData.negativeCount / totalComments) * 100}%` }}
                              title={`负面: ${brandData.negativeCount}`}
                            />
                          </>
                        )}
                      </div>
                      <div className="flex justify-between mt-1 text-xs text-gray-500">
                        <span>正面 {brandData.positiveCount}</span>
                        <span>中性 {brandData.neutralCount}</span>
                        <span>负面 {brandData.negativeCount}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Posts Detail */}
          {Object.entries(data.brands).map(([brandName, brandData]) => {
            const colors = BRAND_COLORS[brandName] || BRAND_COLORS['Hisense'];
            
            return (
              <div key={brandName} className="bg-white rounded-lg p-5 border border-gray-100 shadow-sm">
                <h3 className={`text-lg font-semibold ${colors.text} mb-4`}>
                  {brandName} 帖子详情
                </h3>
                <div className="space-y-3">
                  {brandData.posts.map((post: any, idx: number) => (
                    <div
                      key={post.id}
                      className="p-4 rounded-lg border border-gray-200 hover:border-primary/50 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold text-gray-400">#{idx + 1}</span>
                            <h4 className="text-sm font-semibold text-gray-900 truncate">
                              {post.title}
                            </h4>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            <span>👍 {post.score}</span>
                            <span>💬 {post.commentCount} 评论</span>
                            <span>🚨 {post.flaggedComments} 恶意</span>
                          </div>
                        </div>
                        <a
                          href={post.permalink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:text-primary-hover flex items-center gap-1 flex-shrink-0"
                        >
                          查看 <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-gray-500">情感:</span>
                        <span className={`font-semibold ${getSentimentColor(post.avgSentiment)}`}>
                          {getSentimentLabel(post.avgSentiment)} ({post.avgSentiment.toFixed(2)})
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {!data && !loading && (
        <div className="bg-white rounded-lg p-12 border border-gray-100 shadow-sm text-center">
          <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">开始竞品分析</h3>
          <p className="text-sm text-gray-500">
            输入 Reddit 板块名称，系统将自动抓取并分析各品牌帖子的舆情数据
          </p>
          <div className="mt-4 text-xs text-gray-400">
            支持品牌：Hisense、TCL、Samsung、Sony
          </div>
        </div>
      )}
    </div>
  );
}
