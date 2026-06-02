/**
 * Multi-Provider LLM Client — OPTIMIZED
 *
 * Supports: OpenAI, Anthropic, Google Gemini, Qwen, DeepSeek, Mistral, OpenRouter, OpenCode Zen, Groq, Together
 * Each provider uses the user's own API key stored in settings.
 *
 * PERFORMANCE OPTIMIZATIONS:
 * - When clientSettings are provided, skip DB read entirely (saves 50-5000ms on Vercel)
 * - In-memory settings cache with TTL (avoids repeated DB reads)
 * - Direct provider resolution without redundant lookups
 * - Connection reuse via keep-alive headers
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
  | 'openrouter'
  | 'opencode'
  | 'groq'
  | 'together';

interface ProviderConfig {
  name: string;
  baseUrl: string;
  models: string[];
  testModel?: string;
  chatPath: string;
  openaiCompatible: boolean;
  extraHeaders?: Record<string, string>;
  geminiFormat?: boolean;
  anthropicFormat?: boolean;
}

const PROVIDER_CONFIGS: Record<ProviderKey, ProviderConfig> = {
  openai: {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo', 'o1', 'o1-mini'],
    testModel: 'gpt-3.5-turbo',
    chatPath: '/chat/completions',
    openaiCompatible: true,
  },
  anthropic: {
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com',
    models: ['claude-3.5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-haiku-20240307'],
    testModel: 'claude-3-haiku-20240307',
    chatPath: '/v1/messages',
    openaiCompatible: false,
    anthropicFormat: true,
  },
  gemini: {
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    models: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    testModel: 'gemini-2.0-flash',
    chatPath: '',
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
    models: ['openrouter/auto'],
    testModel: 'openrouter/auto',
    chatPath: '/chat/completions',
    openaiCompatible: true,
    extraHeaders: {
      'HTTP-Referer': 'https://codeforge-ai.app',
      'X-Title': 'CodeForge AI',
    },
  },
  opencode: {
    name: 'OpenCode Zen',
    baseUrl: 'https://opencode.ai/zen/v1',
    models: [
      'big-pickle', 'deepseek-v4-flash-free', 'mimo-v2.5-free',
      'qwen3.6-plus-free', 'minimax-m3-free', 'nemotron-3-super-free',
      'kimi-k2.6', 'kimi-k2.5', 'qwen3.6-plus', 'claude-sonnet-4',
      'claude-opus-4', 'gpt-5', 'gpt-5.1-codex', 'gemini-3.5-flash',
    ],
    testModel: 'big-pickle',
    chatPath: '/chat/completions',
    openaiCompatible: true,
    extraHeaders: {
      'HTTP-Referer': 'https://codeforge-ai.app',
      'X-Title': 'CodeForge AI',
    },
  },
  groq: {
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it'],
    testModel: 'llama-3.1-8b-instant',
    chatPath: '/chat/completions',
    openaiCompatible: true,
  },
  together: {
    name: 'Together AI',
    baseUrl: 'https://api.together.xyz/v1',
    models: ['meta-llama/Llama-3-70b-chat-hf', 'mistralai/Mixtral-8x7B-Instruct-v0.1', 'togethercomputer/RedPajama-INCITE-7B-Chat'],
    testModel: 'meta-llama/Llama-3-70b-chat-hf',
    chatPath: '/chat/completions',
    openaiCompatible: true,
  },
};

// ─── In-Memory Settings Cache ────────────────────────────────────────────────

const settingsCache = {
  data: null as Record<string, string> | null,
  timestamp: 0,
  ttl: 10_000, // 10 seconds — fast enough for multi-request sessions
};

async function getUserSettings(): Promise<Record<string, string>> {
  // Return cached settings if still fresh
  if (settingsCache.data && Date.now() - settingsCache.timestamp < settingsCache.ttl) {
    return settingsCache.data;
  }

  try {
    const settings = await db.setting.findMany();
    const map: Record<string, string> = {};
    settings.forEach((s) => { map[s.key] = s.value; });
    settingsCache.data = map;
    settingsCache.timestamp = Date.now();
    return map;
  } catch {
    // Database unavailable (e.g., Vercel serverless with SQLite)
    return {};
  }
}

/** Invalidate the settings cache (call after saving new settings) */
export function invalidateSettingsCache(): void {
  settingsCache.data = null;
  settingsCache.timestamp = 0;
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
    'Connection': 'keep-alive',
    ...config.extraHeaders,
  };

  const body = JSON.stringify({
    model,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    temperature,
    max_tokens: maxTokens,
    stream: true,
  });

  console.log(`[LLM] Calling ${config.name}: ${model}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    });
  } catch (fetchError) {
    clearTimeout(timeoutId);
    const errMsg = fetchError instanceof Error ? fetchError.message : 'Unknown error';
    console.error(`[LLM] Fetch error calling ${config.name}: ${errMsg}`);

    if (fetchError instanceof DOMException && fetchError.name === 'AbortError') {
      yield { content: '', error: `Request to ${config.name} timed out after 120 seconds. Try a different model or provider.`, done: true };
    } else {
      const isNetworkError = errMsg.includes('ECONNREFUSED') || errMsg.includes('ENOTFOUND') ||
        errMsg.includes('fetch failed') || errMsg.includes('network') || errMsg.includes('NetworkError');
      yield { content: '', error: isNetworkError
        ? `Could not reach ${config.name} (network error). Check your API key or try a different provider.`
        : `Could not reach ${config.name}: ${errMsg}.`, done: true };
    }
    return;
  }
  clearTimeout(timeoutId);

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `API error ${response.status}`;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.error?.message || errorJson.message || errorMessage;
    } catch {}
    console.error(`[LLM] ${config.name} API error: ${response.status} - ${errorMessage}`);

    const isModelUnavailable = errorMessage.toLowerCase().includes('no endpoints') ||
      errorMessage.toLowerCase().includes('not available') ||
      errorMessage.toLowerCase().includes('model not found') ||
      response.status === 404;

    const isRateLimited = response.status === 429 ||
      errorMessage.toLowerCase().includes('rate limit') ||
      errorMessage.toLowerCase().includes('too many requests');

    if (model !== 'openrouter/auto' && config.extraHeaders && (isModelUnavailable || isRateLimited)) {
      const reason = isRateLimited ? 'rate limited' : 'currently unavailable';
      console.log(`[LLM] Model "${model}" ${reason}. Auto-retrying with openrouter/auto...`);
      yield { content: `⚠️ Model "${model}" is ${reason}. Auto-switching to openrouter/auto...\n\n`, done: false };
      yield* streamOpenAICompatible(config, apiKey, 'openrouter/auto', messages, temperature, maxTokens);
      return;
    }

    if (isRateLimited) {
      yield { content: '', error: 'Rate limit reached. Please wait a moment and try again.', done: true };
      return;
    }

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
    'Connection': 'keep-alive',
  };

  const systemPrompt = messages.find((m) => m.role === 'system')?.content || '';
  const chatMessages = messages.filter((m) => m.role !== 'system').map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
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

  console.log(`[LLM] Calling Anthropic: ${model}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000);

  let response: Response;
  try {
    response = await fetch(url, { method: 'POST', headers, body, signal: controller.signal });
  } catch (fetchError) {
    clearTimeout(timeoutId);
    const errMsg = fetchError instanceof Error ? fetchError.message : 'Unknown error';
    if (fetchError instanceof DOMException && fetchError.name === 'AbortError') {
      yield { content: '', error: 'Request to Anthropic timed out. Try a different provider.', done: true };
    } else {
      yield { content: '', error: `Could not reach Anthropic: ${errMsg}.`, done: true };
    }
    return;
  }
  clearTimeout(timeoutId);

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `Anthropic API error ${response.status}`;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.error?.message || errorJson.message || errorMessage;
    } catch {}
    console.error(`[LLM] Anthropic API error: ${response.status} - ${errorMessage}`);
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

  const systemInstruction = messages.find((m) => m.role === 'system')?.content || '';
  const contents = messages
    .filter((m) => m.role !== 'system')
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

  console.log(`[LLM] Calling Gemini: ${model}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Connection': 'keep-alive' },
      body,
      signal: controller.signal,
    });
  } catch (fetchError) {
    clearTimeout(timeoutId);
    const errMsg = fetchError instanceof Error ? fetchError.message : 'Unknown error';
    yield { content: '', error: `Could not reach Gemini: ${errMsg}.`, done: true };
    return;
  }
  clearTimeout(timeoutId);

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `Gemini API error ${response.status}`;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.error?.message || errorMessage;
    } catch {}
    console.error(`[LLM] Gemini API error: ${response.status} - ${errorMessage}`);
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

// ─── Per-Provider API Key Helper ──────────────────────────────────────────────

export function getApiKeyForProvider(settings: Record<string, string>, provider: ProviderKey): string | null {
  const perProviderKey = settings[`${provider}_apiKey`];
  if (perProviderKey) return perProviderKey;
  if (settings.provider === provider && settings.apiKey) return settings.apiKey;
  if (settings.apiKey) return settings.apiKey;
  return null;
}

// ─── Main LLM Client ─────────────────────────────────────────────────────────

export interface LLMCallOptions {
  model: string;
  messages: { role: string; content: string }[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  /** Client-provided settings — when provided, skip DB read for maximum speed */
  clientSettings?: Record<string, string>;
  /** When true, use clientSettings directly without DB fallback (fastest path) */
  preferClientSettings?: boolean;
}

interface ResolvedProvider {
  provider: ProviderKey;
  apiKey: string;
  config: ProviderConfig;
  isFallback: boolean;
}

function resolveProvider(settings: Record<string, string>): ResolvedProvider | null {
  const primaryProvider = (settings.provider || 'openrouter') as ProviderKey;
  const primaryConfig = PROVIDER_CONFIGS[primaryProvider];
  const primaryKey = getApiKeyForProvider(settings, primaryProvider);

  if (primaryKey && primaryConfig) {
    return { provider: primaryProvider, apiKey: primaryKey, config: primaryConfig, isFallback: false };
  }

  const fallbackSlots: [string, ProviderKey | undefined][] = [
    ['secondary', settings.provider2 as ProviderKey | undefined],
    ['tertiary', settings.provider3 as ProviderKey | undefined],
    ['quaternary', settings.provider4 as ProviderKey | undefined],
  ];

  for (const [slotName, fallbackProvider] of fallbackSlots) {
    if (!fallbackProvider) continue;
    const fallbackConfig = PROVIDER_CONFIGS[fallbackProvider];
    const fallbackKey = getApiKeyForProvider(settings, fallbackProvider);
    if (fallbackKey && fallbackConfig) {
      console.log(`[LLM] Primary provider "${primaryProvider}" has no API key. Falling back to ${slotName} "${fallbackProvider}".`);
      return { provider: fallbackProvider, apiKey: fallbackKey, config: fallbackConfig, isFallback: true };
    }
  }

  return null;
}

export async function* streamLLM(options: LLMCallOptions): AsyncGenerator<StreamChunk> {
  const { model, messages, temperature = 0.7, maxTokens = 4096, clientSettings, preferClientSettings } = options;

  // ── Step 1: Resolve settings — FAST PATH when client provides them ──
  let settings: Record<string, string>;

  if (preferClientSettings && clientSettings && Object.keys(clientSettings).length > 0) {
    // FASTEST PATH: Use client settings directly, skip DB read entirely
    settings = clientSettings;
  } else if (clientSettings && Object.keys(clientSettings).length > 0) {
    // SLOW PATH: Try DB first, merge client settings as fallback
    const dbSettings = await getUserSettings();
    if (Object.keys(dbSettings).length > 0) {
      settings = { ...dbSettings };
      // Client settings fill in gaps
      for (const [key, value] of Object.entries(clientSettings)) {
        if (!settings[key] && value) {
          settings[key] = value;
        }
      }
    } else {
      settings = { ...clientSettings };
    }
  } else {
    // NO CLIENT SETTINGS: Must read from DB
    settings = await getUserSettings();
  }

  const resolved = resolveProvider(settings);

  if (!resolved) {
    const primaryProvider = settings.provider || 'openrouter';
    const checkedProviders = [
      primaryProvider,
      settings.provider2,
      settings.provider3,
      settings.provider4,
    ].filter(Boolean);
    console.error(`[LLM] No API key found. Checked providers: ${checkedProviders.join(', ')}`);
    yield {
      content: '',
      error: `No API key configured. Checked providers: ${checkedProviders.map(p => PROVIDER_CONFIGS[p as ProviderKey]?.name || p).join(', ')}. Please add an API key in ⚙️ Settings.`,
      done: true,
    };
    return;
  }

  const { provider, apiKey, config, isFallback } = resolved;
  let actualModel = model;

  if (isFallback) {
    const modelBelongsToProvider = config.models.some(m => m === actualModel) ||
      actualModel.startsWith('openrouter/') && provider === 'openrouter';
    if (!modelBelongsToProvider) {
      const fallbackModel = config.testModel || config.models[0] || 'openrouter/auto';
      console.log(`[LLM] Model "${actualModel}" not available on "${provider}". Using "${fallbackModel}".`);
      yield { content: `⚠️ Switched to ${config.name} (${fallbackModel}) as fallback.\n\n`, done: false };
      actualModel = fallbackModel;
    }
  }

  if (!config) {
    yield { content: '', error: `Unknown provider: ${provider}`, done: true };
    return;
  }

  console.log(`[LLM] Streaming: provider=${provider}, model=${actualModel}, fallback=${isFallback}`);

  let primaryError: string | null = null;

  try {
    if (config.anthropicFormat) {
      yield* streamAnthropic(apiKey, actualModel, messages, temperature, maxTokens);
    } else if (config.geminiFormat) {
      yield* streamGemini(apiKey, actualModel, messages, temperature, maxTokens);
    } else {
      yield* streamOpenAICompatible(config, apiKey, actualModel, messages, temperature, maxTokens);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error(`[LLM] Fatal error calling ${config.name}:`, errorMsg);
    primaryError = errorMsg;

    if (provider === 'openrouter' && actualModel !== 'openrouter/auto') {
      console.log(`[LLM] Auto-retrying with openrouter/auto...`);
      yield { content: `⚠️ Model "${actualModel}" failed. Auto-switching to openrouter/auto...\n\n`, done: false };
      try {
        yield* streamOpenAICompatible(config, apiKey, 'openrouter/auto', messages, temperature, maxTokens);
        return;
      } catch (retryError) {
        const retryMsg = retryError instanceof Error ? retryError.message : 'Unknown error';
        primaryError = `Retry also failed: ${retryMsg}`;
      }
    }

    if (!isFallback) {
      const secondaryProvider = settings.provider2 as ProviderKey | undefined;
      if (secondaryProvider) {
        const secondaryConfig = PROVIDER_CONFIGS[secondaryProvider];
        const secondaryKey = getApiKeyForProvider(settings, secondaryProvider);
        if (secondaryKey && secondaryConfig) {
          const fallbackModel = secondaryConfig.testModel || secondaryConfig.models[0] || 'openrouter/auto';
          console.log(`[LLM] Primary failed. Retrying with secondary "${secondaryProvider}" model "${fallbackModel}"...`);
          yield { content: `⚠️ ${config.name} failed. Switching to ${secondaryConfig.name}...\n\n`, done: false };
          try {
            if (secondaryConfig.anthropicFormat) {
              yield* streamAnthropic(secondaryKey, fallbackModel, messages, temperature, maxTokens);
            } else if (secondaryConfig.geminiFormat) {
              yield* streamGemini(secondaryKey, fallbackModel, messages, temperature, maxTokens);
            } else {
              yield* streamOpenAICompatible(secondaryConfig, secondaryKey, fallbackModel, messages, temperature, maxTokens);
            }
            return;
          } catch (fallbackError) {
            const fallbackMsg = fallbackError instanceof Error ? fallbackError.message : 'Unknown error';
            yield { content: '', error: `Both providers failed. Primary: ${primaryError}. Secondary: ${fallbackMsg}`, done: true };
            return;
          }
        }
      }
    }

    yield { content: '', error: `Failed to connect to ${config.name}: ${errorMsg}`, done: true };
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

    if (provider === 'openrouter') {
      const modelsResponse = await fetch('https://openrouter.ai/api/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          ...config.extraHeaders,
        },
      });
      if (modelsResponse.ok) return { success: true };
      const errorData = await modelsResponse.text();
      let errorMsg = `OpenRouter API key validation failed (${modelsResponse.status})`;
      try {
        const parsed = JSON.parse(errorData);
        errorMsg = parsed.error?.message || parsed.error?.code || parsed.message || errorMsg;
      } catch {}
      return { success: false, error: errorMsg };
    }

    if (provider === 'opencode') {
      const modelsResponse = await fetch(`${config.baseUrl}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          ...config.extraHeaders,
        },
      });
      if (modelsResponse.ok) return { success: true };
      const errorData = await modelsResponse.text();
      let errorMsg = `OpenCode Zen API key validation failed (${modelsResponse.status})`;
      try {
        const parsed = JSON.parse(errorData);
        errorMsg = parsed.error?.message || parsed.error?.code || parsed.message || errorMsg;
      } catch {}
      return { success: false, error: errorMsg };
    }

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

export function getAvailableModels() {
  return Object.entries(PROVIDER_CONFIGS).map(([key, config]) => ({
    provider: key as ProviderKey,
    name: config.name,
    models: config.models,
  }));
}

export function getProviderConfig(provider: ProviderKey): ProviderConfig | undefined {
  return PROVIDER_CONFIGS[provider];
}

export function getModelsForProvider(provider: ProviderKey): string[] {
  return PROVIDER_CONFIGS[provider]?.models || [];
}
