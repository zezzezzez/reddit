'use client';

import { useEffect, useState } from 'react';

interface Influencer {
  author: string;
  totalComments: number;
  avgScore: number;
  flaggedCount: number;
  topNegativeComment: string;
  influenceScore: number;
}

export default function InfluencersPage() {
  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [expandedAuthor, setExpandedAuthor] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'negative'>('all');

  useEffect(() => {
    fetch('/api/influencers')
      .then(r => r.json())
      .then(json => setInfluencers(json.influencers || []))
      .catch(console.error);
  }, []);

  const filtered = filter === 'negative'
    ? influencers.filter(i => i.flaggedCount > 0)
    : influencers;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">影响力用户识别</h1>
          <p className="text-sm text-muted mt-1">按影响力分数排序，识别高影响力负面用户</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === 'all' ? 'bg-primary text-white' : 'bg-card border border-border text-muted hover:text-foreground'}`}
          >全部用户</button>
          <button
            onClick={() => setFilter('negative')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === 'negative' ? 'bg-red-600 text-white' : 'bg-card border border-border text-muted hover:text-foreground'}`}
          >含负面评论</button>
        </div>
      </div>

      {/* Top 3 Highlight */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {filtered.slice(0, 3).map((user, idx) => (
            <div key={user.author} className={`bg-card rounded-xl p-5 border ${idx === 0 ? 'border-yellow-500/40' : idx === 1 ? 'border-slate-400/40' : 'border-orange-700/40'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${idx === 0 ? 'bg-yellow-500/20 text-yellow-400' : idx === 1 ? 'bg-slate-400/20 text-slate-300' : 'bg-orange-700/20 text-orange-400'}`}>
                  #{idx + 1}
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">u/{user.author}</p>
                  <p className="text-xs text-muted">影响力分数: {user.influenceScore}</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div><p className="text-lg font-bold text-foreground">{user.totalComments}</p><p className="text-xs text-muted">评论</p></div>
                <div><p className="text-lg font-bold text-foreground">{user.avgScore}</p><p className="text-xs text-muted">均分</p></div>
                <div><p className={`text-lg font-bold ${user.flaggedCount > 0 ? 'text-red-400' : 'text-foreground'}`}>{user.flaggedCount}</p><p className="text-xs text-muted">恶意</p></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Full List */}
      <div className="space-y-2">
        {filtered.slice(3).map(user => (
          <div key={user.author} className="bg-card rounded-xl border border-border overflow-hidden">
            <div
              className="p-4 flex items-center justify-between cursor-pointer hover:bg-card-hover transition-colors"
              onClick={() => setExpandedAuthor(expandedAuthor === user.author ? null : user.author)}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                  {user.author.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">u/{user.author}</p>
                  <p className="text-xs text-muted">影响力: {user.influenceScore} | 评论: {user.totalComments} | 均分: {user.avgScore}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {user.flaggedCount > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">{user.flaggedCount}条恶意</span>
                )}
              </div>
            </div>
            {expandedAuthor === user.author && user.topNegativeComment && (
              <div className="px-4 pb-4 border-t border-border pt-3">
                <p className="text-xs text-muted mb-1">最负面评论:</p>
                <p className="text-sm text-foreground bg-background p-3 rounded-lg">{user.topNegativeComment}</p>
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="bg-card rounded-xl p-8 border border-border text-center text-muted">
            暂无影响力用户数据
          </div>
        )}
      </div>
    </div>
  );
}
