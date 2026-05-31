'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
  Save,
  Copy,
  Check,
  Pencil,
  Eye,
  FileCode2,
  X,
  FileJson,
  FileText,
  FileType,
  Braces,
  Hash,
  Terminal,
  Palette,
  Layout,
  Database,
  Settings,
  Code2,
} from 'lucide-react';
import { useAppStore, type ProjectFile } from '@/store';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from '@/hooks/use-toast';

// ---------------------------------------------------------------------------
// Language utilities
// ---------------------------------------------------------------------------

/** Map file extensions to react-syntax-highlighter language names */
function getLanguageFromFileName(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'tsx',
    js: 'javascript',
    jsx: 'jsx',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    java: 'java',
    cpp: 'cpp',
    c: 'c',
    cs: 'csharp',
    php: 'php',
    swift: 'swift',
    kt: 'kotlin',
    sql: 'sql',
    html: 'markup',
    htm: 'markup',
    xml: 'markup',
    svg: 'markup',
    css: 'css',
    scss: 'scss',
    less: 'less',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    toml: 'toml',
    md: 'markdown',
    sh: 'bash',
    bash: 'bash',
    zsh: 'bash',
    dockerfile: 'docker',
    graphql: 'graphql',
    gql: 'graphql',
    prisma: 'prisma',
    dart: 'dart',
    lua: 'lua',
    r: 'r',
    scala: 'scala',
    vue: 'markup',
    svelte: 'markup',
  };
  return map[ext] ?? (ext || 'text');
}

/** Pick an icon component for a given file name */
function getFileIcon(fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  switch (ext) {
    case 'json':
      return <FileJson className="size-3.5 text-amber-400" />;
    case 'ts':
    case 'tsx':
      return <Braces className="size-3.5 text-blue-400" />;
    case 'js':
    case 'jsx':
      return <Braces className="size-3.5 text-yellow-400" />;
    case 'css':
    case 'scss':
    case 'less':
      return <Palette className="size-3.5 text-pink-400" />;
    case 'html':
    case 'htm':
    case 'svg':
      return <Layout className="size-3.5 text-orange-400" />;
    case 'md':
      return <FileText className="size-3.5 text-zinc-400" />;
    case 'py':
      return <Code2 className="size-3.5 text-green-400" />;
    case 'sql':
    case 'prisma':
      return <Database className="size-3.5 text-cyan-400" />;
    case 'sh':
    case 'bash':
    case 'zsh':
    case 'dockerfile':
      return <Terminal className="size-3.5 text-emerald-400" />;
    case 'yaml':
    case 'yml':
    case 'toml':
    case 'env':
      return <Settings className="size-3.5 text-zinc-400" />;
    default:
      return <FileType className="size-3.5 text-zinc-500" />;
  }
}

// ---------------------------------------------------------------------------
// EditorTab
// ---------------------------------------------------------------------------

function EditorTab({
  file,
  isActive,
  onClose,
}: {
  file: ProjectFile;
  isActive: boolean;
  onClose: () => void;
}) {
  return (
    <div
      className={`group flex items-center gap-1.5 border-r border-zinc-800 px-3 py-1.5 text-xs font-medium transition-colors ${
        isActive
          ? 'bg-zinc-950 text-zinc-100 shadow-[inset_0_-2px_0_0_theme(colors.emerald.500)]'
          : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-300'
      }`}
    >
      {getFileIcon(file.name)}
      <span className="max-w-[120px] truncate">{file.name}</span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="ml-1 flex size-4 items-center justify-center rounded opacity-0 transition-opacity hover:bg-zinc-700 group-hover:opacity-100"
        aria-label={`Close ${file.name}`}
      >
        <X className="size-3" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EditorToolbar
// ---------------------------------------------------------------------------

function EditorToolbar({
  file,
  isEditing,
  isSaving,
  isDirty,
  onToggleEdit,
  onSave,
  onCopy,
  copied,
}: {
  file: ProjectFile;
  isEditing: boolean;
  isSaving: boolean;
  isDirty: boolean;
  onToggleEdit: () => void;
  onSave: () => void;
  onCopy: () => void;
  copied: boolean;
}) {
  const language = getLanguageFromFileName(file.name);
  const lineCount = file.content.split('\n').length;
  const charCount = file.content.length;

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
        <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-zinc-400">
          {language}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EmptyState
// ---------------------------------------------------------------------------

function EmptyState() {
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

// ---------------------------------------------------------------------------
// CodeEditor (main export)
// ---------------------------------------------------------------------------

export default function CodeEditor() {
  const { currentFile, setCurrentFile, updateFile, files } = useAppStore();

  // Local editing state
  const [editContent, setEditContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [copied, setCopied] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const codeAreaRef = useRef<HTMLDivElement>(null);

  // Sync local state when currentFile changes
  useEffect(() => {
    if (currentFile) {
      setEditContent(currentFile.content);
      setIsDirty(false);
      setIsEditing(false);
    } else {
      setEditContent('');
      setIsDirty(false);
      setIsEditing(false);
    }
  }, [currentFile?.id]);

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

  // Keyboard shortcut: Ctrl/Cmd + S to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (currentFile && isDirty) {
          handleSave();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentFile, isDirty, editContent]);

  // ---- Handlers ----

  const handleSave = useCallback(async () => {
    if (!currentFile || !isDirty) return;

    setIsSaving(true);
    try {
      const res = await fetch(`/api/files/${currentFile.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent }),
      });

      if (!res.ok) {
        throw new Error(`Save failed: ${res.status}`);
      }

      const data = await res.json();

      // Update Zustand store
      updateFile(currentFile.id, {
        content: editContent,
        updatedAt: data.file?.updatedAt ?? new Date().toISOString(),
      });

      setIsDirty(false);

      toast({
        title: 'File saved',
        description: `${currentFile.name} saved successfully`,
      });
    } catch (error) {
      console.error('Save error:', error);
      toast({
        title: 'Save failed',
        description: 'Could not save the file. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }, [currentFile, isDirty, editContent, updateFile]);

  const handleToggleEdit = useCallback(() => {
    if (isEditing && isDirty) {
      // Switching from edit to view with unsaved changes — prompt implicitly by saving
      // Or just switch, letting user choose
    }
    setIsEditing((prev) => !prev);
  }, [isEditing, isDirty]);

  const handleContentChange = useCallback(
    (value: string) => {
      setEditContent(value);
      setIsDirty(value !== (currentFile?.content ?? ''));
    },
    [currentFile],
  );

  const handleCopy = useCallback(async () => {
    const content = isEditing ? editContent : (currentFile?.content ?? '');
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API not available
    }
  }, [editContent, currentFile, isEditing]);

  const handleCloseTab = useCallback(() => {
    setCurrentFile(null);
  }, [setCurrentFile]);

  // ---- Render ----

  // No file open
  if (!currentFile) {
    return (
      <div className="flex h-full flex-col bg-zinc-950">
        {/* Empty tab bar */}
        <div className="flex h-[34px] items-center border-b border-zinc-800 bg-zinc-900 px-3">
          <span className="text-xs text-zinc-600">No open files</span>
        </div>
        <EmptyState />
      </div>
    );
  }

  const language = getLanguageFromFileName(currentFile.name);
  const displayContent = isEditing ? editContent : currentFile.content;

  return (
    <div className="flex h-full flex-col bg-zinc-950">
      {/* Tab bar */}
      <div className="flex h-[34px] shrink-0 items-stretch overflow-x-auto border-b border-zinc-800 bg-zinc-900">
        <EditorTab
          file={currentFile}
          isActive={true}
          onClose={handleCloseTab}
        />
      </div>

      {/* Toolbar */}
      <EditorToolbar
        file={currentFile}
        isEditing={isEditing}
        isSaving={isSaving}
        isDirty={isDirty}
        onToggleEdit={handleToggleEdit}
        onSave={handleSave}
        onCopy={handleCopy}
        copied={copied}
      />

      {/* Code area — takes all remaining space */}
      <div
        ref={codeAreaRef}
        className="relative min-h-0 flex-1 overflow-auto font-mono text-sm"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: '#3f3f46 transparent',
        }}
      >
        <style>{`
          [data-code-area]::-webkit-scrollbar {
            width: 8px;
            height: 8px;
          }
          [data-code-area]::-webkit-scrollbar-track {
            background: transparent;
          }
          [data-code-area]::-webkit-scrollbar-thumb {
            background: #3f3f46;
            border-radius: 4px;
          }
          [data-code-area]::-webkit-scrollbar-thumb:hover {
            background: #52525b;
          }
          [data-code-area]::-webkit-scrollbar-corner {
            background: transparent;
          }
        `}</style>

        {isEditing ? (
          /* ---- Edit mode: textarea ---- */
          <div className="relative flex" data-code-area>
            {/* Line numbers gutter */}
            <div
              className="sticky left-0 z-10 select-none bg-zinc-950/90 text-right font-mono text-[13px] leading-[1.6] text-zinc-600"
              style={{ minWidth: '3.5em', padding: '1rem 0.75rem 1rem 0' }}
              aria-hidden="true"
            >
              {editContent.split('\n').map((_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={editContent}
              onChange={(e) => handleContentChange(e.target.value)}
              className="flex-1 resize-none bg-transparent p-4 pl-2 font-mono text-[13px] leading-[1.6] text-zinc-100 outline-none placeholder-zinc-600"
              style={{
                tabSize: 2,
              }}
              spellCheck={false}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              placeholder="Start typing..."
            />
          </div>
        ) : (
          /* ---- View mode: syntax highlighted ---- */
          <div data-code-area>
            <SyntaxHighlighter
              language={language}
              style={vscDarkPlus}
              showLineNumbers={true}
              lineNumberStyle={{
                color: '#52525b',
                minWidth: '3.5em',
                paddingRight: '1em',
              }}
              customStyle={{
                margin: 0,
                padding: '1rem',
                background: 'transparent',
                fontSize: '0.8125rem',
                lineHeight: '1.6',
              }}
              codeTagProps={{
                style: {
                  fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
                },
              }}
            >
              {displayContent}
            </SyntaxHighlighter>
          </div>
        )}
      </div>
    </div>
  );
}
