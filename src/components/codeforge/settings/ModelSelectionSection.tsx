'use client';

import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Loader2,
  RefreshCw,
  CreditCard,
  Gift,
} from 'lucide-react';
import { ProviderKey, PROVIDER_DISPLAY_INFO } from '@/lib/providers';
import type { DynamicModel } from '@/lib/types';
import { groupModelsAsSections } from '@/lib/model-utils';

// ---------------------------------------------------------------------------
// ModelSelectionSection
// ---------------------------------------------------------------------------

interface ModelSelectionSectionProps {
  models: DynamicModel[];
  isLoadingModels: boolean;
  currentModel: string;
  currentProvider1: ProviderKey;
  onModelChange: (model: string) => void;
  onRefreshModels: () => void;
}

export default function ModelSelectionSection({
  models,
  isLoadingModels,
  currentModel,
  currentProvider1,
  onModelChange,
  onRefreshModels,
}: ModelSelectionSectionProps) {
  // Group models for display
  const groupedModels = groupModelsAsSections(
    models,
    currentProvider1,
    PROVIDER_DISPLAY_INFO[currentProvider1 as ProviderKey]?.name || currentProvider1,
  );

  return (
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
        <div className="flex items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800/30 py-4">
          <Loader2 className="size-4 animate-spin text-emerald-500" />
          <span className="ml-2 text-sm text-zinc-400">Loading models...</span>
        </div>
      ) : (
        <Select
          value={currentModel || ''}
          onValueChange={(v) => onModelChange(v)}
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
      {currentModel && (
        <div className="rounded-md border border-zinc-800 bg-zinc-800/20 px-3 py-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-zinc-400">
              Active model: <span className="text-emerald-400 font-mono">{currentModel}</span>
            </p>
            {(() => {
              const activeModel = models.find(m => m.id === currentModel);
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
  );
}
