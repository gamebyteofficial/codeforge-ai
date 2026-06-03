'use client';

import React, { useCallback } from 'react';
import {
  Plus,
  Trash2,
  Sparkles,
  Hash,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useStore, useChatState, useUIState } from '@/store/hooks';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ModelSelector } from './ModelSelector';

export function ChatHeader() {
  const currentConversation = useChatState(s => s.currentConversation);
  const setCurrentConversation = useChatState(s => s.setCurrentConversation);
  const isChatLoading = useChatState(s => s.isChatLoading);
  const selectedModel = useUIState(s => s.selectedModel);
  const setSelectedModel = useUIState(s => s.setSelectedModel);
  const settings = useStore(s => s.settings);
  const setSettings = useStore(s => s.setSettings);

  const totalTokens = currentConversation?.messages.reduce(
    (sum, m) => sum + (m.tokens ?? 0),
    0,
  );

  const handleNewChat = () => {
    setCurrentConversation(null);
  };

  const handleDeleteChat = () => {
    setCurrentConversation(null);
  };

  const handleModelChange = useCallback(async (model: string) => {
    setSelectedModel(model);
    // Also persist to backend settings
    const updatedSettings = { ...settings, model };
    setSettings(updatedSettings);
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: updatedSettings }),
      });
    } catch {
      // Non-critical: model choice is saved in local state
    }
  }, [setSelectedModel, settings, setSettings]);

  // Show connection status (check per-provider key or legacy key)
  const currentProvider = settings.provider || 'openrouter';
  const isConnected = !!(settings[`${currentProvider}_apiKey`] || settings.apiKey);

  return (
    <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/80 px-3 py-2 backdrop-blur-sm">
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-emerald-500/10">
          <Sparkles className="size-4 text-emerald-500" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-medium text-zinc-100 truncate">
            {currentConversation?.title ?? 'New Conversation'}
          </span>
          <div className="flex items-center gap-2">
            {isConnected ? (
              <span className="flex items-center gap-1 text-[11px] text-emerald-400/80">
                <Wifi className="size-3" />
                Connected
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[11px] text-red-400/80">
                <WifiOff className="size-3" />
                No API Key
              </span>
            )}
            {totalTokens !== undefined && totalTokens > 0 && (
              <span className="flex items-center gap-1 text-[11px] text-zinc-500">
                <Hash className="size-3" />
                {totalTokens.toLocaleString()} tokens
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {/* Model Selector */}
        <ModelSelector selectedModel={selectedModel} onModelChange={handleModelChange} />

        <div className="h-4 w-px bg-zinc-800" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-zinc-400 hover:text-white"
              onClick={handleNewChat}
              disabled={isChatLoading}
            >
              <Plus className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">New chat</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-zinc-400 hover:text-red-400"
              onClick={handleDeleteChat}
              disabled={!currentConversation || isChatLoading}
            >
              <Trash2 className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Delete conversation</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
