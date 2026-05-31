'use client';

import { useEffect } from 'react';
import ChatPanel from '@/components/codeforge/ChatPanel';
import CodeEditor from '@/components/codeforge/CodeEditor';
import MemoryViewer from '@/components/codeforge/MemoryViewer';
import FileExplorer from '@/components/codeforge/FileExplorer';
import TaskTracker from '@/components/codeforge/TaskTracker';
import Terminal from '@/components/codeforge/Terminal';
import TopBar from '@/components/codeforge/TopBar';
import SettingsModal from '@/components/codeforge/SettingsModal';
import OnboardingWizard from '@/components/codeforge/OnboardingWizard';
import LivePreview from '@/components/codeforge/LivePreview';
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
} from 'lucide-react';
import { useAppStore, type SidebarTab } from '@/store';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';

const SIDEBAR_TABS: { value: SidebarTab; icon: typeof MessageSquare; label: string }[] = [
  { value: 'files', icon: FolderTree, label: 'Files' },
  { value: 'tasks', icon: ListChecks, label: 'Tasks' },
  { value: 'memory', icon: Brain, label: 'Memory' },
];

export default function Home() {
  const {
    isSidebarOpen,
    setIsSidebarOpen,
    sidebarTab,
    setSidebarTab,
    isBottomPanelOpen,
    setIsBottomPanelOpen,
    isOnboarded,
    setIsOnboarded,
    isPreviewOpen,
    setIsPreviewOpen,
    settings,
    setSettings,
    setSelectedModel,
    selectedModel,
  } = useAppStore();

  // Check if user has already completed onboarding (has API key in settings)
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

  // Ensure a default project exists for file creation
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

  // Show onboarding wizard if not onboarded
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

                  {/* Sidebar content */}
                  <div className="flex-1 min-w-0 overflow-hidden">
                    {sidebarTab === 'files' && <FileExplorer />}
                    {sidebarTab === 'tasks' && <TaskTracker />}
                    {sidebarTab === 'memory' && <MemoryViewer />}
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
                  {/* Live Preview Panel */}
                  {isPreviewOpen && (
                    <>
                      <ResizableHandle className="bg-zinc-800 hover:bg-emerald-500/30 transition-colors w-px" />
                      <ResizablePanel defaultSize={30} minSize={20} maxSize={50}>
                        <LivePreview />
                      </ResizablePanel>
                    </>
                  )}
                </ResizablePanelGroup>
              </ResizablePanel>

              {/* Bottom: Terminal */}
              {isBottomPanelOpen && (
                <>
                  <ResizableHandle className="bg-zinc-800 hover:bg-emerald-500/30 transition-colors h-px" />
                  <ResizablePanel defaultSize={35} minSize={15} maxSize={60}>
                    <Terminal />
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

          {/* Project info */}
          <span className="text-[10px] text-zinc-600">
            CodeForge AI v1.0
          </span>

          {/* Model info */}
          {selectedModel && (
            <>
              <div className="h-3 w-px bg-zinc-800" />
              <span className="text-[10px] text-zinc-600">
                {selectedModel}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[10px] text-zinc-600">
            Powered by Z.ai
          </span>
          <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
        </div>
      </footer>

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
