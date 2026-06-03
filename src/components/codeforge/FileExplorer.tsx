'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  File,
  Folder,
  FolderOpen,
  Plus,
  FolderPlus,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  Trash2,
  Pencil,
  Loader2,
  FolderSearch,
  Search,
  X,
} from 'lucide-react';
import { type ProjectFile } from '@/store';
import { useFileState, useProjectState } from '@/store/hooks';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from '@/components/ui/context-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { getFileIcon, getLanguageFromFileName } from '@/lib/file-icons';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TreeNode {
  name: string;
  path: string;
  isFolder: boolean;
  file?: ProjectFile;
  children: TreeNode[];
}

type CreationMode = 'file' | 'folder' | null;

// ---------------------------------------------------------------------------
// Build tree from flat file list
// ---------------------------------------------------------------------------

function buildTree(files: ProjectFile[]): TreeNode[] {
  const root: TreeNode[] = [];

  const sortedFiles = [...files].sort((a, b) => {
    // Folders first, then alphabetical
    if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
    return a.path.localeCompare(b.path);
  });

  for (const file of sortedFiles) {
    const parts = file.path.split('/').filter(Boolean);
    let currentLevel = root;

    for (let i = 0; i < parts.length; i++) {
      const partName = parts[i];
      const partialPath = parts.slice(0, i + 1).join('/');
      const isLastPart = i === parts.length - 1;

      // Check if node already exists at this level
      let existingNode = currentLevel.find((n) => n.name === partName);

      if (!existingNode) {
        const newNode: TreeNode = {
          name: partName,
          path: partialPath,
          isFolder: !isLastPart || file.isFolder,
          file: isLastPart ? file : undefined,
          children: [],
        };
        currentLevel.push(newNode);
        existingNode = newNode;
      } else if (isLastPart && file) {
        // Update existing node with file data
        existingNode.file = file;
        existingNode.isFolder = file.isFolder;
      }

      currentLevel = existingNode.children;
    }
  }

  // Sort each level: folders first, then files, alphabetically within each group
  function sortTree(nodes: TreeNode[]): TreeNode[] {
    return nodes.sort((a, b) => {
      if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
      return a.name.localeCompare(b.name);
    }).map((node) => ({
      ...node,
      children: sortTree(node.children),
    }));
  }

  return sortTree(root);
}

// ---------------------------------------------------------------------------
// TreeNodeItem component
// ---------------------------------------------------------------------------

function TreeNodeItem({
  node,
  depth,
  currentFile,
  expandedFolders,
  renamingFileId,
  renameValue,
  onToggleFolder,
  onSelectFile,
  onRename,
  onDelete,
  onCreateInFolder,
  onRenameValueChange,
  onRenameSubmit,
  onRenameCancel,
}: {
  node: TreeNode;
  depth: number;
  currentFile: ProjectFile | null;
  expandedFolders: Set<string>;
  renamingFileId: string | null;
  renameValue: string;
  onToggleFolder: (path: string) => void;
  onSelectFile: (file: ProjectFile) => void;
  onRename: (file: ProjectFile) => void;
  onDelete: (file: ProjectFile) => void;
  onCreateInFolder: (parentPath: string, mode: 'file' | 'folder') => void;
  onRenameValueChange: (value: string) => void;
  onRenameSubmit: () => void;
  onRenameCancel: () => void;
}) {
  const isExpanded = expandedFolders.has(node.path);
  const isSelected = !node.isFolder && currentFile?.path === node.path;
  const paddingLeft = 8 + depth * 16;

  const handleClick = () => {
    if (node.isFolder) {
      onToggleFolder(node.path);
    } else if (node.file) {
      onSelectFile(node.file);
    }
  };

  const icon = node.isFolder ? (
    isExpanded ? (
      <FolderOpen className="size-3.5 shrink-0 text-amber-400" />
    ) : (
      <Folder className="size-3.5 shrink-0 text-amber-400" />
    )
  ) : (
    getFileIcon(node.name)
  );

  const chevron = node.isFolder ? (
    isExpanded ? (
      <ChevronDown className="size-3.5 shrink-0 text-zinc-500" />
    ) : (
      <ChevronRight className="size-3.5 shrink-0 text-zinc-500" />
    )
  ) : (
    <span className="w-3.5 shrink-0" />
  );

  const isRenaming = node.file && renamingFileId === node.file.id;
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming) {
      requestAnimationFrame(() => renameInputRef.current?.focus());
    }
  }, [isRenaming]);

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          {isRenaming ? (
            <div
              className="flex w-full items-center gap-1 py-1 pr-2"
              style={{ paddingLeft: `${paddingLeft}px` }}
            >
              {chevron}
              {icon}
              <input
                ref={renameInputRef}
                value={renameValue}
                onChange={(e) => onRenameValueChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    onRenameSubmit();
                  } else if (e.key === 'Escape') {
                    onRenameCancel();
                  }
                }}
                onBlur={() => {
                  if (renameValue.trim()) {
                    onRenameSubmit();
                  } else {
                    onRenameCancel();
                  }
                }}
                className="min-w-0 flex-1 rounded border border-emerald-500/40 bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-emerald-500/70"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          ) : (
            <button
              onClick={handleClick}
              className={`group flex w-full items-center gap-1 py-1 pr-2 text-left text-xs transition-colors ${
                isSelected
                  ? 'bg-emerald-500/20 text-emerald-100'
                  : 'text-zinc-300 hover:bg-zinc-800/70 hover:text-zinc-100'
              }`}
              style={{ paddingLeft: `${paddingLeft}px` }}
            >
              {chevron}
              {icon}
              <span className="truncate">{node.name}</span>
            </button>
          )}
        </ContextMenuTrigger>
        <ContextMenuContent className="border-zinc-700 bg-zinc-800 text-zinc-200">
          {node.isFolder && (
            <>
              <ContextMenuItem
                className="gap-2 text-xs focus:bg-zinc-700 focus:text-zinc-100"
                onClick={() => onCreateInFolder(node.path, 'file')}
              >
                <Plus className="size-3.5" />
                New File
              </ContextMenuItem>
              <ContextMenuItem
                className="gap-2 text-xs focus:bg-zinc-700 focus:text-zinc-100"
                onClick={() => onCreateInFolder(node.path, 'folder')}
              >
                <FolderPlus className="size-3.5" />
                New Folder
              </ContextMenuItem>
              <ContextMenuSeparator className="bg-zinc-700" />
            </>
          )}
          {!node.isFolder && node.file && (
            <ContextMenuItem
              className="gap-2 text-xs focus:bg-zinc-700 focus:text-zinc-100"
              onClick={() => onRename(node.file!)}
            >
              <Pencil className="size-3.5" />
              Rename
            </ContextMenuItem>
          )}
          {node.isFolder && node.file && (
            <ContextMenuItem
              className="gap-2 text-xs focus:bg-zinc-700 focus:text-zinc-100"
              onClick={() => onRename(node.file!)}
            >
              <Pencil className="size-3.5" />
              Rename
            </ContextMenuItem>
          )}
          <ContextMenuItem
            variant="destructive"
            className="gap-2 text-xs focus:bg-red-500/10 focus:text-red-400"
            onClick={() => {
              if (node.file) onDelete(node.file);
            }}
          >
            <Trash2 className="size-3.5" />
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Children (visible when folder is expanded) */}
      <AnimatePresence initial={false}>
        {node.isFolder && isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            {node.children.map((child) => (
              <TreeNodeItem
                key={child.path}
                node={child}
                depth={depth + 1}
                currentFile={currentFile}
                expandedFolders={expandedFolders}
                renamingFileId={renamingFileId}
                renameValue={renameValue}
                onToggleFolder={onToggleFolder}
                onSelectFile={onSelectFile}
                onRename={onRename}
                onDelete={onDelete}
                onCreateInFolder={onCreateInFolder}
                onRenameValueChange={onRenameValueChange}
                onRenameSubmit={onRenameSubmit}
                onRenameCancel={onRenameCancel}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ---------------------------------------------------------------------------
// InlineCreationInput – used for creating new files/folders inline
// ---------------------------------------------------------------------------

function InlineCreationInput({
  mode,
  parentPath,
  onConfirm,
  onCancel,
}: {
  mode: 'file' | 'folder';
  parentPath: string;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Auto-focus on mount
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, []);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed) {
      onCancel();
      return;
    }
    onConfirm(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  const depth = parentPath ? parentPath.split('/').filter(Boolean).length : 0;
  const paddingLeft = 8 + depth * 16 + 3.5 * 4 + 4; // account for chevron + icon + gaps

  return (
    <div
      className="flex items-center py-1 pr-2"
      style={{ paddingLeft: `${paddingLeft}px` }}
    >
      {mode === 'folder' ? (
        <Folder className="size-3.5 shrink-0 text-amber-400" />
      ) : (
        <File className="size-3.5 shrink-0 text-zinc-500" />
      )}
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleSubmit}
        placeholder={mode === 'folder' ? 'folder name...' : 'filename...'}
        className="ml-1 min-w-0 flex-1 rounded border border-emerald-500/40 bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-emerald-500/70"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// EmptyState
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center"
    >
      <div className="flex size-12 items-center justify-center rounded-xl bg-zinc-800/80 ring-1 ring-zinc-700/50">
        <FolderSearch className="size-5 text-zinc-500" />
      </div>
      <div>
        <p className="text-sm font-medium text-zinc-400">No files yet</p>
        <p className="mt-1 text-xs text-zinc-600">
          Create a file or ask AI to generate code
        </p>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// FileExplorer (main export)
// ---------------------------------------------------------------------------

export default function FileExplorer() {
  const files = useFileState(s => s.files);
  const currentFile = useFileState(s => s.currentFile);
  const currentProject = useProjectState(s => s.currentProject);
  const setFiles = useFileState(s => s.setFiles);
  const setCurrentFile = useFileState(s => s.setCurrentFile);
  const addFile = useFileState(s => s.addFile);
  const removeFile = useFileState(s => s.removeFile);
  const updateFile = useFileState(s => s.updateFile);

  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [creationMode, setCreationMode] = useState<CreationMode>(null);
  const [creationParentPath, setCreationParentPath] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<{ fileId: string; fileName: string } | null>(null);

  // File search state
  const [fileSearch, setFileSearch] = useState('');

  // Inline rename state
  const [renamingFileId, setRenamingFileId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Filter files by search
  const filteredFiles = useMemo(
    () => fileSearch ? files.filter(f => f.name.toLowerCase().includes(fileSearch.toLowerCase())) : files,
    [files, fileSearch],
  );

  // Build tree from filtered file list
  const tree = useMemo(() => buildTree(filteredFiles), [filteredFiles]);

  // -------------------------------------------------------------------------
  // Fetch files
  // -------------------------------------------------------------------------

  const fetchFiles = useCallback(async () => {
    if (!currentProject) {
      setFiles([]);
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`/api/files?projectId=${currentProject.id}`);
      if (!res.ok) throw new Error('Failed to fetch files');
      const data = await res.json();
      setFiles(data.files ?? []);
    } catch (error) {
      console.error('Failed to fetch files:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentProject, setFiles]);

  // Load files on mount and when project changes
  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  // -------------------------------------------------------------------------
  // Toggle folder
  // -------------------------------------------------------------------------

  const handleToggleFolder = useCallback((path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  // -------------------------------------------------------------------------
  // Select file
  // -------------------------------------------------------------------------

  const handleSelectFile = useCallback(
    (file: ProjectFile) => {
      setCurrentFile(file);
    },
    [setCurrentFile],
  );

  // -------------------------------------------------------------------------
  // Create file or folder
  // -------------------------------------------------------------------------

  const handleStartCreation = useCallback(
    (mode: CreationMode, parentPath?: string) => {
      setCreationMode(mode);
      setCreationParentPath(parentPath || '');

      // Auto-expand parent folder if creating inside it
      if (parentPath) {
        setExpandedFolders((prev) => {
          const next = new Set(prev);
          next.add(parentPath);
          return next;
        });
      }
    },
    [],
  );

  const handleConfirmCreation = useCallback(
    async (name: string) => {
      if (!currentProject || !name) {
        setCreationMode(null);
        return;
      }

      const isFolder = creationMode === 'folder';
      const path = creationParentPath
        ? `${creationParentPath}/${name}`
        : name;

      // Determine language from extension (using shared utility)
      const language = isFolder ? '' : getLanguageFromFileName(name);

      setIsCreating(true);
      try {
        const res = await fetch('/api/files', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            path,
            content: '',
            language,
            isFolder,
            projectId: currentProject.id,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          console.error('Failed to create:', data.error);
          return;
        }

        const data = await res.json();
        addFile(data.file);

        // If it's a folder, expand it; if it's a file, select it
        if (isFolder) {
          setExpandedFolders((prev) => {
            const next = new Set(prev);
            next.add(path);
            return next;
          });
        } else {
          setCurrentFile(data.file);
          // Ensure parent folder is expanded
          if (creationParentPath) {
            setExpandedFolders((prev) => {
              const next = new Set(prev);
              next.add(creationParentPath);
              return next;
            });
          }
        }
      } catch (error) {
        console.error('Failed to create file:', error);
      } finally {
        setIsCreating(false);
        setCreationMode(null);
      }
    },
    [currentProject, creationMode, creationParentPath, addFile, setCurrentFile],
  );

  const handleCancelCreation = useCallback(() => {
    setCreationMode(null);
    setCreationParentPath('');
  }, []);

  // -------------------------------------------------------------------------
  // Delete file
  // -------------------------------------------------------------------------

  const handleDelete = useCallback(
    (file: ProjectFile) => {
      setDeleteConfirm({ fileId: file.id, fileName: file.name });
    },
    [],
  );

  const performDelete = useCallback(
    async (fileId: string) => {
      try {
        const res = await fetch(`/api/files/${fileId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete');
        removeFile(fileId);
      } catch (error) {
        console.error('Failed to delete file:', error);
      }
    },
    [removeFile],
  );

  // -------------------------------------------------------------------------
  // Rename file (simplified — updates the name and path)
  // -------------------------------------------------------------------------

  const handleRename = useCallback(
    (file: ProjectFile) => {
      setRenamingFileId(file.id);
      setRenameValue(file.name);
    },
    [],
  );

  const handleRenameSubmit = useCallback(
    async () => {
      if (!renamingFileId) return;
      const trimmed = renameValue.trim();
      if (!trimmed) {
        setRenamingFileId(null);
        setRenameValue('');
        return;
      }

      // Find the file being renamed
      const file = files.find(f => f.id === renamingFileId);
      if (!file || trimmed === file.name) {
        setRenamingFileId(null);
        setRenameValue('');
        return;
      }

      const pathParts = file.path.split('/');
      pathParts[pathParts.length - 1] = trimmed;
      const newPath = pathParts.join('/');

      try {
        const res = await fetch(`/api/files/${file.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: trimmed, path: newPath }),
        });
        if (!res.ok) throw new Error('Failed to rename');
        const data = await res.json();
        updateFile(file.id, data.file);
      } catch (error) {
        console.error('Failed to rename file:', error);
      } finally {
        setRenamingFileId(null);
        setRenameValue('');
      }
    },
    [renamingFileId, renameValue, files, updateFile],
  );

  const handleRenameCancel = useCallback(() => {
    setRenamingFileId(null);
    setRenameValue('');
  }, []);

  const handleRenameValueChange = useCallback((value: string) => {
    setRenameValue(value);
  }, []);

  // -------------------------------------------------------------------------
  // Create in folder (from context menu)
  // -------------------------------------------------------------------------

  const handleCreateInFolder = useCallback(
    (parentPath: string, mode: 'file' | 'folder') => {
      handleStartCreation(mode, parentPath);
    },
    [handleStartCreation],
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const isEmpty = filteredFiles.length === 0 && !creationMode;

  return (
    <div className="flex h-full flex-col bg-zinc-900/95 text-zinc-100">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
        <span className="text-[11px] font-semibold tracking-wider text-zinc-500">
          EXPLORER
        </span>

        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-6 text-zinc-500 hover:text-zinc-200"
                onClick={() => handleStartCreation('file')}
                disabled={isCreating || !currentProject}
              >
                <Plus className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              New File
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-6 text-zinc-500 hover:text-zinc-200"
                onClick={() => handleStartCreation('folder')}
                disabled={isCreating || !currentProject}
              >
                <FolderPlus className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              New Folder
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-6 text-zinc-500 hover:text-zinc-200"
                onClick={fetchFiles}
                disabled={isLoading}
              >
                <RefreshCw
                  className={`size-3.5 ${isLoading ? 'animate-spin' : ''}`}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              Refresh
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* File Search */}
      {files.length > 4 && (
        <div className="px-2 pb-1">
          <div className="flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1">
            <Search className="size-3 text-zinc-500" />
            <input
              value={fileSearch}
              onChange={(e) => setFileSearch(e.target.value)}
              placeholder="Search files..."
              className="flex-1 bg-transparent text-xs text-zinc-300 placeholder:text-zinc-600 outline-none"
              onKeyDown={(e) => { if (e.key === 'Escape') setFileSearch(''); }}
            />
            {fileSearch && (
              <button onClick={() => setFileSearch('')} className="text-zinc-500 hover:text-zinc-300">
                <X className="size-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* File Tree */}
      <ScrollArea className="flex-1">
        <div className="py-1">
          {isEmpty ? (
            <EmptyState />
          ) : (
            <>
              {/* Top-level creation input (when no parent folder) */}
              <AnimatePresence>
                {creationMode && !creationParentPath && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <InlineCreationInput
                      mode={creationMode}
                      parentPath={creationParentPath}
                      onConfirm={handleConfirmCreation}
                      onCancel={handleCancelCreation}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Tree nodes */}
              {tree.map((node) => (
                <TreeNodeItem
                  key={node.path}
                  node={node}
                  depth={0}
                  currentFile={currentFile}
                  expandedFolders={expandedFolders}
                  renamingFileId={renamingFileId}
                  renameValue={renameValue}
                  onToggleFolder={handleToggleFolder}
                  onSelectFile={handleSelectFile}
                  onRename={handleRename}
                  onDelete={handleDelete}
                  onCreateInFolder={handleCreateInFolder}
                  onRenameValueChange={handleRenameValueChange}
                  onRenameSubmit={handleRenameSubmit}
                  onRenameCancel={handleRenameCancel}
                />
              ))}

              {/* Nested creation input (inside a folder, rendered at the end of the tree) */}
              <AnimatePresence>
                {creationMode && creationParentPath && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <InlineCreationInput
                      mode={creationMode}
                      parentPath={creationParentPath}
                      onConfirm={handleConfirmCreation}
                      onCancel={handleCancelCreation}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}

          {/* Loading indicator */}
          {isLoading && files.length > 0 && (
            <div className="flex items-center justify-center gap-2 py-4 text-xs text-zinc-500">
              <Loader2 className="size-3 animate-spin" />
              Loading...
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer info */}
      {!currentProject && (
        <div className="border-t border-zinc-800 px-3 py-2 text-center text-[11px] text-zinc-600">
          No project selected
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent className="border-zinc-700 bg-zinc-900">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-zinc-100">Delete File?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              Are you sure you want to delete <span className="font-medium text-zinc-200">{deleteConfirm?.fileName}</span>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-zinc-700 bg-zinc-800 text-zinc-300">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-500"
              onClick={() => {
                if (deleteConfirm) performDelete(deleteConfirm.fileId);
                setDeleteConfirm(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
