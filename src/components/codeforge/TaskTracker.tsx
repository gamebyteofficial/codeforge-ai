'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  Code,
  Bug,
  Search,
  FileText,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Loader2,
  Clock,
  X,
} from 'lucide-react';
import { useAppStore, type Task } from '@/store';
import { useTaskState, useProjectState } from '@/store/hooks';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// ---------------------------------------------------------------------------
// Constants & helpers
// ---------------------------------------------------------------------------

type TaskStatus = Task['status'];
type AgentType = 'planner' | 'coder' | 'debugger' | 'reviewer' | 'documenter';
type FilterKey = 'all' | TaskStatus;

const FILTER_OPTIONS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'running', label: 'Running' },
  { key: 'completed', label: 'Completed' },
  { key: 'failed', label: 'Failed' },
];

const AGENT_CONFIG: Record<
  AgentType,
  { icon: typeof Brain; label: string; color: string; bgClass: string }
> = {
  planner: {
    icon: Brain,
    label: 'Planner',
    color: 'text-purple-400',
    bgClass: 'bg-purple-500/20',
  },
  coder: {
    icon: Code,
    label: 'Coder',
    color: 'text-emerald-400',
    bgClass: 'bg-emerald-500/20',
  },
  debugger: {
    icon: Bug,
    label: 'Debugger',
    color: 'text-red-400',
    bgClass: 'bg-red-500/20',
  },
  reviewer: {
    icon: Search,
    label: 'Reviewer',
    color: 'text-amber-400',
    bgClass: 'bg-amber-500/20',
  },
  documenter: {
    icon: FileText,
    label: 'Documenter',
    color: 'text-sky-400',
    bgClass: 'bg-sky-500/20',
  },
};

const STATUS_CONFIG: Record<
  TaskStatus,
  { label: string; badgeClass: string; dotClass: string }
> = {
  pending: {
    label: 'Pending',
    badgeClass: 'bg-zinc-700/60 text-zinc-300 border-zinc-600/50',
    dotClass: 'bg-zinc-400',
  },
  running: {
    label: 'Running',
    badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    dotClass: 'bg-emerald-400 animate-pulse',
  },
  completed: {
    label: 'Completed',
    badgeClass: 'bg-green-500/15 text-green-400 border-green-500/30',
    dotClass: 'bg-green-400',
  },
  failed: {
    label: 'Failed',
    badgeClass: 'bg-red-500/15 text-red-400 border-red-500/30',
    dotClass: 'bg-red-400',
  },
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  if (diffMs < 0) return 'just now';
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

function getAgentConfig(agent?: string) {
  if (!agent) return null;
  return AGENT_CONFIG[agent as AgentType] ?? null;
}

// ---------------------------------------------------------------------------
// TaskItem component
// ---------------------------------------------------------------------------

function TaskItem({
  task,
  isExpanded,
  onToggle,
  onDelete,
  deleting,
}: {
  task: Task;
  isExpanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const agentCfg = getAgentConfig(task.agent);
  const statusCfg = STATUS_CONFIG[task.status];
  const AgentIcon = agentCfg?.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4, transition: { duration: 0.15 } }}
      transition={{ duration: 0.2 }}
      className="group border-b border-zinc-800/60 last:border-b-0"
    >
      {/* Main row */}
      <button
        onClick={onToggle}
        className="flex w-full items-start gap-2 px-3 py-2.5 text-left transition-colors hover:bg-zinc-800/50"
      >
        {/* Expand chevron */}
        <span className="mt-0.5 shrink-0">
          {isExpanded ? (
            <ChevronDown className="size-3 text-zinc-500" />
          ) : (
            <ChevronRight className="size-3 text-zinc-500" />
          )}
        </span>

        {/* Agent icon */}
        {AgentIcon ? (
          <span
            className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded ${agentCfg.bgClass}`}
          >
            <AgentIcon className={`size-3 ${agentCfg.color}`} />
          </span>
        ) : (
          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded bg-zinc-700/40">
            <ClipboardList className="size-3 text-zinc-500" />
          </span>
        )}

        {/* Title + metadata */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-xs font-medium text-zinc-200">
              {task.title}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            {/* Status badge */}
            <Badge
              variant="outline"
              className={`gap-1 border px-1.5 py-0 text-[10px] font-medium ${statusCfg.badgeClass}`}
            >
              <span className={`size-1.5 rounded-full ${statusCfg.dotClass}`} />
              {statusCfg.label}
            </Badge>

            {/* Time */}
            <span className="flex items-center gap-0.5 text-[10px] text-zinc-500">
              <Clock className="size-2.5" />
              {timeAgo(task.createdAt)}
            </span>
          </div>

          {/* Progress bar for running tasks */}
          {task.status === 'running' && (
            <div className="mt-1.5">
              <Progress
                value={task.progress}
                className="h-1 bg-zinc-800 [&>div]:bg-emerald-500"
              />
              <span className="mt-0.5 text-[10px] text-zinc-500">
                {task.progress}%
              </span>
            </div>
          )}
        </div>

        {/* Delete button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-6 shrink-0 text-zinc-600 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              disabled={deleting}
            >
              {deleting ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Trash2 className="size-3" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left" className="text-xs">
            Delete task
          </TooltipContent>
        </Tooltip>
      </button>

      {/* Collapsible details */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pl-10">
              {/* Description */}
              {task.description && (
                <p className="mb-2 text-[11px] leading-relaxed text-zinc-400">
                  {task.description}
                </p>
              )}

              {/* Result */}
              {task.result && (
                <div className="mb-2 rounded-md border border-zinc-800 bg-zinc-900/60 px-2.5 py-2">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                    Result
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-zinc-300">
                    {task.result}
                  </p>
                </div>
              )}

              {/* Agent info */}
              {agentCfg && (
                <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                  <AgentIcon className={`size-3 ${agentCfg.color}`} />
                  <span>{agentCfg.label} agent</span>
                </div>
              )}

              {/* Progress for non-running tasks that have progress */}
              {task.status !== 'running' && task.progress > 0 && (
                <div className="mt-2">
                  <Progress
                    value={task.progress}
                    className="h-1 bg-zinc-800 [&>div]:bg-zinc-500"
                  />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// EmptyState
// ---------------------------------------------------------------------------

function EmptyState({ filter }: { filter: FilterKey }) {
  if (filter !== 'all') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center"
      >
        <div className="flex size-12 items-center justify-center rounded-xl bg-zinc-800/80 ring-1 ring-zinc-700/50">
          <ClipboardList className="size-5 text-zinc-500" />
        </div>
        <div>
          <p className="text-sm font-medium text-zinc-400">
            No {filter} tasks
          </p>
          <p className="mt-1 text-xs text-zinc-600">
            {filter === 'running'
              ? 'No tasks are currently running'
              : `No tasks with "${filter}" status`}
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center"
    >
      <div className="flex size-12 items-center justify-center rounded-xl bg-zinc-800/80 ring-1 ring-zinc-700/50">
        <ClipboardList className="size-5 text-zinc-500" />
      </div>
      <div>
        <p className="text-sm font-medium text-zinc-400">No tasks yet</p>
        <p className="mt-1 text-xs text-zinc-600">
          Tasks will appear here when AI starts working
        </p>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// NewTaskDialog
// ---------------------------------------------------------------------------

function NewTaskDialog({
  open,
  onOpenChange,
  onSubmit,
  isCreating,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    title: string;
    description: string;
    agent: string;
  }) => void;
  isCreating: boolean;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [agent, setAgent] = useState<string>('');

  const handleSubmit = () => {
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      description: description.trim(),
      agent,
    });
  };

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      setTitle('');
      setDescription('');
      setAgent('');
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="border-zinc-700 bg-zinc-900 text-zinc-100 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">New Task</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {/* Title */}
          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-zinc-400">
              Title
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title..."
              className="border-zinc-700 bg-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-600 focus-visible:border-emerald-500/50 focus-visible:ring-emerald-500/20"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-zinc-400">
              Description
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this task should do..."
              rows={3}
              className="min-h-[72px] resize-none border-zinc-700 bg-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-600 focus-visible:border-emerald-500/50 focus-visible:ring-emerald-500/20"
            />
          </div>

          {/* Agent type selector */}
          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-zinc-400">
              Agent Type
            </label>
            <Select value={agent} onValueChange={setAgent}>
              <SelectTrigger className="w-full border-zinc-700 bg-zinc-800 text-xs text-zinc-100 focus:ring-emerald-500/20">
                <SelectValue placeholder="Select agent..." />
              </SelectTrigger>
              <SelectContent className="border-zinc-700 bg-zinc-800 text-zinc-200">
                {(Object.keys(AGENT_CONFIG) as AgentType[]).map((key) => {
                  const cfg = AGENT_CONFIG[key];
                  const Icon = cfg.icon;
                  return (
                    <SelectItem
                      key={key}
                      value={key}
                      className="text-xs focus:bg-zinc-700 focus:text-zinc-100"
                    >
                      <span className="flex items-center gap-2">
                        <Icon className={`size-3.5 ${cfg.color}`} />
                        {cfg.label}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button
              variant="ghost"
              size="sm"
              className="text-zinc-400 hover:text-zinc-200"
            >
              Cancel
            </Button>
          </DialogClose>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!title.trim() || isCreating}
            className="bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {isCreating ? (
              <>
                <Loader2 className="mr-1.5 size-3 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="mr-1.5 size-3" />
                Create Task
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// TaskTracker (main export)
// ---------------------------------------------------------------------------

export default function TaskTracker() {
  const tasks = useTaskState(s => s.tasks);
  const currentProject = useProjectState(s => s.currentProject);
  const setTasks = useTaskState(s => s.setTasks);
  const addTask = useTaskState(s => s.addTask);
  const updateTask = useTaskState(s => s.updateTask);
  const removeTask = useTaskState(s => s.removeTask);

  const [filter, setFilter] = useState<FilterKey>('all');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  // -------------------------------------------------------------------------
  // Fetch tasks on mount / project change
  // -------------------------------------------------------------------------

  const fetchTasks = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (currentProject) params.set('projectId', currentProject.id);
      const res = await fetch(`/api/tasks?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch tasks');
      const data = await res.json();
      setTasks(data.tasks ?? []);
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentProject, setTasks]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // -------------------------------------------------------------------------
  // Refresh time display every 30 seconds
  // -------------------------------------------------------------------------

  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  // -------------------------------------------------------------------------
  // Filtered tasks
  // -------------------------------------------------------------------------

  const filteredTasks = useMemo(() => {
    if (filter === 'all') return tasks;
    return tasks.filter((t) => t.status === filter);
  }, [tasks, filter]);

  // -------------------------------------------------------------------------
  // Toggle expand
  // -------------------------------------------------------------------------

  const handleToggle = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // -------------------------------------------------------------------------
  // Create task
  // -------------------------------------------------------------------------

  const handleCreateTask = useCallback(
    async (data: { title: string; description: string; agent: string }) => {
      setIsCreating(true);
      try {
        const res = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: data.title,
            description: data.description || undefined,
            agent: data.agent || undefined,
            projectId: currentProject?.id || undefined,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to create task');
        }
        const result = await res.json();
        addTask(result.task);
        setDialogOpen(false);
      } catch (error) {
        console.error('Failed to create task:', error);
      } finally {
        setIsCreating(false);
      }
    },
    [currentProject, addTask],
  );

  // -------------------------------------------------------------------------
  // Delete task
  // -------------------------------------------------------------------------

  const handleDeleteTask = useCallback(
    async (id: string) => {
      setDeletingIds((prev) => new Set(prev).add(id));
      try {
        const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete task');
        removeTask(id);
      } catch (error) {
        console.error('Failed to delete task:', error);
      } finally {
        setDeletingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [removeTask],
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const isEmpty = filteredTasks.length === 0;

  return (
    <div className="flex h-full flex-col bg-zinc-900/95 text-zinc-100">
      {/* Header */}
      <div className="flex flex-col gap-2 border-b border-zinc-800 px-3 py-2">
        {/* Top row: label + button */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold tracking-wider text-zinc-500">
            TASKS
          </span>

          <div className="flex items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 text-zinc-500 hover:text-emerald-400"
                  onClick={() => setDialogOpen(true)}
                >
                  <Plus className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                New Task
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-0.5 overflow-x-auto">
          {FILTER_OPTIONS.map((opt) => {
            const isActive = filter === opt.key;
            const count =
              opt.key === 'all'
                ? tasks.length
                : tasks.filter((t) => t.status === opt.key).length;

            return (
              <button
                key={opt.key}
                onClick={() => setFilter(opt.key)}
                className={`relative flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors ${
                  isActive
                    ? 'bg-zinc-800 text-zinc-100'
                    : 'text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300'
                }`}
              >
                {opt.label}
                {count > 0 && (
                  <span
                    className={`rounded-full px-1 text-[9px] ${
                      isActive
                        ? 'bg-zinc-700 text-zinc-300'
                        : 'text-zinc-600'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Task list */}
      <ScrollArea className="flex-1">
        {isLoading && tasks.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-12 text-xs text-zinc-500">
            <Loader2 className="size-3.5 animate-spin" />
            Loading tasks...
          </div>
        ) : isEmpty ? (
          <EmptyState filter={filter} />
        ) : (
          <div>
            <AnimatePresence initial={false}>
              {filteredTasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  isExpanded={expandedIds.has(task.id)}
                  onToggle={() => handleToggle(task.id)}
                  onDelete={() => handleDeleteTask(task.id)}
                  deleting={deletingIds.has(task.id)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Loading more indicator */}
        {isLoading && tasks.length > 0 && (
          <div className="flex items-center justify-center gap-2 py-3 text-xs text-zinc-500">
            <Loader2 className="size-3 animate-spin" />
            Refreshing...
          </div>
        )}
      </ScrollArea>

      {/* Footer stats */}
      {tasks.length > 0 && (
        <div className="flex items-center justify-between border-t border-zinc-800 px-3 py-1.5">
          <span className="text-[10px] text-zinc-600">
            {tasks.filter((t) => t.status === 'running').length} running &middot;{' '}
            {tasks.filter((t) => t.status === 'completed').length} completed &middot;{' '}
            {tasks.filter((t) => t.status === 'failed').length} failed
          </span>
          <span className="text-[10px] text-zinc-600">
            {tasks.length} total
          </span>
        </div>
      )}

      {/* New Task Dialog */}
      <NewTaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleCreateTask}
        isCreating={isCreating}
      />
    </div>
  );
}
