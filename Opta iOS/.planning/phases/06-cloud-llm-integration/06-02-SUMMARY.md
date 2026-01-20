---
phase: 06-cloud-llm-integration
plan: 02
type: summary
completed: 2026-01-15
---

# Plan 06-02: Hybrid Routing Logic

## Objective
Implement hybrid routing logic to choose between local Ollama and cloud Claude, optimizing cost while maintaining quality for complex queries.

## Changes Made

### Python Backend (mcp-server/src/opta_mcp/)

1. **router.py** (NEW)
   - `classify_query(query: str) -> str`: Classifies queries as "local" or "cloud" based on complexity indicators
   - `route_chat(messages, prefer, model)`: Routes chat requests to appropriate backend with fallback logic
   - `get_routing_stats()`: Returns routing statistics for cost monitoring
   - `smart_chat(message, prefer, model)`: High-level API with system prompt and telemetry context
   - Uses heuristics: query length >50 words = cloud, complexity indicators (why, explain, analyze) = cloud, simple indicators (what is, how to) = local

2. **server.py** (UPDATED)
   - Added `smart_chat` MCP tool for intelligent routing
   - Added `routing_stats` MCP tool for monitoring

### Rust Backend (src-tauri/src/)

3. **llm.rs** (UPDATED)
   - Added `SmartChatResponse` struct with backend indicator
   - Added `TokenUsage` struct for cloud response tracking
   - Added `smart_chat` Tauri command that invokes Python router

4. **lib.rs** (UPDATED)
   - Registered `smart_chat` command in handler

### Frontend (src/)

5. **types/llm.ts** (UPDATED)
   - Added `RoutingPreference` type ("auto" | "local" | "cloud")
   - Added `SmartChatResponse` interface
   - Added `ChatResult` interface with backend info

6. **hooks/useLlm.ts** (UPDATED)
   - Now uses `smart_chat` instead of direct `llm_chat`
   - Added `routingPreference` state
   - Added `setRoutingPreference` to allow runtime changes
   - `sendMessage` returns `ChatResult` with backend indicator

7. **components/ChatMessage.tsx** (UPDATED)
   - Added optional `backend` prop
   - Shows "Local" or "Claude" badge on assistant messages
   - Local = muted styling, Claude = primary styling with cloud icon

8. **components/ChatInterface.tsx** (UPDATED)
   - Added `RoutingModeSelector` dropdown in header
   - Options: Auto, Local, Claude (with descriptions)
   - Shows cost warning for Claude mode
   - Messages store and display backend info

9. **components/ui/dropdown-menu.tsx** (NEW)
   - Radix UI dropdown menu component for routing selector

## Routing Logic

### Classification Heuristics
```
CLOUD_INDICATORS: why, explain, analyze, compare, recommend,
                  step by step, walkthrough, guide me,
                  architecture, design, optimize for,
                  debug, diagnose, not working, error

LOCAL_INDICATORS: what is, how to, list, show,
                  quick, simple, basic,
                  status, check, current

Rules:
- Query >50 words -> cloud
- cloud_score > local_score + 1 -> cloud
- Otherwise -> local
```

### Fallback Behavior
- If preferred backend unavailable, falls back to the other
- Stats track fallback events for monitoring
- Error messages include which backend failed

## Verification

- [x] Router classifies queries correctly
  ```
  "How do I boost FPS?" -> local
  "Explain why my GPU is throttling and recommend solutions" -> cloud
  ```
- [x] `npm run build` succeeds
- [x] `cargo check` succeeds
- [x] Dropdown menu component created and working

## Dependencies Added

- `@radix-ui/react-dropdown-menu`: For routing mode selector UI

## API Changes

### New MCP Tools
- `smart_chat(message, prefer?, model?)` - Routed chat with backend selection
- `routing_stats()` - Get routing statistics

### New Tauri Commands
- `smart_chat(message, prefer?, model?)` - Same as MCP tool

### TypeScript Types
- `RoutingPreference = "auto" | "local" | "cloud"`
- `SmartChatResponse` - Response with backend info
- `ChatResult` - Simplified result with content, backend, model

## Files Modified
- mcp-server/src/opta_mcp/router.py (new)
- mcp-server/src/opta_mcp/server.py
- src-tauri/src/llm.rs
- src-tauri/src/lib.rs
- src/types/llm.ts
- src/hooks/useLlm.ts
- src/components/ChatMessage.tsx
- src/components/ChatInterface.tsx
- src/components/ui/dropdown-menu.tsx (new)

## Next Steps
- Plan 06-03: Usage tracking and cost dashboard
- Plan 06-04: Response caching to reduce API costs
