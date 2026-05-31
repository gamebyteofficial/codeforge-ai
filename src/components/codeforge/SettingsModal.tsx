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
} from 'lucide-react';
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
  keyHint?: string;
}

const PROVIDERS: Record<ProviderKey, ProviderInfo> = {
  openai: {
    name: 'OpenAI',
    models: ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo', 'o1', 'o1-mini'],
    icon: '🟢',
    keyHint: 'sk-... (from platform.openai.com)',
  },
  anthropic: {
    name: 'Anthropic',
    models: ['claude-3.5-sonnet', 'claude-3-opus', 'claude-3-haiku'],
    icon: '🟠',
    keyHint: 'sk-ant-... (from console.anthropic.com)',
  },
  gemini: {
    name: 'Google Gemini',
    models: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    icon: '🔵',
    keyHint: 'AI... (from aistudio.google.com)',
  },
  qwen: {
    name: 'Qwen',
    models: ['qwen-2.5-72b', 'qwen-2.5-coder-32b'],
    icon: '🟣',
    keyHint: 'sk-... (from dashscope.aliyuncs.com)',
  },
  deepseek: {
    name: 'DeepSeek',
    models: ['deepseek-chat', 'deepseek-coder'],
    icon: '🔷',
    keyHint: 'sk-... (from platform.deepseek.com)',
  },
  mistral: {
    name: 'Mistral',
    models: ['mistral-large', 'mistral-medium', 'codestral'],
    icon: '🟡',
    keyHint: '... (from console.mistral.ai)',
  },
  openrouter: {
    name: 'OpenRouter',
    models: [
      'deepseek/deepseek-v4-flash:free',
      'meta-llama/llama-3.3-70b-instruct:free',
      'qwen/qwen3-coder:free',
      'google/gemma-4-31b-it:free',
      'moonshotai/kimi-k2.6:free',
      'openai/gpt-oss-120b:free',
      'openai/gpt-4o',
      'openai/gpt-4o-mini',
      'anthropic/claude-3.5-sonnet',
      'google/gemini-2.0-flash-001',
      'meta-llama/llama-3.1-70b-instruct',
      'deepseek/deepseek-chat',
    ],
    icon: '🌐',
    keyHint: 'sk-or-... (from openrouter.ai)',
  },
};

// ─── Default Settings ────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: Record<string, string> = {
  provider: 'openai',
  apiKey: '',
  model: 'gpt-4o',
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
  const { isSettingsOpen, setIsSettingsOpen, settings, setSettings } = useAppStore();

  const [localSettings, setLocalSettings] = useState<Record<string, string>>({ ...settings });
  const [showApiKey, setShowApiKey] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Load settings from API when dialog opens
  useEffect(() => {
    if (isSettingsOpen) {
      loadSettings();
    }
  }, [isSettingsOpen]);

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        if (data.settings && Object.keys(data.settings).length > 0) {
          setLocalSettings({ ...DEFAULT_SETTINGS, ...data.settings });
          setSettings({ ...DEFAULT_SETTINGS, ...data.settings });
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

  // Update a single setting locally
  const updateSetting = (key: string, value: string) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }));
  };

  // When provider changes, update model to the first model of that provider
  const handleProviderChange = (provider: string) => {
    const providerInfo = PROVIDERS[provider as ProviderKey];
    const firstModel = providerInfo?.models[0] || '';
    setLocalSettings((prev) => ({
      ...prev,
      provider,
      model: firstModel,
    }));
  };

  // Save settings to API
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: localSettings }),
      });
      if (res.ok) {
        setSettings(localSettings);
        toast.success('Settings saved', {
          description: 'Your preferences have been updated successfully.',
        });
        setIsSettingsOpen(false);
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
  };

  // Reset to defaults
  const handleReset = () => {
    setLocalSettings({ ...DEFAULT_SETTINGS });
    setShowApiKey(false);
    setConnectionStatus('idle');
    toast.info('Settings reset', {
      description: 'All settings have been restored to defaults.',
    });
  };

  // Test connection
  const handleTestConnection = async () => {
    setIsTesting(true);
    setConnectionStatus('idle');
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: localSettings,
          testConnection: true,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setConnectionStatus('success');
        toast.success('Connection successful', {
          description: `Connected to ${PROVIDERS[localSettings.provider as ProviderKey]?.name || localSettings.provider}`,
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
  };

  // Cancel — close without saving
  const handleCancel = () => {
    setLocalSettings({ ...settings });
    setShowApiKey(false);
    setConnectionStatus('idle');
    setIsSettingsOpen(false);
  };

  const currentProvider = localSettings.provider || 'openai';
  const currentModels = PROVIDERS[currentProvider as ProviderKey]?.models || [];

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
                  {/* Provider Selector */}
                  <div className="space-y-2">
                    <Label className="text-zinc-300 text-xs">
                      AI Provider
                    </Label>
                    <Select
                      value={currentProvider}
                      onValueChange={handleProviderChange}
                    >
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
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-xs text-zinc-500">
                        Active: {PROVIDERS[currentProvider as ProviderKey]?.name || currentProvider}
                      </span>
                    </div>
                  </div>

                  {/* API Key */}
                  <div className="space-y-2">
                    <Label className="text-zinc-300 text-xs">
                      API Key
                    </Label>
                    <div className="relative">
                      <Input
                        type={showApiKey ? 'text' : 'password'}
                        value={localSettings.apiKey || ''}
                        onChange={(e) => updateSetting('apiKey', e.target.value)}
                        placeholder="sk-..."
                        className="w-full bg-zinc-800/50 border-zinc-700 text-zinc-200 pr-10 h-9 font-mono text-sm"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 size-7 text-zinc-500 hover:text-zinc-300"
                        onClick={() => setShowApiKey(!showApiKey)}
                      >
                        {showApiKey ? (
                          <EyeOff className="size-3.5" />
                        ) : (
                          <Eye className="size-3.5" />
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-zinc-600">
                      Your {PROVIDERS[currentProvider as ProviderKey]?.name || currentProvider} API key. Used to call the provider directly from the backend.
                    </p>
                  </div>

                  {/* Model Selection */}
                  <div className="space-y-2">
                    <Label className="text-zinc-300 text-xs">
                      Model
                    </Label>
                    <Select
                      value={localSettings.model || ''}
                      onValueChange={(v) => updateSetting('model', v)}
                    >
                      <SelectTrigger className="w-full bg-zinc-800/50 border-zinc-700 text-zinc-200 h-9">
                        <SelectValue placeholder="Select model" />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-800 border-zinc-700">
                        {currentModels.map((model) => (
                          <SelectItem
                            key={model}
                            value={model}
                            className="text-zinc-200 focus:bg-zinc-700 focus:text-zinc-100"
                          >
                            {model}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Test Connection */}
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-zinc-800/50 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 h-8"
                      onClick={handleTestConnection}
                      disabled={isTesting || !localSettings.apiKey}
                    >
                      {isTesting ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin" />
                          Testing…
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
                        <>
                          <Wifi className="size-3.5" />
                          Test Connection
                        </>
                      )}
                    </Button>
                    {connectionStatus === 'success' && (
                      <span className="text-xs text-emerald-400 flex items-center gap-1">
                        <Wifi className="size-3" />
                        Connected to {PROVIDERS[currentProvider as ProviderKey]?.name}
                      </span>
                    )}
                    {connectionStatus === 'error' && (
                      <span className="text-xs text-red-400 flex items-center gap-1">
                        <WifiOff className="size-3" />
                        Connection failed
                      </span>
                    )}
                  </div>
                </>
              )}
            </TabsContent>

            {/* ─── General Tab ─────────────────────────────────────────── */}
            <TabsContent value="general" className="mt-0 space-y-5">
              {/* Default Language */}
              <div className="space-y-2">
                <Label className="text-zinc-300 text-xs">
                  Default Language
                </Label>
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
                <Label className="text-zinc-300 text-xs">
                  Default Framework
                </Label>
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
                <Label className="text-zinc-300 text-xs">
                  Theme
                </Label>
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
                <Label className="text-zinc-300 text-xs">
                  Command Approval Mode
                </Label>
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
                <Label className="text-zinc-300 text-xs">
                  Context Window Size
                </Label>
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
