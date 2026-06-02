# Task 2: Fix "network error" in LLM Integration

## Summary
Fixed the critical "network error" bug in the chat API / LLM integration. The root cause was that the secondary provider fallback was using the wrong provider's API endpoint.

## Files Changed

### `src/lib/llm.ts`
- Added `resolveProvider()` function that atomically resolves provider + apiKey + config together
- Rewrote `streamLLM()` to use `resolveProvider()` instead of separate key lookup
- Added secondary provider fallback on primary provider failure (not just missing key)
- Improved `getApiKeyForProvider()` with third fallback to legacy `apiKey`
- Increased timeout from 60s to 120s in all streaming functions
- Added network error detection with specific error messages
- Enhanced logging with key prefix, isFallback flag, provider resolution traces

### `src/app/api/chat/route.ts`
- Added pre-check for API key availability before starting stream
- Improved error messages in catch-all handler (specific for no-key, network, timeout, rate-limit)
- Added better logging with `[Chat API]` prefix
- Stream error handler now forwards actual error message to client

### `src/app/api/settings/route.ts`
- No changes needed

## Root Causes Fixed
1. CRITICAL: Secondary provider fallback used wrong provider config (key from provider B, endpoint from provider A)
2. No fallback on primary provider failure
3. Legacy apiKey not usable for secondary provider
4. Generic error messages
5. 60s timeout too short

## Test Scenarios
- Primary=openrouter (no key), Secondary=opencode (with key) → resolves to opencode ✓
- Primary fails → automatic fallback to secondary ✓
- Only legacy apiKey → found via third fallback ✓
- No API keys → instant pre-check error ✓
