/**
 * Selective subscription hooks for the Zustand store.
 *
 * Instead of subscribing to the entire store with `useAppStore()` (which
 * causes re-renders whenever *any* slice changes), components should use
 * these hooks – or the generic `useStore` selector – so they only
 * re-render when the specific state they care about changes.
 */

import { useStoreWithEqualityFn } from 'zustand/traditional';
import { useAppStore, type AppState } from './index';

// ---------------------------------------------------------------------------
// Generic selector hook (with shallow-equality optimisation built-in)
// ---------------------------------------------------------------------------

/**
 * Subscribe to a derived slice of the store. Uses `useStoreWithEqualityFn`
 * from `zustand/traditional` so that object / array selectors are compared
 * by value, not by reference, preventing spurious re-renders.
 *
 * @example
 * ```tsx
 * const files = useStore(s => s.files);
 * const currentFile = useStore(s => s.currentFile);
 * ```
 */
export function useStore<T>(selector: (state: AppState) => T): T {
  return useStoreWithEqualityFn(useAppStore, selector);
}

// ---------------------------------------------------------------------------
// Domain-specific convenience hooks
// ---------------------------------------------------------------------------

/** Chat-related state & actions */
export function useChatState<R>(selector: (s: AppState) => R): R {
  return useStoreWithEqualityFn(useAppStore, selector);
}

/** File-related state & actions */
export function useFileState<R>(selector: (s: AppState) => R): R {
  return useStoreWithEqualityFn(useAppStore, selector);
}

/** UI-related state & actions (sidebar, panels, agent, model, settings…) */
export function useUIState<R>(selector: (s: AppState) => R): R {
  return useStoreWithEqualityFn(useAppStore, selector);
}

/** Preview-related state & actions */
export function usePreviewState<R>(selector: (s: AppState) => R): R {
  return useStoreWithEqualityFn(useAppStore, selector);
}

/** Project-related state & actions */
export function useProjectState<R>(selector: (s: AppState) => R): R {
  return useStoreWithEqualityFn(useAppStore, selector);
}

/** Task-related state & actions */
export function useTaskState<R>(selector: (s: AppState) => R): R {
  return useStoreWithEqualityFn(useAppStore, selector);
}

/** Terminal-related state & actions */
export function useTerminalState<R>(selector: (s: AppState) => R): R {
  return useStoreWithEqualityFn(useAppStore, selector);
}

/** Memory-related state & actions */
export function useMemoryState<R>(selector: (s: AppState) => R): R {
  return useStoreWithEqualityFn(useAppStore, selector);
}
