'use client';

import React, { useState, useCallback } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { type ChatError } from './chat-utils';

export function ErrorCard({
  error,
  onRetry,
}: {
  error: ChatError;
  onRetry?: (originalMessage: string) => void;
}) {
  const [retrying, setRetrying] = useState(false);

  const handleRetry = useCallback(() => {
    if (error.originalMessage && onRetry) {
      setRetrying(true);
      onRetry(error.originalMessage);
      // Reset retrying state after a brief delay in case the send doesn't trigger re-render
      setTimeout(() => setRetrying(false), 2000);
    }
  }, [error.originalMessage, onRetry]);

  const iconColor: Record<ChatError['type'], string> = {
    network: 'text-red-400',
    api: 'text-amber-400',
    abort: 'text-zinc-400',
    model: 'text-orange-400',
    stream: 'text-red-400',
    unknown: 'text-red-400',
  };

  const typeLabel: Record<ChatError['type'], string> = {
    network: 'Network Error',
    api: 'API Error',
    abort: 'Request Cancelled',
    model: 'Model Unavailable',
    stream: 'Stream Interrupted',
    unknown: 'Error',
  };

  return (
    <div className="my-2 overflow-hidden rounded-xl border border-red-500/20 bg-red-500/5">
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-red-500/10 bg-red-500/10 px-4 py-2.5">
        <div className={`flex size-7 shrink-0 items-center justify-center rounded-lg bg-red-500/15 ${iconColor[error.type]}`}>
          <AlertTriangle className="size-4" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-xs font-semibold text-red-300">{typeLabel[error.type]}</span>
          <span className="text-[11px] text-red-400/70 line-clamp-1">{error.message}</span>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-3">
        {/* Error message */}
        <p className="text-sm leading-relaxed text-zinc-300">{error.message}</p>

        {/* Suggestions */}
        {error.suggestions.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Suggested Actions</span>
            <ul className="space-y-1">
              {error.suggestions.map((suggestion, idx) => (
                <li key={idx} className="flex items-start gap-2 text-xs text-zinc-400">
                  <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-amber-400/60" />
                  {suggestion}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Retry button */}
        {error.originalMessage && onRetry && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-red-500/20 bg-red-500/5 text-red-300 hover:bg-red-500/15 hover:text-red-200 hover:border-red-500/30"
            onClick={handleRetry}
            disabled={retrying}
          >
            <RotateCcw className={`size-3.5 ${retrying ? 'animate-spin' : ''}`} />
            {retrying ? 'Retrying...' : 'Retry'}
          </Button>
        )}
      </div>
    </div>
  );
}
