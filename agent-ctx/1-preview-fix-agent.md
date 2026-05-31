# Task 1: Fix LivePreview Real-Time Streaming Update

## Agent: preview-fix-agent
## Task ID: 1

## Summary
Fixed the LivePreview component to update in real-time during AI streaming responses, and improved the empty state UI.

## Changes Made

### 1. ChatPanel.tsx - Added `extractPreviewContent()` utility
- **Location**: Top of file, before the `DynamicModel` interface
- **Function**: Parses markdown code blocks (```html, ```css, ```javascript/```js) from streaming text
- **Key feature**: Handles both complete (`\`\`\`html\n...\`\`\``) and incomplete (`\`\`\`html\n...` without closing) code blocks using `(?:\`\`\`|$)` regex pattern
- Returns `{ html, css, js }` or `null` if no preview content found

### 2. ChatPanel.tsx - Updated streaming handler in `handleSend`
- **Streaming path**: After each chunk is processed and `fullContent` is updated, calls `extractPreviewContent(fullContent)`. If HTML/CSS/JS content is found, calls `setPreviewFiles()` and `setIsPreviewOpen(true)` on the Zustand store
- **Non-streaming fallback**: Also extracts preview content from JSON responses
- Uses `useAppStore.getState()` to access store actions directly (safe inside async callback)

### 3. LivePreview.tsx - Improved empty state
- Replaced "No preview available" with "Ask AI to build something"
- Added pulse animation on the monitor icon (opacity animation via framer-motion)
- Added example prompts in mono font: "Build me a landing page", "Create a todo app", "Make a calculator"
- Added glowing border pill with "Preview updates as you code" message (border color animates)
- Added `framer-motion`, `Sparkles`, and `Code2` imports

## Files Modified
1. `/home/z/my-project/src/components/codeforge/ChatPanel.tsx`
2. `/home/z/my-project/src/components/codeforge/LivePreview.tsx`

## Verification
- `bun run lint` passes with no errors
- Dev server compiles successfully and responds with 200
