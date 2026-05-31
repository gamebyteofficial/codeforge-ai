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

---
Task ID: 2
Agent: Main Agent
Task: Add two API key input options (Primary + Secondary providers)

Work Log:
- Updated `src/lib/llm.ts`: Added `getApiKeyForProvider()` helper for per-provider key resolution
- Updated `streamLLM()`: Now resolves API keys per-provider (`{provider}_apiKey`), falls back to legacy `apiKey`, then checks secondary provider
- Updated `src/app/api/settings/route.ts`: Connection test now uses per-provider key lookup
- Rewrote `src/components/codeforge/SettingsModal.tsx`:
  - Two API key input sections: Primary Provider (Active) + Secondary Provider (Backup)
  - Each section has its own provider selector, API key input, show/hide toggle, and test connection button
  - "Swap Primary ↔ Secondary" button to quickly switch providers
  - Provider dropdowns exclude the other provider to prevent duplicates
  - Per-provider keys stored as `{provider}_apiKey` (e.g., `opencode_apiKey`, `openrouter_apiKey`)
  - Legacy `apiKey` field maintained for backward compatibility
  - Added `provider2` setting for secondary provider (default: `opencode`)
- Rewrote `src/components/codeforge/OnboardingWizard.tsx`:
  - Step 2 now shows two API key inputs (Primary + Secondary)
  - Primary section has green border emphasis, Secondary is more subtle
  - Secondary provider marked as "Optional"
  - Saves both per-provider keys on completion
- Updated `src/components/codeforge/ChatPanel.tsx`: Connection status now checks per-provider key
- Lint check passes with zero errors
- Dev server running and healthy

Stage Summary:
- Users can now configure two API providers simultaneously
- Per-provider keys prevent losing API keys when switching providers
- Primary provider is used for all LLM calls; Secondary is available as fallback
- "Swap" button lets users quickly promote secondary to primary
- Full backward compatibility with old single `apiKey` setting
