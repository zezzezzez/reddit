'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Search, Filter, ExternalLink, MessageSquare, Clock,
  RefreshCw, ChevronDown, AlertTriangle, Shield, CheckCircle,
  Trash2, Eye, Loader2, Radar, CircleDot,
  Calendar, X, Square,
} from 'lucide-react';

const ALERT_STYLES: Record<string, { bg: string; border: string; text: string; badge: string; label: string }> = {
  critical: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-600', badge: 'bg-red-500', label: '严重' },
  high:     { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-600', badge: 'bg-red-500', label: '严重' },
  medium:   { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-600', badge: 'bg-yellow-500', label: '中等' },
  low:      { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-600', badge: 'bg-green-500', label: '安全' },
  safe:     { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-600', badge: 'bg-green-500', label: '安全' },
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
  { value: 'medium', label: '中等' },
  { value: 'safe', label: '安全' },
];

const SORT_OPTIONS = [
  { value: 'influence', label: '按影响力得分' },
  { value: 'alert', label: '按预警等级' },
  { value: 'negative', label: '按负面占比' },
  { value: 'date', label: '按发布时间' },
  { value: 'comments', label: '按评论数' },
];

// 快捷日期筛选选项
const QUICK_DATE_OPTIONS = [
  { label: '近7天', days: 7 },
  { label: '近30天', days: 30 },
  { label: '近90天', days: 90 },
];

export default function PostsPage() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterLevel, setFilterLevel] = useState('all');
  const [sortBy, setSortBy] = useState('influence');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState('');

  const [scanResult, setScanResult] = useState<{success: boolean; message: string} | null>(null);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const [deletingAll, setDeletingAll] = useState(false);
  const [selectedQuickDate, setSelectedQuickDate] = useState<string | null>(null);
  const [scanningPostId, setScanningPostId] = useState<string | null>(null);

  useEffect(() => {
    fetchPosts();
  }, [filterLevel, sortBy, search, dateFrom, dateTo]);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterLevel !== 'all') params.set('level', filterLevel);
      if (sortBy) params.set('sort', sortBy);
      if (search) params.set('search', search);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);

      const res = await fetch(`/api/posts?${params}`);
      const json = await res.json();
      setPosts(json.posts || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleStopScan = async () => {
    try {
      await fetch('/api/scan', { method: 'DELETE' });
      setScanProgress('正在停止...');
    } catch (e: any) {
      console.error('停止扫描失败:', e);
    }
  };

  const handleScanAll = async () => {
    setScanning(true);
    setScanResult(null);
    setScanProgress('准备扫描...');

    // Start a timer to poll real-time scan progress
    const refreshInterval = setInterval(async () => {
      try {
        const res = await fetch('/api/scan');
        const json = await res.json();
        if (json.isRunning && json.total > 0) {
          setScanProgress(`正在扫描 ${json.current}/${json.total}`);
        }
      } catch {}
    }, 500);

    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scanAll: true }),
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

  const handleScanSingle = async (postId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setScanningPostId(postId);
    setScanResult(null);
    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postIds: [postId] }),
      });
      const json = await res.json();
      if (json.success) {
        setScanResult({ success: true, message: json.message || '扫描完成' });
      } else {
        setScanResult({ success: false, message: json.message || json.error || '扫描失败' });
      }
      await fetchPosts();
    } catch (err: any) {
      setScanResult({ success: false, message: err.message || '扫描失败' });
    } finally {
      setScanningPostId(null);
    }
  };

  const handleDeletePost = async (postId: string, postTitle: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm(`确定要删除帖子 "${postTitle.substring(0, 30)}${postTitle.length > 30 ? '...' : ''}" 吗？`)) {
      return;
    }

    setDeletingPostId(postId);
    try {
      const res = await fetch('/api/posts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId }),
      });
      const json = await res.json();
      
      if (json.success) {
        // 从列表中移除
        setPosts(prev => prev.filter(p => p.id !== postId));
      } else {
        alert('删除失败：' + json.message);
      }
    } catch (error: any) {
      alert('删除失败：' + error.message);
    } finally {
      setDeletingPostId(null);
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm(`确定要删除全部 ${posts.length} 个帖子及其评论数据吗？此操作不可恢复！`)) {
      return;
    }
    setDeletingAll(true);
    try {
      const res = await fetch('/api/posts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleteAll: true }),
      });
      const json = await res.json();
      if (json.success) {
        setPosts([]);
      } else {
        alert('删除失败：' + json.message);
      }
    } catch (error: any) {
      alert('删除失败：' + error.message);
    } finally {
      setDeletingAll(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">帖子管理</h1>
            <p className="text-sm text-gray-500 mt-1">共 {posts.length} 个帖子正在监控中</p>
          </div>
          <div className="flex items-center gap-2">
            {scanning ? (
              <>
                <button
                  disabled
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium opacity-50 shadow-sm"
                >
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {scanProgress || '扫描中...'}
                </button>
                <button
                  onClick={handleStopScan}
                  className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
                >
                  <Square className="w-4 h-4" />
                  停止扫描
                </button>
              </>
            ) : (
              <button
                onClick={handleScanAll}
                className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
              >
                <Radar className="w-4 h-4" />
                扫描全部帖子
              </button>
            )}
            <button
              onClick={fetchPosts}
              className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 rounded-lg text-sm transition-colors shadow-sm"
            >
              <RefreshCw className="w-4 h-4" />
              刷新
            </button>
            {posts.length > 0 && (
              <button
                onClick={handleDeleteAll}
                disabled={deletingAll}
                className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 shadow-sm"
              >
                {deletingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                删除全部帖子
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Scan Result Banner */}
      {scanResult && (
        <div className={`p-3 rounded-lg border flex items-center gap-2 ${
          scanResult.success ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {scanResult.success ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          <span className="text-sm">{scanResult.message}</span>
          <button onClick={() => setScanResult(null)} className="ml-auto text-xs opacity-60 hover:opacity-100">关闭</button>
        </div>
      )}

      {/* Unscanned Tip */}
      {posts.length > 0 && posts.every(p => p.lastScanned === null) && !scanning && (
        <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 flex items-center gap-2">
          <CircleDot className="w-4 h-4 text-blue-600" />
          <span className="text-sm text-blue-700">帖子已导入，但尚未扫描评论。点击上方「扫描全部帖子」按钮从 Reddit 抓取评论并分析情感倾向。</span>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="relative w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索帖子..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary"
            />
          </div>

          {/* Level Filter */}
          <div className="relative">
            <button
              onClick={() => { setShowFilterMenu(!showFilterMenu); setShowSortMenu(false); }}
              className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
            >
              <Filter className="w-4 h-4" />
              {FILTER_OPTIONS.find(f => f.value === filterLevel)?.label}
              <ChevronDown className="w-3 h-3" />
            </button>
            {showFilterMenu && (
              <div className="absolute top-full mt-1 left-0 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1 min-w-[120px]">
                {FILTER_OPTIONS.map(option => (
                  <button
                    key={option.value}
                    onClick={() => { setFilterLevel(option.value); setShowFilterMenu(false); }}
                    className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 ${
                      filterLevel === option.value ? 'text-primary font-medium' : 'text-gray-700'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Date Range Filter */}
          <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-3 py-1.5">
            <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setSelectedQuickDate(null); }}
              className="bg-transparent text-sm text-gray-700 focus:outline-none w-[130px]"
              title="开始日期"
            />
            <span className="text-gray-400 text-xs">—</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setSelectedQuickDate(null); }}
              className="bg-transparent text-sm text-gray-700 focus:outline-none w-[130px]"
              title="结束日期"
            />
            {(dateFrom || dateTo) && (
              <button
                onClick={() => { setDateFrom(''); setDateTo(''); setSelectedQuickDate(null); }}
                className="text-gray-400 hover:text-gray-700 ml-1"
                title="清除日期筛选"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>


          {/* Quick Date Filter Buttons */}
          <div className="flex items-center gap-1 ml-2">
            {QUICK_DATE_OPTIONS.map(opt => (
              <button
                key={opt.days}
                onClick={() => {
                  if (selectedQuickDate === String(opt.days)) {
                    // 已选中，再次点击取消筛选
                    setDateFrom('');
                    setDateTo('');
                    setSelectedQuickDate(null);
                  } else {
                    // 未选中，点击进行筛选
                    const today = new Date();
                    const targetDate = new Date(today.getTime() - opt.days * 24 * 60 * 60 * 1000);
                    const todayStr = today.toISOString().split('T')[0];
                    const targetStr = targetDate.toISOString().split('T')[0];
                    
                    setDateFrom(targetStr);
                    setDateTo(todayStr);
                    setSelectedQuickDate(String(opt.days));
                  }
                }}
                className={`px-2.5 py-1 text-xs rounded-md transition-all ${
                  selectedQuickDate === String(opt.days)
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Sort */}
          <div className="relative">
            <button
              onClick={() => { setShowSortMenu(!showSortMenu); setShowFilterMenu(false); }}
              className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
            >
              排序: {SORT_OPTIONS.find(s => s.value === sortBy)?.label}
              <ChevronDown className="w-3 h-3" />
            </button>
            {showSortMenu && (
              <div className="absolute top-full mt-1 left-0 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1 min-w-[140px]">
                {SORT_OPTIONS.map(option => (
                  <button
                    key={option.value}
                    onClick={() => { setSortBy(option.value); setShowSortMenu(false); }}
                    className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 ${
                      sortBy === option.value ? 'text-primary font-medium' : 'text-gray-700'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick filter badges - always show all levels */}
          <div className="flex items-center gap-1.5 ml-auto">
            {FILTER_OPTIONS.filter(f => f.value !== 'all').map(option => {
              const count = posts.filter(p => p.alertLevel === option.value || (option.value === 'critical' && p.alertLevel === 'high') || (option.value === 'safe' && p.alertLevel === 'low')).length;
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
      </div>

      {/* Posts Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
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
                className={`block p-4 rounded-lg border ${style.border} ${style.bg} hover:shadow-md transition-all`}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    {post.scanError ? (
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-orange-100 text-orange-600" title={post.scanError}>
                        扫描失败
                      </span>
                    ) : !post.lastScanned ? (
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-gray-100 text-gray-600">
                        未扫描
                      </span>
                    ) : (
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${style.badge} text-white`}>
                        {style.label}
                      </span>
                    )}
                    <span className="text-xs text-gray-500">r/{post.subreddit}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => handleScanSingle(post.id, e)}
                      disabled={scanningPostId === post.id || scanning}
                      className="p-1 text-gray-300 hover:text-blue-500 transition-colors disabled:opacity-50"
                      title="扫描此帖子评论"
                    >
                      {scanningPostId === post.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Radar className="w-3 h-3" />}
                    </button>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDeletePost(post.id, post.title, e);
                      }}
                      disabled={deletingPostId === post.id}
                      className="p-1 text-gray-300 hover:text-red-500 transition-colors disabled:opacity-50"
                      title="删除此帖子"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.open(post.redditUrl, '_blank'); }}
                      className="p-1 text-gray-400 hover:text-primary transition-colors"
                      title="在Reddit中打开"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Title */}
                <h3 className="text-sm font-medium text-gray-900 mb-2 line-clamp-2">{post.title}</h3>

                {/* Chinese Summary */}
                {post.summary && (
                  <p className="text-xs text-gray-500 mb-3 line-clamp-2 leading-relaxed">
                    {post.summary}
                  </p>
                )}

                {/* Stats */}
                <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                  <span className="flex items-center gap-1">
                    <MessageSquare className="w-3.5 h-3.5" />
                    {post.totalCommentsFetched || post.commentCount || 0}
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
                      <span key={reason} className="px-1.5 py-0.5 text-[10px] bg-red-100 text-red-700 rounded">
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
