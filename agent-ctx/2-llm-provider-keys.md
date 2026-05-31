---
Task ID: 2
Agent: Backend Agent
Task: Update LLM client and Settings API route to support per-provider API keys

Work Log:
- Added `getApiKeyForProvider()` helper function to `src/lib/llm.ts` (lines 472-490)
  - Resolution order: per-provider key (`{provider}_apiKey`) → legacy single key (only if provider matches active) → null
- Updated `streamLLM()` in `src/lib/llm.ts` (lines 514-539)
  - Replaced `settings.apiKey` with `getApiKeyForProvider(settings, configuredProvider)` as primary lookup
  - Added fallback to secondary provider (`settings.provider2`) key when primary provider has no key
  - Error message unchanged when no key found at all
- Updated `src/app/api/settings/route.ts` POST handler (lines 31-45)
  - Imported `getApiKeyForProvider` from `@/lib/llm`
  - Changed test connection key lookup: `getApiKeyForProvider(settings, provider) || settings.apiKey`
  - Falls back to legacy `settings.apiKey` if per-provider lookup returns null
- All changes maintain backward compatibility with the existing `apiKey` setting
- Lint check passes with zero errors
- Dev server running normally (no compile errors)

Stage Summary:
- Per-provider API key format: `{provider}_apiKey` (e.g., `opencode_apiKey`, `openrouter_apiKey`)
- New setting: `provider2` for secondary/backup provider
- Backward compatible: old `apiKey` setting still works as fallback
- Key resolution in streamLLM: per-provider → legacy → secondary provider key → error
- Key resolution in settings test: per-provider → legacy apiKey
