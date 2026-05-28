'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Search, Calendar, X, MessageSquare, Eye, ChevronDown } from 'lucide-react';

interface FlaggedComment {
  id: string;
  author: string;
  body: string;
  score: number;
  sentimentScore: number;
  influenceScore: number;
  createdAt: string;
  postId: string;
  postTitle: string;
  subreddit: string;
  postCreatedAt: string;
  postUrl: string;
  flagReasons: string[];
}

const CATEGORY_LABELS: Record<string, string> = {
  brand_attack: '品牌攻击',
  product_hate: '产品差评',
  negative_sentiment: '负面情绪',
  call_to_action_negative: '号召抵制',
  competitor_push: '竞品推荐',
};

export default function InfluencersPage() {
  const [comments, setComments] = useState<FlaggedComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [subreddits, setSubreddits] = useState<string[]>([]);
  
  // Filters
  const [subreddit, setSubreddit] = useState('');
  const [keyword, setKeyword] = useState('');
  const [authorFilter, setAuthorFilter] = useState('');
  const [commentDateFrom, setCommentDateFrom] = useState('');
  const [commentDateTo, setCommentDateTo] = useState('');
  const [postDateFrom, setPostDateFrom] = useState('');
  const [postDateTo, setPostDateTo] = useState('');
  const [showSubredditMenu, setShowSubredditMenu] = useState(false);

  const fetchComments = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (subreddit) params.set('subreddit', subreddit);
      if (keyword) params.set('keyword', keyword);
      if (authorFilter) params.set('author', authorFilter);
      if (commentDateFrom) params.set('commentDateFrom', commentDateFrom);
      if (commentDateTo) params.set('commentDateTo', commentDateTo);
      if (postDateFrom) params.set('postDateFrom', postDateFrom);
      if (postDateTo) params.set('postDateTo', postDateTo);

      const res = await fetch(`/api/influencers?${params}`);
      const json = await res.json();
      setComments(json.comments || []);
      setSubreddits(json.subreddits || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComments();
  }, [subreddit, keyword, authorFilter, commentDateFrom, commentDateTo, postDateFrom, postDateTo]);

  const clearFilters = () => {
    setSubreddit('');
    setKeyword('');
    setAuthorFilter('');
    setCommentDateFrom('');
    setCommentDateTo('');
    setPostDateFrom('');
    setPostDateTo('');
  };

  const hasFilters = subreddit || keyword || authorFilter || commentDateFrom || commentDateTo || postDateFrom || postDateTo;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getInfluenceBadge = (score: number) => {
    if (score >= 20) return { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' };
    if (score >= 10) return { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' };
    if (score >= 5) return { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-200' };
    return { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-200' };
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">恶意评论追踪</h1>
          <p className="text-sm text-muted mt-1">共 {comments.length} 条恶意评论，按影响力得分排序</p>
        </div>
        <button
          onClick={fetchComments}
          className="flex items-center gap-2 px-4 py-2 bg-card hover:bg-card-hover border border-border text-foreground rounded-lg text-sm transition-colors"
        >
          <Search className="w-4 h-4" />
          刷新
        </button>
      </div>

      {/* Filters */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        {/* Row 1: Subreddit + Keyword */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Subreddit Filter */}
          <div className="relative">
            <button
              onClick={() => setShowSubredditMenu(!showSubredditMenu)}
              className="flex items-center gap-2 px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground hover:bg-card-hover min-w-[160px]"
            >
              <span className="text-muted">板块:</span>
              {subreddit || '全部'}
              <ChevronDown className="w-3 h-3 ml-auto" />
            </button>
            {showSubredditMenu && (
              <div className="absolute top-full mt-1 left-0 bg-card border border-border rounded-lg shadow-lg z-10 py-1 min-w-[160px] max-h-60 overflow-y-auto">
                <button
                  onClick={() => { setSubreddit(''); setShowSubredditMenu(false); }}
                  className={`w-full text-left px-3 py-1.5 text-sm hover:bg-card-hover ${!subreddit ? 'text-primary' : 'text-foreground'}`}
                >
                  全部板块
                </button>
                {subreddits.map(s => (
                  <button
                    key={s}
                    onClick={() => { setSubreddit(s); setShowSubredditMenu(false); }}
                    className={`w-full text-left px-3 py-1.5 text-sm hover:bg-card-hover ${subreddit === s ? 'text-primary' : 'text-foreground'}`}
                  >
                    r/{s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Keyword Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              type="text"
              placeholder="搜索评论内容或帖子标题..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary"
            />
          </div>

          {/* Author Search */}
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              type="text"
              placeholder="搜索评论者名字..."
              value={authorFilter}
              onChange={(e) => setAuthorFilter(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary"
            />
          </div>

          {/* Clear Filters */}
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 px-3 py-2 text-sm text-muted hover:text-foreground"
            >
              <X className="w-4 h-4" />
              清除筛选
            </button>
          )}
        </div>

        {/* Row 2: Date Filters */}
        <div className="flex items-center gap-3 flex-wrap text-sm">
          <span className="text-muted">评论时间:</span>
          <div className="flex items-center gap-1.5 bg-background border border-border rounded-lg px-3 py-1.5">
            <Calendar className="w-4 h-4 text-muted flex-shrink-0" />
            <input
              type="date"
              value={commentDateFrom}
              onChange={(e) => setCommentDateFrom(e.target.value)}
              className="bg-transparent text-foreground focus:outline-none w-[130px]"
              title="评论开始日期"
            />
            <span className="text-muted text-xs">—</span>
            <input
              type="date"
              value={commentDateTo}
              onChange={(e) => setCommentDateTo(e.target.value)}
              className="bg-transparent text-foreground focus:outline-none w-[130px]"
              title="评论结束日期"
            />
          </div>

          <span className="text-muted ml-2">发帖时间:</span>
          <div className="flex items-center gap-1.5 bg-background border border-border rounded-lg px-3 py-1.5">
            <Calendar className="w-4 h-4 text-muted flex-shrink-0" />
            <input
              type="date"
              value={postDateFrom}
              onChange={(e) => setPostDateFrom(e.target.value)}
              className="bg-transparent text-foreground focus:outline-none w-[130px]"
              title="发帖开始日期"
            />
            <span className="text-muted text-xs">—</span>
            <input
              type="date"
              value={postDateTo}
              onChange={(e) => setPostDateTo(e.target.value)}
              className="bg-transparent text-foreground focus:outline-none w-[130px]"
              title="发帖结束日期"
            />
          </div>
        </div>
      </div>

      {/* Comments List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-20 text-muted bg-card border border-border rounded-xl">
          <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>没有找到匹配的恶意评论</p>
        </div>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => {
            const badge = getInfluenceBadge(comment.influenceScore);
            return (
              <div key={comment.id} className="bg-card border border-border rounded-xl overflow-hidden hover:border-red-500/30 transition-colors">
                <div className="p-4">
                  {/* Header: Author + Influence + Post Link */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-sm font-medium text-primary">u/{comment.author}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${badge.bg} ${badge.text} border ${badge.border}`}>
                        ⚡ {comment.influenceScore}
                      </span>
                      <span className="text-xs text-muted flex items-center gap-1">
                        <Eye className="w-3.5 h-3.5" />
                        {comment.score} 赞
                      </span>
                      <span className="text-xs text-muted">
                        评论于 {formatDate(comment.createdAt)}
                      </span>
                    </div>
                    <Link
                      href={comment.postUrl}
                      target="_blank"
                      className="flex items-center gap-1 text-xs text-muted hover:text-primary flex-shrink-0"
                    >
                      r/{comment.subreddit}
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  </div>

                  {/* Comment Body */}
                  <div className="bg-background rounded-lg p-3 mb-3">
                    <p className="text-sm text-foreground leading-relaxed line-clamp-3">
                      {comment.body}
                    </p>
                  </div>

                  {/* Footer: Post Title + Categories */}
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <Link
                      href={`/posts/${comment.postId}`}
                      className="text-xs text-primary hover:underline truncate max-w-md"
                      title={comment.postTitle}
                    >
                      📎 {comment.postTitle}
                    </Link>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {comment.flagReasons.map((reason) => (
                        <span
                          key={reason}
                          className="px-1.5 py-0.5 text-[10px] bg-red-500/10 text-red-300 rounded"
                        >
                          {CATEGORY_LABELS[reason] || reason}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
