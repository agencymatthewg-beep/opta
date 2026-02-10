# SUMMARY-17-02: Remove Claude Dependencies

## Plan Status: COMPLETE

**Executed**: 2026-01-21
**Duration**: ~30 minutes
**Commits**: 8

## Objective

Remove all Claude API dependencies to make Opta a LOCAL-ONLY AI application. No cloud APIs, no network requests for AI processing, all inference happens on-device.

## Changes Made

### Files Deleted

| File | Reason |
|------|--------|
| `Opta Scan/Services/ClaudeService.swift` | Cloud API client no longer needed |
| `Opta Scan/Services/LocalLLMService.swift` | Replaced by MLXService (untracked) |

### Files Modified

| File | Changes |
|------|---------|
| `Opta Scan/Services/LLMProvider.swift` | Removed `.claude` case, simplified LLMServiceManager to use MLXService directly |
| `Opta Scan/Views/SettingsView.swift` | Removed provider selection, added local model management UI |
| `Opta Scan/Services/KeychainService.swift` | Removed `claudeAPIKey`, added `downloadedModelId` |
| `Opta Scan/Opta_ScanApp.swift` | Added model initialization on launch |
| `Opta Scan/Services/MLXService.swift` | Made standalone actor (removed LLMProvider protocol) |
| `Opta Scan/Models/ScanFlow.swift` | Use LLMServiceManager instead of ClaudeService |
| `Opta Scan/Views/ProcessingView.swift` | Updated comments for local processing |
| `Opta Scan/Views/QuestionsView.swift` | Updated comments for local processing |
| `Opta Scan/Views/CaptureView.swift` | Updated TODO comment |
| `Opta Scan/Models/ScanHistory.swift` | Updated doc comment |
| `Opta Scan.xcodeproj/project.pbxproj` | Removed ClaudeService references, updated privacy descriptions |

### Architecture Changes

```
Before: LLMServiceManager → [ClaudeService, LocalLLMService] (multi-provider)
After:  LLMServiceManager → MLXService (local-only)
```

### Privacy Descriptions Updated

- **NSCameraUsageDescription**: "...processed locally and never leave your device"
- **NSPhotoLibraryUsageDescription**: "...All processing happens locally"

## Commits

| Hash | Message |
|------|---------|
| `ca0b594` | refactor(17-02): delete ClaudeService.swift |
| `32f1ade` | refactor(17-02): remove .claude case from LLMProviderType |
| `7b31ed3` | refactor(17-02): simplify LLMServiceManager for local-only operation |
| `98df24b` | refactor(17-02): update SettingsView for local-only operation |
| `b779d26` | refactor(17-02): update KeychainService keys for local-only operation |
| `28a3cb1` | feat(17-02): add local model initialization on app launch |
| `e6a69d7` | docs(17-02): update privacy descriptions for local-only operation |
| `e433894` | refactor(17-02): remove all Claude references and fix build |

## Verification

- [x] Build succeeds (xcodebuild)
- [x] Zero Claude/claude/CLAUDE references in Swift files
- [x] ClaudeService removed from Xcode project
- [x] All 9 tasks completed

## Technical Decisions

| Decision | Rationale |
|----------|-----------|
| Static model initialization | SwiftUI App struct is value type, can't capture self |
| `.task` modifier for init | Proper SwiftUI lifecycle integration |
| Remove LLMProvider protocol | Simplified architecture for single provider |
| UserDefaults for model ID | Quick access, not sensitive data |

## What's Next

- **Plan 17-03**: Model Downloading (implement actual download from Hugging Face)
- **Phase 18**: Model Management (UI for download/delete/switch models)

---

*Opta is now 100% local-only. No cloud AI dependencies.*
