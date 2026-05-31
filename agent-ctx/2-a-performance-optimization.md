# Task 2-a: Optimize Zustand Store and ChatPanel Performance

## Summary

Optimized the Zustand store and ChatPanel component for performance by implementing selective subscriptions, throttling streaming preview updates, memoizing heavy components, and separating streaming messages from historical messages.

## Changes Made

### 1. Created `src/store/hooks.ts` — Selective Subscription Hooks
- Uses `useStoreWithEqualityFn` from `zustand/traditional` for shallow equality comparison
- Provides domain-specific hooks: `useChatState`, `useFileState`, `useUIState`, `usePreviewState`, `useProjectState`, `useTaskState`, `useTerminalState`, `useMemoryState`
- Generic `useStore<T>(selector)` hook for any selector

### 2. Updated All Components to Use Selective Hooks
Replaced `useAppStore()` (which subscribes to entire store) with targeted selectors in:
- ChatPanel.tsx (ChatHeader, ModelSelector, FileCreateBar, MessageInput, main component)
- LivePreview.tsx
- CodeEditor.tsx
- FileExplorer.tsx
- TopBar.tsx
- TaskTracker.tsx
- Terminal.tsx
- SettingsModal.tsx
- MemoryViewer.tsx
- OnboardingWizard.tsx
- page.tsx

### 3. Throttled Streaming Preview Updates
- Added 300ms throttle (`PREVIEW_THROTTLE_MS`) on `extractPreviewContent()` calls during streaming
- Uses ref-based throttle mechanism inside the streaming while loop
- Added final extraction after streaming completes for correctness

### 4. React.memo on Heavy Components
- `MessageBubble` wrapped with `React.memo`
- `MarkdownRenderer` wrapped with `React.memo`

### 5. Separated Streaming Message from Historical Messages
- `historicalMessages` memoized with `useMemo` based on message count and IDs
- Only the streaming message section re-renders when `streamingContent` changes

## Lint Result
All changes pass `bun run lint` with zero errors.
