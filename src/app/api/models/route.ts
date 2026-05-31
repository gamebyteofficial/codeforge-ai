import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import type { ProviderKey } from '@/lib/llm';

// ─── Static Model Definitions ──────────────────────────────────────────────────

const STATIC_MODELS: Record<string, { id: string; name: string }[]> = {
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o' },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
    { id: 'o1', name: 'o1' },
    { id: 'o1-mini', name: 'o1 Mini' },
  ],
  anthropic: [
    { id: 'claude-3.5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
    { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
    { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' },
  ],
  gemini: [
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
  ],
  qwen: [
    { id: 'qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B' },
    { id: 'qwen-2.5-coder-32b-instruct', name: 'Qwen 2.5 Coder 32B' },
  ],
  deepseek: [
    { id: 'deepseek-chat', name: 'DeepSeek Chat' },
    { id: 'deepseek-coder', name: 'DeepSeek Coder' },
  ],
  mistral: [
    { id: 'mistral-large-latest', name: 'Mistral Large' },
    { id: 'mistral-medium-latest', name: 'Mistral Medium' },
    { id: 'codestral-latest', name: 'Codestral' },
  ],
  opencode: [
    { id: 'opencode/big-pickle', name: 'Big Pickle', isFree: true },
    { id: 'opencode/mimo-v2-pro-free', name: 'MiMo V2 Pro', isFree: true },
    { id: 'opencode/claude-haiku-4-5', name: 'Claude Haiku 4.5', isFree: true },
    { id: 'opencode/claude-sonnet-4', name: 'Claude Sonnet 4', isFree: true },
    { id: 'opencode/glm-5', name: 'GLM-5', isFree: true },
    { id: 'opencode/glm-5.1', name: 'GLM-5.1', isFree: true },
    { id: 'opencode/gpt-4.1', name: 'GPT-4.1', isFree: true },
    { id: 'opencode/gpt-4.1-mini', name: 'GPT-4.1 Mini', isFree: true },
    { id: 'opencode/kimi-k2.5', name: 'Kimi K2.5', isFree: true },
    { id: 'opencode/minimax-m1', name: 'MiniMax M1', isFree: true },
    { id: 'opencode/qwen3-235b-a22b', name: 'Qwen3 235B', isFree: true },
    { id: 'opencode/qwen3-coder', name: 'Qwen3 Coder', isFree: true },
    { id: 'opencode/deepseek-r1', name: 'DeepSeek R1', isFree: true },
  ],
};

// ─── Response Model Type ───────────────────────────────────────────────────────

interface ModelEntry {
  id: string;
  name: string;
  provider: string;
  pricing?: { prompt: string; completion: string };
  contextLength?: number;
  isFree: boolean;
}

// ─── OpenRouter Models Fetcher ─────────────────────────────────────────────────

interface OpenRouterModel {
  id: string;
  name: string;
  pricing?: {
    prompt: string;
    completion: string;
  };
  context_length?: number;
}

async function fetchOpenRouterModels(): Promise<ModelEntry[]> {
  const response = await fetch('https://openrouter.ai/api/v1/models', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    next: { revalidate: 300 }, // Cache for 5 minutes
  });

  if (!response.ok) {
    throw new Error(`OpenRouter API returned ${response.status}`);
  }

  const data = await response.json();
  const rawModels: OpenRouterModel[] = data.data || [];

  // Filter to models that have pricing info
  const modelsWithPricing = rawModels.filter(
    (m) => m.pricing && typeof m.pricing.prompt === 'string' && typeof m.pricing.completion === 'string'
  );

  // Map to our ModelEntry format
  const mapped: ModelEntry[] = modelsWithPricing.map((m) => {
    const isFree = m.pricing!.prompt === '0' && m.pricing!.completion === '0';
    return {
      id: m.id,
      name: m.name || m.id,
      provider: 'openrouter',
      pricing: {
        prompt: m.pricing!.prompt,
        completion: m.pricing!.completion,
      },
      contextLength: m.context_length ?? undefined,
      isFree,
    };
  });

  // Sort: free models first, then paid models
  const freeModels = mapped.filter((m) => m.isFree);
  const paidModels = mapped.filter((m) => !m.isFree);

  // Always include openrouter/auto as the first model (special option)
  const autoModel: ModelEntry = {
    id: 'openrouter/auto',
    name: 'Auto (Best Available)',
    provider: 'openrouter',
    pricing: { prompt: '0', completion: '0' },
    contextLength: 128000,
    isFree: true,
  };

  // Remove openrouter/auto if it already exists in the list to avoid duplicates
  const uniqueFree = freeModels.filter((m) => m.id !== 'openrouter/auto');
  const uniquePaid = paidModels.filter((m) => m.id !== 'openrouter/auto');

  // Limit to top 50 models, prioritizing free models
  const maxFree = Math.min(uniqueFree.length, 30);
  const maxPaid = Math.min(uniquePaid.length, 50 - maxFree);

  const result: ModelEntry[] = [
    autoModel,
    ...uniqueFree.slice(0, maxFree),
    ...uniquePaid.slice(0, maxPaid),
  ];

  return result;
}

// ─── Static Model Builder ──────────────────────────────────────────────────────

function buildStaticModels(provider: string): ModelEntry[] {
  const models = STATIC_MODELS[provider];
  if (!models) {
    return [];
  }

  return models.map((m) => ({
    id: m.id,
    name: m.name,
    provider,
    isFree: (m as { isFree?: boolean }).isFree ?? false,
  }));
}

// ─── GET Handler ───────────────────────────────────────────────────────────────

export async function GET() {
  try {
    // Step 1: Read the user's provider from database settings
    const settings = await db.setting.findMany();
    const settingsMap: Record<string, string> = {};
    settings.forEach((s) => {
      settingsMap[s.key] = s.value;
    });

    const provider = (settingsMap.provider || 'openrouter') as ProviderKey;

    // Step 2: Fetch models based on provider
    let models: ModelEntry[];

    if (provider === 'openrouter') {
      // OpenRouter: Dynamic fetch from API
      try {
        models = await fetchOpenRouterModels();
      } catch (fetchError) {
        console.error('Failed to fetch OpenRouter models:', fetchError);
        // Fallback: return a minimal list with openrouter/auto
        models = [
          {
            id: 'openrouter/auto',
            name: 'Auto (Best Available)',
            provider: 'openrouter',
            pricing: { prompt: '0', completion: '0' },
            contextLength: 128000,
            isFree: true,
          },
        ];
      }
    } else {
      // Static providers: return predefined model lists
      models = buildStaticModels(provider);
    }

    return NextResponse.json({
      provider,
      models,
    });
  } catch (error) {
    console.error('Models API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch models', provider: 'unknown', models: [] },
      { status: 500 },
    );
  }
}
