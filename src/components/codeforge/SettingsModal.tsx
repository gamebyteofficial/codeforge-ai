'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useAppStore } from '@/store';
import { useUIState, useStore } from '@/store/hooks';
import { saveSettings, loadSettingsFromLocal, saveSettingsToLocal, markOnboarded } from '@/lib/localSettings';
import {
  Eye,
  EyeOff,
  Wifi,
  WifiOff,
  RotateCcw,
  Save,
  X,
  Brain,
  Settings2,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  CreditCard,
  Gift,
  Zap,
  ArrowRightLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import ApiKeyGuide from './ApiKeyGuide';

// ─── Provider / Model Definitions ────────────────────────────────────────────

type ProviderKey =
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
  groq: {
    name: 'Groq',
    icon: '⚡',
    keyHint: 'gsk_... (from console.groq.com)',
  },
  together: {
    name: 'Together AI',
    icon: '🤝',
    keyHint: '... (from api.together.xyz)',
  },
};

// ─── Default Settings ────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: Record<string, string> = {
  provider: 'openrouter',
  provider2: 'opencode',
  provider3: 'deepseek',
  provider4: 'gemini',
  apiKey: '',
  model: 'openrouter/auto',
  language: 'typescript',
  framework: 'nextjs',
  autoSave: 'true',
  theme: 'dark',
  commandApproval: 'auto',
  maxTokens: '4096',
  temperature: '0.7',
  contextWindowSize: '8192',
  thinkingMode: 'false',
  streaming: 'true',
};

// ─── API Key Input Sub-component ─────────────────────────────────────────────

function ApiKeyInputSection({
  label,
  provider,
  apiKey,
  onProviderChange,
  onApiKeyChange,
  showApiKey,
  onToggleShowKey,
  connectionStatus,
  onTestConnection,
  isTesting,
  excludeProviders,
}: {
  label: string;
  labelIcon: React.ReactNode;
  provider: ProviderKey;
  apiKey: string;
  onProviderChange: (provider: string) => void;
  onApiKeyChange: (key: string) => void;
  showApiKey: boolean;
  onToggleShowKey: () => void;
  connectionStatus: 'idle' | 'success' | 'error';
  onTestConnection: () => void;
  isTesting: boolean;
  excludeProviders?: string[];
}) {
  const providerInfo = PROVIDERS[provider];

  return (
    <div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-800/20 p-4">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <Zap className="size-3.5 text-emerald-400" />
        <span className="text-xs font-semibold text-zinc-300">{label}</span>
        <span className="text-base">{providerInfo.icon}</span>
        <span className="text-xs text-zinc-400">{providerInfo.name}</span>
        {apiKey && (
          <CheckCircle2 className="ml-auto size-3.5 text-emerald-400" />
        )}
      </div>

      {/* Provider selector */}
      <div className="space-y-1.5">
        <Label className="text-zinc-500 text-[10px] uppercase tracking-wider">Provider</Label>
        <Select value={provider} onValueChange={onProviderChange}>
          <SelectTrigger className="w-full bg-zinc-800/50 border-zinc-700 text-zinc-200 h-8 text-xs">
            <SelectValue placeholder="Select provider" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-800 border-zinc-700">
            {(Object.entries(PROVIDERS) as [ProviderKey, ProviderInfo][])
              .filter(([key]) => !excludeProviders?.includes(key))
              .map(([key, info]) => (
                <SelectItem
                  key={key}
                  value={key}
                  className="text-zinc-200 focus:bg-zinc-700 focus:text-zinc-100 text-xs"
                >
                  <span className="mr-2">{info.icon}</span>
                  {info.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      {/* API Key input */}
      <div className="space-y-1.5">
        <Label className="text-zinc-500 text-[10px] uppercase tracking-wider">API Key</Label>
        <div className="relative">
          <Input
            type={showApiKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => onApiKeyChange(e.target.value)}
            placeholder={providerInfo.keyHint || 'sk-...'}
            className="w-full bg-zinc-800/50 border-zinc-700 text-zinc-200 pr-10 h-8 font-mono text-xs"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-0.5 top-1/2 -translate-y-1/2 size-7 text-zinc-500 hover:text-zinc-300"
            onClick={onToggleShowKey}
          >
            {showApiKey ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
          </Button>
        </div>
        {!apiKey && (
          <div className="flex items-center gap-1.5 rounded bg-amber-500/10 border border-amber-500/15 px-2 py-1">
            <AlertCircle className="size-2.5 text-amber-400 shrink-0" />
            <span className="text-[10px] text-amber-300/80">No key — enter one to use {providerInfo.name}</span>
          </div>
        )}
      </div>

      {/* Test Connection */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="bg-zinc-800/50 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 h-7 text-[11px] gap-1.5"
          onClick={onTestConnection}
          disabled={isTesting || !apiKey}
        >
          {isTesting ? (
            <><Loader2 className="size-3 animate-spin" /> Testing…</>
          ) : connectionStatus === 'success' ? (
            <><CheckCircle2 className="size-3 text-emerald-400" /> Connected</>
          ) : connectionStatus === 'error' ? (
            <><AlertCircle className="size-3 text-red-400" /> Failed — Retry</>
          ) : (
            <><Wifi className="size-3" /> Test Connection</>
          )}
        </Button>
        {connectionStatus === 'success' && (
          <span className="text-[10px] text-emerald-400 flex items-center gap-1">
            <Wifi className="size-2.5" /> Connected to {providerInfo.name}
          </span>
        )}
        {connectionStatus === 'error' && (
          <span className="text-[10px] text-red-400 flex items-center gap-1">
            <WifiOff className="size-2.5" /> Connection failed
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Settings Modal Component ────────────────────────────────────────────────

export default function SettingsModal() {
  const isSettingsOpen = useUIState(s => s.isSettingsOpen);
  const setIsSettingsOpen = useUIState(s => s.setIsSettingsOpen);
  const settings = useStore(s => s.settings);
  const setSettings = useStore(s => s.setSettings);

  const [localSettings, setLocalSettings] = useState<Record<string, string>>({ ...settings });
  const [showApiKey1, setShowApiKey1] = useState(false);
  const [showApiKey2, setShowApiKey2] = useState(false);
  const [showApiKey3, setShowApiKey3] = useState(false);
  const [showApiKey4, setShowApiKey4] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting1, setIsTesting1] = useState(false);
  const [isTesting2, setIsTesting2] = useState(false);
  const [isTesting3, setIsTesting3] = useState(false);
  const [isTesting4, setIsTesting4] = useState(false);
  const [connectionStatus1, setConnectionStatus1] = useState<'idle' | 'success' | 'error'>('idle');
  const [connectionStatus2, setConnectionStatus2] = useState<'idle' | 'success' | 'error'>('idle');
  const [connectionStatus3, setConnectionStatus3] = useState<'idle' | 'success' | 'error'>('idle');
  const [connectionStatus4, setConnectionStatus4] = useState<'idle' | 'success' | 'error'>('idle');

  // Dynamic models state
  const [models, setModels] = useState<DynamicModel[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  // Load settings from API when dialog opens
  useEffect(() => {
    if (isSettingsOpen) {
      loadSettings();
    }
  }, [isSettingsOpen]);

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      // Check localStorage first (works everywhere, including Vercel)
      const localData = loadSettingsFromLocal();
      if (localData && Object.keys(localData).length > 0) {
        const merged = { ...DEFAULT_SETTINGS, ...localData };
        setLocalSettings(merged);
        setSettings(merged);
        setIsLoading(false);
        return;
      }

      // Fall back to API
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        if (data.settings && Object.keys(data.settings).length > 0) {
          const merged = { ...DEFAULT_SETTINGS, ...data.settings };
          setLocalSettings(merged);
          setSettings(merged);
          // Cache to localStorage
          saveSettingsToLocal(merged);
        } else {
          setLocalSettings({ ...DEFAULT_SETTINGS, ...settings });
        }
      } else {
        setLocalSettings({ ...DEFAULT_SETTINGS, ...settings });
      }
    } catch {
      setLocalSettings({ ...DEFAULT_SETTINGS, ...settings });
    } finally {
      setIsLoading(false);
    }
  }, [settings, setSettings]);

  // Fetch models when provider changes or on initial load
  const fetchModels = useCallback(async () => {
    setIsLoadingModels(true);
    try {
      // Save the current provider temporarily so /api/models reads it
      await saveSettings(localSettings);

      // Pass provider as query param for when DB is unavailable
      const res = await fetch(`/api/models?provider=${localSettings.provider || 'openrouter'}`);
      if (res.ok) {
        const data = await res.json();
        setModels(data.models || []);
      }
    } catch (err) {
      console.error('Failed to fetch models:', err);
    } finally {
      setIsLoadingModels(false);
    }
  }, [localSettings]);

  // Fetch models when dialog opens and settings are loaded
  useEffect(() => {
    if (isSettingsOpen && !isLoading && localSettings.provider) {
      fetchModels();
    }
  }, [isSettingsOpen, isLoading, localSettings.provider, fetchModels]);

  // Update a single setting locally
  const updateSetting = (key: string, value: string) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }));
  };

  // Current providers
  const currentProvider1 = (localSettings.provider || 'openrouter') as ProviderKey;
  const currentProvider2 = (localSettings.provider2 || 'opencode') as ProviderKey;
  const currentProvider3 = (localSettings.provider3 || 'deepseek') as ProviderKey;
  const currentProvider4 = (localSettings.provider4 || 'gemini') as ProviderKey;

  // API keys (per-provider or legacy)
  const apiKey1 = localSettings[`${currentProvider1}_apiKey`] || (localSettings.provider === currentProvider1 ? localSettings.apiKey : '');
  const apiKey2 = localSettings[`${currentProvider2}_apiKey`] || '';
  const apiKey3 = localSettings[`${currentProvider3}_apiKey`] || '';
  const apiKey4 = localSettings[`${currentProvider4}_apiKey`] || '';

  // When primary provider changes
  const handleProvider1Change = (provider: string) => {
    const defaultModel = provider === 'openrouter'
      ? 'openrouter/auto'
      : provider === 'opencode'
        ? 'big-pickle'
        : '';
    const newSettings = { ...localSettings, provider, model: defaultModel };
    setLocalSettings(newSettings);
    setConnectionStatus1('idle');
  };

  // When secondary provider changes
  const handleProvider2Change = (provider: string) => {
    updateSetting('provider2', provider);
    setConnectionStatus2('idle');
  };

  // When provider 3 changes
  const handleProvider3Change = (provider: string) => {
    updateSetting('provider3', provider);
    setConnectionStatus3('idle');
  };

  // When provider 4 changes
  const handleProvider4Change = (provider: string) => {
    updateSetting('provider4', provider);
    setConnectionStatus4('idle');
  };

  // When primary API key changes
  const handleApiKey1Change = (key: string) => {
    const perProviderKey = `${currentProvider1}_apiKey`;
    const newSettings = { ...localSettings, [perProviderKey]: key };
    // Also update legacy apiKey for backward compat
    if (localSettings.provider === currentProvider1) {
      newSettings.apiKey = key;
    }
    setLocalSettings(newSettings);
  };

  // When secondary API key changes
  const handleApiKey2Change = (key: string) => {
    const perProviderKey = `${currentProvider2}_apiKey`;
    setLocalSettings((prev) => ({ ...prev, [perProviderKey]: key }));
  };

  // When provider 3 API key changes
  const handleApiKey3Change = (key: string) => {
    const perProviderKey = `${currentProvider3}_apiKey`;
    setLocalSettings((prev) => ({ ...prev, [perProviderKey]: key }));
  };

  // When provider 4 API key changes
  const handleApiKey4Change = (key: string) => {
    const perProviderKey = `${currentProvider4}_apiKey`;
    setLocalSettings((prev) => ({ ...prev, [perProviderKey]: key }));
  };

  // Swap primary ↔ secondary
  const handleSwapProviders = () => {
    const newSettings = {
      ...localSettings,
      provider: currentProvider2,
      provider2: currentProvider1,
    };
    // Update default model for new primary
    if (currentProvider2 === 'openrouter') {
      newSettings.model = 'openrouter/auto';
    } else if (currentProvider2 === 'opencode') {
      newSettings.model = 'big-pickle';
    }
    setLocalSettings(newSettings);
    setConnectionStatus1('idle');
    setConnectionStatus2('idle');
    setConnectionStatus3('idle');
    setConnectionStatus4('idle');
    toast.info('Providers swapped', { description: `${PROVIDERS[currentProvider2].name} is now your primary provider` });
  };

  // Test primary connection
  const handleTestConnection1 = async () => {
    setIsTesting1(true);
    setConnectionStatus1('idle');
    try {
      const key = localSettings[`${currentProvider1}_apiKey`] || localSettings.apiKey;
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: { ...localSettings, provider: currentProvider1, [`${currentProvider1}_apiKey`]: key, apiKey: key },
          testConnection: true,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setConnectionStatus1('success');
        toast.success('Connection successful', { description: `Connected to ${PROVIDERS[currentProvider1].name}` });
      } else {
        setConnectionStatus1('error');
        toast.error('Connection failed', { description: data.error || 'Could not connect.' });
      }
    } catch {
      setConnectionStatus1('error');
      toast.error('Connection failed', { description: 'Network error.' });
    } finally {
      setIsTesting1(false);
    }
  };

  // Test secondary connection
  const handleTestConnection2 = async () => {
    setIsTesting2(true);
    setConnectionStatus2('idle');
    try {
      const key = localSettings[`${currentProvider2}_apiKey`];
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: { provider: currentProvider2, [`${currentProvider2}_apiKey`]: key, apiKey: key },
          testConnection: true,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setConnectionStatus2('success');
        toast.success('Connection successful', { description: `Connected to ${PROVIDERS[currentProvider2].name}` });
      } else {
        setConnectionStatus2('error');
        toast.error('Connection failed', { description: data.error || 'Could not connect.' });
      }
    } catch {
      setConnectionStatus2('error');
      toast.error('Connection failed', { description: 'Network error.' });
    } finally {
      setIsTesting2(false);
    }
  };

  // Test provider 3 connection
  const handleTestConnection3 = async () => {
    setIsTesting3(true);
    setConnectionStatus3('idle');
    try {
      const key = localSettings[`${currentProvider3}_apiKey`];
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: { provider: currentProvider3, [`${currentProvider3}_apiKey`]: key, apiKey: key },
          testConnection: true,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setConnectionStatus3('success');
        toast.success('Connection successful', { description: `Connected to ${PROVIDERS[currentProvider3].name}` });
      } else {
        setConnectionStatus3('error');
        toast.error('Connection failed', { description: data.error || 'Could not connect.' });
      }
    } catch {
      setConnectionStatus3('error');
      toast.error('Connection failed', { description: 'Network error.' });
    } finally {
      setIsTesting3(false);
    }
  };

  // Test provider 4 connection
  const handleTestConnection4 = async () => {
    setIsTesting4(true);
    setConnectionStatus4('idle');
    try {
      const key = localSettings[`${currentProvider4}_apiKey`];
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: { provider: currentProvider4, [`${currentProvider4}_apiKey`]: key, apiKey: key },
          testConnection: true,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setConnectionStatus4('success');
        toast.success('Connection successful', { description: `Connected to ${PROVIDERS[currentProvider4].name}` });
      } else {
        setConnectionStatus4('error');
        toast.error('Connection failed', { description: data.error || 'Could not connect.' });
      }
    } catch {
      setConnectionStatus4('error');
      toast.error('Connection failed', { description: 'Network error.' });
    } finally {
      setIsTesting4(false);
    }
  };

  // Save settings to localStorage and API (best-effort)
  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Filter out undefined/null values
      const cleanSettings: Record<string, string> = {};
      for (const [key, value] of Object.entries(localSettings)) {
        if (value !== undefined && value !== null) {
          cleanSettings[key] = String(value);
        }
      }

      // Save to localStorage first (always works), then try API as best-effort
      const result = await saveSettings(cleanSettings);
      markOnboarded(); // Ensure onboarding state is saved

      setSettings(cleanSettings);
      toast.success('Settings saved', { description: 'Your preferences have been updated.' });
      setIsSettingsOpen(false);
    } catch (err) {
      // Even on error, save to localStorage and close
      saveSettingsToLocal(localSettings);
      markOnboarded();
      setSettings(localSettings);
      toast.success('Settings saved', { description: 'Saved locally (server sync unavailable).' });
      setIsSettingsOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  // Reset to defaults
  const handleReset = () => {
    setLocalSettings({ ...DEFAULT_SETTINGS });
    setShowApiKey1(false);
    setShowApiKey2(false);
    setShowApiKey3(false);
    setShowApiKey4(false);
    setConnectionStatus1('idle');
    setConnectionStatus2('idle');
    setConnectionStatus3('idle');
    setConnectionStatus4('idle');
    toast.info('Settings reset');
  };

  // Cancel
  const handleCancel = () => {
    setLocalSettings({ ...settings });
    setShowApiKey1(false);
    setShowApiKey2(false);
    setShowApiKey3(false);
    setShowApiKey4(false);
    setConnectionStatus1('idle');
    setConnectionStatus2('idle');
    setConnectionStatus3('idle');
    setConnectionStatus4('idle');
    setIsSettingsOpen(false);
  };

  // Group models for display
  const groupedModels = (currentProvider1 === 'openrouter' || currentProvider1 === 'opencode')
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
    : [{ label: PROVIDERS[currentProvider1 as ProviderKey]?.name || currentProvider1, models }];

  return (
    <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
      <DialogContent
        className="sm:max-w-2xl bg-zinc-900 border-zinc-800 text-zinc-100 p-0 gap-0 max-h-[85vh] overflow-hidden"
        showCloseButton={false}
      >
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center size-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <Settings2 className="size-4 text-emerald-400" />
            </div>
            <div>
              <DialogTitle className="text-lg text-zinc-100">Settings</DialogTitle>
              <DialogDescription className="text-sm text-zinc-500">
                Configure your AI providers and application preferences
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Separator className="bg-zinc-800" />

        {/* Tabs */}
        <Tabs defaultValue="ai-providers" className="flex-1 min-h-0 flex flex-col">
          <div className="px-6 pt-4">
            <TabsList className="bg-zinc-800/60 w-full h-9">
              <TabsTrigger
                value="ai-providers"
                className="flex-1 text-xs data-[state=active]:bg-zinc-700 data-[state=active]:text-emerald-400"
              >
                <Brain className="size-3.5 mr-1.5" />
                AI Providers
              </TabsTrigger>
              <TabsTrigger
                value="general"
                className="flex-1 text-xs data-[state=active]:bg-zinc-700 data-[state=active]:text-emerald-400"
              >
                <Settings2 className="size-3.5 mr-1.5" />
                General
              </TabsTrigger>
              <TabsTrigger
                value="advanced"
                className="flex-1 text-xs data-[state=active]:bg-zinc-700 data-[state=active]:text-emerald-400"
              >
                <Sparkles className="size-3.5 mr-1.5" />
                Advanced
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 max-h-[52vh] custom-scrollbar">
            {/* ─── AI Providers Tab ────────────────────────────────────── */}
            <TabsContent value="ai-providers" className="mt-0 space-y-5">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="size-6 animate-spin text-zinc-500" />
                  <span className="ml-2 text-sm text-zinc-500">Loading settings…</span>
                </div>
              ) : (
                <>
                  {/* Two API Key Sections */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-zinc-300 text-xs">API Keys</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 gap-1 px-2 text-[10px] text-zinc-500 hover:text-emerald-400"
                        onClick={handleSwapProviders}
                      >
                        <ArrowRightLeft className="size-3" />
                        Swap Primary ↔ Secondary
                      </Button>
                    </div>

                    {/* Primary Provider */}
                    <ApiKeyInputSection
                      label="Primary Provider (Active)"
                      labelIcon={<Zap className="size-3.5 text-emerald-400" />}
                      provider={currentProvider1}
                      apiKey={apiKey1}
                      onProviderChange={handleProvider1Change}
                      onApiKeyChange={handleApiKey1Change}
                      showApiKey={showApiKey1}
                      onToggleShowKey={() => setShowApiKey1(!showApiKey1)}
                      connectionStatus={connectionStatus1}
                      onTestConnection={handleTestConnection1}
                      isTesting={isTesting1}
                      excludeProviders={[currentProvider2, currentProvider3, currentProvider4]}
                    />

                    {/* Secondary Provider */}
                    <ApiKeyInputSection
                      label="Secondary Provider (Backup)"
                      labelIcon={<Zap className="size-3.5 text-zinc-500" />}
                      provider={currentProvider2}
                      apiKey={apiKey2}
                      onProviderChange={handleProvider2Change}
                      onApiKeyChange={handleApiKey2Change}
                      showApiKey={showApiKey2}
                      onToggleShowKey={() => setShowApiKey2(!showApiKey2)}
                      connectionStatus={connectionStatus2}
                      onTestConnection={handleTestConnection2}
                      isTesting={isTesting2}
                      excludeProviders={[currentProvider1, currentProvider3, currentProvider4]}
                    />

                    {/* Provider 3 */}
                    <ApiKeyInputSection
                      label="Provider 3 (Tertiary)"
                      labelIcon={<Zap className="size-3.5 text-zinc-500" />}
                      provider={currentProvider3}
                      apiKey={apiKey3}
                      onProviderChange={handleProvider3Change}
                      onApiKeyChange={handleApiKey3Change}
                      showApiKey={showApiKey3}
                      onToggleShowKey={() => setShowApiKey3(!showApiKey3)}
                      connectionStatus={connectionStatus3}
                      onTestConnection={handleTestConnection3}
                      isTesting={isTesting3}
                      excludeProviders={[currentProvider1, currentProvider2, currentProvider4]}
                    />

                    {/* Provider 4 */}
                    <ApiKeyInputSection
                      label="Provider 4 (Quaternary)"
                      labelIcon={<Zap className="size-3.5 text-zinc-500" />}
                      provider={currentProvider4}
                      apiKey={apiKey4}
                      onProviderChange={handleProvider4Change}
                      onApiKeyChange={handleApiKey4Change}
                      showApiKey={showApiKey4}
                      onToggleShowKey={() => setShowApiKey4(!showApiKey4)}
                      connectionStatus={connectionStatus4}
                      onTestConnection={handleTestConnection4}
                      isTesting={isTesting4}
                      excludeProviders={[currentProvider1, currentProvider2, currentProvider3]}
                    />
                  </div>

                  {/* API Key Guide */}
                  <ApiKeyGuide provider={currentProvider1} compact />

                  {/* Model Selection - Dynamic */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-zinc-300 text-xs">Model</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 gap-1 px-2 text-xs text-zinc-500 hover:text-zinc-300"
                        onClick={fetchModels}
                        disabled={isLoadingModels}
                      >
                        <RefreshCw className={`size-3 ${isLoadingModels ? 'animate-spin' : ''}`} />
                        Refresh
                      </Button>
                    </div>
                    {isLoadingModels ? (
                      <div className="flex items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800/30 py-4">
                        <Loader2 className="size-4 animate-spin text-emerald-500" />
                        <span className="ml-2 text-sm text-zinc-400">Loading models...</span>
                      </div>
                    ) : (
                      <Select
                        value={localSettings.model || ''}
                        onValueChange={(v) => updateSetting('model', v)}
                      >
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
                                    {m.isFree && (
                                      <span className="shrink-0 rounded bg-emerald-500/15 px-1 py-0.5 text-[9px] font-medium text-emerald-400">
                                        FREE
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
                    {localSettings.model && (
                      <div className="rounded-md border border-zinc-800 bg-zinc-800/20 px-3 py-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-zinc-400">
                            Active model: <span className="text-emerald-400 font-mono">{localSettings.model}</span>
                          </p>
                          {(() => {
                            const activeModel = models.find(m => m.id === localSettings.model);
                            if (!activeModel) return null;
                            return activeModel.isFree ? (
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

                  {/* Configured providers summary */}
                  <div className="flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-800/10 px-3 py-2">
                    <div className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[11px] text-zinc-500">
                      Primary: <span className="text-zinc-300">{PROVIDERS[currentProvider1]?.name}</span>
                      {apiKey1 && <span className="text-emerald-400 ml-1">✓</span>}
                      <span className="mx-2 text-zinc-700">|</span>
                      Secondary: <span className="text-zinc-300">{PROVIDERS[currentProvider2]?.name}</span>
                      {apiKey2 && <span className="text-emerald-400 ml-1">✓</span>}
                      <span className="mx-2 text-zinc-700">|</span>
                      Provider 3: <span className="text-zinc-300">{PROVIDERS[currentProvider3]?.name}</span>
                      {apiKey3 && <span className="text-emerald-400 ml-1">✓</span>}
                      <span className="mx-2 text-zinc-700">|</span>
                      Provider 4: <span className="text-zinc-300">{PROVIDERS[currentProvider4]?.name}</span>
                      {apiKey4 && <span className="text-emerald-400 ml-1">✓</span>}
                    </span>
                  </div>
                </>
              )}
            </TabsContent>

            {/* ─── General Tab ─────────────────────────────────────────── */}
            <TabsContent value="general" className="mt-0 space-y-5">
              {/* Default Language */}
              <div className="space-y-2">
                <Label className="text-zinc-300 text-xs">Default Language</Label>
                <Select
                  value={localSettings.language || 'typescript'}
                  onValueChange={(v) => updateSetting('language', v)}
                >
                  <SelectTrigger className="w-full bg-zinc-800/50 border-zinc-700 text-zinc-200 h-9">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700">
                    <SelectItem value="typescript" className="text-zinc-200 focus:bg-zinc-700 focus:text-zinc-100">TypeScript</SelectItem>
                    <SelectItem value="javascript" className="text-zinc-200 focus:bg-zinc-700 focus:text-zinc-100">JavaScript</SelectItem>
                    <SelectItem value="python" className="text-zinc-200 focus:bg-zinc-700 focus:text-zinc-100">Python</SelectItem>
                    <SelectItem value="rust" className="text-zinc-200 focus:bg-zinc-700 focus:text-zinc-100">Rust</SelectItem>
                    <SelectItem value="go" className="text-zinc-200 focus:bg-zinc-700 focus:text-zinc-100">Go</SelectItem>
                    <SelectItem value="java" className="text-zinc-200 focus:bg-zinc-700 focus:text-zinc-100">Java</SelectItem>
                    <SelectItem value="csharp" className="text-zinc-200 focus:bg-zinc-700 focus:text-zinc-100">C#</SelectItem>
                    <SelectItem value="ruby" className="text-zinc-200 focus:bg-zinc-700 focus:text-zinc-100">Ruby</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Default Framework */}
              <div className="space-y-2">
                <Label className="text-zinc-300 text-xs">Default Framework</Label>
                <Select
                  value={localSettings.framework || 'nextjs'}
                  onValueChange={(v) => updateSetting('framework', v)}
                >
                  <SelectTrigger className="w-full bg-zinc-800/50 border-zinc-700 text-zinc-200 h-9">
                    <SelectValue placeholder="Select framework" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700">
                    <SelectItem value="nextjs" className="text-zinc-200 focus:bg-zinc-700 focus:text-zinc-100">Next.js</SelectItem>
                    <SelectItem value="react" className="text-zinc-200 focus:bg-zinc-700 focus:text-zinc-100">React</SelectItem>
                    <SelectItem value="vue" className="text-zinc-200 focus:bg-zinc-700 focus:text-zinc-100">Vue.js</SelectItem>
                    <SelectItem value="svelte" className="text-zinc-200 focus:bg-zinc-700 focus:text-zinc-100">Svelte</SelectItem>
                    <SelectItem value="express" className="text-zinc-200 focus:bg-zinc-700 focus:text-zinc-100">Express</SelectItem>
                    <SelectItem value="fastapi" className="text-zinc-200 focus:bg-zinc-700 focus:text-zinc-100">FastAPI</SelectItem>
                    <SelectItem value="django" className="text-zinc-200 focus:bg-zinc-700 focus:text-zinc-100">Django</SelectItem>
                    <SelectItem value="none" className="text-zinc-200 focus:bg-zinc-700 focus:text-zinc-100">None / Vanilla</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Auto-save Toggle */}
              <div className="flex items-center justify-between py-1">
                <div className="space-y-0.5">
                  <Label className="text-zinc-300 text-xs">Auto-save</Label>
                  <p className="text-xs text-zinc-600">Automatically save files on change</p>
                </div>
                <Switch
                  checked={localSettings.autoSave === 'true'}
                  onCheckedChange={(checked) =>
                    updateSetting('autoSave', checked ? 'true' : 'false')
                  }
                  className="data-[state=checked]:bg-emerald-500"
                />
              </div>

              <Separator className="bg-zinc-800" />

              {/* Theme Preference */}
              <div className="space-y-2">
                <Label className="text-zinc-300 text-xs">Theme</Label>
                <Select
                  value={localSettings.theme || 'dark'}
                  onValueChange={(v) => updateSetting('theme', v)}
                >
                  <SelectTrigger className="w-full bg-zinc-800/50 border-zinc-700 text-zinc-200 h-9">
                    <SelectValue placeholder="Select theme" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700">
                    <SelectItem value="dark" className="text-zinc-200 focus:bg-zinc-700 focus:text-zinc-100">Dark</SelectItem>
                    <SelectItem value="light" className="text-zinc-200 focus:bg-zinc-700 focus:text-zinc-100">Light</SelectItem>
                    <SelectItem value="system" className="text-zinc-200 focus:bg-zinc-700 focus:text-zinc-100">System</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-zinc-600">Theme changes will apply on next launch</p>
              </div>

              <Separator className="bg-zinc-800" />

              {/* Command Approval Mode */}
              <div className="space-y-2">
                <Label className="text-zinc-300 text-xs">Command Approval Mode</Label>
                <Select
                  value={localSettings.commandApproval || 'auto'}
                  onValueChange={(v) => updateSetting('commandApproval', v)}
                >
                  <SelectTrigger className="w-full bg-zinc-800/50 border-zinc-700 text-zinc-200 h-9">
                    <SelectValue placeholder="Select approval mode" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700">
                    <SelectItem value="auto" className="text-zinc-200 focus:bg-zinc-700 focus:text-zinc-100">
                      Auto — Execute without approval
                    </SelectItem>
                    <SelectItem value="approve" className="text-zinc-200 focus:bg-zinc-700 focus:text-zinc-100">
                      Approve — Require manual approval
                    </SelectItem>
                    <SelectItem value="deny" className="text-zinc-200 focus:bg-zinc-700 focus:text-zinc-100">
                      Deny — Block all commands
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-zinc-600">
                  Controls how AI-generated shell commands are handled
                </p>
              </div>
            </TabsContent>

            {/* ─── Advanced Tab ────────────────────────────────────────── */}
            <TabsContent value="advanced" className="mt-0 space-y-6">
              {/* Max Tokens */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-zinc-300 text-xs">Max Tokens per Request</Label>
                  <span className="text-xs text-emerald-400 font-mono tabular-nums">
                    {Number(localSettings.maxTokens || 4096).toLocaleString()}
                  </span>
                </div>
                <Slider
                  value={[Number(localSettings.maxTokens || 4096)]}
                  min={256}
                  max={128000}
                  step={256}
                  onValueChange={([v]) => updateSetting('maxTokens', String(v))}
                  className="[&_[data-slot=slider-track]]:bg-zinc-700 [&_[data-slot=slider-range]]:bg-emerald-500 [&_[data-slot=slider-thumb]]:border-emerald-500"
                />
                <div className="flex justify-between text-xs text-zinc-600">
                  <span>256</span>
                  <span>128,000</span>
                </div>
              </div>

              {/* Temperature */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-zinc-300 text-xs">Temperature</Label>
                  <span className="text-xs text-emerald-400 font-mono tabular-nums">
                    {Number(localSettings.temperature || 0.7).toFixed(2)}
                  </span>
                </div>
                <Slider
                  value={[Number(localSettings.temperature || 0.7)]}
                  min={0}
                  max={2}
                  step={0.05}
                  onValueChange={([v]) => updateSetting('temperature', String(v))}
                  className="[&_[data-slot=slider-track]]:bg-zinc-700 [&_[data-slot=slider-range]]:bg-emerald-500 [&_[data-slot=slider-thumb]]:border-emerald-500"
                />
                <div className="flex justify-between text-xs text-zinc-600">
                  <span>0 (Precise)</span>
                  <span>2 (Creative)</span>
                </div>
              </div>

              {/* Context Window Size */}
              <div className="space-y-2">
                <Label className="text-zinc-300 text-xs">Context Window Size</Label>
                <Select
                  value={localSettings.contextWindowSize || '8192'}
                  onValueChange={(v) => updateSetting('contextWindowSize', v)}
                >
                  <SelectTrigger className="w-full bg-zinc-800/50 border-zinc-700 text-zinc-200 h-9">
                    <SelectValue placeholder="Select context window" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700">
                    <SelectItem value="4096" className="text-zinc-200 focus:bg-zinc-700 focus:text-zinc-100">4K tokens</SelectItem>
                    <SelectItem value="8192" className="text-zinc-200 focus:bg-zinc-700 focus:text-zinc-100">8K tokens</SelectItem>
                    <SelectItem value="16384" className="text-zinc-200 focus:bg-zinc-700 focus:text-zinc-100">16K tokens</SelectItem>
                    <SelectItem value="32768" className="text-zinc-200 focus:bg-zinc-700 focus:text-zinc-100">32K tokens</SelectItem>
                    <SelectItem value="65536" className="text-zinc-200 focus:bg-zinc-700 focus:text-zinc-100">64K tokens</SelectItem>
                    <SelectItem value="128000" className="text-zinc-200 focus:bg-zinc-700 focus:text-zinc-100">128K tokens</SelectItem>
                    <SelectItem value="200000" className="text-zinc-200 focus:bg-zinc-700 focus:text-zinc-100">200K tokens</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-zinc-600">
                  Larger windows allow more context but cost more tokens
                </p>
              </div>

              <Separator className="bg-zinc-800" />

              {/* Thinking Mode Toggle */}
              <div className="flex items-center justify-between py-1">
                <div className="space-y-0.5">
                  <Label className="text-zinc-300 text-xs">Enable Thinking Mode</Label>
                  <p className="text-xs text-zinc-600">
                    Allow the AI to reason through problems step-by-step
                  </p>
                </div>
                <Switch
                  checked={localSettings.thinkingMode === 'true'}
                  onCheckedChange={(checked) =>
                    updateSetting('thinkingMode', checked ? 'true' : 'false')
                  }
                  className="data-[state=checked]:bg-emerald-500"
                />
              </div>

              {/* Streaming Toggle */}
              <div className="flex items-center justify-between py-1">
                <div className="space-y-0.5">
                  <Label className="text-zinc-300 text-xs">Enable Streaming</Label>
                  <p className="text-xs text-zinc-600">
                    Stream AI responses in real-time instead of waiting for completion
                  </p>
                </div>
                <Switch
                  checked={localSettings.streaming === 'true'}
                  onCheckedChange={(checked) =>
                    updateSetting('streaming', checked ? 'true' : 'false')
                  }
                  className="data-[state=checked]:bg-emerald-500"
                />
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <Separator className="bg-zinc-800" />

        {/* Footer */}
        <DialogFooter className="px-6 py-4 flex-row items-center justify-between sm:justify-between">
          <Button
            variant="ghost"
            size="sm"
            className="text-zinc-500 hover:text-zinc-300 h-8"
            onClick={handleReset}
          >
            <RotateCcw className="size-3.5" />
            Reset to Defaults
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="bg-zinc-800/50 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 h-8"
              onClick={handleCancel}
            >
              <X className="size-3.5" />
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-500 text-white h-8"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Save className="size-3.5" />
                  Save Settings
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
