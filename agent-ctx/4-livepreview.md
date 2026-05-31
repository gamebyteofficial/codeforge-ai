# Task ID: 4 - LivePreview Component

## Agent: Subagent
## Task: Build LivePreview component for CodeForge AI

### Work Done:
- Created `/home/z/my-project/src/components/codeforge/LivePreview.tsx` with full feature set:
  - **Iframe-based rendering**: Combines HTML, CSS, and JS into a single document using `srcdoc` attribute
  - **Auto-refresh**: 500ms debounced `useEffect` that updates the iframe when `previewFiles` changes in the Zustand store
  - **Manual refresh button**: Force refreshes with spinning animation via `iframeKey` state
  - **Device size toggle**: Desktop (100%), Tablet (768px), Mobile (375px) with smooth CSS transitions
  - **URL bar**: Cosmetic bar showing "preview://localhost" with Globe icon
  - **Error catching**: JS errors in iframe are caught and displayed as red error divs
  - **Empty state**: Centered "No preview available" message with checkered background pattern
  - **Security**: Sandboxed iframe with `sandbox="allow-scripts allow-modals"`

- Integrated LivePreview into `/home/z/my-project/src/app/page.tsx`:
  - Added as a resizable panel to the right of the Code Editor when `isPreviewOpen` is true
  - Added Preview toggle button in the status bar (Eye icon)
  - Removed unused `useEffect` import
  - Added `Eye` icon import from lucide-react

### Header Bar Layout:
- Left: Monitor icon (emerald) + "Preview" label + URL bar (Globe + "preview://localhost")
- Right: Device toggle group (Monitor/Tablet/Smartphone) + separator + RefreshCw button + X close button

### Styling:
- Dark theme matching IDE (bg-zinc-950, borders zinc-800)
- Checkered grid background on empty state
- Smooth 300ms transition on device size changes
- shadcn/ui Button and Tooltip components
- lucide-react icons: Monitor, Tablet, Smartphone, RefreshCw, X, Globe

### Lint: Passes with 0 errors
### Dev Server: Running without issues
