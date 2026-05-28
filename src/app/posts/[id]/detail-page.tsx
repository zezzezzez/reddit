'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, ExternalLink, MessageSquare, AlertTriangle, Clock,
  ThumbsUp, ThumbsDown, Minus, Filter, ExternalLink as LinkIcon,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';

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

const PIE_COLORS = ['#10b981', '#64748b', '#ef4444'];

export default function PostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [commentFilter, setCommentFilter] = useState<'all' | 'flagged' | 'safe'>('all');

  useEffect(() => {
    if (params.id) fetchDetail();
  }, [params.id]);

  const fetchDetail = async () => {
    try {
      const res = await fetch(`/api/posts/${params.id}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-muted">
        <MessageSquare className="w-12 h-12 mb-3 opacity-50" />
        <p>帖子未找到</p>
        <button onClick={() => router.push('/posts')} className="mt-4 text-primary hover:text-primary-hover text-sm">
          返回帖子列表
        </button>
      </div>
    );
  }

  const { post, comments, summary } = data;
  const style = ALERT_STYLES[post.alertLevel] || ALERT_STYLES.safe;

  const sentimentPieData = [
    { name: '正面', value: summary.positive },
    { name: '中性', value: summary.neutral },
    { name: '负面', value: summary.negative },
  ];

  const categoryBarData = Object.entries(summary.categories || {}).map(([key, value]) => ({
    name: CATEGORY_LABELS[key] || key,
    count: value,
  }));

  const filteredComments = comments.filter((c: any) => {
    if (commentFilter === 'flagged') return c.isFlagged;
    if (commentFilter === 'safe') return !c.isFlagged;
    return true;
  });

  const getSentimentIcon = (score: number) => {
    if (score > 0.2) return <ThumbsUp className="w-4 h-4 text-green-400" />;
    if (score < -0.2) return <ThumbsDown className="w-4 h-4 text-red-400" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

  const getSentimentBar = (score: number) => {
    const width = Math.abs(score) * 100;
    const color = score > 0.2 ? 'bg-green-500' : score < -0.2 ? 'bg-red-500' : 'bg-gray-500';
    return (
      <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${width}%` }} />
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Back button */}
      <button
        onClick={() => router.push('/posts')}
        className="flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        返回帖子列表
      </button>

      {/* Post Header */}
      <div className={`p-5 rounded-lg border ${style.border} ${style.bg} shadow-sm`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className={`px-2 py-0.5 text-xs font-bold rounded ${style.badge} text-white`}>
                {style.label}
              </span>
              <span className="text-sm text-gray-600">r/{post.subreddit}</span>
              <span className="text-sm text-gray-400">·</span>
              <span className="text-sm text-gray-600">u/{post.author}</span>
            </div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">{post.title}</h1>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <span className="flex items-center gap-1">
                <MessageSquare className="w-4 h-4" />
                {post.commentCount} 评论
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {new Date(post.createdAt).toLocaleDateString('zh-CN')}
              </span>
              {post.alertReasons.length > 0 && (
                <div className="flex items-center gap-1.5">
                  {post.alertReasons.map((r: string) => (
                    <span key={r} className="px-1.5 py-0.5 text-[10px] bg-red-100 text-red-700 rounded">
                      {CATEGORY_LABELS[r] || r}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <a
            href={post.redditUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-3 py-2 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 shadow-sm"
          >
            <ExternalLink className="w-4 h-4" />
            Reddit原文
          </a>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-4 border border-gray-100 text-center shadow-sm">
          <p className="text-2xl font-semibold text-gray-900">{summary.total}</p>
          <p className="text-xs text-gray-500">总评论</p>
        </div>
        <div className="bg-white rounded-lg p-4 border border-red-200 text-center shadow-sm">
          <p className="text-2xl font-semibold text-red-600">{summary.flagged}</p>
          <p className="text-xs text-gray-500">恶意评论</p>
        </div>
        <div className="bg-white rounded-lg p-4 border border-orange-200 text-center shadow-sm">
          <p className="text-2xl font-semibold text-orange-600">{summary.totalInfluenceScore ?? 0}</p>
          <p className="text-xs text-gray-500">总影响力得分</p>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-100 text-center shadow-sm">
          <p className="text-2xl font-semibold text-gray-900">{summary.avgSentiment}</p>
          <p className="text-xs text-gray-500">平均情感分数</p>
        </div>
      </div>

      {/* Category Breakdown */}
      {categoryBarData.length > 0 && (
        <div className="bg-white rounded-lg p-5 border border-gray-100 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">恶意类型分析</h3>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={categoryBarData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" stroke="#9ca3af" fontSize={11} />
              <YAxis type="category" dataKey="name" stroke="#9ca3af" fontSize={11} width={70} />
              <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }} />
              <Bar dataKey="count" fill="#ef4444" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Comments Section */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-900">评论列表</h3>
          <div className="flex items-center gap-1.5">
            {(['all', 'flagged', 'safe'] as const).map(filter => (
              <button
                key={filter}
                onClick={() => setCommentFilter(filter)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  commentFilter === filter
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                {filter === 'all' ? '全部' : filter === 'flagged' ? '仅恶意' : '仅安全'}
              </button>
            ))}
          </div>
        </div>

        {/* Sentiment Legend */}
        <div className="flex items-center gap-4 mb-4 px-3 py-2 bg-white rounded-lg border border-gray-100 text-xs text-gray-600 shadow-sm">
          <span className="font-medium text-gray-900">情感分数图例：</span>
          <span className="flex items-center gap-1">
            <ThumbsUp className="w-3.5 h-3.5 text-green-600" />
            <span className="text-green-600">&gt; 0.1 正面</span>
          </span>
          <span className="flex items-center gap-1">
            <Minus className="w-3.5 h-3.5 text-gray-500" />
            <span className="text-gray-500">-0.1 ~ 0.1 中性</span>
          </span>
          <span className="flex items-center gap-1">
            <ThumbsDown className="w-3.5 h-3.5 text-red-600" />
            <span className="text-red-600">&lt; -0.1 负面</span>
          </span>
          <span className="text-gray-500 ml-2">| 👍 为 Reddit 点赞数</span>
        </div>

        <div className="space-y-3">
          {filteredComments.map((comment: any) => (
            <div
              key={comment.id}
              className={`p-4 rounded-lg border ${
                comment.isFlagged
                  ? 'bg-red-50 border-red-200'
                  : 'bg-white border-gray-100'
              } shadow-sm hover:shadow-md transition-shadow`}
            >
              {/* Comment Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-700">
                    {comment.author[0]?.toUpperCase() || '?'}
                  </div>
                  <span className="text-sm font-medium text-gray-900">u/{comment.author}</span>
                  <span className="text-xs text-gray-500">
                    {new Date(comment.createdAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {getSentimentIcon(comment.sentimentScore)}
                  {getSentimentBar(comment.sentimentScore)}
                  <span className="text-xs text-gray-600 w-12 text-right">{comment.sentimentScore.toFixed(2)}</span>
                </div>
              </div>

              {/* Comment Body */}
              <p className="text-sm text-gray-900 mb-3 leading-relaxed">{comment.body}</p>

              {/* Comment Footer */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-xs text-gray-600">
                  <span>👍 {comment.score}</span>
                  {comment.isFlagged && comment.flagReasons.map((r: string) => (
                    <span key={r} className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded">
                      {CATEGORY_LABELS[r] || r}
                    </span>
                  ))}
                  {/* 影响力得分 */}
                  {comment.isFlagged && comment.influenceScore !== undefined && (
                    <span
                      className={`px-2 py-0.5 rounded font-semibold ${
                        comment.influenceScore >= 20
                          ? 'bg-red-100 text-red-700'
                          : comment.influenceScore >= 5
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                      title="影响力得分 = log₁₀(点赞数+1)×5+1 × |情感得分|"
                    >
                      ⚡ {comment.influenceScore}
                    </span>
                  )}
                </div>
                <a
                  href={comment.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:text-primary-hover flex items-center gap-1"
                >
                  查看原文 <LinkIcon className="w-3 h-3" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
