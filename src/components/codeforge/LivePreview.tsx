'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { usePreviewState } from '@/store/hooks';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
} from 'lucide-react';
import { motion } from 'framer-motion';

type DeviceSize = 'desktop' | 'tablet' | 'mobile';

const DEVICE_CONFIG: Record<DeviceSize, { width: string; maxWidth: string; label: string }> = {
  desktop: { width: '100%', maxWidth: '100%', label: 'Desktop' },
  tablet: { width: '768px', maxWidth: '768px', label: 'Tablet' },
  mobile: { width: '375px', maxWidth: '375px', label: 'Mobile' },
};

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

class PreviewErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
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
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const lastContentHashRef = useRef<string>('');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const buildSrcdoc = useCallback((html: string, css: string, js: string) => {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    ${css}
  </style>
</head>
<body>
  ${html}
  <script>
    try {
      ${js}
    } catch(e) {
      document.body.innerHTML += '<div style="color:red;padding:10px;font-family:monospace;background:rgba(255,0,0,0.1);border-top:1px solid red;margin-top:10px;">Error: ' + e.message + '</div>';
    }
  </script>
</body>
</html>`;
  }, []);

  const isEmpty = !previewFiles.html && !previewFiles.css && !previewFiles.js;

  // Debounced auto-refresh when code changes — 300ms with content hash comparison
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      if (!isEmpty) {
        const contentHash = `${previewFiles.html.length}:${previewFiles.css.length}:${previewFiles.js.length}`;
        if (contentHash !== lastContentHashRef.current) {
          lastContentHashRef.current = contentHash;
          setIsTransitioning(true);
          setIsLoading(true);
          setSrcdoc(buildSrcdoc(previewFiles.html, previewFiles.css, previewFiles.js));
          // Fade out transition overlay after a short delay
          setTimeout(() => setIsTransitioning(false), 150);
        }
      }
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [previewFiles.html, previewFiles.css, previewFiles.js, buildSrcdoc, isEmpty]);

  // Manual refresh
  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    setIsLoading(true);
    lastContentHashRef.current = '';
    setSrcdoc(buildSrcdoc(previewFiles.html, previewFiles.css, previewFiles.js));
    setIframeKey((k) => k + 1);
    setTimeout(() => setIsRefreshing(false), 600);
  }, [previewFiles, buildSrcdoc]);

  // Pop out — open preview in a new browser tab using a data URI
  const handlePopOut = useCallback(() => {
    if (!srcdoc) return;
    const blob = new Blob([srcdoc], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    // Revoke after a short delay so the new tab can load it
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, [srcdoc]);

  // Handle iframe load event
  const handleIframeLoad = useCallback(() => {
    setIsLoading(false);
  }, []);

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
          <div className="flex items-center gap-1.5 rounded-md border border-zinc-700/60 bg-zinc-800/60 px-2 py-0.5 min-w-0 max-w-[200px]">
            <Globe className="size-3 text-zinc-500 shrink-0" />
            <span className="truncate text-[11px] text-zinc-500">preview://localhost</span>
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
      <div className="flex-1 min-h-0 overflow-auto bg-zinc-900/30">
        {isEmpty ? (
          <div className="flex h-full items-center justify-center">
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
          </div>
        ) : (
          <div className="flex h-full justify-center p-2">
            <div
              className="relative h-full rounded-lg border border-zinc-700/50 bg-white shadow-lg transition-all duration-300 ease-in-out overflow-hidden"
              style={{
                width: deviceConfig.width,
                maxWidth: deviceConfig.maxWidth,
              }}
            >
              {/* Loading indicator overlay */}
              {isLoading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-zinc-900/60 backdrop-blur-sm">
                  <div className="flex items-center gap-2 rounded-lg bg-zinc-800/90 px-3 py-2 ring-1 ring-zinc-700/50">
                    <Loader2 className="size-4 animate-spin text-emerald-400" />
                    <span className="text-xs font-medium text-zinc-300">Rendering...</span>
                  </div>
                </div>
              )}

              {/* Smooth opacity transition on content change */}
              <PreviewErrorBoundary>
                <div
                  className="h-full transition-opacity duration-200 ease-in-out"
                  style={{ opacity: isTransitioning ? 0.7 : 1 }}
                >
                  <iframe
                    ref={iframeRef}
                    key={iframeKey}
                    srcDoc={srcdoc}
                    sandbox="allow-scripts allow-modals allow-same-origin"
                    title="Live Preview"
                    className="h-full w-full border-0"
                    onLoad={handleIframeLoad}
                  />
                </div>
              </PreviewErrorBoundary>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
