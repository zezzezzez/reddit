'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { ChevronDown, ChevronUp, TrendingUp, MessageSquare } from 'lucide-react';

interface SubredditStats {
  subreddit: string;
  totalPosts: number;
  totalComments: number;
  positiveRate: number;
  neutralRate: number;
  negativeRate: number;
  healthScore: number;
}

interface Post {
  id: string;
  title: string;
  influenceScore: number;
  alertLevel: string;
  commentCount: number;
  flaggedCommentCount: number;
  redditUrl: string;
  maliciousComments?: MaliciousComment[];
}

interface MaliciousComment {
  id: string;
  author: string;
  body: string;
  score: number;
  sentimentScore: number;
  influenceScore: number;
  flagReasons: string[];
  permalink: string;
}

interface KeywordStats {
  word: string;
  count: number;
  category: string;
}

export default function ComparePage() {
  const [subreddits, setSubreddits] = useState<SubredditStats[]>([]);
  const [expandedSubreddit, setExpandedSubreddit] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [keywords, setKeywords] = useState<KeywordStats[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/compare')
      .then(r => r.json())
      .then(json => {
        const subreddits = json.subreddits || [];
        // 按健康度从低到高排序（风险高的在前）
        const sorted = subreddits.sort((a: SubredditStats, b: SubredditStats) => a.healthScore - b.healthScore);
        setSubreddits(sorted);
      })
      .catch(console.error);
  }, []);

  const loadSubredditData = async (subreddit: string) => {
    if (expandedSubreddit === subreddit) {
      setExpandedSubreddit(null);
      return;
    }

    setLoading(true);
    setExpandedSubreddit(subreddit);

    try {
      // Load posts with malicious comments
      const postsRes = await fetch(`/api/subreddit-detail?subreddit=${subreddit}`);
      const postsJson = await postsRes.json();
      setPosts(postsJson.posts || []);

      // Load keywords using the same API as keywords page
      const keywordsRes = await fetch(`/api/keywords?subreddit=${subreddit}`);
      const keywordsJson = await keywordsRes.json();
      setKeywords(keywordsJson.keywords || []);
    } catch (error) {
      console.error('Failed to load subreddit data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Health score color
  const healthColor = (score: number) =>
    score >= 80 ? 'text-green-600' : score >= 60 ? 'text-yellow-600' : score >= 40 ? 'text-orange-600' : 'text-red-600';

  const healthBg = (score: number) =>
    score >= 80 ? 'border-green-200' : score >= 60 ? 'border-yellow-200' : score >= 40 ? 'border-orange-200' : 'border-red-200';

  const healthBar = (score: number) =>
    score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-yellow-500' : score >= 40 ? 'bg-orange-500' : 'bg-red-500';

  // Bar chart data
  const barData = subreddits.map(s => ({
    name: `r/${s.subreddit}`,
    正面率: s.positiveRate,
    中性率: s.neutralRate,
    负面率: s.negativeRate,
  }));

  // Radar chart data (top 5 subreddits)
  const radarData = subreddits.slice(0, 5).map(s => ({
    subreddit: `r/${s.subreddit}`,
    正面率: s.positiveRate,
    中性率: s.neutralRate,
    负面率: Math.min(s.negativeRate, 100),
    活跃度: Math.min(s.totalComments / 2, 100),
    健康度: s.healthScore,
  }));

  const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6'];

  return (
    <div className="p-6 space-y-6">
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">多板块对比</h1>
          <p className="text-sm text-gray-500 mt-1">按 Reddit 子版块对比舆情表现</p>
        </div>
      </div>

      {/* Subreddit Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {subreddits.map(s => (
          <div key={s.subreddit} className={`bg-white rounded-lg border ${healthBg(s.healthScore)} overflow-hidden shadow-sm hover:shadow-md transition-shadow`}>
            {/* Card Header - Clickable */}
            <div 
              onClick={() => loadSubredditData(s.subreddit)}
              className="p-5 cursor-pointer hover:bg-gray-50 transition-all duration-200 group"
            >
              {/* Top Row: Name + Health Score */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-base font-semibold text-gray-900 group-hover:text-primary transition-colors">
                      r/{s.subreddit}
                    </h3>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      {s.totalPosts} 帖子
                    </span>
                    <span className="flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      {s.totalComments} 评论
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`text-3xl font-bold ${healthColor(s.healthScore)}`}>
                    {s.healthScore}
                  </span>
                  <span className="text-xs text-gray-500">健康度</span>
                </div>
              </div>

              {/* Health Bar */}
              <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden mb-4">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${healthBar(s.healthScore)}`} 
                  style={{ width: `${s.healthScore}%` }} 
                />
              </div>

              {/* Sentiment Rates */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-green-50 rounded-lg p-2.5 text-center border border-green-100">
                  <p className="text-lg font-bold text-green-600">{s.positiveRate}%</p>
                  <p className="text-xs text-green-600/70 mt-0.5">正面</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2.5 text-center border border-gray-200">
                  <p className="text-lg font-bold text-gray-600">{s.neutralRate}%</p>
                  <p className="text-xs text-gray-600/70 mt-0.5">中性</p>
                </div>
                <div className="bg-red-50 rounded-lg p-2.5 text-center border border-red-100">
                  <p className="text-lg font-bold text-red-600">{s.negativeRate}%</p>
                  <p className="text-xs text-red-600/70 mt-0.5">负面</p>
                </div>
              </div>

              {/* Expand Indicator */}
              <div className="flex items-center justify-center mt-4 text-gray-400">
                {expandedSubreddit === s.subreddit ? (
                  <ChevronUp className="w-5 h-5 group-hover:text-primary transition-colors" />
                ) : (
                  <ChevronDown className="w-5 h-5 group-hover:text-primary transition-colors" />
                )}
              </div>
            </div>

            {/* Expanded Content */}
            {expandedSubreddit === s.subreddit && (
              <div className="border-t border-gray-100 p-5 space-y-5 bg-gray-50">
                {/* Keywords Section */}
                {keywords.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-primary" />
                      关键词统计（Top 10）
                      <span className="text-xs text-gray-500 font-normal">（按出现次数排序）</span>
                    </h4>
                    <div className="space-y-2">
                      {keywords.slice(0, 10).map((kw, idx) => (
                        <div 
                          key={kw.word} 
                          className="bg-white rounded-lg p-3 border border-gray-200 hover:border-primary/50 transition-colors shadow-sm flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <span className="text-xs font-bold text-primary flex-shrink-0 w-8">#{idx + 1}</span>
                            <span className="text-xs text-gray-500 px-2 py-0.5 rounded bg-gray-100 flex-shrink-0">{kw.category}</span>
                            <p className="text-sm font-medium text-gray-900 truncate" title={kw.word}>{kw.word}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                            <span className="text-2xl font-bold text-gray-900">{kw.count}</span>
                            <span className="text-xs text-gray-500">次</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Posts Section */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-primary" />
                    帖子列表
                    <span className="text-xs text-gray-500 font-normal">（含恶意评论，按影响力排序）</span>
                  </h4>
                  {loading ? (
                    <div className="text-center py-8 text-gray-500">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      <p className="mt-2 text-sm">加载中...</p>
                    </div>
                  ) : posts.length > 0 ? (
                    <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                      {posts.map((post, idx) => (
                        <div 
                          key={post.id} 
                          className="bg-white rounded-lg border border-gray-200 hover:border-primary/50 transition-all duration-200 hover:shadow-lg"
                        >
                          {/* Post Header */}
                          <div className="p-4 border-b border-gray-100">
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <div className="flex items-start gap-2 flex-1 min-w-0">
                                <span className="text-xs font-bold text-primary mt-1">#{idx + 1}</span>
                                <a 
                                  href={post.redditUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm font-semibold text-gray-900 hover:text-primary transition-colors leading-tight"
                                >
                                  {post.title}
                                </a>
                              </div>
                              <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap ${
                                post.alertLevel === 'critical' ? 'bg-red-100 text-red-700 border border-red-200' :
                                post.alertLevel === 'high' ? 'bg-orange-100 text-orange-700 border border-orange-200' :
                                post.alertLevel === 'medium' ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' :
                                'bg-green-100 text-green-700 border border-green-200'
                              }`}>
                                {post.alertLevel === 'critical' ? '严重' :
                                 post.alertLevel === 'high' ? '高危' :
                                 post.alertLevel === 'medium' ? '中等' : '安全'}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <span className="px-2 py-0.5 rounded font-semibold bg-primary/10 text-primary" title="所有恶意评论影响力得分之和">
                                ⚡ {post.influenceScore}
                              </span>
                              <span>📝 {post.commentCount} 评论</span>
                              <span>🚨 <span className="font-bold text-red-600">{post.flaggedCommentCount}</span> 恶意</span>
                            </div>
                          </div>

                          {/* Malicious Comments */}
                          {post.maliciousComments && post.maliciousComments.length > 0 && (
                            <div className="p-4 space-y-2.5">
                              <p className="text-xs font-semibold text-gray-500 mb-2">恶意评论详情：</p>
                              {post.maliciousComments.map(comment => (
                                <div 
                                  key={comment.id} 
                                  className="bg-red-50 rounded-lg p-3 border border-red-200 hover:border-red-300 transition-colors"
                                >
                                  <div className="flex items-start justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-semibold text-gray-900">@{comment.author}</span>
                                      <span className="text-xs text-gray-500">· {comment.score} 赞</span>
                                    </div>
                                    <span 
                                      className={`px-2 py-0.5 rounded font-semibold text-xs ${
                                        comment.influenceScore >= 20
                                          ? 'bg-red-100 text-red-700 border border-red-200'
                                          : comment.influenceScore >= 5
                                          ? 'bg-yellow-100 text-yellow-700 border border-yellow-200'
                                          : 'bg-gray-100 text-gray-700 border border-gray-200'
                                      }`}
                                      title="影响力得分 = log₁₀(点赞数+1)×5+1 × |情感得分|"
                                    >
                                      ⚡ {comment.influenceScore}
                                    </span>
                                  </div>
                                  <p className="text-xs text-gray-900 mb-2 leading-relaxed">{comment.body}</p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {comment.flagReasons.map((reason, i) => (
                                      <span key={i} className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700 border border-red-200">
                                        {reason}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      <MessageSquare className="w-16 h-16 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">暂无恶意评论的帖子</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {subreddits.length === 0 && (
        <div className="bg-white rounded-lg p-8 border border-gray-100 text-center text-gray-500 shadow-sm">
          暂无板块数据，请先导入并扫描帖子
        </div>
      )}
    </div>
  );
}
