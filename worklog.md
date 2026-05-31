---
Task ID: 1
Agent: Main
Task: Verify and ensure OpenCode Zen is fully integrated across all components

Work Log:
- Restarted dev server (was crashed from previous session)
- Verified OpenCode Zen in src/lib/llm.ts - PROVIDER_CONFIGS has 'opencode' key with baseUrl, 13 models, testModel, chatPath, extraHeaders
- Verified OpenCode Zen in src/store/index.ts - Store uses generic Record<string, string> for settings, compatible with opencode provider
- Verified OpenCode Zen in src/components/codeforge/SettingsModal.tsx - PROVIDERS object includes opencode with 🧘 icon, keyHint, handleProviderChange sets default model to 'opencode/big-pickle'
- Verified OpenCode Zen in src/components/codeforge/ApiKeyGuide.tsx - PROVIDER_GUIDES has full opencode entry with steps, pricing, freeCredits, bestModels, tip; QuickProviderCards includes opencode with "FREE CODING" badge
- Verified OpenCode Zen in src/components/codeforge/OnboardingWizard.tsx - PROVIDERS includes opencode, handleProviderChange handles 'opencode' → sets model to 'opencode/big-pickle', Step2ApiKey uses QuickProviderCards
- Verified OpenCode Zen in src/app/api/models/route.ts - STATIC_MODELS has 'opencode' key with 13 models including isFree flags for Big Pickle and MiMo V2 Pro
- Ran lint check - passes cleanly with no errors
- Dev server starts and serves pages correctly (HTTP 200)

Stage Summary:
- OpenCode Zen is FULLY INTEGRATED across all components (was added in previous session)
- All 7 verification points pass
- Lint check: CLEAN (no errors)
- App renders correctly on port 3000
- Known issue: Dev server crashes intermittently in sandbox environment (needs supervisor)
