'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo, useDeferredValue, type FormEvent } from 'react';
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
  ChevronUp,
  ArrowDown,
  ArrowUp,
  Wifi,
  WifiOff,
  RefreshCw,
  FilePlus2,
  FolderCheck,
  FileCheck2,
  Square,
  Activity,
  CreditCard,
  Gift,
  Search,
  Eye,
  Monitor,
  ExternalLink,
  AlertTriangle,
  RotateCcw,
  Settings,
  Download,
} from 'lucide-react';
import { useAppStore, type AgentType, type ProjectFile } from '@/store';
import { useStore, useChatState, useFileState, useUIState, useProjectState } from '@/store/hooks';
import { parseFilesFromResponse, type ParsedFile } from '@/lib/file-parser';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
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
// Utility: Extract preview content from streaming text (optimized with cache)
// ---------------------------------------------------------------------------

// Cache for extractPreviewContent — avoids re-running regex when content hasn't changed
const previewCache = {
  lastInput: '',
  lastResult: null as { html: string; css: string; js: string } | null,
};

// Quick check: does the text even contain code blocks?
const CODE_BLOCK_INDICATOR = /```/;

/**
 * Extract ALL code blocks from text, categorized by language.
 * Uses a robust extraction that handles both complete and streaming (incomplete) blocks.
 */
function extractAllCodeBlocks(text: string): { lang: string; content: string }[] {
  const blocks: { lang: string; content: string }[] = [];

  // Match complete code blocks: ```lang\n...```
  // Also match incomplete blocks (during streaming): ```lang\n... (no closing ```)
  const codeBlockPattern = /```(\w*)\n([\s\S]*?)(?:```|$)/g;
  let m: RegExpExecArray | null;
  while ((m = codeBlockPattern.exec(text)) !== null) {
    const lang = (m[1] || '').toLowerCase();
    const content = m[2];
    if (content.trim().length > 0) {
      blocks.push({ lang, content });
    }
  }

  return blocks;
}

function classifyCodeBlock(lang: string, fileName?: string): 'html' | 'css' | 'js' | null {
  const fn = (fileName || '').toLowerCase();
  const l = lang.toLowerCase();

  if (fn.endsWith('.html') || fn.endsWith('.htm') || l === 'html' || l === 'markup') return 'html';
  if (fn.endsWith('.css') || fn.endsWith('.scss') || fn.endsWith('.less') || l === 'css' || l === 'scss' || l === 'less') return 'css';
  if (fn.endsWith('.js') || fn.endsWith('.jsx') || fn.endsWith('.ts') || fn.endsWith('.tsx') || l === 'javascript' || l === 'js' || l === 'typescript' || l === 'ts') return 'js';
  return null;
}

function extractPreviewContent(text: string): { html: string; css: string; js: string } | null {
  // Early exit: if text is short and contains no code block markers, skip entirely
  if (text.length < 20 && !CODE_BLOCK_INDICATOR.test(text)) return null;

  // Return cached result if input hasn't changed
  if (text === previewCache.lastInput) {
    return previewCache.lastResult;
  }

  let html = '';
  let css = '';
  let js = '';

  // Strategy 1: 📄 **filepath** headers — the format the system prompt instructs
  const emojiFilePattern = /📄\s*\*\*(.+?)\*\*\s*\n```(\w*)\n([\s\S]*?)(?:```|$)/g;
  let match: RegExpExecArray | null;
  while ((match = emojiFilePattern.exec(text)) !== null) {
    const filePath = match[1].trim();
    const lang = match[2].toLowerCase();
    const content = match[3];
    const type = classifyCodeBlock(lang, filePath);
    if (type === 'html' && !html) html = content;
    else if (type === 'css' && !css) css = content;
    else if (type === 'js' && !js) js = content;
  }

  // Strategy 2: **filepath** (bold, no emoji) — some models skip the emoji
  if (!html || !css || !js) {
    const boldFilePattern = /\*\*(.+?\.\w+)\*\*\s*\n```(\w*)\n([\s\S]*?)(?:```|$)/g;
    while ((match = boldFilePattern.exec(text)) !== null) {
      const filePath = match[1].trim();
      const lang = match[2].toLowerCase();
      const content = match[3];
      // Skip if it looks like regular bold text, not a filename
      if (!filePath.includes('.') && !filePath.includes('/')) continue;
      const type = classifyCodeBlock(lang, filePath);
      if (type === 'html' && !html) html = content;
      else if (type === 'css' && !css) css = content;
      else if (type === 'js' && !js) js = content;
    }
  }

  // Strategy 3: Plain code blocks without file headers — use language tag to classify
  if (!html || !css || !js) {
    const allBlocks = extractAllCodeBlocks(text);
    for (const block of allBlocks) {
      const type = classifyCodeBlock(block.lang);
      if (type === 'html' && !html) html = block.content;
      else if (type === 'css' && !css) css = block.content;
      else if (type === 'js' && !js) js = block.content;
    }
  }

  // Strategy 4: Detect code blocks with no language tag that contain HTML
  // Many models output ```\n<!DOCTYPE html>... without specifying "html"
  if (!html) {
    const untypedBlockPattern = /```\n([\s\S]*?)(?:```|$)/g;
    while ((match = untypedBlockPattern.exec(text)) !== null) {
      const content = match[1];
      if (content && (/<html[\s>]/i.test(content) || /<!DOCTYPE/i.test(content) || /<body[\s>]/i.test(content))) {
        html = content;
        break;
      }
    }
  }

  // Strategy 5: Look for raw HTML in the response (no code blocks at all)
  // Some models just output HTML directly
  if (!html && !css && !js) {
    // Check if the text itself looks like an HTML document
    if (/<html[\s>]/i.test(text) || /<!DOCTYPE/i.test(text)) {
      // Extract the HTML document portion
      const htmlStart = text.search(/<!DOCTYPE/i);
      const htmlStart2 = text.search(/<html[\s>]/i);
      const startIdx = htmlStart >= 0 ? htmlStart : htmlStart2;
      if (startIdx >= 0) {
        const htmlEnd = text.lastIndexOf('</html>');
        if (htmlEnd > startIdx) {
          html = text.substring(startIdx, htmlEnd + '</html>'.length);
        } else {
          // No closing </html> — might be still streaming, take everything from start
          html = text.substring(startIdx);
        }
      }
    }
  }

  // If we have an HTML file that is a self-contained document
  // (has <!DOCTYPE html> or <html> tag), and no separate CSS/JS files were found,
  // use the HTML as-is — it contains everything needed
  if (html && !css && !js && (/<html[\s>]/i.test(html) || /<!DOCTYPE/i.test(html))) {
    const result = { html, css: '', js: '' };
    previewCache.lastInput = text;
    previewCache.lastResult = result;
    return result;
  }

  // If we only have HTML content (no full document), wrap it in a basic document
  if (html && !css && !js && html.trim().length > 0) {
    const result = { html, css, js };
    previewCache.lastInput = text;
    previewCache.lastResult = result;
    return result;
  }

  // Strategy 6: Detect HTML tags in any untyped code block (even without ```html tag)
  // Some models wrap HTML in generic code blocks
  if (!html) {
    const allBlocks = extractAllCodeBlocks(text);
    for (const block of allBlocks) {
      if (!block.lang && /<[a-zA-Z][^>]*>/.test(block.content) &&
          (/<div[\s>]/i.test(block.content) || /<h[1-6][\s>]/i.test(block.content) ||
           /<p[\s>]/i.test(block.content) || /<button[\s>]/i.test(block.content) ||
           /<input[\s>]/i.test(block.content) || /<form[\s>]/i.test(block.content) ||
           /<table[\s>]/i.test(block.content) || /<img[\s>]/i.test(block.content) ||
           /<a[\s>]/i.test(block.content) || /<span[\s>]/i.test(block.content))) {
        html = block.content;
        break;
      }
    }
  }

  const result = (!html && !css && !js) ? null : { html, css, js };

  // Update cache
  previewCache.lastInput = text;
  previewCache.lastResult = result;

  return result;
}

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
// Error handling helpers – structured error marker for messages
// ---------------------------------------------------------------------------

interface ChatError {
  type: 'network' | 'api' | 'abort' | 'model' | 'stream' | 'unknown';
  message: string;
  suggestions: string[];
  originalMessage?: string; // The user's last message for retry
}

const ERROR_MARKER = '__CFORGE_ERROR__:';

function encodeChatError(error: ChatError): string {
  return `${ERROR_MARKER}${JSON.stringify(error)}`;
}

function decodeChatError(content: string): ChatError | null {
  if (!content.startsWith(ERROR_MARKER)) return null;
  try {
    return JSON.parse(content.slice(ERROR_MARKER.length)) as ChatError;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// ErrorCard – user-friendly error display with retry
// ---------------------------------------------------------------------------

function ErrorCard({
  error,
  onRetry,
}: {
  error: ChatError;
  onRetry?: (originalMessage: string) => void;
}) {
  const [retrying, setRetrying] = useState(false);

  const handleRetry = useCallback(() => {
    if (error.originalMessage && onRetry) {
      setRetrying(true);
      onRetry(error.originalMessage);
      // Reset retrying state after a brief delay in case the send doesn't trigger re-render
      setTimeout(() => setRetrying(false), 2000);
    }
  }, [error.originalMessage, onRetry]);

  const iconColor: Record<ChatError['type'], string> = {
    network: 'text-red-400',
    api: 'text-amber-400',
    abort: 'text-zinc-400',
    model: 'text-orange-400',
    stream: 'text-red-400',
    unknown: 'text-red-400',
  };

  const typeLabel: Record<ChatError['type'], string> = {
    network: 'Network Error',
    api: 'API Error',
    abort: 'Request Cancelled',
    model: 'Model Unavailable',
    stream: 'Stream Interrupted',
    unknown: 'Error',
  };

  return (
    <div className="my-2 overflow-hidden rounded-xl border border-red-500/20 bg-red-500/5">
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-red-500/10 bg-red-500/10 px-4 py-2.5">
        <div className={`flex size-7 shrink-0 items-center justify-center rounded-lg bg-red-500/15 ${iconColor[error.type]}`}>
          <AlertTriangle className="size-4" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-xs font-semibold text-red-300">{typeLabel[error.type]}</span>
          <span className="text-[11px] text-red-400/70 line-clamp-1">{error.message}</span>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-3">
        {/* Error message */}
        <p className="text-sm leading-relaxed text-zinc-300">{error.message}</p>

        {/* Suggestions */}
        {error.suggestions.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Suggested Actions</span>
            <ul className="space-y-1">
              {error.suggestions.map((suggestion, idx) => (
                <li key={idx} className="flex items-start gap-2 text-xs text-zinc-400">
                  <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-amber-400/60" />
                  {suggestion}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Retry button */}
        {error.originalMessage && onRetry && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-red-500/20 bg-red-500/5 text-red-300 hover:bg-red-500/15 hover:text-red-200 hover:border-red-500/30"
            onClick={handleRetry}
            disabled={retrying}
          >
            <RotateCcw className={`size-3.5 ${retrying ? 'animate-spin' : ''}`} />
            {retrying ? 'Retrying...' : 'Retry'}
          </Button>
        )}
      </div>
    </div>
  );
}

// Maximum messages to render in the DOM at once (message windowing)
const VISIBLE_MESSAGE_LIMIT = 50;

// Throttle interval for preview updates during streaming
const PREVIEW_THROTTLE_MS = 300;

// ---------------------------------------------------------------------------
// Console capture script injected into inline preview iframes
// ---------------------------------------------------------------------------

const CONSOLE_CAPTURE_SCRIPT = `
<script>
(function() {
  var _id = 0;
  function send(level, args) {
    try {
      var strs = [];
      for (var i = 0; i < args.length; i++) {
        try {
          var a = args[i];
          if (a === null) strs.push('null');
          else if (a === undefined) strs.push('undefined');
          else if (typeof a === 'object') {
            try { strs.push(JSON.stringify(a, null, 2)); }
            catch(e) { strs.push(String(a)); }
          }
          else strs.push(String(a));
        } catch(e) { strs.push('[unknown]'); }
      }
      window.parent.postMessage({
        type: '__preview_console',
        level: level,
        args: strs,
        id: ++_id,
        ts: Date.now()
      }, '*');
    } catch(e) {}
  }
  var origLog = console.log;
  var origWarn = console.warn;
  var origError = console.error;
  var origInfo = console.info;
  console.log = function() { send('log', arguments); origLog.apply(console, arguments); };
  console.warn = function() { send('warn', arguments); origWarn.apply(console, arguments); };
  console.error = function() { send('error', arguments); origError.apply(console, arguments); };
  console.info = function() { send('info', arguments); origInfo.apply(console, arguments); };
  window.onerror = function(msg, src, line, col, err) {
    send('error', [msg + ' (line ' + line + ':' + col + ')']);
    return false;
  };
  window.addEventListener('unhandledrejection', function(e) {
    send('error', ['Unhandled Promise: ' + (e.reason && e.reason.message ? e.reason.message : String(e.reason))]);
  });
})();
<\/script>
`;

// ---------------------------------------------------------------------------
// buildSrcdocForInline – builds a self-contained HTML document for the inline
// preview iframe (extracted from LivePreview's buildSrcdoc)
// ---------------------------------------------------------------------------

function buildSrcdocForInline(html: string, css: string, js: string): string {
  // ── Always strip external CSS/JS file references from HTML ──
  let cleanedHtml = html;

  // Remove <link> tags referencing local CSS files
  cleanedHtml = cleanedHtml.replace(
    /<link\s+[^>]*href\s*=\s*["']([^"']+\.css)["'][^>]*\/?>/gi,
    (match, href: string) => {
      if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('//')) {
        return match;
      }
      return '';
    }
  );

  // Remove <script src="..."> tags referencing local JS files
  cleanedHtml = cleanedHtml.replace(
    /<script\s+[^>]*src\s*=\s*["']([^"']+\.js)["'][^>]*><\/script>/gi,
    (match, src: string) => {
      if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('//')) {
        return match;
      }
      return '';
    }
  );

  // Also remove self-closing <script src="..."/> variants
  cleanedHtml = cleanedHtml.replace(
    /<script\s+[^>]*src\s*=\s*["']([^"']+\.js)["'][^>]*\/>/gi,
    (match, src: string) => {
      if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('//')) {
        return match;
      }
      return '';
    }
  );

  // Clean up empty lines
  cleanedHtml = cleanedHtml.replace(/\n\s*\n\s*\n/g, '\n\n');

  // Self-contained document with no separate CSS/JS → use as-is (with refs already stripped)
  if (cleanedHtml && !css && !js && (/<html[\s>]/i.test(cleanedHtml) || /<!DOCTYPE/i.test(cleanedHtml))) {
    let doc = cleanedHtml;
    if (/<head[\s>]/i.test(doc)) {
      doc = doc.replace(
        /(<head[^>]*>)/i,
        `$1\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  ${CONSOLE_CAPTURE_SCRIPT}`
      );
    } else {
      doc = doc.replace(
        /(<html[^>]*>)/i,
        `$1\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  ${CONSOLE_CAPTURE_SCRIPT}\n</head>`
      );
    }
    return doc;
  }

  const isFullDocument =
    /<!DOCTYPE\s+html/i.test(cleanedHtml) ||
    /<html[\s>]/i.test(cleanedHtml);

  if (isFullDocument) {
    let doc = cleanedHtml;

    // Inject console capture script
    if (/<head[\s>]/i.test(doc)) {
      doc = doc.replace(
        /(<head[^>]*>)/i,
        `$1\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  ${CONSOLE_CAPTURE_SCRIPT}`
      );
    } else {
      doc = doc.replace(
        /(<html[^>]*>)/i,
        `$1\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  ${CONSOLE_CAPTURE_SCRIPT}\n</head>`
      );
    }

    // Inject inline CSS
    if (css) {
      const styleBlock = `\n<style>\n${css}\n</style>`;
      if (/<\/head>/i.test(doc)) {
        doc = doc.replace(/<\/head>/i, `${styleBlock}\n</head>`);
      } else if (/<head[^>]*>/i.test(doc)) {
        doc = doc.replace(/(<head[^>]*>)/i, `$1${styleBlock}`);
      }
    }

    // Inject inline JS
    if (js) {
      const scriptBlock = `\n<script>\ntry {\n${js}\n} catch(e) {\n  document.body.innerHTML += '<div style="color:red;padding:10px;font-family:monospace;background:rgba(255,0,0,0.1);border-top:1px solid red;margin-top:10px;">Error: ' + e.message + '</div>';\n}\n</script>`;
      if (/<\/body>/i.test(doc)) {
        doc = doc.replace(/<\/body>/i, `${scriptBlock}\n</body>`);
      } else {
        doc = doc.replace(/<\/html>/i, `${scriptBlock}\n</html>`);
      }
    }

    return doc;
  }

  // HTML fragment: wrap in a complete document
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${css ? `<style>\n${css}\n</style>` : ''}
  ${CONSOLE_CAPTURE_SCRIPT}
</head>
<body>
  ${cleanedHtml}
  ${js ? `<script>\ntry {\n${js}\n} catch(e) {\n  document.body.innerHTML += '<div style="color:red;padding:10px;font-family:monospace;background:rgba(255,0,0,0.1);border-top:1px solid red;margin-top:10px;">Error: ' + e.message + '</div>';\n}\n</script>` : ''}
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// InlinePreview – embedded iframe preview inside chat message bubbles
// ---------------------------------------------------------------------------

const InlinePreview = React.memo(function InlinePreview({
  html,
  css,
  js,
}: {
  html: string;
  css: string;
  js: string;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeKey, setIframeKey] = useState(0);

  const srcdoc = useMemo(
    () => buildSrcdocForInline(html, css, js),
    [html, css, js]
  );

  const handleOpenFull = useCallback(() => {
    const { setPreviewFiles, setIsPreviewOpen } = useAppStore.getState();
    setPreviewFiles({ html, css, js });
    setIsPreviewOpen(true);
  }, [html, css, js]);

  const handleRefresh = useCallback(() => {
    setIframeKey((k) => k + 1);
  }, []);

  const handleDownload = useCallback(async () => {
    if (!html && !css && !js) return;

    try {
      let cleanHtml = html || '';
      const cleanCss = css || '';
      const cleanJs = js || '';

      const hasMultipleFiles = (cleanCss && cleanHtml) || (cleanJs && cleanHtml);

      if (hasMultipleFiles) {
        const JSZip = (await import('jszip')).default;
        const zip = new JSZip();

        let modifiedHtml = cleanHtml;
        if (cleanCss) {
          modifiedHtml = modifiedHtml.replace(
            /<link\s+[^>]*href\s*=\s*["']([^"']+\.css)["'][^>]*\/?>/gi,
            (match: string, href: string) => {
              if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('//')) return match;
              return '';
            }
          );
          if (/<head[\s>]/i.test(modifiedHtml)) {
            modifiedHtml = modifiedHtml.replace(/(<head[^>]*>)/i, '$1\n  <link rel="stylesheet" href="styles.css">');
          }
          zip.file('styles.css', cleanCss);
        }
        if (cleanJs) {
          modifiedHtml = modifiedHtml.replace(
            /<script\s+[^>]*src\s*=\s*["']([^"']+\.js)["'][^>]*><\/script>/gi,
            (match: string, src: string) => {
              if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('//')) return match;
              return '';
            }
          );
          if (/<\/body>/i.test(modifiedHtml)) {
            modifiedHtml = modifiedHtml.replace(/<\/body>/i, '  <script src="script.js"></script>\n</body>');
          }
          zip.file('script.js', cleanJs);
        }

        modifiedHtml = modifiedHtml.replace(/<script>\s*\(function\(\)\s*\{[\s\S]*?__preview_console[\s\S]*?<\/script>/gi, '');

        if (!/<html[\s>]/i.test(modifiedHtml) && !/<!DOCTYPE/i.test(modifiedHtml)) {
          modifiedHtml = `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  ${cleanCss ? '  <link rel="stylesheet" href="styles.css">' : ''}\n</head>\n<body>\n${modifiedHtml}\n  ${cleanJs ? '<script src="script.js"></script>' : ''}\n</body>\n</html>`;
        }

        zip.file('index.html', modifiedHtml);

        const blob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'codeforge-project.zip';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success('Download started!', { description: 'codeforge-project.zip' });
      } else {
        const srcdocContent = buildSrcdocForInline(cleanHtml, cleanCss, cleanJs);
        const cleanSrcdoc = srcdocContent.replace(/<script>\s*\(function\(\)\s*\{[\s\S]*?__preview_console[\s\S]*?<\/script>/gi, '');

        const blob = new Blob([cleanSrcdoc], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'codeforge-preview.html';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success('Download started!', { description: 'codeforge-preview.html' });
      }
    } catch (error) {
      console.error('Download failed:', error);
      toast.error('Download failed', { description: 'Please try again.' });
    }
  }, [html, css, js]);

  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-zinc-700/50 bg-zinc-900">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-zinc-700/50 bg-zinc-800/80 px-2.5 py-1">
        <div className="flex items-center gap-1.5">
          <Monitor className="size-3 text-emerald-400" />
          <span className="text-[11px] font-medium text-zinc-300">Preview</span>
          <span className="flex items-center gap-1 rounded-sm bg-emerald-500/15 px-1 py-0.5 text-[8px] font-bold text-emerald-400">
            <span className="size-1 rounded-full bg-emerald-400" />
            LIVE
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 gap-1 px-1.5 text-[10px] text-zinc-400 hover:text-emerald-400"
                onClick={handleRefresh}
              >
                <RefreshCw className="size-2.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">Refresh</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 gap-1 px-1.5 text-[10px] text-zinc-400 hover:text-emerald-400"
                onClick={handleDownload}
              >
                <Download className="size-2.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">Download</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 gap-1 px-1.5 text-[10px] text-zinc-400 hover:text-emerald-400"
                onClick={handleOpenFull}
              >
                <ExternalLink className="size-2.5" />
                <span>Open Full</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">Open in full preview panel</TooltipContent>
          </Tooltip>
        </div>
      </div>
      {/* Iframe */}
      <div className="relative" style={{ height: 280 }}>
        <iframe
          ref={iframeRef}
          key={iframeKey}
          srcDoc={srcdoc}
          sandbox="allow-scripts allow-modals allow-same-origin allow-forms allow-popups"
          title="Inline Preview"
          className="h-full w-full border-0 rounded-b-lg bg-white"
        />
      </div>
    </div>
  );
});

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
// CodeBlock – syntax‑highlighted code with copy, apply & preview buttons
// ---------------------------------------------------------------------------

const CodeBlock = React.memo(function CodeBlock({
  language,
  code,
  onApply,
}: {
  language: string;
  code: string;
  onApply?: (code: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  // Determine if this code can be previewed in the live preview
  const isPreviewable = useMemo(() => {
    const lang = language.toLowerCase();
    if (['html', 'htm', 'markup'].includes(lang)) return true;
    // Also check if the content looks like a complete HTML document
    if (!lang && (code.includes('<!DOCTYPE') || code.includes('<html'))) return true;
    return false;
  }, [language, code]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API not available
    }
  }, [code]);

  const handlePreview = useCallback(() => {
    const { setPreviewFiles, setIsPreviewOpen } = useAppStore.getState();
    setPreviewFiles({ html: code, css: '', js: '' });
    setIsPreviewOpen(true);
  }, [code]);

  return (
    <div className="group relative my-3 overflow-hidden rounded-lg border border-zinc-700/50 bg-zinc-950">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-zinc-700/50 bg-zinc-900/80 px-4 py-1.5">
        <span className="text-xs font-medium text-zinc-400">{language || 'text'}</span>
        <div className="flex items-center gap-1">
          {isPreviewable && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-2 text-xs text-zinc-400 hover:text-emerald-400"
              onClick={handlePreview}
            >
              <Eye className="size-3" />
              Preview
            </Button>
          )}
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
});

// ---------------------------------------------------------------------------
// MarkdownRenderer – renders AI message content
// ---------------------------------------------------------------------------

const MarkdownRenderer = React.memo(function MarkdownRenderer({ content, onApplyCode }: { content: string; onApplyCode?: (code: string) => void }) {
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
});

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
  const [searchQuery, setSearchQuery] = useState('');
  const settings = useStore(s => s.settings);

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

  // Filter models by search query
  const filteredModels = useMemo(() => {
    if (!searchQuery.trim()) return models;
    const q = searchQuery.toLowerCase();
    return models.filter(m =>
      m.name.toLowerCase().includes(q) ||
      m.id.toLowerCase().includes(q) ||
      m.provider.toLowerCase().includes(q)
    );
  }, [models, searchQuery]);

  // Group models: Free vs Paid (for OpenRouter/OpenCode Zen), or by provider name
  const groupedModels = (provider === 'openrouter' || provider === 'opencode')
    ? (() => {
        const auto = filteredModels.filter((m) => m.id === 'openrouter/auto');
        const free = filteredModels.filter((m) => m.isFree && m.id !== 'openrouter/auto');
        const paid = filteredModels.filter((m) => !m.isFree);
        const groups: Record<string, DynamicModel[]> = {};
        if (auto.length) groups['⚡ Auto-Routing'] = auto;
        if (free.length) groups['🆓 Free Models'] = free;
        if (paid.length) groups['💎 Paid Models'] = paid;
        return groups;
      })()
    : { [provider.toUpperCase()]: filteredModels };

  // Show current model free/paid badge
  const isCurrentFree = currentModel?.isFree ?? true;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-1.5 rounded-md border border-zinc-700/60 bg-zinc-800/60 px-2 py-1 text-xs text-zinc-300 transition-colors hover:bg-zinc-700/80 hover:text-zinc-100">
          <Wifi className="size-3 text-emerald-400" />
          <span className="max-w-[120px] truncate">{currentModel?.name || selectedModel}</span>
          {isCurrentFree ? (
            <span className="shrink-0 rounded bg-emerald-500/15 px-1 py-0.5 text-[8px] font-bold text-emerald-400">FREE</span>
          ) : (
            <span className="shrink-0 rounded bg-amber-500/15 px-1 py-0.5 text-[8px] font-bold text-amber-400">PAID</span>
          )}
          <ChevronDown className="size-3 text-zinc-500" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-80 border-zinc-700 bg-zinc-800 p-0 shadow-xl"
      >
        {/* Header with refresh */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-700/50">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            {provider === 'openrouter' ? 'OpenRouter' : provider} Models
          </span>
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-zinc-600">{models.length} available</span>
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
        </div>

        {/* Search filter */}
        <div className="px-2 pt-2 pb-1">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search models..."
              className="w-full rounded-md bg-zinc-900/60 border border-zinc-700/50 py-1.5 pl-7 pr-3 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40"
            />
          </div>
        </div>

        <div className="max-h-72 overflow-y-auto custom-scrollbar">
          {isLoading && models.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-4 animate-spin text-zinc-500" />
              <span className="ml-2 text-xs text-zinc-500">Loading models...</span>
            </div>
          ) : filteredModels.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-xs text-zinc-500">
              <Search className="size-4 mb-2" />
              No models found
            </div>
          ) : (
            Object.entries(groupedModels).map(([group, groupModels]) => (
              <div key={group}>
                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                  {group}
                  <span className="text-zinc-600">({groupModels.length})</span>
                </div>
                {groupModels.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => {
                      onModelChange(model.id);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-xs transition-colors ${
                      selectedModel === model.id
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100'
                    }`}
                  >
                    <span className="flex-1 text-left truncate">{model.name}</span>
                    {model.isFree ? (
                      <span className="flex items-center gap-0.5 shrink-0 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-medium text-emerald-400">
                        <Gift className="size-2.5" />
                        FREE
                      </span>
                    ) : (
                      <span className="flex items-center gap-0.5 shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-medium text-amber-400">
                        <CreditCard className="size-2.5" />
                        PAID
                      </span>
                    )}
                    {model.pricing && model.pricing.prompt && model.pricing.prompt !== '0' && (
                      <span className="text-[9px] text-zinc-600 font-mono shrink-0">
                        ${model.pricing.prompt}/M
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

        {/* Footer hint */}
        {provider === 'openrouter' && !settings.apiKey && (
          <div className="border-t border-zinc-700/50 px-3 py-2">
            <span className="text-[10px] text-amber-400/80 flex items-center gap-1">
              <CreditCard className="size-3" />
              Add an API key in Settings to use paid models
            </span>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// ChatHeader
// ---------------------------------------------------------------------------

function ChatHeader() {
  const currentConversation = useChatState(s => s.currentConversation);
  const setCurrentConversation = useChatState(s => s.setCurrentConversation);
  const isChatLoading = useChatState(s => s.isChatLoading);
  const selectedModel = useUIState(s => s.selectedModel);
  const setSelectedModel = useUIState(s => s.setSelectedModel);
  const settings = useStore(s => s.settings);
  const setSettings = useStore(s => s.setSettings);

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

  const handleModelChange = useCallback(async (model: string) => {
    setSelectedModel(model);
    // Also persist to backend settings
    const updatedSettings = { ...settings, model };
    setSettings(updatedSettings);
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: updatedSettings }),
      });
    } catch {
      // Non-critical: model choice is saved in local state
    }
  }, [setSelectedModel, settings, setSettings]);

  // Show connection status (check per-provider key or legacy key)
  const currentProvider = settings.provider || 'openrouter';
  const isConnected = !!(settings[`${currentProvider}_apiKey`] || settings.apiKey);

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
        <div className="relative flex size-16 items-center justify-center rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-500/20">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-transparent" />
          <Bot className="relative size-8 text-emerald-500" />
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
            className="group relative flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-left text-sm text-zinc-300 transition-all hover:border-emerald-500/30 hover:bg-zinc-800/80 hover:text-zinc-100 overflow-hidden"
          >
            <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-emerald-500/5 to-transparent" />
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
// FileCreateBar – Shows below AI messages that contain file blocks
// ---------------------------------------------------------------------------

function FileCreateBar({
  content,
  onFilesCreated,
}: {
  content: string;
  onFilesCreated: (files: ProjectFile[]) => void;
}) {
  const [isCreating, setIsCreating] = useState(false);
  const [isCreated, setIsCreated] = useState(false);
  const [createdCount, setCreatedCount] = useState(0);
  const parsedFiles = useMemo(() => parseFilesFromResponse(content), [content]);
  const currentProject = useProjectState(s => s.currentProject);
  const addFile = useFileState(s => s.addFile);
  const setCurrentFile = useFileState(s => s.setCurrentFile);
  const updateFile = useFileState(s => s.updateFile);
  const hasAutoTriggered = useRef(false);

  const handleCreateFiles = useCallback(async () => {
    if (parsedFiles.length === 0) return;
    setIsCreating(true);
    try {
      const res = await fetch('/api/files/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: parsedFiles.map((f) => ({
            name: f.fileName,
            path: f.filePath,
            content: f.content,
            language: f.language,
            isFolder: false,
            projectId: currentProject?.id || undefined,
          })),
        }),
      });

      if (!res.ok) throw new Error('Failed to create files');

      const data = await res.json();
      const createdFiles: ProjectFile[] = (data.files || []).map((f: Record<string, unknown>) => ({
        id: f.id as string,
        name: f.name as string,
        path: f.path as string,
        content: f.content as string,
        language: f.language as string | undefined,
        isFolder: (f.isFolder as boolean) || false,
        projectId: (f.projectId as string) || null,
        createdAt: f.createdAt as string,
        updatedAt: f.updatedAt as string,
      }));

      // Update the store with all created files
      for (const file of createdFiles) {
        const existing = useAppStore.getState().files.find((f) => f.id === file.id);
        if (existing) {
          updateFile(file.id, file);
        } else {
          addFile(file);
        }
      }

      // Open the first file in the editor
      if (createdFiles.length > 0) {
        setCurrentFile(createdFiles[0]);
      }

      // Update preview files if HTML/CSS/JS were created
      const htmlFile = createdFiles.find((f) => {
        const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
        return ['html', 'htm'].includes(ext);
      });
      // Combine multiple CSS files
      const cssFiles = createdFiles.filter((f) => {
        const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
        return ['css', 'scss', 'less'].includes(ext);
      });
      // Combine multiple JS files
      const jsFiles = createdFiles.filter((f) => {
        const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
        return ['js', 'jsx'].includes(ext);
      });

      if (htmlFile || cssFiles.length > 0 || jsFiles.length > 0) {
        const { setPreviewFiles, setIsPreviewOpen } = useAppStore.getState();
        setPreviewFiles({
          html: htmlFile?.content ?? '',
          css: cssFiles.map(f => `/* ${f.name} */\n${f.content}`).join('\n\n'),
          js: jsFiles.map(f => `// ${f.name}\n${f.content}`).join('\n\n'),
        });
        setIsPreviewOpen(true);
      }

      setCreatedCount(data.created + data.updated);
      setIsCreated(true);
      onFilesCreated(createdFiles);

      toast.success(`${data.created + data.updated} file${(data.created + data.updated) !== 1 ? 's' : ''} auto-created`, {
        description: createdFiles.map((f) => f.name).join(', '),
        duration: 4000,
      });
    } catch (error) {
      console.error('Failed to create files:', error);
      toast.error('Failed to auto-create files');
    } finally {
      setIsCreating(false);
    }
  }, [parsedFiles, currentProject, addFile, setCurrentFile, updateFile, onFilesCreated]);

  // Auto-trigger file creation on mount
  useEffect(() => {
    if (!hasAutoTriggered.current && parsedFiles.length > 0) {
      hasAutoTriggered.current = true;
      handleCreateFiles();
    }
  }, [handleCreateFiles, parsedFiles.length]);

  if (parsedFiles.length === 0) return null;

  return (
    <div className="mt-2 rounded-lg border border-zinc-700/50 bg-zinc-800/50 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {isCreated ? (
            <>
              <FileCheck2 className="size-4 shrink-0 text-emerald-400" />
              <span className="text-xs text-emerald-400 font-medium">
                {createdCount} file{createdCount !== 1 ? 's' : ''} auto-created!
              </span>
              <div className="flex gap-1 overflow-hidden">
                {parsedFiles.slice(0, 4).map((f) => (
                  <span
                    key={f.filePath}
                    className="shrink-0 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-mono text-emerald-400"
                  >
                    {f.fileName}
                  </span>
                ))}
                {parsedFiles.length > 4 && (
                  <span className="text-[10px] text-zinc-500">
                    +{parsedFiles.length - 4} more
                  </span>
                )}
              </div>
            </>
          ) : isCreating ? (
            <>
              <Loader2 className="size-4 shrink-0 text-emerald-400 animate-spin" />
              <span className="text-xs text-zinc-300">
                Auto-creating {parsedFiles.length} file{parsedFiles.length !== 1 ? 's' : ''}...
              </span>
              <div className="flex gap-1 overflow-hidden">
                {parsedFiles.slice(0, 4).map((f) => (
                  <span
                    key={f.filePath}
                    className="shrink-0 rounded bg-zinc-700/60 px-1.5 py-0.5 text-[10px] font-mono text-zinc-400"
                  >
                    {f.fileName}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <>
              <FilePlus2 className="size-4 shrink-0 text-amber-400" />
              <span className="text-xs text-zinc-300">
                {parsedFiles.length} file{parsedFiles.length !== 1 ? 's' : ''} detected
              </span>
              <div className="flex gap-1 overflow-hidden">
                {parsedFiles.slice(0, 4).map((f) => (
                  <span
                    key={f.filePath}
                    className="shrink-0 rounded bg-zinc-700/60 px-1.5 py-0.5 text-[10px] font-mono text-zinc-400"
                  >
                    {f.fileName}
                  </span>
                ))}
                {parsedFiles.length > 4 && (
                  <span className="text-[10px] text-zinc-500">
                    +{parsedFiles.length - 4} more
                  </span>
                )}
              </div>
            </>
          )}
        </div>
        {!isCreated && !isCreating && (
          <Button
            size="sm"
            onClick={handleCreateFiles}
            disabled={isCreating}
            className="h-7 gap-1.5 rounded-md bg-emerald-600 px-3 text-xs text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            <FolderCheck className="size-3" />
            Create Files
          </Button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MessageBubble
// ---------------------------------------------------------------------------

const MessageBubble = React.memo(function MessageBubble({
  role,
  content,
  model,
  responseTime,
  onApplyCode,
  onFilesCreated,
  onRetry,
}: {
  role: 'user' | 'assistant' | 'system';
  content: string;
  model?: string;
  responseTime?: number;
  onApplyCode?: (code: string) => void;
  onFilesCreated?: (files: ProjectFile[]) => void;
  onRetry?: (originalMessage: string) => void;
}) {
  const isUser = role === 'user';

  // Check if the content contains error marker(s)
  const errorParts = useMemo(() => {
    const parts: { type: 'text' | 'error'; content: string }[] = [];
    const marker = ERROR_MARKER;
    let remaining = content;
    while (remaining.includes(marker)) {
      const markerIdx = remaining.indexOf(marker);
      // Push any text before the marker
      if (markerIdx > 0) {
        parts.push({ type: 'text', content: remaining.slice(0, markerIdx) });
      }
      // Try to parse the error JSON after the marker
      const afterMarker = remaining.slice(markerIdx + marker.length);
      try {
        // Find the end of the JSON object — it could be followed by more text
        let depth = 0;
        let jsonEnd = -1;
        for (let i = 0; i < afterMarker.length; i++) {
          if (afterMarker[i] === '{') depth++;
          else if (afterMarker[i] === '}') {
            depth--;
            if (depth === 0) { jsonEnd = i + 1; break; }
          }
        }
        if (jsonEnd > 0) {
          const jsonStr = afterMarker.slice(0, jsonEnd);
          const parsed = JSON.parse(jsonStr) as ChatError;
          parts.push({ type: 'error', content: jsonStr });
          remaining = afterMarker.slice(jsonEnd);
        } else {
          // Can't find JSON end — treat rest as error
          parts.push({ type: 'error', content: afterMarker });
          remaining = '';
        }
      } catch {
        // If parsing fails, push the rest as text
        parts.push({ type: 'text', content: remaining });
        remaining = '';
      }
    }
    // Push any remaining text
    if (remaining.trim()) {
      parts.push({ type: 'text', content: remaining });
    }
    // If no markers found at all, return the whole content as text
    if (parts.length === 0) {
      parts.push({ type: 'text', content });
    }
    return parts;
  }, [content]);

  // Check if the entire message is just an error (no text parts)
  const isPureError = errorParts.length === 1 && errorParts[0].type === 'error';

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={`flex gap-3 px-4 py-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
    >
      {/* Avatar */}
      <div
        className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${
          isUser
            ? 'bg-zinc-700 text-zinc-300'
            : isPureError
              ? 'bg-red-500/15 text-red-400'
              : 'bg-emerald-500/15 text-emerald-400'
        }`}
      >
        {isUser ? <User className="size-4" /> : isPureError ? <AlertTriangle className="size-4" /> : <Bot className="size-4" />}
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
            isUser ? 'text-zinc-500' : isPureError ? 'text-red-400/80' : 'text-emerald-400/80'
          }`}
        >
          {isUser ? 'You' : isPureError ? 'CodeForge AI — Error' : (
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
            <>
              {errorParts.map((part, idx) =>
                part.type === 'text' ? (
                  <React.Fragment key={idx}>
                    <MarkdownRenderer content={part.content} onApplyCode={onApplyCode} />
                    {/* Inline HTML preview for text parts */}
                    {(() => {
                      const previewContent = extractPreviewContent(part.content);
                      return previewContent && (previewContent.html || previewContent.css || previewContent.js) ? (
                        <InlinePreview html={previewContent.html} css={previewContent.css} js={previewContent.js} />
                      ) : null;
                    })()}
                  </React.Fragment>
                ) : (
                  <ErrorCard
                    key={idx}
                    error={decodeChatError(ERROR_MARKER + part.content) ?? {
                      type: 'unknown',
                      message: part.content,
                      suggestions: [],
                    }}
                    onRetry={onRetry}
                  />
                )
              )}
            </>
          )}
          {/* File auto-creation bar for AI messages */}
          {!isUser && onFilesCreated && !isPureError && (
            <FileCreateBar content={content} onFilesCreated={onFilesCreated} />
          )}
        </div>
        {/* HTML preview available banner — only for non-error messages */}
        {!isUser && !isPureError && extractPreviewContent(content) && (extractPreviewContent(content)!.html || extractPreviewContent(content)!.css || extractPreviewContent(content)!.js) && (
          <button
            onClick={() => {
              const pc = extractPreviewContent(content);
              if (pc) {
                const { setPreviewFiles, setIsPreviewOpen } = useAppStore.getState();
                setPreviewFiles(pc);
                setIsPreviewOpen(true);
              }
            }}
            className="mt-1 flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400 transition-all hover:bg-emerald-500/20 hover:border-emerald-500/50 w-fit"
          >
            <Eye className="size-3" />
            <span>HTML preview available</span>
            <span className="text-emerald-400/60">—</span>
            <span className="underline underline-offset-2">Open Preview Panel</span>
          </button>
        )}
        {/* Response time indicator for AI messages */}
        {!isUser && !isPureError && responseTime !== undefined && responseTime > 0 && (
          <span className="flex items-center gap-1 text-[10px] text-zinc-600">
            <Activity className="size-2.5" />
            Done · {responseTime.toFixed(1)}s
          </span>
        )}
      </div>
    </motion.div>
  );
});

// ---------------------------------------------------------------------------
// StreamingMessage – the streaming message bubble with enhanced UX
// ---------------------------------------------------------------------------

const StreamingMessage = React.memo(function StreamingMessage({
  content,
  model,
  onApplyCode,
  startTime,
}: {
  content: string;
  model: string;
  onApplyCode?: (code: string) => void;
  startTime?: number;
}) {
  // Approximate token count (1 token ≈ 4 chars)
  const tokenCount = useMemo(() => Math.ceil(content.length / 4), [content.length]);

  // Elapsed time counter
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - (startTime ?? Date.now())) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  // Typing speed indicator (WPM)
  const prevContentLengthRef = useRef(0);
  const prevTimestampRef = useRef(Date.now());
  const [wpm, setWpm] = useState(0);
  useEffect(() => {
    const now = Date.now();
    const deltaChars = content.length - prevContentLengthRef.current;
    const deltaMs = now - prevTimestampRef.current;
    if (deltaMs > 0 && deltaChars > 0) {
      // WPM = (chars / 5) / (minutes)
      const minutes = deltaMs / 60000;
      const currentWpm = Math.round((deltaChars / 5) / minutes);
      // Smooth the WPM with a moving average
      setWpm((prev) => prev === 0 ? currentWpm : Math.round(prev * 0.7 + currentWpm * 0.3));
    }
    prevContentLengthRef.current = content.length;
    prevTimestampRef.current = now;
  }, [content]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="flex gap-3 px-4 py-3"
    >
      {/* Avatar with pulse ring */}
      <div className="relative">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
          <Bot className="size-4" />
        </div>
        {/* Animated pulse ring around avatar */}
        <motion.div
          className="absolute inset-0 rounded-lg border border-emerald-400/40"
          animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <div className="flex flex-col gap-1 max-w-[85%] min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-emerald-400/80">
            CodeForge AI
            {model && (
              <span className="ml-1.5 text-zinc-600 font-normal">
                via {model}
              </span>
            )}
          </span>
          {/* Streaming status badge with elapsed time & WPM */}
          <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
            <Activity className="size-2.5" />
            Streaming
            <span className="text-emerald-400/60">·</span>
            {elapsed}s
            <span className="text-emerald-400/60">·</span>
            {tokenCount.toLocaleString()} tokens
            {wpm > 0 && (
              <>
                <span className="text-emerald-400/60">·</span>
                {wpm} wpm
              </>
            )}
          </span>
        </div>
        <div className="rounded-2xl rounded-tl-sm bg-zinc-800 px-4 py-2.5 text-sm leading-relaxed text-zinc-300 relative">
          <MarkdownRenderer content={content} onApplyCode={onApplyCode} />
          {/* Blinking cursor */}
          <span className="inline-block w-1.5 h-4 bg-emerald-400 animate-pulse ml-0.5 align-text-bottom" />
          {/* Inline HTML preview */}
          {(() => {
            const previewContent = extractPreviewContent(content);
            return previewContent && (previewContent.html || previewContent.css || previewContent.js) ? (
              <InlinePreview html={previewContent.html} css={previewContent.css} js={previewContent.js} />
            ) : null;
          })()}
        </div>
      </div>
    </motion.div>
  );
});

// ---------------------------------------------------------------------------
// TypingIndicator – shown while waiting for streaming to start
// ---------------------------------------------------------------------------

function TypingIndicator({ modelName }: { modelName: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="flex gap-3 px-4 py-3"
    >
      <div className="relative">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
          <Bot className="size-4" />
        </div>
        <motion.div
          className="absolute inset-0 rounded-lg border border-emerald-400/40"
          animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-medium text-emerald-400/80">
          CodeForge AI
          {modelName && (
            <span className="ml-1.5 text-zinc-600 font-normal">
              via {modelName}
            </span>
          )}
        </span>
        <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm bg-zinc-800 px-4 py-3 text-sm text-zinc-400">
          <Loader2 className="size-3.5 animate-spin text-emerald-500" />
          <span>Calling {modelName || 'AI'}...</span>
          <LoadingDots />
        </div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// MessageInput – with Stop button during streaming
// ---------------------------------------------------------------------------

function MessageInput({
  onSend,
  isLoading,
  onStop,
}: {
  onSend: (message: string) => void;
  isLoading: boolean;
  onStop: () => void;
}) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const selectedAgent = useUIState(s => s.selectedAgent);
  const setSelectedAgent = useUIState(s => s.setSelectedAgent);

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

        {/* Stop button appears during streaming, replaces send button */}
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="stop"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    onClick={onStop}
                    className="size-9 shrink-0 rounded-xl bg-red-600 text-white hover:bg-red-500 shadow-lg shadow-red-900/30"
                  >
                    <Square className="size-4 fill-current" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Stop generating</TooltipContent>
              </Tooltip>
            </motion.div>
          ) : (
            <motion.div
              key="send"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="submit"
                    size="icon"
                    disabled={!input.trim()}
                    className="size-9 shrink-0 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40"
                  >
                    <Send className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Send message</TooltipContent>
              </Tooltip>
            </motion.div>
          )}
        </AnimatePresence>
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
  const currentConversation = useChatState(s => s.currentConversation);
  const currentProject = useProjectState(s => s.currentProject);
  const isChatLoading = useChatState(s => s.isChatLoading);
  const setIsChatLoading = useChatState(s => s.setIsChatLoading);
  const addMessageToConversation = useChatState(s => s.addMessageToConversation);
  const setCurrentConversation = useChatState(s => s.setCurrentConversation);
  const setCurrentFile = useFileState(s => s.setCurrentFile);
  const currentFile = useFileState(s => s.currentFile);
  const selectedAgent = useUIState(s => s.selectedAgent);
  const selectedModel = useUIState(s => s.selectedModel);

  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamingContentRef = useRef<string>('');
  const streamingHadErrorRef = useRef<string | null>(null);
  const streamStartRef = useRef<number>(0);
  const [streamingContent, setStreamingContent] = useState<string>('');
  const deferredStreamingContent = useDeferredValue(streamingContent);
  const [streamingModel, setStreamingModel] = useState<string>('');
  const [streamStartTime, setStreamStartTime] = useState<number>(0);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  // Message windowing: track how many earlier messages are "expanded"
  const [visibleMessageLimit, setVisibleMessageLimit] = useState(VISIBLE_MESSAGE_LIMIT);

  // Throttle refs for preview updates
  const lastPreviewUpdateRef = useRef(0);
  const pendingPreviewContentRef = useRef<string>('');
  const pendingPreviewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check scroll position to show/hide scroll buttons
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    // Show scroll-to-top when scrolled down more than 300px
    setShowScrollTop(scrollTop > 300);
    // Show scroll-to-bottom when not at the bottom
    setShowScrollBottom(scrollHeight - scrollTop - clientHeight > 100);
  }, []);

  // Scroll to top
  const scrollToTop = useCallback(() => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Scroll to bottom with smooth animation
  const scrollToBottom = useCallback(() => {
    scrollContainerRef.current?.scrollTo({ top: scrollContainerRef.current?.scrollHeight || 0, behavior: 'smooth' });
  }, []);

  // Auto-scroll to bottom on new messages (only if already near bottom)
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    // Only auto-scroll if user is near the bottom (within 200px)
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 200;
    if (isNearBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [currentConversation?.messages.length, streamingContent, isChatLoading]);

  // Reset visible limit when conversation changes
  useEffect(() => {
    setVisibleMessageLimit(VISIBLE_MESSAGE_LIMIT);
  }, [currentConversation?.id]);

  const handleApplyCode = useCallback(
    (code: string) => {
      if (currentFile) {
        setCurrentFile({ ...currentFile, content: code });
      }
    },
    [currentFile, setCurrentFile],
  );

  const handleFilesCreated = useCallback(
    (files: ProjectFile[]) => {
      // Files are already added to the store by FileCreateBar
      console.log(`[ChatPanel] ${files.length} files created from AI response`);
    },
    [],
  );

  // Stop generating handler
  const handleStop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  // Throttled preview update function
  const throttledPreviewUpdate = useCallback((content: string) => {
    const now = Date.now();
    const previewContent = extractPreviewContent(content);
    // Always update if we have previewable content (HTML detected)
    if (previewContent && (previewContent.html || previewContent.css || previewContent.js)) {
      // Use shorter throttle if we have HTML content (more urgent to show preview)
      const throttleMs = previewContent.html ? PREVIEW_THROTTLE_MS / 2 : PREVIEW_THROTTLE_MS;
      if (now - lastPreviewUpdateRef.current >= throttleMs) {
        lastPreviewUpdateRef.current = now;
        const { setPreviewFiles, setIsPreviewOpen } = useAppStore.getState();
        setPreviewFiles(previewContent);
        setIsPreviewOpen(true);
      } else {
        // Store the latest content and schedule a flush after the throttle window
        pendingPreviewContentRef.current = content;
        if (!pendingPreviewTimerRef.current) {
          pendingPreviewTimerRef.current = setTimeout(() => {
            pendingPreviewTimerRef.current = null;
            if (pendingPreviewContentRef.current) {
              const pendingContent = extractPreviewContent(pendingPreviewContentRef.current);
              if (pendingContent && (pendingContent.html || pendingContent.css || pendingContent.js)) {
                const { setPreviewFiles, setIsPreviewOpen } = useAppStore.getState();
                setPreviewFiles(pendingContent);
                setIsPreviewOpen(true);
              }
              lastPreviewUpdateRef.current = Date.now();
              pendingPreviewContentRef.current = '';
            }
          }, throttleMs);
        }
      }
    }
  }, []);

  // Flush any pending preview update
  const flushPreviewUpdate = useCallback((content: string) => {
    // Clear any pending throttle timer
    if (pendingPreviewTimerRef.current) {
      clearTimeout(pendingPreviewTimerRef.current);
      pendingPreviewTimerRef.current = null;
    }
    const previewContent = extractPreviewContent(content);
    if (previewContent && (previewContent.html || previewContent.css || previewContent.js)) {
      const { setPreviewFiles, setIsPreviewOpen } = useAppStore.getState();
      setPreviewFiles(previewContent);
      setIsPreviewOpen(true);
    }
    lastPreviewUpdateRef.current = Date.now();
    pendingPreviewContentRef.current = '';
  }, []);

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
      const startTime = Date.now();
      setStreamStartTime(startTime);
      streamStartRef.current = startTime;
      streamingContentRef.current = '';
      streamingHadErrorRef.current = null;
      setStreamingContent('');
      setStreamingModel('');
      lastPreviewUpdateRef.current = 0;
      pendingPreviewContentRef.current = '';
      if (pendingPreviewTimerRef.current) {
        clearTimeout(pendingPreviewTimerRef.current);
        pendingPreviewTimerRef.current = null;
      }
      // Clear the preview content cache so it re-extracts for new messages
      previewCache.lastInput = '';
      previewCache.lastResult = null;

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
          const statusText = res.statusText || 'Unknown error';
          let apiErrorMsg = `API error: ${res.status}`;
          if (res.status === 401) {
            apiErrorMsg = 'Authentication failed — your API key may be invalid or missing.';
          } else if (res.status === 403) {
            apiErrorMsg = 'Access denied — you may not have permission to use this model.';
          } else if (res.status === 429) {
            apiErrorMsg = 'Rate limit exceeded — too many requests. Please wait and try again.';
          } else if (res.status === 500) {
            apiErrorMsg = `Server error (${res.status}): The AI provider is experiencing issues.`;
          } else if (res.status === 502 || res.status === 503) {
            apiErrorMsg = `Service unavailable (${res.status}): The AI provider is temporarily down.`;
          } else {
            apiErrorMsg = `API error ${res.status}: ${statusText}`;
          }
          throw new Error(apiErrorMsg);
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
          // SSE line buffer — prevents losing tokens split across TCP chunks
          let sseBuffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            // Append to buffer and split by newlines
            sseBuffer += decoder.decode(value, { stream: true });
            const lines = sseBuffer.split('\n');
            // Keep the last (potentially incomplete) line in the buffer
            sseBuffer = lines.pop() || '';

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
                    // Track that we saw an API error during streaming
                    streamingHadErrorRef.current = parsed.error;
                  } else if (parsed.content) {
                    fullContent += parsed.content;
                    setStreamingContent(fullContent);
                    streamingContentRef.current = fullContent;

                    // Throttled preview update during streaming
                    throttledPreviewUpdate(fullContent);
                  }
                  if (parsed.model) {
                    lastModel = parsed.model;
                    setStreamingModel(lastModel);
                  }
                } catch {
                  // Not valid JSON — ignore (may be partial)
                }
              }
            }
          }

          // Process any remaining data in the buffer
          if (sseBuffer.trim()) {
            const trimmed = sseBuffer.trim();
            if (trimmed.startsWith('data: ') && trimmed !== 'data: [DONE]') {
              try {
                const parsed = JSON.parse(trimmed.slice(6));
                if (parsed.content) {
                  fullContent += parsed.content;
                  setStreamingContent(fullContent);
                  streamingContentRef.current = fullContent;
                }
                if (parsed.model) {
                  lastModel = parsed.model;
                  setStreamingModel(lastModel);
                }
              } catch {
                // Incomplete JSON — ignore
              }
            }
          }

          // Final preview extraction after streaming completes
          flushPreviewUpdate(fullContent);

          // Finalize the streaming message
          const responseTimeSec = ((Date.now() - streamStartRef.current) / 1000);

          // If the stream contained an API error, convert to a structured error message
          const streamError = streamingHadErrorRef.current;
          const finalContent = streamError
            ? encodeChatError({
                type: 'api',
                message: streamError,
                suggestions: [
                  'Check your API key in Settings',
                  'Try a different model from the model selector',
                  'Verify the model is available and not rate-limited',
                ],
                originalMessage: message,
              })
            : (fullContent || 'No response received.');

          const assistantMessage = {
            id: crypto.randomUUID(),
            role: 'assistant' as const,
            content: finalContent,
            tokens: Math.ceil(message.length / 4) + Math.ceil(fullContent.length / 4),
            model: lastModel,
            responseTime: responseTimeSec,
            createdAt: new Date().toISOString(),
          };
          addMessageToConversation(assistantMessage);
        } else {
          // Handle JSON response (non-streaming fallback)
          const data = await res.json();
          const responseContent = data.message ?? data.content ?? 'No response received.';
          const responseTimeSec = ((Date.now() - streamStartRef.current) / 1000);
          const assistantMessage = {
            id: crypto.randomUUID(),
            role: 'assistant' as const,
            content: responseContent,
            tokens: data.tokens,
            model: data.model || selectedModel,
            responseTime: responseTimeSec,
            createdAt: new Date().toISOString(),
          };
          addMessageToConversation(assistantMessage);

          // Also extract preview from non-streaming response
          const previewContent = extractPreviewContent(responseContent);
          if (previewContent && (previewContent.html || previewContent.css || previewContent.js)) {
            const { setPreviewFiles, setIsPreviewOpen } = useAppStore.getState();
            setPreviewFiles(previewContent);
            setIsPreviewOpen(true);
          }
        }
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          // User cancelled — finalize what we have
          if (streamingContentRef.current) {
            const responseTimeSec = ((Date.now() - streamStartRef.current) / 1000);
            const assistantMessage = {
              id: crypto.randomUUID(),
              role: 'assistant' as const,
              content: streamingContentRef.current,
              tokens: Math.ceil(streamingContentRef.current.length / 4),
              model: streamingModel || selectedModel,
              responseTime: responseTimeSec,
              createdAt: new Date().toISOString(),
            };
            addMessageToConversation(assistantMessage);
          }
          toast.info('Request was cancelled.', { duration: 2000 });
        } else {
          const errStr = (error as Error)?.message || String(error);
          const isNetworkError = errStr.includes('network') || errStr.includes('fetch') || errStr.includes('Failed to fetch') || errStr.includes('NetworkError') || errStr.includes('ERR_INTERNET_DISCONNECTED') || errStr.includes('net::');
          const isModelError = errStr.toLowerCase().includes('no endpoints') ||
            errStr.toLowerCase().includes('not available') ||
            errStr.toLowerCase().includes('model not found') ||
            errStr.includes('404');

          // If we already have streaming content, save it with a stream-interrupted error card
          if (streamingContentRef.current && streamingContentRef.current.length > 10) {
            const responseTimeSec = ((Date.now() - streamStartRef.current) / 1000);
            const assistantMessage = {
              id: crypto.randomUUID(),
              role: 'assistant' as const,
              content: streamingContentRef.current +
                '\n\n' +
                encodeChatError({
                  type: 'stream',
                  message: 'The AI stream was interrupted. Partial response is shown above.',
                  suggestions: [
                    'Check your internet connection',
                    'Try a different model from the model selector',
                    'Click Retry to resend your message',
                  ],
                  originalMessage: message,
                }),
              tokens: Math.ceil(streamingContentRef.current.length / 4),
              model: streamingModel || selectedModel,
              responseTime: responseTimeSec,
              createdAt: new Date().toISOString(),
            };
            addMessageToConversation(assistantMessage);

            // Try to extract preview from partial content too
            flushPreviewUpdate(streamingContentRef.current);
          } else {
            // No streaming content — show a dedicated error card
            let chatError: ChatError;

            if (isNetworkError) {
              chatError = {
                type: 'network',
                message: 'Could not reach the server. Check your internet connection.',
                suggestions: [
                  'Verify your internet connection is active',
                  'Check your API key in Settings',
                  'The provider might be temporarily down — try again in a moment',
                  'Try a different model from the model selector',
                ],
                originalMessage: message,
              };
            } else if (isModelError) {
              chatError = {
                type: 'model',
                message: `The model "${selectedModel}" is currently unavailable.`,
                suggestions: [
                  'Try switching to openrouter/auto (auto-routes to the best available model)',
                  'Select a different model from the model selector',
                  'Free models can be temporarily unavailable — try again later',
                ],
                originalMessage: message,
              };
            } else {
              chatError = {
                type: 'unknown',
                message: `Something went wrong: ${errStr}`,
                suggestions: [
                  'Check your API key in Settings',
                  'Try a different model from the model selector',
                  'If the problem persists, try starting a new conversation',
                ],
                originalMessage: message,
              };
            }

            const errorMessage = {
              id: crypto.randomUUID(),
              role: 'assistant' as const,
              content: encodeChatError(chatError),
              createdAt: new Date().toISOString(),
            };
            addMessageToConversation(errorMessage);
          }
          console.error('Chat API error:', error);
        }
      } finally {
        setIsChatLoading(false);
        setStreamingContent('');
        setStreamingModel('');
        streamingContentRef.current = '';
        streamingHadErrorRef.current = null;
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
      throttledPreviewUpdate,
      flushPreviewUpdate,
    ],
  );

  const handlePromptClick = useCallback(
    (prompt: string) => {
      handleSend(prompt);
    },
    [handleSend],
  );

  const messages = currentConversation?.messages ?? [];

  // Message windowing: only render a slice of messages
  const hasMoreMessages = messages.length > visibleMessageLimit;
  const visibleMessages = useMemo(() => {
    if (messages.length <= visibleMessageLimit) return messages;
    return messages.slice(messages.length - visibleMessageLimit);
  }, [messages, visibleMessageLimit]);

  // Memoize the rendered message bubbles
  const renderedMessages = useMemo(
    () =>
      visibleMessages.map((msg) => (
        <MessageBubble
          key={msg.id}
          role={msg.role}
          content={msg.content}
          model={msg.model}
          responseTime={msg.responseTime}
          onApplyCode={msg.role === 'assistant' ? handleApplyCode : undefined}
          onFilesCreated={msg.role === 'assistant' ? handleFilesCreated : undefined}
          onRetry={msg.role === 'assistant' ? handleSend : undefined}
        />
      )),
    [visibleMessages, handleApplyCode, handleFilesCreated, handleSend],
  );

  const isEmpty = messages.length === 0 && !isChatLoading;

  return (
    <div className="flex h-full flex-col bg-zinc-950 text-zinc-100">
      {/* Header */}
      <ChatHeader />

      {/* Messages area */}
      {isEmpty ? (
        <EmptyState onPromptClick={handlePromptClick} />
      ) : (
        <div className="relative flex-1 min-h-0">
          {/* Custom scrollable container */}
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="h-full overflow-y-auto chat-scroll-area"
          >
            <div ref={scrollRef} className="py-2">
              {/* Load earlier messages button */}
              <AnimatePresence>
                {hasMoreMessages && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex justify-center px-4 py-2"
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => setVisibleMessageLimit((prev) => prev + VISIBLE_MESSAGE_LIMIT)}
                          className="flex items-center gap-1.5 rounded-full border border-zinc-700/60 bg-zinc-800/60 px-3 py-1.5 text-xs text-zinc-400 transition-all hover:border-emerald-500/30 hover:bg-zinc-800 hover:text-emerald-400"
                        >
                          <ChevronUp className="size-3.5" />
                          Load earlier messages ({messages.length - visibleMessageLimit} hidden)
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        Show {Math.min(VISIBLE_MESSAGE_LIMIT, messages.length - visibleMessageLimit)} more messages
                      </TooltipContent>
                    </Tooltip>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Historical messages */}
              <AnimatePresence initial={false}>
                {renderedMessages}
              </AnimatePresence>

              {/* Streaming content - show in real-time with enhanced UX */}
              <AnimatePresence>
                {isChatLoading && deferredStreamingContent && (
                  <StreamingMessage
                    content={deferredStreamingContent}
                    model={streamingModel}
                    onApplyCode={handleApplyCode}
                    startTime={streamStartTime}
                  />
                )}
              </AnimatePresence>

              {/* Typing indicator (before streaming starts) */}
              <AnimatePresence>
                {isChatLoading && !streamingContent && (
                  <TypingIndicator modelName={selectedModel} />
                )}
              </AnimatePresence>

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Floating scroll buttons */}
          <AnimatePresence>
            {showScrollTop && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.15 }}
                onClick={scrollToTop}
                className="absolute top-3 right-3 z-10 flex size-8 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800/90 text-zinc-400 shadow-lg backdrop-blur-sm transition-colors hover:bg-zinc-700 hover:text-zinc-100"
                title="Scroll to top"
              >
                <ArrowUp className="size-4" />
              </motion.button>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {showScrollBottom && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.15 }}
                onClick={scrollToBottom}
                className="absolute bottom-3 right-3 z-10 flex size-8 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800/90 text-zinc-400 shadow-lg backdrop-blur-sm transition-colors hover:bg-zinc-700 hover:text-zinc-100"
                title="Scroll to bottom"
              >
                <ArrowDown className="size-4" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Input area with Stop button support */}
      <MessageInput onSend={handleSend} isLoading={isChatLoading} onStop={handleStop} />
    </div>
  );
}
