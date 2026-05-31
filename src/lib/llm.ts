/**
 * Multi-Provider LLM Client
 *
 * Supports: OpenAI, Anthropic, Google Gemini, Qwen, DeepSeek, Mistral, OpenRouter
 * Each provider uses the user's own API key stored in settings.
 *
 * CRITICAL: The provider configured in settings ALWAYS takes precedence.
 * If the user configures OpenRouter, ALL model requests go through OpenRouter.
 * This prevents the bug where a model like "gpt-4o" routes to OpenAI directly
 * even though the user only has an OpenRouter API key.
 */

import { db } from '@/lib/db';

// ─── Provider Configuration ──────────────────────────────────────────────────

export type ProviderKey =
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'qwen'
  | 'deepseek'
  | 'mistral'
  | 'openrouter';

interface ProviderConfig {
  name: string;
  baseUrl: string;
  /** Models that this provider supports */
  models: string[];
  /** Model to use for connection testing (defaults to models[0]) */
  testModel?: string;
  /** Chat completions path (for OpenAI-compatible APIs) */
  chatPath: string;
  /** Whether this provider uses the OpenAI-compatible API format */
  openaiCompatible: boolean;
  /** Custom headers to add */
  extraHeaders?: Record<string, string>;
  /** For Gemini, uses a different API format */
  geminiFormat?: boolean;
  /** For Anthropic, uses a different API format */
  anthropicFormat?: boolean;
}

const PROVIDER_CONFIGS: Record<ProviderKey, ProviderConfig> = {
  openai: {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo', 'o1', 'o1-mini'],
    chatPath: '/chat/completions',
    openaiCompatible: true,
  },
  anthropic: {
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com',
    models: ['claude-3.5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-haiku-20240307'],
    chatPath: '/v1/messages',
    openaiCompatible: false,
    anthropicFormat: true,
  },
  gemini: {
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    models: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    chatPath: '', // Dynamic per model
    openaiCompatible: false,
    geminiFormat: true,
  },
  qwen: {
    name: 'Qwen (Alibaba Cloud)',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: ['qwen-2.5-72b-instruct', 'qwen-2.5-coder-32b-instruct'],
    chatPath: '/chat/completions',
    openaiCompatible: true,
  },
  deepseek: {
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    models: ['deepseek-chat', 'deepseek-coder'],
    chatPath: '/chat/completions',
    openaiCompatible: true,
  },
  mistral: {
    name: 'Mistral AI',
    baseUrl: 'https://api.mistral.ai/v1',
    models: ['mistral-large-latest', 'mistral-medium-latest', 'codestral-latest'],
    chatPath: '/chat/completions',
    openaiCompatible: true,
  },
  openrouter: {
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    models: [
      // Auto-routing (always works, picks best available model)
      'openrouter/auto',
      // Free models
      'google/gemma-2-9b-it:free',
      'meta-llama/llama-3.1-8b-instruct:free',
      'mistralai/mistral-7b-instruct:free',
      'qwen/qwen-2-7b-instruct:free',
      'huggingfaceh4/zephyr-7b-beta:free',
      // Popular paid models (routed through OpenRouter)
      'openai/gpt-4o',
      'openai/gpt-4o-mini',
      'anthropic/claude-3.5-sonnet',
      'google/gemini-2.0-flash-001',
      'meta-llama/llama-3.1-70b-instruct',
      'deepseek/deepseek-chat',
    ],
    testModel: 'openrouter/auto',
    chatPath: '/chat/completions',
    openaiCompatible: true,
    extraHeaders: {
      'HTTP-Referer': 'https://codeforge-ai.app',
      'X-Title': 'CodeForge AI',
    },
  },
};

// ─── Model Alias Map ─────────────────────────────────────────────────────────
// Maps friendly model names to { provider, actualModel }
// Used ONLY when the configured provider matches the alias provider,
// OR for OpenRouter provider which can route to any model.

const MODEL_ALIASES: Record<string, { provider: ProviderKey; actualModel: string }> = {
  // OpenAI direct
  'gpt-4o': { provider: 'openai', actualModel: 'gpt-4o' },
  'gpt-4-turbo': { provider: 'openai', actualModel: 'gpt-4-turbo' },
  'gpt-3.5-turbo': { provider: 'openai', actualModel: 'gpt-3.5-turbo' },
  'o1': { provider: 'openai', actualModel: 'o1' },
  'o1-mini': { provider: 'openai', actualModel: 'o1-mini' },
  // Anthropic direct
  'claude-3.5-sonnet': { provider: 'anthropic', actualModel: 'claude-3.5-sonnet-20241022' },
  'claude-3-opus': { provider: 'anthropic', actualModel: 'claude-3-opus-20240229' },
  'claude-3-haiku': { provider: 'anthropic', actualModel: 'claude-3-haiku-20240307' },
  // Gemini direct
  'gemini-2.0-flash': { provider: 'gemini', actualModel: 'gemini-2.0-flash' },
  'gemini-1.5-pro': { provider: 'gemini', actualModel: 'gemini-1.5-pro' },
  'gemini-1.5-flash': { provider: 'gemini', actualModel: 'gemini-1.5-flash' },
  // Qwen direct
  'qwen-2.5-72b': { provider: 'qwen', actualModel: 'qwen-2.5-72b-instruct' },
  'qwen-2.5-coder-32b': { provider: 'qwen', actualModel: 'qwen-2.5-coder-32b-instruct' },
  // DeepSeek direct
  'deepseek-chat': { provider: 'deepseek', actualModel: 'deepseek-chat' },
  'deepseek-coder': { provider: 'deepseek', actualModel: 'deepseek-coder' },
  // Mistral direct
  'mistral-large': { provider: 'mistral', actualModel: 'mistral-large-latest' },
  'mistral-medium': { provider: 'mistral', actualModel: 'mistral-medium-latest' },
  'codestral': { provider: 'mistral', actualModel: 'codestral-latest' },
  // OpenRouter models (these already contain the full model ID)
  'openrouter/auto': { provider: 'openrouter', actualModel: 'openrouter/auto' },
  'google/gemma-2-9b-it:free': { provider: 'openrouter', actualModel: 'google/gemma-2-9b-it:free' },
  'meta-llama/llama-3.1-8b-instruct:free': { provider: 'openrouter', actualModel: 'meta-llama/llama-3.1-8b-instruct:free' },
  'mistralai/mistral-7b-instruct:free': { provider: 'openrouter', actualModel: 'mistralai/mistral-7b-instruct:free' },
  'qwen/qwen-2-7b-instruct:free': { provider: 'openrouter', actualModel: 'qwen/qwen-2-7b-instruct:free' },
  'huggingfaceh4/zephyr-7b-beta:free': { provider: 'openrouter', actualModel: 'huggingfaceh4/zephyr-7b-beta:free' },
  'openai/gpt-4o': { provider: 'openrouter', actualModel: 'openai/gpt-4o' },
  'openai/gpt-4o-mini': { provider: 'openrouter', actualModel: 'openai/gpt-4o-mini' },
  'anthropic/claude-3.5-sonnet': { provider: 'openrouter', actualModel: 'anthropic/claude-3.5-sonnet' },
  'google/gemini-2.0-flash-001': { provider: 'openrouter', actualModel: 'google/gemini-2.0-flash-001' },
  'meta-llama/llama-3.1-70b-instruct': { provider: 'openrouter', actualModel: 'meta-llama/llama-3.1-70b-instruct' },
  'deepseek/deepseek-chat': { provider: 'openrouter', actualModel: 'deepseek/deepseek-chat' },
};

// ─── Provider Prefix Map for OpenRouter ──────────────────────────────────────
// When the user configures OpenRouter but selects a model from another provider
// (e.g., 'gpt-4o'), we need to prefix it with the OpenRouter provider namespace.

const OPENROUTER_PREFIX_MAP: Record<string, string> = {
  openai: 'openai/',
  anthropic: 'anthropic/',
  gemini: 'google/',
  qwen: 'qwen/',
  deepseek: 'deepseek/',
  mistral: 'mistralai/',
  openrouter: '',
};

/**
 * Convert a direct provider model to its OpenRouter model ID.
 * E.g., 'gpt-4o' (OpenAI) → 'openai/gpt-4o' (OpenRouter)
 */
function convertToOpenRouterModel(alias: { provider: ProviderKey; actualModel: string }): string {
  const prefix = OPENROUTER_PREFIX_MAP[alias.provider] || '';
  if (prefix && !alias.actualModel.startsWith(prefix)) {
    return `${prefix}${alias.actualModel}`;
  }
  return alias.actualModel;
}

// ─── Settings Helper ─────────────────────────────────────────────────────────

async function getUserSettings(): Promise<Record<string, string>> {
  const settings = await db.setting.findMany();
  const map: Record<string, string> = {};
  settings.forEach((s) => { map[s.key] = s.value; });
  return map;
}

// ─── Stream Chunk Type ───────────────────────────────────────────────────────

export interface StreamChunk {
  content: string;
  model?: string;
  done?: boolean;
  error?: string;
}

// ─── OpenAI-Compatible Streaming ─────────────────────────────────────────────

async function* streamOpenAICompatible(
  config: ProviderConfig,
  apiKey: string,
  model: string,
  messages: { role: string; content: string }[],
  temperature: number = 0.7,
  maxTokens: number = 4096,
): AsyncGenerator<StreamChunk> {
  const url = `${config.baseUrl}${config.chatPath}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
    ...config.extraHeaders,
  };

  const body = JSON.stringify({
    model,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    temperature,
    max_tokens: maxTokens,
    stream: true,
  });

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `API error ${response.status}`;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.error?.message || errorJson.message || errorMessage;
    } catch {}
    yield { content: '', error: errorMessage, done: true };
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    yield { content: '', error: 'No response stream', done: true };
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (trimmed === 'data: [DONE]') {
          yield { content: '', done: true };
          return;
        }
        if (trimmed.startsWith('data: ')) {
          const data = trimmed.slice(6);
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content || '';
            if (content) {
              yield { content, model: parsed.model || model };
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  yield { content: '', done: true };
}

// ─── Anthropic Streaming ─────────────────────────────────────────────────────

async function* streamAnthropic(
  apiKey: string,
  model: string,
  messages: { role: string; content: string }[],
  temperature: number = 0.7,
  maxTokens: number = 4096,
): AsyncGenerator<StreamChunk> {
  const url = 'https://api.anthropic.com/v1/messages';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true',
  };

  // Separate system prompt from messages
  const systemPrompt = messages.find((m) => m.role === 'assistant')?.content || '';
  const chatMessages = messages.filter((m) => m.role !== 'assistant').map((m) => ({
    role: m.role === 'system' ? 'user' : m.role,
    content: m.content,
  }));

  const body = JSON.stringify({
    model,
    max_tokens: maxTokens,
    temperature,
    system: systemPrompt,
    messages: chatMessages,
    stream: true,
  });

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `Anthropic API error ${response.status}`;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.error?.message || errorJson.message || errorMessage;
    } catch {}
    yield { content: '', error: errorMessage, done: true };
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    yield { content: '', error: 'No response stream', done: true };
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;

        const data = trimmed.slice(6);
        try {
          const parsed = JSON.parse(data);

          if (parsed.type === 'content_block_delta') {
            const content = parsed.delta?.text || '';
            if (content) {
              yield { content, model };
            }
          } else if (parsed.type === 'message_stop') {
            yield { content: '', done: true };
            return;
          } else if (parsed.type === 'error') {
            yield { content: '', error: parsed.error?.message || 'Anthropic stream error', done: true };
            return;
          }
        } catch {
          // Skip malformed JSON
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  yield { content: '', done: true };
}

// ─── Gemini Streaming ────────────────────────────────────────────────────────

async function* streamGemini(
  apiKey: string,
  model: string,
  messages: { role: string; content: string }[],
  temperature: number = 0.7,
  maxTokens: number = 4096,
): AsyncGenerator<StreamChunk> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

  // Convert messages to Gemini format
  const systemInstruction = messages.find((m) => m.role === 'assistant')?.content || '';
  const contents = messages
    .filter((m) => m.role !== 'assistant')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  const body = JSON.stringify({
    contents,
    systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
    },
  });

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `Gemini API error ${response.status}`;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.error?.message || errorMessage;
    } catch {}
    yield { content: '', error: errorMessage, done: true };
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    yield { content: '', error: 'No response stream', done: true };
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;

        const data = trimmed.slice(6);
        try {
          const parsed = JSON.parse(data);
          const content = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
          if (content) {
            yield { content, model };
          }
          if (parsed.candidates?.[0]?.finishReason) {
            yield { content: '', done: true };
            return;
          }
        } catch {
          // Skip malformed JSON
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  yield { content: '', done: true };
}

// ─── Main LLM Client ─────────────────────────────────────────────────────────

export interface LLMCallOptions {
  model: string;
  messages: { role: string; content: string }[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

/**
 * Create a streaming generator for the given model using the user's API key.
 *
 * CRITICAL: This function ALWAYS uses the provider configured in user settings.
 * - If the user configured OpenRouter, ALL requests go through OpenRouter,
 *   even for models like "gpt-4o" that belong to OpenAI.
 * - If the user configured OpenAI directly, only OpenAI models are allowed.
 *
 * This prevents the bug where selecting a model from a different provider
 * would try to use the wrong API key with the wrong endpoint.
 */
export async function* streamLLM(options: LLMCallOptions): AsyncGenerator<StreamChunk> {
  const { model, messages, temperature = 0.7, maxTokens = 4096 } = options;

  // ── Step 1: Get the configured provider and API key from settings ──
  const settings = await getUserSettings();
  const apiKey = settings.apiKey;
  const configuredProvider = (settings.provider || 'openrouter') as ProviderKey;

  if (!apiKey) {
    yield { content: '', error: 'No API key configured. Please add your API key in Settings.', done: true };
    return;
  }

  // ── Step 2: Resolve the actual model ID based on the configured provider ──
  let actualModel = model;
  let provider = configuredProvider;
  const alias = MODEL_ALIASES[model];

  if (configuredProvider === 'openrouter') {
    // OpenRouter can route to ANY model from ANY provider.
    // Convert the model ID to its OpenRouter format.
    if (alias) {
      if (alias.provider === 'openrouter') {
        // Already an OpenRouter model ID (e.g., 'openrouter/auto', 'openai/gpt-4o')
        actualModel = alias.actualModel;
      } else {
        // It's a direct provider model (e.g., 'gpt-4o' → needs 'openai/gpt-4o' on OpenRouter)
        actualModel = convertToOpenRouterModel(alias);
      }
    } else {
      // Unknown model — pass through as-is (might be a valid OpenRouter model ID the user typed)
      actualModel = model;
    }
    // Always use OpenRouter config
    provider = 'openrouter';
  } else {
    // For non-OpenRouter providers, only allow models from that provider
    if (alias) {
      if (alias.provider === configuredProvider) {
        // Model matches the configured provider
        actualModel = alias.actualModel;
      } else {
        // Model belongs to a DIFFERENT provider than what's configured
        yield {
          content: '',
          error: `Model "${model}" is a ${PROVIDER_CONFIGS[alias.provider].name} model, but you have ${PROVIDER_CONFIGS[configuredProvider].name} configured. Please select a model from your configured provider, or switch to OpenRouter which supports all models.`,
          done: true,
        };
        return;
      }
    } else {
      // Unknown model — pass through as-is
      actualModel = model;
    }
  }

  const config = PROVIDER_CONFIGS[provider];
  if (!config) {
    yield { content: '', error: `Unknown provider: ${provider}`, done: true };
    return;
  }

  // ── Step 3: Route to the appropriate provider API ──
  try {
    if (config.anthropicFormat) {
      yield* streamAnthropic(apiKey, actualModel, messages, temperature, maxTokens);
    } else if (config.geminiFormat) {
      yield* streamGemini(apiKey, actualModel, messages, temperature, maxTokens);
    } else {
      // OpenAI-compatible (OpenAI, DeepSeek, Qwen, Mistral, OpenRouter)
      yield* streamOpenAICompatible(config, apiKey, actualModel, messages, temperature, maxTokens);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    yield { content: '', error: `Failed to connect to ${config.name}: ${message}`, done: true };
  }
}

/**
 * Non-streaming LLM call — collects all chunks and returns the full response.
 */
export async function callLLM(options: LLMCallOptions): Promise<{
  content: string;
  model: string;
  error?: string;
}> {
  let fullContent = '';
  let lastModel = options.model;

  for await (const chunk of streamLLM(options)) {
    if (chunk.error) {
      return { content: fullContent, model: lastModel, error: chunk.error };
    }
    fullContent += chunk.content;
    if (chunk.model) lastModel = chunk.model;
  }

  return { content: fullContent, model: lastModel };
}

/**
 * Test connection to a specific provider using the provided API key.
 */
export async function testProviderConnection(
  provider: ProviderKey,
  apiKey: string,
): Promise<{ success: boolean; error?: string }> {
  const config = PROVIDER_CONFIGS[provider];
  if (!config) {
    return { success: false, error: `Unknown provider: ${provider}` };
  }

  try {
    if (config.anthropicFormat) {
      // Test Anthropic connection
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: config.models[0],
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hi' }],
        }),
      });
      if (response.ok) return { success: true };
      const errorData = await response.text();
      return { success: false, error: `API error ${response.status}: ${errorData.slice(0, 200)}` };
    }

    if (config.geminiFormat) {
      // Test Gemini connection
      const model = config.models[0];
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: 'Hi' }] }],
            generationConfig: { maxOutputTokens: 10 },
          }),
        },
      );
      if (response.ok) return { success: true };
      const errorData = await response.text();
      return { success: false, error: `API error ${response.status}: ${errorData.slice(0, 200)}` };
    }

    // OpenRouter: validate API key by listing models (more reliable than chat completion)
    if (provider === 'openrouter') {
      const modelsUrl = 'https://openrouter.ai/api/v1/models';
      const modelsResponse = await fetch(modelsUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          ...config.extraHeaders,
        },
      });
      if (modelsResponse.ok) {
        return { success: true };
      }
      const errorData = await modelsResponse.text();
      let errorMsg = `OpenRouter API key validation failed (${modelsResponse.status})`;
      try {
        const parsed = JSON.parse(errorData);
        errorMsg = parsed.error?.message || parsed.error?.code || parsed.message || errorMsg;
      } catch {}
      return { success: false, error: errorMsg };
    }

    // Other OpenAI-compatible providers
    const url = `${config.baseUrl}${config.chatPath}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      ...config.extraHeaders,
    };

    const testModelId = config.testModel || config.models[0];

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: testModelId,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 10,
      }),
    });

    if (response.ok) return { success: true };
    const errorData = await response.text();
    let errorMsg = `API error ${response.status}`;
    try {
      const parsed = JSON.parse(errorData);
      errorMsg = parsed.error?.message || parsed.message || errorMsg;
    } catch {}
    return { success: false, error: errorMsg };
  } catch (error) {
    return {
      success: false,
      error: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Get the list of available models grouped by provider.
 */
export function getAvailableModels() {
  return Object.entries(PROVIDER_CONFIGS).map(([key, config]) => ({
    provider: key as ProviderKey,
    name: config.name,
    models: config.models,
  }));
}

/**
 * Get provider key from model alias.
 */
export function getProviderForModel(model: string): ProviderKey | null {
  return MODEL_ALIASES[model]?.provider ?? null;
}

/**
 * Get the list of models available for a specific provider.
 * For OpenRouter, this includes all models (OpenRouter can route to any provider).
 * For other providers, only their own models are returned.
 */
export function getModelsForProvider(provider: ProviderKey): string[] {
  if (provider === 'openrouter') {
    return PROVIDER_CONFIGS.openrouter.models;
  }
  return PROVIDER_CONFIGS[provider]?.models || [];
}
