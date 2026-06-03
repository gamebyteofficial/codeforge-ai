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
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useUIState, useStore } from '@/store/hooks';
import { saveSettings, loadSettingsFromLocal, saveSettingsToLocal, markOnboarded } from '@/lib/localSettings';
import {
  RotateCcw,
  Save,
  X,
  Brain,
  Settings2,
  Sparkles,
  Loader2,
  Zap,
  ArrowRightLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import ApiKeyGuide from './ApiKeyGuide';
import { ProviderKey, PROVIDER_DISPLAY_INFO } from '@/lib/providers';
import type { DynamicModel } from '@/lib/types';

// Extracted components
import ApiKeyInputSection from './settings/ApiKeySection';
import ModelSelectionSection from './settings/ModelSelectionSection';
import { useSettingsConnection } from './settings/useSettingsConnection';

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

  // Connection hooks for each provider
  const conn1 = useSettingsConnection(1, localSettings);
  const conn2 = useSettingsConnection(2, localSettings);
  const conn3 = useSettingsConnection(3, localSettings);
  const conn4 = useSettingsConnection(4, localSettings);

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
    conn1.resetStatus();
  };

  // When secondary provider changes
  const handleProvider2Change = (provider: string) => {
    updateSetting('provider2', provider);
    conn2.resetStatus();
  };

  // When provider 3 changes
  const handleProvider3Change = (provider: string) => {
    updateSetting('provider3', provider);
    conn3.resetStatus();
  };

  // When provider 4 changes
  const handleProvider4Change = (provider: string) => {
    updateSetting('provider4', provider);
    conn4.resetStatus();
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
    const newSettings: Record<string, string> = {
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
    conn1.resetStatus();
    conn2.resetStatus();
    conn3.resetStatus();
    conn4.resetStatus();
    toast.info('Providers swapped', { description: `${PROVIDER_DISPLAY_INFO[currentProvider2].name} is now your primary provider` });
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
    conn1.resetStatus();
    conn2.resetStatus();
    conn3.resetStatus();
    conn4.resetStatus();
    toast.info('Settings reset');
  };

  // Cancel
  const handleCancel = () => {
    setLocalSettings({ ...settings });
    setShowApiKey1(false);
    setShowApiKey2(false);
    setShowApiKey3(false);
    setShowApiKey4(false);
    conn1.resetStatus();
    conn2.resetStatus();
    conn3.resetStatus();
    conn4.resetStatus();
    setIsSettingsOpen(false);
  };

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
                      connectionStatus={conn1.connectionStatus}
                      onTestConnection={conn1.testConnection}
                      isTesting={conn1.isTesting}
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
                      connectionStatus={conn2.connectionStatus}
                      onTestConnection={conn2.testConnection}
                      isTesting={conn2.isTesting}
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
                      connectionStatus={conn3.connectionStatus}
                      onTestConnection={conn3.testConnection}
                      isTesting={conn3.isTesting}
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
                      connectionStatus={conn4.connectionStatus}
                      onTestConnection={conn4.testConnection}
                      isTesting={conn4.isTesting}
                      excludeProviders={[currentProvider1, currentProvider2, currentProvider3]}
                    />
                  </div>

                  {/* API Key Guide */}
                  <ApiKeyGuide provider={currentProvider1} compact />

                  {/* Model Selection */}
                  <ModelSelectionSection
                    models={models}
                    isLoadingModels={isLoadingModels}
                    currentModel={localSettings.model || ''}
                    currentProvider1={currentProvider1}
                    onModelChange={(v) => updateSetting('model', v)}
                    onRefreshModels={fetchModels}
                  />

                  {/* Configured providers summary */}
                  <div className="flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-800/10 px-3 py-2">
                    <div className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[11px] text-zinc-500">
                      Primary: <span className="text-zinc-300">{PROVIDER_DISPLAY_INFO[currentProvider1]?.name}</span>
                      {apiKey1 && <span className="text-emerald-400 ml-1">✓</span>}
                      <span className="mx-2 text-zinc-700">|</span>
                      Secondary: <span className="text-zinc-300">{PROVIDER_DISPLAY_INFO[currentProvider2]?.name}</span>
                      {apiKey2 && <span className="text-emerald-400 ml-1">✓</span>}
                      <span className="mx-2 text-zinc-700">|</span>
                      Provider 3: <span className="text-zinc-300">{PROVIDER_DISPLAY_INFO[currentProvider3]?.name}</span>
                      {apiKey3 && <span className="text-emerald-400 ml-1">✓</span>}
                      <span className="mx-2 text-zinc-700">|</span>
                      Provider 4: <span className="text-zinc-300">{PROVIDER_DISPLAY_INFO[currentProvider4]?.name}</span>
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
