'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Wifi,
  ChevronDown,
  Check,
  RefreshCw,
  Search,
  Loader2,
  Gift,
  CreditCard,
} from 'lucide-react';
import type { DynamicModel } from '@/lib/types';
import { groupModels } from '@/lib/model-utils';
import { useStore } from '@/store/hooks';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

export function ModelSelector({
  selectedModel,
  onModelChange,
}: {
  selectedModel: string;
  onModelChange: (model: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [models, setModels] = useState<DynamicModel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [provider, setProvider] = useState<string>('openrouter');
  const [searchQuery, setSearchQuery] = useState('');
  const settings = useStore(s => s.settings);

  const fetchModels = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/models');
      if (res.ok) {
        const data = await res.json();
        setModels(data.models || []);
        setProvider(data.provider || 'openrouter');
      }
    } catch (err) {
      console.error('Failed to fetch models:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch models when popover opens
  useEffect(() => {
    if (open && models.length === 0) {
      fetchModels();
    }
  }, [open, models.length, fetchModels]);

  // Also refresh when provider changes
  useEffect(() => {
    const configuredProvider = settings.provider || 'openrouter';
    if (configuredProvider !== provider) {
      setModels([]);
    }
  }, [settings.provider, provider]);

  const currentModel = models.find((m) => m.id === selectedModel) || models[0];

  // Filter models by search query
  const filteredModels = useMemo(() => {
    if (!searchQuery.trim()) return models;
    const q = searchQuery.toLowerCase();
    return models.filter(m =>
      m.name.toLowerCase().includes(q) ||
      m.id.toLowerCase().includes(q) ||
      m.provider.toLowerCase().includes(q)
    );
  }, [models, searchQuery]);

  // Group models: Free vs Paid (for OpenRouter/OpenCode Zen), or by provider name
  const groupedModels = groupModels(filteredModels, provider);

  // Show current model free/paid badge
  const isCurrentFree = currentModel?.isFree ?? true;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-1.5 rounded-md border border-zinc-700/60 bg-zinc-800/60 px-2 py-1 text-xs text-zinc-300 transition-colors hover:bg-zinc-700/80 hover:text-zinc-100">
          <Wifi className="size-3 text-emerald-400" />
          <span className="max-w-[120px] truncate">{currentModel?.name || selectedModel}</span>
          {isCurrentFree ? (
            <span className="shrink-0 rounded bg-emerald-500/15 px-1 py-0.5 text-[8px] font-bold text-emerald-400">FREE</span>
          ) : (
            <span className="shrink-0 rounded bg-amber-500/15 px-1 py-0.5 text-[8px] font-bold text-amber-400">PAID</span>
          )}
          <ChevronDown className="size-3 text-zinc-500" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-80 border-zinc-700 bg-zinc-800 p-0 shadow-xl"
      >
        {/* Header with refresh */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-700/50">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            {provider === 'openrouter' ? 'OpenRouter' : provider} Models
          </span>
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-zinc-600">{models.length} available</span>
            <Button
              variant="ghost"
              size="sm"
              className="size-6 p-0 text-zinc-500 hover:text-zinc-300"
              onClick={fetchModels}
              disabled={isLoading}
            >
              <RefreshCw className={`size-3 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Search filter */}
        <div className="px-2 pt-2 pb-1">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search models..."
              className="w-full rounded-md bg-zinc-900/60 border border-zinc-700/50 py-1.5 pl-7 pr-3 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40"
            />
          </div>
        </div>

        <div className="max-h-72 overflow-y-auto custom-scrollbar">
          {isLoading && models.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-4 animate-spin text-zinc-500" />
              <span className="ml-2 text-xs text-zinc-500">Loading models...</span>
            </div>
          ) : filteredModels.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-xs text-zinc-500">
              <Search className="size-4 mb-2" />
              No models found
            </div>
          ) : (
            Object.entries(groupedModels).map(([group, groupModels]) => (
              <div key={group}>
                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                  {group}
                  <span className="text-zinc-600">({groupModels.length})</span>
                </div>
                {groupModels.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => {
                      onModelChange(model.id);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-xs transition-colors ${
                      selectedModel === model.id
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100'
                    }`}
                  >
                    <span className="flex-1 text-left truncate">{model.name}</span>
                    {model.isFree ? (
                      <span className="flex items-center gap-0.5 shrink-0 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-medium text-emerald-400">
                        <Gift className="size-2.5" />
                        FREE
                      </span>
                    ) : (
                      <span className="flex items-center gap-0.5 shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-medium text-amber-400">
                        <CreditCard className="size-2.5" />
                        PAID
                      </span>
                    )}
                    {model.pricing && model.pricing.prompt && model.pricing.prompt !== '0' && (
                      <span className="text-[9px] text-zinc-600 font-mono shrink-0">
                        ${model.pricing.prompt}/M
                      </span>
                    )}
                    {selectedModel === model.id && (
                      <Check className="size-3 shrink-0 text-emerald-400" />
                    )}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>

        {/* Footer hint */}
        {provider === 'openrouter' && !settings.apiKey && (
          <div className="border-t border-zinc-700/50 px-3 py-2">
            <span className="text-[10px] text-amber-400/80 flex items-center gap-1">
              <CreditCard className="size-3" />
              Add an API key in Settings to use paid models
            </span>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
