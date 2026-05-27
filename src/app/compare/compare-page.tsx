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
      .then(json => setSubreddits(json.subreddits || []))
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
    score >= 80 ? 'text-green-400' : score >= 60 ? 'text-yellow-400' : score >= 40 ? 'text-orange-400' : 'text-red-400';

  const healthBg = (score: number) =>
    score >= 80 ? 'border-green-500/40' : score >= 60 ? 'border-yellow-500/40' : score >= 40 ? 'border-orange-500/40' : 'border-red-500/40';

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
      <div>
        <h1 className="text-xl font-bold text-foreground">多板块对比</h1>
        <p className="text-sm text-muted mt-1">按 Reddit 子版块对比舆情表现</p>
      </div>

      {/* Subreddit Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {subreddits.map(s => (
          <div key={s.subreddit} className={`bg-card rounded-xl border ${healthBg(s.healthScore)} overflow-hidden`}>
            {/* Card Header - Clickable */}
            <div 
              onClick={() => loadSubredditData(s.subreddit)}
              className="p-5 cursor-pointer hover:bg-white/5 transition-all duration-200 group"
            >
              {/* Top Row: Name + Health Score */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors">
                      r/{s.subreddit}
                    </h3>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted">
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
                  <span className="text-xs text-muted">健康度</span>
                </div>
              </div>

              {/* Health Bar */}
              <div className="w-full h-2.5 bg-muted/30 rounded-full overflow-hidden mb-4">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${healthBar(s.healthScore)}`} 
                  style={{ width: `${s.healthScore}%` }} 
                />
              </div>

              {/* Sentiment Rates */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-green-500/10 rounded-lg p-2.5 text-center border border-green-500/20">
                  <p className="text-lg font-bold text-green-400">{s.positiveRate}%</p>
                  <p className="text-xs text-green-300/70 mt-0.5">正面</p>
                </div>
                <div className="bg-slate-500/10 rounded-lg p-2.5 text-center border border-slate-500/20">
                  <p className="text-lg font-bold text-slate-400">{s.neutralRate}%</p>
                  <p className="text-xs text-slate-300/70 mt-0.5">中性</p>
                </div>
                <div className="bg-red-500/10 rounded-lg p-2.5 text-center border border-red-500/20">
                  <p className="text-lg font-bold text-red-400">{s.negativeRate}%</p>
                  <p className="text-xs text-red-300/70 mt-0.5">负面</p>
                </div>
              </div>

              {/* Expand Indicator */}
              <div className="flex items-center justify-center mt-4 text-muted">
                {expandedSubreddit === s.subreddit ? (
                  <ChevronUp className="w-5 h-5 group-hover:text-primary transition-colors" />
                ) : (
                  <ChevronDown className="w-5 h-5 group-hover:text-primary transition-colors" />
                )}
              </div>
            </div>

            {/* Expanded Content */}
            {expandedSubreddit === s.subreddit && (
              <div className="border-t border-border p-5 space-y-5 bg-gradient-to-b from-black/20 to-black/10">
                {/* Keywords Section */}
                {keywords.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-primary" />
                      关键词统计
                      <span className="text-xs text-muted font-normal">（按出现次数排序）</span>
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                      {keywords.map((kw, idx) => (
                        <div 
                          key={kw.word} 
                          className="bg-card rounded-lg p-3 border border-border hover:border-primary/30 transition-colors"
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-bold text-primary">#{idx + 1}</span>
                            <span className="text-xs text-muted px-1.5 py-0.5 rounded bg-muted/30">{kw.category}</span>
                          </div>
                          <p className="text-sm font-medium text-foreground truncate mb-1">{kw.word}</p>
                          <p className="text-2xl font-bold text-foreground">{kw.count}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Posts Section */}
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-primary" />
                    帖子列表
                    <span className="text-xs text-muted font-normal">（含恶意评论，按影响力排序）</span>
                  </h4>
                  {loading ? (
                    <div className="text-center py-8 text-muted">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      <p className="mt-2 text-sm">加载中...</p>
                    </div>
                  ) : posts.length > 0 ? (
                    <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                      {posts.map((post, idx) => (
                        <div 
                          key={post.id} 
                          className="bg-card rounded-xl border border-border hover:border-primary/40 transition-all duration-200 hover:shadow-lg"
                        >
                          {/* Post Header */}
                          <div className="p-4 border-b border-border/50">
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <div className="flex items-start gap-2 flex-1 min-w-0">
                                <span className="text-xs font-bold text-primary mt-1">#{idx + 1}</span>
                                <a 
                                  href={post.redditUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm font-semibold text-foreground hover:text-primary transition-colors leading-tight"
                                >
                                  {post.title}
                                </a>
                              </div>
                              <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap ${
                                post.alertLevel === 'critical' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                                post.alertLevel === 'high' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                                post.alertLevel === 'medium' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                                'bg-green-500/20 text-green-400 border border-green-500/30'
                              }`}>
                                {post.alertLevel === 'critical' ? '严重' :
                                 post.alertLevel === 'high' ? '高危' :
                                 post.alertLevel === 'medium' ? '中等' : '安全'}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-muted">
                              <span className="px-2 py-0.5 rounded font-semibold bg-primary/20 text-primary" title="所有恶意评论影响力得分之和">
                                ⚡ {post.influenceScore}
                              </span>
                              <span>📝 {post.commentCount} 评论</span>
                              <span>🚨 <span className="font-bold text-red-400">{post.flaggedCommentCount}</span> 恶意</span>
                            </div>
                          </div>

                          {/* Malicious Comments */}
                          {post.maliciousComments && post.maliciousComments.length > 0 && (
                            <div className="p-4 space-y-2.5">
                              <p className="text-xs font-semibold text-muted mb-2">恶意评论详情：</p>
                              {post.maliciousComments.map(comment => (
                                <div 
                                  key={comment.id} 
                                  className="bg-red-500/5 rounded-lg p-3 border border-red-500/20 hover:border-red-500/40 transition-colors"
                                >
                                  <div className="flex items-start justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-semibold text-foreground">@{comment.author}</span>
                                      <span className="text-xs text-muted">· {comment.score} 赞</span>
                                    </div>
                                    <span 
                                      className={`px-2 py-0.5 rounded font-semibold text-xs ${
                                        comment.influenceScore >= 20
                                          ? 'bg-red-500/25 text-red-300 border border-red-500/30'
                                          : comment.influenceScore >= 5
                                          ? 'bg-yellow-500/25 text-yellow-300 border border-yellow-500/30'
                                          : 'bg-gray-500/25 text-gray-300 border border-gray-500/30'
                                      }`}
                                      title="影响力得分 = log₁₀(点赞数+1)×5+1 × |情感得分|"
                                    >
                                      ⚡ {comment.influenceScore}
                                    </span>
                                  </div>
                                  <p className="text-xs text-foreground mb-2 leading-relaxed">{comment.body}</p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {comment.flagReasons.map((reason, i) => (
                                      <span key={i} className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
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
                    <div className="text-center py-12 text-muted">
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
        <div className="bg-card rounded-xl p-8 border border-border text-center text-muted">
          暂无板块数据，请先导入并扫描帖子
        </div>
      )}
    </div>
  );
}
