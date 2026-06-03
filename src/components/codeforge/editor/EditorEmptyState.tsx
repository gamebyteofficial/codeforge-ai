'use client';

import React from 'react';
import { FileCode2 } from 'lucide-react';

export default function EditorEmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-12">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-zinc-800/80 ring-1 ring-zinc-700/50">
        <FileCode2 className="size-8 text-zinc-600" />
      </div>
      <div className="text-center">
        <h3 className="text-base font-medium text-zinc-400">No file selected</h3>
        <p className="mt-1 max-w-xs text-sm text-zinc-600">
          Select a file from the explorer or ask AI to generate code
        </p>
      </div>
    </div>
  );
}
