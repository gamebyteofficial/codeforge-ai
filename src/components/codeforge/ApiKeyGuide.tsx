'use client';

import { useState } from 'react';
import {
  ExternalLink,
  Key,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Gift,
  Zap,
  Shield,
  HelpCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// ─── Provider Guide Data ─────────────────────────────────────────────────────

type ProviderKey =
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'qwen'
  | 'deepseek'
  | 'mistral'
  | 'openrouter';

interface ProviderGuide {
  name: string;
  icon: string;
  getUrl: string;
  getUrlLabel: string;
  steps: string[];
  pricing: string;
  freeCredits?: string;
  bestModels: string[];
  tip?: string;
}

const PROVIDER_GUIDES: Record<ProviderKey, ProviderGuide> = {
  openai: {
    name: 'OpenAI',
    icon: '🟢',
    getUrl: 'https://platform.openai.com/api-keys',
    getUrlLabel: 'platform.openai.com/api-keys',
    steps: [
      'Go to platform.openai.com and create an account',
      'Navigate to API Keys section in your dashboard',
      'Click "Create new secret key"',
      'Copy the key (starts with sk-...) and paste it here',
    ],
    pricing: 'Pay-as-you-go: GPT-4o from $2.50/1M input tokens',
    freeCredits: 'New accounts get ~$5 free credits',
    bestModels: ['GPT-4o (Best overall)', 'GPT-4o-mini (Fast & cheap)', 'o1 (Advanced reasoning)', 'o3-mini (Latest reasoning)'],
    tip: 'GPT-4o-mini is great for coding — fast, cheap, and very capable!',
  },
  anthropic: {
    name: 'Anthropic',
    icon: '🟠',
    getUrl: 'https://console.anthropic.com/settings/keys',
    getUrlLabel: 'console.anthropic.com/settings/keys',
    steps: [
      'Go to console.anthropic.com and create an account',
      'Navigate to API Keys in Settings',
      'Click "Create Key"',
      'Copy the key (starts with sk-ant-...) and paste it here',
    ],
    pricing: 'Pay-as-you-go: Claude 3.5 Sonnet from $3/1M input tokens',
    freeCredits: 'New accounts may get free credits',
    bestModels: ['Claude 3.5 Sonnet (Best for coding)', 'Claude 3 Opus (Most capable)', 'Claude 3 Haiku (Fastest)'],
    tip: 'Claude 3.5 Sonnet is one of the best coding models available!',
  },
  gemini: {
    name: 'Google Gemini',
    icon: '🔵',
    getUrl: 'https://aistudio.google.com/apikey',
    getUrlLabel: 'aistudio.google.com/apikey',
    steps: [
      'Go to aistudio.google.com with your Google account',
      'Click "Get API Key" in the left sidebar',
      'Create a new project or select an existing one',
      'Copy the API key and paste it here',
    ],
    pricing: 'Free tier: 15 RPM, 1M tokens/min | Paid: $1.25/1M input tokens',
    freeCredits: 'Generous free tier — 15 requests/min at no cost!',
    bestModels: ['Gemini 2.0 Flash (Fast & free)', 'Gemini 1.5 Pro (Best quality)', 'Gemini 1.5 Flash (Balanced)'],
    tip: 'Gemini has a generous free tier — great for trying out!',
  },
  qwen: {
    name: 'Qwen (Alibaba)',
    icon: '🟣',
    getUrl: 'https://dashscope.console.aliyun.com/apiKey',
    getUrlLabel: 'dashscope.console.aliyun.com',
    steps: [
      'Go to dashscope.console.aliyun.com',
      'Create an Alibaba Cloud account',
      'Navigate to API Keys in the dashboard',
      'Generate and copy your API key',
    ],
    pricing: 'Pay-as-you-go with free tier available',
    freeCredits: 'Free tier available for new users',
    bestModels: ['Qwen 2.5 72B (Most capable)', 'Qwen 2.5 Coder 32B (Best for code)'],
  },
  deepseek: {
    name: 'DeepSeek',
    icon: '🔷',
    getUrl: 'https://platform.deepseek.com/api_keys',
    getUrlLabel: 'platform.deepseek.com/api_keys',
    steps: [
      'Go to platform.deepseek.com and sign up',
      'Navigate to API Keys page',
      'Click "Create API Key"',
      'Copy the key and paste it here',
    ],
    pricing: 'Very affordable: DeepSeek-V3 from $0.27/1M input tokens',
    freeCredits: '500K free tokens for new users',
    bestModels: ['DeepSeek Chat (V3 — Most capable)', 'DeepSeek Coder (Specialized for code)'],
    tip: 'DeepSeek is one of the cheapest paid options with great quality!',
  },
  mistral: {
    name: 'Mistral',
    icon: '🟡',
    getUrl: 'https://console.mistral.ai/api-keys',
    getUrlLabel: 'console.mistral.ai/api-keys',
    steps: [
      'Go to console.mistral.ai and create an account',
      'Navigate to API Keys',
      'Click "Create new key"',
      'Copy the key and paste it here',
    ],
    pricing: 'Pay-as-you-go: Mistral Large from $2/1M input tokens',
    freeCredits: 'Some free credits for new accounts',
    bestModels: ['Mistral Large (Most capable)', 'Codestral (Best for code)', 'Mistral Medium (Balanced)'],
  },
  openrouter: {
    name: 'OpenRouter',
    icon: '🌐',
    getUrl: 'https://openrouter.ai/keys',
    getUrlLabel: 'openrouter.ai/keys',
    steps: [
      'Go to openrouter.ai and create an account',
      'Navigate to Keys page',
      'Click "Create Key"',
      'Copy the key (starts with sk-or-...) and paste it here',
    ],
    pricing: 'Varies by model — includes free and paid options',
    freeCredits: 'Some free models available without credits!',
    bestModels: ['Auto (Best auto-routing)', 'Any model from 100+ providers', 'Free models available'],
    tip: 'OpenRouter gives you access to ALL providers through one API key! Best value.',
  },
};

// ─── ApiKeyGuide Component ───────────────────────────────────────────────────

interface ApiKeyGuideProps {
  provider: ProviderKey;
  compact?: boolean;
}

export default function ApiKeyGuide({ provider, compact = false }: ApiKeyGuideProps) {
  const [isExpanded, setIsExpanded] = useState(compact ? false : true);
  const guide = PROVIDER_GUIDES[provider];

  if (!guide) return null;

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-800/30 overflow-hidden">
      {/* Header - always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-zinc-800/50 transition-colors"
      >
        <Key className="size-3.5 text-emerald-400 shrink-0" />
        <span className="text-xs font-medium text-zinc-300 flex-1">
          How to get a {guide.name} API Key
        </span>
        {isExpanded ? (
          <ChevronUp className="size-3.5 text-zinc-500 shrink-0" />
        ) : (
          <ChevronDown className="size-3.5 text-zinc-500 shrink-0" />
        )}
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-3">
          {/* Get API Key link */}
          <a
            href={guide.getUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-md bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-xs text-emerald-400 hover:bg-emerald-500/20 transition-colors"
          >
            <ExternalLink className="size-3.5 shrink-0" />
            <span className="font-medium">Get API Key from {guide.getUrlLabel}</span>
          </a>

          {/* Steps */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Steps
            </span>
            <ol className="space-y-1">
              {guide.steps.map((step, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-zinc-400">
                  <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-[9px] font-bold text-zinc-300 mt-0.5">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Pricing info */}
          <div className="flex items-start gap-2 rounded-md bg-zinc-800/50 px-2.5 py-2">
            <CreditCard className="size-3.5 text-zinc-500 shrink-0 mt-0.5" />
            <div>
              <span className="text-xs text-zinc-300">{guide.pricing}</span>
              {guide.freeCredits && (
                <div className="flex items-center gap-1 mt-1">
                  <Gift className="size-3 text-emerald-400" />
                  <span className="text-[11px] text-emerald-400">{guide.freeCredits}</span>
                </div>
              )}
            </div>
          </div>

          {/* Best models */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Popular Models
            </span>
            <div className="flex flex-wrap gap-1">
              {guide.bestModels.map((model) => (
                <span
                  key={model}
                  className="inline-flex items-center gap-1 rounded-md bg-zinc-700/50 px-2 py-0.5 text-[11px] text-zinc-300"
                >
                  <Zap className="size-2.5 text-amber-400" />
                  {model}
                </span>
              ))}
            </div>
          </div>

          {/* Tip */}
          {guide.tip && (
            <div className="flex items-start gap-2 rounded-md bg-amber-500/10 border border-amber-500/20 px-2.5 py-2">
              <HelpCircle className="size-3.5 text-amber-400 shrink-0 mt-0.5" />
              <span className="text-xs text-amber-300/80">{guide.tip}</span>
            </div>
          )}

          {/* Security note */}
          <div className="flex items-start gap-2 px-1">
            <Shield className="size-3 text-zinc-600 shrink-0 mt-0.5" />
            <span className="text-[11px] text-zinc-600">
              Your API key is stored locally and only used for backend API calls. Never sent to third parties.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── QuickProviderCards - for onboarding ─────────────────────────────────────

interface QuickProviderCardsProps {
  onSelect: (provider: ProviderKey) => void;
  selected?: ProviderKey;
}

export function QuickProviderCards({ onSelect, selected }: QuickProviderCardsProps) {
  const recommendedProviders: { key: ProviderKey; reason: string }[] = [
    { key: 'openrouter', reason: 'Access ALL models with one key' },
    { key: 'deepseek', reason: 'Cheapest paid option' },
    { key: 'gemini', reason: 'Generous free tier' },
  ];

  return (
    <div className="space-y-2">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        Quick Start — Recommended Providers
      </span>
      <div className="space-y-1.5">
        {recommendedProviders.map(({ key, reason }) => {
          const guide = PROVIDER_GUIDES[key];
          const isSelected = selected === key;
          return (
            <button
              key={key}
              onClick={() => onSelect(key)}
              className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all ${
                isSelected
                  ? 'border-emerald-500/40 bg-emerald-500/10'
                  : 'border-zinc-800 bg-zinc-800/30 hover:bg-zinc-800/60 hover:border-zinc-700'
              }`}
            >
              <span className="text-lg">{guide.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-zinc-200">{guide.name}</span>
                  {key === 'openrouter' && (
                    <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400">
                      RECOMMENDED
                    </span>
                  )}
                  {key === 'deepseek' && (
                    <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold text-amber-400">
                      BEST VALUE
                    </span>
                  )}
                  {key === 'gemini' && (
                    <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[9px] font-bold text-sky-400">
                      FREE TIER
                    </span>
                  )}
                </div>
                <span className="text-xs text-zinc-500">{reason}</span>
              </div>
              {guide.freeCredits && (
                <div className="flex items-center gap-1 shrink-0">
                  <Gift className="size-3 text-emerald-400" />
                  <span className="text-[10px] text-emerald-400">Free credits</span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── ModelPricingBadge ──────────────────────────────────────────────────────

interface ModelPricingInfo {
  isFree: boolean;
  pricing?: { prompt: string; completion: string };
  contextLength?: number;
}

export function ModelPricingBadge({ isFree, pricing, contextLength }: ModelPricingInfo) {
  if (isFree) {
    return (
      <span className="shrink-0 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400">
        FREE
      </span>
    );
  }

  const promptPrice = pricing?.prompt;
  const displayPrice = promptPrice && promptPrice !== '0'
    ? `$${promptPrice}/1M`
    : null;

  return (
    <div className="flex items-center gap-1 shrink-0">
      <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold text-amber-400">
        PAID
      </span>
      {displayPrice && (
        <span className="text-[9px] text-zinc-500 font-mono">{displayPrice}</span>
      )}
      {contextLength && (
        <span className="text-[9px] text-zinc-600 font-mono">
          {contextLength >= 1000000
            ? `${(contextLength / 1000000).toFixed(1)}M`
            : contextLength >= 1000
              ? `${(contextLength / 1000).toFixed(0)}K`
              : contextLength}{' '}
          ctx
        </span>
      )}
    </div>
  );
}
