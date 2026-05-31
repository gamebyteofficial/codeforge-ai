---
Task ID: 3
Agent: full-stack-developer + Main Agent
Task: Fix "No endpoints found" error for all free OpenRouter models + dynamic model fetching

Work Log:
- Created /api/models route for dynamic model fetching from OpenRouter API
- Rewrote llm.ts: removed hardcoded free models, only openrouter/auto as guaranteed model
- Simplified streamLLM() - no complex alias resolution, direct provider routing
- Added console logging for every API call
- Fixed system prompt handling: proper 'system' role instead of 'assistant'
- Rewrote ChatPanel.tsx: dynamic model selector, connection status, model info in messages
- Rewrote OnboardingWizard.tsx: dynamic model fetching, OpenRouter as default
- Rewrote SettingsModal.tsx: dynamic model fetching, refresh button
- Reset database for fresh start

Stage Summary:
- FIXED: "No endpoints found" by removing broken hardcoded free models
- ADDED: Dynamic model fetching from OpenRouter API
- ADDED: Connection status indicator, model info in messages
- CHANGED: Default to OpenRouter + openrouter/auto

---
Task ID: 4
Agent: Main Agent
Task: Add scroll up/down buttons and visible scrollbar to chat panel + improve model API error handling

Work Log:
- Replaced ScrollArea component with custom scrollable div (chat-scroll-area class)
- Added scrollContainerRef for direct scroll position tracking
- Added handleScroll callback to detect when user scrolls away from top/bottom
- Added floating scroll-to-top button (ArrowUp icon, appears when scrolled >300px)
- Added floating scroll-to-bottom button (ArrowDown icon, appears when >100px from bottom)
- Both buttons use AnimatePresence for smooth fade in/out with framer-motion
- Added custom CSS scrollbar styling in globals.css for .chat-scroll-area class
  - 8px wide scrollbar with dark zinc colors (#3f3f46)
  - Hover/active states for better visibility
  - Custom up/down arrow SVG buttons in scrollbar
  - Firefox scrollbar-width: thin support
- Improved smart auto-scroll: only auto-scrolls when user is near bottom (within 200px)
- Improved error handling in ChatPanel: model-specific errors show helpful message
  - Detects "no endpoints", "not available", "model not found", 404 errors
  - Suggests switching to openrouter/auto with instructions
  - General errors show the actual error message
- Cleaned up unused imports (Select components, AlertTriangle, ChevronUp, ScrollArea)

Stage Summary:
- ADDED: Floating scroll-to-top and scroll-to-bottom buttons with animation
- ADDED: Custom visible scrollbar for chat area (dark theme styled)
- ADDED: Smart auto-scroll (only when near bottom)
- IMPROVED: Model error messages with actionable suggestions
- CLEANED: Removed unused imports
