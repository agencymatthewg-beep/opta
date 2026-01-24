# Plan 92-02 Summary: LLM Service and Hybrid Routing

## Result: COMPLETE

**Duration:** ~6 minutes (04:21 - 04:27 UTC)
**Commits:** 3 atomic commits
**Build:** Passes successfully

## What Was Built

### Service Architecture

```
┌─────────────────────────────────────────┐
│            ChatViewModel                 │
│  sendMessage() → ChatService.shared     │
├─────────────────────────────────────────┤
│             ChatService                  │
│  Orchestration + System Prompt Builder   │
├─────────────────────────────────────────┤
│           SemanticRouter                 │
│  Keyword heuristics → .local / .cloud   │
├────────────────┬────────────────────────┤
│ LocalLLMService│   CloudLLMService      │
│ (MLX-ready)    │   (Claude API + SSE)   │
└────────────────┴────────────────────────┘
```

### Files Created (5 services)

| File | Purpose |
|------|---------|
| `Services/LLMService.swift` | Protocol + LLMError enum |
| `Services/CloudLLMService.swift` | Claude API with SSE streaming |
| `Services/LocalLLMService.swift` | MLX-ready with graceful fallback |
| `Services/SemanticRouter.swift` | Query classification + routing |
| `Services/ChatService.swift` | Orchestration layer |

### Files Modified (3)

| File | Change |
|------|--------|
| `Models/ChatModels.swift` | Removed mock timer, wired to ChatService |
| `Views/AiChat/AiChatView.swift` | Added settings gear, API key sheet, telemetry pass |
| `project.pbxproj` | 5 new file registrations |

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| UserDefaults for API key (not Keychain) | Simpler for MVP; Keychain migration path noted |
| Mock generation in LocalLLMService | MLX package dependency deferred; structure ready |
| Keyword heuristics over ML-based routing | Deterministic, no model dependency, good enough for initial version |
| @MainActor on ChatService methods | Safe UI updates from streaming callbacks |
| AsyncThrowingStream for generation | Back-pressure aware, cancellation-safe |
| Default route to cloud in auto mode | Until local model quality is proven |

## API Integration Details

- **Endpoint:** `https://api.anthropic.com/v1/messages`
- **Model:** `claude-sonnet-4-20250514`
- **Max Tokens:** 2048
- **Streaming:** SSE via URLSession bytes(for:)
- **Event Parsing:** `content_block_delta` → `text_delta` → yield text

## MLX Readiness

The LocalLLMService is structured to accept MLX integration:
- Model directory: `~/Library/Application Support/OptaApp/Models/`
- Download/load lifecycle management
- `generateStream` method has MLX integration point marked with `// TODO: MLX Integration`
- Currently returns helpful mock responses
- Reports `isAvailable = false` until model loaded

## Streaming Flow

1. User types message → `ChatViewModel.sendMessage()`
2. ChatViewModel calls `ChatService.shared.sendMessage()`
3. ChatService builds system prompt with telemetry context
4. SemanticRouter classifies query → selects service
5. Selected service returns `AsyncThrowingStream<String, Error>`
6. ChatService iterates stream, updating message content character by character
7. On completion, metadata (model, latency, tokens) is attached

## Verification

- [x] Build passes: `xcodebuild -scheme OptaApp build` → BUILD SUCCEEDED
- [x] CloudLLMService formats correct Claude API request
- [x] LocalLLMService gracefully handles missing model
- [x] SemanticRouter classifies queries (11 local patterns, 16 cloud patterns)
- [x] ChatService orchestrates end-to-end flow
- [x] Cancellation stops generation cleanly
- [x] API key settings sheet accessible from header
- [x] All 5 service files registered in Xcode project
