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
      // Load posts with malicious comments and keywords for this subreddit
      const res = await fetch(`/api/subreddit-detail?subreddit=${subreddit}`);
      const json = await res.json();
      setPosts(json.posts || []);
      setKeywords(json.keywords || []);
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
      <div className="space-y-4">
        {subreddits.map(s => (
          <div key={s.subreddit} className={`bg-card rounded-xl border ${healthBg(s.healthScore)} overflow-hidden`}>
            {/* Card Header - Clickable */}
            <div 
              onClick={() => loadSubredditData(s.subreddit)}
              className="p-4 cursor-pointer hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-foreground">r/{s.subreddit}</p>
                  <span className="text-xs text-muted">{s.totalPosts} 帖子 · {s.totalComments} 评论</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-lg font-bold ${healthColor(s.healthScore)}`}>{s.healthScore}</span>
                  {expandedSubreddit === s.subreddit ? (
                    <ChevronUp className="w-5 h-5 text-muted" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-muted" />
                  )}
                </div>
              </div>
              {/* Health bar */}
              <div className="w-full h-2 bg-muted/30 rounded-full overflow-hidden mb-3">
                <div className={`h-full rounded-full ${healthBar(s.healthScore)}`} style={{ width: `${s.healthScore}%` }} />
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-sm font-bold text-green-400">{s.positiveRate}%</p>
                  <p className="text-xs text-muted">正面</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-400">{s.neutralRate}%</p>
                  <p className="text-xs text-muted">中性</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-red-400">{s.negativeRate}%</p>
                  <p className="text-xs text-muted">负面</p>
                </div>
              </div>
            </div>

            {/* Expanded Content */}
            {expandedSubreddit === s.subreddit && (
              <div className="border-t border-border p-4 space-y-4 bg-black/20">
                {/* Keywords Section */}
                {keywords.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      关键词统计（按出现次数排序）
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2">
                      {keywords.map((kw, idx) => (
                        <div key={kw.word} className="bg-card rounded-lg p-3 border border-border">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-primary">#{idx + 1}</span>
                            <span className="text-xs text-muted">{kw.category}</span>
                          </div>
                          <p className="text-sm font-medium text-foreground truncate">{kw.word}</p>
                          <p className="text-2xl font-bold text-foreground mt-1">{kw.count}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Posts Section */}
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    帖子列表（含恶意评论，按影响力排序）
                  </h4>
                  {loading ? (
                    <div className="text-center py-4 text-muted">加载中...</div>
                  ) : posts.length > 0 ? (
                    <div className="space-y-3 max-h-[600px] overflow-y-auto">
                      {posts.map((post, idx) => (
                        <div key={post.id} className="bg-card rounded-lg border border-border hover:border-primary/50 transition-colors">
                          {/* Post Header */}
                          <div className="p-3 border-b border-border">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <span className="text-xs font-bold text-primary">#{idx + 1}</span>
                                <a 
                                  href={post.redditUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm font-medium text-foreground hover:text-primary truncate"
                                >
                                  {post.title}
                                </a>
                              </div>
                              <span className={`px-2 py-0.5 rounded text-xs whitespace-nowrap ${
                                post.alertLevel === 'critical' ? 'bg-red-500/20 text-red-400' :
                                post.alertLevel === 'high' ? 'bg-orange-500/20 text-orange-400' :
                                post.alertLevel === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                                'bg-green-500/20 text-green-400'
                              }`}>
                                {post.alertLevel === 'critical' ? '严重' :
                                 post.alertLevel === 'high' ? '高危' :
                                 post.alertLevel === 'medium' ? '中等' : '安全'}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted">
                              <span>影响力: <span className="font-bold text-primary">{post.influenceScore}</span></span>
                              <span>评论: {post.commentCount}</span>
                              <span>恶意评论: <span className="font-bold text-red-400">{post.flaggedCommentCount}</span></span>
                            </div>
                          </div>

                          {/* Malicious Comments */}
                          {post.maliciousComments && post.maliciousComments.length > 0 && (
                            <div className="p-3 space-y-2">
                              <p className="text-xs font-semibold text-muted">恶意评论详情：</p>
                              {post.maliciousComments.map(comment => (
                                <div key={comment.id} className="bg-red-500/5 rounded-lg p-2 border border-red-500/20">
                                  <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-medium text-foreground">@{comment.author}</span>
                                      <span className="text-xs text-muted">· {comment.score} 赞</span>
                                    </div>
                                    <span className="text-xs font-bold text-red-400">影响力: {comment.influenceScore}</span>
                                  </div>
                                  <p className="text-xs text-foreground mb-1">{comment.body}</p>
                                  <div className="flex items-center gap-2">
                                    {comment.flagReasons.map((reason, i) => (
                                      <span key={i} className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-400">
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
                    <div className="text-center py-8 text-muted">
                      <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>暂无恶意评论的帖子</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Comparison Charts */}
      {subreddits.length > 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Bar Chart */}
          <div className="bg-card rounded-xl p-5 border border-border">
            <h3 className="text-sm font-semibold text-foreground mb-3">板块情感对比</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                  labelStyle={{ color: '#f1f5f9' }}
                />
                <Legend />
                <Bar dataKey="正面率" fill="#10b981" radius={[4, 4, 0, 0]} label={{ position: 'top', fill: '#10b981', fontSize: 11 }} />
                <Bar dataKey="中性率" fill="#64748b" radius={[4, 4, 0, 0]} label={{ position: 'top', fill: '#94a3b8', fontSize: 11 }} />
                <Bar dataKey="负面率" fill="#ef4444" radius={[4, 4, 0, 0]} label={{ position: 'top', fill: '#ef4444', fontSize: 11 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Radar Chart */}
          <div className="bg-card rounded-xl p-5 border border-border">
            <h3 className="text-sm font-semibold text-foreground mb-3">板块多维度雷达图</h3>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={radarData.length > 0 ? [
                { dimension: '正面率', ...Object.fromEntries(radarData.map((s, i) => [`r/${subreddits[i]?.subreddit}`, s.正面率])) },
                { dimension: '中性率', ...Object.fromEntries(radarData.map((s, i) => [`r/${subreddits[i]?.subreddit}`, s.中性率])) },
                { dimension: '负面率', ...Object.fromEntries(radarData.map((s, i) => [`r/${subreddits[i]?.subreddit}`, s.负面率])) },
                { dimension: '活跃度', ...Object.fromEntries(radarData.map((s, i) => [`r/${subreddits[i]?.subreddit}`, s.活跃度])) },
                { dimension: '健康度', ...Object.fromEntries(radarData.map((s, i) => [`r/${subreddits[i]?.subreddit}`, s.健康度])) },
              ] : []}>
                <PolarGrid stroke="#334155" />
                <PolarAngleAxis dataKey="dimension" stroke="#64748b" fontSize={12} />
                <PolarRadiusAxis stroke="#334155" fontSize={10} />
                {radarData.slice(0, 3).map((_, i) => (
                  <Radar key={i} name={`r/${subreddits[i]?.subreddit}`} dataKey={`r/${subreddits[i]?.subreddit}`} stroke={COLORS[i]} fill={COLORS[i]} fillOpacity={0.15} />
                ))}
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {subreddits.length === 0 && (
        <div className="bg-card rounded-xl p-8 border border-border text-center text-muted">
          暂无板块数据，请先导入并扫描帖子
        </div>
      )}
    </div>
  );
}
