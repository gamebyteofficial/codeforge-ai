'use client';

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type KeyboardEvent,
} from 'react';
import {
  TerminalIcon,
  Trash2,
  ChevronUp,
  ChevronDown,
  ArrowRight,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { useAppStore, type TerminalLine, type BottomTab } from '@/store';
import { useTerminalState, useUIState } from '@/store/hooks';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WELCOME_LINES: Omit<TerminalLine, 'id'>[] = [
  {
    type: 'system',
    content: 'Waziros AI Terminal v1.0',
    timestamp: new Date().toISOString(),
  },
  {
    type: 'system',
    content: "Type 'help' for available commands",
    timestamp: new Date().toISOString(),
  },
];

const BOTTOM_TABS: { key: BottomTab; label: string }[] = [
  { key: 'terminal', label: 'Terminal' },
  { key: 'output', label: 'Output' },
];

// ---------------------------------------------------------------------------
// Color mapping for line types
// ---------------------------------------------------------------------------

function lineColorClass(type: TerminalLine['type']): string {
  switch (type) {
    case 'input':
      return 'text-emerald-400';
    case 'output':
      return 'text-zinc-300';
    case 'error':
      return 'text-red-400';
    case 'system':
      return 'text-amber-400';
    default:
      return 'text-zinc-300';
  }
}

function linePrefix(type: TerminalLine['type']): string {
  switch (type) {
    case 'input':
      return '$ ';
    case 'error':
      return '';
    case 'system':
      return '';
    case 'output':
      return '';
    default:
      return '';
  }
}

// ---------------------------------------------------------------------------
// TerminalLineRow
// ---------------------------------------------------------------------------

function TerminalLineRow({ line }: { line: TerminalLine }) {
  const prefix = linePrefix(line.type);
  const colorClass = lineColorClass(line.type);

  return (
    <div className={`flex items-start gap-0 px-3 py-[1px] font-mono text-[13px] leading-5 ${colorClass}`}>
      {line.type === 'input' && (
        <span className="mr-1 shrink-0 text-emerald-500 select-none">$</span>
      )}
      {line.type === 'error' && (
        <AlertTriangle className="mr-1.5 mt-0.5 size-3.5 shrink-0 text-red-500" />
      )}
      {line.type === 'system' && (
        <Info className="mr-1.5 mt-0.5 size-3.5 shrink-0 text-amber-500" />
      )}
      <span className="whitespace-pre-wrap break-all">{line.content}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TerminalHeader
// ---------------------------------------------------------------------------

function TerminalHeader({
  activeTab,
  onTabChange,
  onClear,
  isMaximized,
  onToggleMaximize,
}: {
  activeTab: BottomTab;
  onTabChange: (tab: BottomTab) => void;
  onClear: () => void;
  isMaximized: boolean;
  onToggleMaximize: () => void;
}) {
  return (
    <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/90 px-2 py-0 backdrop-blur-sm">
      {/* Left: Icon + Tabs */}
      <div className="flex items-center gap-0">
        <div className="flex items-center gap-1.5 px-2 py-1.5">
          <TerminalIcon className="size-3.5 text-zinc-400" />
          <span className="text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
            Terminal
          </span>
        </div>

        <div className="flex items-center">
          {BOTTOM_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={`relative px-3 py-1.5 text-xs font-medium transition-colors ${
                activeTab === tab.key
                  ? 'text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {tab.label}
              {activeTab === tab.key && (
                <span className="absolute inset-x-1.5 bottom-0 h-[2px] rounded-full bg-emerald-500" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-zinc-500 hover:text-zinc-300"
              onClick={onClear}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Clear terminal</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-zinc-500 hover:text-zinc-300"
              onClick={onToggleMaximize}
            >
              {isMaximized ? (
                <ChevronDown className="size-3.5" />
              ) : (
                <ChevronUp className="size-3.5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            {isMaximized ? 'Minimize' : 'Maximize'}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CommandInput
// ---------------------------------------------------------------------------

function CommandInput({
  onSubmit,
  isProcessing,
}: {
  onSubmit: (command: string) => void;
  isProcessing: boolean;
}) {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const commandHistoryRef = useRef<string[]>([]);
  const savedInputRef = useRef('');

  // Auto-focus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isProcessing) return;

    // Add to command history
    commandHistoryRef.current = [
      trimmed,
      ...commandHistoryRef.current.filter((c) => c !== trimmed),
    ].slice(0, 100);
    setHistoryIndex(-1);
    savedInputRef.current = '';

    onSubmit(trimmed);
    setInput('');
  }, [input, isProcessing, onSubmit]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
        return;
      }

      const history = commandHistoryRef.current;

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (history.length === 0) return;

        // Save current input when starting to navigate
        if (historyIndex === -1) {
          savedInputRef.current = input;
        }

        const newIndex = Math.min(historyIndex + 1, history.length - 1);
        setHistoryIndex(newIndex);
        setInput(history[newIndex]);
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (historyIndex === -1) return;

        const newIndex = historyIndex - 1;
        if (newIndex === -1) {
          setHistoryIndex(-1);
          setInput(savedInputRef.current);
        } else {
          setHistoryIndex(newIndex);
          setInput(history[newIndex]);
        }
        return;
      }
    },
    [input, historyIndex, handleSubmit],
  );

  return (
    <div className="flex items-center border-t border-zinc-800 bg-zinc-900/60 px-1">
      <span className="flex items-center gap-1 px-2 py-2 text-emerald-500">
        <ArrowRight className="size-3" />
        <span className="font-mono text-sm font-bold select-none">$</span>
      </span>
      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isProcessing}
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        className="flex-1 bg-transparent py-2 font-mono text-sm text-zinc-100 outline-none placeholder-zinc-600 disabled:opacity-50"
        placeholder={isProcessing ? 'Running...' : 'Enter command...'}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// OutputPanel – placeholder for the Output tab
// ---------------------------------------------------------------------------

function OutputPanel({ lines }: { lines: TerminalLine[] }) {
  const outputLines = lines.filter((l) => l.type === 'output' || l.type === 'error');

  if (outputLines.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-xs text-zinc-600">No output yet</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-3 py-2 font-mono text-[13px]">
      {outputLines.map((line) => (
        <TerminalLineRow key={line.id} line={line} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Terminal (main export)
// ---------------------------------------------------------------------------

export default function Terminal() {
  const terminalLines = useTerminalState(s => s.terminalLines);
  const addTerminalLine = useTerminalState(s => s.addTerminalLine);
  const clearTerminal = useTerminalState(s => s.clearTerminal);
  const bottomTab = useUIState(s => s.bottomTab);
  const setBottomTab = useUIState(s => s.setBottomTab);
  const isBottomPanelOpen = useUIState(s => s.isBottomPanelOpen);
  const setIsBottomPanelOpen = useUIState(s => s.setIsBottomPanelOpen);

  const [isProcessing, setIsProcessing] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const scrollEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const welcomeAddedRef = useRef(false);

  // Add welcome message on first mount
  useEffect(() => {
    if (welcomeAddedRef.current) return;
    welcomeAddedRef.current = true;

    if (terminalLines.length === 0) {
      WELCOME_LINES.forEach((line) => {
        addTerminalLine({
          ...line,
          id: crypto.randomUUID(),
        });
      });
    }
  }, [terminalLines.length, addTerminalLine]);

  // Auto-scroll to bottom on new lines
  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [terminalLines.length, isProcessing]);

  // Focus input when clicking anywhere in the terminal
  const handleContainerClick = useCallback(() => {
    const input = containerRef.current?.querySelector('input');
    input?.focus();
  }, []);

  const handleClear = useCallback(() => {
    clearTerminal();
    // Re-add welcome after clear
    WELCOME_LINES.forEach((line) => {
      addTerminalLine({
        ...line,
        id: crypto.randomUUID(),
      });
    });
  }, [clearTerminal, addTerminalLine]);

  const handleToggleMaximize = useCallback(() => {
    setIsMaximized((prev) => !prev);
    if (!isBottomPanelOpen) {
      setIsBottomPanelOpen(true);
    }
  }, [isBottomPanelOpen, setIsBottomPanelOpen]);

  const handleTabChange = useCallback(
    (tab: BottomTab) => {
      setBottomTab(tab);
      if (!isBottomPanelOpen) {
        setIsBottomPanelOpen(true);
      }
    },
    [setBottomTab, isBottomPanelOpen, setIsBottomPanelOpen],
  );

  const handleCommand = useCallback(
    async (command: string) => {
      // Handle local 'clear' command
      if (command.trim().toLowerCase() === 'clear') {
        clearTerminal();
        return;
      }

      // Add input line to terminal
      addTerminalLine({
        id: crypto.randomUUID(),
        type: 'input',
        content: command,
        timestamp: new Date().toISOString(),
      });

      setIsProcessing(true);
      try {
        const res = await fetch('/api/terminal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command }),
        });

        if (!res.ok) {
          throw new Error(`API error: ${res.status}`);
        }

        const data = await res.json();

        if (data.blocked) {
          addTerminalLine({
            id: crypto.randomUUID(),
            type: 'error',
            content: data.output,
            timestamp: new Date().toISOString(),
          });
        } else if (data.output) {
          // Split multi-line output into separate lines for cleaner display
          const outputLines = data.output.split('\n');
          // Remove trailing empty line from split if the output ended with \n
          if (outputLines.length > 1 && outputLines[outputLines.length - 1] === '') {
            outputLines.pop();
          }

          outputLines.forEach((line: string) => {
            addTerminalLine({
              id: crypto.randomUUID(),
              type: data.exitCode !== 0 ? 'error' : 'output',
              content: line,
              timestamp: new Date().toISOString(),
            });
          });
        }

        if (data.exitCode !== 0 && !data.blocked) {
          addTerminalLine({
            id: crypto.randomUUID(),
            type: 'error',
            content: `Process exited with code ${data.exitCode}`,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (error) {
        addTerminalLine({
          id: crypto.randomUUID(),
          type: 'error',
          content: `Failed to execute command: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: new Date().toISOString(),
        });
      } finally {
        setIsProcessing(false);
      }
    },
    [addTerminalLine, clearTerminal],
  );

  return (
    <div
      ref={containerRef}
      onClick={handleContainerClick}
      className={`flex flex-col bg-zinc-950 text-zinc-100 transition-[height] duration-200 ${
        isMaximized ? 'h-full' : 'h-64'
      }`}
    >
      {/* Header */}
      <TerminalHeader
        activeTab={bottomTab}
        onTabChange={handleTabChange}
        onClear={handleClear}
        isMaximized={isMaximized}
        onToggleMaximize={handleToggleMaximize}
      />

      {/* Body */}
      {bottomTab === 'terminal' ? (
        <ScrollArea className="flex-1">
          <div role="log" aria-live="polite" className="min-h-full px-0 py-2">
            {terminalLines.map((line) => (
              <TerminalLineRow key={line.id} line={line} />
            ))}

            {/* Processing indicator */}
            {isProcessing && (
              <div className="flex items-center gap-2 px-3 py-1 font-mono text-[13px] text-emerald-400">
                <span className="inline-block size-1.5 animate-pulse rounded-full bg-emerald-400" />
                <span>Running...</span>
              </div>
            )}

            <div ref={scrollEndRef} />
          </div>
        </ScrollArea>
      ) : (
        <OutputPanel lines={terminalLines} />
      )}

      {/* Command input (only show on terminal tab) */}
      {bottomTab === 'terminal' && (
        <CommandInput onSubmit={handleCommand} isProcessing={isProcessing} />
      )}
    </div>
  );
}
