/**
 * Shared Provider Display Information
 *
 * SINGLE SOURCE OF TRUTH for provider display data used across UI components.
 * The ProviderKey type is re-exported from llm.ts for convenience.
 *
 * NOTE: llm.ts has its own PROVIDER_CONFIGS for API connection config (base URL,
 * headers, format, etc.) — that serves a different purpose and is not modified here.
 */

import type { ProviderKey } from '@/lib/llm';

export type { ProviderKey };

// ─── Provider Display Info ────────────────────────────────────────────────────

export interface ProviderDisplayInfo {
  key: ProviderKey;
  /** Display name e.g. "OpenAI", "OpenRouter" */
  name: string;
  /** Emoji icon for UI display */
  icon: string;
  /** Tailwind color class for the provider */
  color: string;
  /** Placeholder / hint text for API key input */
  keyHint?: string;
  /** Whether this provider requires an API key to use */
  needsKey: boolean;
  /** Whether this provider offers free models (no payment required) */
  isFree: boolean;
  /** Known model IDs for this provider (static list; dynamic models fetched via API) */
  models: string[];
}

/**
 * Unified provider display information.
 * Used by OnboardingWizard, SettingsModal, ApiKeyGuide, and any future UI.
 */
export const PROVIDER_DISPLAY_INFO: Record<ProviderKey, ProviderDisplayInfo> = {
  openai: {
    key: 'openai',
    name: 'OpenAI',
    icon: '🟢',
    color: 'text-green-500',
    keyHint: 'sk-... (from platform.openai.com)',
    needsKey: true,
    isFree: false,
    models: ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo', 'o1', 'o1-mini'],
  },
  anthropic: {
    key: 'anthropic',
    name: 'Anthropic',
    icon: '🟠',
    color: 'text-orange-500',
    keyHint: 'sk-ant-... (from console.anthropic.com)',
    needsKey: true,
    isFree: false,
    models: ['claude-3.5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-haiku-20240307'],
  },
  gemini: {
    key: 'gemini',
    name: 'Google Gemini',
    icon: '🔵',
    color: 'text-blue-500',
    keyHint: 'AI... (from aistudio.google.com)',
    needsKey: true,
    isFree: true, // generous free tier
    models: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
  },
  qwen: {
    key: 'qwen',
    name: 'Qwen',
    icon: '🟣',
    color: 'text-purple-500',
    keyHint: 'sk-... (from dashscope.aliyuncs.com)',
    needsKey: true,
    isFree: false,
    models: ['qwen-2.5-72b-instruct', 'qwen-2.5-coder-32b-instruct'],
  },
  deepseek: {
    key: 'deepseek',
    name: 'DeepSeek',
    icon: '🔷',
    color: 'text-sky-500',
    keyHint: 'sk-... (from platform.deepseek.com)',
    needsKey: true,
    isFree: false,
    models: ['deepseek-chat', 'deepseek-coder'],
  },
  mistral: {
    key: 'mistral',
    name: 'Mistral',
    icon: '🟡',
    color: 'text-yellow-500',
    keyHint: '... (from console.mistral.ai)',
    needsKey: true,
    isFree: false,
    models: ['mistral-large-latest', 'mistral-medium-latest', 'codestral-latest'],
  },
  openrouter: {
    key: 'openrouter',
    name: 'OpenRouter',
    icon: '🌐',
    color: 'text-emerald-500',
    keyHint: 'sk-or-... (from openrouter.ai)',
    needsKey: true,
    isFree: true, // has free models
    models: ['openrouter/auto'],
  },
  opencode: {
    key: 'opencode',
    name: 'OpenCode Zen',
    icon: '🧘',
    color: 'text-teal-500',
    keyHint: 'oc-... (from opencode.ai/zen)',
    needsKey: true,
    isFree: true, // 6 free models
    models: [
      'big-pickle', 'deepseek-v4-flash-free', 'mimo-v2.5-free',
      'qwen3.6-plus-free', 'minimax-m3-free', 'nemotron-3-super-free',
      'kimi-k2.6', 'kimi-k2.5', 'qwen3.6-plus', 'claude-sonnet-4',
      'claude-opus-4', 'gpt-5', 'gpt-5.1-codex', 'gemini-3.5-flash',
    ],
  },
  groq: {
    key: 'groq',
    name: 'Groq',
    icon: '⚡',
    color: 'text-amber-500',
    keyHint: 'gsk_... (from console.groq.com)',
    needsKey: true,
    isFree: true, // generous free tier
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it'],
  },
  together: {
    key: 'together',
    name: 'Together AI',
    icon: '🤝',
    color: 'text-indigo-500',
    keyHint: '... (from api.together.xyz)',
    needsKey: true,
    isFree: false,
    models: ['meta-llama/Llama-3-70b-chat-hf', 'mistralai/Mixtral-8x7B-Instruct-v0.1', 'togethercomputer/RedPajama-INCITE-7B-Chat'],
  },
};
