'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle, Shield, CheckCircle, MessageSquare,
  TrendingUp, TrendingDown, Clock, RefreshCw, ExternalLink,
  Flame, Eye, ArrowUpRight, Wifi, WifiOff, Loader2, Bell, Send,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, Legend,
} from 'recharts';

interface DashboardData {
  stats: {
    totalPosts: number;
    criticalAlerts: number;
    highAlerts: number;
    mediumAlerts: number;
    safePosts: number;
    totalComments: number;
    flaggedComments: number;
    flaggedRatio: string;
  };
  sentimentDistribution: { positive: number; neutral: number; negative: number };
  categoryBreakdown: Record<string, number>;
  topFlaggedPosts: any[];
  recentFlagged: any[];
  trendData: any[];
}

const ALERT_STYLES = {
  critical: { bg: 'bg-red-500/15', border: 'border-red-500/40', text: 'text-red-400', badge: 'bg-red-500', label: '严重' },
  high: { bg: 'bg-orange-500/15', border: 'border-orange-500/40', text: 'text-orange-400', badge: 'bg-orange-500', label: '高危' },
  medium: { bg: 'bg-yellow-500/15', border: 'border-yellow-500/40', text: 'text-yellow-400', badge: 'bg-yellow-500', label: '中等' },
  low: { bg: 'bg-blue-500/15', border: 'border-blue-500/40', text: 'text-blue-400', badge: 'bg-blue-500', label: '低危' },
  safe: { bg: 'bg-green-500/15', border: 'border-green-500/40', text: 'text-green-400', badge: 'bg-green-500', label: '安全' },
};

const PIE_COLORS = ['#10b981', '#64748b', '#ef4444'];
const CATEGORY_LABELS: Record<string, string> = {
  brand_attack: '品牌攻击',
  product_hate: '产品差评',
  negative_sentiment: '负面情绪',
  call_to_action_negative: '号召抵制',
  competitor_push: '竞品推荐',
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState('');
  const [networkStatus, setNetworkStatus] = useState<'checking' | 'connected' | 'disconnected' | 'rateLimited'>('checking');
  const [pushing, setPushing] = useState(false);
  const [pushResult, setPushResult] = useState<{ success: boolean; message: string } | null>(null);
  const [notifyScheduler, setNotifyScheduler] = useState<{ enabled: boolean; scheduledTime: string | null; lastPushTime: string | null; lastPushResult: { success: boolean; message: string; postCount: number } | null } | null>(null);

  useEffect(() => {
    fetchDashboard();
    checkNetwork();
    fetchNotifyStatus();
  }, []);

  const fetchNotifyStatus = async () => {
    try {
      const res = await fetch('/api/notify');
      const json = await res.json();
      if (json.scheduler) setNotifyScheduler(json.scheduler);
    } catch {}
  };

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

  const fetchDashboard = async () => {
    try {
      const res = await fetch('/api/dashboard');
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const [isQuickScan, setIsQuickScan] = useState(false);

  const handleScan = async (quickScan = false) => {
    if (networkStatus === 'disconnected') {
      alert('无法连接 Reddit，请先开启外网代理/VPN');
      return;
    }
    if (networkStatus === 'rateLimited') {
      alert('Reddit 请求频率受限，请等待几分钟后再扫描');
      return;
    }
    setScanning(true);
    setIsQuickScan(quickScan);
    setScanProgress(quickScan ? '' : '准备扫描...');

    const progressInterval = setInterval(async () => {
      if (quickScan) return;
      try {
        const res = await fetch('/api/scan');
        const json = await res.json();
        if (json.isRunning && json.total > 0) {
          setScanProgress(`${json.current}/${json.total}`);
        }
      } catch {}
    }, 1000);

    try {
      await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(quickScan ? { quickScan: true } : { scanAll: true }),
      });
      await fetchDashboard();
    } catch (e) {
      console.error(e);
    } finally {
      clearInterval(progressInterval);
      setScanning(false);
      setIsQuickScan(false);
      setScanProgress('');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!data) return null;

  const sentimentPieData = [
    { name: '正面', value: data.sentimentDistribution.positive },
    { name: '中性', value: data.sentimentDistribution.neutral },
    { name: '负面', value: data.sentimentDistribution.negative },
  ];

  const categoryBarData = Object.entries(data.categoryBreakdown).map(([key, value]) => ({
    name: CATEGORY_LABELS[key] || key,
    count: value,
  }));

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">监控面板</h1>
          <p className="text-sm text-muted mt-1">Reddit 品牌声誉监控 · 海信(Hisense)</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Network Status */}
          <button
            onClick={checkNetwork}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs border transition-colors ${
              networkStatus === 'connected' ? 'bg-green-500/10 border-green-500/30 text-green-400' :
              networkStatus === 'rateLimited' ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400' :
              networkStatus === 'disconnected' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
              'bg-gray-500/10 border-gray-500/30 text-gray-400'
            }`
          }
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
          <div className="flex items-center gap-2 text-sm text-muted bg-card px-3 py-2 rounded-lg border border-border">
            <Clock className="w-4 h-4" />
            <span>上次扫描: 09:00</span>
          </div>
          <button
            onClick={() => handleScan(false)}
            disabled={scanning}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
            {scanning ? (isQuickScan ? '扫描中...' : (scanProgress || '扫描中...')) : '立即扫描'}
          </button>
          <button
            onClick={() => handleScan(true)}
            disabled={scanning}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
            {scanning ? (scanProgress || '扫描中...') : '快速扫描'}
          </button>
          {/* Push to Feishu */}
          <button
            onClick={async () => {
              setPushing(true);
              setPushResult(null);
              try {
                const res = await fetch('/api/notify', { method: 'PATCH' });
                const json = await res.json();
                setPushResult(json);
                fetchNotifyStatus();
              } catch (e: any) {
                setPushResult({ success: false, message: e.message || '推送失败' });
              } finally {
                setPushing(false);
              }
            }}
            disabled={pushing}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {pushing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {pushing ? '推送中...' : '推送预警'}
          </button>
        </div>
      </div>

      {/* Push Result Toast */}
      {pushResult && (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
          pushResult.success ? 'bg-green-500/10 border border-green-500/30 text-green-400' : 'bg-red-500/10 border border-red-500/30 text-red-400'
        }`}>
          {pushResult.success ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          {pushResult.message}
          <button onClick={() => setPushResult(null)} className="ml-auto text-xs opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Feishu Notify Status Bar */}
      {notifyScheduler && (
        <div className="flex items-center justify-between bg-card rounded-xl p-4 border border-border">
          <div className="flex items-center gap-3">
            <Bell className={`w-5 h-5 ${notifyScheduler.enabled ? 'text-green-400' : 'text-muted'}`} />
            <div>
              <span className="text-sm text-foreground">
                {notifyScheduler.enabled
                  ? `飞书预警推送已开启，每日 ${notifyScheduler.scheduledTime || '09:00'} 自动推送`
                  : '飞书预警推送未开启'}
              </span>
              {notifyScheduler.lastPushTime && (
                <span className="text-xs text-muted ml-3">
                  上次推送: {new Date(notifyScheduler.lastPushTime).toLocaleString('zh-CN')}
                  {notifyScheduler.lastPushResult && (
                    <span className={notifyScheduler.lastPushResult.success ? 'text-green-400' : 'text-red-400'}>
                      {' '}({notifyScheduler.lastPushResult.success ? '成功' : '失败'})
                    </span>
                  )}
                </span>
              )}
            </div>
          </div>
          {!notifyScheduler.enabled && (
            <Link href="/settings" className="text-xs text-primary hover:text-primary-hover flex items-center gap-1">
              去设置 <ArrowUpRight className="w-3 h-3" />
            </Link>
          )}
        </div>
      )}

      {/* Health Score Card */}
      {(() => {
        const total = data.sentimentDistribution.positive + data.sentimentDistribution.neutral + data.sentimentDistribution.negative;
        const negRatio = total > 0 ? data.sentimentDistribution.negative / total : 0;
        const flaggedRatioNum = parseFloat(data.stats.flaggedRatio);
        let healthScore = Math.max(0, Math.round(100 - negRatio * 60 - flaggedRatioNum * 0.8 - data.stats.criticalAlerts * 8 - data.stats.highAlerts * 4));
        healthScore = Math.min(100, Math.max(0, healthScore));
        const healthLabel = healthScore >= 80 ? '健康' : healthScore >= 60 ? '一般' : healthScore >= 40 ? '预警' : '高危';
        const borderColor = healthScore >= 80 ? 'border-green-500/40' : healthScore >= 60 ? 'border-yellow-500/40' : healthScore >= 40 ? 'border-orange-500/40' : 'border-red-500/40';
        const scoreColor = healthScore >= 80 ? 'text-green-400' : healthScore >= 60 ? 'text-yellow-400' : healthScore >= 40 ? 'text-orange-400' : 'text-red-400';
        const badgeColor = healthScore >= 80 ? 'bg-green-500/20 text-green-400' : healthScore >= 60 ? 'bg-yellow-500/20 text-yellow-400' : healthScore >= 40 ? 'bg-orange-500/20 text-orange-400' : 'bg-red-500/20 text-red-400';
        const barColor = healthScore >= 80 ? 'bg-green-500' : healthScore >= 60 ? 'bg-yellow-500' : healthScore >= 40 ? 'bg-orange-500' : 'bg-red-500';
        const posPct = total > 0 ? (data.sentimentDistribution.positive / total * 100) : 0;
        const neuPct = total > 0 ? (data.sentimentDistribution.neutral / total * 100) : 0;
        const negPct = total > 0 ? (data.sentimentDistribution.negative / total * 100) : 0;
        return (
          <div className={`bg-card rounded-xl p-5 border ${borderColor}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted mb-1">舆情健康度</p>
                <div className="flex items-baseline gap-2">
                  <span className={`text-5xl font-bold ${scoreColor}`}>{healthScore}</span>
                  <span className="text-lg text-muted">/100</span>
                  <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${badgeColor}`}>{healthLabel}</span>
                </div>
                {/* Progress bar */}
                <div className="w-64 h-3 bg-muted/30 rounded-full mt-3 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${barColor} transition-all duration-500`}
                    style={{ width: `${healthScore}%` }}
                  />
                </div>
              </div>
              <div className="text-right space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500"/>
                  <span className="text-xs text-muted">正面</span>
                  <div className="w-24 h-2 bg-muted/30 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full" style={{ width: `${posPct}%` }}/>
                  </div>
                  <span className="text-xs text-foreground w-12 text-right">{posPct.toFixed(1)}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-slate-500"/>
                  <span className="text-xs text-muted">中性</span>
                  <div className="w-24 h-2 bg-muted/30 rounded-full overflow-hidden">
                    <div className="h-full bg-slate-500 rounded-full" style={{ width: `${neuPct}%` }}/>
                  </div>
                  <span className="text-xs text-foreground w-12 text-right">{neuPct.toFixed(1)}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500"/>
                  <span className="text-xs text-muted">负面</span>
                  <div className="w-24 h-2 bg-muted/30 rounded-full overflow-hidden">
                    <div className="h-full bg-red-500 rounded-full" style={{ width: `${negPct}%` }}/>
                  </div>
                  <span className="text-xs text-foreground w-12 text-right">{negPct.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl p-4 border border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted">监控帖子</p>
              <p className="text-3xl font-bold text-foreground mt-1">{data.stats.totalPosts}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-primary" />
            </div>
          </div>
        </div>

        <div className="bg-card rounded-xl p-4 border border-red-500/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted">严重预警</p>
              <p className="text-3xl font-bold text-red-400 mt-1">{data.stats.criticalAlerts}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
              <Flame className="w-5 h-5 text-red-400 animate-pulse-alert" />
            </div>
          </div>
        </div>

        <div className="bg-card rounded-xl p-4 border border-orange-500/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted">高危预警</p>
              <p className="text-3xl font-bold text-orange-400 mt-1">{data.stats.highAlerts}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-orange-400" />
            </div>
          </div>
        </div>

        <div className="bg-card rounded-xl p-4 border border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted">恶意评论率</p>
              <p className="text-3xl font-bold text-foreground mt-1">{data.stats.flaggedRatio}%</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-yellow-400" />
            </div>
          </div>
          <p className="text-xs text-muted mt-2">
            {data.stats.flaggedComments} / {data.stats.totalComments} 条评论
          </p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Trend Chart */}
        <div className="lg:col-span-2 bg-card rounded-xl p-5 border border-border">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-semibold text-foreground">评论情感趋势 (7天)</h3>
            <div className="flex items-center gap-3 text-xs text-muted">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>正面: 情感分数 &gt; 0.1</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-500 inline-block"></span>中性: -0.1 ~ 0.1</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span>负面: 情感分数 &lt; -0.1</span>
            </div>
          </div>
          <p className="text-xs text-muted mb-3">纵轴表示对应情感类别的评论数量</p>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={data.trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickFormatter={(v) => v.slice(5)} />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                labelStyle={{ color: '#e2e8f0' }}
                formatter={(value, name) => [`${value} 条评论`, name]}
              />
              <Legend formatter={(value) => <span style={{ color: '#e2e8f0', fontSize: '12px' }}>{value}</span>} />
              <Area type="monotone" dataKey="positive" stroke="#10b981" fill="#10b981" fillOpacity={0.15} name="正面" />
              <Area type="monotone" dataKey="neutral" stroke="#64748b" fill="#64748b" fillOpacity={0.15} name="中性" />
              <Area type="monotone" dataKey="negative" stroke="#ef4444" fill="#ef4444" fillOpacity={0.15} name="负面" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Sentiment Pie */}
        <div className="bg-card rounded-xl p-5 border border-border">
          <h3 className="text-sm font-semibold text-foreground mb-1">评论情感分布</h3>
          <div className="flex items-center gap-2 text-xs text-muted mb-3">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>正面 &gt;0.1</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-500 inline-block"></span>中性</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span>负面 &lt;-0.1</span>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={sentimentPieData}
                cx="50%"
                cy="45%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={5}
                dataKey="value"
              >
                {sentimentPieData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={PIE_COLORS[index]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
              />
              <Legend
                formatter={(value) => <span style={{ color: '#e2e8f0', fontSize: '12px' }}>{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Category + Top Posts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Category Breakdown */}
        <div className="bg-card rounded-xl p-5 border border-border">
          <h3 className="text-sm font-semibold text-foreground mb-4">恶意类型分布</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={categoryBarData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis type="number" stroke="#94a3b8" fontSize={12} />
              <YAxis type="category" dataKey="name" stroke="#94a3b8" fontSize={11} width={70} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
              />
              <Bar dataKey="count" fill="#ef4444" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top Flagged Posts */}
        <div className="lg:col-span-2 bg-card rounded-xl p-5 border border-border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">高风险帖子</h3>
            <Link href="/posts" className="text-xs text-primary hover:text-primary-hover flex items-center gap-1">
              查看全部 <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {data.topFlaggedPosts.map((post: any) => {
              const style = ALERT_STYLES[post.alertLevel as keyof typeof ALERT_STYLES];
              return (
                <Link
                  key={post.id}
                  href={`/posts/${post.id}`}
                  className={`block p-3 rounded-lg border ${style.bg} ${style.border} hover:opacity-80 transition-opacity`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${style.badge} text-white`}>
                          {style.label}
                        </span>
                        <span className="text-xs text-muted">r/{post.subreddit}</span>
                      </div>
                      <p className="text-sm text-foreground truncate">{post.title}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted">
                        <span>{post.commentCount} 评论</span>
                        <span>·</span>
                        <span>{post.alertReasons.map((r: string) => CATEGORY_LABELS[r] || r).join(', ')}</span>
                      </div>
                    </div>
                    <ExternalLink className="w-4 h-4 text-muted flex-shrink-0 mt-1" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent Flagged Comments */}
      <div className="bg-card rounded-xl p-5 border border-border">
        <h3 className="text-sm font-semibold text-foreground mb-4">最新恶意评论</h3>
        <div className="space-y-3">
          {data.recentFlagged.map((comment: any) => (
            <div
              key={comment.id}
              className="p-3 rounded-lg bg-red-500/5 border border-red-500/20 animate-slide-in"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">u/{comment.author}</span>
                  <span className="text-xs text-muted">
                    {new Date(comment.createdAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {comment.flagReasons.map((r: string) => (
                    <span key={r} className="px-1.5 py-0.5 text-[10px] bg-red-500/20 text-red-300 rounded">
                      {CATEGORY_LABELS[r] || r}
                    </span>
                  ))}
                </div>
              </div>
              <p className="text-sm text-foreground/90 line-clamp-2">{comment.body}</p>
              <div className="flex items-center gap-3 mt-2 text-xs text-muted">
                <span>👍 {comment.score}</span>
                <span>情感分数: {comment.sentimentScore.toFixed(2)}</span>
                <a href={comment.permalink} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary-hover flex items-center gap-1">
                  查看原文 <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
