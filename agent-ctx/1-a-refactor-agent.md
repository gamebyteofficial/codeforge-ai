# Task 1-a: Create shared preview-builder module

## Summary
Created `src/lib/preview-builder.ts` to eliminate duplicated `CONSOLE_CAPTURE_SCRIPT` and `buildSrcdoc` logic across ChatPanel.tsx and LivePreview.tsx.

## Files Modified
- **Created**: `src/lib/preview-builder.ts` (226 lines) — exports `CONSOLE_CAPTURE_SCRIPT` and `buildSrcdoc(html, css, js)`
- **Modified**: `src/components/codeforge/ChatPanel.tsx` — removed ~170 lines of duplicated code, added import
- **Modified**: `src/components/codeforge/LivePreview.tsx` — removed ~170 lines of duplicated code, added import

## Key Decisions
- Extracted helper functions (`stripLocalCssRefs`, `stripLocalJsRefs`, `injectMetaAndConsole`) for cleaner code
- `buildSrcdoc` is a pure function (not a React hook/callback), so it works in both component contexts
- ChatPanel only imports `buildSrcdoc` (doesn't need `CONSOLE_CAPTURE_SCRIPT` directly)
- LivePreview only imports `buildSrcdoc` (doesn't need `CONSOLE_CAPTURE_SCRIPT` directly either)
- The `useCallback` wrapper in LivePreview was removed; the imported `buildSrcdoc` has a stable reference

## Verification
- ESLint passes with zero new errors on all 3 modified files
- Dev server compiles successfully
