'use client';

import { useState } from 'react';
import { Search, Download, ExternalLink, X, Tag, Clock, Hash, CheckCircle2, Loader2 } from 'lucide-react';

interface SearchPost {
  id: string;
  title: string;
  author: string;
  score: number;
  commentCount: number;
  subreddit: string;
  createdAt: string;
  permalink: string;
  selftext: string;
}

const TIMEFRAME_OPTIONS: { value: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all'; label: string }[] = [
  { value: 'hour', label: '最近 1 小时' },
  { value: 'day', label: '最近 1 天' },
  { value: 'week', label: '最近 1 周' },
  { value: 'month', label: '最近 1 个月' },
  { value: 'year', label: '最近 1 年' },
  { value: 'all', label: '不限时间' },
];

export default function SearchPage() {
  const [keywordInput, setKeywordInput] = useState('');
  const [subreddit, setSubreddit] = useState('');
  const [limit, setLimit] = useState(25);
  const [timeframe, setTimeframe] = useState<'hour' | 'day' | 'week' | 'month' | 'year' | 'all'>('month');

  const [results, setResults] = useState<SearchPost[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastQuery, setLastQuery] = useState<string | null>(null);
  const [diagInfo, setDiagInfo] = useState<{ rawItemCount: number; filteredPostCount: number; firstItemKeys?: string[] } | null>(null);

  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 解析关键词（支持逗号、空格、换行分隔）
  const parseKeywords = (input: string): string[] =>
    input.split(/[,\n\s]+/).map(k => k.trim()).filter(Boolean);

  const handleSearch = async () => {
    const keywords = parseKeywords(keywordInput);
    if (keywords.length === 0) {
      setError('请至少输入一个关键词');
      return;
    }

    setSearching(true);
    setError(null);
    setImportMessage(null);
    setSelectedIds(new Set());

    try {
      // 前端超时控制：3 分钟（Apify Actor 运行可能较慢）
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3 * 60 * 1000);

      let res: Response;
      try {
        res = await fetch('/api/reddit-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keywords, subreddit, limit, timeframe }),
          signal: controller.signal,
        });
      } catch (fetchErr: any) {
        clearTimeout(timeoutId);
        if (fetchErr.name === 'AbortError') {
          throw new Error('搜索超时（3 分钟），请稍后重试或减少数量 / 缩小 subreddit 范围');
        }
        throw fetchErr;
      }
      clearTimeout(timeoutId);

      const json = await res.json();

      if (!json.success) {
        setError(json.message || '搜索失败');
        setResults([]);
        return;
      }

      setResults(json.posts || []);
      setDiagInfo({
        rawItemCount: json.rawItemCount ?? 0,
        filteredPostCount: json.filteredPostCount ?? 0,
        firstItemKeys: json.firstItemKeys,
      });
      setLastQuery(`关键词：${keywords.join(' / ')}${subreddit ? ` · 话题：r/${subreddit}` : ' · 全局'} · 数量：${limit} · 时间：${TIMEFRAME_OPTIONS.find(t => t.value === timeframe)?.label}`);
    } catch (e: any) {
      setError(e.message || '搜索请求失败');
      setResults([]);
      setDiagInfo(null);
    } finally {
      setSearching(false);
    }
  };

  const handleImport = async (mode: 'selected' | 'all') => {
    const toImport = mode === 'all'
      ? results
      : results.filter(p => selectedIds.has(p.id));

    if (toImport.length === 0) {
      setImportMessage('请先选择要导入的帖子');
      return;
    }

    const confirmed = window.confirm(`确认导入 ${toImport.length} 个帖子到「帖子管理」？\n导入后可在「帖子管理」中进行情感扫描。`);
    if (!confirmed) return;

    setImporting(true);
    setImportMessage(null);

    try {
      const res = await fetch('/api/reddit-search', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ posts: toImport }),
      });
      const json = await res.json();

      if (!json.success) {
        setImportMessage(json.message || '导入失败');
        return;
      }
      setImportMessage(json.message || `成功导入 ${toImport.length} 个帖子`);
      setSelectedIds(new Set());
    } catch (e: any) {
      setImportMessage(e.message || '导入请求失败');
    } finally {
      setImporting(false);
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === results.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(results.map(p => p.id)));
    }
  };

  const removeKeyword = (kw: string) => {
    const kws = parseKeywords(keywordInput).filter(k => k !== kw);
    setKeywordInput(kws.join(', '));
  };

  const handleKeywordKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // 回车触发搜索
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch {
      return iso;
    }
  };

  const currentKeywords = parseKeywords(keywordInput);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
        <h1 className="text-2xl font-semibold text-gray-900">话题搜索</h1>
        <p className="text-sm text-gray-500 mt-1">按关键词从 Reddit 话题爬取帖子，无需提供帖子链接</p>
      </div>

      {/* Search Form */}
      <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-6 space-y-5">
        {/* Keywords */}
        <div>
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-2">
            <Tag className="w-4 h-4 text-primary" />
            关键词
            <span className="text-xs text-gray-500 font-normal">（支持空格、逗号或换行分隔多个）</span>
          </label>
          <input
            type="text"
            value={keywordInput}
            onChange={e => setKeywordInput(e.target.value)}
            onKeyDown={handleKeywordKeyDown}
            placeholder="例如：Hisense U8QG mini-led"
            className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-sm"
          />
          {currentKeywords.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {currentKeywords.map(kw => (
                <span
                  key={kw}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-medium"
                >
                  {kw}
                  <button
                    onClick={() => removeKeyword(kw)}
                    className="hover:text-red-500 transition-colors"
                    aria-label={`移除 ${kw}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Subreddit */}
        <div>
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-2">
            <Hash className="w-4 h-4 text-primary" />
            Reddit 话题（subreddit）
            <span className="text-xs text-gray-500 font-normal">（可选，留空则全局搜索）</span>
          </label>
          <div className="flex items-center">
            <span className="text-sm text-gray-500 pl-3 pr-1">r/</span>
            <input
              type="text"
              value={subreddit}
              onChange={e => setSubreddit(e.target.value.replace(/^r\//, ''))}
              placeholder="例如：OLED 或 Hisense"
              className="flex-1 px-3 py-2 rounded-lg border border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-sm"
            />
          </div>
        </div>

        {/* Limit + Timeframe */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-2">
              <Download className="w-4 h-4 text-primary" />
              爬取帖子数量
              <span className="text-xs text-gray-500 font-normal">（1 ~ 100）</span>
            </label>
            <input
              type="number"
              min={1}
              max={100}
              value={limit}
              onChange={e => {
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v) && v >= 1 && v <= 100) setLimit(v);
              }}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-sm"
              placeholder="输入数量（默认 25）"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-2">
              <Clock className="w-4 h-4 text-primary" />
              发布时间限制
            </label>
            <select
              value={timeframe}
              onChange={e => setTimeframe(e.target.value as any)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-sm bg-white"
            >
              {TIMEFRAME_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Search Button */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSearch}
            disabled={searching}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {searching ? (
              <><Loader2 className="w-4 h-4 animate-spin" />搜索中...</>
            ) : (
              <><Search className="w-4 h-4" />开始搜索</>
            )}
          </button>
          {results.length > 0 && (
            <span className="text-xs text-gray-500">
              共找到 {results.length} 个帖子
              {diagInfo && diagInfo.rawItemCount !== diagInfo.filteredPostCount && (
                <span className="ml-2 text-orange-600">
                  （原始返回 {diagInfo.rawItemCount} / 过滤后 {diagInfo.filteredPostCount}）
                </span>
              )}
              {diagInfo && diagInfo.rawItemCount === diagInfo.filteredPostCount && diagInfo.rawItemCount === results.length && (
                <span className="ml-2 text-gray-400">（Actor 共返回 {diagInfo.rawItemCount} 项）</span>
              )}
            </span>
          )}
        </div>

        {error && (
          <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}
        {lastQuery && !error && (
          <div className="text-xs text-gray-500 px-1">{lastQuery}</div>
        )}
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50">
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={selectedIds.size === results.length && results.length > 0}
                onChange={toggleSelectAll}
                className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              全选
              <span className="text-xs text-gray-500">（已选 {selectedIds.size} / {results.length}）</span>
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleImport('selected')}
                disabled={importing || selectedIds.size === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-primary text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                导入选中
              </button>
              <button
                onClick={() => handleImport('all')}
                disabled={importing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-white text-primary border border-primary hover:bg-primary/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                导入全部
              </button>
            </div>
          </div>

          {importMessage && (
            <div className="flex items-center gap-2 px-5 py-2 bg-green-50 border-b border-green-100 text-sm text-green-700">
              <CheckCircle2 className="w-4 h-4" />
              {importMessage}
            </div>
          )}

          {/* Post List */}
          <div className="divide-y divide-gray-100 max-h-[700px] overflow-y-auto">
            {results.map((post, idx) => (
              <div
                key={post.id}
                className={`px-5 py-4 hover:bg-gray-50 transition-colors ${
                  selectedIds.has(post.id) ? 'bg-primary/5' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(post.id)}
                    onChange={() => toggleSelect(post.id)}
                    className="mt-1 w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 mb-1.5">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        <span className="text-xs font-bold text-primary mt-0.5">#{idx + 1}</span>
                        <a
                          href={post.permalink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-semibold text-gray-900 hover:text-primary transition-colors leading-tight line-clamp-2"
                        >
                          {post.title}
                        </a>
                      </div>
                      <a
                        href={post.permalink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-400 hover:text-primary flex-shrink-0"
                        title="在 Reddit 打开"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                      <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-semibold">
                        r/{post.subreddit}
                      </span>
                      <span>by u/{post.author}</span>
                      <span>🕒 {formatTime(post.createdAt)}</span>
                    </div>

                    {post.selftext && (
                      <p className="mt-2 text-xs text-gray-600 line-clamp-2 leading-relaxed">
                        {post.selftext}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!searching && results.length === 0 && !error && (
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-10 text-center">
          <Search className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-sm text-gray-500">输入关键词并点击搜索，从 Reddit 爬取相关帖子</p>
          <p className="text-xs text-gray-400 mt-1">提示：可以指定 subreddit 缩小范围，也可以留空做全局搜索</p>
        </div>
      )}
    </div>
  );
}
