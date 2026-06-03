'use client';

import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Eye,
  EyeOff,
  Wifi,
  WifiOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Zap,
} from 'lucide-react';
import { ProviderKey, ProviderDisplayInfo, PROVIDER_DISPLAY_INFO } from '@/lib/providers';

// ---------------------------------------------------------------------------
// ApiKeyInputSection
// ---------------------------------------------------------------------------

export interface ApiKeyInputSectionProps {
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
}

export default function ApiKeyInputSection({
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
}: ApiKeyInputSectionProps) {
  const providerInfo = PROVIDER_DISPLAY_INFO[provider];

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
            {(Object.entries(PROVIDER_DISPLAY_INFO) as [ProviderKey, ProviderDisplayInfo][])
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
