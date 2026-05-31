'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  Plus,
  Trash2,
  FolderTree,
  User,
  GitBranch,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Loader2,
  Clock,
  Search,
} from 'lucide-react';
import { useAppStore, type Memory } from '@/store';
import { useMemoryState, useProjectState } from '@/store/hooks';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type MemoryType = 'short_term' | 'long_term';
type FilterType = 'all' | 'short_term' | 'long_term';

const CATEGORY_CONFIG: Record<
  string,
  { icon: typeof Brain; color: string; label: string }
> = {
  project_structure: {
    icon: FolderTree,
    color: 'text-zinc-400',
    label: 'Project Structure',
  },
  user_preference: {
    icon: User,
    color: 'text-purple-400',
    label: 'User Preference',
  },
  decision: {
    icon: GitBranch,
    color: 'text-amber-400',
    label: 'Decision',
  },
  completed_task: {
    icon: CheckCircle,
    color: 'text-emerald-400',
    label: 'Completed Task',
  },
  context: {
    icon: Brain,
    color: 'text-sky-400',
    label: 'Context',
  },
};

function getCategoryConfig(category?: string) {
  if (!category) return null;
  return CATEGORY_CONFIG[category] ?? null;
}

// ---------------------------------------------------------------------------
// Empty State
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
        <Brain className="size-5 text-zinc-500" />
      </div>
      <div>
        <p className="text-sm font-medium text-zinc-400">No memories stored</p>
        <p className="mt-1 text-xs text-zinc-600">
          AI memories and context will appear here
        </p>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Memory Entry
// ---------------------------------------------------------------------------

function MemoryEntry({
  memory,
  onDelete,
  isDeleting,
}: {
  memory: Memory;
  onDelete: (id: string) => void;
  isDeleting: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isLong = memory.value.length > 120;
  const truncatedValue = isLong ? memory.value.slice(0, 120) + '...' : memory.value;
  const catConfig = getCategoryConfig(memory.category);
  const CatIcon = catConfig?.icon;

  const typeColor =
    memory.type === 'short_term'
      ? 'bg-amber-500/15 text-amber-400 border-amber-500/25'
      : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25';

  const typeLabel =
    memory.type === 'short_term' ? 'Short-term' : 'Long-term';

  const timeAgo = useMemo(() => {
    const diff = Date.now() - new Date(memory.createdAt).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }, [memory.createdAt]);

  return (
    <div className="group rounded-md border border-zinc-800/60 bg-zinc-900/40 px-3 py-2 transition-colors hover:border-zinc-700/60 hover:bg-zinc-800/40">
      {/* Top row: badges + delete */}
      <div className="flex items-center gap-1.5">
        <Badge
          variant="outline"
          className={`shrink-0 border px-1.5 py-0 text-[10px] font-medium ${typeColor}`}
        >
          {typeLabel}
        </Badge>

        {catConfig && CatIcon && (
          <Badge
            variant="outline"
            className={`shrink-0 gap-1 border-zinc-700/50 bg-zinc-800/50 px-1.5 py-0 text-[10px] font-medium ${catConfig.color}`}
          >
            <CatIcon className="size-2.5" />
            {catConfig.label}
          </Badge>
        )}

        <span className="min-w-0 flex-1 truncate text-xs font-medium text-zinc-200">
          {memory.key}
        </span>

        <span className="flex shrink-0 items-center gap-1 text-[10px] text-zinc-600">
          <Clock className="size-2.5" />
          {timeAgo}
        </span>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-5 shrink-0 text-zinc-600 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
              onClick={() => onDelete(memory.id)}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Trash2 className="size-3" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left" className="text-xs">
            Delete memory
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Value */}
      <div className="mt-1.5">
        <p className="whitespace-pre-wrap break-words text-[11px] leading-relaxed text-zinc-400">
          {isExpanded ? memory.value : truncatedValue}
        </p>
        {isLong && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="mt-1 text-[10px] font-medium text-emerald-500/80 transition-colors hover:text-emerald-400"
          >
            {isExpanded ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Category Group
// ---------------------------------------------------------------------------

function CategoryGroup({
  category,
  memories,
  onDelete,
  deletingId,
}: {
  category: string;
  memories: Memory[];
  onDelete: (id: string) => void;
  deletingId: string | null;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const catConfig = getCategoryConfig(category);
  const CatIcon = catConfig?.icon;
  const iconColor = catConfig?.color ?? 'text-zinc-400';
  const label = catConfig?.label ?? category;

  return (
    <div>
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="flex w-full items-center gap-1.5 px-1 py-1.5 text-left transition-colors hover:text-zinc-200"
      >
        {isCollapsed ? (
          <ChevronRight className="size-3 shrink-0 text-zinc-600" />
        ) : (
          <ChevronDown className="size-3 shrink-0 text-zinc-600" />
        )}
        {CatIcon && <CatIcon className={`size-3 shrink-0 ${iconColor}`} />}
        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
          {label}
        </span>
        <span className="ml-auto text-[10px] text-zinc-600">
          {memories.length}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-1.5 pl-2">
              {memories.map((m) => (
                <MemoryEntry
                  key={m.id}
                  memory={m}
                  onDelete={onDelete}
                  isDeleting={deletingId === m.id}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add Memory Dialog
// ---------------------------------------------------------------------------

function AddMemoryDialog({
  open,
  onOpenChange,
  onSave,
  isSaving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: {
    type: MemoryType;
    category: string;
    key: string;
    value: string;
  }) => void;
  isSaving: boolean;
}) {
  const [type, setType] = useState<MemoryType>('short_term');
  const [category, setCategory] = useState('');
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');

  const handleSave = () => {
    if (!key.trim() || !value.trim()) return;
    onSave({
      type,
      category: category.trim(),
      key: key.trim(),
      value: value.trim(),
    });
  };

  const resetForm = () => {
    setType('short_term');
    setCategory('');
    setKey('');
    setValue('');
  };

  // Reset when dialog closes
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) resetForm();
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="border-zinc-700 bg-zinc-900 text-zinc-100 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">Add Memory</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Store a new memory for the AI agent to reference.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Type selector */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-zinc-400">Type</Label>
            <Select
              value={type}
              onValueChange={(v) => setType(v as MemoryType)}
            >
              <SelectTrigger className="border-zinc-700 bg-zinc-800 text-zinc-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-zinc-700 bg-zinc-800 text-zinc-200">
                <SelectItem value="short_term" className="text-zinc-200 focus:bg-zinc-700 focus:text-zinc-100">
                  Short-term
                </SelectItem>
                <SelectItem value="long_term" className="text-zinc-200 focus:bg-zinc-700 focus:text-zinc-100">
                  Long-term
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Category */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-zinc-400">Category</Label>
            <Select
              value={category}
              onValueChange={setCategory}
            >
              <SelectTrigger className="border-zinc-700 bg-zinc-800 text-zinc-200">
                <SelectValue placeholder="Select or leave empty" />
              </SelectTrigger>
              <SelectContent className="border-zinc-700 bg-zinc-800 text-zinc-200">
                {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => {
                  const Icon = cfg.icon;
                  return (
                    <SelectItem
                      key={key}
                      value={key}
                      className="text-zinc-200 focus:bg-zinc-700 focus:text-zinc-100"
                    >
                      <span className="flex items-center gap-2">
                        <Icon className={`size-3 ${cfg.color}`} />
                        {cfg.label}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Key */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-zinc-400">Key</Label>
            <Input
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="e.g., main_framework"
              className="border-zinc-700 bg-zinc-800 text-zinc-200 placeholder:text-zinc-600"
            />
          </div>

          {/* Value */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-zinc-400">Value</Label>
            <Textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Memory content..."
              rows={3}
              className="resize-none border-zinc-700 bg-zinc-800 text-zinc-200 placeholder:text-zinc-600"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            className="text-zinc-400 hover:text-zinc-200"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!key.trim() || !value.trim() || isSaving}
            className="bg-emerald-600 text-white hover:bg-emerald-500"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Memory'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Filter tabs
// ---------------------------------------------------------------------------

const FILTER_OPTIONS: { value: FilterType; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'short_term', label: 'Short-term' },
  { value: 'long_term', label: 'Long-term' },
];

function FilterBar({
  active,
  onChange,
  counts,
}: {
  active: FilterType;
  onChange: (f: FilterType) => void;
  counts: { all: number; short_term: number; long_term: number };
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-md bg-zinc-800/50 p-0.5">
      {FILTER_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`rounded-sm px-2 py-0.5 text-[10px] font-medium transition-colors ${
            active === opt.value
              ? 'bg-zinc-700 text-zinc-100'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          {opt.label}
          <span className="ml-1 text-zinc-600">{counts[opt.value]}</span>
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MemoryViewer (main export)
// ---------------------------------------------------------------------------

export default function MemoryViewer() {
  const memories = useMemoryState(s => s.memories);
  const setMemories = useMemoryState(s => s.setMemories);
  const addMemory = useMemoryState(s => s.addMemory);
  const currentProject = useProjectState(s => s.currentProject);

  const [filter, setFilter] = useState<FilterType>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // -------------------------------------------------------------------------
  // Fetch memories
  // -------------------------------------------------------------------------

  const fetchMemories = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (currentProject?.id) params.set('projectId', currentProject.id);
      const res = await fetch(`/api/memory?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch memories');
      const data = await res.json();
      setMemories(data.memories ?? []);
    } catch (error) {
      console.error('Failed to fetch memories:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentProject, setMemories]);

  // Load on mount
  useEffect(() => {
    fetchMemories();
  }, [fetchMemories]);

  // -------------------------------------------------------------------------
  // Create memory
  // -------------------------------------------------------------------------

  const handleCreate = useCallback(
    async (data: {
      type: MemoryType;
      category: string;
      key: string;
      value: string;
    }) => {
      setIsSaving(true);
      try {
        const res = await fetch('/api/memory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...data,
            projectId: currentProject?.id ?? null,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          console.error('Failed to create memory:', err.error);
          return;
        }
        const result = await res.json();
        addMemory(result.memory);
        setDialogOpen(false);
      } catch (error) {
        console.error('Failed to create memory:', error);
      } finally {
        setIsSaving(false);
      }
    },
    [currentProject, addMemory],
  );

  // -------------------------------------------------------------------------
  // Delete memory
  // -------------------------------------------------------------------------

  const handleDelete = useCallback(
    async (id: string) => {
      setDeletingId(id);
      try {
        const res = await fetch(`/api/memory?id=${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete memory');
        // Remove from store
        setMemories(memories.filter((m) => m.id !== id));
      } catch (error) {
        console.error('Failed to delete memory:', error);
      } finally {
        setDeletingId(null);
      }
    },
    [memories, setMemories],
  );

  // -------------------------------------------------------------------------
  // Filtered & grouped memories
  // -------------------------------------------------------------------------

  const filteredMemories = useMemo(() => {
    if (filter === 'all') return memories;
    return memories.filter((m) => m.type === filter);
  }, [memories, filter]);

  const counts = useMemo(
    () => ({
      all: memories.length,
      short_term: memories.filter((m) => m.type === 'short_term').length,
      long_term: memories.filter((m) => m.type === 'long_term').length,
    }),
    [memories],
  );

  // Group by category: categorized memories first, then uncategorized
  const groupedMemories = useMemo(() => {
    const groups: Record<string, Memory[]> = {};
    const ungrouped: Memory[] = [];

    for (const m of filteredMemories) {
      if (m.category) {
        if (!groups[m.category]) groups[m.category] = [];
        groups[m.category].push(m);
      } else {
        ungrouped.push(m);
      }
    }

    // Sort within each group by createdAt descending
    for (const key of Object.keys(groups)) {
      groups[key].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    }
    ungrouped.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return { groups, ungrouped };
  }, [filteredMemories]);

  const isEmpty = filteredMemories.length === 0;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="flex h-full flex-col bg-zinc-900/95 text-zinc-100">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
        <span className="text-[11px] font-semibold tracking-wider text-zinc-500">
          MEMORY
        </span>

        <div className="flex items-center gap-1.5">
          <FilterBar active={filter} onChange={setFilter} counts={counts} />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-6 text-zinc-500 hover:text-zinc-200"
                onClick={() => setDialogOpen(true)}
              >
                <Plus className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              Add Memory
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Memory List */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {isEmpty && !isLoading ? (
            <EmptyState />
          ) : (
            <div className="flex flex-col gap-2">
              {/* Categorized groups */}
              {Object.entries(groupedMemories.groups).map(
                ([category, items]) => (
                  <CategoryGroup
                    key={category}
                    category={category}
                    memories={items}
                    onDelete={handleDelete}
                    deletingId={deletingId}
                  />
                ),
              )}

              {/* Uncategorized memories */}
              {groupedMemories.ungrouped.length > 0 && (
                <div>
                  {Object.keys(groupedMemories.groups).length > 0 && (
                    <div className="mb-1 flex items-center gap-1.5 px-1 py-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                        Other
                      </span>
                      <span className="text-[10px] text-zinc-600">
                        {groupedMemories.ungrouped.length}
                      </span>
                    </div>
                  )}
                  <div className="flex flex-col gap-1.5 pl-2">
                    {groupedMemories.ungrouped.map((m) => (
                      <MemoryEntry
                        key={m.id}
                        memory={m}
                        onDelete={handleDelete}
                        isDeleting={deletingId === m.id}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Loading indicator */}
              {isLoading && memories.length > 0 && (
                <div className="flex items-center justify-center gap-2 py-4 text-xs text-zinc-500">
                  <Loader2 className="size-3 animate-spin" />
                  Loading...
                </div>
              )}
            </div>
          )}

          {/* Initial loading state */}
          {isLoading && memories.length === 0 && (
            <div className="flex items-center justify-center gap-2 py-8 text-xs text-zinc-500">
              <Loader2 className="size-3 animate-spin" />
              Loading memories...
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

      {/* Add Memory Dialog */}
      <AddMemoryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={handleCreate}
        isSaving={isSaving}
      />
    </div>
  );
}
