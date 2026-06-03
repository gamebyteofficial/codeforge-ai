/**
 * Shared agent configuration constants.
 *
 * ChatPanel uses JSX icons (`icon: <Zap className="size-3.5" />`), which is
 * the canonical version stored here. TaskTracker imports this config and
 * adapts the icon rendering to its component-based pattern.
 */

import React from 'react';
import {
  Zap,
  FileCode2,
  Bug,
  FileSearch,
  BookOpen,
} from 'lucide-react';

export type AgentType = 'planner' | 'coder' | 'debugger' | 'reviewer' | 'documenter';

export interface AgentConfigEntry {
  label: string;
  icon: React.ReactNode;
  color: string;
}

export const AGENT_CONFIG: Record<AgentType, AgentConfigEntry> = {
  planner: {
    label: 'Planner',
    icon: <Zap className="size-3.5" />,
    color: 'text-amber-400',
  },
  coder: {
    label: 'Coder',
    icon: <FileCode2 className="size-3.5" />,
    color: 'text-emerald-400',
  },
  debugger: {
    label: 'Debugger',
    icon: <Bug className="size-3.5" />,
    color: 'text-red-400',
  },
  reviewer: {
    label: 'Reviewer',
    icon: <FileSearch className="size-3.5" />,
    color: 'text-sky-400',
  },
  documenter: {
    label: 'Documenter',
    icon: <BookOpen className="size-3.5" />,
    color: 'text-violet-400',
  },
};

/**
 * Icon component map for components that need to render icons as components
 * rather than pre-rendered JSX (e.g. TaskTracker).
 */
export const AGENT_ICON_MAP: Record<AgentType, typeof Zap> = {
  planner: Zap,
  coder: FileCode2,
  debugger: Bug,
  reviewer: FileSearch,
  documenter: BookOpen,
};
