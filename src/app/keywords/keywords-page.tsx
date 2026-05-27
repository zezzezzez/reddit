'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Search, Calendar, X, ChevronDown, Hash, CheckSquare, Square } from 'lucide-react';

interface Keyword {
  word: string;
  count: number;
}

// 分类标签映射（用于显示）
const CATEGORY_LABELS: Record<string, string> = {
  brand: '品牌关键词',
  scene: '场景关键词',
  model: '型号关键词',
  quality: '质量关键词',
};

export default function KeywordsPage() {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [loading, setLoading] = useState(true);
  const [subreddits, setSubreddits] = useState<string[]>([]);
  const [categories, setCategories] = useState<Record<string, string[]>>({});
  
  // Filters
  const [subreddit, setSubreddit] = useState('');
  const [keyword, setKeyword] = useState('');
  const [commentDateFrom, setCommentDateFrom] = useState('');
  const [commentDateTo, setCommentDateTo] = useState('');
  const [postDateFrom, setPostDateFrom] = useState('');
  const [postDateTo, setPostDateTo] = useState('');
  const [showSubredditMenu, setShowSubredditMenu] = useState(false);
  
  // 分类筛选（选中的关键词集合）
  const [selectedBrand, setSelectedBrand] = useState<Set<string>>(new Set());
  const [selectedScene, setSelectedScene] = useState<Set<string>>(new Set());
  const [selectedModel, setSelectedModel] = useState<Set<string>>(new Set());
  const [selectedQuality, setSelectedQuality] = useState<Set<string>>(new Set());

  const fetchKeywords = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (subreddit) params.set('subreddit', subreddit);
      if (keyword) params.set('keyword', keyword);
      if (commentDateFrom) params.set('commentDateFrom', commentDateFrom);
      if (commentDateTo) params.set('commentDateTo', commentDateTo);
      if (postDateFrom) params.set('postDateFrom', postDateFrom);
      if (postDateTo) params.set('postDateTo', postDateTo);
      
      // 分类筛选参数
      if (selectedBrand.size > 0) params.set('brandKeywords', Array.from(selectedBrand).join(','));
      if (selectedScene.size > 0) params.set('sceneKeywords', Array.from(selectedScene).join(','));
      if (selectedModel.size > 0) params.set('modelKeywords', Array.from(selectedModel).join(','));
      if (selectedQuality.size > 0) params.set('qualityKeywords', Array.from(selectedQuality).join(','));

      const res = await fetch(`/api/keywords?${params}`);
      const json = await res.json();
      setKeywords(json.keywords || []);
      setSubreddits(json.subreddits || []);
      setCategories(json.categories || {});
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeywords();
  }, [subreddit, keyword, commentDateFrom, commentDateTo, postDateFrom, postDateTo, selectedBrand, selectedScene, selectedModel, selectedQuality]);

  const clearFilters = () => {
    setSubreddit('');
    setKeyword('');
    setCommentDateFrom('');
    setCommentDateTo('');
    setPostDateFrom('');
    setPostDateTo('');
    setSelectedBrand(new Set());
    setSelectedScene(new Set());
    setSelectedModel(new Set());
    setSelectedQuality(new Set());
  };

  const hasFilters = subreddit || keyword || commentDateFrom || commentDateTo || postDateFrom || postDateTo || 
                     selectedBrand.size > 0 || selectedScene.size > 0 || selectedModel.size > 0 || selectedQuality.size > 0;

  const toggleKeyword = (category: string, keyword: string) => {
    const setters: Record<string, React.Dispatch<React.SetStateAction<Set<string>>>> = {
      brand: setSelectedBrand,
      scene: setSelectedScene,
      model: setSelectedModel,
      quality: setSelectedQuality,
    };
    const setter = setters[category];
    setter((prev: Set<string>) => {
      const next = new Set(prev);
      if (next.has(keyword)) {
        next.delete(keyword);
      } else {
        next.add(keyword);
      }
      return next;
    });
  };

  const selectAllCategory = (category: string) => {
    const setters: Record<string, React.Dispatch<React.SetStateAction<Set<string>>>> = {
      brand: setSelectedBrand,
      scene: setSelectedScene,
      model: setSelectedModel,
      quality: setSelectedQuality,
    };
    const setter = setters[category];
    const keywords = categories[category] || [];
    setter(new Set(keywords));
  };

  const clearCategory = (category: string) => {
    const setters: Record<string, React.Dispatch<React.SetStateAction<Set<string>>>> = {
      brand: setSelectedBrand,
      scene: setSelectedScene,
      model: setSelectedModel,
      quality: setSelectedQuality,
    };
    const setter = setters[category];
    setter(new Set());
  };

  // Chart data: top 20
  const chartData = keywords.slice(0, 20).map(k => ({
    keyword: k.word,
    count: k.count,
  }));

  // 渲染分类筛选器
  const renderCategoryFilter = (categoryKey: string, categoryKeywords: string[], selected: Set<string>) => {
    const allSelected = selected.size === categoryKeywords.length;
    const someSelected = selected.size > 0 && selected.size < categoryKeywords.length;
    
    return (
      <div className="bg-white rounded-lg p-3 border border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold text-gray-900">{CATEGORY_LABELS[categoryKey] || categoryKey}</h4>
          <div className="flex gap-2 text-xs">
            <button
              onClick={() => selectAllCategory(categoryKey)}
              className="text-primary hover:underline"
            >
              全选
            </button>
            <button
              onClick={() => clearCategory(categoryKey)}
              className="text-gray-500 hover:text-gray-700"
            >
              清空
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {categoryKeywords.map((kw) => {
            const isChecked = selected.has(kw);
            return (
              <label
                key={kw}
                className={`flex items-center gap-1.5 px-2 py-1.5 rounded cursor-pointer transition-colors text-xs ${
                  isChecked ? 'bg-primary/10 text-primary' : 'hover:bg-gray-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleKeyword(categoryKey, kw)}
                  className="hidden"
                />
                {isChecked ? (
                  <CheckSquare className="w-3.5 h-3.5 flex-shrink-0" />
                ) : (
                  <Square className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
                )}
                <span className="truncate">{kw}</span>
              </label>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">关键词热度追踪</h1>
          <p className="text-sm text-gray-500 mt-1">基于场景关键词的出现频率分析热门话题</p>
        </div>
      </div>

      {/* Bar Chart */}
      <div className="bg-white rounded-lg p-5 border border-gray-100 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Top 20 场景关键词</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis type="number" stroke="#9ca3af" fontSize={12} />
            <YAxis dataKey="keyword" type="category" width={100} stroke="#9ca3af" fontSize={11} />
            <Tooltip
              contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
              labelStyle={{ color: '#111827' }}
            />
            <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-100 rounded-lg p-4 space-y-4 shadow-sm">
        {/* Row 1: Basic Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Subreddit Filter */}
          <div className="relative">
            <button
              onClick={() => setShowSubredditMenu(!showSubredditMenu)}
              className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 min-w-[160px]"
            >
              <span className="text-gray-500">板块:</span>
              {subreddit || '全部'}
              <ChevronDown className="w-3 h-3 ml-auto" />
            </button>
            {showSubredditMenu && (
              <div className="absolute top-full mt-1 left-0 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1 min-w-[160px] max-h-60 overflow-y-auto">
                <button
                  onClick={() => { setSubreddit(''); setShowSubredditMenu(false); }}
                  className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 ${!subreddit ? 'text-primary font-medium' : 'text-gray-700'}`}
                >
                  全部板块
                </button>
                {subreddits.map(s => (
                  <button
                    key={s}
                    onClick={() => { setSubreddit(s); setShowSubredditMenu(false); }}
                    className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 ${subreddit === s ? 'text-primary font-medium' : 'text-gray-700'}`}
                  >
                    r/{s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Keyword Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索场景关键词..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary"
            />
          </div>

          {/* Clear Filters */}
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
            >
              <X className="w-4 h-4" />
              清除筛选
            </button>
          )}
        </div>

        {/* Row 2: Date Filters */}
        <div className="flex items-center gap-3 flex-wrap text-sm">
          <span className="text-gray-500">评论时间:</span>
          <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-3 py-1.5">
            <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <input
              type="date"
              value={commentDateFrom}
              onChange={(e) => setCommentDateFrom(e.target.value)}
              className="bg-transparent text-gray-700 focus:outline-none w-[130px]"
              title="评论开始日期"
            />
            <span className="text-gray-400 text-xs">—</span>
            <input
              type="date"
              value={commentDateTo}
              onChange={(e) => setCommentDateTo(e.target.value)}
              className="bg-transparent text-gray-700 focus:outline-none w-[130px]"
              title="评论结束日期"
            />
          </div>

          <span className="text-gray-500 ml-2">发帖时间:</span>
          <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-3 py-1.5">
            <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <input
              type="date"
              value={postDateFrom}
              onChange={(e) => setPostDateFrom(e.target.value)}
              className="bg-transparent text-gray-700 focus:outline-none w-[130px]"
              title="发帖开始日期"
            />
            <span className="text-gray-400 text-xs">—</span>
            <input
              type="date"
              value={postDateTo}
              onChange={(e) => setPostDateTo(e.target.value)}
              className="bg-transparent text-gray-700 focus:outline-none w-[130px]"
              title="发帖结束日期"
            />
          </div>
        </div>

        {/* Row 3: Category Filters */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-900">关键词分类筛选</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {Object.entries(categories).map(([key, catKeywords]) => {
              const selectedMap: Record<string, Set<string>> = {
                brand: selectedBrand,
                scene: selectedScene,
                model: selectedModel,
                quality: selectedQuality,
              };
              return (
                <div key={key}>
                  {renderCategoryFilter(key, catKeywords, selectedMap[key])}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Keyword Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : keywords.length === 0 ? (
        <div className="text-center py-20 text-gray-500 bg-white border border-gray-100 rounded-lg shadow-sm">
          <Hash className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>没有找到匹配的关键词数据</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {keywords.map(k => (
            <div
              key={k.word}
              className="bg-white rounded-lg p-4 border border-gray-100 hover:border-primary/50 transition-colors shadow-sm hover:shadow-md"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-900 truncate" title={k.word}>
                  {k.word}
                </span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-primary">{k.count}</span>
                <span className="text-xs text-gray-500">次</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
