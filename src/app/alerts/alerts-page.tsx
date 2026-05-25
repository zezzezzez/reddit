'use client';

import { useEffect, useState } from 'react';

interface AlertPost {
  id: string;
  title: string;
  subreddit: string;
  alertLevel: string;
  alertStatus: string;
  handler?: string;
  handleTime?: string;
  handleNote?: string;
  lastScanned: string;
  commentCount: number;
}

interface AlertStats {
  pending: number;
  processing: number;
  resolved: number;
  ignored: number;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: '待处理' },
  processing: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: '处理中' },
  resolved: { bg: 'bg-green-500/20', text: 'text-green-400', label: '已处理' },
  ignored: { bg: 'bg-slate-500/20', text: 'text-slate-400', label: '已忽略' },
};

const LEVEL_STYLES: Record<string, { text: string; label: string }> = {
  critical: { text: 'text-red-400', label: '严重' },
  high: { text: 'text-orange-400', label: '高危' },
  medium: { text: 'text-yellow-400', label: '中等' },
};

export default function AlertsPage() {
  const [posts, setPosts] = useState<AlertPost[]>([]);
  const [stats, setStats] = useState<AlertStats>({ pending: 0, processing: 0, resolved: 0, ignored: 0 });
  const [filter, setFilter] = useState('pending');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [handlerName, setHandlerName] = useState('');

  const fetchAlerts = async (status = filter) => {
    try {
      const res = await fetch(`/api/alerts?status=${status}`);
      const json = await res.json();
      setPosts(json.posts || []);
      setStats(json.stats || { pending: 0, processing: 0, resolved: 0, ignored: 0 });
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => { fetchAlerts(); }, []);

  const updateStatus = async (postId: string, alertStatus: string) => {
    try {
      await fetch('/api/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, alertStatus, handler: handlerName, handleNote: note }),
      });
      setExpandedId(null);
      setNote('');
      fetchAlerts();
    } catch (e) {
      console.error(e);
    }
  };

  const filterButtons = [
    { key: 'pending', label: '待处理', count: stats.pending },
    { key: 'processing', label: '处理中', count: stats.processing },
    { key: 'resolved', label: '已处理', count: stats.resolved },
    { key: 'ignored', label: '已忽略', count: stats.ignored },
    { key: 'all', label: '全部', count: stats.pending + stats.processing + stats.resolved + stats.ignored },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">预警事件管理</h1>
          <p className="text-sm text-muted mt-1">跟踪和处理品牌声誉预警事件</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-card rounded-xl p-4 border border-yellow-500/30">
          <p className="text-sm text-muted">待处理</p>
          <p className="text-3xl font-bold text-yellow-400 mt-1">{stats.pending}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-blue-500/30">
          <p className="text-sm text-muted">处理中</p>
          <p className="text-3xl font-bold text-blue-400 mt-1">{stats.processing}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-green-500/30">
          <p className="text-sm text-muted">已处理</p>
          <p className="text-3xl font-bold text-green-400 mt-1">{stats.resolved}</p>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border">
          <p className="text-sm text-muted">已忽略</p>
          <p className="text-3xl font-bold text-slate-400 mt-1">{stats.ignored}</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {filterButtons.map(btn => (
          <button
            key={btn.key}
            onClick={() => { setFilter(btn.key); fetchAlerts(btn.key); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === btn.key
                ? 'bg-primary text-white'
                : 'bg-card border border-border text-muted hover:text-foreground'
            }`}
          >
            {btn.label} ({btn.count})
          </button>
        ))}
      </div>

      {/* Alert Posts List */}
      <div className="space-y-3">
        {posts.length === 0 && (
          <div className="bg-card rounded-xl p-8 border border-border text-center text-muted">
            当前筛选条件下没有预警事件
          </div>
        )}
        {posts.map(post => {
          const status = STATUS_STYLES[post.alertStatus] || STATUS_STYLES.pending;
          const level = LEVEL_STYLES[post.alertLevel] || { text: 'text-yellow-400', label: '中等' };
          const isExpanded = expandedId === post.id;

          return (
            <div key={post.id} className="bg-card rounded-xl border border-border overflow-hidden">
              <div
                className="p-4 cursor-pointer hover:bg-card-hover transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : post.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className={`${level.text} text-sm font-medium`}>{level.label}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${status.bg} ${status.text}`}>{status.label}</span>
                    <span className="text-xs text-muted">r/{post.subreddit}</span>
                    <span className="text-sm text-foreground truncate">{post.title}</span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                    <span className="text-xs text-muted">{post.commentCount}条评论</span>
                    {post.handler && <span className="text-xs text-muted">处理人: {post.handler}</span>}
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div className="px-4 pb-4 border-t border-border pt-3 space-y-3">
                  {post.handleNote && (
                    <div className="text-sm text-muted">
                      <span className="text-foreground font-medium">备注:</span> {post.handleNote}
                    </div>
                  )}
                  {post.handleTime && (
                    <div className="text-xs text-muted">
                      处理时间: {new Date(post.handleTime).toLocaleString('zh-CN')}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="处理人"
                      value={handlerName}
                      onChange={e => setHandlerName(e.target.value)}
                      className="px-3 py-1.5 bg-background border border-border rounded-lg text-sm text-foreground w-32"
                    />
                    <input
                      type="text"
                      placeholder="处理备注..."
                      value={note}
                      onChange={e => setNote(e.target.value)}
                      className="px-3 py-1.5 bg-background border border-border rounded-lg text-sm text-foreground flex-1"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => updateStatus(post.id, 'processing')}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
                    >标记处理中</button>
                    <button
                      onClick={() => updateStatus(post.id, 'resolved')}
                      className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm"
                    >标记已处理</button>
                    <button
                      onClick={() => updateStatus(post.id, 'ignored')}
                      className="px-3 py-1.5 bg-slate-600 hover:bg-slate-700 text-white rounded-lg text-sm"
                    >忽略</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
