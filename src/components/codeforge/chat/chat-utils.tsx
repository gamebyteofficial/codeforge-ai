import React from 'react';
import { motion } from 'framer-motion';
import {
  FileCode2,
  Zap,
  Bug,
  FileSearch,
  Cpu,
  BookOpen,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Utility: Extract preview content from streaming text (optimized with cache)
// ---------------------------------------------------------------------------

// Cache for extractPreviewContent — avoids re-running regex when content hasn't changed
export const previewCache = {
  lastInput: '',
  lastResult: null as { html: string; css: string; js: string } | null,
};

// Quick check: does the text even contain code blocks?
const CODE_BLOCK_INDICATOR = /```/;

/**
 * Extract ALL code blocks from text, categorized by language.
 * Uses a robust extraction that handles both complete and streaming (incomplete) blocks.
 */
export function extractAllCodeBlocks(text: string): { lang: string; content: string }[] {
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

export function classifyCodeBlock(lang: string, fileName?: string): 'html' | 'css' | 'js' | null {
  const fn = (fileName || '').toLowerCase();
  const l = lang.toLowerCase();

  if (fn.endsWith('.html') || fn.endsWith('.htm') || l === 'html' || l === 'markup') return 'html';
  if (fn.endsWith('.css') || fn.endsWith('.scss') || fn.endsWith('.less') || l === 'css' || l === 'scss' || l === 'less') return 'css';
  if (fn.endsWith('.js') || fn.endsWith('.jsx') || fn.endsWith('.ts') || fn.endsWith('.tsx') || l === 'javascript' || l === 'js' || l === 'typescript' || l === 'ts') return 'js';
  return null;
}

export function extractPreviewContent(text: string): { html: string; css: string; js: string } | null {
  // Early exit: if text is short and contains no code block markers, skip entirely
  if (text.length < 20 && !CODE_BLOCK_INDICATOR.test(text)) return null;

  // Prevent memory leak: clear cache if input is excessively large
  if (text.length > 500_000) {
    previewCache.lastInput = '';
    previewCache.lastResult = null;
    return null;
  }

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
// Error handling helpers – structured error marker for messages
// ---------------------------------------------------------------------------

export interface ChatError {
  type: 'network' | 'api' | 'abort' | 'model' | 'stream' | 'unknown';
  message: string;
  suggestions: string[];
  originalMessage?: string; // The user's last message for retry
}

export const ERROR_MARKER = '__CFORGE_ERROR__:';

export function encodeChatError(error: ChatError): string {
  return `${ERROR_MARKER}${JSON.stringify(error)}`;
}

export function decodeChatError(content: string): ChatError | null {
  if (!content.startsWith(ERROR_MARKER)) return null;
  try {
    return JSON.parse(content.slice(ERROR_MARKER.length)) as ChatError;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Suggested prompts for empty state
// ---------------------------------------------------------------------------

export const SUGGESTED_PROMPTS = [
  { label: 'Build a React dashboard with charts', icon: <FileCode2 className="size-4" /> },
  { label: 'Debug this code for me', icon: <Bug className="size-4" /> },
  { label: 'Create a REST API with Express', icon: <Zap className="size-4" /> },
  { label: 'Review my code for best practices', icon: <FileSearch className="size-4" /> },
  { label: 'Generate a game with Phaser.js', icon: <Cpu className="size-4" /> },
  { label: 'Plan a microservice architecture', icon: <BookOpen className="size-4" /> },
];

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Maximum messages to render in the DOM at once (message windowing)
export const VISIBLE_MESSAGE_LIMIT = 50;

// Throttle interval for preview updates during streaming
export const PREVIEW_THROTTLE_MS = 300;

// ---------------------------------------------------------------------------
// LoadingDots component
// ---------------------------------------------------------------------------

export function LoadingDots() {
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
