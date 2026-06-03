'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import dynamic from 'next/dynamic';

const SyntaxHighlighter = dynamic(
  () => import('react-syntax-highlighter').then(mod => mod.Prism),
  { ssr: false, loading: () => <div className="h-8" /> }
);
import { useAppStore, type ProjectFile } from '@/store';
import { useFileState, usePreviewState } from '@/store/hooks';
import { toast } from '@/hooks/use-toast';
import { getLanguageFromFileName } from '@/lib/file-icons';

// Extracted components
import EditorToolbar, { FONT_SIZE_DEFAULT } from './editor/EditorToolbar';
import EditorTabs, { MAX_OPEN_TABS } from './editor/EditorTabs';
import EditorEmptyState from './editor/EditorEmptyState';

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

  // Multi-tab state
  const [openFileIds, setOpenFileIds] = useState<string[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; fileId: string } | null>(null);

  // Local editing state (keyed by activeFileId so each file has its own state)
  const [editContent, setEditContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [copied, setCopied] = useState(false);

  // Per-file dirty state tracking
  const dirtyMapRef = useRef<Map<string, string>>(new Map()); // fileId -> unsaved content
  const editMapRef = useRef<Map<string, string>>(new Map()); // fileId -> edit content

  // Editor preference state
  const [wordWrap, setWordWrap] = useState(true);
  const [fontSize, setFontSize] = useState(FONT_SIZE_DEFAULT);
  const [showLineNumbers, setShowLineNumbers] = useState(true);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const codeAreaRef = useRef<HTMLDivElement>(null);
  const tabBarRef = useRef<HTMLDivElement>(null);

  // ---- Resolve the actual file object for activeFileId ----
  const filesMap = useMemo(() => {
    const map = new Map<string, ProjectFile>();
    for (const f of files) map.set(f.id, f);
    return map;
  }, [files]);

  // The active file is determined by activeFileId, falling back to currentFile from store
  const activeFile = useMemo(() => {
    if (activeFileId) return filesMap.get(activeFileId) ?? null;
    return currentFile;
  }, [activeFileId, filesMap, currentFile]);

  // ---- When currentFile changes from the store (e.g. FileExplorer click), add to open tabs ----
  useEffect(() => {
    if (currentFile) {
      setOpenFileIds(prev => {
        if (prev.includes(currentFile.id)) return prev;
        // Limit to MAX_OPEN_TABS — remove the oldest (first) tab
        const next = [...prev, currentFile.id];
        if (next.length > MAX_OPEN_TABS) {
          next.shift();
        }
        return next;
      });
      setActiveFileId(currentFile.id);
    }
  }, [currentFile]);

  // ---- Remove deleted files from open tabs ----
  useEffect(() => {
    if (openFileIds.length === 0) return;
    const currentIds = new Set(files.map(f => f.id));
    const remaining = openFileIds.filter(id => currentIds.has(id));
    if (remaining.length !== openFileIds.length) {
      setOpenFileIds(remaining);
      // If the active file was deleted, switch to the last remaining tab
      if (activeFileId && !currentIds.has(activeFileId)) {
        const newActive = remaining.length > 0 ? remaining[remaining.length - 1] : null;
        setActiveFileId(newActive);
        // Also update the store so the rest of the app knows
        if (newActive) {
          const newFile = filesMap.get(newActive) ?? null;
          setCurrentFile(newFile);
        } else {
          setCurrentFile(null);
        }
      }
    }
  }, [files, openFileIds, activeFileId, filesMap, setCurrentFile]);

  // ---- Sync local editing state when activeFile changes ----
  const prevActiveFileIdRef = useRef<string | null>(null);
  useEffect(() => {
    const fileId = activeFile?.id ?? null;
    if (fileId !== prevActiveFileIdRef.current) {
      // Save current edit state for the previous file
      if (prevActiveFileIdRef.current && isDirty) {
        dirtyMapRef.current.set(prevActiveFileIdRef.current, editContent);
      }
      if (prevActiveFileIdRef.current) {
        editMapRef.current.set(prevActiveFileIdRef.current, editContent);
      }

      prevActiveFileIdRef.current = fileId;
      if (activeFile) {
        // Restore per-file edit state if available
        const savedEdit = editMapRef.current.get(fileId);
        const savedDirty = dirtyMapRef.current.get(fileId);
        setEditContent(savedDirty ?? savedEdit ?? activeFile.content);
        setIsDirty(!!savedDirty && savedDirty !== activeFile.content);
        setIsEditing(false);
      } else {
        setEditContent('');
        setIsDirty(false);
        setIsEditing(false);
      }
    }
  }, [activeFile]);

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

  // ---- Keyboard shortcuts: Ctrl/Cmd+S to save, Ctrl/Cmd+Shift+P for preview ----

  const handleSave = useCallback(async () => {
    if (!activeFile || !isDirty) return;

    setIsSaving(true);
    try {
      const res = await fetch(`/api/files/${activeFile.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent }),
      });

      if (!res.ok) {
        throw new Error(`Save failed: ${res.status}`);
      }

      const data = await res.json();

      // Update Zustand store
      updateFile(activeFile.id, {
        content: editContent,
        updatedAt: data.file?.updatedAt ?? new Date().toISOString(),
      });

      setIsDirty(false);
      // Clear dirty state for this file
      dirtyMapRef.current.delete(activeFile.id);

      // If preview is open and this is a previewable file, update preview
      const ext = activeFile.name.split('.').pop()?.toLowerCase() ?? '';
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
        description: `${activeFile.name} saved successfully`,
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
  }, [activeFile, isDirty, editContent, updateFile]);

  // ---- Check if current file is previewable (HTML/CSS/JS) ----
  // Pre-computed set for O(1) lookup instead of Array.includes()
  const PREVIEWABLE_EXTENSIONS = useMemo(() => new Set(['html', 'htm', 'css', 'scss', 'less', 'js', 'jsx', 'ts', 'tsx']), []);
  const isPreviewable = useCallback((fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
    return PREVIEWABLE_EXTENSIONS.has(ext);
  }, [PREVIEWABLE_EXTENSIONS]);

  // ---- Handle opening preview with HTML/CSS/JS files from the project ----

  const handleOpenPreview = useCallback(() => {
    if (!activeFile) return;

    // Find all HTML, CSS, and JS files from the current project
    const htmlFiles = files.filter(f => {
      const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
      return ['html', 'htm'].includes(ext) && !f.isFolder;
    });
    const cssFiles = files.filter(f => {
      const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
      return ['css', 'scss', 'less'].includes(ext) && !f.isFolder;
    });
    const jsFiles = files.filter(f => {
      const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
      return ['js', 'jsx'].includes(ext) && !f.isFolder;
    });

    // Use active file content if it matches a type, otherwise use found files
    const ext = activeFile.name.split('.').pop()?.toLowerCase() ?? '';

    // Combine multiple CSS files into one, and multiple JS files into one
    let html = htmlFiles[0]?.content ?? '';
    let css = cssFiles.map(f => `/* ${f.name} */\n${f.content}`).join('\n\n');
    let js = jsFiles.map(f => `// ${f.name}\n${f.content}`).join('\n\n');

    // If the active file is one of these types, use its latest content
    if (['html', 'htm'].includes(ext)) {
      html = isDirty ? editContent : activeFile.content;
    } else if (['css', 'scss', 'less'].includes(ext)) {
      // Replace the matching file's content in the combined CSS
      css = isDirty ? editContent : activeFile.content;
      if (cssFiles.length > 1) {
        css = cssFiles
          .filter(f => f.id !== activeFile.id)
          .map(f => `/* ${f.name} */\n${f.content}`)
          .concat([`/* ${activeFile.name} */\n${css}`])
          .join('\n\n');
      }
    } else if (['js', 'jsx'].includes(ext)) {
      // Replace the matching file's content in the combined JS
      js = isDirty ? editContent : activeFile.content;
      if (jsFiles.length > 1) {
        js = jsFiles
          .filter(f => f.id !== activeFile.id)
          .map(f => `// ${f.name}\n${f.content}`)
          .concat([`// ${activeFile.name}\n${js}`])
          .join('\n\n');
      }
    }

    setPreviewFiles({ html, css, js });
    setIsPreviewOpen(true);
  }, [activeFile, files, isDirty, editContent, setPreviewFiles, setIsPreviewOpen]);

  // Keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + S to save
      if ((e.metaKey || e.ctrlKey) && e.key === 's' && !e.shiftKey) {
        e.preventDefault();
        if (activeFile && isDirty) {
          handleSave();
        }
      }
      // Ctrl/Cmd + Shift + P to open preview
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        if (activeFile && isPreviewable(activeFile.name)) {
          handleOpenPreview();
          toast({
            title: 'Preview opened',
            description: `${activeFile.name} opened in preview`,
          });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeFile, isDirty, handleSave, isPreviewable, handleOpenPreview]);

  // ---- Handlers ----

  const handleToggleEdit = useCallback(() => {
    setIsEditing((prev) => !prev);
  }, []);

  const handleContentChange = useCallback(
    (value: string) => {
      setEditContent(value);
      const isChanged = value !== (activeFile?.content ?? '');
      setIsDirty(isChanged);
      // Track dirty state per-file
      if (activeFile) {
        if (isChanged) {
          dirtyMapRef.current.set(activeFile.id, value);
        } else {
          dirtyMapRef.current.delete(activeFile.id);
        }
        editMapRef.current.set(activeFile.id, value);
      }
    },
    [activeFile],
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
      setIsDirty(newValue !== (activeFile?.content ?? ''));
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
      setIsDirty(newValue !== (activeFile?.content ?? ''));
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
        setIsDirty(newValue !== (activeFile?.content ?? ''));
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
        setIsDirty(newValue !== (activeFile?.content ?? ''));
        requestAnimationFrame(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 1 + indent.length;
        });
      }
    }
  }, [editContent, activeFile]);

  const handleCopy = useCallback(async () => {
    const content = isEditing ? editContent : (activeFile?.content ?? '');
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API not available
    }
  }, [editContent, activeFile, isEditing]);

  const handleCloseTab = useCallback((fileId: string) => {
    setOpenFileIds(prev => {
      const idx = prev.indexOf(fileId);
      if (idx === -1) return prev;
      const next = prev.filter(id => id !== fileId);

      // Clean up per-file state
      dirtyMapRef.current.delete(fileId);
      editMapRef.current.delete(fileId);

      // If closing the active tab, switch to the previous or next tab
      if (fileId === activeFileId) {
        let newActiveId: string | null = null;
        if (next.length > 0) {
          // Prefer the tab to the left, otherwise the one to the right
          newActiveId = idx > 0 ? next[idx - 1] : next[0];
        }
        setActiveFileId(newActiveId);
        const newFile = newActiveId ? filesMap.get(newActiveId) ?? null : null;
        setCurrentFile(newFile);
      }

      return next;
    });
  }, [activeFileId, filesMap, setCurrentFile]);

  const handleCloseOthers = useCallback((keepId: string) => {
    setOpenFileIds([keepId]);
    setActiveFileId(keepId);
    const file = filesMap.get(keepId) ?? null;
    setCurrentFile(file);
    // Clean up dirty state for closed tabs
    for (const [id] of dirtyMapRef.current) {
      if (id !== keepId) dirtyMapRef.current.delete(id);
    }
    for (const [id] of editMapRef.current) {
      if (id !== keepId) editMapRef.current.delete(id);
    }
  }, [filesMap, setCurrentFile]);

  const handleCloseAll = useCallback(() => {
    setOpenFileIds([]);
    setActiveFileId(null);
    setCurrentFile(null);
    dirtyMapRef.current.clear();
    editMapRef.current.clear();
  }, [setCurrentFile]);

  const handleTabClick = useCallback((fileId: string) => {
    setActiveFileId(fileId);
    const file = filesMap.get(fileId) ?? null;
    setCurrentFile(file);
  }, [filesMap, setCurrentFile]);

  const handleTabContextMenu = useCallback((e: React.MouseEvent, fileId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, fileId });
  }, []);

  // Close context menu on click anywhere
  useEffect(() => {
    if (!contextMenu) return;
    function handleDismiss() { setContextMenu(null); }
    document.addEventListener('click', handleDismiss);
    return () => document.removeEventListener('click', handleDismiss);
  }, [contextMenu]);

  // ---- Compute derived values (must be before any conditional returns) ----

  // Build the list of open file objects (resolved from IDs)
  const openFileObjects = useMemo(() => {
    return openFileIds
      .map(id => filesMap.get(id))
      .filter((f): f is ProjectFile => f !== undefined);
  }, [openFileIds, filesMap]);

  const language = useMemo(() => activeFile ? getLanguageFromFileName(activeFile.name) : '', [activeFile]);
  const displayContent = activeFile ? (isEditing ? editContent : activeFile.content) : '';
  const canPreview = activeFile ? isPreviewable(activeFile.name) : false;

  // ---- Render ----

  return (
    <div className="flex h-full flex-col bg-zinc-950">
      <EditorTabs
        openFileObjects={openFileObjects}
        activeFileId={activeFileId}
        onTabClick={handleTabClick}
        onCloseTab={handleCloseTab}
        onContextMenu={handleTabContextMenu}
        tabBarRef={tabBarRef}
        contextMenu={contextMenu}
        onCloseContextMenu={() => setContextMenu(null)}
        onCloseOthers={handleCloseOthers}
        onCloseAll={handleCloseAll}
      />

      {/* No file open — show placeholder */}
      {!activeFile ? (
        <EditorEmptyState />
      ) : (
        <>
          {/* Toolbar */}
          <EditorToolbar
            file={activeFile}
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
        </>
      )}
    </div>
  );
}
