'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import dynamic from 'next/dynamic';
import { Copy, Check, Eye, FileCode2 } from 'lucide-react';
import { useAppStore } from '@/store';
import { Button } from '@/components/ui/button';

const SyntaxHighlighter = dynamic(
  () => import('react-syntax-highlighter').then(mod => mod.Prism),
  { ssr: false, loading: () => <div className="h-8" /> }
);

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

export default CodeBlock;
