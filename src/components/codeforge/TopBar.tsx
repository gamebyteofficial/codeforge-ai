'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap,
  Settings,
  ChevronDown,
  Plus,
  FolderOpen,
  Sparkles,
  Trash2,
} from 'lucide-react';

import { useAppStore, type Project } from '@/store';
import { useProjectState, useUIState, useChatState, useTaskState, useStore } from '@/store/hooks';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function TopBar() {
  const currentProject = useProjectState(s => s.currentProject);
  const projects = useProjectState(s => s.projects);
  const setCurrentProject = useProjectState(s => s.setCurrentProject);
  const setProjects = useProjectState(s => s.setProjects);
  const removeProject = useProjectState(s => s.removeProject);
  const areProjectsLoaded = useStore(s => s.areProjectsLoaded);
  const setAreProjectsLoaded = useStore(s => s.setAreProjectsLoaded);
  const setIsSettingsOpen = useUIState(s => s.setIsSettingsOpen);
  const isChatLoading = useChatState(s => s.isChatLoading);
  const currentConversation = useChatState(s => s.currentConversation);
  const tasks = useTaskState(s => s.tasks);

  const [newProjectDialog, setNewProjectDialog] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectLanguage, setNewProjectLanguage] = useState('typescript');
  const [newProjectFramework, setNewProjectFramework] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Delete project state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch projects only if not already loaded by page.tsx
  useEffect(() => {
    if (areProjectsLoaded) return;
    const fetchProjects = async () => {
      try {
        const res = await fetch('/api/projects');
        if (res.ok) {
          const data = await res.json();
          setProjects(data.projects ?? []);
          // Auto-select first project
          if (data.projects?.length > 0 && !useAppStore.getState().currentProject) {
            setCurrentProject(data.projects[0]);
          }
          setAreProjectsLoaded(true);
        } else {
          setAreProjectsLoaded(true);
        }
      } catch (error) {
        console.error('Failed to fetch projects:', error);
        setAreProjectsLoaded(true);
      }
    };
    fetchProjects();
  }, [areProjectsLoaded, setProjects, setCurrentProject, setAreProjectsLoaded]);

  const handleCreateProject = useCallback(async () => {
    if (!newProjectName.trim()) return;
    setIsCreating(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newProjectName.trim(),
          language: newProjectLanguage,
          framework: newProjectFramework || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setProjects([data.project, ...projects]);
        setCurrentProject(data.project);
        setNewProjectDialog(false);
        setNewProjectName('');
        setNewProjectFramework('');
      }
    } catch (error) {
      console.error('Failed to create project:', error);
    } finally {
      setIsCreating(false);
    }
  }, [newProjectName, newProjectLanguage, newProjectFramework, projects, setProjects, setCurrentProject]);

  const handleDeleteProject = useCallback(async () => {
    if (!projectToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/projects/${projectToDelete.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        removeProject(projectToDelete.id);
        // If we deleted the current project, switch to the first available one
        const remaining = projects.filter(p => p.id !== projectToDelete.id);
        if (currentProject?.id === projectToDelete.id) {
          setCurrentProject(remaining.length > 0 ? remaining[0] : null);
        }
        setDeleteDialogOpen(false);
        setProjectToDelete(null);
      } else {
        console.error('Failed to delete project');
      }
    } catch (error) {
      console.error('Failed to delete project:', error);
    } finally {
      setIsDeleting(false);
    }
  }, [projectToDelete, currentProject, projects, removeProject, setCurrentProject]);

  const openDeleteDialog = useCallback((e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    setProjectToDelete(project);
    setDeleteDialogOpen(true);
  }, []);

  const runningTasks = useMemo(() => tasks.filter(t => t.status === 'running'), [tasks]);

  return (
    <>
      <header className="flex h-11 items-center justify-between border-b border-zinc-800 bg-zinc-900/95 px-3 backdrop-blur-sm">
        {/* Left section: Branding + Project selector */}
        <div className="flex items-center gap-3">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-md bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-lg shadow-emerald-500/20">
              <Zap className="size-4 text-white" />
            </div>
            <span className="text-sm font-bold text-zinc-100 tracking-tight">
              Waziros <span className="text-emerald-400">AI</span>
            </span>
          </div>

          {/* Separator */}
          <div className="h-5 w-px bg-zinc-800" />

          {/* Project selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 rounded-md border border-zinc-800 bg-zinc-800/40 px-2.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
              >
                <FolderOpen className="size-3.5 text-emerald-400" />
                <span className="max-w-[140px] truncate">
                  {currentProject?.name ?? 'Select Project'}
                </span>
                <ChevronDown className="size-3 text-zinc-500" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-64 border-zinc-700 bg-zinc-800 text-zinc-200"
            >
              {projects.length > 0 ? (
                projects.map((project) => (
                  <div
                    key={project.id}
                    className={`group flex items-center gap-2 rounded-sm px-2 py-1.5 text-xs cursor-pointer ${
                      currentProject?.id === project.id
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100'
                    }`}
                    onClick={() => setCurrentProject(project)}
                  >
                    <FolderOpen className="size-3.5 shrink-0" />
                    <span className="truncate flex-1">{project.name}</span>
                    <span className="text-[10px] text-zinc-500">
                      {project.language}
                    </span>
                    <button
                      type="button"
                      className="size-5 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                      onClick={(e) => openDeleteDialog(e, project)}
                      aria-label={`Delete ${project.name}`}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))
              ) : (
                <div className="px-2 py-1.5 text-xs text-zinc-500">
                  No projects yet
                </div>
              )}
              <DropdownMenuSeparator className="bg-zinc-700" />
              <DropdownMenuItem
                onClick={() => setNewProjectDialog(true)}
                className="text-xs text-emerald-400 focus:bg-emerald-500/10 focus:text-emerald-400"
              >
                <Plus className="mr-2 size-3.5" />
                New Project
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Right section: Status indicators + Settings */}
        <div className="flex items-center gap-2">
          {/* Running tasks indicator */}
          <AnimatePresence>
            {runningTasks.length > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2 py-1"
              >
                <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
                <span className="text-[11px] font-medium text-emerald-400">
                  {runningTasks.length} running
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* AI status */}
          {isChatLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2 py-1"
            >
              <Sparkles className="size-3 animate-pulse text-emerald-400" />
              <span className="text-[11px] font-medium text-emerald-400">
                Thinking...
              </span>
            </motion.div>
          )}



          {/* Settings button */}
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-zinc-500 hover:text-zinc-200"
            onClick={() => setIsSettingsOpen(true)}
          >
            <Settings className="size-4" />
          </Button>
        </div>
      </header>

      {/* New Project Dialog */}
      <Dialog open={newProjectDialog} onOpenChange={setNewProjectDialog}>
        <DialogContent className="border-zinc-700 bg-zinc-900 text-zinc-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">New Project</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div>
              <Label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                Project Name
              </Label>
              <Input
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="my-awesome-project"
                className="border-zinc-700 bg-zinc-800 text-sm text-zinc-100 placeholder:text-zinc-600 focus-visible:border-emerald-500/50 focus-visible:ring-emerald-500/20"
                autoFocus
              />
            </div>

            <div>
              <Label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                Language
              </Label>
              <Select value={newProjectLanguage} onValueChange={setNewProjectLanguage}>
                <SelectTrigger className="border-zinc-700 bg-zinc-800 text-sm text-zinc-100 focus:ring-emerald-500/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-zinc-700 bg-zinc-800 text-zinc-200">
                  <SelectItem value="typescript" className="text-xs focus:bg-zinc-700 focus:text-zinc-100">TypeScript</SelectItem>
                  <SelectItem value="javascript" className="text-xs focus:bg-zinc-700 focus:text-zinc-100">JavaScript</SelectItem>
                  <SelectItem value="python" className="text-xs focus:bg-zinc-700 focus:text-zinc-100">Python</SelectItem>
                  <SelectItem value="rust" className="text-xs focus:bg-zinc-700 focus:text-zinc-100">Rust</SelectItem>
                  <SelectItem value="go" className="text-xs focus:bg-zinc-700 focus:text-zinc-100">Go</SelectItem>
                  <SelectItem value="java" className="text-xs focus:bg-zinc-700 focus:text-zinc-100">Java</SelectItem>
                  <SelectItem value="csharp" className="text-xs focus:bg-zinc-700 focus:text-zinc-100">C#</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                Framework (optional)
              </Label>
              <Input
                value={newProjectFramework}
                onChange={(e) => setNewProjectFramework(e.target.value)}
                placeholder="nextjs, react, express, etc."
                className="border-zinc-700 bg-zinc-800 text-sm text-zinc-100 placeholder:text-zinc-600 focus-visible:border-emerald-500/50 focus-visible:ring-emerald-500/20"
              />
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
              onClick={handleCreateProject}
              disabled={!newProjectName.trim() || isCreating}
              className="bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {isCreating ? 'Creating...' : 'Create Project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Project Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="border-zinc-700 bg-zinc-900 text-zinc-100">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-zinc-100">Delete Project</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              Are you sure you want to delete <span className="font-semibold text-zinc-200">&quot;{projectToDelete?.name}&quot;</span>?
              This will permanently delete all files, conversations, tasks, and memories associated with this project. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProject}
              disabled={isDeleting}
              className="bg-red-600 text-white hover:bg-red-500 disabled:opacity-50"
            >
              {isDeleting ? 'Deleting...' : 'Delete Project'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
