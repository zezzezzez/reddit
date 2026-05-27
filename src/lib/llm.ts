// Unified LLM Adapter Layer
// Supports: OpenAI, Anthropic, Google, DeepSeek, 智谱, 月之暗面, 通义千问, 豆包, Ollama, Custom
// All providers use OpenAI-compatible chat completion format (most providers support it)

import { LLMConfig, LLMProvider } from './types';

// Provider preset configurations
export const PROVIDER_PRESETS: Record<LLMProvider, {
  name: string;
  baseUrl: string;
  models: string[];
  apiKeyLabel: string;
  apiKeyHint: string;
}> = {
  openai: {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    apiKeyLabel: 'API Key',
    apiKeyHint: 'sk-...',
  },
  anthropic: {
    name: 'Anthropic (Claude)',
    baseUrl: 'https://api.anthropic.com/v1',
    models: ['claude-sonnet-4-20250514', 'claude-haiku-4-20250414', 'claude-3-5-sonnet-20241022'],
    apiKeyLabel: 'API Key',
    apiKeyHint: 'sk-ant-...',
  },
  google: {
    name: 'Google (Gemini)',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    models: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    apiKeyLabel: 'API Key',
    apiKeyHint: 'AIza...',
  },
  deepseek: {
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    apiKeyLabel: 'API Key',
    apiKeyHint: 'sk-...',
  },
  zhipu: {
    name: '智谱 (GLM)',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    models: ['glm-4-plus', 'glm-4-flash', 'glm-4-air'],
    apiKeyLabel: 'API Key',
    apiKeyHint: 'xxx.yyy (需拼接)',
  },
  moonshot: {
    name: '月之暗面 (Kimi)',
    baseUrl: 'https://api.moonshot.cn/v1',
    models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
    apiKeyLabel: 'API Key',
    apiKeyHint: 'sk-...',
  },
  qwen: {
    name: '通义千问',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: ['qwen-max', 'qwen-plus', 'qwen-turbo'],
    apiKeyLabel: 'API Key',
    apiKeyHint: 'sk-...',
  },
  doubao: {
    name: '豆包 (字节)',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    models: ['doubao-pro-32k', 'doubao-lite-32k'],
    apiKeyLabel: 'API Key',
    apiKeyHint: '火山引擎 API Key',
  },
  ollama: {
    name: 'Ollama (本地)',
    baseUrl: 'http://localhost:11434/v1',
    models: ['llama3', 'qwen2', 'gemma2', 'mistral'],
    apiKeyLabel: '无需Key',
    apiKeyHint: '本地运行无需API Key',
  },
  custom: {
    name: '自定义 (OpenAI兼容)',
    baseUrl: '',
    models: [],
    apiKeyLabel: 'API Key',
    apiKeyHint: '填入对应服务的Key',
  },
};

// Sentiment analysis prompt
const SENTIMENT_SYSTEM_PROMPT = `你是一个品牌声誉监控AI，专门分析Reddit上关于海信(Hisense)品牌的评论情感倾向。

请分析以下评论，判断是否包含对海信品牌的负面、攻击性或有害内容。

请严格按以下JSON格式返回结果：
{
  "score": <情感分数，-1到1，-1=极度敌意，0=中性，1=极度正面>,
  "isFlagged": <是否需要标记预警，true/false>,
  "flagReasons": <标记原因数组，可选项: ["brand_attack","product_hate","negative_sentiment","call_to_action_negative","competitor_push"]>,
  "explanation": <一句话中文解释你的判断理由>
}

标记标准（必须同时满足严重性和品牌针对性才标记）：
- brand_attack: 直接攻击海信品牌信誉（如"海信是骗局""海信欺诈"）
- product_hate: 对海信产品的强烈负面评价（如"海信电视是垃圾""最差的电视"）
- negative_sentiment: 针对海信的强烈负面情绪（如"我恨海信""再也不会买海信"）
- call_to_action_negative: 号召他人抵制海信（如"别买海信""大家一起投诉海信"）
- competitor_push: 明确推荐竞品替代海信并贬低海信（如"海信太烂了，买三星吧"）

注意：正常的消费建议（如"这个价位建议选mini-LED"）、中性讨论、一般性不满（如"色彩还可以"）不要标记。`;

// Build API request based on provider
function buildRequest(config: LLMConfig, messages: { role: string; content: string }[]): {
  url: string;
  headers: Record<string, string>;
  body: any;
} {
  const preset = PROVIDER_PRESETS[config.provider];
  const baseUrl = config.baseUrl || preset.baseUrl;

  switch (config.provider) {
    case 'anthropic': {
      // Anthropic uses its own API format
      return {
        url: `${baseUrl}/messages`,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: config.model,
          max_tokens: config.maxTokens,
          system: messages.find(m => m.role === 'system')?.content,
          messages: messages.filter(m => m.role !== 'system'),
        }),
      };
    }

    case 'google': {
      // Google Gemini uses its own format
      return {
        url: `${baseUrl}/models/${config.model}:generateContent?key=${config.apiKey}`,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: messages.find(m => m.role === 'system')?.content || '' }],
          },
          contents: messages.filter(m => m.role !== 'system').map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
          })),
          generationConfig: {
            temperature: config.temperature,
            maxOutputTokens: config.maxTokens,
          },
        }),
      };
    }

    default: {
      // OpenAI-compatible format (works for: OpenAI, DeepSeek, 智谱, 月之暗面, 通义千问, 豆包, Ollama, Custom)
      return {
        url: `${baseUrl}/chat/completions`,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages,
          temperature: config.temperature,
          max_tokens: config.maxTokens,
        }),
      };
    }
  }
}

// Parse response based on provider
function parseResponse(config: LLMProvider, data: any): string {
  switch (config) {
    case 'anthropic':
      return data.content?.[0]?.text || '';
    case 'google':
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    default:
      // OpenAI-compatible
      return data.choices?.[0]?.message?.content || '';
  }
}

// Call LLM API
export async function callLLM(
  config: LLMConfig,
  messages: { role: string; content: string }[]
): Promise<string> {
  const { url, headers, body } = buildRequest(config, messages);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`LLM API returned ${response.status}: ${errorText.slice(0, 200)}`);
    }

    const data = await response.json();
    const result = parseResponse(config.provider, data);

    if (!result) {
      throw new Error('LLM返回了空结果');
    }

    return result;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('LLM请求超时(30秒)');
    }
    throw error;
  }
}

// Analyze comment sentiment using LLM
export interface LLMSentimentResult {
  score: number;
  isFlagged: boolean;
  flagReasons: string[];
  explanation: string;
}

export async function analyzeSentimentWithLLM(
  config: LLMConfig,
  commentBody: string,
  postTitle?: string,
): Promise<LLMSentimentResult> {
  const userMessage = postTitle
    ? `帖子标题: ${postTitle}\n\n评论内容: ${commentBody}`
    : `评论内容: ${commentBody}`;

  const result = await callLLM(config, [
    { role: 'system', content: SENTIMENT_SYSTEM_PROMPT },
    { role: 'user', content: userMessage },
  ]);

  // Parse JSON from LLM response
  try {
    // Try to extract JSON from the response (may have markdown code blocks)
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { score: 0, isFlagged: false, flagReasons: [], explanation: 'LLM返回格式异常' };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      score: Math.max(-1, Math.min(1, Number(parsed.score) || 0)),
      isFlagged: Boolean(parsed.isFlagged),
      flagReasons: Array.isArray(parsed.flagReasons) ? parsed.flagReasons : [],
      explanation: String(parsed.explanation || ''),
    };
  } catch {
    return { score: 0, isFlagged: false, flagReasons: [], explanation: 'LLM结果解析失败' };
  }
}

// Batch analyze comments using LLM (with rate limiting)
export async function batchAnalyzeWithLLM(
  config: LLMConfig,
  comments: { body: string; score: number }[],
  postTitle?: string,
  onProgress?: (current: number, total: number) => void,
): Promise<LLMSentimentResult[]> {
  const results: LLMSentimentResult[] = [];

  for (let i = 0; i < comments.length; i++) {
    if (onProgress) onProgress(i, comments.length);

    try {
      const result = await analyzeSentimentWithLLM(config, comments[i].body, postTitle);
      results.push(result);
    } catch (error: any) {
      console.error(`[LLM] Error analyzing comment ${i}:`, error.message);
      results.push({
        score: 0,
        isFlagged: false,
        flagReasons: [],
        explanation: `LLM分析失败: ${error.message}`,
      });
    }

    // Rate limiting: 500ms between requests
    if (i < comments.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return results;
}

// Test LLM connection
export async function testLLMConnection(config: LLMConfig): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    const result = await callLLM(config, [
      { role: 'system', content: '你是一个测试助手。请回复"连接成功"。' },
      { role: 'user', content: '你好，请回复"连接成功"' },
    ]);

    if (result && result.length > 0) {
      return {
        success: true,
        message: `${PROVIDER_PRESETS[config.provider].name} 连接成功！模型: ${config.model}，回复: ${result.slice(0, 50)}`,
      };
    } else {
      return {
        success: false,
        message: 'LLM返回了空结果',
      };
    }
  } catch (error: any) {
    return {
      success: false,
      message: `连接失败: ${error.message}`,
    };
  }
}
