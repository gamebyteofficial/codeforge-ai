'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo, useDeferredValue, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  Plus,
  Trash2,
  Bot,
  User,
  FileCode2,
  Bug,
  Zap,
  FileSearch,
  BookOpen,
  Cpu,
  Loader2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  FilePlus2,
  FolderCheck,
  FileCheck2,
  Square,
  Activity,
  Eye,
  AlertTriangle,
  Paperclip,
  X,
  Image as ImageIcon,
  FileText,
} from 'lucide-react';
import { useAppStore, type ProjectFile, type FileAttachment } from '@/store';
import { useStore, useChatState, useFileState, useUIState, useProjectState } from '@/store/hooks';
import { parseFilesFromResponse } from '@/lib/file-parser';
import { type AgentType, AGENT_CONFIG } from '@/lib/agents';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// Import extracted components and utilities
import InlinePreview from './chat/InlinePreview';
import CodeBlock from './chat/CodeBlock';
import MarkdownRenderer from './chat/MarkdownRenderer';
import { ModelSelector } from './chat/ModelSelector';
import { ChatHeader } from './chat/ChatHeader';
import { ErrorCard } from './chat/ErrorCard';
import {
  extractPreviewContent,
  previewCache,
  ChatError,
  ERROR_MARKER,
  encodeChatError,
  decodeChatError,
  SUGGESTED_PROMPTS,
  VISIBLE_MESSAGE_LIMIT,
  PREVIEW_THROTTLE_MS,
  LoadingDots,
} from './chat/chat-utils';

// ---------------------------------------------------------------------------
// EmptyState – shown when there are no messages
// ---------------------------------------------------------------------------

function EmptyState({ onPromptClick }: { onPromptClick: (prompt: string) => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-12">
      {/* Branding */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center gap-4"
      >
        <div className="relative flex size-16 items-center justify-center rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-500/20">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-transparent" />
          <Bot className="relative size-8 text-emerald-500" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-semibold text-zinc-100">Waziros AI</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Your intelligent coding companion. Ask me anything.
          </p>
        </div>
      </motion.div>

      {/* Suggested prompts */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        className="grid w-full max-w-lg grid-cols-1 gap-2 sm:grid-cols-2"
      >
        {SUGGESTED_PROMPTS.map((prompt) => (
          <button
            key={prompt.label}
            onClick={() => onPromptClick(prompt.label)}
            className="group relative flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-left text-sm text-zinc-300 transition-all hover:border-emerald-500/30 hover:bg-zinc-800/80 hover:text-zinc-100 overflow-hidden"
          >
            <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-emerald-500/5 to-transparent" />
            <span className="shrink-0 text-zinc-500 transition-colors group-hover:text-emerald-400">
              {prompt.icon}
            </span>
            <span className="line-clamp-2">{prompt.label}</span>
          </button>
        ))}
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FileCreateBar – Shows below AI messages that contain file blocks
// ---------------------------------------------------------------------------

function FileCreateBar({
  content,
  onFilesCreated,
}: {
  content: string;
  onFilesCreated: (files: ProjectFile[]) => void;
}) {
  const [isCreating, setIsCreating] = useState(false);
  const [isCreated, setIsCreated] = useState(false);
  const [createdCount, setCreatedCount] = useState(0);
  const parsedFiles = useMemo(() => parseFilesFromResponse(content), [content]);
  const currentProject = useProjectState(s => s.currentProject);
  const addFile = useFileState(s => s.addFile);
  const setCurrentFile = useFileState(s => s.setCurrentFile);
  const updateFile = useFileState(s => s.updateFile);
  const hasAutoTriggered = useRef(false);

  const handleCreateFiles = useCallback(async () => {
    if (parsedFiles.length === 0) return;
    setIsCreating(true);
    try {
      const res = await fetch('/api/files/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: parsedFiles.map((f) => ({
            name: f.fileName,
            path: f.filePath,
            content: f.content,
            language: f.language,
            isFolder: false,
            projectId: currentProject?.id || undefined,
          })),
        }),
      });

      if (!res.ok) throw new Error('Failed to create files');

      const data = await res.json();
      const createdFiles: ProjectFile[] = (data.files || []).map((f: Record<string, unknown>) => ({
        id: f.id as string,
        name: f.name as string,
        path: f.path as string,
        content: f.content as string,
        language: f.language as string | undefined,
        isFolder: (f.isFolder as boolean) || false,
        projectId: (f.projectId as string) || null,
        createdAt: f.createdAt as string,
        updatedAt: f.updatedAt as string,
      }));

      // Update the store with all created files
      for (const file of createdFiles) {
        const existing = useAppStore.getState().files.find((f) => f.id === file.id);
        if (existing) {
          updateFile(file.id, file);
        } else {
          addFile(file);
        }
      }

      // Open the first file in the editor
      if (createdFiles.length > 0) {
        setCurrentFile(createdFiles[0]);
      }

      // Update preview files if HTML/CSS/JS were created
      const htmlFile = createdFiles.find((f) => {
        const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
        return ['html', 'htm'].includes(ext);
      });
      // Combine multiple CSS files
      const cssFiles = createdFiles.filter((f) => {
        const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
        return ['css', 'scss', 'less'].includes(ext);
      });
      // Combine multiple JS files
      const jsFiles = createdFiles.filter((f) => {
        const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
        return ['js', 'jsx'].includes(ext);
      });

      if (htmlFile || cssFiles.length > 0 || jsFiles.length > 0) {
        const { setPreviewFiles, setIsPreviewOpen } = useAppStore.getState();
        setPreviewFiles({
          html: htmlFile?.content ?? '',
          css: cssFiles.map(f => `/* ${f.name} */\n${f.content}`).join('\n\n'),
          js: jsFiles.map(f => `// ${f.name}\n${f.content}`).join('\n\n'),
        });
        setIsPreviewOpen(true);
      }

      setCreatedCount(data.created + data.updated);
      setIsCreated(true);
      onFilesCreated(createdFiles);

      toast.success(`${data.created + data.updated} file${(data.created + data.updated) !== 1 ? 's' : ''} auto-created`, {
        description: createdFiles.map((f) => f.name).join(', '),
        duration: 4000,
      });
    } catch (error) {
      console.error('Failed to create files:', error);
      toast.error('Failed to auto-create files');
    } finally {
      setIsCreating(false);
    }
  }, [parsedFiles, currentProject, addFile, setCurrentFile, updateFile, onFilesCreated]);

  // Auto-trigger file creation on mount
  useEffect(() => {
    if (!hasAutoTriggered.current && parsedFiles.length > 0) {
      hasAutoTriggered.current = true;
      handleCreateFiles();
    }
  }, [handleCreateFiles, parsedFiles.length]);

  if (parsedFiles.length === 0) return null;

  return (
    <div className="mt-2 rounded-lg border border-zinc-700/50 bg-zinc-800/50 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {isCreated ? (
            <>
              <FileCheck2 className="size-4 shrink-0 text-emerald-400" />
              <span className="text-xs text-emerald-400 font-medium">
                {createdCount} file{createdCount !== 1 ? 's' : ''} auto-created!
              </span>
              <div className="flex gap-1 overflow-hidden">
                {parsedFiles.slice(0, 4).map((f) => (
                  <span
                    key={f.filePath}
                    className="shrink-0 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-mono text-emerald-400"
                  >
                    {f.fileName}
                  </span>
                ))}
                {parsedFiles.length > 4 && (
                  <span className="text-[10px] text-zinc-500">
                    +{parsedFiles.length - 4} more
                  </span>
                )}
              </div>
            </>
          ) : isCreating ? (
            <>
              <Loader2 className="size-4 shrink-0 text-emerald-400 animate-spin" />
              <span className="text-xs text-zinc-300">
                Auto-creating {parsedFiles.length} file{parsedFiles.length !== 1 ? 's' : ''}...
              </span>
              <div className="flex gap-1 overflow-hidden">
                {parsedFiles.slice(0, 4).map((f) => (
                  <span
                    key={f.filePath}
                    className="shrink-0 rounded bg-zinc-700/60 px-1.5 py-0.5 text-[10px] font-mono text-zinc-400"
                  >
                    {f.fileName}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <>
              <FilePlus2 className="size-4 shrink-0 text-amber-400" />
              <span className="text-xs text-zinc-300">
                {parsedFiles.length} file{parsedFiles.length !== 1 ? 's' : ''} detected
              </span>
              <div className="flex gap-1 overflow-hidden">
                {parsedFiles.slice(0, 4).map((f) => (
                  <span
                    key={f.filePath}
                    className="shrink-0 rounded bg-zinc-700/60 px-1.5 py-0.5 text-[10px] font-mono text-zinc-400"
                  >
                    {f.fileName}
                  </span>
                ))}
                {parsedFiles.length > 4 && (
                  <span className="text-[10px] text-zinc-500">
                    +{parsedFiles.length - 4} more
                  </span>
                )}
              </div>
            </>
          )}
        </div>
        {!isCreated && !isCreating && (
          <Button
            size="sm"
            onClick={handleCreateFiles}
            disabled={isCreating}
            className="h-7 gap-1.5 rounded-md bg-emerald-600 px-3 text-xs text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            <FolderCheck className="size-3" />
            Create Files
          </Button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MessageBubble
// ---------------------------------------------------------------------------

const MessageBubble = React.memo(function MessageBubble({
  role,
  content,
  model,
  responseTime,
  attachments,
  onApplyCode,
  onFilesCreated,
  onRetry,
}: {
  role: 'user' | 'assistant' | 'system';
  content: string;
  model?: string;
  responseTime?: number;
  attachments?: FileAttachment[];
  onApplyCode?: (code: string) => void;
  onFilesCreated?: (files: ProjectFile[]) => void;
  onRetry?: (originalMessage: string) => void;
}) {
  const isUser = role === 'user';

  // Check if the content contains error marker(s)
  const errorParts = useMemo(() => {
    const parts: { type: 'text' | 'error'; content: string }[] = [];
    const marker = ERROR_MARKER;
    let remaining = content;
    while (remaining.includes(marker)) {
      const markerIdx = remaining.indexOf(marker);
      // Push any text before the marker
      if (markerIdx > 0) {
        parts.push({ type: 'text', content: remaining.slice(0, markerIdx) });
      }
      // Try to parse the error JSON after the marker
      const afterMarker = remaining.slice(markerIdx + marker.length);
      try {
        // Find the end of the JSON object — it could be followed by more text
        let depth = 0;
        let jsonEnd = -1;
        for (let i = 0; i < afterMarker.length; i++) {
          if (afterMarker[i] === '{') depth++;
          else if (afterMarker[i] === '}') {
            depth--;
            if (depth === 0) { jsonEnd = i + 1; break; }
          }
        }
        if (jsonEnd > 0) {
          const jsonStr = afterMarker.slice(0, jsonEnd);
          const parsed = JSON.parse(jsonStr) as ChatError;
          parts.push({ type: 'error', content: jsonStr });
          remaining = afterMarker.slice(jsonEnd);
        } else {
          // Can't find JSON end — treat rest as error
          parts.push({ type: 'error', content: afterMarker });
          remaining = '';
        }
      } catch {
        // If parsing fails, push the rest as text
        parts.push({ type: 'text', content: remaining });
        remaining = '';
      }
    }
    // Push any remaining text
    if (remaining.trim()) {
      parts.push({ type: 'text', content: remaining });
    }
    // If no markers found at all, return the whole content as text
    if (parts.length === 0) {
      parts.push({ type: 'text', content });
    }
    return parts;
  }, [content]);

  // Check if the entire message is just an error (no text parts)
  const isPureError = errorParts.length === 1 && errorParts[0].type === 'error';

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={`flex gap-3 px-4 py-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
    >
      {/* Avatar */}
      <div
        className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${
          isUser
            ? 'bg-zinc-700 text-zinc-300'
            : isPureError
              ? 'bg-red-500/15 text-red-400'
              : 'bg-emerald-500/15 text-emerald-400'
        }`}
      >
        {isUser ? <User className="size-4" /> : isPureError ? <AlertTriangle className="size-4" /> : <Bot className="size-4" />}
      </div>

      {/* Content */}
      <div
        className={`max-w-[85%] min-w-0 ${
          isUser ? 'items-end' : 'items-start'
        } flex flex-col gap-1`}
      >
        {/* Sender label with model info */}
        <span
          className={`text-[11px] font-medium ${
            isUser ? 'text-zinc-500' : isPureError ? 'text-red-400/80' : 'text-emerald-400/80'
          }`}
        >
          {isUser ? 'You' : isPureError ? 'Waziros AI — Error' : (
            <>
              Waziros AI
              {model && (
                <span className="ml-1.5 text-zinc-600 font-normal">
                  via {model}
                </span>
              )}
            </>
          )}
        </span>

        {/* Message body */}
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
            isUser
              ? 'rounded-tr-sm bg-zinc-700 text-zinc-100'
              : 'rounded-tl-sm bg-zinc-800 text-zinc-300'
          }`}
        >
          {isUser ? (
            <div>
              {attachments && attachments.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {attachments.map((att) => (
                    <div key={att.id} className="group relative overflow-hidden rounded-lg border border-zinc-600/50 bg-zinc-600/30">
                      {att.isImage ? (
                        <div className="relative">
                          <img
                            src={`data:${att.type};base64,${att.content}`}
                            alt={att.name}
                            className="max-h-48 max-w-full rounded-lg object-contain"
                          />
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 px-3 py-2">
                          <FileText className="size-4 text-emerald-400 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-zinc-200 truncate">{att.name}</p>
                            <p className="text-[10px] text-zinc-400">{(att.size / 1024).toFixed(1)} KB</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <p className="whitespace-pre-wrap">{content}</p>
            </div>
          ) : (
            <>
              {errorParts.map((part, idx) =>
                part.type === 'text' ? (
                  <React.Fragment key={idx}>
                    <MarkdownRenderer content={part.content} onApplyCode={onApplyCode} />
                    {/* Inline HTML preview for text parts */}
                    {(() => {
                      const previewContent = extractPreviewContent(part.content);
                      return previewContent && (previewContent.html || previewContent.css || previewContent.js) ? (
                        <InlinePreview html={previewContent.html} css={previewContent.css} js={previewContent.js} />
                      ) : null;
                    })()}
                  </React.Fragment>
                ) : (
                  <ErrorCard
                    key={idx}
                    error={decodeChatError(ERROR_MARKER + part.content) ?? {
                      type: 'unknown',
                      message: part.content,
                      suggestions: [],
                    }}
                    onRetry={onRetry}
                  />
                )
              )}
            </>
          )}
          {/* File auto-creation bar for AI messages */}
          {!isUser && onFilesCreated && !isPureError && (
            <FileCreateBar content={content} onFilesCreated={onFilesCreated} />
          )}
        </div>
        {/* HTML preview available banner — only for non-error messages */}
        {!isUser && !isPureError && extractPreviewContent(content) && (extractPreviewContent(content)!.html || extractPreviewContent(content)!.css || extractPreviewContent(content)!.js) && (
          <button
            onClick={() => {
              const pc = extractPreviewContent(content);
              if (pc) {
                const { setPreviewFiles, setIsPreviewOpen } = useAppStore.getState();
                setPreviewFiles(pc);
                setIsPreviewOpen(true);
              }
            }}
            className="mt-1 flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400 transition-all hover:bg-emerald-500/20 hover:border-emerald-500/50 w-fit"
          >
            <Eye className="size-3" />
            <span>HTML preview available</span>
            <span className="text-emerald-400/60">—</span>
            <span className="underline underline-offset-2">Open Preview Panel</span>
          </button>
        )}
        {/* Response time indicator for AI messages */}
        {!isUser && !isPureError && responseTime !== undefined && responseTime > 0 && (
          <span className="flex items-center gap-1 text-[10px] text-zinc-600">
            <Activity className="size-2.5" />
            Done · {responseTime.toFixed(1)}s
          </span>
        )}
      </div>
    </motion.div>
  );
});

// ---------------------------------------------------------------------------
// StreamingMessage – the streaming message bubble with enhanced UX
// ---------------------------------------------------------------------------

const StreamingMessage = React.memo(function StreamingMessage({
  content,
  model,
  onApplyCode,
  startTime,
}: {
  content: string;
  model: string;
  onApplyCode?: (code: string) => void;
  startTime?: number;
}) {
  // Approximate token count (1 token ≈ 4 chars)
  const tokenCount = useMemo(() => Math.ceil(content.length / 4), [content.length]);

  // Elapsed time counter
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - (startTime ?? Date.now())) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  // Typing speed indicator (WPM)
  const prevContentLengthRef = useRef(0);
  const prevTimestampRef = useRef(Date.now());
  const [wpm, setWpm] = useState(0);
  useEffect(() => {
    const now = Date.now();
    const deltaChars = content.length - prevContentLengthRef.current;
    const deltaMs = now - prevTimestampRef.current;
    if (deltaMs > 0 && deltaChars > 0) {
      // WPM = (chars / 5) / (minutes)
      const minutes = deltaMs / 60000;
      const currentWpm = Math.round((deltaChars / 5) / minutes);
      // Smooth the WPM with a moving average
      setWpm((prev) => prev === 0 ? currentWpm : Math.round(prev * 0.7 + currentWpm * 0.3));
    }
    prevContentLengthRef.current = content.length;
    prevTimestampRef.current = now;
  }, [content]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="flex gap-3 px-4 py-3"
    >
      {/* Avatar with pulse ring */}
      <div className="relative">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
          <Bot className="size-4" />
        </div>
        {/* Animated pulse ring around avatar */}
        <motion.div
          className="absolute inset-0 rounded-lg border border-emerald-400/40"
          animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <div className="flex flex-col gap-1 max-w-[85%] min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-emerald-400/80">
            Waziros AI
            {model && (
              <span className="ml-1.5 text-zinc-600 font-normal">
                via {model}
              </span>
            )}
          </span>
          {/* Streaming status badge with elapsed time & WPM */}
          <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
            <Activity className="size-2.5" />
            Streaming
            <span className="text-emerald-400/60">·</span>
            {elapsed}s
            <span className="text-emerald-400/60">·</span>
            {tokenCount.toLocaleString()} tokens
            {wpm > 0 && (
              <>
                <span className="text-emerald-400/60">·</span>
                {wpm} wpm
              </>
            )}
          </span>
        </div>
        <div className="rounded-2xl rounded-tl-sm bg-zinc-800 px-4 py-2.5 text-sm leading-relaxed text-zinc-300 relative">
          <MarkdownRenderer content={content} onApplyCode={onApplyCode} />
          {/* Blinking cursor */}
          <span className="inline-block w-1.5 h-4 bg-emerald-400 animate-pulse ml-0.5 align-text-bottom" />
          {/* Inline HTML preview */}
          {(() => {
            const previewContent = extractPreviewContent(content);
            return previewContent && (previewContent.html || previewContent.css || previewContent.js) ? (
              <InlinePreview html={previewContent.html} css={previewContent.css} js={previewContent.js} />
            ) : null;
          })()}
        </div>
      </div>
    </motion.div>
  );
});

// ---------------------------------------------------------------------------
// TypingIndicator – shown while waiting for streaming to start
// ---------------------------------------------------------------------------

function TypingIndicator({ modelName }: { modelName: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="flex gap-3 px-4 py-3"
    >
      <div className="relative">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
          <Bot className="size-4" />
        </div>
        <motion.div
          className="absolute inset-0 rounded-lg border border-emerald-400/40"
          animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-medium text-emerald-400/80">
          Waziros AI
          {modelName && (
            <span className="ml-1.5 text-zinc-600 font-normal">
              via {modelName}
            </span>
          )}
        </span>
        <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm bg-zinc-800 px-4 py-3 text-sm text-zinc-400">
          <Loader2 className="size-3.5 animate-spin text-emerald-500" />
          <span>Calling {modelName || 'AI'}...</span>
          <LoadingDots />
        </div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// MessageInput – with Stop button during streaming
// ---------------------------------------------------------------------------

function MessageInput({
  onSend,
  isLoading,
  onStop,
}: {
  onSend: (message: string, attachments?: FileAttachment[]) => void;
  isLoading: boolean;
  onStop: () => void;
}) {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedAgent = useUIState(s => s.selectedAgent);
  const setSelectedAgent = useUIState(s => s.setSelectedAgent);

  // Auto-expand textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  // Supported file types
  const ACCEPTED_TYPES = '.html,.htm,.css,.js,.jsx,.ts,.tsx,.py,.json,.xml,.svg,.md,.txt,.csv,.sql,.yaml,.yml,.toml,.ini,.cfg,.env,.sh,.bash,.zsh,.fish,.ps1,.bat,.rb,.go,.rs,.java,.c,.cpp,.h,.hpp,.cs,.php,.swift,.kt,.dart,.lua,.r,.scala,.clj,.hs,.ex,.exs,.vue,.svelte,.astro,.scss,.less,.sass,.styl,.txt,.log,.conf,.gitignore,.dockerfile,.makefile,.cmake,.gradle,.properties,.proto,.graphql,.prisma,.wasm,.asm,.s,.v,.vhd,.tcl,.m,.mm,.pl,.pm,.t,.patch,.diff,.scss,.editorconfig,.eslintrc,.prettierrc,.babelrc,.tsconfig,.webpack,.rollup,.vite,.next.config,.vercel.json,.netlify.toml,.png,.jpg,.jpeg,.gif,.webp,.bmp,.ico,.svg';

  const processFile = useCallback((file: File): Promise<FileAttachment> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      const isImage = file.type.startsWith('image/');

      if (isImage) {
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve({
            id: crypto.randomUUID(),
            name: file.name,
            type: file.type,
            size: file.size,
            content: base64,
            isImage: true,
          });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      } else {
        reader.onload = () => {
          resolve({
            id: crypto.randomUUID(),
            name: file.name,
            type: file.type || 'text/plain',
            size: file.size,
            content: reader.result as string,
            isImage: false,
          });
        };
        reader.onerror = reject;
        reader.readAsText(file);
      }
    });
  }, []);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const maxSize = 10 * 1024 * 1024; // 10MB per file
    const newAttachments: FileAttachment[] = [];

    for (const file of Array.from(files)) {
      if (file.size > maxSize) {
        toast.error(`File too large: ${file.name}`, { description: 'Maximum file size is 10MB' });
        continue;
      }
      try {
        const att = await processFile(file);
        newAttachments.push(att);
      } catch {
        toast.error(`Failed to read: ${file.name}`);
      }
    }

    if (newAttachments.length > 0) {
      setAttachments(prev => [...prev, ...newAttachments]);
    }

    // Reset file input so the same file can be re-selected
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [processFile]);

  const removeAttachment = useCallback((id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  }, []);

  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault();
    const trimmed = input.trim();
    if ((!trimmed && attachments.length === 0) || isLoading) return;
    onSend(trimmed || 'Please look at the attached file(s).', attachments.length > 0 ? attachments : undefined);
    setInput('');
    setAttachments([]);
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Drag and drop support
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    const maxSize = 10 * 1024 * 1024;
    const newAttachments: FileAttachment[] = [];

    for (const file of Array.from(files)) {
      if (file.size > maxSize) {
        toast.error(`File too large: ${file.name}`, { description: 'Maximum file size is 10MB' });
        continue;
      }
      try {
        const att = await processFile(file);
        newAttachments.push(att);
      } catch {
        toast.error(`Failed to read: ${file.name}`);
      }
    }

    if (newAttachments.length > 0) {
      setAttachments(prev => [...prev, ...newAttachments]);
      toast.success(`Added ${newAttachments.length} file(s)`);
    }
  }, [processFile]);

  return (
    <div
      className={`border-t bg-zinc-900/80 p-3 backdrop-blur-sm transition-colors ${isDragging ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-zinc-800'}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-zinc-900/80 backdrop-blur-sm rounded-lg"
          >
            <div className="flex flex-col items-center gap-2 text-emerald-400">
              <Paperclip className="size-8" />
              <span className="text-sm font-medium">Drop files here</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* File attachments preview */}
      {attachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="group relative flex items-center gap-2 rounded-lg border border-zinc-700/60 bg-zinc-800/80 px-3 py-1.5 pr-8"
            >
              {att.isImage ? (
                <div className="flex items-center gap-2">
                  <ImageIcon className="size-3.5 text-emerald-400 shrink-0" />
                  <div className="flex items-center gap-1.5">
                    {att.content && (
                      <img
                        src={`data:${att.type};base64,${att.content}`}
                        alt={att.name}
                        className="size-8 rounded object-cover"
                      />
                    )}
                    <span className="text-xs text-zinc-300 truncate max-w-[120px]">{att.name}</span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <FileText className="size-3.5 text-emerald-400 shrink-0" />
                  <span className="text-xs text-zinc-300 truncate max-w-[140px]">{att.name}</span>
                </div>
              )}
              <span className="text-[10px] text-zinc-500">{(att.size / 1024).toFixed(1)}KB</span>
              <button
                onClick={() => removeAttachment(att.id)}
                className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-zinc-700 text-zinc-400 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-600 hover:text-white"
              >
                <X className="size-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Agent selector row — horizontal scrollable pills */}
      <div className="mb-2 flex items-center gap-1.5 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {(Object.entries(AGENT_CONFIG) as [AgentType, (typeof AGENT_CONFIG)[AgentType]][]).map(
          ([key, cfg]) => (
            <button
              key={key}
              onClick={() => setSelectedAgent(key)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                selectedAgent === key
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                  : 'border-zinc-700/60 bg-zinc-800/60 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
              }`}
            >
              <span className={selectedAgent === key ? cfg.color : 'text-zinc-500'}>{cfg.icon}</span>
              {cfg.label}
            </button>
          ),
        )}
      </div>

      {/* Input row */}
      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        {/* Attach file button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-9 shrink-0 text-zinc-500 hover:text-emerald-400"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
            >
              <Paperclip className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Attach file</TooltipContent>
        </Tooltip>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED_TYPES}
          onChange={handleFileSelect}
          className="hidden"
        />

        <div className="relative flex-1">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={attachments.length > 0 ? "Add a message about the file(s)..." : "Ask Waziros AI..."}
            disabled={isLoading}
            rows={1}
            className="w-full resize-none rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition-colors focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 disabled:opacity-50"
          />
        </div>

        {/* Stop button appears during streaming, replaces send button */}
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="stop"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    onClick={onStop}
                    className="size-9 shrink-0 rounded-xl bg-red-600 text-white hover:bg-red-500 shadow-lg shadow-red-900/30"
                  >
                    <Square className="size-4 fill-current" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Stop generating</TooltipContent>
              </Tooltip>
            </motion.div>
          ) : (
            <motion.div
              key="send"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="submit"
                    size="icon"
                    disabled={!input.trim() && attachments.length === 0}
                    className="size-9 shrink-0 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40"
                  >
                    <Send className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Send message</TooltipContent>
              </Tooltip>
            </motion.div>
          )}
        </AnimatePresence>
      </form>

      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-[10px] text-zinc-600">
          {attachments.length > 0
            ? `${attachments.length} file(s) attached · Enter to send`
            : 'Enter to send, Shift+Enter for new line'}
        </span>
        {isLoading && (
          <span className="flex items-center gap-1.5 text-[11px] text-emerald-400/80">
            <LoadingDots />
            Streaming from API
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChatPanel (main export)
// ---------------------------------------------------------------------------

export default function ChatPanel() {
  const currentConversation = useChatState(s => s.currentConversation);
  const currentProject = useProjectState(s => s.currentProject);
  const isChatLoading = useChatState(s => s.isChatLoading);
  const setIsChatLoading = useChatState(s => s.setIsChatLoading);
  const addMessageToConversation = useChatState(s => s.addMessageToConversation);
  const setCurrentConversation = useChatState(s => s.setCurrentConversation);
  const setCurrentFile = useFileState(s => s.setCurrentFile);
  const currentFile = useFileState(s => s.currentFile);
  const selectedAgent = useUIState(s => s.selectedAgent);
  const selectedModel = useUIState(s => s.selectedModel);

  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamingContentRef = useRef<string>('');
  const streamingHadErrorRef = useRef<string | null>(null);
  const streamStartRef = useRef<number>(0);
  const [streamingContent, setStreamingContent] = useState<string>('');
  const deferredStreamingContent = useDeferredValue(streamingContent);
  const [streamingModel, setStreamingModel] = useState<string>('');
  const [streamStartTime, setStreamStartTime] = useState<number>(0);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  // Message windowing: track how many earlier messages are "expanded"
  const [visibleMessageLimit, setVisibleMessageLimit] = useState(VISIBLE_MESSAGE_LIMIT);

  // Throttle refs for preview updates
  const lastPreviewUpdateRef = useRef(0);
  const pendingPreviewContentRef = useRef<string>('');
  const pendingPreviewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check scroll position to show/hide scroll buttons
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    // Show scroll-to-top when scrolled down more than 300px
    setShowScrollTop(scrollTop > 300);
    // Show scroll-to-bottom when not at the bottom
    setShowScrollBottom(scrollHeight - scrollTop - clientHeight > 100);
  }, []);

  // Scroll to top
  const scrollToTop = useCallback(() => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Scroll to bottom with smooth animation
  const scrollToBottom = useCallback(() => {
    scrollContainerRef.current?.scrollTo({ top: scrollContainerRef.current?.scrollHeight || 0, behavior: 'smooth' });
  }, []);

  // Auto-scroll to bottom on new messages (only if already near bottom)
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    // Only auto-scroll if user is near the bottom (within 200px)
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 200;
    if (isNearBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [currentConversation?.messages.length, streamingContent, isChatLoading]);

  // Reset visible limit when conversation changes
  useEffect(() => {
    setVisibleMessageLimit(VISIBLE_MESSAGE_LIMIT);
  }, [currentConversation?.id]);

  const handleApplyCode = useCallback(
    (code: string) => {
      if (currentFile) {
        setCurrentFile({ ...currentFile, content: code });
      }
    },
    [currentFile, setCurrentFile],
  );

  const handleFilesCreated = useCallback(
    (files: ProjectFile[]) => {
      // Files are already added to the store by FileCreateBar
      console.log(`[ChatPanel] ${files.length} files created from AI response`);
    },
    [],
  );

  // Stop generating handler
  const handleStop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  // Throttled preview update function
  const throttledPreviewUpdate = useCallback((content: string) => {
    const now = Date.now();
    const previewContent = extractPreviewContent(content);
    // Always update if we have previewable content (HTML detected)
    if (previewContent && (previewContent.html || previewContent.css || previewContent.js)) {
      // Use shorter throttle if we have HTML content (more urgent to show preview)
      const throttleMs = previewContent.html ? PREVIEW_THROTTLE_MS / 2 : PREVIEW_THROTTLE_MS;
      if (now - lastPreviewUpdateRef.current >= throttleMs) {
        lastPreviewUpdateRef.current = now;
        const { setPreviewFiles, setIsPreviewOpen } = useAppStore.getState();
        setPreviewFiles(previewContent);
        setIsPreviewOpen(true);
      } else {
        // Store the latest content and schedule a flush after the throttle window
        pendingPreviewContentRef.current = content;
        if (!pendingPreviewTimerRef.current) {
          pendingPreviewTimerRef.current = setTimeout(() => {
            pendingPreviewTimerRef.current = null;
            if (pendingPreviewContentRef.current) {
              const pendingContent = extractPreviewContent(pendingPreviewContentRef.current);
              if (pendingContent && (pendingContent.html || pendingContent.css || pendingContent.js)) {
                const { setPreviewFiles, setIsPreviewOpen } = useAppStore.getState();
                setPreviewFiles(pendingContent);
                setIsPreviewOpen(true);
              }
              lastPreviewUpdateRef.current = Date.now();
              pendingPreviewContentRef.current = '';
            }
          }, throttleMs);
        }
      }
    }
  }, []);

  // Flush any pending preview update
  const flushPreviewUpdate = useCallback((content: string) => {
    // Clear any pending throttle timer
    if (pendingPreviewTimerRef.current) {
      clearTimeout(pendingPreviewTimerRef.current);
      pendingPreviewTimerRef.current = null;
    }
    const previewContent = extractPreviewContent(content);
    if (previewContent && (previewContent.html || previewContent.css || previewContent.js)) {
      const { setPreviewFiles, setIsPreviewOpen } = useAppStore.getState();
      setPreviewFiles(previewContent);
      setIsPreviewOpen(true);
    }
    lastPreviewUpdateRef.current = Date.now();
    pendingPreviewContentRef.current = '';
  }, []);

  const handleSend = useCallback(
    async (message: string, attachments?: FileAttachment[]) => {
      // Create user message with attachments
      const userMessage = {
        id: crypto.randomUUID(),
        role: 'user' as const,
        content: message,
        attachments,
        createdAt: new Date().toISOString(),
      };

      // Ensure conversation exists
      if (!currentConversation) {
        const newConversation = {
          id: crypto.randomUUID(),
          title: message.slice(0, 50) + (message.length > 50 ? '...' : ''),
          projectId: currentProject?.id ?? null,
          messages: [userMessage],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setCurrentConversation(newConversation);
      } else {
        addMessageToConversation(userMessage);
      }

      // Call API with streaming
      setIsChatLoading(true);
      const startTime = Date.now();
      setStreamStartTime(startTime);
      streamStartRef.current = startTime;
      streamingContentRef.current = '';
      streamingHadErrorRef.current = null;
      setStreamingContent('');
      setStreamingModel('');
      lastPreviewUpdateRef.current = 0;
      pendingPreviewContentRef.current = '';
      if (pendingPreviewTimerRef.current) {
        clearTimeout(pendingPreviewTimerRef.current);
        pendingPreviewTimerRef.current = null;
      }
      // Clear the preview content cache so it re-extracts for new messages
      previewCache.lastInput = '';
      previewCache.lastResult = null;

      try {
        const conversationId = currentConversation?.id ?? userMessage.id;
        const existingMessages = currentConversation?.messages ?? [];
        const history = existingMessages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        // Create abort controller for cancellation
        abortControllerRef.current = new AbortController();

        // Build the user message content with file context
        let enrichedMessage = message;
        if (attachments && attachments.length > 0) {
          const fileContexts: string[] = [];
          for (const att of attachments) {
            if (att.isImage) {
              fileContexts.push(`[Attached Image: ${att.name}]`);
            } else {
              fileContexts.push(`[Attached File: ${att.name}]\n\`\`\`\n${att.content}\n\`\`\``);
            }
          }
          enrichedMessage = fileContexts.join('\n\n') + '\n\n' + message;
        }

        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: enrichedMessage,
            conversationId,
            projectId: currentProject?.id,
            agent: selectedAgent,
            model: selectedModel,
            history,
            stream: true,
            settings: useAppStore.getState().settings,
            attachments: attachments?.map(a => ({
              id: a.id,
              name: a.name,
              type: a.type,
              size: a.size,
              isImage: a.isImage,
            })),
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!res.ok) {
          const statusText = res.statusText || 'Unknown error';
          let apiErrorMsg = `API error: ${res.status}`;
          if (res.status === 401) {
            apiErrorMsg = 'Authentication failed — your API key may be invalid or missing.';
          } else if (res.status === 403) {
            apiErrorMsg = 'Access denied — you may not have permission to use this model.';
          } else if (res.status === 429) {
            apiErrorMsg = 'Rate limit exceeded — too many requests. Please wait and try again.';
          } else if (res.status === 500) {
            apiErrorMsg = `Server error (${res.status}): The AI provider is experiencing issues.`;
          } else if (res.status === 502 || res.status === 503) {
            apiErrorMsg = `Service unavailable (${res.status}): The AI provider is temporarily down.`;
          } else {
            apiErrorMsg = `API error ${res.status}: ${statusText}`;
          }
          throw new Error(apiErrorMsg);
        }

        // Check if the response is a stream
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('text/event-stream') || contentType.includes('text/plain')) {
          // Handle streaming response
          const reader = res.body?.getReader();
          if (!reader) throw new Error('No readable stream');

          const decoder = new TextDecoder();
          let fullContent = '';
          let lastModel = selectedModel;
          // SSE line buffer — prevents losing tokens split across TCP chunks
          let sseBuffer = '';

          // Batch React state updates with requestAnimationFrame to reduce re-renders.
          // Without batching, setStreamingContent fires on every single token (~100/sec),
          // causing a React re-render for each one. With rAF, we render at most once per
          // animation frame (~60/sec), making the UI feel much smoother.
          let pendingRender = false;
          const scheduleRender = () => {
            if (!pendingRender) {
              pendingRender = true;
              requestAnimationFrame(() => {
                setStreamingContent(streamingContentRef.current);
                setStreamingModel(lastModel);
                pendingRender = false;
              });
            }
          };

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            // Append to buffer and split by newlines
            sseBuffer += decoder.decode(value, { stream: true });
            const lines = sseBuffer.split('\n');
            // Keep the last (potentially incomplete) line in the buffer
            sseBuffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || trimmed === 'data: [DONE]') continue;

              if (trimmed.startsWith('data: ')) {
                const data = trimmed.slice(6);
                try {
                  const parsed = JSON.parse(data);
                  if (parsed.error) {
                    fullContent += `\n\n⚠️ Error: ${parsed.error}`;
                    streamingContentRef.current = fullContent;
                    // Track that we saw an API error during streaming
                    streamingHadErrorRef.current = parsed.error;
                    // Flush error content immediately for user feedback
                    setStreamingContent(fullContent);
                  } else if (parsed.content) {
                    fullContent += parsed.content;
                    streamingContentRef.current = fullContent;

                    // Batch the React re-render via rAF instead of calling setStreamingContent on every token
                    scheduleRender();

                    // Throttled preview update during streaming
                    throttledPreviewUpdate(fullContent);
                  }
                  if (parsed.model) {
                    lastModel = parsed.model;
                    // Model update is batched with content in scheduleRender()
                  }
                } catch {
                  // Not valid JSON — ignore (may be partial)
                }
              }
            }
          }

          // Process any remaining data in the buffer
          if (sseBuffer.trim()) {
            const trimmed = sseBuffer.trim();
            if (trimmed.startsWith('data: ') && trimmed !== 'data: [DONE]') {
              try {
                const parsed = JSON.parse(trimmed.slice(6));
                if (parsed.content) {
                  fullContent += parsed.content;
                  streamingContentRef.current = fullContent;
                  scheduleRender();
                }
                if (parsed.model) {
                  lastModel = parsed.model;
                  // Model update is batched with content in scheduleRender()
                }
              } catch {
                // Incomplete JSON — ignore
              }
            }
          }

          // Flush final streaming state to ensure the last frame is rendered
          setStreamingContent(fullContent);
          setStreamingModel(lastModel);

          // Final preview extraction after streaming completes
          flushPreviewUpdate(fullContent);

          // Finalize the streaming message
          const responseTimeSec = ((Date.now() - streamStartRef.current) / 1000);

          // If the stream contained an API error, convert to a structured error message
          const streamError = streamingHadErrorRef.current;
          const finalContent = streamError
            ? encodeChatError({
                type: 'api',
                message: streamError,
                suggestions: [
                  'Check your API key in Settings',
                  'Try a different model from the model selector',
                  'Verify the model is available and not rate-limited',
                ],
                originalMessage: message,
              })
            : (fullContent || 'No response received.');

          const assistantMessage = {
            id: crypto.randomUUID(),
            role: 'assistant' as const,
            content: finalContent,
            tokens: Math.ceil(message.length / 4) + Math.ceil(fullContent.length / 4),
            model: lastModel,
            responseTime: responseTimeSec,
            createdAt: new Date().toISOString(),
          };
          addMessageToConversation(assistantMessage);
        } else {
          // Handle JSON response (non-streaming fallback)
          const data = await res.json();
          const responseContent = data.message ?? data.content ?? 'No response received.';
          const responseTimeSec = ((Date.now() - streamStartRef.current) / 1000);
          const assistantMessage = {
            id: crypto.randomUUID(),
            role: 'assistant' as const,
            content: responseContent,
            tokens: data.tokens,
            model: data.model || selectedModel,
            responseTime: responseTimeSec,
            createdAt: new Date().toISOString(),
          };
          addMessageToConversation(assistantMessage);

          // Also extract preview from non-streaming response
          const previewContent = extractPreviewContent(responseContent);
          if (previewContent && (previewContent.html || previewContent.css || previewContent.js)) {
            const { setPreviewFiles, setIsPreviewOpen } = useAppStore.getState();
            setPreviewFiles(previewContent);
            setIsPreviewOpen(true);
          }
        }
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          // User cancelled — finalize what we have
          if (streamingContentRef.current) {
            const responseTimeSec = ((Date.now() - streamStartRef.current) / 1000);
            const assistantMessage = {
              id: crypto.randomUUID(),
              role: 'assistant' as const,
              content: streamingContentRef.current,
              tokens: Math.ceil(streamingContentRef.current.length / 4),
              model: streamingModel || selectedModel,
              responseTime: responseTimeSec,
              createdAt: new Date().toISOString(),
            };
            addMessageToConversation(assistantMessage);
          }
          toast.info('Request was cancelled.', { duration: 2000 });
        } else {
          const errStr = (error as Error)?.message || String(error);
          const isNetworkError = errStr.includes('network') || errStr.includes('fetch') || errStr.includes('Failed to fetch') || errStr.includes('NetworkError') || errStr.includes('ERR_INTERNET_DISCONNECTED') || errStr.includes('net::');
          const isModelError = errStr.toLowerCase().includes('no endpoints') ||
            errStr.toLowerCase().includes('not available') ||
            errStr.toLowerCase().includes('model not found') ||
            errStr.includes('404');

          // If we already have streaming content, save it with a stream-interrupted error card
          if (streamingContentRef.current && streamingContentRef.current.length > 10) {
            const responseTimeSec = ((Date.now() - streamStartRef.current) / 1000);
            const assistantMessage = {
              id: crypto.randomUUID(),
              role: 'assistant' as const,
              content: streamingContentRef.current +
                '\n\n' +
                encodeChatError({
                  type: 'stream',
                  message: 'The AI stream was interrupted. Partial response is shown above.',
                  suggestions: [
                    'Check your internet connection',
                    'Try a different model from the model selector',
                    'Click Retry to resend your message',
                  ],
                  originalMessage: message,
                }),
              tokens: Math.ceil(streamingContentRef.current.length / 4),
              model: streamingModel || selectedModel,
              responseTime: responseTimeSec,
              createdAt: new Date().toISOString(),
            };
            addMessageToConversation(assistantMessage);

            // Try to extract preview from partial content too
            flushPreviewUpdate(streamingContentRef.current);
          } else {
            // No streaming content — show a dedicated error card
            let chatError: ChatError;

            if (isNetworkError) {
              chatError = {
                type: 'network',
                message: 'Could not reach the server. Check your internet connection.',
                suggestions: [
                  'Verify your internet connection is active',
                  'Check your API key in Settings',
                  'The provider might be temporarily down — try again in a moment',
                  'Try a different model from the model selector',
                ],
                originalMessage: message,
              };
            } else if (isModelError) {
              chatError = {
                type: 'model',
                message: `The model "${selectedModel}" is currently unavailable.`,
                suggestions: [
                  'Try switching to openrouter/auto (auto-routes to the best available model)',
                  'Select a different model from the model selector',
                  'Free models can be temporarily unavailable — try again later',
                ],
                originalMessage: message,
              };
            } else {
              chatError = {
                type: 'unknown',
                message: `Something went wrong: ${errStr}`,
                suggestions: [
                  'Check your API key in Settings',
                  'Try a different model from the model selector',
                  'If the problem persists, try starting a new conversation',
                ],
                originalMessage: message,
              };
            }

            const errorMessage = {
              id: crypto.randomUUID(),
              role: 'assistant' as const,
              content: encodeChatError(chatError),
              createdAt: new Date().toISOString(),
            };
            addMessageToConversation(errorMessage);
          }
          console.error('Chat API error:', error);
        }
      } finally {
        setIsChatLoading(false);
        setStreamingContent('');
        setStreamingModel('');
        streamingContentRef.current = '';
        streamingHadErrorRef.current = null;
        abortControllerRef.current = null;
      }
    },
    [
      currentConversation,
      currentProject,
      setIsChatLoading,
      addMessageToConversation,
      setCurrentConversation,
      selectedAgent,
      selectedModel,
      throttledPreviewUpdate,
      flushPreviewUpdate,
    ],
  );

  const handlePromptClick = useCallback(
    (prompt: string) => {
      handleSend(prompt);
    },
    [handleSend],
  );

  const messages = currentConversation?.messages ?? [];

  // Message windowing: only render a slice of messages
  const hasMoreMessages = messages.length > visibleMessageLimit;
  const visibleMessages = useMemo(() => {
    if (messages.length <= visibleMessageLimit) return messages;
    return messages.slice(messages.length - visibleMessageLimit);
  }, [messages, visibleMessageLimit]);

  // Memoize the rendered message bubbles
  const renderedMessages = useMemo(
    () =>
      visibleMessages.map((msg) => (
        <MessageBubble
          key={msg.id}
          role={msg.role}
          content={msg.content}
          model={msg.model}
          responseTime={msg.responseTime}
          attachments={msg.attachments}
          onApplyCode={msg.role === 'assistant' ? handleApplyCode : undefined}
          onFilesCreated={msg.role === 'assistant' ? handleFilesCreated : undefined}
          onRetry={msg.role === 'assistant' ? handleSend : undefined}
        />
      )),
    [visibleMessages, handleApplyCode, handleFilesCreated, handleSend],
  );

  const isEmpty = messages.length === 0 && !isChatLoading;

  return (
    <div className="flex h-full flex-col bg-zinc-950 text-zinc-100">
      {/* Header */}
      <ChatHeader />

      {/* Messages area */}
      {isEmpty ? (
        <EmptyState onPromptClick={handlePromptClick} />
      ) : (
        <div className="relative flex-1 min-h-0">
          {/* Custom scrollable container */}
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="h-full overflow-y-auto chat-scroll-area"
          >
            <div ref={scrollRef} className="py-2">
              {/* Load earlier messages button */}
              <AnimatePresence>
                {hasMoreMessages && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex justify-center px-4 py-2"
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => setVisibleMessageLimit((prev) => prev + VISIBLE_MESSAGE_LIMIT)}
                          className="flex items-center gap-1.5 rounded-full border border-zinc-700/60 bg-zinc-800/60 px-3 py-1.5 text-xs text-zinc-400 transition-all hover:border-emerald-500/30 hover:bg-zinc-800 hover:text-emerald-400"
                        >
                          <ChevronUp className="size-3.5" />
                          Load earlier messages ({messages.length - visibleMessageLimit} hidden)
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        Show {Math.min(VISIBLE_MESSAGE_LIMIT, messages.length - visibleMessageLimit)} more messages
                      </TooltipContent>
                    </Tooltip>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Historical messages */}
              <AnimatePresence initial={false}>
                {renderedMessages}
              </AnimatePresence>

              {/* Streaming content - show in real-time with enhanced UX */}
              <AnimatePresence>
                {isChatLoading && deferredStreamingContent && (
                  <StreamingMessage
                    content={deferredStreamingContent}
                    model={streamingModel}
                    onApplyCode={handleApplyCode}
                    startTime={streamStartTime}
                  />
                )}
              </AnimatePresence>

              {/* Typing indicator (before streaming starts) */}
              <AnimatePresence>
                {isChatLoading && !streamingContent && (
                  <TypingIndicator modelName={selectedModel} />
                )}
              </AnimatePresence>

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Floating scroll buttons */}
          <AnimatePresence>
            {showScrollTop && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={scrollToTop}
                className="absolute left-1/2 top-2 -translate-x-1/2 flex size-7 items-center justify-center rounded-full border border-zinc-700/60 bg-zinc-800/90 text-zinc-400 shadow-lg backdrop-blur-sm transition-colors hover:text-emerald-400"
              >
                <ChevronUp className="size-4" />
              </motion.button>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {showScrollBottom && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={scrollToBottom}
                className="absolute bottom-2 left-1/2 -translate-x-1/2 flex size-7 items-center justify-center rounded-full border border-zinc-700/60 bg-zinc-800/90 text-zinc-400 shadow-lg backdrop-blur-sm transition-colors hover:text-emerald-400"
              >
                <ChevronDown className="size-4" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Input area */}
      <MessageInput onSend={handleSend} isLoading={isChatLoading} onStop={handleStop} />
    </div>
  );
}
