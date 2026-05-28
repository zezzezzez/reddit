'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, AlertTriangle, BarChart3, ExternalLink, ChevronDown, Check } from 'lucide-react';

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

// 可选竞品品牌
const COMPETITOR_BRANDS = [
  { name: 'TCL', value: 'tcl' },
  { name: 'Samsung', value: 'samsung' },
  { name: 'Sony', value: 'sony' },
];

export default function CompetitorPage() {
  const [subreddits, setSubreddits] = useState<string[]>([]);
  const [selectedSubreddit, setSelectedSubreddit] = useState('');
  const [selectedBrands, setSelectedBrands] = useState<string[]>(['tcl', 'samsung', 'sony']);
  const [showSubredditMenu, setShowSubredditMenu] = useState(false);
  const [showBrandMenu, setShowBrandMenu] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [data, setData] = useState<{
    subreddit: string;
    brands: Record<string, BrandData>;
    hisenseFlaggedPosts: any[];
    timestamp: string;
  } | null>(null);

  // 加载板块列表
  useEffect(() => {
    fetch('/api/subreddits')
      .then(res => res.json())
      .then(json => {
        if (json.subreddits) {
          setSubreddits(json.subreddits);
          if (json.subreddits.length > 0) {
            setSelectedSubreddit(json.subreddits[0]);
          }
        }
      })
      .catch(console.error);
  }, []);

  const handleAnalyze = async () => {
    if (!selectedSubreddit) return;

    setLoading(true);
    setProgress('正在获取板块帖子...');
    setData(null);

    try {
      // 构建品牌参数
      const brandsParam = selectedBrands.join(',');
      const response = await fetch(
        `/api/competitor-analysis?subreddit=${selectedSubreddit}&postsPerBrand=5&brands=${brandsParam}`
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
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
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
          <div className="relative">
            <button
              onClick={() => setShowSubredditMenu(!showSubredditMenu)}
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm flex items-center justify-between"
            >
              {selectedSubreddit || '选择板块'}
              <ChevronDown className="w-4 h-4" />
            </button>
            {showSubredditMenu && (
              <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                {subreddits.map(subreddit => (
                  <button
                    key={subreddit}
                    onClick={() => {
                      setSelectedSubreddit(subreddit);
                      setShowSubredditMenu(false);
                    }}
                    className="w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    {subreddit}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="relative">
            <button
              onClick={() => setShowBrandMenu(!showBrandMenu)}
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm flex items-center justify-between"
            >
              {selectedBrands.map(brand => COMPETITOR_BRANDS.find(b => b.value === brand)?.name).join(', ') || '选择品牌'}
              <ChevronDown className="w-4 h-4" />
            </button>
            {showBrandMenu && (
              <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                {COMPETITOR_BRANDS.map(brand => (
                  <button
                    key={brand.value}
                    onClick={() => {
                      setSelectedBrands(prev => {
                        if (prev.includes(brand.value)) {
                          return prev.filter(b => b !== brand.value);
                        } else {
                          return [...prev, brand.value];
                        }
                      });
                    }}
                    className="w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center justify-between"
                  >
                    {brand.name}
                    {selectedBrands.includes(brand.value) && <Check className="w-4 h-4" />}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={handleAnalyze}
            disabled={loading || !selectedSubreddit}
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

          {/* Hisense Flagged Posts Section */}
          {data.hisenseFlaggedPosts && data.hisenseFlaggedPosts.length > 0 && (
            <div className="bg-white rounded-lg p-5 border border-red-200 shadow-sm">
              <h3 className="text-lg font-semibold text-red-600 mb-4">
                海信帖子中的恶意评论（共 {data.hisenseFlaggedPosts.length} 条帖子）
              </h3>
              <div className="space-y-4">
                {data.hisenseFlaggedPosts.map((post: any) => (
                  <div 
                    key={post.id} 
                    className="p-4 rounded-lg bg-red-50 border border-red-200"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                            post.alertLevel === 'critical' || post.alertLevel === 'high' 
                              ? 'bg-red-500 text-white' 
                              : 'bg-yellow-500 text-white'
                          }`}>
                            {post.alertLevel === 'critical' || post.alertLevel === 'high' ? '严重' : '中等'}
                          </span>
                          <span className="text-xs text-gray-500">r/{post.subreddit}</span>
                        </div>
                        <h4 className="text-sm font-semibold text-gray-900 truncate">
                          {post.title}
                        </h4>
                        <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                          <span>💬 {post.commentCount} 评论</span>
                          <span className="text-red-600">🚨 {post.flaggedCommentCount} 恶意</span>
                        </div>
                      </div>
                      <a
                        href={post.redditUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:text-primary-hover flex items-center gap-1 flex-shrink-0"
                      >
                        查看 <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>

                    {/* Flagged Comments */}
                    <div className="space-y-2">
                      {post.flaggedComments.map((comment: any, idx: number) => (
                        <div 
                          key={comment.id || idx}
                          className="p-3 rounded bg-white border border-red-100"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-gray-900">
                              u/{comment.author}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500">👍 {comment.score}</span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                comment.influenceScore >= 20 
                                  ? 'bg-red-100 text-red-700' 
                                  : comment.influenceScore >= 5 
                                  ? 'bg-yellow-100 text-yellow-700' 
                                  : 'bg-gray-100 text-gray-700'
                              }`}>
                                ⚡ {comment.influenceScore?.toFixed(1) || '0'}
                              </span>
                            </div>
                          </div>
                          <p className="text-xs text-gray-700 leading-relaxed line-clamp-2">
                            {comment.body}
                          </p>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {(comment.flagReasons || []).map((reason: string, i: number) => (
                              <span 
                                key={i} 
                                className="px-1.5 py-0.5 text-[10px] bg-red-100 text-red-700 rounded"
                              >
                                {reason}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}


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
