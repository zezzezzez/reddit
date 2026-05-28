'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, AlertTriangle, BarChart3, ExternalLink, ChevronDown, Check, Sparkles, Target, TrendingDown } from 'lucide-react';

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
      {/* Header with gradient */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 p-6 text-white">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full"></div>
        <div className="absolute -bottom-5 -left-5 w-20 h-20 bg-white/10 rounded-full"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
              <Target className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold">竞品舆情对比</h1>
          </div>
          <p className="text-cyan-100 text-sm">
            对比同一板块下各品牌帖子的舆情表现，发现品牌优势与风险
          </p>
        </div>
      </div>

      {/* Input Section with glassmorphism */}
      <div className="relative group">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 via-blue-500/20 to-indigo-500/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all"></div>
        <div className="relative bg-white/80 backdrop-blur-xl rounded-2xl p-6 border border-white/50 shadow-xl shadow-cyan-500/10">
          <div className="flex flex-wrap gap-4 items-end">
            {/* Subreddit Selector */}
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full"></span>
                选择板块
              </label>
              <div className="relative">
                <button
                  onClick={() => setShowSubredditMenu(!showSubredditMenu)}
                  className="w-full px-4 py-3 bg-gradient-to-r from-gray-50 to-white border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-400 text-sm flex items-center justify-between transition-all hover:border-cyan-300"
                >
                  <span className={selectedSubreddit ? 'text-gray-900 font-medium' : 'text-gray-400'}>
                    {selectedSubreddit || '请选择板块'}
                  </span>
                  <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${showSubredditMenu ? 'rotate-180' : ''}`} />
                </button>
                {showSubredditMenu && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-xl z-20 max-h-64 overflow-y-auto">
                    {subreddits.map(subreddit => (
                      <button
                        key={subreddit}
                        onClick={() => {
                          setSelectedSubreddit(subreddit);
                          setShowSubredditMenu(false);
                        }}
                        className={`w-full px-4 py-3 text-sm text-left hover:bg-cyan-50 flex items-center gap-2 transition-colors ${selectedSubreddit === subreddit ? 'bg-cyan-50 text-cyan-700 font-medium' : 'text-gray-700'}`}
                      >
                        <span className="w-2 h-2 bg-cyan-500 rounded-full"></span>
                        r/{subreddit}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Brand Selector */}
            <div className="flex-1 min-w-[240px]">
              <label className="block text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
                选择竞品
              </label>
              <div className="relative">
                <button
                  onClick={() => setShowBrandMenu(!showBrandMenu)}
                  className="w-full px-4 py-3 bg-gradient-to-r from-gray-50 to-white border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 text-sm flex items-center justify-between transition-all hover:border-indigo-300"
                >
                  <span className={selectedBrands.length > 0 ? 'text-gray-900 font-medium' : 'text-gray-400'}>
                    {selectedBrands.length > 0 
                      ? selectedBrands.map(brand => COMPETITOR_BRANDS.find(b => b.value === brand)?.name).join(', ')
                      : '请选择品牌'}
                  </span>
                  <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${showBrandMenu ? 'rotate-180' : ''}`} />
                </button>
                {showBrandMenu && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-xl z-20">
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
                        className={`w-full px-4 py-3 text-sm text-left hover:bg-indigo-50 flex items-center justify-between transition-colors ${selectedBrands.includes(brand.value) ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700'}`}
                      >
                        <span>{brand.name}</span>
                        {selectedBrands.includes(brand.value) && (
                          <div className="w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Analyze Button */}
            <button
              onClick={handleAnalyze}
              disabled={loading || !selectedSubreddit}
              className="px-8 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl hover:from-cyan-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-sm flex items-center gap-2 transition-all shadow-lg shadow-cyan-500/30 hover:shadow-xl hover:shadow-cyan-500/40 hover:-translate-y-0.5 disabled:hover:translate-y-0"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>分析中...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  <span>开始分析</span>
                </>
              )}
            </button>
          </div>
          {progress && (
            <div className="mt-4 flex items-center gap-2 text-sm text-cyan-600">
              <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse"></div>
              {progress}
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      {data && (
        <div className="space-y-6 animate-in fade-in duration-500">
          {/* Brand Comparison Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(data.brands).map(([brandName, brandData], idx) => {
              const colors = BRAND_COLORS[brandName] || BRAND_COLORS['Hisense'];
              const totalComments = brandData.totalComments;
              const flaggedRatio = totalComments > 0 
                ? (brandData.flaggedComments / totalComments * 100).toFixed(1)
                : '0';

              return (
                <div 
                  key={brandName} 
                  className={`relative overflow-hidden bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group`}
                  style={{ animationDelay: `${idx * 100}ms` }}
                >
                  {/* Gradient accent */}
                  <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${colors.text.replace('text-', 'from-').replace('-700', '-400')} to-${colors.text.replace('text-', 'to-').replace('-700', '-600')}`}></div>
                  
                  <div className="flex items-center justify-between mb-4">
                    <h3 className={`text-lg font-bold ${colors.text}`}>{brandName}</h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold text-white ${colors.badge} shadow-lg`}>
                      {brandData.posts.length} 帖
                    </span>
                  </div>

                  <div className="space-y-3">
                    {/* Sentiment */}
                    <div className="flex items-center justify-between p-2 bg-gray-50 rounded-xl">
                      <span className="text-xs text-gray-500">平均情感</span>
                      <div className="flex items-center gap-1">
                        {brandData.avgSentiment > 0.1 ? (
                          <TrendingUp className="w-4 h-4 text-green-500" />
                        ) : brandData.avgSentiment < -0.1 ? (
                          <TrendingDown className="w-4 h-4 text-red-500" />
                        ) : null}
                        <span className={`text-sm font-bold ${getSentimentColor(brandData.avgSentiment)}`}>
                          {brandData.avgSentiment.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Comments */}
                    <div className="flex items-center justify-between p-2 bg-gray-50 rounded-xl">
                      <span className="text-xs text-gray-500">总评论数</span>
                      <span className="text-sm font-bold text-gray-900">{totalComments}</span>
                    </div>

                    {/* Flagged */}
                    <div className="flex items-center justify-between p-2 bg-red-50 rounded-xl">
                      <span className="text-xs text-red-600">恶意评论</span>
                      <span className="text-sm font-bold text-red-600">
                        {brandData.flaggedComments} ({flaggedRatio}%)
                      </span>
                    </div>

                    {/* Sentiment Distribution */}
                    <div className="pt-3 border-t border-gray-100">
                      <p className="text-xs text-gray-500 mb-2 font-medium">情感分布</p>
                      <div className="flex gap-1 h-3 rounded-full overflow-hidden bg-gray-100 shadow-inner">
                        {totalComments > 0 && (
                          <>
                            <div
                              className="bg-gradient-to-r from-green-400 to-green-500 transition-all"
                              style={{ width: `${(brandData.positiveCount / totalComments) * 100}%` }}
                              title={`正面: ${brandData.positiveCount}`}
                            />
                            <div
                              className="bg-gradient-to-r from-gray-400 to-gray-500 transition-all"
                              style={{ width: `${(brandData.neutralCount / totalComments) * 100}%` }}
                              title={`中性: ${brandData.neutralCount}`}
                            />
                            <div
                              className="bg-gradient-to-r from-red-400 to-red-500 transition-all"
                              style={{ width: `${(brandData.negativeCount / totalComments) * 100}%` }}
                              title={`负面: ${brandData.negativeCount}`}
                            />
                          </>
                        )}
                      </div>
                      <div className="flex justify-between mt-2 text-[10px] text-gray-400">
                        <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 bg-green-500 rounded"></span>{brandData.positiveCount}</span>
                        <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 bg-gray-500 rounded"></span>{brandData.neutralCount}</span>
                        <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 bg-red-500 rounded"></span>{brandData.negativeCount}</span>
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
        <div className="relative overflow-hidden bg-white rounded-2xl p-12 border border-gray-100 shadow-sm text-center">
          {/* Decorative elements */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-indigo-500/10 rounded-full blur-3xl"></div>
          
          <div className="relative z-10">
            <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-cyan-100 to-indigo-100 rounded-2xl flex items-center justify-center">
              <Target className="w-10 h-10 text-cyan-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">开始竞品分析</h3>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              选择 Reddit 板块和竞品品牌，系统将自动抓取并分析各品牌帖子的舆情数据
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {['Hisense', 'TCL', 'Samsung', 'Sony'].map(brand => (
                <span 
                  key={brand}
                  className="px-4 py-2 bg-gradient-to-r from-gray-50 to-gray-100 rounded-full text-sm font-medium text-gray-600 border border-gray-200"
                >
                  {brand}
                </span>
              ))}
            </div>
            <div className="mt-6 flex items-center justify-center gap-2 text-sm text-gray-400">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              支持品牌实时舆情对比
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
