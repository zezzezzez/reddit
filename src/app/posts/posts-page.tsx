'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Search, Filter, ExternalLink, MessageSquare, Clock,
  RefreshCw, ChevronDown, AlertTriangle, Shield, CheckCircle,
  Trash2, Eye, Loader2, Radar, CircleDot, Wifi, WifiOff,
} from 'lucide-react';

const ALERT_STYLES: Record<string, { bg: string; border: string; text: string; badge: string; label: string }> = {
  critical: { bg: 'bg-red-500/15', border: 'border-red-500/40', text: 'text-red-400', badge: 'bg-red-500', label: '严重' },
  high: { bg: 'bg-orange-500/15', border: 'border-orange-500/40', text: 'text-orange-400', badge: 'bg-orange-500', label: '高危' },
  medium: { bg: 'bg-yellow-500/15', border: 'border-yellow-500/40', text: 'text-yellow-400', badge: 'bg-yellow-500', label: '中等' },
  low: { bg: 'bg-blue-500/15', border: 'border-blue-500/40', text: 'text-blue-400', badge: 'bg-blue-500', label: '低危' },
  safe: { bg: 'bg-green-500/15', border: 'border-green-500/40', text: 'text-green-400', badge: 'bg-green-500', label: '安全' },
};

const CATEGORY_LABELS: Record<string, string> = {
  brand_attack: '品牌攻击',
  product_hate: '产品差评',
  negative_sentiment: '负面情绪',
  call_to_action_negative: '号召抵制',
  competitor_push: '竞品推荐',
};

const FILTER_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'critical', label: '严重' },
  { value: 'high', label: '高危' },
  { value: 'medium', label: '中等' },
  { value: 'low', label: '低危' },
  { value: 'safe', label: '安全' },
];

const SORT_OPTIONS = [
  { value: 'alert', label: '按预警等级' },
  { value: 'date', label: '按发布时间' },
  { value: 'comments', label: '按评论数' },
];

export default function PostsPage() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterLevel, setFilterLevel] = useState('all');
  const [sortBy, setSortBy] = useState('alert');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState('');
  const [scanResult, setScanResult] = useState<{success: boolean; message: string} | null>(null);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [networkStatus, setNetworkStatus] = useState<'checking' | 'connected' | 'disconnected' | 'rateLimited'>('checking');

  useEffect(() => {
    fetchPosts();
    checkNetwork();
  }, [filterLevel, sortBy, search]);

  const checkNetwork = async () => {
    setNetworkStatus('checking');
    try {
      const res = await fetch('/api/connectivity');
      const json = await res.json();
      if (json.rateLimited) {
        setNetworkStatus('rateLimited');
      } else {
        setNetworkStatus(json.connected ? 'connected' : 'disconnected');
      }
    } catch {
      setNetworkStatus('disconnected');
    }
  };

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterLevel !== 'all') params.set('level', filterLevel);
      if (sortBy) params.set('sort', sortBy);
      if (search) params.set('search', search);

      const res = await fetch(`/api/posts?${params}`);
      const json = await res.json();
      setPosts(json.posts || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleScanAll = async (quickScan = false) => {
    // Check connectivity first
    if (networkStatus === 'disconnected') {
      setScanResult({ success: false, message: '无法连接 Reddit，请先开启外网代理/VPN，然后点击刷新网络状态' });
      return;
    }
    setScanning(true);
    setScanResult(null);
    setScanProgress(quickScan ? '' : '准备扫描...');

    // Start a timer to poll real-time scan progress
    const refreshInterval = setInterval(async () => {
      if (quickScan) return;
      try {
        const res = await fetch('/api/scan');
        const json = await res.json();
        if (json.isRunning && json.total > 0) {
          setScanProgress(`正在扫描 ${json.current}/${json.total}`);
          // Also refresh posts list to show updated alert levels
          const postsRes = await fetch('/api/posts?sort=alert');
          const postsJson = await postsRes.json();
          if (postsJson.posts) setPosts(postsJson.posts);
        }
      } catch {}
    }, 1000);

    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(quickScan ? { quickScan: true } : { scanAll: true }),
      });
      clearInterval(refreshInterval);
      const json = await res.json();
      setScanResult(json);
      await fetchPosts();
    } catch (e: any) {
      clearInterval(refreshInterval);
      setScanResult({ success: false, message: e.message || '扫描失败' });
    } finally {
      setScanning(false);
      setScanProgress('');
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">帖子管理</h1>
          <p className="text-sm text-muted mt-1">共 {posts.length} 个帖子正在监控中</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Network Status Indicator */}
          <button
            onClick={checkNetwork}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs border transition-colors ${
              networkStatus === 'connected' ? 'bg-green-500/10 border-green-500/30 text-green-400' :
              networkStatus === 'rateLimited' ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400' :
              networkStatus === 'disconnected' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
              'bg-gray-500/10 border-gray-500/30 text-gray-400'
            }`}
            title="点击刷新网络状态"
          >
            {networkStatus === 'checking' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
             networkStatus === 'connected' ? <Wifi className="w-3.5 h-3.5" /> :
             networkStatus === 'rateLimited' ? <Wifi className="w-3.5 h-3.5" /> :
             <WifiOff className="w-3.5 h-3.5" />}
            {networkStatus === 'connected' ? '网络正常' :
             networkStatus === 'rateLimited' ? '限速中' :
             networkStatus === 'disconnected' ? '无代理' : '检测中...'}
          </button>
          <button
            onClick={() => handleScanAll(false)}
            disabled={scanning}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radar className="w-4 h-4" />}
            {scanning ? (scanProgress || '扫描中...') : '扫描全部帖子'}
          </button>
          <button
            onClick={() => handleScanAll(true)}
            disabled={scanning}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radar className="w-4 h-4" />}
            {scanning ? scanProgress : '快速扫描'}
          </button>
          <button
            onClick={fetchPosts}
            className="flex items-center gap-2 px-4 py-2 bg-card hover:bg-card-hover border border-border text-foreground rounded-lg text-sm transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            刷新
          </button>
        </div>
      </div>

      {/* Scan Result Banner */}
      {scanResult && (
        <div className={`p-3 rounded-lg border flex items-center gap-2 ${
          scanResult.success ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'
        }`}>
          {scanResult.success ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          <span className="text-sm">{scanResult.message}</span>
          <button onClick={() => setScanResult(null)} className="ml-auto text-xs opacity-60 hover:opacity-100">关闭</button>
        </div>
      )}

      {/* Unscanned Tip */}
      {posts.length > 0 && posts.every(p => p.lastScanned === null) && !scanning && (
        <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center gap-2">
          <CircleDot className="w-4 h-4 text-blue-400" />
          <span className="text-sm text-blue-300">帖子已导入，但尚未扫描评论。点击上方「扫描全部帖子」按钮从 Reddit 抓取评论并分析情感倾向。</span>
        </div>
      )}

      {/* No Proxy Warning */}
      {networkStatus === 'disconnected' && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-2">
          <WifiOff className="w-4 h-4 text-red-400" />
          <span className="text-sm text-red-300">无法连接 Reddit，请开启外网代理/VPN后重试。开启代理后点击网络状态按钮刷新。</span>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            placeholder="搜索帖子标题、subreddit..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary"
          />
        </div>

        {/* Level Filter */}
        <div className="relative">
          <button
            onClick={() => { setShowFilterMenu(!showFilterMenu); setShowSortMenu(false); }}
            className="flex items-center gap-2 px-3 py-2 bg-card border border-border rounded-lg text-sm text-foreground hover:bg-card-hover"
          >
            <Filter className="w-4 h-4" />
            {FILTER_OPTIONS.find(f => f.value === filterLevel)?.label}
            <ChevronDown className="w-3 h-3" />
          </button>
          {showFilterMenu && (
            <div className="absolute top-full mt-1 left-0 bg-card border border-border rounded-lg shadow-lg z-10 py-1 min-w-[120px]">
              {FILTER_OPTIONS.map(option => (
                <button
                  key={option.value}
                  onClick={() => { setFilterLevel(option.value); setShowFilterMenu(false); }}
                  className={`w-full text-left px-3 py-1.5 text-sm hover:bg-card-hover ${
                    filterLevel === option.value ? 'text-primary' : 'text-foreground'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Sort */}
        <div className="relative">
          <button
            onClick={() => { setShowSortMenu(!showSortMenu); setShowFilterMenu(false); }}
            className="flex items-center gap-2 px-3 py-2 bg-card border border-border rounded-lg text-sm text-foreground hover:bg-card-hover"
          >
            排序: {SORT_OPTIONS.find(s => s.value === sortBy)?.label}
            <ChevronDown className="w-3 h-3" />
          </button>
          {showSortMenu && (
            <div className="absolute top-full mt-1 left-0 bg-card border border-border rounded-lg shadow-lg z-10 py-1 min-w-[140px]">
              {SORT_OPTIONS.map(option => (
                <button
                  key={option.value}
                  onClick={() => { setSortBy(option.value); setShowSortMenu(false); }}
                  className={`w-full text-left px-3 py-1.5 text-sm hover:bg-card-hover ${
                    sortBy === option.value ? 'text-primary' : 'text-foreground'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Quick filter badges */}
        <div className="flex items-center gap-1.5 ml-auto">
          {FILTER_OPTIONS.filter(f => f.value !== 'all').map(option => {
            const count = posts.filter(p => p.alertLevel === option.value).length;
            if (count === 0) return null;
            const style = ALERT_STYLES[option.value];
            return (
              <button
                key={option.value}
                onClick={() => setFilterLevel(option.value === filterLevel ? 'all' : option.value)}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  filterLevel === option.value
                    ? `${style.badge} text-white`
                    : `${style.bg} ${style.text}`
                }`}
              >
                {option.label} {count}
              </button>
            );
          })}
        </div>
      </div>

      {/* Posts Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-20 text-muted">
          <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>没有找到匹配的帖子</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {posts.map((post: any) => {
            const style = ALERT_STYLES[post.alertLevel] || ALERT_STYLES.safe;
            return (
              <Link
                key={post.id}
                href={`/posts/${post.id}`}
                className={`block p-4 rounded-xl border ${style.border} ${style.bg} hover:opacity-80 transition-all`}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    {!post.lastScanned ? (
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-gray-500/20 text-gray-400">
                        未扫描
                      </span>
                    ) : (
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${style.badge} text-white`}>
                        {style.label}
                      </span>
                    )}
                    <span className="text-xs text-muted">r/{post.subreddit}</span>
                  </div>
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.open(post.redditUrl, '_blank'); }}
                    className="text-muted hover:text-primary"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                </div>

                {/* Title */}
                <h3 className="text-sm font-medium text-foreground mb-2 line-clamp-2">{post.title}</h3>

                {/* Chinese Summary */}
                {post.summary && (
                  <p className="text-xs text-muted/80 mb-3 line-clamp-2 leading-relaxed">
                    {post.summary}
                  </p>
                )}

                {/* Stats */}
                <div className="flex items-center gap-4 text-xs text-muted mb-3">
                  <span className="flex items-center gap-1">
                    <MessageSquare className="w-3.5 h-3.5" />
                    {post.commentCount}
                  </span>
                  <span className="flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5" />
                    {post.flaggedComments || 0} 恶意
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {formatDate(post.createdAt)}
                  </span>
                </div>

                {/* Alert Reasons */}
                {post.alertReasons.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {post.alertReasons.map((reason: string) => (
                      <span key={reason} className="px-1.5 py-0.5 text-[10px] bg-red-500/10 text-red-300 rounded">
                        {CATEGORY_LABELS[reason] || reason}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
