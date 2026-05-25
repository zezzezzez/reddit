'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Keyword {
  word: string;
  count: number;
  trend: 'up' | 'down' | 'stable';
  category: 'brand' | 'product' | 'sentiment' | 'other';
  watched: boolean;
}

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  brand: { label: '品牌', color: 'bg-purple-500/20 text-purple-400' },
  product: { label: '产品', color: 'bg-blue-500/20 text-blue-400' },
  sentiment: { label: '情感', color: 'bg-orange-500/20 text-orange-400' },
  other: { label: '其他', color: 'bg-slate-500/20 text-slate-400' },
};

const TREND_ICONS: Record<string, { icon: string; color: string }> = {
  up: { icon: '\u2191', color: 'text-red-400' },
  down: { icon: '\u2193', color: 'text-green-400' },
  stable: { icon: '\u2192', color: 'text-slate-400' },
};

export default function KeywordsPage() {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  useEffect(() => {
    fetch('/api/keywords')
      .then(r => r.json())
      .then(json => setKeywords(json.keywords || []))
      .catch(console.error);
  }, []);

  const toggleWatch = async (word: string, watched: boolean) => {
    try {
      await fetch('/api/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word, watched: !watched }),
      });
      setKeywords(prev => prev.map(k => k.word === word ? { ...k, watched: !watched } : k));
    } catch (e) {
      console.error(e);
    }
  };

  // Watched keywords first, then filtered
  const filtered = keywords
    .filter(k => categoryFilter === 'all' || k.category === categoryFilter)
    .filter(k => !search || k.word.includes(search.toLowerCase()))
    .sort((a, b) => {
      if (a.watched !== b.watched) return a.watched ? -1 : 1;
      return b.count - a.count;
    });

  // Chart data: top 20
  const chartData = keywords.slice(0, 20).map(k => ({
    word: k.word,
    count: k.count,
    category: CATEGORY_LABELS[k.category]?.label || '其他',
  }));

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">关键词热度追踪</h1>
        <p className="text-sm text-muted mt-1">发现评论中的热门话题和趋势变化</p>
      </div>

      {/* Bar Chart */}
      <div className="bg-card rounded-xl p-5 border border-border">
        <h3 className="text-sm font-semibold text-foreground mb-3">Top 20 热词</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis type="number" stroke="#64748b" fontSize={12} />
            <YAxis dataKey="word" type="category" width={80} stroke="#64748b" fontSize={11} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
              labelStyle={{ color: '#f1f5f9' }}
            />
            <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="搜索关键词..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground w-64"
        />
        <div className="flex gap-2">
          {['all', 'brand', 'product', 'sentiment', 'other'].map(cat => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                categoryFilter === cat ? 'bg-primary text-white' : 'bg-card border border-border text-muted hover:text-foreground'
              }`}
            >
              {cat === 'all' ? '全部' : CATEGORY_LABELS[cat]?.label || cat}
            </button>
          ))}
        </div>
      </div>

      {/* Keyword List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(k => {
          const cat = CATEGORY_LABELS[k.category] || CATEGORY_LABELS.other;
          const trend = TREND_ICONS[k.trend] || TREND_ICONS.stable;
          return (
            <div key={k.word} className={`bg-card rounded-lg p-3 border ${k.watched ? 'border-yellow-500/40' : 'border-border'} flex items-center justify-between`}>
              <div className="flex items-center gap-2 min-w-0">
                {k.watched && <span className="text-yellow-400 text-xs">\u2605</span>}
                <span className="text-sm font-medium text-foreground truncate">{k.word}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${cat.color}`}>{cat.label}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-sm font-bold text-foreground">{k.count}</span>
                <span className={`text-xs ${trend.color}`}>{trend.icon}</span>
                <button
                  onClick={() => toggleWatch(k.word, k.watched)}
                  className="text-xs text-muted hover:text-yellow-400 transition-colors"
                  title={k.watched ? '取消关注' : '关注此词'}
                >
                  {k.watched ? '\u2605' : '\u2606'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {filtered.length === 0 && (
        <div className="bg-card rounded-xl p-8 border border-border text-center text-muted">
          暂无关键词数据，请先扫描帖子
        </div>
      )}
    </div>
  );
}
