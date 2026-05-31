'use client';

import { useState, useRef, useEffect, useCallback, type FormEvent, type KeyboardEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
  Send,
  Plus,
  Trash2,
  Bot,
  User,
  Copy,
  Check,
  FileCode2,
  Zap,
  Bug,
  FileSearch,
  BookOpen,
  Cpu,
  Loader2,
  Sparkles,
  Hash,
  ChevronDown,
  Wifi,
  WifiOff,
  RefreshCw,
} from 'lucide-react';
import { useAppStore, type AgentType } from '@/store';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DynamicModel {
  id: string;
  name: string;
  provider: string;
  pricing?: { prompt: string; completion: string };
  contextLength?: number;
  isFree: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AGENT_CONFIG: Record<AgentType, { label: string; icon: React.ReactNode; color: string }> = {
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

const SUGGESTED_PROMPTS = [
  { label: 'Build a React dashboard with charts', icon: <FileCode2 className="size-4" /> },
  { label: 'Debug this code for me', icon: <Bug className="size-4" /> },
  { label: 'Create a REST API with Express', icon: <Zap className="size-4" /> },
  { label: 'Review my code for best practices', icon: <FileSearch className="size-4" /> },
  { label: 'Generate a game with Phaser.js', icon: <Cpu className="size-4" /> },
  { label: 'Plan a microservice architecture', icon: <BookOpen className="size-4" /> },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function LoadingDots() {
  return (
    <div className="flex items-center gap-1 px-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="inline-block size-1.5 rounded-full bg-emerald-400"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            delay: i * 0.2,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CodeBlock – syntax‑highlighted code with copy & apply buttons
// ---------------------------------------------------------------------------

function CodeBlock({
  language,
  code,
  onApply,
}: {
  language: string;
  code: string;
  onApply?: (code: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API not available
    }
  }, [code]);

  return (
    <div className="group relative my-3 overflow-hidden rounded-lg border border-zinc-700/50 bg-zinc-950">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-zinc-700/50 bg-zinc-900/80 px-4 py-1.5">
        <span className="text-xs font-medium text-zinc-400">{language || 'text'}</span>
        <div className="flex items-center gap-1">
          {onApply && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-2 text-xs text-zinc-400 hover:text-emerald-400"
              onClick={() => onApply(code)}
            >
              <FileCode2 className="size-3" />
              Apply
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 gap-1 px-2 text-xs text-zinc-400 hover:text-white"
            onClick={handleCopy}
          >
            {copied ? (
              <>
                <Check className="size-3 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="size-3" />
                Copy
              </>
            )}
          </Button>
        </div>
      </div>
      {/* Code content */}
      <SyntaxHighlighter
        language={language || 'text'}
        style={vscDarkPlus}
        customStyle={{
          margin: 0,
          padding: '1rem',
          background: 'transparent',
          fontSize: '0.8125rem',
          lineHeight: '1.6',
        }}
        showLineNumbers={code.split('\n').length > 3}
        lineNumberStyle={{ color: '#52525b', minWidth: '2.5em' }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MarkdownRenderer – renders AI message content
// ---------------------------------------------------------------------------

function MarkdownRenderer({ content, onApplyCode }: { content: string; onApplyCode?: (code: string) => void }) {
  return (
    <ReactMarkdown
      components={{
        code({ className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '');
          const codeString = String(children).replace(/\n$/, '');

          if (match) {
            return (
              <CodeBlock language={match[1]} code={codeString} onApply={onApplyCode} />
            );
          }

          if (codeString.includes('\n')) {
            return <CodeBlock language="" code={codeString} onApply={onApplyCode} />;
          }

          return (
            <code
              className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-sm text-emerald-400"
              {...props}
            >
              {children}
            </code>
          );
        },
        p({ children }) {
          return <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>;
        },
        ul({ children }) {
          return <ul className="mb-2 ml-4 list-disc space-y-1">{children}</ul>;
        },
        ol({ children }) {
          return <ol className="mb-2 ml-4 list-decimal space-y-1">{children}</ol>;
        },
        li({ children }) {
          return <li className="leading-relaxed">{children}</li>;
        },
        h1({ children }) {
          return <h1 className="mb-2 mt-4 text-xl font-bold first:mt-0">{children}</h1>;
        },
        h2({ children }) {
          return <h2 className="mb-2 mt-3 text-lg font-bold first:mt-0">{children}</h2>;
        },
        h3({ children }) {
          return <h3 className="mb-1.5 mt-2 text-base font-semibold first:mt-0">{children}</h3>;
        },
        blockquote({ children }) {
          return (
            <blockquote className="my-2 border-l-2 border-emerald-500/40 pl-4 italic text-zinc-400">
              {children}
            </blockquote>
          );
        },
        a({ href, children }) {
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 underline underline-offset-2 hover:text-emerald-300"
            >
              {children}
            </a>
          );
        },
        table({ children }) {
          return (
            <div className="my-2 overflow-x-auto rounded border border-zinc-700/50">
              <table className="w-full text-sm">{children}</table>
            </div>
          );
        },
        th({ children }) {
          return <th className="border-b border-zinc-700/50 bg-zinc-800/50 px-3 py-2 text-left font-medium">{children}</th>;
        },
        td({ children }) {
          return <td className="border-b border-zinc-800 px-3 py-2">{children}</td>;
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

// ---------------------------------------------------------------------------
// Model Selector Popover – fetches models dynamically from /api/models
// ---------------------------------------------------------------------------

function ModelSelector({
  selectedModel,
  onModelChange,
}: {
  selectedModel: string;
  onModelChange: (model: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [models, setModels] = useState<DynamicModel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [provider, setProvider] = useState<string>('openrouter');
  const { settings } = useAppStore();

  const fetchModels = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/models');
      if (res.ok) {
        const data = await res.json();
        setModels(data.models || []);
        setProvider(data.provider || 'openrouter');
      }
    } catch (err) {
      console.error('Failed to fetch models:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch models when popover opens
  useEffect(() => {
    if (open && models.length === 0) {
      fetchModels();
    }
  }, [open, models.length, fetchModels]);

  // Also refresh when provider changes
  useEffect(() => {
    const configuredProvider = settings.provider || 'openrouter';
    if (configuredProvider !== provider) {
      setModels([]);
    }
  }, [settings.provider, provider]);

  const currentModel = models.find((m) => m.id === selectedModel) || models[0];

  // Group models: Free vs Paid (for OpenRouter), or by provider name
  const groupedModels = provider === 'openrouter'
    ? (() => {
        const auto = models.filter((m) => m.id === 'openrouter/auto');
        const free = models.filter((m) => m.isFree && m.id !== 'openrouter/auto');
        const paid = models.filter((m) => !m.isFree);
        const groups: Record<string, DynamicModel[]> = {};
        if (auto.length) groups['⚡ Auto-Routing'] = auto;
        if (free.length) groups['🆓 Free Models'] = free;
        if (paid.length) groups['💎 Paid Models'] = paid;
        return groups;
      })()
    : { [provider.toUpperCase()]: models };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-1.5 rounded-md border border-zinc-700/60 bg-zinc-800/60 px-2 py-1 text-xs text-zinc-300 transition-colors hover:bg-zinc-700/80 hover:text-zinc-100">
          <Wifi className="size-3 text-emerald-400" />
          <span className="max-w-[140px] truncate">{currentModel?.name || selectedModel}</span>
          <ChevronDown className="size-3 text-zinc-500" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-72 border-zinc-700 bg-zinc-800 p-1 shadow-xl"
      >
        {/* Header with refresh */}
        <div className="flex items-center justify-between px-2 py-1.5 border-b border-zinc-700/50">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            {provider === 'openrouter' ? 'OpenRouter' : provider} Models
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="size-6 p-0 text-zinc-500 hover:text-zinc-300"
            onClick={fetchModels}
            disabled={isLoading}
          >
            <RefreshCw className={`size-3 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        <div className="max-h-80 overflow-y-auto custom-scrollbar">
          {isLoading && models.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-4 animate-spin text-zinc-500" />
              <span className="ml-2 text-xs text-zinc-500">Loading models...</span>
            </div>
          ) : (
            Object.entries(groupedModels).map(([group, groupModels]) => (
              <div key={group}>
                <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  {group} ({groupModels.length})
                </div>
                {groupModels.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => {
                      onModelChange(model.id);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors ${
                      selectedModel === model.id
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100'
                    }`}
                  >
                    <span className="flex-1 text-left truncate">{model.name}</span>
                    {model.isFree ? (
                      <span className="shrink-0 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-medium text-emerald-400">
                        FREE
                      </span>
                    ) : (
                      <span className="shrink-0 rounded bg-zinc-700/50 px-1.5 py-0.5 text-[9px] font-medium text-zinc-500">
                        PAID
                      </span>
                    )}
                    {selectedModel === model.id && (
                      <Check className="size-3 shrink-0 text-emerald-400" />
                    )}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// ChatHeader
// ---------------------------------------------------------------------------

function ChatHeader() {
  const {
    currentConversation,
    setCurrentConversation,
    isChatLoading,
    selectedModel,
    setSelectedModel,
    settings,
    setSettings,
  } = useAppStore();

  const totalTokens = currentConversation?.messages.reduce(
    (sum, m) => sum + (m.tokens ?? 0),
    0,
  );

  const handleNewChat = () => {
    setCurrentConversation(null);
  };

  const handleDeleteChat = () => {
    setCurrentConversation(null);
  };

  const handleModelChange = useCallback((model: string) => {
    setSelectedModel(model);
    // Also persist to settings
    setSettings({ ...settings, model });
  }, [setSelectedModel, settings, setSettings]);

  // Show connection status
  const isConnected = !!(settings.apiKey);

  return (
    <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/80 px-3 py-2 backdrop-blur-sm">
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-emerald-500/10">
          <Sparkles className="size-4 text-emerald-500" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-medium text-zinc-100 truncate">
            {currentConversation?.title ?? 'New Conversation'}
          </span>
          <div className="flex items-center gap-2">
            {isConnected ? (
              <span className="flex items-center gap-1 text-[11px] text-emerald-400/80">
                <Wifi className="size-3" />
                Connected
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[11px] text-red-400/80">
                <WifiOff className="size-3" />
                No API Key
              </span>
            )}
            {totalTokens !== undefined && totalTokens > 0 && (
              <span className="flex items-center gap-1 text-[11px] text-zinc-500">
                <Hash className="size-3" />
                {totalTokens.toLocaleString()} tokens
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {/* Model Selector */}
        <ModelSelector selectedModel={selectedModel} onModelChange={handleModelChange} />

        <div className="h-4 w-px bg-zinc-800" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-zinc-400 hover:text-white"
              onClick={handleNewChat}
              disabled={isChatLoading}
            >
              <Plus className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">New chat</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-zinc-400 hover:text-red-400"
              onClick={handleDeleteChat}
              disabled={!currentConversation || isChatLoading}
            >
              <Trash2 className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Delete conversation</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EmptyState – shown when there are no messages
// ---------------------------------------------------------------------------

function EmptyState({ onPromptClick }: { onPromptClick: (prompt: string) => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-12">
      {/* Branding */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center gap-4"
      >
        <div className="flex size-16 items-center justify-center rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-500/20">
          <Bot className="size-8 text-emerald-500" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-semibold text-zinc-100">CodeForge AI</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Your intelligent coding companion. Ask me anything.
          </p>
        </div>
      </motion.div>

      {/* Suggested prompts */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        className="grid w-full max-w-lg grid-cols-1 gap-2 sm:grid-cols-2"
      >
        {SUGGESTED_PROMPTS.map((prompt) => (
          <button
            key={prompt.label}
            onClick={() => onPromptClick(prompt.label)}
            className="group flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-left text-sm text-zinc-300 transition-all hover:border-emerald-500/30 hover:bg-zinc-800/80 hover:text-zinc-100"
          >
            <span className="shrink-0 text-zinc-500 transition-colors group-hover:text-emerald-400">
              {prompt.icon}
            </span>
            <span className="line-clamp-2">{prompt.label}</span>
          </button>
        ))}
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MessageBubble
// ---------------------------------------------------------------------------

function MessageBubble({
  role,
  content,
  model,
  onApplyCode,
}: {
  role: 'user' | 'assistant' | 'system';
  content: string;
  model?: string;
  onApplyCode?: (code: string) => void;
}) {
  const isUser = role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={`flex gap-3 px-4 py-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
    >
      {/* Avatar */}
      <div
        className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${
          isUser
            ? 'bg-zinc-700 text-zinc-300'
            : 'bg-emerald-500/15 text-emerald-400'
        }`}
      >
        {isUser ? <User className="size-4" /> : <Bot className="size-4" />}
      </div>

      {/* Content */}
      <div
        className={`max-w-[85%] min-w-0 ${
          isUser ? 'items-end' : 'items-start'
        } flex flex-col gap-1`}
      >
        {/* Sender label with model info */}
        <span
          className={`text-[11px] font-medium ${
            isUser ? 'text-zinc-500' : 'text-emerald-400/80'
          }`}
        >
          {isUser ? 'You' : (
            <>
              CodeForge AI
              {model && (
                <span className="ml-1.5 text-zinc-600 font-normal">
                  via {model}
                </span>
              )}
            </>
          )}
        </span>

        {/* Message body */}
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
            isUser
              ? 'rounded-tr-sm bg-zinc-700 text-zinc-100'
              : 'rounded-tl-sm bg-zinc-800 text-zinc-300'
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{content}</p>
          ) : (
            <MarkdownRenderer content={content} onApplyCode={onApplyCode} />
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// MessageInput
// ---------------------------------------------------------------------------

function MessageInput({
  onSend,
  isLoading,
}: {
  onSend: (message: string) => void;
  isLoading: boolean;
}) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { selectedAgent, setSelectedAgent } = useAppStore();

  // Auto-expand textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed);
    setInput('');
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="border-t border-zinc-800 bg-zinc-900/80 p-3 backdrop-blur-sm">
      {/* Agent selector row — horizontal scrollable pills */}
      <div className="mb-2 flex items-center gap-1.5 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {(Object.entries(AGENT_CONFIG) as [AgentType, (typeof AGENT_CONFIG)[AgentType]][]).map(
          ([key, cfg]) => (
            <button
              key={key}
              onClick={() => setSelectedAgent(key)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                selectedAgent === key
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                  : 'border-zinc-700/60 bg-zinc-800/60 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
              }`}
            >
              <span className={selectedAgent === key ? cfg.color : 'text-zinc-500'}>{cfg.icon}</span>
              {cfg.label}
            </button>
          ),
        )}
      </div>

      {/* Input row */}
      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <div className="relative flex-1">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask CodeForge AI..."
            disabled={isLoading}
            rows={1}
            className="w-full resize-none rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 pr-12 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition-colors focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 disabled:opacity-50"
          />
        </div>

        <Button
          type="submit"
          size="icon"
          disabled={!input.trim() || isLoading}
          className="size-9 shrink-0 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40"
        >
          {isLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
        </Button>
      </form>

      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-[10px] text-zinc-600">
          Enter to send, Shift+Enter for new line
        </span>
        {isLoading && (
          <span className="flex items-center gap-1.5 text-[11px] text-emerald-400/80">
            <LoadingDots />
            Streaming from API
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChatPanel (main export)
// ---------------------------------------------------------------------------

export default function ChatPanel() {
  const {
    currentConversation,
    currentProject,
    isChatLoading,
    setIsChatLoading,
    addMessageToConversation,
    setCurrentConversation,
    setCurrentFile,
    currentFile,
    selectedAgent,
    selectedModel,
  } = useAppStore();

  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamingContentRef = useRef<string>('');
  const [streamingContent, setStreamingContent] = useState<string>('');
  const [streamingModel, setStreamingModel] = useState<string>('');

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentConversation?.messages.length, streamingContent, isChatLoading]);

  const handleApplyCode = useCallback(
    (code: string) => {
      if (currentFile) {
        setCurrentFile({ ...currentFile, content: code });
      }
    },
    [currentFile, setCurrentFile],
  );

  const handleSend = useCallback(
    async (message: string) => {
      // Create user message
      const userMessage = {
        id: crypto.randomUUID(),
        role: 'user' as const,
        content: message,
        createdAt: new Date().toISOString(),
      };

      // Ensure conversation exists
      if (!currentConversation) {
        const newConversation = {
          id: crypto.randomUUID(),
          title: message.slice(0, 50) + (message.length > 50 ? '...' : ''),
          projectId: currentProject?.id ?? null,
          messages: [userMessage],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setCurrentConversation(newConversation);
      } else {
        addMessageToConversation(userMessage);
      }

      // Call API with streaming
      setIsChatLoading(true);
      streamingContentRef.current = '';
      setStreamingContent('');
      setStreamingModel('');

      try {
        const conversationId = currentConversation?.id ?? userMessage.id;
        const existingMessages = currentConversation?.messages ?? [];
        const history = existingMessages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        // Create abort controller for cancellation
        abortControllerRef.current = new AbortController();

        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message,
            conversationId,
            projectId: currentProject?.id,
            agent: selectedAgent,
            model: selectedModel,
            history,
            stream: true,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!res.ok) {
          throw new Error(`API error: ${res.status}`);
        }

        // Check if the response is a stream
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('text/event-stream') || contentType.includes('text/plain')) {
          // Handle streaming response
          const reader = res.body?.getReader();
          if (!reader) throw new Error('No readable stream');

          const decoder = new TextDecoder();
          let fullContent = '';
          let lastModel = selectedModel;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || trimmed === 'data: [DONE]') continue;

              if (trimmed.startsWith('data: ')) {
                const data = trimmed.slice(6);
                try {
                  const parsed = JSON.parse(data);
                  if (parsed.error) {
                    fullContent += `\n\n⚠️ Error: ${parsed.error}`;
                    setStreamingContent(fullContent);
                    streamingContentRef.current = fullContent;
                  } else if (parsed.content) {
                    fullContent += parsed.content;
                    setStreamingContent(fullContent);
                    streamingContentRef.current = fullContent;
                  }
                  if (parsed.model) {
                    lastModel = parsed.model;
                    setStreamingModel(lastModel);
                  }
                } catch {
                  // Not valid JSON — ignore
                }
              }
            }
          }

          // Finalize the streaming message
          const assistantMessage = {
            id: crypto.randomUUID(),
            role: 'assistant' as const,
            content: fullContent || 'No response received.',
            tokens: Math.ceil(message.length / 4) + Math.ceil(fullContent.length / 4),
            model: lastModel,
            createdAt: new Date().toISOString(),
          };
          addMessageToConversation(assistantMessage);
        } else {
          // Handle JSON response (non-streaming fallback)
          const data = await res.json();
          const assistantMessage = {
            id: crypto.randomUUID(),
            role: 'assistant' as const,
            content: data.message ?? data.content ?? 'No response received.',
            tokens: data.tokens,
            model: data.model || selectedModel,
            createdAt: new Date().toISOString(),
          };
          addMessageToConversation(assistantMessage);
        }
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          // User cancelled — finalize what we have
          if (streamingContentRef.current) {
            const assistantMessage = {
              id: crypto.randomUUID(),
              role: 'assistant' as const,
              content: streamingContentRef.current,
              tokens: Math.ceil(streamingContentRef.current.length / 4),
              model: streamingModel || selectedModel,
              createdAt: new Date().toISOString(),
            };
            addMessageToConversation(assistantMessage);
          }
        } else {
          const errorMessage = {
            id: crypto.randomUUID(),
            role: 'assistant' as const,
            content:
              'Sorry, I encountered an error processing your request. Please check your API key and try again.',
            createdAt: new Date().toISOString(),
          };
          addMessageToConversation(errorMessage);
          console.error('Chat API error:', error);
        }
      } finally {
        setIsChatLoading(false);
        setStreamingContent('');
        setStreamingModel('');
        streamingContentRef.current = '';
        abortControllerRef.current = null;
      }
    },
    [
      currentConversation,
      currentProject,
      setIsChatLoading,
      addMessageToConversation,
      setCurrentConversation,
      selectedAgent,
      selectedModel,
    ],
  );

  const handlePromptClick = useCallback(
    (prompt: string) => {
      handleSend(prompt);
    },
    [handleSend],
  );

  const messages = currentConversation?.messages ?? [];
  const isEmpty = messages.length === 0 && !isChatLoading;

  return (
    <div className="flex h-full flex-col bg-zinc-950 text-zinc-100">
      {/* Header */}
      <ChatHeader />

      {/* Messages area */}
      {isEmpty ? (
        <EmptyState onPromptClick={handlePromptClick} />
      ) : (
        <ScrollArea className="flex-1">
          <div ref={scrollRef} className="py-2">
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  role={msg.role}
                  content={msg.content}
                  model={msg.model}
                  onApplyCode={msg.role === 'assistant' ? handleApplyCode : undefined}
                />
              ))}
            </AnimatePresence>

            {/* Streaming content - show in real-time */}
            <AnimatePresence>
              {isChatLoading && streamingContent && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex gap-3 px-4 py-3"
                >
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
                    <Bot className="size-4" />
                  </div>
                  <div className="flex flex-col gap-1 max-w-[85%] min-w-0">
                    <span className="text-[11px] font-medium text-emerald-400/80">
                      CodeForge AI
                      {streamingModel && (
                        <span className="ml-1.5 text-zinc-600 font-normal">
                          via {streamingModel}
                        </span>
                      )}
                    </span>
                    <div className="rounded-2xl rounded-tl-sm bg-zinc-800 px-4 py-2.5 text-sm leading-relaxed text-zinc-300">
                      <MarkdownRenderer content={streamingContent} onApplyCode={handleApplyCode} />
                      <span className="inline-block w-1.5 h-4 bg-emerald-400 animate-pulse ml-0.5 align-text-bottom" />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Loading indicator (before streaming starts) */}
            <AnimatePresence>
              {isChatLoading && !streamingContent && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex gap-3 px-4 py-3"
                >
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
                    <Bot className="size-4" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-medium text-emerald-400/80">
                      CodeForge AI
                    </span>
                    <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm bg-zinc-800 px-4 py-3 text-sm text-zinc-400">
                      <Loader2 className="size-3.5 animate-spin text-emerald-500" />
                      <span>Calling {selectedModel}...</span>
                      <LoadingDots />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      )}

      {/* Input area */}
      <MessageInput onSend={handleSend} isLoading={isChatLoading} />
    </div>
  );
}
