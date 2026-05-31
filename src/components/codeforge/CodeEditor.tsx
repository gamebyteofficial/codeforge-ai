'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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
  Play,
  WrapText,
  ZoomIn,
  ZoomOut,
  List,
  Minus,
  Plus,
} from 'lucide-react';
import { useAppStore, type ProjectFile } from '@/store';
import { useFileState, usePreviewState } from '@/store/hooks';
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

/** Get the dot color for a file type indicator */
function getFileTypeDotColor(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  switch (ext) {
    case 'json': return 'bg-amber-400';
    case 'ts':
    case 'tsx': return 'bg-blue-400';
    case 'js':
    case 'jsx': return 'bg-yellow-400';
    case 'css':
    case 'scss':
    case 'less': return 'bg-pink-400';
    case 'html':
    case 'htm':
    case 'svg': return 'bg-orange-400';
    case 'md': return 'bg-zinc-400';
    case 'py': return 'bg-green-400';
    case 'sql':
    case 'prisma': return 'bg-cyan-400';
    case 'sh':
    case 'bash':
    case 'zsh':
    case 'dockerfile': return 'bg-emerald-400';
    case 'yaml':
    case 'yml':
    case 'toml': return 'bg-zinc-400';
    default: return 'bg-zinc-500';
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
  const dotColor = getFileTypeDotColor(file.name);

  return (
    <div
      className={`group flex items-center gap-1.5 border-r border-zinc-800 px-3 py-1.5 text-xs font-medium transition-colors ${
        isActive
          ? 'bg-zinc-950 text-zinc-100 shadow-[inset_0_-2px_0_0_theme(colors.emerald.500)]'
          : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-300'
      }`}
    >
      {/* File type color dot */}
      <span className={`size-2 shrink-0 rounded-full ${dotColor}`} />
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

const FONT_SIZE_MIN = 10;
const FONT_SIZE_MAX = 24;
const FONT_SIZE_DEFAULT = 13;
const FONT_SIZE_STEP = 1;

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

function EditorToolbar({
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
  const dotColor = getFileTypeDotColor(file.name);

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
// Bracket pairs for auto-close
// ---------------------------------------------------------------------------

const BRACKET_PAIRS: Record<string, string> = {
  '{': '}',
  '(': ')',
  '[': ']',
  '"': '"',
  "'": "'",
  '`': '`',
};

// ---------------------------------------------------------------------------
// CodeEditor (main export)
// ---------------------------------------------------------------------------

export default function CodeEditor() {
  const currentFile = useFileState(s => s.currentFile);
  const setCurrentFile = useFileState(s => s.setCurrentFile);
  const updateFile = useFileState(s => s.updateFile);
  const files = useFileState(s => s.files);
  const setIsPreviewOpen = usePreviewState(s => s.setIsPreviewOpen);
  const setPreviewFiles = usePreviewState(s => s.setPreviewFiles);

  // Local editing state
  const [editContent, setEditContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [copied, setCopied] = useState(false);

  // Editor preference state
  const [wordWrap, setWordWrap] = useState(true);
  const [fontSize, setFontSize] = useState(FONT_SIZE_DEFAULT);
  const [showLineNumbers, setShowLineNumbers] = useState(true);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const codeAreaRef = useRef<HTMLDivElement>(null);

  // Sync local state when currentFile changes
  // Use a ref to track previous file ID to avoid unnecessary resets
  const prevFileIdRef = useRef<string | null>(null);
  useEffect(() => {
    const fileId = currentFile?.id ?? null;
    if (fileId !== prevFileIdRef.current) {
      prevFileIdRef.current = fileId;
      if (currentFile) {
        setEditContent(currentFile.content);
        setIsDirty(false);
        setIsEditing(false);
      } else {
        setEditContent('');
        setIsDirty(false);
        setIsEditing(false);
      }
    }
  }, [currentFile]);

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

  // ---- Keyboard shortcuts: Ctrl/Cmd+S to save, Ctrl/Cmd+Shift+P for preview ----

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

      // If preview is open and this is a previewable file, update preview
      const ext = currentFile.name.split('.').pop()?.toLowerCase() ?? '';
      if (['html', 'htm', 'css', 'scss', 'less', 'js', 'jsx', 'ts', 'tsx'].includes(ext)) {
        const { isPreviewOpen, previewFiles, setPreviewFiles } = useAppStore.getState();
        if (isPreviewOpen) {
          const updatedHtml = ['html', 'htm'].includes(ext) ? editContent : previewFiles.html;
          const updatedCss = ['css', 'scss', 'less'].includes(ext) ? editContent : previewFiles.css;
          const updatedJs = ['js', 'jsx', 'ts', 'tsx'].includes(ext) ? editContent : previewFiles.js;
          setPreviewFiles({ html: updatedHtml, css: updatedCss, js: updatedJs });
        }
      }

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

  // ---- Check if current file is previewable (HTML/CSS/JS) ----
  // Pre-computed set for O(1) lookup instead of Array.includes()
  const PREVIEWABLE_EXTENSIONS = useMemo(() => new Set(['html', 'htm', 'css', 'scss', 'less', 'js', 'jsx', 'ts', 'tsx']), []);
  const isPreviewable = useCallback((fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
    return PREVIEWABLE_EXTENSIONS.has(ext);
  }, [PREVIEWABLE_EXTENSIONS]);

  // ---- Handle opening preview with HTML/CSS/JS files from the project ----

  const handleOpenPreview = useCallback(() => {
    if (!currentFile) return;

    // Find HTML, CSS, and JS files from the current project
    const htmlFile = files.find(f => {
      const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
      return ['html', 'htm'].includes(ext) && !f.isFolder;
    });
    const cssFile = files.find(f => {
      const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
      return ['css', 'scss', 'less'].includes(ext) && !f.isFolder;
    });
    const jsFile = files.find(f => {
      const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
      return ['js', 'jsx', 'ts', 'tsx'].includes(ext) && !f.isFolder;
    });

    // Use current file content if it matches a type, otherwise use found files
    const ext = currentFile.name.split('.').pop()?.toLowerCase() ?? '';
    let html = htmlFile?.content ?? '';
    let css = cssFile?.content ?? '';
    let js = jsFile?.content ?? '';

    // If the current file is one of these types, use its latest content
    if (['html', 'htm'].includes(ext)) {
      html = isDirty ? editContent : currentFile.content;
    } else if (['css', 'scss', 'less'].includes(ext)) {
      css = isDirty ? editContent : currentFile.content;
    } else if (['js', 'jsx', 'ts', 'tsx'].includes(ext)) {
      js = isDirty ? editContent : currentFile.content;
    }

    setPreviewFiles({ html, css, js });
    setIsPreviewOpen(true);
  }, [currentFile, files, isDirty, editContent, setPreviewFiles, setIsPreviewOpen]);

  // Keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + S to save
      if ((e.metaKey || e.ctrlKey) && e.key === 's' && !e.shiftKey) {
        e.preventDefault();
        if (currentFile && isDirty) {
          handleSave();
        }
      }
      // Ctrl/Cmd + Shift + P to open preview
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        if (currentFile && isPreviewable(currentFile.name)) {
          handleOpenPreview();
          toast({
            title: 'Preview opened',
            description: `${currentFile.name} opened in preview`,
          });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentFile, isDirty, handleSave, isPreviewable, handleOpenPreview]);

  // ---- Handlers ----

  const handleToggleEdit = useCallback(() => {
    setIsEditing((prev) => !prev);
  }, []);

  const handleContentChange = useCallback(
    (value: string) => {
      setEditContent(value);
      setIsDirty(value !== (currentFile?.content ?? ''));
    },
    [currentFile],
  );

  // Tab indentation handling in textarea
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = e.currentTarget;

    if (e.key === 'Tab') {
      e.preventDefault();
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newValue = editContent.substring(0, start) + '  ' + editContent.substring(end);
      setEditContent(newValue);
      setIsDirty(newValue !== (currentFile?.content ?? ''));
      // Set cursor position after the inserted tab
      requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      });
      return;
    }

    // Auto-close brackets
    const closingBracket = BRACKET_PAIRS[e.key];
    if (closingBracket && !e.metaKey && !e.ctrlKey && !e.altKey) {
      // For quote characters, check if the next char is already the closing quote
      if (e.key === '"' || e.key === "'" || e.key === '`') {
        const nextChar = editContent[textarea.selectionStart];
        if (nextChar === e.key) {
          // Skip over the existing closing quote instead of inserting a new one
          e.preventDefault();
          textarea.selectionStart = textarea.selectionEnd = textarea.selectionStart + 1;
          return;
        }
      }

      e.preventDefault();
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = editContent.substring(start, end);
      const newValue =
        editContent.substring(0, start) + e.key + selectedText + closingBracket + editContent.substring(end);
      setEditContent(newValue);
      setIsDirty(newValue !== (currentFile?.content ?? ''));
      // Place cursor between the brackets
      requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 1;
      });
      return;
    }

    // Enter key — auto-indent: match the indentation of the current line
    if (e.key === 'Enter') {
      const start = textarea.selectionStart;
      const currentLineStart = editContent.lastIndexOf('\n', start - 1) + 1;
      const currentLine = editContent.substring(currentLineStart, start);
      const indentMatch = currentLine.match(/^\s*/);
      let indent = indentMatch ? indentMatch[0] : '';

      // Extra indent after opening brace
      const charBeforeCursor = editContent[start - 1];
      const charAfterCursor = editContent[start];
      if (charBeforeCursor === '{' && charAfterCursor === '}') {
        e.preventDefault();
        const newValue =
          editContent.substring(0, start) + '\n' + indent + '  ' + '\n' + indent + editContent.substring(start);
        setEditContent(newValue);
        setIsDirty(newValue !== (currentFile?.content ?? ''));
        requestAnimationFrame(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 1 + indent.length + 2;
        });
        return;
      } else if (charBeforeCursor === '{' || charBeforeCursor === '(' || charBeforeCursor === '[') {
        indent += '  ';
      }

      if (indent) {
        e.preventDefault();
        const newValue = editContent.substring(0, start) + '\n' + indent + editContent.substring(start);
        setEditContent(newValue);
        setIsDirty(newValue !== (currentFile?.content ?? ''));
        requestAnimationFrame(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 1 + indent.length;
        });
      }
    }
  }, [editContent, currentFile]);

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

  // ---- Compute derived values (must be before any conditional returns) ----

  const language = useMemo(() => currentFile ? getLanguageFromFileName(currentFile.name) : '', [currentFile]);
  const displayContent = currentFile ? (isEditing ? editContent : currentFile.content) : '';
  const canPreview = currentFile ? isPreviewable(currentFile.name) : false;

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
        onPreview={handleOpenPreview}
        isPreviewable={canPreview}
        wordWrap={wordWrap}
        onToggleWordWrap={() => setWordWrap((v) => !v)}
        fontSize={fontSize}
        onFontSizeChange={setFontSize}
        showLineNumbers={showLineNumbers}
        onToggleLineNumbers={() => setShowLineNumbers((v) => !v)}
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
            {showLineNumbers && (
              <div
                className="sticky left-0 z-10 select-none bg-zinc-950/90 text-right font-mono leading-[1.6] text-zinc-600"
                style={{ minWidth: '3.5em', padding: '1rem 0.75rem 1rem 0', fontSize: `${fontSize}px` }}
                aria-hidden="true"
              >
                {editContent.split('\n').map((_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>
            )}

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={editContent}
              onChange={(e) => handleContentChange(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 resize-none bg-transparent p-4 pl-2 font-mono leading-[1.6] text-zinc-100 outline-none placeholder-zinc-600"
              style={{
                tabSize: 2,
                fontSize: `${fontSize}px`,
                whiteSpace: wordWrap ? 'pre-wrap' : 'pre',
                overflowWrap: wordWrap ? 'break-word' : 'normal',
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
              showLineNumbers={showLineNumbers}
              lineNumberStyle={{
                color: '#52525b',
                minWidth: '3.5em',
                paddingRight: '1em',
              }}
              customStyle={{
                margin: 0,
                padding: '1rem',
                background: 'transparent',
                fontSize: `${fontSize}px`,
                lineHeight: '1.6',
              }}
              wrapLines={wordWrap}
              wrapLongLines={wordWrap}
              codeTagProps={{
                style: {
                  fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
                  whiteSpace: wordWrap ? 'pre-wrap' : 'pre',
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
