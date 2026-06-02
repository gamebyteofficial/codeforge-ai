'use client';

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { usePreviewState } from '@/store/hooks';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Monitor,
  Tablet,
  Smartphone,
  RefreshCw,
  X,
  Globe,
  Sparkles,
  Code2,
  ExternalLink,
  Loader2,
  Terminal,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Info,
  AlertTriangle,
  Trash2,
  Download,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DeviceSize = 'desktop' | 'tablet' | 'mobile';

type ConsoleLevel = 'log' | 'warn' | 'error' | 'info';

interface ConsoleEntry {
  id: number;
  level: ConsoleLevel;
  args: string[];
  timestamp: number;
}

const DEVICE_CONFIG: Record<DeviceSize, { width: string; maxWidth: string; label: string }> = {
  desktop: { width: '100%', maxWidth: '100%', label: 'Desktop' },
  tablet: { width: '768px', maxWidth: '768px', label: 'Tablet' },
  mobile: { width: '375px', maxWidth: '375px', label: 'Mobile' },
};

// ---------------------------------------------------------------------------
// Simple but effective content hash (djb2 variant)
// ---------------------------------------------------------------------------

function contentHash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) & 0xffffffff;
  }
  return hash;
}

function computePreviewHash(html: string, css: string, js: string): string {
  return `${contentHash(html)}:${contentHash(css)}:${contentHash(js)}`;
}

// ---------------------------------------------------------------------------
// Console capture script injected into the iframe
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
// Error Boundary for iframe
// ---------------------------------------------------------------------------

type ErrorBoundaryProps = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

class PreviewErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('LivePreview error boundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex h-full items-center justify-center p-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex size-10 items-center justify-center rounded-lg bg-red-500/10 ring-1 ring-red-500/20">
              <X className="size-5 text-red-400" />
            </div>
            <p className="text-sm font-medium text-red-400">Preview Error</p>
            <p className="text-xs text-zinc-500 max-w-[240px]">
              {this.state.error?.message ?? 'An error occurred while rendering the preview.'}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-1 text-xs"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              Retry
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Console entry renderer
// ---------------------------------------------------------------------------

const LEVEL_CONFIG: Record<ConsoleLevel, { icon: typeof Info; color: string; bg: string; border: string }> = {
  log: { icon: Info, color: 'text-zinc-400', bg: 'bg-zinc-800/60', border: 'border-zinc-700/40' },
  info: { icon: Info, color: 'text-blue-400', bg: 'bg-blue-500/5', border: 'border-blue-500/20' },
  warn: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/5', border: 'border-amber-500/20' },
  error: { icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-500/5', border: 'border-red-500/20' },
};

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function PreviewSkeleton() {
  return (
    <div className="flex h-full flex-col gap-3 p-6 animate-pulse">
      <div className="h-6 w-3/4 rounded bg-zinc-800/60" />
      <div className="h-4 w-1/2 rounded bg-zinc-800/40" />
      <div className="mt-4 flex flex-col gap-2">
        <div className="h-3 w-full rounded bg-zinc-800/30" />
        <div className="h-3 w-5/6 rounded bg-zinc-800/30" />
        <div className="h-3 w-4/6 rounded bg-zinc-800/30" />
      </div>
      <div className="mt-6 h-24 w-full rounded-lg bg-zinc-800/20" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// LivePreview component
// ---------------------------------------------------------------------------

export default function LivePreview() {
  const previewFiles = usePreviewState(s => s.previewFiles);
  const isPreviewOpen = usePreviewState(s => s.isPreviewOpen);
  const setIsPreviewOpen = usePreviewState(s => s.setIsPreviewOpen);
  const [deviceSize, setDeviceSize] = useState<DeviceSize>('desktop');
  const [srcdoc, setSrcdoc] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>([]);
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [consoleCount, setConsoleCount] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastContentHashRef = useRef<string>('');
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const consoleIdRef = useRef(0);
  const consoleEndRef = useRef<HTMLDivElement>(null);

  // Extract title from HTML for URL bar
  const previewTitle = useMemo(() => {
    if (!previewFiles.html) return '';
    const match = previewFiles.html.match(/<title[^>]*>([^<]+)<\/title>/i);
    return match ? match[1].trim() : '';
  }, [previewFiles.html]);

  const isEmpty = !previewFiles.html && !previewFiles.css && !previewFiles.js;

  // Check if HTML content is a fragment (no <html> or <!DOCTYPE>) but contains
  // visible HTML elements — we should still render it
  const isHtmlFragment = useMemo(() => {
    if (!previewFiles.html) return false;
    const html = previewFiles.html.trim();
    // If it's a full document, it's not a fragment
    if (/<html[\s>]/i.test(html) || /<!DOCTYPE/i.test(html)) return false;
    // If it contains HTML tags, it's a fragment
    if (/<[a-zA-Z][^>]*>/.test(html)) return true;
    return false;
  }, [previewFiles.html]);

  const hasContent = !isEmpty || isHtmlFragment;

  // Build srcdoc with console capture injected
  const buildSrcdoc = useCallback((html: string, css: string, js: string) => {
    // ── Always strip external CSS/JS file references from HTML ──
    // When AI generates multi-file projects (index.html + styles.css + script.js),
    // the HTML often contains <link href="styles.css"> and <script src="script.js">
    // Since we inline CSS/JS into the srcdoc, these references would cause 404s.
    let cleanedHtml = html;

    // Remove <link> tags referencing local CSS files (styles.css, style.css, etc.)
    cleanedHtml = cleanedHtml.replace(
      /<link\s+[^>]*href\s*=\s*["']([^"']+\.css)["'][^>]*\/?>/gi,
      (match, href: string) => {
        // Only strip local/relative CSS references (not CDN URLs)
        if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('//')) {
          return match; // Keep CDN references
        }
        return ''; // Strip local file references
      }
    );

    // Remove <script src="..."> tags referencing local JS files
    cleanedHtml = cleanedHtml.replace(
      /<script\s+[^>]*src\s*=\s*["']([^"']+\.js)["'][^>]*><\/script>/gi,
      (match, src: string) => {
        // Only strip local/relative JS references (not CDN URLs)
        if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('//')) {
          return match; // Keep CDN references
        }
        return ''; // Strip local file references
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

    // Clean up empty lines left by removed tags
    cleanedHtml = cleanedHtml.replace(/\n\s*\n\s*\n/g, '\n\n');

    // ── If HTML is a self-contained document with no separate CSS/JS, use as-is (with refs already stripped) ──
    if (cleanedHtml && !css && !js && (/<html[\s>]/i.test(cleanedHtml) || /<!DOCTYPE/i.test(cleanedHtml))) {
      let doc = cleanedHtml;
      // Inject console capture and meta tags
      if (/<head[\s>]/i.test(doc)) {
        doc = doc.replace(
          /(<head[^>]*>)/i,
          `$1\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  ${CONSOLE_CAPTURE_SCRIPT}`
        );
      } else {
        // No <head>, add one
        doc = doc.replace(
          /(<html[^>]*>)/i,
          `$1\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  ${CONSOLE_CAPTURE_SCRIPT}\n</head>`
        );
      }
      return doc;
    }

    // ── Detect if HTML is a full document or just a fragment ──
    const isFullDocument =
      /<!DOCTYPE\s+html/i.test(cleanedHtml) ||
      /<html[\s>]/i.test(cleanedHtml);

    if (isFullDocument) {
      // ── Full HTML document: inject CSS/JS into the existing structure ──
      let doc = cleanedHtml;

      // Inject console capture script right after <head> or at start
      if (/<head[\s>]/i.test(doc)) {
        doc = doc.replace(
          /(<head[^>]*>)/i,
          `$1\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  ${CONSOLE_CAPTURE_SCRIPT}`
        );
      } else {
        // No <head>, add one
        doc = doc.replace(
          /(<html[^>]*>)/i,
          `$1\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  ${CONSOLE_CAPTURE_SCRIPT}\n</head>`
        );
      }

      // Inject inline CSS right before </head> (or after <head> content)
      if (css) {
        const styleBlock = `\n<style>\n${css}\n</style>`;
        if (/<\/head>/i.test(doc)) {
          doc = doc.replace(/<\/head>/i, `${styleBlock}\n</head>`);
        } else if (/<head[^>]*>/i.test(doc)) {
          doc = doc.replace(/(<head[^>]*>)/i, `$1${styleBlock}`);
        }
      }

      // Inject inline JS right before </body>
      if (js) {
        const scriptBlock = `\n<script>\ntry {\n${js}\n} catch(e) {\n  document.body.innerHTML += '<div style="color:red;padding:10px;font-family:monospace;background:rgba(255,0,0,0.1);border-top:1px solid red;margin-top:10px;">Error: ' + e.message + '</div>';\n}\n</script>`;
        if (/<\/body>/i.test(doc)) {
          doc = doc.replace(/<\/body>/i, `${scriptBlock}\n</body>`);
        } else {
          // No </body>, append before </html>
          doc = doc.replace(/<\/html>/i, `${scriptBlock}\n</html>`);
        }
      }

      return doc;
    }

    // ── HTML fragment: wrap in a complete document ──
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
  }, []);

  // Listen for console messages from iframe
  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (e.data && e.data.type === '__preview_console') {
        const entry: ConsoleEntry = {
          id: ++consoleIdRef.current,
          level: e.data.level as ConsoleLevel,
          args: e.data.args || [],
          timestamp: e.data.ts || Date.now(),
        };
        setConsoleEntries(prev => {
          const next = [...prev, entry];
          // Keep max 200 entries
          return next.length > 200 ? next.slice(-200) : next;
        });
        setConsoleCount(prev => prev + 1);
      }
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Auto-scroll console
  useEffect(() => {
    if (isConsoleOpen && consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [consoleEntries, isConsoleOpen]);

  // Debounced auto-refresh when code changes — 300ms with content hash comparison
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      if (hasContent) {
        const hash = computePreviewHash(previewFiles.html, previewFiles.css, previewFiles.js);
        if (hash !== lastContentHashRef.current) {
          lastContentHashRef.current = hash;
          setIsTransitioning(true);
          setIsLoading(true);
          setSrcdoc(buildSrcdoc(previewFiles.html, previewFiles.css, previewFiles.js));
          // Fade out transition overlay after a short delay
          setTimeout(() => setIsTransitioning(false), 200);
          // Safety timeout: if iframe onLoad doesn't fire within 3s, clear loading state
          setTimeout(() => setIsLoading(false), 3000);
        }
      }
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [previewFiles.html, previewFiles.css, previewFiles.js, buildSrcdoc, hasContent]);

  // Manual refresh
  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    setIsLoading(true);
    lastContentHashRef.current = '';
    setConsoleEntries([]);
    setConsoleCount(0);
    setSrcdoc(buildSrcdoc(previewFiles.html, previewFiles.css, previewFiles.js));
    setIframeKey((k) => k + 1);
    setTimeout(() => setIsRefreshing(false), 600);
  }, [previewFiles, buildSrcdoc]);

  // Download preview as HTML or ZIP
  const handleDownload = useCallback(async () => {
    if (!previewFiles.html && !previewFiles.css && !previewFiles.js) return;

    try {
      // Build a clean version without the console capture script
      let cleanHtml = previewFiles.html || '';
      const css = previewFiles.css || '';
      const js = previewFiles.js || '';

      // Check if we have multiple files
      const hasMultipleFiles = (css && cleanHtml) || (js && cleanHtml);

      if (hasMultipleFiles) {
        // Download as ZIP with separate files
        const JSZip = (await import('jszip')).default;
        const zip = new JSZip();

        // Modify HTML to reference external files
        let modifiedHtml = cleanHtml;
        if (css) {
          // Remove existing local <link> tags
          modifiedHtml = modifiedHtml.replace(
            /<link\s+[^>]*href\s*=\s*["']([^"']+\.css)["'][^>]*\/?>/gi,
            (match: string, href: string) => {
              if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('//')) return match;
              return '';
            }
          );
          // Add link to external CSS
          if (/<head[\s>]/i.test(modifiedHtml)) {
            modifiedHtml = modifiedHtml.replace(/(<head[^>]*>)/i, '$1\n  <link rel="stylesheet" href="styles.css">');
          }
          zip.file('styles.css', css);
        }
        if (js) {
          // Remove existing local <script> tags
          modifiedHtml = modifiedHtml.replace(
            /<script\s+[^>]*src\s*=\s*["']([^"']+\.js)["'][^>]*><\/script>/gi,
            (match: string, src: string) => {
              if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('//')) return match;
              return '';
            }
          );
          // Add script reference
          if (/<\/body>/i.test(modifiedHtml)) {
            modifiedHtml = modifiedHtml.replace(/<\/body>/i, '  <script src="script.js"></script>\n</body>');
          }
          zip.file('script.js', js);
        }

        // Remove console capture script from downloaded version
        modifiedHtml = modifiedHtml.replace(/<script>\s*\(function\(\)\s*\{[\s\S]*?__preview_console[\s\S]*?<\/script>/gi, '');

        // If HTML is a fragment, wrap it
        if (!/<html[\s>]/i.test(modifiedHtml) && !/<!DOCTYPE/i.test(modifiedHtml)) {
          modifiedHtml = `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  ${css ? '  <link rel="stylesheet" href="styles.css">' : ''}\n</head>\n<body>\n${modifiedHtml}\n  ${js ? '<script src="script.js"></script>' : ''}\n</body>\n</html>`;
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
        // Download as single HTML file
        const srcdocContent = buildSrcdoc(cleanHtml, css, js);
        // Remove console capture script for download
        const cleanSrcdoc = srcdocContent.replace(/<script>\s*\(function\(\)\s*\{[\s\S]*?__preview_console[\s\S]*?<\/script>/gi, '');

        const blob = new Blob([cleanSrcdoc], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const title = previewTitle || 'codeforge-preview';
        a.download = `${title.replace(/\s+/g, '-').toLowerCase()}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success('Download started!', { description: `${title.replace(/\s+/g, '-').toLowerCase()}.html` });
      }
    } catch (error) {
      console.error('Download failed:', error);
      toast.error('Download failed', { description: 'Please try again.' });
    }
  }, [previewFiles, buildSrcdoc, previewTitle]);

  // Pop out — open preview in a new browser tab using a blob URL
  const handlePopOut = useCallback(() => {
    if (!srcdoc) return;
    try {
      const blob = new Blob([srcdoc], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const newWin = window.open(url, '_blank');
      // If popup blocked, try data URI fallback
      if (!newWin) {
        const dataUri = `data:text/html;charset=utf-8,${encodeURIComponent(srcdoc)}`;
        window.open(dataUri, '_blank');
      }
      // Revoke after a short delay so the new tab can load it
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch {
      // Final fallback: data URI
      const dataUri = `data:text/html;charset=utf-8,${encodeURIComponent(srcdoc)}`;
      window.open(dataUri, '_blank');
    }
  }, [srcdoc]);

  // Handle iframe load event
  const handleIframeLoad = useCallback(() => {
    setIsLoading(false);
  }, []);

  // Clear console
  const handleClearConsole = useCallback(() => {
    setConsoleEntries([]);
    setConsoleCount(0);
  }, []);

  // Error count for badge
  const errorCount = useMemo(
    () => consoleEntries.filter(e => e.level === 'error').length,
    [consoleEntries]
  );

  if (!isPreviewOpen) return null;

  const deviceConfig = DEVICE_CONFIG[deviceSize];

  return (
    <div className="flex h-full flex-col border-l border-zinc-800 bg-zinc-950">
      {/* Header Bar */}
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-900/80 px-2">
        {/* Left side: icon + label + URL bar */}
        <div className="flex items-center gap-2 min-w-0">
          <Monitor className="size-3.5 text-emerald-400 shrink-0" />
          <span className="text-xs font-medium text-zinc-300 shrink-0">Preview</span>
          {hasContent && (
            <span className="flex items-center gap-1 rounded-sm bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400 animate-pulse">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              LIVE
            </span>
          )}
          <div className="flex items-center gap-1.5 rounded-md border border-zinc-700/60 bg-zinc-800/60 px-2 py-0.5 min-w-0 max-w-[200px]">
            <Globe className="size-3 text-zinc-500 shrink-0" />
            <span className="truncate text-[11px] text-zinc-500">
              {!hasContent
                ? 'preview://about:blank'
                : previewTitle
                  ? `preview://${previewTitle.replace(/\s+/g, '-').toLowerCase()}.html`
                  : 'preview://index.html'}
            </span>
          </div>
        </div>

        {/* Right side: device toggle + refresh + pop-out + close */}
        <div className="flex items-center gap-0.5">
          {/* Device toggle buttons */}
          <div className="flex items-center rounded-md border border-zinc-700/40 bg-zinc-800/40 p-0.5">
            {([
              { size: 'desktop' as DeviceSize, icon: Monitor, label: 'Desktop' },
              { size: 'tablet' as DeviceSize, icon: Tablet, label: 'Tablet' },
              { size: 'mobile' as DeviceSize, icon: Smartphone, label: 'Mobile' },
            ]).map(({ size, icon: Icon, label }) => (
              <Tooltip key={size}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setDeviceSize(size)}
                    className={`flex size-6 items-center justify-center rounded-sm transition-colors ${
                      deviceSize === size
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'text-zinc-500 hover:bg-zinc-700/50 hover:text-zinc-300'
                    }`}
                  >
                    <Icon className="size-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  {label}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>

          <div className="mx-1 h-4 w-px bg-zinc-800" />

          {/* Download button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-zinc-400 hover:text-white"
                onClick={handleDownload}
                disabled={!hasContent}
              >
                <Download className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              Download project
            </TooltipContent>
          </Tooltip>

          {/* Pop-out button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-zinc-400 hover:text-white"
                onClick={handlePopOut}
                disabled={!srcdoc}
              >
                <ExternalLink className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              Open in new tab
            </TooltipContent>
          </Tooltip>

          {/* Refresh button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-zinc-400 hover:text-white"
                onClick={handleRefresh}
              >
                <RefreshCw
                  className={`size-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              Refresh preview
            </TooltipContent>
          </Tooltip>

          {/* Close button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-zinc-400 hover:text-white"
                onClick={() => setIsPreviewOpen(false)}
              >
                <X className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              Close preview
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Preview content area */}
      <div className="flex-1 min-h-0 overflow-hidden bg-zinc-900/30 flex flex-col">
        <div className="flex-1 min-h-0 overflow-hidden">
          <AnimatePresence mode="wait">
            {!hasContent ? (
              <motion.div
                key="empty"
                className="flex h-full items-center justify-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex flex-col items-center gap-4 text-zinc-600">
                  {/* Animated monitor icon */}
                  <motion.div
                    className="relative"
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <div
                      className="size-20 rounded-xl opacity-15"
                      style={{
                        backgroundImage:
                          'linear-gradient(45deg, #3f3f46 25%, transparent 25%), linear-gradient(-45deg, #3f3f46 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #3f3f46 75%), linear-gradient(-45deg, transparent 75%, #3f3f46 75%)',
                        backgroundSize: '12px 12px',
                        backgroundPosition: '0 0, 0 6px, 6px -6px, -6px 0px',
                      }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="flex size-12 items-center justify-center rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/20">
                        <Monitor className="size-6 text-emerald-400/60" />
                      </div>
                    </div>
                  </motion.div>

                  <div className="flex flex-col items-center gap-2">
                    <p className="text-sm font-medium text-zinc-400">Ask AI to build something</p>
                    <div className="flex items-center gap-1.5 text-xs text-zinc-600">
                      <Sparkles className="size-3 text-emerald-500/50" />
                      <span>Try:</span>
                    </div>
                    <div className="flex flex-col items-center gap-1 mt-1">
                      <span className="text-[11px] text-zinc-500 font-mono">&quot;Build me a landing page&quot;</span>
                      <span className="text-[11px] text-zinc-500 font-mono">&quot;Create a todo app&quot;</span>
                      <span className="text-[11px] text-zinc-500 font-mono">&quot;Make a calculator&quot;</span>
                    </div>
                  </div>

                  <motion.div
                    className="flex items-center gap-1.5 mt-2 rounded-full border border-zinc-800 bg-zinc-900/50 px-3 py-1"
                    animate={{ borderColor: ['rgba(16,185,129,0.1)', 'rgba(16,185,129,0.3)', 'rgba(16,185,129,0.1)'] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <Code2 className="size-3 text-emerald-500/50" />
                    <span className="text-[10px] text-zinc-500">Preview updates as you code</span>
                  </motion.div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="preview"
                className="flex h-full justify-center items-stretch p-1.5"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
              >
                <div
                  className="relative h-full w-full rounded-lg border border-zinc-700/50 bg-white shadow-lg overflow-hidden"
                  style={{
                    maxWidth: deviceSize === 'desktop' ? '100%' : deviceConfig.maxWidth,
                    transition: 'max-width 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                >
                  {/* Loading indicator overlay */}
                  <AnimatePresence>
                    {isLoading && (
                      <motion.div
                        className="absolute inset-0 z-10 flex items-center justify-center bg-zinc-900/60 backdrop-blur-sm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                      >
                        <div className="flex items-center gap-2 rounded-lg bg-zinc-800/90 px-3 py-2 ring-1 ring-zinc-700/50">
                          <Loader2 className="size-4 animate-spin text-emerald-400" />
                          <span className="text-xs font-medium text-zinc-300">Rendering...</span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Content fade transition */}
                  <PreviewErrorBoundary>
                    <div
                      className="h-full transition-all duration-300 ease-out"
                      style={{
                        opacity: isTransitioning ? 0.6 : 1,
                        filter: isTransitioning ? 'blur(1px)' : 'blur(0px)',
                      }}
                    >
                      <iframe
                        ref={iframeRef}
                        key={iframeKey}
                        srcDoc={srcdoc}
                        sandbox="allow-scripts allow-modals allow-same-origin allow-forms allow-popups"
                        title="Live Preview"
                        className="h-full w-full border-0"
                        onLoad={handleIframeLoad}
                      />
                    </div>
                  </PreviewErrorBoundary>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Console Panel */}
        {hasContent && (
          <Collapsible
            open={isConsoleOpen}
            onOpenChange={setIsConsoleOpen}
            className="shrink-0 border-t border-zinc-800"
          >
            <CollapsibleTrigger asChild>
              <button className="flex w-full items-center gap-2 bg-zinc-900/80 px-2 py-1 hover:bg-zinc-800/80 transition-colors">
                {isConsoleOpen ? (
                  <ChevronDown className="size-3 text-zinc-500" />
                ) : (
                  <ChevronRight className="size-3 text-zinc-500" />
                )}
                <Terminal className="size-3 text-zinc-500" />
                <span className="text-[11px] font-medium text-zinc-400">Console</span>
                {consoleCount > 0 && (
                  <span className="flex items-center gap-1 ml-auto">
                    <span className="inline-flex items-center rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
                      {consoleCount}
                    </span>
                    {errorCount > 0 && (
                      <span className="inline-flex items-center rounded-full bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium text-red-400 ring-1 ring-red-500/20">
                        {errorCount}
                      </span>
                    )}
                  </span>
                )}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="bg-zinc-950 border-t border-zinc-800/50">
                {/* Console header */}
                <div className="flex items-center justify-between px-2 py-1 border-b border-zinc-800/40">
                  <span className="text-[10px] text-zinc-600">
                    {consoleCount > 0 ? `${consoleCount} message${consoleCount !== 1 ? 's' : ''}` : 'No output'}
                  </span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={handleClearConsole}
                        className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition-colors"
                      >
                        <Trash2 className="size-2.5" />
                        Clear
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      Clear console
                    </TooltipContent>
                  </Tooltip>
                </div>
                {/* Console entries */}
                <ScrollArea className="max-h-36">
                  <div className="px-2 py-1 font-mono text-[11px]">
                    {consoleEntries.length === 0 ? (
                      <div className="py-3 text-center text-zinc-600 text-[10px]">
                        Console output will appear here
                      </div>
                    ) : (
                      consoleEntries.map(entry => {
                        const cfg = LEVEL_CONFIG[entry.level];
                        const Icon = cfg.icon;
                        return (
                          <div
                            key={entry.id}
                            className={`flex items-start gap-1.5 rounded-sm px-1.5 py-0.5 ${cfg.bg} border ${cfg.border} mb-0.5`}
                          >
                            <Icon className={`size-3 mt-0.5 shrink-0 ${cfg.color}`} />
                            <span className={`break-all ${cfg.color}`}>
                              {entry.args.join(' ')}
                            </span>
                          </div>
                        );
                      })
                    )}
                    <div ref={consoleEndRef} />
                  </div>
                </ScrollArea>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </div>
  );
}
