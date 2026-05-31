---
Task ID: 1
Agent: Main Agent
Task: Fix OpenCode Zen model IDs - "Model opencode/big-pickle is not supported" error

Work Log:
- Fetched actual model list from https://opencode.ai/zen/v1/models API
- Discovered all model IDs use NO prefix (e.g., `big-pickle` not `opencode/big-pickle`)
- Updated `src/lib/llm.ts` PROVIDER_CONFIGS: removed `opencode/` prefix from all 14 model IDs
- Updated `src/lib/llm.ts` testModel from `opencode/big-pickle` to `big-pickle`
- Added OpenCode Zen-specific test connection using models listing endpoint
- Rewrote `src/app/api/models/route.ts`: now dynamically fetches from OpenCode Zen `/v1/models` API
- Added proper free/paid classification based on `-free` suffix and known free IDs
- Added friendly display names mapping (OPENCODE_DISPLAY_NAMES) for all 46+ models
- Updated `src/components/codeforge/SettingsModal.tsx`: default model `big-pickle`, label "Free & paid models"
- Updated `src/components/codeforge/OnboardingWizard.tsx`: default model `big-pickle`, label "Free & paid models"
- Updated `src/components/codeforge/ApiKeyGuide.tsx`: corrected model names, pricing info, and badges
- Updated `src/components/codeforge/ChatPanel.tsx`: fixed free models group label to "🆓 Free Models"
- Verified API returns correct model data with real IDs from OpenCode Zen
- Lint check passes with no errors

Stage Summary:
- Root cause: Model IDs were using `opencode/` prefix which OpenCode Zen API doesn't recognize
- Fix: Use actual model IDs from the API (e.g., `big-pickle`, `deepseek-v4-flash-free`, `claude-sonnet-4`)
- Models API now dynamically fetches from OpenCode Zen for always up-to-date model list
- Free models: big-pickle, deepseek-v4-flash-free, mimo-v2.5-free, qwen3.6-plus-free, minimax-m3-free, nemotron-3-super-free
- All paid models properly marked as isFree: false
