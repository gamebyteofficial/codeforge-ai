# Task 9 — Fix Duplicate `/api/projects` Fetch

## Summary
Fixed the duplicate `/api/projects` API call that occurred on every page load because both `page.tsx` and `TopBar.tsx` independently fetched projects on mount.

## Changes Made

### 1. `src/store/index.ts`
- Added `areProjectsLoaded: boolean` state field (default: `false`)
- Added `setAreProjectsLoaded: (loaded: boolean) => void` action

### 2. `src/app/page.tsx`
- Modified the `ensureProject` useEffect to:
  - Store fetched projects via `setProjects(data.projects ?? [])`
  - Set `areProjectsLoaded` to `true` after fetch (success or failure)
  - Set `areProjectsLoaded` to `true` even on early return when `currentProject` already exists

### 3. `src/components/codeforge/TopBar.tsx`
- Added `areProjectsLoaded` and `setAreProjectsLoaded` from the store
- Changed the useEffect to skip the `/api/projects` fetch if `areProjectsLoaded` is already `true`
- If a fetch is needed, stores results and sets `areProjectsLoaded(true)`

## Result
- Only ONE `/api/projects` request per page load (down from two)
- Projects data is shared through the Zustand store
- No infinite retry loops (flag set on all exit paths)
