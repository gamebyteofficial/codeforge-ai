# Task 1: Add Inline HTML Preview in Chat + Auto-Open Preview

## Work Record

### What was done
1. Read and analyzed ChatPanel.tsx (~2022 lines), LivePreview.tsx (~801 lines), and store/index.ts
2. Extracted `CONSOLE_CAPTURE_SCRIPT` from LivePreview.tsx as standalone constant
3. Created `buildSrcdocForInline()` — standalone version of LivePreview's `buildSrcdoc()` method
4. Created `InlinePreview` React.memo component (280px iframe with header bar)
5. Added InlinePreview to StreamingMessage (after MarkdownRenderer + blinking cursor)
6. Added InlinePreview to MessageBubble (after MarkdownRenderer, for AI messages only)
7. Added prominent "HTML preview available — Open Preview Panel" banner below MessageBubble
8. Added Monitor + ExternalLink icon imports
9. All lint checks pass, dev server healthy

### Key files modified
- `/home/z/my-project/src/components/codeforge/ChatPanel.tsx`

### Key design decisions
- InlinePreview uses same `buildSrcdocForInline` logic as LivePreview for consistent rendering
- IIFE pattern used in JSX to call `extractPreviewContent()` inline (avoiding extra state/hooks in memoized components)
- Banner uses emerald color scheme to be visually prominent
- Auto-open preview panel already worked via `throttledPreviewUpdate` in streaming
