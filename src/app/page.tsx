'use client';

import { useEffect, lazy, Suspense, useState, useCallback, useRef, useMemo } from 'react';
import ChatPanel from '@/components/codeforge/ChatPanel';
import CodeEditor from '@/components/codeforge/CodeEditor';
import FileExplorer from '@/components/codeforge/FileExplorer';
import TopBar from '@/components/codeforge/TopBar';
import SettingsModal from '@/components/codeforge/SettingsModal';
import OnboardingWizard from '@/components/codeforge/OnboardingWizard';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { Button } from '@/components/ui/button';
import {
  MessageSquare,
  FolderTree,
  Brain,
  PanelLeftClose,
  PanelLeftOpen,
  ListChecks,
  Terminal as TerminalIcon,
  ChevronDown,
  ChevronUp,
  Eye,
  Wifi,
  HardDrive,
  Keyboard,
} from 'lucide-react';
import { useAppStore, type SidebarTab } from '@/store';
import { useUIState, useStore, useFileState, usePreviewState } from '@/store/hooks';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';

// --- Lazy loaded heavy components ---
const MemoryViewer = lazy(() => import('@/components/codeforge/MemoryViewer'));
const TaskTracker = lazy(() => import('@/components/codeforge/TaskTracker'));
const Terminal = lazy(() => import('@/components/codeforge/Terminal'));
const LivePreview = lazy(() => import('@/components/codeforge/LivePreview'));

// --- Skeleton fallback for lazy panels ---
function PanelSkeleton() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex flex-col items-center gap-2">
        <div className="size-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
        <span className="text-xs text-zinc-500">Loading...</span>
      </div>
    </div>
  );
}

// --- Sidebar tab definitions ---
const SIDEBAR_TABS: { value: SidebarTab; icon: typeof MessageSquare; label: string }[] = [
  { value: 'files', icon: FolderTree, label: 'Files' },
  { value: 'tasks', icon: ListChecks, label: 'Tasks' },
  { value: 'memory', icon: Brain, label: 'Memory' },
];

// --- Latency state type ---
type LatencyStatus = 'good' | 'moderate' | 'slow';

export default function Home() {
  const isSidebarOpen = useUIState(s => s.isSidebarOpen);
  const setIsSidebarOpen = useUIState(s => s.setIsSidebarOpen);
  const sidebarTab = useUIState(s => s.sidebarTab);
  const setSidebarTab = useUIState(s => s.setSidebarTab);
  const isBottomPanelOpen = useUIState(s => s.isBottomPanelOpen);
  const setIsBottomPanelOpen = useUIState(s => s.setIsBottomPanelOpen);
  const isOnboarded = useStore(s => s.isOnboarded);
  const setIsOnboarded = useStore(s => s.setIsOnboarded);
  const isPreviewOpen = usePreviewState(s => s.isPreviewOpen);
  const setIsPreviewOpen = usePreviewState(s => s.setIsPreviewOpen);
  const settings = useStore(s => s.settings);
  const setSettings = useStore(s => s.setSettings);
  const setSelectedModel = useUIState(s => s.setSelectedModel);
  const selectedModel = useUIState(s => s.selectedModel);
  // Only subscribe to file count, not the entire files array
  const fileCount = useFileState(s => s.files.length);
  const setIsSettingsOpen = useUIState(s => s.setIsSettingsOpen);

  // --- Keyboard shortcut panel state ---
  const [showShortcuts, setShowShortcuts] = useState(false);

  // --- Connection latency tracking ---
  const [latencyStatus, setLatencyStatus] = useState<LatencyStatus>('good');
  const lastLatencyRef = useRef<number>(0);

  // Measure latency periodically by pinging the settings API
  useEffect(() => {
    if (!isOnboarded) return;

    const measureLatency = async () => {
      try {
        const start = performance.now();
        const res = await fetch('/api/settings');
        const elapsed = performance.now() - start;
        lastLatencyRef.current = elapsed;

        if (elapsed < 300) setLatencyStatus('good');
        else if (elapsed < 800) setLatencyStatus('moderate');
        else setLatencyStatus('slow');
      } catch {
        setLatencyStatus('slow');
      }
    };

    measureLatency();
    const interval = setInterval(measureLatency, 15000);
    return () => clearInterval(interval);
  }, [isOnboarded]);

  // --- Memory usage tracking ---
  const [memoryUsage, setMemoryUsage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOnboarded) return;

    const updateMemory = () => {
      // performance.memory is Chrome-only
      const perf = performance as Performance & {
        memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number };
      };
      if (perf.memory) {
        const mb = (perf.memory.usedJSHeapSize / (1024 * 1024)).toFixed(0);
        setMemoryUsage(`${mb}MB`);
      }
    };

    updateMemory();
    const interval = setInterval(updateMemory, 10000);
    return () => clearInterval(interval);
  }, [isOnboarded]);

  // --- Preload components on hover ---
  const handleTabHover = useCallback((tab: SidebarTab) => {
    switch (tab) {
      case 'memory':
        import('@/components/codeforge/MemoryViewer');
        break;
      case 'tasks':
        import('@/components/codeforge/TaskTracker');
        break;
      case 'files':
        break; // Already eagerly loaded
    }
  }, []);

  // --- Keyboard shortcuts ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;

      // Escape — Close shortcuts overlay first, then preview
      if (e.key === 'Escape') {
        if (showShortcuts) {
          setShowShortcuts(false);
          return;
        }
        const state = useAppStore.getState();
        if (state.isPreviewOpen) state.setIsPreviewOpen(false);
      }

      // Ctrl/Cmd + B — Toggle sidebar
      if (isMod && e.key === 'b') {
        e.preventDefault();
        setIsSidebarOpen(!useAppStore.getState().isSidebarOpen);
      }

      // Ctrl/Cmd + J — Toggle terminal
      if (isMod && e.key === 'j') {
        e.preventDefault();
        setIsBottomPanelOpen(!useAppStore.getState().isBottomPanelOpen);
      }

      // Ctrl/Cmd + Shift + E — Focus file explorer
      if (isMod && e.shiftKey && e.key === 'E') {
        e.preventDefault();
        const state = useAppStore.getState();
        if (!state.isSidebarOpen) state.setIsSidebarOpen(true);
        state.setSidebarTab('files');
      }

      // Ctrl/Cmd + K — Show keyboard shortcuts
      if (isMod && e.key === 'k') {
        e.preventDefault();
        setShowShortcuts(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setIsSidebarOpen, setIsBottomPanelOpen, showShortcuts]);

  // --- Check if user has already completed onboarding ---
  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const res = await fetch('/api/settings');
        if (res.ok) {
          const data = await res.json();
          if (data.settings && data.settings.apiKey && data.settings.apiKey.length > 0) {
            setSettings(data.settings);
            // Sync selectedModel from saved settings
            if (data.settings.model) {
              setSelectedModel(data.settings.model);
            }
            setIsOnboarded(true);
          }
        }
      } catch {
        // If settings fetch fails, show onboarding
      }
    };
    checkOnboarding();
  }, [setIsOnboarded, setSettings, setSelectedModel]);

  // --- Ensure a default project exists for file creation ---
  useEffect(() => {
    const ensureProject = async () => {
      try {
        // Check if there's already a current project
        const { currentProject, setCurrentProject } = useAppStore.getState();
        if (currentProject) return;

        // Try to fetch existing projects
        const res = await fetch('/api/projects');
        if (res.ok) {
          const data = await res.json();
          if (data.projects && data.projects.length > 0) {
            // Use the first existing project
            setCurrentProject(data.projects[0]);
            return;
          }
        }

        // No projects exist — create a default one
        const createRes = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'My Project',
            description: 'Default project for CodeForge AI',
            language: 'typescript',
          }),
        });

        if (createRes.ok) {
          const createData = await createRes.json();
          setCurrentProject(createData.project);
        }
      } catch (error) {
        console.error('Failed to ensure default project:', error);
      }
    };
    ensureProject();
  }, [isOnboarded]);

  // --- Latency dot color (memoized) ---
  const latencyColor = useMemo(() => {
    if (latencyStatus === 'good') return 'bg-emerald-500';
    if (latencyStatus === 'moderate') return 'bg-yellow-500';
    return 'bg-red-500';
  }, [latencyStatus]);

  // --- Show onboarding wizard if not onboarded ---
  if (!isOnboarded) {
    return (
      <>
        <OnboardingWizard />
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#18181b',
              border: '1px solid #27272a',
              color: '#f4f4f5',
            },
          }}
        />
      </>
    );
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-zinc-950">
      {/* Top Navigation Bar */}
      <TopBar />

      {/* Main Content Area */}
      <div className="flex-1 min-h-0">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Left Sidebar with Icon Strip + Content */}
          {isSidebarOpen && (
            <>
              <ResizablePanel defaultSize={28} minSize={18} maxSize={45}>
                <div className="flex h-full">
                  {/* Icon strip */}
                  <div className="flex w-10 shrink-0 flex-col items-center gap-0.5 border-r border-zinc-800 bg-zinc-900 py-2">
                    {SIDEBAR_TABS.map((tab) => {
                      const Icon = tab.icon;
                      const isActive = sidebarTab === tab.value;
                      return (
                        <Tooltip key={tab.value}>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => setSidebarTab(tab.value)}
                              onMouseEnter={() => handleTabHover(tab.value)}
                              className={`flex size-8 items-center justify-center rounded-md transition-colors ${
                                isActive
                                  ? 'bg-emerald-500/15 text-emerald-400'
                                  : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'
                              }`}
                            >
                              <Icon className="size-4" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="text-xs">
                            {tab.label}
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}

                    <div className="mt-auto">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => setIsSidebarOpen(false)}
                            className="flex size-8 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
                          >
                            <PanelLeftClose className="size-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="text-xs">
                          Hide sidebar
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>

                  {/* Sidebar content — lazy loaded panels wrapped in Suspense */}
                  <div className="flex-1 min-w-0 overflow-hidden">
                    {sidebarTab === 'files' && <FileExplorer />}
                    {sidebarTab === 'tasks' && (
                      <Suspense fallback={<PanelSkeleton />}>
                        <TaskTracker />
                      </Suspense>
                    )}
                    {sidebarTab === 'memory' && (
                      <Suspense fallback={<PanelSkeleton />}>
                        <MemoryViewer />
                      </Suspense>
                    )}
                  </div>
                </div>
              </ResizablePanel>
              <ResizableHandle className="bg-zinc-800 hover:bg-emerald-500/30 transition-colors w-px" />
            </>
          )}

          {/* Main Panel: Chat + Code Editor + Preview */}
          <ResizablePanel defaultSize={isSidebarOpen ? 72 : 100} minSize={40}>
            <ResizablePanelGroup direction="vertical" className="h-full">
              {/* Top: Chat + Code Editor + Preview */}
              <ResizablePanel defaultSize={65} minSize={30}>
                <ResizablePanelGroup direction="horizontal" className="h-full">
                  {/* Chat Panel */}
                  <ResizablePanel defaultSize={40} minSize={25} maxSize={60}>
                    <ChatPanel />
                  </ResizablePanel>
                  <ResizableHandle className="bg-zinc-800 hover:bg-emerald-500/30 transition-colors w-px" />
                  {/* Code Editor */}
                  <ResizablePanel defaultSize={isPreviewOpen ? 40 : 60} minSize={30}>
                    <div className="flex h-full flex-col">
                      {/* Mini toolbar when sidebar is closed */}
                      {!isSidebarOpen && (
                        <div className="flex h-8 items-center gap-1 border-b border-zinc-800 bg-zinc-900/60 px-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-6 text-zinc-400 hover:text-white"
                                onClick={() => setIsSidebarOpen(true)}
                              >
                                <PanelLeftOpen className="size-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-xs">
                              Show sidebar
                            </TooltipContent>
                          </Tooltip>
                          <div className="h-4 w-px bg-zinc-800" />
                          <span className="text-[11px] text-zinc-600">
                            CodeForge AI
                          </span>
                        </div>
                      )}
                      <div className="flex-1 min-h-0">
                        <CodeEditor />
                      </div>
                    </div>
                  </ResizablePanel>
                  {/* Live Preview Panel — lazy loaded */}
                  {isPreviewOpen && (
                    <>
                      <ResizableHandle className="bg-zinc-800 hover:bg-emerald-500/30 transition-colors w-px" />
                      <ResizablePanel defaultSize={30} minSize={20} maxSize={50}>
                        <Suspense fallback={<PanelSkeleton />}>
                          <LivePreview />
                        </Suspense>
                      </ResizablePanel>
                    </>
                  )}
                </ResizablePanelGroup>
              </ResizablePanel>

              {/* Bottom: Terminal — lazy loaded */}
              {isBottomPanelOpen && (
                <>
                  <ResizableHandle className="bg-zinc-800 hover:bg-emerald-500/30 transition-colors h-px" />
                  <ResizablePanel defaultSize={35} minSize={15} maxSize={60}>
                    <Suspense fallback={<PanelSkeleton />}>
                      <Terminal />
                    </Suspense>
                  </ResizablePanel>
                </>
              )}
            </ResizablePanelGroup>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Bottom Status Bar */}
      <footer className="flex h-6 items-center justify-between border-t border-zinc-800 bg-zinc-900/95 px-3">
        <div className="flex items-center gap-3">
          {/* Terminal toggle */}
          <button
            onClick={() => setIsBottomPanelOpen(!isBottomPanelOpen)}
            className="flex items-center gap-1 text-[10px] text-zinc-500 transition-colors hover:text-zinc-300"
          >
            <TerminalIcon className="size-3" />
            Terminal
            {isBottomPanelOpen ? (
              <ChevronDown className="size-2.5" />
            ) : (
              <ChevronUp className="size-2.5" />
            )}
          </button>

          {/* Separator */}
          <div className="h-3 w-px bg-zinc-800" />

          {/* Preview toggle */}
          <button
            onClick={() => setIsPreviewOpen(!isPreviewOpen)}
            className={`flex items-center gap-1 text-[10px] transition-colors ${
              isPreviewOpen ? 'text-emerald-400' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Eye className="size-3" />
            Preview
            {isPreviewOpen ? (
              <ChevronDown className="size-2.5" />
            ) : (
              <ChevronUp className="size-2.5" />
            )}
          </button>

          {/* Separator */}
          <div className="h-3 w-px bg-zinc-800" />

          {/* File count */}
          <span className="flex items-center gap-1 text-[10px] text-zinc-600">
            <FolderTree className="size-3" />
            {fileCount} {fileCount === 1 ? 'file' : 'files'}
          </span>

          {/* Separator */}
          <div className="h-3 w-px bg-zinc-800" />

          {/* Project info */}
          <span className="text-[10px] text-zinc-600">
            CodeForge AI v1.0
          </span>

          {/* Model info */}
          {selectedModel && (
            <>
              <div className="h-3 w-px bg-zinc-800" />
              <span className="text-[10px] text-zinc-600 truncate max-w-[120px]">
                {selectedModel}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Memory usage */}
          {memoryUsage && (
            <span className="flex items-center gap-1 text-[10px] text-zinc-600">
              <HardDrive className="size-3" />
              {memoryUsage}
            </span>
          )}

          {/* Connection latency indicator */}
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex items-center gap-1.5 text-[10px] text-zinc-600 cursor-default">
                <Wifi className="size-3" />
                <span className={`size-1.5 rounded-full ${latencyColor} ${latencyStatus === 'good' ? 'animate-pulse' : ''}`} />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {latencyStatus === 'good' ? 'Connected' : latencyStatus === 'moderate' ? 'Slow connection' : 'Connection issues'}
              {lastLatencyRef.current > 0 && ` (${Math.round(lastLatencyRef.current)}ms)`}
            </TooltipContent>
          </Tooltip>

          {/* Keyboard shortcuts button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setShowShortcuts(!showShortcuts)}
                className="flex items-center gap-1 text-[10px] text-zinc-600 transition-colors hover:text-zinc-300"
              >
                <Keyboard className="size-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              Keyboard shortcuts
            </TooltipContent>
          </Tooltip>

          <span className="text-[10px] text-zinc-600">
            Powered by Z.ai
          </span>
        </div>
      </footer>

      {/* Keyboard Shortcuts Overlay */}
      {showShortcuts && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowShortcuts(false)}
        >
          <div
            className="mx-4 max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center gap-2">
              <Keyboard className="size-5 text-emerald-400" />
              <h3 className="text-lg font-semibold text-zinc-100">Keyboard Shortcuts</h3>
            </div>
            <div className="space-y-2">
              {[
                { keys: '⌘/Ctrl + K', desc: 'Keyboard shortcuts' },
                { keys: '⌘/Ctrl + B', desc: 'Toggle sidebar' },
                { keys: '⌘/Ctrl + J', desc: 'Toggle terminal' },
                { keys: '⌘/Ctrl + Shift + E', desc: 'Focus file explorer' },
                { keys: '⌘/Ctrl + S', desc: 'Save current file' },
                { keys: '⌘/Ctrl + Shift + P', desc: 'Open preview' },
                { keys: 'Escape', desc: 'Close preview / this panel' },
                { keys: 'Enter', desc: 'Send message' },
                { keys: 'Shift + Enter', desc: 'New line in chat' },
              ].map((shortcut) => (
                <div key={shortcut.keys} className="flex items-center justify-between gap-4">
                  <span className="text-sm text-zinc-400">{shortcut.desc}</span>
                  <kbd className="shrink-0 rounded-md border border-zinc-700 bg-zinc-800 px-2 py-0.5 font-mono text-xs text-zinc-300">
                    {shortcut.keys}
                  </kbd>
                </div>
              ))}
            </div>
            <p className="mt-4 text-center text-[11px] text-zinc-600">
              Press <kbd className="rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px]">Escape</kbd> to close
            </p>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      <SettingsModal />

      {/* Sonner Toaster */}
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#18181b',
            border: '1px solid #27272a',
            color: '#f4f4f5',
          },
        }}
      />
    </div>
  );
}
