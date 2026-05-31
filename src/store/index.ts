import { create } from 'zustand';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  tokens?: number;
  model?: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  title: string;
  projectId?: string | null;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectFile {
  id: string;
  name: string;
  path: string;
  content: string;
  language?: string;
  isFolder: boolean;
  projectId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  agent?: string;
  result?: string;
  progress: number;
  projectId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Memory {
  id: string;
  type: 'short_term' | 'long_term';
  category?: string;
  key: string;
  value: string;
  projectId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  path: string;
  language: string;
  framework?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TerminalLine {
  id: string;
  type: 'input' | 'output' | 'error' | 'system';
  content: string;
  timestamp: string;
}

export type AgentType = 'planner' | 'coder' | 'debugger' | 'reviewer' | 'documenter';

export type SidebarTab = 'files' | 'tasks' | 'memory';
export type BottomTab = 'terminal' | 'output';

interface AppState {
  // Project
  currentProject: Project | null;
  projects: Project[];
  setCurrentProject: (project: Project | null) => void;
  setProjects: (projects: Project[]) => void;

  // Chat
  conversations: Conversation[];
  currentConversation: Conversation | null;
  isChatLoading: boolean;
  setConversations: (conversations: Conversation[]) => void;
  setCurrentConversation: (conversation: Conversation | null) => void;
  setIsChatLoading: (loading: boolean) => void;
  addMessageToConversation: (message: Message) => void;

  // Files
  files: ProjectFile[];
  currentFile: ProjectFile | null;
  setFiles: (files: ProjectFile[]) => void;
  setCurrentFile: (file: ProjectFile | null) => void;
  addFile: (file: ProjectFile) => void;
  updateFile: (id: string, updates: Partial<ProjectFile>) => void;
  removeFile: (id: string) => void;

  // Tasks
  tasks: Task[];
  setTasks: (tasks: Task[]) => void;
  addTask: (task: Task) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  removeTask: (id: string) => void;

  // Memory
  memories: Memory[];
  setMemories: (memories: Memory[]) => void;
  addMemory: (memory: Memory) => void;

  // Terminal
  terminalLines: TerminalLine[];
  addTerminalLine: (line: TerminalLine) => void;
  clearTerminal: () => void;

  // UI State
  sidebarTab: SidebarTab;
  bottomTab: BottomTab;
  isSidebarOpen: boolean;
  isBottomPanelOpen: boolean;
  isSettingsOpen: boolean;
  selectedAgent: AgentType;
  setSidebarTab: (tab: SidebarTab) => void;
  setBottomTab: (tab: BottomTab) => void;
  setIsSidebarOpen: (open: boolean) => void;
  setIsBottomPanelOpen: (open: boolean) => void;
  setIsSettingsOpen: (open: boolean) => void;
  setSelectedAgent: (agent: AgentType) => void;

  // Settings
  settings: Record<string, string>;
  setSettings: (settings: Record<string, string>) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Project
  currentProject: null,
  projects: [],
  setCurrentProject: (project) => set({ currentProject: project }),
  setProjects: (projects) => set({ projects }),

  // Chat
  conversations: [],
  currentConversation: null,
  isChatLoading: false,
  setConversations: (conversations) => set({ conversations }),
  setCurrentConversation: (conversation) => set({ currentConversation: conversation }),
  setIsChatLoading: (loading) => set({ isChatLoading: loading }),
  addMessageToConversation: (message) =>
    set((state) => {
      if (!state.currentConversation) return state;
      return {
        currentConversation: {
          ...state.currentConversation,
          messages: [...state.currentConversation.messages, message],
        },
      };
    }),

  // Files
  files: [],
  currentFile: null,
  setFiles: (files) => set({ files }),
  setCurrentFile: (file) => set({ currentFile: file }),
  addFile: (file) => set((state) => ({ files: [...state.files, file] })),
  updateFile: (id, updates) =>
    set((state) => ({
      files: state.files.map((f) => (f.id === id ? { ...f, ...updates } : f)),
      currentFile: state.currentFile?.id === id ? { ...state.currentFile, ...updates } : state.currentFile,
    })),
  removeFile: (id) =>
    set((state) => ({
      files: state.files.filter((f) => f.id !== id),
      currentFile: state.currentFile?.id === id ? null : state.currentFile,
    })),

  // Tasks
  tasks: [],
  setTasks: (tasks) => set({ tasks }),
  addTask: (task) => set((state) => ({ tasks: [task, ...state.tasks] })),
  updateTask: (id, updates) =>
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })),
  removeTask: (id) =>
    set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) })),

  // Memory
  memories: [],
  setMemories: (memories) => set({ memories }),
  addMemory: (memory) => set((state) => ({ memories: [memory, ...state.memories] })),

  // Terminal
  terminalLines: [],
  addTerminalLine: (line) =>
    set((state) => ({ terminalLines: [...state.terminalLines, line] })),
  clearTerminal: () => set({ terminalLines: [] }),

  // UI State
  sidebarTab: 'files',
  bottomTab: 'terminal',
  isSidebarOpen: true,
  isBottomPanelOpen: true,
  isSettingsOpen: false,
  selectedAgent: 'coder',
  setSidebarTab: (tab) => set({ sidebarTab: tab }),
  setBottomTab: (tab) => set({ bottomTab: tab }),
  setIsSidebarOpen: (open) => set({ isSidebarOpen: open }),
  setIsBottomPanelOpen: (open) => set({ isBottomPanelOpen: open }),
  setIsSettingsOpen: (open) => set({ isSettingsOpen: open }),
  setSelectedAgent: (agent) => set({ selectedAgent: agent }),

  // Settings
  settings: {},
  setSettings: (settings) => set({ settings }),
}));
