'use client';

import React, { useState, useRef, useCallback, useMemo } from 'react';
import { Monitor, RefreshCw, Download, ExternalLink } from 'lucide-react';
import { useAppStore } from '@/store';
import { buildSrcdoc } from '@/lib/preview-builder';
import { downloadPreviewProject } from '@/lib/download-utils';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

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
    () => buildSrcdoc(html, css, js),
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
      await downloadPreviewProject(html, css, js);
      const hasMultipleFiles = (css && html) || (js && html);
      if (hasMultipleFiles) {
        toast.success('Download started!', { description: 'waziros-project.zip' });
      } else {
        toast.success('Download started!', { description: 'waziros-preview.html' });
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
          sandbox="allow-scripts allow-modals allow-forms allow-popups"
          title="Inline Preview"
          className="h-full w-full border-0 rounded-b-lg bg-white"
        />
      </div>
    </div>
  );
});

export default InlinePreview;
