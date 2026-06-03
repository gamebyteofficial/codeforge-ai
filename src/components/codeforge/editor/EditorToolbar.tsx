'use client';

import React from 'react';
import {
  Save,
  Copy,
  Check,
  Pencil,
  Eye,
  Play,
  WrapText,
  Hash,
  List,
  Minus,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { getLanguageFromFileName, getFileTypeColor } from '@/lib/file-icons';
import type { ProjectFile } from '@/store';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const FONT_SIZE_MIN = 10;
export const FONT_SIZE_MAX = 24;
export const FONT_SIZE_DEFAULT = 13;
export const FONT_SIZE_STEP = 1;

// ---------------------------------------------------------------------------
// EditorToolbar
// ---------------------------------------------------------------------------

interface EditorToolbarProps {
  file: ProjectFile;
  isEditing: boolean;
  isSaving: boolean;
  isDirty: boolean;
  onToggleEdit: () => void;
  onSave: () => void;
  onCopy: () => void;
  copied: boolean;
  onPreview: () => void;
  isPreviewable: boolean;
  wordWrap: boolean;
  onToggleWordWrap: () => void;
  fontSize: number;
  onFontSizeChange: (size: number) => void;
  showLineNumbers: boolean;
  onToggleLineNumbers: () => void;
}

export default function EditorToolbar({
  file,
  isEditing,
  isSaving,
  isDirty,
  onToggleEdit,
  onSave,
  onCopy,
  copied,
  onPreview,
  isPreviewable,
  wordWrap,
  onToggleWordWrap,
  fontSize,
  onFontSizeChange,
  showLineNumbers,
  onToggleLineNumbers,
}: EditorToolbarProps) {
  const language = getLanguageFromFileName(file.name);
  const lineCount = file.content.split('\n').length;
  const charCount = file.content.length;
  const dotColor = getFileTypeColor(file.name);

  return (
    <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/60 px-3 py-1">
      {/* Left side actions */}
      <div className="flex items-center gap-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-zinc-400 hover:text-emerald-400 disabled:opacity-40"
              onClick={onSave}
              disabled={isSaving || !isDirty}
            >
              {isSaving ? (
                <span className="size-3.5 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
              ) : (
                <Save className="size-3.5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Save ({navigator.platform?.includes('Mac') ? '⌘' : 'Ctrl'}+S)
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-zinc-400 hover:text-white"
              onClick={onCopy}
            >
              {copied ? (
                <Check className="size-3.5 text-emerald-400" />
              ) : (
                <Copy className="size-3.5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {copied ? 'Copied!' : 'Copy to clipboard'}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={`size-7 ${
                isEditing
                  ? 'text-emerald-400 hover:text-emerald-300'
                  : 'text-zinc-400 hover:text-white'
              }`}
              onClick={onToggleEdit}
            >
              {isEditing ? (
                <Eye className="size-3.5" />
              ) : (
                <Pencil className="size-3.5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {isEditing ? 'View mode' : 'Edit mode'}
          </TooltipContent>
        </Tooltip>

        {/* Preview button - only for HTML/CSS/JS files */}
        {isPreviewable && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-zinc-400 hover:text-emerald-400"
                onClick={onPreview}
              >
                <Play className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Open in Preview ({navigator.platform?.includes('Mac') ? '⌘' : 'Ctrl'}+Shift+P)
            </TooltipContent>
          </Tooltip>
        )}

        <div className="mx-0.5 h-4 w-px bg-zinc-800" />

        {/* Word wrap toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={`size-7 ${
                wordWrap
                  ? 'text-emerald-400 hover:text-emerald-300'
                  : 'text-zinc-400 hover:text-white'
              }`}
              onClick={onToggleWordWrap}
            >
              <WrapText className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {wordWrap ? 'Word wrap: ON' : 'Word wrap: OFF'}
          </TooltipContent>
        </Tooltip>

        {/* Line numbers toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={`size-7 ${
                showLineNumbers
                  ? 'text-emerald-400 hover:text-emerald-300'
                  : 'text-zinc-400 hover:text-white'
              }`}
              onClick={onToggleLineNumbers}
            >
              <List className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {showLineNumbers ? 'Line numbers: ON' : 'Line numbers: OFF'}
          </TooltipContent>
        </Tooltip>

        <div className="mx-0.5 h-4 w-px bg-zinc-800" />

        {/* Font size controls */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-zinc-400 hover:text-white"
              onClick={() => onFontSizeChange(Math.max(FONT_SIZE_MIN, fontSize - FONT_SIZE_STEP))}
              disabled={fontSize <= FONT_SIZE_MIN}
            >
              <Minus className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Decrease font size</TooltipContent>
        </Tooltip>

        <span className="text-[10px] font-mono text-zinc-500 w-6 text-center tabular-nums">
          {fontSize}
        </span>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-zinc-400 hover:text-white"
              onClick={() => onFontSizeChange(Math.min(FONT_SIZE_MAX, fontSize + FONT_SIZE_STEP))}
              disabled={fontSize >= FONT_SIZE_MAX}
            >
              <Plus className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Increase font size</TooltipContent>
        </Tooltip>
      </div>

      {/* Right side info */}
      <div className="flex items-center gap-3 text-[11px] text-zinc-500">
        {isDirty && (
          <span className="flex items-center gap-1 text-amber-400/80">
            <span className="size-1.5 rounded-full bg-amber-400" />
            Unsaved
          </span>
        )}
        <span className="flex items-center gap-1">
          <Hash className="size-3" />
          {lineCount} lines
        </span>
        <span>{charCount.toLocaleString()} chars</span>
        <span className="flex items-center gap-1 rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-zinc-400">
          <span className={`size-1.5 rounded-full ${dotColor}`} />
          {language}
        </span>
      </div>
    </div>
  );
}
