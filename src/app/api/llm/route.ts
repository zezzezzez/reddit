import { NextResponse } from 'next/server';
import { getConfig, saveConfig } from '@/lib/store';
import { testLLMConnection, PROVIDER_PRESETS } from '@/lib/llm';
import { LLMConfig, LLMProvider } from '@/lib/types';

// GET: Get LLM config and provider presets
export async function GET() {
  const config = getConfig();
  return NextResponse.json({
    llm: config.llm || { enabled: false, provider: 'openai', apiKey: '', model: 'gpt-4o-mini', baseUrl: 'https://api.openai.com/v1', maxTokens: 1024, temperature: 0.1 },
    presets: PROVIDER_PRESETS,
  });
}

// POST: Save LLM config
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const provider = (body.provider || 'openai') as LLMProvider;
    const llmConfig: LLMConfig = {
      enabled: body.enabled ?? false,
      provider,
      apiKey: body.apiKey || '',
      model: body.model || 'gpt-4o-mini',
      baseUrl: body.baseUrl || (PROVIDER_PRESETS as any)[provider]?.baseUrl || '',
      maxTokens: body.maxTokens || 1024,
      temperature: body.temperature ?? 0.1,
    };

    const config = getConfig();
    config.llm = llmConfig;
    saveConfig(config);

    return NextResponse.json({
      success: true,
      message: llmConfig.enabled
        ? `LLM配置已保存: ${PROVIDER_PRESETS[llmConfig.provider].name} / ${llmConfig.model}`
        : 'LLM已关闭，将使用关键词分析',
      llm: llmConfig,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: error.message || '保存LLM配置失败',
    }, { status: 500 });
  }
}

// PUT: Test LLM connection
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const provider = (body.provider || 'openai') as LLMProvider;
    const llmConfig: LLMConfig = {
      enabled: true,
      provider,
      apiKey: body.apiKey || '',
      model: body.model || 'gpt-4o-mini',
      baseUrl: body.baseUrl || (PROVIDER_PRESETS as any)[provider]?.baseUrl || '',
      maxTokens: body.maxTokens || 256,
      temperature: body.temperature ?? 0.1,
    };

    if (!llmConfig.apiKey && llmConfig.provider !== 'ollama') {
      return NextResponse.json({
        success: false,
        message: '请先填写API Key',
      });
    }

    const result = await testLLMConnection(llmConfig);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: error.message || 'LLM测试失败',
    }, { status: 500 });
  }
}
