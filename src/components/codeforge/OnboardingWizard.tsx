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
  ArrowRightLeft,
} from 'lucide-react';
import { useAppStore } from '@/store';
import { useUIState, useStore } from '@/store/hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { saveSettings, markOnboarded, loadSettingsFromLocal, isOnboardedLocal } from '@/lib/localSettings';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import ApiKeyGuide, { QuickProviderCards } from './ApiKeyGuide';
import { ProviderKey, ProviderDisplayInfo, PROVIDER_DISPLAY_INFO } from '@/lib/providers';
import type { DynamicModel } from '@/lib/types';
import { groupModelsAsSections } from '@/lib/model-utils';

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

// Fallback models when API fetch fails
const FALLBACK_MODELS: DynamicModel[] = [
  { id: 'openrouter/auto', name: 'Auto (Best Available)', provider: 'openrouter', isFree: true },
];

// ─── OnboardingWizard Component ──────────────────────────────────────────────

export default function OnboardingWizard() {
  const setSettings = useStore(s => s.setSettings);
  const setIsOnboarded = useStore(s => s.setIsOnboarded);
  const setSelectedModel = useUIState(s => s.setSelectedModel);

  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);

  // Step 1 state - Two API keys
  const [provider1, setProvider1] = useState<ProviderKey>('openrouter');
  const [provider2, setProvider2] = useState<ProviderKey>('opencode');
  const [apiKey1, setApiKey1] = useState('');
  const [apiKey2, setApiKey2] = useState('');
  const [showApiKey1, setShowApiKey1] = useState(false);
  const [showApiKey2, setShowApiKey2] = useState(false);
  const [isTesting1, setIsTesting1] = useState(false);
  const [isTesting2, setIsTesting2] = useState(false);
  const [connectionStatus1, setConnectionStatus1] = useState<'idle' | 'success' | 'error'>('idle');
  const [connectionStatus2, setConnectionStatus2] = useState<'idle' | 'success' | 'error'>('idle');

  // Step 2 state
  const [model, setModel] = useState('openrouter/auto');

  // Ensure model always has a fallback
  const effectiveModel = model || 'openrouter/auto';
  const [models, setModels] = useState<DynamicModel[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(4096);
  const [isSaving, setIsSaving] = useState(false);

  const goToStep = (nextStep: number) => {
    setDirection(nextStep > step ? 1 : -1);
    setStep(nextStep);
  };

  const handleProvider1Change = (newProvider: string) => {
    const key = newProvider as ProviderKey;
    setProvider1(key);
    setConnectionStatus1('idle');
    if (key === 'openrouter') {
      setModel('openrouter/auto');
    } else if (key === 'opencode') {
      setModel('big-pickle');
    } else {
      setModel('');
    }
    setModels([]);
  };

  const handleProvider2Change = (newProvider: string) => {
    setProvider2(newProvider as ProviderKey);
    setConnectionStatus2('idle');
  };

  // Skip onboarding — save minimal settings and proceed
  const handleSkipOnboarding = useCallback(async () => {
    setIsSaving(true);
    try {
      const minimalSettings: Record<string, string> = {
        provider: provider1,
        provider2,
        model: 'openrouter/auto',
        apiKey: 'skipped',
        temperature: '0.7',
        maxTokens: '4096',
      };

      // Save to localStorage first (always works), then try API
      await saveSettings(minimalSettings);
      markOnboarded();

      setSettings(minimalSettings);
      setSelectedModel('openrouter/auto');
      setIsOnboarded(true);
      toast.info('Skipped setup', {
        description: 'You can add API keys later in ⚙️ Settings',
      });
    } catch {
      // Even on error, let the user in with localStorage
      const minimalSettings: Record<string, string> = {
        provider: provider1,
        provider2,
        model: 'openrouter/auto',
        apiKey: 'skipped',
      };
      saveSettings(minimalSettings, true);
      markOnboarded();
      setSettings(minimalSettings);
      setSelectedModel('openrouter/auto');
      setIsOnboarded(true);
      toast.info('Skipped setup', {
        description: 'You can add API keys later in ⚙️ Settings',
      });
    } finally {
      setIsSaving(false);
    }
  }, [provider1, provider2, setSettings, setIsOnboarded, setSelectedModel]);

  // Fetch models when moving to step 2
  const fetchModels = useCallback(async () => {
    setIsLoadingModels(true);
    try {
      // Save settings temporarily so the models API knows the provider
      const perProviderKey = `${provider1}_apiKey`;
      const tempSettings: Record<string, string> = {
        provider: provider1,
        [perProviderKey]: apiKey1,
        apiKey: apiKey1,
      };
      await saveSettings(tempSettings);

      // Pass provider as query param for when DB is unavailable
      const modelsRes = await fetch(`/api/models?provider=${provider1}`);
      if (modelsRes.ok) {
        const data = await modelsRes.json();
        const fetchedModels: DynamicModel[] = data.models || [];
        setModels(fetchedModels);
        if (fetchedModels.length > 0) {
          const defaultModel = fetchedModels.find((m) => m.id === 'openrouter/auto') || fetchedModels[0];
          setModel(defaultModel.id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch models:', err);
      // Set fallback models so the user can still proceed
      setModels(FALLBACK_MODELS);
      setModel('openrouter/auto');
    } finally {
      setIsLoadingModels(false);
      // Always ensure a default model is set even if fetch fails
      setModel((prev) => prev || 'openrouter/auto');
    }
  }, [provider1, apiKey1]);

  // Fetch models when entering step 2
  useEffect(() => {
    if (step === 1) {
      fetchModels();
    }
  }, [step, fetchModels]);

  const handleTestConnection1 = useCallback(async () => {
    setIsTesting1(true);
    setConnectionStatus1('idle');
    try {
      const perProviderKey = `${provider1}_apiKey`;
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: { provider: provider1, [perProviderKey]: apiKey1, apiKey: apiKey1 },
          testConnection: true,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setConnectionStatus1('success');
        toast.success('Connection successful', { description: `Connected to ${PROVIDER_DISPLAY_INFO[provider1].name}` });
      } else {
        setConnectionStatus1('error');
        toast.error('Connection failed', { description: data.error || 'Could not connect.' });
      }
    } catch {
      setConnectionStatus1('error');
      toast.error('Connection failed');
    } finally {
      setIsTesting1(false);
    }
  }, [provider1, apiKey1]);

  const handleTestConnection2 = useCallback(async () => {
    setIsTesting2(true);
    setConnectionStatus2('idle');
    try {
      const perProviderKey = `${provider2}_apiKey`;
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: { provider: provider2, [perProviderKey]: apiKey2, apiKey: apiKey2 },
          testConnection: true,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setConnectionStatus2('success');
        toast.success('Connection successful', { description: `Connected to ${PROVIDER_DISPLAY_INFO[provider2].name}` });
      } else {
        setConnectionStatus2('error');
        toast.error('Connection failed', { description: data.error || 'Could not connect.' });
      }
    } catch {
      setConnectionStatus2('error');
      toast.error('Connection failed');
    } finally {
      setIsTesting2(false);
    }
  }, [provider2, apiKey2]);

  const handleComplete = useCallback(async () => {
    setIsSaving(true);
    try {
      const settings: Record<string, string> = {
        provider: provider1,
        provider2,
        [`${provider1}_apiKey`]: apiKey1,
        [`${provider2}_apiKey`]: apiKey2,
        apiKey: apiKey1, // Legacy compat
        model: effectiveModel,
        temperature: String(temperature),
        maxTokens: String(maxTokens),
      };

      // Filter out empty/null/undefined values to prevent DB errors
      const cleanSettings: Record<string, string> = {};
      for (const [key, value] of Object.entries(settings)) {
        if (value !== undefined && value !== null && value !== '') {
          cleanSettings[key] = String(value);
        }
      }
      // Always ensure these keys exist even if empty
      cleanSettings.provider = provider1;
      cleanSettings.model = effectiveModel;
      if (apiKey1) cleanSettings.apiKey = apiKey1;

      // Save to localStorage first (always works), then try API as best-effort
      const result = await saveSettings(cleanSettings);
      markOnboarded();

      // Always proceed — localStorage is the source of truth
      setSettings(cleanSettings);
      setSelectedModel(effectiveModel);
      setIsOnboarded(true);

      if (result.apiSaved) {
        toast.success('Setup complete!', {
          description: `You're all set with ${PROVIDER_DISPLAY_INFO[provider1].name} — ${effectiveModel}`,
        });
      } else {
        toast.success('Setup complete!', {
          description: `You're all set with ${PROVIDER_DISPLAY_INFO[provider1].name} — ${effectiveModel}`,
        });
      }
    } catch (err) {
      // Even on error, save to localStorage and proceed
      const fallbackSettings: Record<string, string> = {
        provider: provider1,
        provider2,
        model: effectiveModel,
        apiKey: apiKey1,
      };
      saveSettings(fallbackSettings, true);
      markOnboarded();
      setSettings(fallbackSettings);
      setSelectedModel(effectiveModel);
      setIsOnboarded(true);
      toast.success('Setup complete!', {
        description: `You're all set — settings saved locally`,
      });
    } finally {
      setIsSaving(false);
    }
  }, [provider1, provider2, apiKey1, apiKey2, model, temperature, maxTokens, setSettings, setIsOnboarded, setSelectedModel]);

  const canGoNext = step === 0
    ? true
    : step === 1
      ? apiKey1.length > 0 // Only require API key, connection test is optional
      : true;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950">
      {/* Background decorative elements */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/4 top-1/4 size-96 rounded-full bg-emerald-500/5 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 size-96 rounded-full bg-emerald-600/5 blur-3xl" />
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
                <Step2ApiKeys
                  provider1={provider1}
                  provider2={provider2}
                  apiKey1={apiKey1}
                  apiKey2={apiKey2}
                  showApiKey1={showApiKey1}
                  showApiKey2={showApiKey2}
                  isTesting1={isTesting1}
                  isTesting2={isTesting2}
                  connectionStatus1={connectionStatus1}
                  connectionStatus2={connectionStatus2}
                  onProvider1Change={handleProvider1Change}
                  onProvider2Change={handleProvider2Change}
                  onApiKey1Change={setApiKey1}
                  onApiKey2Change={setApiKey2}
                  onShowApiKey1Change={setShowApiKey1}
                  onShowApiKey2Change={setShowApiKey2}
                  onTestConnection1={handleTestConnection1}
                  onTestConnection2={handleTestConnection2}
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
                  provider={provider1}
                  model={effectiveModel}
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
              <div className="flex items-center gap-2">
                {step === 1 && !apiKey1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSkipOnboarding}
                    className="text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 text-xs"
                  >
                    Skip for now
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={() => goToStep(step + 1)}
                  disabled={!canGoNext}
                  className="bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {step === 0 ? 'Get Started' : 'Next'}
                  <ArrowRight className="ml-1 size-4" />
                </Button>
              </div>
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
            Waziros AI
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
        Welcome to <span className="text-emerald-400">Waziros AI</span>
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mb-8 text-sm text-zinc-400"
      >
        Your intelligent coding companion. Set up two AI providers to get started with flexibility.
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

// ─── Step 2: Two API Key Inputs ──────────────────────────────────────────────

interface Step2Props {
  provider1: ProviderKey;
  provider2: ProviderKey;
  apiKey1: string;
  apiKey2: string;
  showApiKey1: boolean;
  showApiKey2: boolean;
  isTesting1: boolean;
  isTesting2: boolean;
  connectionStatus1: 'idle' | 'success' | 'error';
  connectionStatus2: 'idle' | 'success' | 'error';
  onProvider1Change: (provider: string) => void;
  onProvider2Change: (provider: string) => void;
  onApiKey1Change: (key: string) => void;
  onApiKey2Change: (key: string) => void;
  onShowApiKey1Change: (show: boolean) => void;
  onShowApiKey2Change: (show: boolean) => void;
  onTestConnection1: () => void;
  onTestConnection2: () => void;
}

function Step2ApiKeys({
  provider1,
  provider2,
  apiKey1,
  apiKey2,
  showApiKey1,
  showApiKey2,
  isTesting1,
  isTesting2,
  connectionStatus1,
  connectionStatus2,
  onProvider1Change,
  onProvider2Change,
  onApiKey1Change,
  onApiKey2Change,
  onShowApiKey1Change,
  onShowApiKey2Change,
  onTestConnection1,
  onTestConnection2,
}: Step2Props) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="text-center">
        <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <Zap className="size-5 text-emerald-400" />
        </div>
        <h2 className="text-lg font-semibold text-zinc-100">Connect your AI Providers</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Set up a primary and secondary provider for maximum flexibility.
        </p>
      </div>

      {/* Primary Provider Section */}
      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="size-2 rounded-full bg-emerald-500" />
          <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Primary Provider (Active)</span>
          <span className="text-base">{PROVIDER_DISPLAY_INFO[provider1].icon}</span>
        </div>
        <Select value={provider1} onValueChange={onProvider1Change}>
          <SelectTrigger className="w-full bg-zinc-800/50 border-zinc-700 text-zinc-200 h-9">
            <SelectValue placeholder="Select provider" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-800 border-zinc-700">
            {(Object.entries(PROVIDER_DISPLAY_INFO) as [ProviderKey, ProviderDisplayInfo][])
              .filter(([key]) => key !== provider2)
              .map(([key, info]) => (
                <SelectItem key={key} value={key} className="text-zinc-200 focus:bg-zinc-700 focus:text-zinc-100">
                  <span className="mr-2">{info.icon}</span>
                  {info.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <div className="relative">
          <Input
            type={showApiKey1 ? 'text' : 'password'}
            value={apiKey1}
            onChange={(e) => onApiKey1Change(e.target.value)}
            placeholder={PROVIDER_DISPLAY_INFO[provider1].keyHint || 'sk-...'}
            className="w-full bg-zinc-800/50 border-zinc-700 text-zinc-200 pr-10 h-9 font-mono text-sm focus-visible:border-emerald-500/50"
            autoFocus
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 size-7 text-zinc-500 hover:text-zinc-300"
            onClick={() => onShowApiKey1Change(!showApiKey1)}
          >
            {showApiKey1 ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          </Button>
        </div>
        {apiKey1 && connectionStatus1 !== 'success' && (
          <Button
            variant="outline"
            size="sm"
            className="w-full bg-zinc-800/50 border-zinc-700 text-zinc-300 hover:bg-zinc-700 h-8 text-xs"
            onClick={onTestConnection1}
            disabled={isTesting1}
          >
            {isTesting1 ? <><Loader2 className="mr-1 size-3 animate-spin" /> Testing...</> : 'Test Connection'}
          </Button>
        )}
        {connectionStatus1 === 'success' && (
          <span className="flex items-center gap-1 text-xs text-emerald-400">
            <CheckCircle2 className="size-3" /> Connected to {PROVIDER_DISPLAY_INFO[provider1].name}
          </span>
        )}
        {connectionStatus1 === 'error' && (
          <span className="flex items-center gap-1 text-xs text-red-400">
            <AlertCircle className="size-3" /> Connection failed
          </span>
        )}
      </div>

      {/* Secondary Provider Section */}
      <div className="rounded-lg border border-zinc-700 bg-zinc-800/20 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="size-2 rounded-full bg-zinc-500" />
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Secondary Provider (Backup)</span>
          <span className="text-base">{PROVIDER_DISPLAY_INFO[provider2].icon}</span>
          <span className="ml-auto text-[9px] text-zinc-600">Optional</span>
        </div>
        <Select value={provider2} onValueChange={onProvider2Change}>
          <SelectTrigger className="w-full bg-zinc-800/50 border-zinc-700 text-zinc-200 h-9">
            <SelectValue placeholder="Select provider" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-800 border-zinc-700">
            {(Object.entries(PROVIDER_DISPLAY_INFO) as [ProviderKey, ProviderDisplayInfo][])
              .filter(([key]) => key !== provider1)
              .map(([key, info]) => (
                <SelectItem key={key} value={key} className="text-zinc-200 focus:bg-zinc-700 focus:text-zinc-100">
                  <span className="mr-2">{info.icon}</span>
                  {info.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <div className="relative">
          <Input
            type={showApiKey2 ? 'text' : 'password'}
            value={apiKey2}
            onChange={(e) => onApiKey2Change(e.target.value)}
            placeholder={PROVIDER_DISPLAY_INFO[provider2].keyHint || 'sk-...'}
            className="w-full bg-zinc-800/50 border-zinc-700 text-zinc-200 pr-10 h-9 font-mono text-sm focus-visible:border-emerald-500/50"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 size-7 text-zinc-500 hover:text-zinc-300"
            onClick={() => onShowApiKey2Change(!showApiKey2)}
          >
            {showApiKey2 ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          </Button>
        </div>
        {apiKey2 && connectionStatus2 !== 'success' && (
          <Button
            variant="outline"
            size="sm"
            className="w-full bg-zinc-800/50 border-zinc-700 text-zinc-300 hover:bg-zinc-700 h-8 text-xs"
            onClick={onTestConnection2}
            disabled={isTesting2}
          >
            {isTesting2 ? <><Loader2 className="mr-1 size-3 animate-spin" /> Testing...</> : 'Test Connection'}
          </Button>
        )}
        {connectionStatus2 === 'success' && (
          <span className="flex items-center gap-1 text-xs text-emerald-400">
            <CheckCircle2 className="size-3" /> Connected to {PROVIDER_DISPLAY_INFO[provider2].name}
          </span>
        )}
        {connectionStatus2 === 'error' && (
          <span className="flex items-center gap-1 text-xs text-red-400">
            <AlertCircle className="size-3" /> Connection failed
          </span>
        )}
      </div>

      {/* API Key Guide for primary */}
      <ApiKeyGuide provider={provider1} compact />
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
  const providerInfo = PROVIDER_DISPLAY_INFO[provider];

  // Group models for display
  const groupedModels = groupModelsAsSections(
    models,
    provider,
    providerInfo.name,
  );

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
