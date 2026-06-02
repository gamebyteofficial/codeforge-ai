import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
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

// ─── OpenCode Zen Models Fetcher ───────────────────────────────────────────────

// Known free model IDs from OpenCode Zen (models with -free suffix + big-pickle)
const OPENCODE_FREE_IDS = new Set([
  'big-pickle',
  'deepseek-v4-flash-free',
  'mimo-v2.5-free',
  'qwen3.6-plus-free',
  'minimax-m3-free',
  'nemotron-3-super-free',
]);

// Friendly display names for OpenCode Zen models
const OPENCODE_DISPLAY_NAMES: Record<string, string> = {
  'big-pickle': 'Big Pickle',
  'deepseek-v4-flash-free': 'DeepSeek V4 Flash Free',
  'deepseek-v4-flash': 'DeepSeek V4 Flash',
  'mimo-v2.5-free': 'MiMo V2.5 Free',
  'qwen3.6-plus-free': 'Qwen3.6 Plus Free',
  'qwen3.6-plus': 'Qwen3.6 Plus',
  'qwen3.5-plus': 'Qwen3.5 Plus',
  'minimax-m3-free': 'MiniMax M3 Free',
  'minimax-m2.7': 'MiniMax M2.7',
  'minimax-m2.5': 'MiniMax M2.5',
  'nemotron-3-super-free': 'Nemotron 3 Super Free',
  'kimi-k2.6': 'Kimi K2.6',
  'kimi-k2.5': 'Kimi K2.5',
  'glm-5.1': 'GLM 5.1',
  'glm-5': 'GLM 5',
  'claude-sonnet-4': 'Claude Sonnet 4',
  'claude-sonnet-4-5': 'Claude Sonnet 4.5',
  'claude-sonnet-4-6': 'Claude Sonnet 4.6',
  'claude-opus-4': 'Claude Opus 4',
  'claude-opus-4-1': 'Claude Opus 4.1',
  'claude-opus-4-5': 'Claude Opus 4.5',
  'claude-opus-4-6': 'Claude Opus 4.6',
  'claude-opus-4-7': 'Claude Opus 4.7',
  'claude-opus-4-8': 'Claude Opus 4.8',
  'claude-haiku-4-5': 'Claude Haiku 4.5',
  'gpt-5': 'GPT-5',
  'gpt-5-nano': 'GPT-5 Nano',
  'gpt-5-codex': 'GPT-5 Codex',
  'gpt-5.1': 'GPT-5.1',
  'gpt-5.1-codex': 'GPT-5.1 Codex',
  'gpt-5.1-codex-max': 'GPT-5.1 Codex Max',
  'gpt-5.1-codex-mini': 'GPT-5.1 Codex Mini',
  'gpt-5.2': 'GPT-5.2',
  'gpt-5.2-codex': 'GPT-5.2 Codex',
  'gpt-5.3-codex': 'GPT-5.3 Codex',
  'gpt-5.3-codex-spark': 'GPT-5.3 Codex Spark',
  'gpt-5.4': 'GPT-5.4',
  'gpt-5.4-pro': 'GPT-5.4 Pro',
  'gpt-5.4-mini': 'GPT-5.4 Mini',
  'gpt-5.4-nano': 'GPT-5.4 Nano',
  'gpt-5.5': 'GPT-5.5',
  'gpt-5.5-pro': 'GPT-5.5 Pro',
  'gemini-3-flash': 'Gemini 3 Flash',
  'gemini-3.5-flash': 'Gemini 3.5 Flash',
  'gemini-3.1-pro': 'Gemini 3.1 Pro',
  'grok-build-0.1': 'Grok Build 0.1',
};

async function fetchOpenCodeModels(): Promise<ModelEntry[]> {
  const response = await fetch('https://opencode.ai/zen/v1/models', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    next: { revalidate: 300 }, // Cache for 5 minutes
  });

  if (!response.ok) {
    throw new Error(`OpenCode Zen API returned ${response.status}`);
  }

  const data = await response.json();
  const rawModels: { id: string; object: string; owned_by: string }[] = data.data || [];

  // Map to our ModelEntry format with free/paid classification
  const models: ModelEntry[] = rawModels.map((m) => ({
    id: m.id,
    name: OPENCODE_DISPLAY_NAMES[m.id] || m.id,
    provider: 'opencode',
    isFree: OPENCODE_FREE_IDS.has(m.id) || m.id.endsWith('-free'),
  }));

  // Sort: free models first, then paid models alphabetically
  const freeModels = models.filter((m) => m.isFree).sort((a, b) => a.name.localeCompare(b.name));
  const paidModels = models.filter((m) => !m.isFree).sort((a, b) => a.name.localeCompare(b.name));

  return [...freeModels, ...paidModels];
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
    isFree: false,
  }));
}

// ─── GET Handler ───────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    // Step 1: Read the user's provider from database settings
    let settingsMap: Record<string, string> = {};
    try {
      const settings = await db.setting.findMany();
      settings.forEach((s) => {
        settingsMap[s.key] = s.value;
      });
    } catch {
      // Database unavailable (e.g., Vercel serverless with SQLite)
    }

    // Also check for client-provided provider in query params
    const url = new URL(req.url);
    const clientProvider = url.searchParams.get('provider');
    if (clientProvider && !settingsMap.provider) {
      settingsMap.provider = clientProvider;
    }

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
    } else if (provider === 'opencode') {
      // OpenCode Zen: Dynamic fetch from API
      try {
        models = await fetchOpenCodeModels();
      } catch (fetchError) {
        console.error('Failed to fetch OpenCode Zen models:', fetchError);
        // Fallback: return a minimal list with big-pickle
        models = [
          { id: 'big-pickle', name: 'Big Pickle', provider: 'opencode', isFree: true },
          { id: 'deepseek-v4-flash-free', name: 'DeepSeek V4 Flash Free', provider: 'opencode', isFree: true },
          { id: 'nemotron-3-super-free', name: 'Nemotron 3 Super Free', provider: 'opencode', isFree: true },
          { id: 'mimo-v2.5-free', name: 'MiMo V2.5 Free', provider: 'opencode', isFree: true },
          { id: 'qwen3.6-plus-free', name: 'Qwen3.6 Plus Free', provider: 'opencode', isFree: true },
          { id: 'minimax-m3-free', name: 'MiniMax M3 Free', provider: 'opencode', isFree: true },
          { id: 'kimi-k2.6', name: 'Kimi K2.6', provider: 'opencode', isFree: false },
          { id: 'claude-sonnet-4', name: 'Claude Sonnet 4', provider: 'opencode', isFree: false },
          { id: 'gpt-5', name: 'GPT-5', provider: 'opencode', isFree: false },
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
