'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  Code2,
  Terminal,
  Brain,
  RefreshCw,
  CreditCard,
  Gift,
} from 'lucide-react';
import { useAppStore } from '@/store';
import { useUIState, useStore } from '@/store/hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import ApiKeyGuide, { QuickProviderCards } from './ApiKeyGuide';

// ─── Provider / Model Definitions ────────────────────────────────────────────

type ProviderKey =
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'qwen'
  | 'deepseek'
  | 'mistral'
  | 'openrouter'
  | 'opencode';

interface DynamicModel {
  id: string;
  name: string;
  provider: string;
  isFree: boolean;
}

interface ProviderInfo {
  name: string;
  icon: string;
  keyHint?: string;
}

const PROVIDERS: Record<ProviderKey, ProviderInfo> = {
  openai: {
    name: 'OpenAI',
    icon: '🟢',
    keyHint: 'sk-... (from platform.openai.com)',
  },
  anthropic: {
    name: 'Anthropic',
    icon: '🟠',
    keyHint: 'sk-ant-... (from console.anthropic.com)',
  },
  gemini: {
    name: 'Google Gemini',
    icon: '🔵',
    keyHint: 'AI... (from aistudio.google.com)',
  },
  qwen: {
    name: 'Qwen',
    icon: '🟣',
    keyHint: 'sk-... (from dashscope.aliyuncs.com)',
  },
  deepseek: {
    name: 'DeepSeek',
    icon: '🔷',
    keyHint: 'sk-... (from platform.deepseek.com)',
  },
  mistral: {
    name: 'Mistral',
    icon: '🟡',
    keyHint: '... (from console.mistral.ai)',
  },
  openrouter: {
    name: 'OpenRouter',
    icon: '🌐',
    keyHint: 'sk-or-... (from openrouter.ai)',
  },
  opencode: {
    name: 'OpenCode Zen',
    icon: '🧘',
    keyHint: 'oc-... (from opencode.ai/zen)',
  },
};

// ─── Animation Variants ──────────────────────────────────────────────────────

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 300 : -300,
    opacity: 0,
  }),
};

// ─── OnboardingWizard Component ──────────────────────────────────────────────

export default function OnboardingWizard() {
  const setSettings = useStore(s => s.setSettings);
  const setIsOnboarded = useStore(s => s.setIsOnboarded);
  const setSelectedModel = useUIState(s => s.setSelectedModel);

  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);

  // Step 2 state
  const [provider, setProvider] = useState<ProviderKey>('openrouter');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Step 3 state
  const [model, setModel] = useState('openrouter/auto');
  const [models, setModels] = useState<DynamicModel[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(4096);
  const [isSaving, setIsSaving] = useState(false);

  const goToStep = (nextStep: number) => {
    setDirection(nextStep > step ? 1 : -1);
    setStep(nextStep);
  };

  const handleProviderChange = (newProvider: string) => {
    const key = newProvider as ProviderKey;
    setProvider(key);
    setConnectionStatus('idle');
    // Reset model to auto/default
    if (key === 'openrouter') {
      setModel('openrouter/auto');
    } else if (key === 'opencode') {
      setModel('opencode/big-pickle');
    } else {
      setModel('');
    }
    setModels([]);
  };

  // Fetch models when moving to step 2 (after connection test) or when provider changes
  const fetchModels = useCallback(async () => {
    setIsLoadingModels(true);
    try {
      // Save provider temporarily so /api/models can read it
      const tempRes = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: { provider, apiKey } }),
      });

      if (tempRes.ok) {
        const modelsRes = await fetch('/api/models');
        if (modelsRes.ok) {
          const data = await modelsRes.json();
          const fetchedModels: DynamicModel[] = data.models || [];
          setModels(fetchedModels);
          // Set default model
          if (fetchedModels.length > 0) {
            const defaultModel = fetchedModels.find((m) => m.id === 'openrouter/auto') || fetchedModels[0];
            setModel(defaultModel.id);
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch models:', err);
    } finally {
      setIsLoadingModels(false);
    }
  }, [provider, apiKey]);

  // Fetch models when entering step 3
  useEffect(() => {
    if (step === 2) {
      fetchModels();
    }
  }, [step, fetchModels]);

  const handleTestConnection = useCallback(async () => {
    setIsTesting(true);
    setConnectionStatus('idle');
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: { provider, apiKey },
          testConnection: true,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setConnectionStatus('success');
        toast.success('Connection successful', {
          description: `Connected to ${PROVIDERS[provider].name}`,
        });
      } else {
        setConnectionStatus('error');
        toast.error('Connection failed', {
          description: data.error || 'Could not connect to the provider.',
        });
      }
    } catch {
      setConnectionStatus('error');
      toast.error('Connection failed', {
        description: 'Network error. Please check your API key.',
      });
    } finally {
      setIsTesting(false);
    }
  }, [provider, apiKey]);

  const handleComplete = useCallback(async () => {
    setIsSaving(true);
    try {
      const settings = {
        provider,
        apiKey,
        model,
        temperature: String(temperature),
        maxTokens: String(maxTokens),
      };

      // Save to API
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      });

      if (res.ok) {
        // Update Zustand store
        setSettings(settings);
        setSelectedModel(model);
        setIsOnboarded(true);
        toast.success('Setup complete!', {
          description: `You're all set with ${PROVIDERS[provider].name} — ${model}`,
        });
      } else {
        toast.error('Failed to save settings', {
          description: 'Please try again.',
        });
      }
    } catch {
      toast.error('Failed to save settings', {
        description: 'Network error. Please try again.',
      });
    } finally {
      setIsSaving(false);
    }
  }, [provider, apiKey, model, temperature, maxTokens, setSettings, setIsOnboarded, setSelectedModel]);

  const canGoNext = step === 0
    ? true
    : step === 1
      ? apiKey.length > 0 && connectionStatus === 'success'
      : true;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950">
      {/* Background decorative elements */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/4 top-1/4 size-96 rounded-full bg-emerald-500/5 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 size-96 rounded-full bg-emerald-600/5 blur-3xl" />
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '64px 64px',
          }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-lg px-4"
      >
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-8 shadow-2xl shadow-black/50 backdrop-blur-xl max-h-[90vh] overflow-y-auto custom-scrollbar">
          {/* Step indicator dots */}
          <div className="mb-8 flex items-center justify-center gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <motion.div
                  animate={{
                    scale: step === i ? 1.3 : 1,
                    backgroundColor: step === i ? '#10b981' : step > i ? '#059669' : '#3f3f46',
                  }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  className="size-2.5 rounded-full"
                />
                {i < 2 && (
                  <motion.div
                    animate={{
                      backgroundColor: step > i ? '#059669' : '#3f3f46',
                    }}
                    className="h-px w-8"
                  />
                )}
              </div>
            ))}
          </div>

          {/* Step content with slide animation */}
          <AnimatePresence mode="wait" custom={direction}>
            {step === 0 && (
              <motion.div
                key="step-0"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              >
                <Step1Welcome />
              </motion.div>
            )}
            {step === 1 && (
              <motion.div
                key="step-1"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              >
                <Step2ApiKey
                  provider={provider}
                  apiKey={apiKey}
                  showApiKey={showApiKey}
                  isTesting={isTesting}
                  connectionStatus={connectionStatus}
                  onProviderChange={handleProviderChange}
                  onApiKeyChange={setApiKey}
                  onShowApiKeyChange={setShowApiKey}
                  onTestConnection={handleTestConnection}
                />
              </motion.div>
            )}
            {step === 2 && (
              <motion.div
                key="step-2"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              >
                <Step3ModelSelection
                  provider={provider}
                  model={model}
                  models={models}
                  isLoadingModels={isLoadingModels}
                  temperature={temperature}
                  maxTokens={maxTokens}
                  onModelChange={setModel}
                  onTemperatureChange={setTemperature}
                  onMaxTokensChange={setMaxTokens}
                  onRefreshModels={fetchModels}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation buttons */}
          <div className="mt-8 flex items-center justify-between">
            {step > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => goToStep(step - 1)}
                className="text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              >
                <ArrowLeft className="mr-1 size-4" />
                Back
              </Button>
            ) : (
              <div />
            )}

            {step < 2 ? (
              <Button
                size="sm"
                onClick={() => goToStep(step + 1)}
                disabled={!canGoNext}
                className="bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {step === 0 ? 'Get Started' : 'Next'}
                <ArrowRight className="ml-1 size-4" />
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleComplete}
                disabled={isSaving}
                className="bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-1 size-4 animate-spin" />
                    Setting up...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-1 size-4" />
                    Start Coding
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Bottom brand */}
        <div className="mt-6 text-center">
          <p className="text-xs text-zinc-600">
            Powered by <span className="text-zinc-400">Z.ai</span>
          </p>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Step 1: Welcome Screen ──────────────────────────────────────────────────

function Step1Welcome() {
  return (
    <div className="flex flex-col items-center text-center">
      {/* Logo */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.1 }}
        className="mb-6 flex size-20 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-lg shadow-emerald-500/25"
      >
        <Zap className="size-10 text-white" />
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-2 text-2xl font-bold text-zinc-100"
      >
        Welcome to <span className="text-emerald-400">CodeForge AI</span>
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mb-8 text-sm text-zinc-400"
      >
        Your intelligent coding companion. Set up your AI provider to get started.
      </motion.p>

      {/* Feature highlights */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="grid grid-cols-3 gap-3 w-full"
      >
        {[
          { icon: Code2, label: 'Smart Code', desc: 'AI-powered code generation' },
          { icon: Terminal, label: 'Terminal', desc: 'Integrated shell access' },
          { icon: Brain, label: 'Memory', desc: 'Context-aware assistance' },
        ].map((feature) => (
          <div
            key={feature.label}
            className="flex flex-col items-center rounded-xl border border-zinc-800 bg-zinc-800/30 p-3"
          >
            <feature.icon className="mb-1.5 size-5 text-emerald-400" />
            <span className="text-xs font-medium text-zinc-200">{feature.label}</span>
            <span className="mt-0.5 text-[10px] text-zinc-500">{feature.desc}</span>
          </div>
        ))}
      </motion.div>
    </div>
  );
}

// ─── Step 2: API Key Input ───────────────────────────────────────────────────

interface Step2Props {
  provider: ProviderKey;
  apiKey: string;
  showApiKey: boolean;
  isTesting: boolean;
  connectionStatus: 'idle' | 'success' | 'error';
  onProviderChange: (provider: string) => void;
  onApiKeyChange: (key: string) => void;
  onShowApiKeyChange: (show: boolean) => void;
  onTestConnection: () => void;
}

function Step2ApiKey({
  provider,
  apiKey,
  showApiKey,
  isTesting,
  connectionStatus,
  onProviderChange,
  onApiKeyChange,
  onShowApiKeyChange,
  onTestConnection,
}: Step2Props) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="text-center">
        <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <Zap className="size-5 text-emerald-400" />
        </div>
        <h2 className="text-lg font-semibold text-zinc-100">Connect your AI Provider</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Choose a provider and enter your API key to get started.
        </p>
      </div>

      {/* Quick Provider Cards */}
      <QuickProviderCards selected={provider} onSelect={onProviderChange} />

      {/* Full Provider Selector */}
      <div className="space-y-2">
        <Label className="text-zinc-300 text-xs">Or select from all providers</Label>
        <Select value={provider} onValueChange={onProviderChange}>
          <SelectTrigger className="w-full bg-zinc-800/50 border-zinc-700 text-zinc-200 h-9">
            <SelectValue placeholder="Select provider" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-800 border-zinc-700">
            {(Object.entries(PROVIDERS) as [ProviderKey, ProviderInfo][]).map(
              ([key, info]) => (
                <SelectItem
                  key={key}
                  value={key}
                  className="text-zinc-200 focus:bg-zinc-700 focus:text-zinc-100"
                >
                  <span className="mr-2">{info.icon}</span>
                  {info.name}
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>
        {/* Active provider indicator */}
        <div className="flex items-center gap-2">
          <div className="size-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs text-zinc-500">
            Active: {PROVIDERS[provider].name}
            {provider === 'openrouter' && ' (Recommended — supports all models)'}
            {provider === 'opencode' && ' (6 free models + premium)'}
          </span>
        </div>
      </div>

      {/* API Key Input */}
      <div className="space-y-2">
        <Label className="text-zinc-300 text-xs">API Key</Label>
        <div className="relative">
          <Input
            type={showApiKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => onApiKeyChange(e.target.value)}
            placeholder={PROVIDERS[provider].keyHint || 'sk-...'}
            className="w-full bg-zinc-800/50 border-zinc-700 text-zinc-200 pr-10 h-9 font-mono text-sm focus-visible:border-emerald-500/50 focus-visible:ring-emerald-500/20"
            autoFocus
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 size-7 text-zinc-500 hover:text-zinc-300"
            onClick={() => onShowApiKeyChange(!showApiKey)}
          >
            {showApiKey ? (
              <EyeOff className="size-3.5" />
            ) : (
              <Eye className="size-3.5" />
            )}
          </Button>
        </div>
        {!apiKey && (
          <div className="flex items-center gap-2 rounded-md bg-amber-500/10 border border-amber-500/20 px-2.5 py-1.5">
            <AlertCircle className="size-3 text-amber-400 shrink-0" />
            <span className="text-xs text-amber-300/80">You need an API key to use AI models. See the guide below ↓</span>
          </div>
        )}
        <p className="text-xs text-zinc-600">
          Your {PROVIDERS[provider].name} API key. Used only to call {PROVIDERS[provider].name} directly from the backend.
        </p>
      </div>

      {/* API Key Guide */}
      <ApiKeyGuide provider={provider} />

      {/* Test Connection */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          className="bg-zinc-800/50 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 h-8"
          onClick={onTestConnection}
          disabled={isTesting || !apiKey}
        >
          {isTesting ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              Testing...
            </>
          ) : connectionStatus === 'success' ? (
            <>
              <CheckCircle2 className="size-3.5 text-emerald-400" />
              Connected
            </>
          ) : connectionStatus === 'error' ? (
            <>
              <AlertCircle className="size-3.5 text-red-400" />
              Failed — Retry
            </>
          ) : (
            'Test Connection'
          )}
        </Button>
        {connectionStatus === 'success' && (
          <span className="text-xs text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="size-3" />
            Connected to {PROVIDERS[provider].name}
          </span>
        )}
        {connectionStatus === 'error' && (
          <span className="text-xs text-red-400 flex items-center gap-1">
            <AlertCircle className="size-3" />
            Connection failed
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Step 3: Model Selection ─────────────────────────────────────────────────

interface Step3Props {
  provider: ProviderKey;
  model: string;
  models: DynamicModel[];
  isLoadingModels: boolean;
  temperature: number;
  maxTokens: number;
  onModelChange: (model: string) => void;
  onTemperatureChange: (temp: number) => void;
  onMaxTokensChange: (tokens: number) => void;
  onRefreshModels: () => void;
}

function Step3ModelSelection({
  provider,
  model,
  models,
  isLoadingModels,
  temperature,
  maxTokens,
  onModelChange,
  onTemperatureChange,
  onMaxTokensChange,
  onRefreshModels,
}: Step3Props) {
  const providerInfo = PROVIDERS[provider];

  // Group models for display
  const groupedModels = (provider === 'openrouter' || provider === 'opencode')
    ? (() => {
        const auto = models.filter((m) => m.id === 'openrouter/auto');
        const free = models.filter((m) => m.isFree && m.id !== 'openrouter/auto');
        const paid = models.filter((m) => !m.isFree);
        const groups: { label: string; models: DynamicModel[] }[] = [];
        if (auto.length) groups.push({ label: '⚡ Auto-Routing (Recommended)', models: auto });
        if (free.length) groups.push({ label: `🆓 Free Models (${free.length})`, models: free });
        if (paid.length) groups.push({ label: `💎 Paid Models (${paid.length})`, models: paid });
        return groups;
      })()
    : [{ label: providerInfo.name, models }];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="text-center">
        <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <Sparkles className="size-5 text-emerald-400" />
        </div>
        <h2 className="text-lg font-semibold text-zinc-100">Configure your model</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Fine-tune the AI to your preferences.
        </p>
      </div>

      {/* Provider info badge */}
      <div className="flex items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-800/30 px-3 py-2">
        <span className="text-base">{providerInfo.icon}</span>
        <span className="text-sm font-medium text-zinc-200">{providerInfo.name}</span>
        <CheckCircle2 className="size-3.5 text-emerald-400 ml-1" />
      </div>

      {/* Model Selection */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-zinc-300 text-xs">Model</Label>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 gap-1 px-2 text-xs text-zinc-500 hover:text-zinc-300"
            onClick={onRefreshModels}
            disabled={isLoadingModels}
          >
            <RefreshCw className={`size-3 ${isLoadingModels ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {isLoadingModels ? (
          <div className="flex items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800/30 py-6">
            <Loader2 className="size-4 animate-spin text-emerald-500" />
            <span className="ml-2 text-sm text-zinc-400">Loading models...</span>
          </div>
        ) : (
          <Select value={model} onValueChange={onModelChange}>
            <SelectTrigger className="w-full bg-zinc-800/50 border-zinc-700 text-zinc-200 h-9">
              <SelectValue placeholder="Select model" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-800 border-zinc-800 max-h-60">
              {groupedModels.map((group) => (
                <div key={group.label}>
                  <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    {group.label}
                  </div>
                  {group.models.map((m) => (
                    <SelectItem
                      key={m.id}
                      value={m.id}
                      className="text-zinc-200 focus:bg-zinc-700 focus:text-zinc-100"
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex-1 truncate">{m.name}</span>
                        {m.isFree ? (
                          <span className="flex items-center gap-0.5 shrink-0 rounded bg-emerald-500/15 px-1 py-0.5 text-[9px] font-medium text-emerald-400">
                            <Gift className="size-2" />
                            FREE
                          </span>
                        ) : (
                          <span className="flex items-center gap-0.5 shrink-0 rounded bg-amber-500/15 px-1 py-0.5 text-[9px] font-medium text-amber-400">
                            <CreditCard className="size-2" />
                            PAID
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </div>
              ))}
            </SelectContent>
          </Select>
        )}

        {model && (
          <div className="rounded-md border border-zinc-800 bg-zinc-800/20 px-3 py-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-zinc-400">
                Selected: <span className="text-emerald-400 font-mono">{model}</span>
              </p>
              {(() => {
                const selectedM = models.find(m => m.id === model);
                if (!selectedM) return null;
                return selectedM.isFree ? (
                  <span className="flex items-center gap-1 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400">
                    <Gift className="size-2.5" />
                    FREE
                  </span>
                ) : (
                  <span className="flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold text-amber-400">
                    <CreditCard className="size-2.5" />
                    PAID
                  </span>
                );
              })()}
            </div>
          </div>
        )}
      </div>

      {/* Temperature Slider */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-zinc-300 text-xs">Temperature</Label>
          <span className="text-xs text-emerald-400 font-mono tabular-nums">
            {temperature.toFixed(2)}
          </span>
        </div>
        <Slider
          value={[temperature]}
          min={0}
          max={2}
          step={0.05}
          onValueChange={([v]) => onTemperatureChange(v)}
          className="[&_[data-slot=slider-track]]:bg-zinc-700 [&_[data-slot=slider-range]]:bg-emerald-500 [&_[data-slot=slider-thumb]]:border-emerald-500"
        />
        <div className="flex justify-between text-xs text-zinc-600">
          <span>0 (Precise)</span>
          <span>2 (Creative)</span>
        </div>
      </div>

      {/* Max Tokens Slider */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-zinc-300 text-xs">Max Tokens per Request</Label>
          <span className="text-xs text-emerald-400 font-mono tabular-nums">
            {maxTokens.toLocaleString()}
          </span>
        </div>
        <Slider
          value={[maxTokens]}
          min={256}
          max={128000}
          step={256}
          onValueChange={([v]) => onMaxTokensChange(v)}
          className="[&_[data-slot=slider-track]]:bg-zinc-700 [&_[data-slot=slider-range]]:bg-emerald-500 [&_[data-slot=slider-thumb]]:border-emerald-500"
        />
        <div className="flex justify-between text-xs text-zinc-600">
          <span>256</span>
          <span>128,000</span>
        </div>
      </div>
    </div>
  );
}
