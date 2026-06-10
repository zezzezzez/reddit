'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Database, RefreshCw, Key, Clock, Shield, Save,
  CheckCircle, XCircle, Loader2, ExternalLink,
  Upload, FileSpreadsheet, AlertCircle, Trash2, BrainCircuit, Sparkles, Bell, Send,
} from 'lucide-react';

export default function SettingsPage() {
  const [feishuConfig, setFeishuConfig] = useState({
    appId: '',
    appSecret: '',
    appToken: 'Ex9uwGiZLixftrkLoPmcae4Ynxg',
    tableId: '9dRNBr',
    urlFieldName: '发布完成后反链',
  });
  const [scanSchedule, setScanSchedule] = useState('0 9 * * *');
  const [autoScanEnabled, setAutoScanEnabled] = useState(false);
  const [scanTime, setScanTime] = useState('00:00');
  const [scanSaving, setScanSaving] = useState(false);
  const [scanSaved, setScanSaved] = useState(false);
  const [sentimentThreshold, setSentimentThreshold] = useState(-0.3);
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [openaiModel, setOpenaiModel] = useState('gpt-4o-mini');

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // File upload state
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ success: boolean; message: string; details?: any } | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // LLM state
  const [llmConfig, setLlmConfig] = useState({
    enabled: false,
    provider: 'openai' as string,
    apiKey: '',
    model: 'gpt-4o-mini',
    baseUrl: 'https://api.openai.com/v1',
    maxTokens: 1024,
    temperature: 0.1,
  });
  const [llmPresets, setLlmPresets] = useState<Record<string, { name: string; baseUrl: string; models: string[]; apiKeyLabel: string; apiKeyHint: string }>>({});
  const [llmTesting, setLlmTesting] = useState(false);
  const [llmTestResult, setLlmTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [llmSaving, setLlmSaving] = useState(false);
  const [llmCustomModel, setLlmCustomModel] = useState('');

  // Feishu Notify state
  const [notifyConfig, setNotifyConfig] = useState({
    enabled: false,
    mode: 'webhook' as string,
    webhookUrl: '',
    notifyTime: '09:00',
    notifyLevels: ['critical'] as string[],
    receiveUserId: '',
    receiveChatId: '',
  });
  const [notifyTesting, setNotifyTesting] = useState(false);
  const [notifyTestResult, setNotifyTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [notifySending, setNotifySending] = useState(false);
  const [notifySendResult, setNotifySendResult] = useState<{ success: boolean; message: string } | null>(null);
  const [notifyPreview, setNotifyPreview] = useState<{ hasAlerts: boolean; postCount: number; textPreview: string } | null>(null);

  // Detection rules state
  const [detectionRules, setDetectionRules] = useState({
    brand_attack: true,
    product_hate: true,
    negative_sentiment: true,
    call_to_action_negative: true,
    competitor_push: true,
  });
  const [rulesSaving, setRulesSaving] = useState(false);
  const [rulesSaved, setRulesSaved] = useState(false);

  // Load LLM, notify & detection rules config on mount
  useEffect(() => {
    fetch('/api/llm').then(r => r.json()).then(data => {
      if (data.llm) setLlmConfig(data.llm);
      if (data.presets) setLlmPresets(data.presets);
    }).catch(() => {});
    fetch('/api/notify').then(r => r.json()).then(data => {
      if (data.config) setNotifyConfig(data.config);
      if (data.preview) setNotifyPreview(data.preview);
    }).catch(() => {});
    fetch('/api/detection-rules').then(r => r.json()).then(data => {
      if (data.rules) setDetectionRules(data.rules);
    }).catch(() => {});
    fetch('/api/scan-schedule').then(r => r.json()).then(data => {
      if (typeof data.autoScanEnabled === 'boolean') setAutoScanEnabled(data.autoScanEnabled);
      if (data.scanTime) setScanTime(data.scanTime);
      if (data.scanSchedule) setScanSchedule(data.scanSchedule);
      if (typeof data.sentimentThreshold === 'number') setSentimentThreshold(data.sentimentThreshold);
    }).catch(() => {});
  }, []);

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/feishu', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(feishuConfig),
      });
      const json = await res.json();
      setTestResult(json);
    } catch (e: any) {
      setTestResult({ success: false, message: e.message || '连接失败' });
    } finally {
      setTesting(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch('/api/feishu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(feishuConfig),
      });
      const json = await res.json();
      setSyncResult(json);
    } catch (e: any) {
      setSyncResult({ success: false, message: e.message || '同步失败' });
    } finally {
      setSyncing(false);
    }
  };

  const handleLlmTest = async () => {
    setLlmTesting(true);
    setLlmTestResult(null);
    try {
      const res = await fetch('/api/llm', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(llmConfig),
      });
      const json = await res.json();
      setLlmTestResult(json);
      if (json.success) {
        await fetch('/api/llm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...llmConfig, enabled: true }),
        });
      }
    } catch (e: any) {
      setLlmTestResult({ success: false, message: e.message || 'LLM测试失败' });
    } finally {
      setLlmTesting(false);
    }
  };

  const handleLlmSave = async () => {
    setLlmSaving(true);
    try {
      const res = await fetch('/api/llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(llmConfig),
      });
      const json = await res.json();
      setLlmTestResult(json);
    } catch (e: any) {
      setLlmTestResult({ success: false, message: e.message || 'LLM保存失败' });
    } finally {
      setLlmSaving(false);
    }
  };

  const handleLlmProviderChange = (provider: string) => {
    const preset = llmPresets[provider];
    setLlmConfig(prev => ({
      ...prev,
      provider,
      model: preset?.models?.[0] || prev.model,
      baseUrl: preset?.baseUrl || prev.baseUrl,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    setUploadResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/import', {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();
      setUploadResult(json);
    } catch (e: any) {
      setUploadResult({ success: false, message: e.message || '文件上传失败' });
    } finally {
      setUploading(false);
    }
  };

  const scheduleLabels: Record<string, string> = {
    '0 9 * * *': '每天 09:00',
    '0 8 * * *': '每天 08:00',
    '0 10 * * *': '每天 10:00',
    '0 9,18 * * *': '每天 09:00, 18:00 (两次)',
    '0 0 * * *': '每天 00:00',
  };

  return (
    <div className="p-6 space-y-6 max-w-[1000px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">系统设置</h1>
          <p className="text-sm text-muted mt-1">配置飞书数据源、扫描策略和预警规则</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : saved ? (
            <CheckCircle className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saving ? '保存中...' : saved ? '已保存' : '保存设置'}
        </button>
      </div>

      {/* Data Import Section */}
      <div className="bg-card rounded-xl p-6 border border-border">
        <div className="flex items-center gap-2 mb-4">
          <Upload className="w-5 h-5 text-primary" />
          <h2 className="text-base font-semibold text-foreground">数据导入</h2>
          <span className="text-xs text-muted ml-2">选择以下任一方式导入Reddit帖子链接</span>
        </div>

        {/* File Upload Area */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-foreground mb-3">方式一：上传 Excel / CSV 文件</h3>
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
              dragActive ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              const file = e.dataTransfer.files[0];
              if (file) handleFileUpload(file);
            }}
          >
            <FileSpreadsheet className={`w-10 h-10 mx-auto mb-3 ${dragActive ? 'text-primary' : 'text-muted'}`} />
            <p className="text-sm text-foreground mb-1">
              拖拽文件到此处，或
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-primary hover:text-primary-hover underline ml-1"
              >
                点击选择文件
              </button>
            </p>
            <p className="text-xs text-muted">支持 .xlsx, .xls, .csv 格式，文件中需包含 Reddit 链接列</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
                e.target.value = '';
              }}
            />
          </div>
          {uploading && (
            <div className="mt-3 flex items-center gap-2 text-sm text-primary">
              <Loader2 className="w-4 h-4 animate-spin" />
              正在解析并导入文件...
            </div>
          )}
          {uploadResult && (
            <div className={`mt-3 p-3 rounded-lg border ${
              uploadResult.success ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'
            }`}>
              <div className="flex items-start gap-2">
                {uploadResult.success
                  ? <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                  : <XCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                }
                <div>
                  <p className={`text-sm ${uploadResult.success ? 'text-green-400' : 'text-red-400'}`}>
                    {uploadResult.message}
                  </p>
                  {uploadResult.details && (
                    <div className="mt-1 text-xs text-muted space-y-0.5">
                      <p>总行数: {uploadResult.details.totalRows}</p>
                      <p>新增帖子: {uploadResult.details.newPosts}</p>
                      {uploadResult.details.duplicatePosts > 0 && (
                        <p>已存在: {uploadResult.details.duplicatePosts}</p>
                      )}
                      {uploadResult.details.skippedRows > 0 && (
                        <p>跳过行数: {uploadResult.details.skippedRows}</p>
                      )}
                      {uploadResult.details.totalPostsAfter && (
                        <p>当前帖子总数: {uploadResult.details.totalPostsAfter}</p>
                      )}
                      {uploadResult.details.detectedColumns?.urlColumn && (
                        <p>识别到的链接列: {uploadResult.details.detectedColumns.urlColumn}</p>
                      )}
                      {uploadResult.details.detectedColumns?.titleColumn && (
                        <p>识别到的标题列: {uploadResult.details.detectedColumns.titleColumn}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-border"></div>
          <span className="text-xs text-muted">或</span>
          <div className="flex-1 h-px bg-border"></div>
        </div>

        {/* Feishu API */}
        <div>
          <h3 className="text-sm font-medium text-foreground mb-3">方式二：飞书多维表格 API 同步</h3>
          <div className="flex items-center gap-2 mb-3">
            <Database className="w-4 h-4 text-primary" />
            <a
              href="https://open.feishu.cn/document/server-docs/docs/bitable-v1/bitable-overview"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:text-primary-hover flex items-center gap-1 ml-auto"
            >
              API文档 <ExternalLink className="w-3 h-3" />
            </a>
          </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-muted mb-1.5">App ID</label>
            <input
              type="text"
              value={feishuConfig.appId}
              onChange={(e) => setFeishuConfig({ ...feishuConfig, appId: e.target.value })}
              placeholder="cli_xxxxxxxxxxxx"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-sm text-muted mb-1.5">App Secret</label>
            <input
              type="password"
              value={feishuConfig.appSecret}
              onChange={(e) => setFeishuConfig({ ...feishuConfig, appSecret: e.target.value })}
              placeholder="应用密钥"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-sm text-muted mb-1.5">多维表格 App Token</label>
            <input
              type="text"
              value={feishuConfig.appToken}
              onChange={(e) => setFeishuConfig({ ...feishuConfig, appToken: e.target.value })}
              placeholder="从表格URL中获取"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:border-primary"
            />
            <p className="text-xs text-muted mt-1">URL格式: feishu.cn/base/&lt;appToken&gt;</p>
          </div>
          <div>
            <label className="block text-sm text-muted mb-1.5">数据表 Table ID</label>
            <input
              type="text"
              value={feishuConfig.tableId}
              onChange={(e) => setFeishuConfig({ ...feishuConfig, tableId: e.target.value })}
              placeholder="tblXXXXXXXXXX"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:border-primary"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm text-muted mb-1.5">Reddit URL 字段名</label>
            <input
              type="text"
              value={feishuConfig.urlFieldName}
              onChange={(e) => setFeishuConfig({ ...feishuConfig, urlFieldName: e.target.value })}
              placeholder="多维表格中存放Reddit链接的字段名"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* Test & Sync Buttons */}
        <div className="flex items-center gap-3 mt-4 pt-4 border-t border-border">
          <button
            onClick={handleTestConnection}
            disabled={testing}
            className="flex items-center gap-2 px-4 py-2 bg-card hover:bg-card-hover border border-border rounded-lg text-sm text-foreground transition-colors disabled:opacity-50"
          >
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
            测试连接
          </button>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            同步数据
          </button>
          {testResult && (
            <div className={`flex items-center gap-1.5 text-sm ${testResult.success ? 'text-green-400' : 'text-red-400'}`}>
              {testResult.success ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              {testResult.message}
            </div>
          )}
          {syncResult && (
            <div className={`flex items-center gap-1.5 text-sm ${syncResult.success ? 'text-green-400' : 'text-red-400'}`}>
              {syncResult.success ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              {syncResult.message}
            </div>
          )}
        </div>
        </div>{/* end Feishu API section */}
      </div>{/* end Data Import Section */}

      {/* Scan Schedule */}
      <div className="bg-card rounded-xl p-6 border border-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            <h2 className="text-base font-semibold text-foreground">扫描策略</h2>
          </div>
          <button
            onClick={async () => {
              setScanSaving(true);
              try {
                const res = await fetch('/api/scan-schedule', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ autoScanEnabled, scanTime, scanSchedule, sentimentThreshold }),
                });
                const json = await res.json();
                if (json.success) {
                  setScanSaved(true);
                  setTimeout(() => setScanSaved(false), 3000);
                }
              } catch (e) {
                console.error('Save scan config failed', e);
              } finally {
                setScanSaving(false);
              }
            }}
            disabled={scanSaving}
            className="px-3 py-1.5 bg-primary text-white text-sm rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-1.5"
          >
            {scanSaving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : scanSaved ? (
              <CheckCircle className="w-3.5 h-3.5" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            {scanSaving ? '保存中...' : scanSaved ? '已保存' : '保存策略'}
          </button>
        </div>

        <div className="space-y-4">
          {/* Auto Scan Toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-background border border-border">
            <div className="flex items-center gap-3">
              <Clock className={`w-4 h-4 ${autoScanEnabled ? 'text-primary' : 'text-muted'}`} />
              <div>
                <p className="text-sm font-medium text-foreground">自动定时扫描</p>
                <p className="text-xs text-muted">开启后将按设定时间自动执行 Apify 扫描</p>
              </div>
            </div>
            <button
              onClick={() => setAutoScanEnabled(!autoScanEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                autoScanEnabled ? 'bg-primary' : 'bg-gray-600'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                autoScanEnabled ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>

          {autoScanEnabled && (
            <div className="pl-2 border-l-2 border-primary/30">
              <div className="flex items-center gap-3">
                <label className="text-sm text-muted w-20 shrink-0">扫描时间</label>
                <input
                  type="time"
                  value={scanTime}
                  onChange={e => setScanTime(e.target.value)}
                  className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary"
                />
                <span className="text-xs text-muted">每日在此时间自动执行扫描</span>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm text-muted mb-1.5">扫描频率</label>
            <select
              value={scanSchedule}
              onChange={(e) => setScanSchedule(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary"
            >
              {Object.entries(scheduleLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-muted mb-1.5">恶意评论阈值 (情感分数低于此值将被标记)</label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={-1}
                max={0}
                step={0.05}
                value={sentimentThreshold}
                onChange={(e) => setSentimentThreshold(parseFloat(e.target.value))}
                className="flex-1 accent-primary"
              />
              <span className="text-sm text-foreground font-mono w-12">{sentimentThreshold.toFixed(2)}</span>
            </div>
            <p className="text-xs text-muted mt-1">
              -1.0 = 标记所有评论, 0.0 = 仅标记明显恶意评论
            </p>
          </div>
        </div>
      </div>

      {/* AI / LLM Configuration Section */}
      <div className="bg-card rounded-xl p-6 border border-border">
        <div className="flex items-center gap-2 mb-4">
          <BrainCircuit className="w-5 h-5 text-primary" />
          <h2 className="text-base font-semibold text-foreground">AI 情感分析引擎</h2>
          <span className="px-2 py-0.5 text-[10px] bg-purple-500/20 text-purple-400 rounded flex items-center gap-1">
            <Sparkles className="w-3 h-3" />多模型支持
          </span>
        </div>

        <p className="text-sm text-muted mb-4">
          接入大模型可大幅提升情感分析准确率，支持理解上下文语义、反讽和隐含恶意。未开启时使用关键词匹配引擎。
        </p>

        <div className="space-y-4">
          {/* LLM Enable Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BrainCircuit className={`w-4 h-4 ${llmConfig.enabled ? 'text-purple-400' : 'text-muted'}`} />
              <span className="text-sm text-foreground">启用 AI 情感分析</span>
            </div>
            <button
              onClick={() => setLlmConfig({ ...llmConfig, enabled: !llmConfig.enabled })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                llmConfig.enabled ? 'bg-purple-500' : 'bg-gray-600'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                llmConfig.enabled ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>

          {llmConfig.enabled && (
            <div className="space-y-3 pl-2 border-l-2 border-purple-500/30">
              {/* Provider Selection */}
              <div className="flex items-center gap-3">
                <label className="text-sm text-muted w-20 shrink-0">AI 模型</label>
                <select
                  value={llmConfig.provider}
                  onChange={e => handleLlmProviderChange(e.target.value)}
                  className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-purple-500"
                >
                  {Object.entries(llmPresets).map(([key, preset]) => (
                    <option key={key} value={key}>{preset.name}</option>
                  ))}
                </select>
              </div>

              {/* Model Selection */}
              <div className="flex items-center gap-3">
                <label className="text-sm text-muted w-20 shrink-0">具体模型</label>
                {llmPresets[llmConfig.provider]?.models?.length ? (
                  <select
                    value={llmConfig.model}
                    onChange={e => setLlmConfig({ ...llmConfig, model: e.target.value })}
                    className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-purple-500"
                  >
                    {llmPresets[llmConfig.provider].models.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                ) : (
                  <div className="flex-1 flex items-center gap-2">
                    <input
                      type="text"
                      value={llmConfig.model}
                      onChange={e => setLlmConfig({ ...llmConfig, model: e.target.value })}
                      placeholder={llmConfig.provider === 'ollama' ? 'llama3, qwen2, gemma2...' : '输入模型名称'}
                      className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-purple-500"
                    />
                  </div>
                )}
              </div>

              {/* API Key */}
              <div className="flex items-center gap-3">
                <label className="text-sm text-muted w-20 shrink-0">
                  {llmPresets[llmConfig.provider]?.apiKeyLabel || 'API Key'}
                </label>
                <input
                  type="password"
                  value={llmConfig.apiKey}
                  onChange={e => setLlmConfig({ ...llmConfig, apiKey: e.target.value })}
                  placeholder={llmPresets[llmConfig.provider]?.apiKeyHint || '输入API Key'}
                  disabled={llmConfig.provider === 'ollama'}
                  className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:border-purple-500 disabled:opacity-50"
                />
              </div>

              {/* Base URL (collapsible/advanced) */}
              <div className="flex items-center gap-3">
                <label className="text-sm text-muted w-20 shrink-0">API 地址</label>
                <input
                  type="text"
                  value={llmConfig.baseUrl}
                  onChange={e => setLlmConfig({ ...llmConfig, baseUrl: e.target.value })}
                  placeholder="https://api.openai.com/v1"
                  className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground font-mono placeholder:text-muted/50 focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Temperature */}
              <div className="flex items-center gap-3">
                <label className="text-sm text-muted w-20 shrink-0">创造性</label>
                <div className="flex-1 flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.1}
                    value={llmConfig.temperature}
                    onChange={e => setLlmConfig({ ...llmConfig, temperature: parseFloat(e.target.value) })}
                    className="flex-1 accent-purple-500"
                  />
                  <span className="text-sm text-foreground font-mono w-8">{llmConfig.temperature.toFixed(1)}</span>
                </div>
                <span className="text-xs text-muted">0=精确, 1=创造</span>
              </div>

              {/* Preview */}
              <div className="text-xs text-muted bg-background/50 rounded-lg px-3 py-2">
                当前配置: <span className="text-foreground font-mono">{llmPresets[llmConfig.provider]?.name || llmConfig.provider}</span>
                {' / '}
                <span className="text-purple-400 font-mono">{llmConfig.model}</span>
                {' → '}
                <span className="text-foreground font-mono">{llmConfig.baseUrl}</span>
              </div>

              {/* Test & Save Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleLlmTest}
                  disabled={llmTesting}
                  className="flex items-center gap-1.5 px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground hover:bg-card-hover transition-colors disabled:opacity-50"
                >
                  {llmTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  测试连接
                </button>
                <button
                  onClick={handleLlmSave}
                  disabled={llmSaving}
                  className="flex items-center gap-1.5 px-3 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {llmSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  保存配置
                </button>
              </div>

              {/* Test Result */}
              {llmTestResult && (
                <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
                  llmTestResult.success ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                }`}>
                  {llmTestResult.success ? <CheckCircle className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
                  {llmTestResult.message}
                </div>
              )}

              {/* Tips */}
              <div className="text-xs text-muted/70 space-y-1">
                <p>支持的模型: OpenAI (GPT-4o), Anthropic (Claude), Google (Gemini), DeepSeek, 智谱 (GLM-4), 月之暗面 (Kimi), 通义千问, 豆包, Ollama (本地)</p>
                <p>大部分国产模型兼容 OpenAI 接口格式，如遇到问题可修改 API 地址</p>
                <p>提示: 开启 AI 后扫描速度会变慢（每条评论需调用 LLM），但准确率提升显著</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Feishu Notification Section */}
      <div className="bg-card rounded-xl p-6 border border-border">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-5 h-5 text-primary" />
          <h2 className="text-base font-semibold text-foreground">飞书预警推送</h2>
          <span className="px-2 py-0.5 text-[10px] bg-green-500/20 text-green-400 rounded">每日推送</span>
        </div>

        <p className="text-sm text-muted mb-4">
          每日自动将严重/高危帖子摘要推送到飞书群或个人，及时掌握品牌声誉风险。
        </p>

        <div className="space-y-4">
          {/* Enable Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className={`w-4 h-4 ${notifyConfig.enabled ? 'text-green-400' : 'text-muted'}`} />
              <span className="text-sm text-foreground">启用每日推送</span>
            </div>
            <button
              onClick={() => setNotifyConfig({ ...notifyConfig, enabled: !notifyConfig.enabled })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                notifyConfig.enabled ? 'bg-green-500' : 'bg-gray-600'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                notifyConfig.enabled ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>

          {notifyConfig.enabled && (
            <div className="space-y-3 pl-2 border-l-2 border-green-500/30">
              {/* Mode Selection */}
              <div className="flex items-center gap-3">
                <label className="text-sm text-muted w-20 shrink-0">推送方式</label>
                <select
                  value={notifyConfig.mode}
                  onChange={e => setNotifyConfig({ ...notifyConfig, mode: e.target.value })}
                  className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-green-500"
                >
                  <option value="webhook">群机器人 Webhook（推荐）</option>
                  <option value="app">应用消息（给个人发）</option>
                </select>
              </div>

              {notifyConfig.mode === 'webhook' ? (
                /* Webhook URL */
                <div className="flex items-center gap-3">
                  <label className="text-sm text-muted w-20 shrink-0">Webhook</label>
                  <input
                    type="text"
                    value={notifyConfig.webhookUrl}
                    onChange={e => setNotifyConfig({ ...notifyConfig, webhookUrl: e.target.value })}
                    placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/xxx"
                    className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground font-mono placeholder:text-muted/50 focus:outline-none focus:border-green-500"
                  />
                </div>
              ) : (
                <>
                  {/* App mode fields */}
                  <div className="flex items-center gap-3">
                    <label className="text-sm text-muted w-20 shrink-0">接收人ID</label>
                    <input
                      type="text"
                      value={notifyConfig.receiveUserId}
                      onChange={e => setNotifyConfig({ ...notifyConfig, receiveUserId: e.target.value })}
                      placeholder="open_id 或 user_id"
                      className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:border-green-500"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="text-sm text-muted w-20 shrink-0">群聊ID</label>
                    <input
                      type="text"
                      value={notifyConfig.receiveChatId}
                      onChange={e => setNotifyConfig({ ...notifyConfig, receiveChatId: e.target.value })}
                      placeholder="chat_id（可选，优先发给群）"
                      className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:border-green-500"
                    />
                  </div>
                </>
              )}

              {/* Push Time */}
              <div className="flex items-center gap-3">
                <label className="text-sm text-muted w-20 shrink-0">推送时间</label>
                <input
                  type="time"
                  value={notifyConfig.notifyTime}
                  onChange={e => setNotifyConfig({ ...notifyConfig, notifyTime: e.target.value })}
                  className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-green-500"
                />
                <span className="text-xs text-muted">每日定时推送</span>
              </div>

              {/* Push Levels */}
              <div className="flex items-center gap-3">
                <label className="text-sm text-muted w-20 shrink-0">推送级别</label>
                <div className="flex items-center gap-2">
                  {[
                    { value: 'critical', label: '严重', color: 'bg-red-500' },
                    { value: 'medium', label: '中等', color: 'bg-yellow-500' },
                  ].map(level => (
                    <button
                      key={level.value}
                      onClick={() => {
                        const levels = notifyConfig.notifyLevels.includes(level.value)
                          ? notifyConfig.notifyLevels.filter((l: string) => l !== level.value)
                          : [...notifyConfig.notifyLevels, level.value];
                        if (levels.length > 0) setNotifyConfig({ ...notifyConfig, notifyLevels: levels });
                      }}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-colors ${
                        notifyConfig.notifyLevels.includes(level.value)
                          ? `${level.color} text-white`
                          : 'bg-background text-muted border border-border'
                      }`}
                    >
                      {level.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview */}
              {notifyPreview && notifyPreview.hasAlerts && (
                <div className="bg-background/50 rounded-lg px-3 py-2">
                  <p className="text-xs text-muted mb-1">当前预警预览: {notifyPreview.postCount}个帖子</p>
                  <p className="text-xs text-muted/70 line-clamp-3 font-mono">{notifyPreview.textPreview}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    setNotifyTesting(true);
                    setNotifyTestResult(null);
                    try {
                      const res = await fetch('/api/notify', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(notifyConfig),
                      });
                      const json = await res.json();
                      if (json.success) {
                        const testRes = await fetch('/api/notify', { method: 'PUT' });
                        setNotifyTestResult(await testRes.json());
                      } else {
                        setNotifyTestResult(json);
                      }
                    } catch (e: any) {
                      setNotifyTestResult({ success: false, message: e.message || '测试失败' });
                    } finally {
                      setNotifyTesting(false);
                    }
                  }}
                  disabled={notifyTesting}
                  className="flex items-center gap-1.5 px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground hover:bg-card-hover transition-colors disabled:opacity-50"
                >
                  {notifyTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
                  保存并测试
                </button>
                <button
                  onClick={async () => {
                    setNotifySending(true);
                    setNotifySendResult(null);
                    try {
                      const res = await fetch('/api/notify', { method: 'PATCH' });
                      setNotifySendResult(await res.json());
                    } catch (e: any) {
                      setNotifySendResult({ success: false, message: e.message || '推送失败' });
                    } finally {
                      setNotifySending(false);
                    }
                  }}
                  disabled={notifySending}
                  className="flex items-center gap-1.5 px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {notifySending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  立即推送
                </button>
              </div>

              {/* Results */}
              {notifyTestResult && (
                <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
                  notifyTestResult.success ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                }`}>
                  {notifyTestResult.success ? <CheckCircle className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
                  {notifyTestResult.message}
                </div>
              )}
              {notifySendResult && (
                <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
                  notifySendResult.success ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                }`}>
                  {notifySendResult.success ? <CheckCircle className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
                  {notifySendResult.message}
                </div>
              )}

              {/* Help Text */}
              <div className="text-xs text-muted/70 space-y-1">
                <p><b>Webhook方式：</b>在飞书群聊中添加「自定义机器人」，获取Webhook地址后填入上方</p>
                <p><b>应用消息方式：</b>需先配置上方飞书应用凭证，再填写接收人ID或群聊ID</p>
                <p>推送内容包含：严重/高危帖子标题、来源、评论数、恶意评论数、情感分布、典型恶意评论摘要</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detection Rules */}
      <div className="bg-card rounded-xl p-6 border border-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <h2 className="text-base font-semibold text-foreground">检测规则</h2>
          </div>
          <button
            onClick={async () => {
              setRulesSaving(true);
              try {
                const res = await fetch('/api/detection-rules', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(detectionRules),
                });
                const json = await res.json();
                if (json.success) {
                  setRulesSaved(true);
                  setTimeout(() => setRulesSaved(false), 3000);
                }
              } catch (e) {
                console.error('Save detection rules failed', e);
              } finally {
                setRulesSaving(false);
              }
            }}
            disabled={rulesSaving}
            className="px-3 py-1.5 bg-primary text-white text-sm rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-1.5"
          >
            {rulesSaving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : rulesSaved ? (
              <CheckCircle className="w-3.5 h-3.5" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            {rulesSaving ? '保存中...' : rulesSaved ? '已保存' : '保存规则'}
          </button>
        </div>

        <p className="text-sm text-muted mb-4">
          关闭不需要检测的规则可减少误报。每次扫描时会根据启用的规则检测恶意评论。
        </p>

        <div className="space-y-3">
          {[
            { key: 'brand_attack', label: '品牌攻击', desc: '检测直接攻击品牌声誉的评论（如 scam、fraud、worst brand）', color: 'bg-red-500' },
            { key: 'product_hate', label: '产品差评', desc: '检测极端负面的产品评价（如 worst tv、garbage、broken）', color: 'bg-orange-500' },
            { key: 'call_to_action_negative', label: '号召抵制', desc: '检测号召他人抵制/起诉品牌的评论（如 boycott、lawsuit）', color: 'bg-red-600' },
            { key: 'competitor_push', label: '竞品推荐', desc: '检测推荐竞品并贬低品牌的评论（如 buy Samsung instead）', color: 'bg-yellow-500' },
            { key: 'negative_sentiment', label: '负面情绪', desc: '检测表达强烈不满的评论（如 hate、sick of、never again）', color: 'bg-orange-400' },
          ].map(rule => (
            <div key={rule.key} className="flex items-center justify-between p-3 rounded-lg bg-background border border-border">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${rule.color}`} />
                <div>
                  <p className="text-sm font-medium text-foreground">{rule.label}</p>
                  <p className="text-xs text-muted">{rule.desc}</p>
                </div>
              </div>
              <button
                onClick={() => setDetectionRules(prev => ({ ...prev, [rule.key]: !prev[rule.key as keyof typeof prev] }))}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  detectionRules[rule.key as keyof typeof detectionRules] ? 'bg-primary' : 'bg-muted'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    detectionRules[rule.key as keyof typeof detectionRules] ? 'translate-x-4.5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
