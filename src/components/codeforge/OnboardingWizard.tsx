'use client';

import { useState, useCallback } from 'react';
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
} from 'lucide-react';
import { useAppStore } from '@/store';
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

// ─── Provider / Model Definitions ────────────────────────────────────────────

type ProviderKey =
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'qwen'
  | 'deepseek'
  | 'mistral'
  | 'openrouter';

interface ProviderInfo {
  name: string;
  models: string[];
  icon: string;
}

const PROVIDERS: Record<ProviderKey, ProviderInfo> = {
  openai: {
    name: 'OpenAI',
    models: ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo', 'o1', 'o1-mini'],
    icon: '🟢',
  },
  anthropic: {
    name: 'Anthropic',
    models: ['claude-3.5-sonnet', 'claude-3-opus', 'claude-3-haiku'],
    icon: '🟠',
  },
  gemini: {
    name: 'Gemini',
    models: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    icon: '🔵',
  },
  qwen: {
    name: 'Qwen',
    models: ['qwen-2.5-72b', 'qwen-2.5-coder-32b'],
    icon: '🟣',
  },
  deepseek: {
    name: 'DeepSeek',
    models: ['deepseek-chat', 'deepseek-coder'],
    icon: '🔷',
  },
  mistral: {
    name: 'Mistral',
    models: ['mistral-large', 'mistral-medium', 'codestral'],
    icon: '🟡',
  },
  openrouter: {
    name: 'OpenRouter',
    models: ['auto'],
    icon: '🌐',
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
  const { setSettings, setIsOnboarded } = useAppStore();

  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);

  // Step 2 state
  const [provider, setProvider] = useState<ProviderKey>('openai');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Step 3 state
  const [model, setModel] = useState(PROVIDERS.openai.models[0]);
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
    setModel(PROVIDERS[key].models[0]);
    setConnectionStatus('idle');
  };

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
  }, [provider, apiKey, model, temperature, maxTokens, setSettings, setIsOnboarded]);

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
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-8 shadow-2xl shadow-black/50 backdrop-blur-xl">
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
                  temperature={temperature}
                  maxTokens={maxTokens}
                  onModelChange={setModel}
                  onTemperatureChange={setTemperature}
                  onMaxTokensChange={setMaxTokens}
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
    <div className="space-y-5">
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

      {/* Provider Selector */}
      <div className="space-y-2">
        <Label className="text-zinc-300 text-xs">AI Provider</Label>
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
            onChange={(e) => {
              onApiKeyChange(e.target.value);
              if (connectionStatus !== 'idle') {
                // Reset connection status when key changes
                // This is handled by the parent via connectionStatus reset on provider change
              }
            }}
            placeholder="sk-..."
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
        <p className="text-xs text-zinc-600">
          Your API key is stored securely and never shared.
        </p>
      </div>

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
  temperature: number;
  maxTokens: number;
  onModelChange: (model: string) => void;
  onTemperatureChange: (temp: number) => void;
  onMaxTokensChange: (tokens: number) => void;
}

function Step3ModelSelection({
  provider,
  model,
  temperature,
  maxTokens,
  onModelChange,
  onTemperatureChange,
  onMaxTokensChange,
}: Step3Props) {
  const providerInfo = PROVIDERS[provider];
  const models = providerInfo.models;

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
        <Label className="text-zinc-300 text-xs">Model</Label>
        <Select value={model} onValueChange={onModelChange}>
          <SelectTrigger className="w-full bg-zinc-800/50 border-zinc-700 text-zinc-200 h-9">
            <SelectValue placeholder="Select model" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-800 border-zinc-700">
            {models.map((m) => (
              <SelectItem
                key={m}
                value={m}
                className="text-zinc-200 focus:bg-zinc-700 focus:text-zinc-100"
              >
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
