'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';

interface SubredditStats {
  subreddit: string;
  totalPosts: number;
  totalComments: number;
  positiveRate: number;
  neutralRate: number;
  negativeRate: number;
  healthScore: number;
}

export default function ComparePage() {
  const [subreddits, setSubreddits] = useState<SubredditStats[]>([]);

  useEffect(() => {
    fetch('/api/compare')
      .then(r => r.json())
      .then(json => setSubreddits(json.subreddits || []))
      .catch(console.error);
  }, []);

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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {subreddits.map(s => (
          <div key={s.subreddit} className={`bg-card rounded-xl p-4 border ${healthBg(s.healthScore)}`}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-foreground">r/{s.subreddit}</p>
              <span className={`text-lg font-bold ${healthColor(s.healthScore)}`}>{s.healthScore}</span>
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
