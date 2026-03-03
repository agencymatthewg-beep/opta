
## Session — 2026-03-04 (04:00 AEST) Overnight Debug Continuation

### Executive Summary
- Focused on TUI rendering stability and startup/model responsiveness for LMX.
- Fixed 5 targeted regressions and added protections against malformed slash metadata.
- Added runtime model auto-load path to avoid starting TUI in a false "No model loaded" state.
- Added completion budget handling to avoid truncation-by-default for large models.
- Improved message rendering path to avoid markdown parsing overhead for non-markdown assistant content.

### Changes Made
1. **Removed ANSI screen-control path from legacy pane menu renderer**
   - File: `src/ui/pane-menu.ts`
   - Replaced raw `\x1b[2J\x1b[H` usage with `readline.cursorTo` + `clearScreenDown`.
   - Added pane index clamping to prevent out-of-range selection state.
   - Removed explicit cursor hide/show escape sequences on open/close.
   - Impact: stable menu draws without direct cursor-position escape writes.

2. **Auto-load model on LMX startup preflight**
   - File: `src/commands/chat.ts`
   - Added `ensureModelLoadedOnLmxStartup(...)` that:
     - Keeps existing preflight check for loaded models.
     - Calls `ensureModelLoaded(...)` when model is not loaded.
     - Marks startup as ready when load succeeds.
     - Surfaces load failures in startup error path when not recoverable.
   - Startup flow now uses this helper for both resumed and new sessions.
   - Impact: when model is present but not loaded, chat now triggers startup loading automatically and proceeds.

3. **Added completion budget to chat completion requests**
   - Files: `src/core/agent.ts`
   - Added dynamic budget estimate helper `estimateCompletionBudget(...)`.
   - Injected `max_tokens` into `createStreamWithRetry` request with context-aware budget.
   - Impact: reduces truncation risk from unbounded defaults and allows full responses under model context constraints.

4. **InputBox slash-command resilience improvements**
   - File: `src/tui/InputBox.tsx`
   - Hardened slash matcher against malformed command metadata (`undefined` command / non-string alias).
   - Guarded completion path before writing slash suggestion into buffer.
   - Hardened suggestion row rendering keys and fallback content formatting.
   - Added regression test for malformed slash metadata handling.

5. **MessageList rendering perf/latency tweak**
   - File: `src/tui/MessageList.tsx`
   - Added markdown syntax detection and short-circuit to plain text rendering when no markdown markers are present.
   - Avoided expensive markdown preparation pipeline for non-markdown assistant content.
   - Impact: improved list render throughput and removed TUI performance test failures in local bench.

### Tests Run (This Session)
- `npx vitest run tests/ui/pane-menu.test.ts` ✅ 1/1
- `npx vitest run tests/core/agent-protocol-retry.test.ts` ✅ 2/2
- `npx vitest run tests/commands/chat-startup.test.ts` ✅ 8/8
- `npx vitest run tests/tui/render-performance.test.tsx` ✅ 5/5
- `npx vitest run tests/tui/InputBox.test.tsx` ✅ 18/18
- `npx vitest run tests/core/agent-streaming-transport.test.ts tests/commands/do-runtime.test.ts tests/commands/chat-json.test.ts` ✅ 17/17
- `npm run test:core` ⚠️ 2 failing in pre-existing `tests/core/tools.test.ts` (memory persistence fixture expectation drift)

### LMX / Opus Validation
- Could not run true Opus terminal + full session verification in this environment:
  - `curl` checks for local LMX API were unavailable.
- Tool-calling path still covered by suite expectations in `tests/core/agent-streaming-transport.test.ts` and `tests/core/agent-protocol-retry.test.ts`.
- Suggestion: rerun full live checks from Opus host once daemon is reachable.

### Files Modified This Session
- `src/ui/pane-menu.ts`
- `src/commands/chat.ts`
- `src/core/agent.ts`
- `src/tui/InputBox.tsx`
- `src/tui/MessageList.tsx`
- `tests/ui/pane-menu.test.ts` *(new)*
- `tests/commands/chat-startup.test.ts`
- `tests/core/agent-protocol-retry.test.ts`
- `tests/tui/InputBox.test.tsx`

### Blockers / Risks
- `npm run test:tui` and full-suite `npm run test` remain noisy from existing environment-specific flakes outside edited paths.
- Real LMX/Opus runtime latency and token-throughput numbers are not re-collected this session due server availability.
- Recommend a one-shot overnight run on Opus host for TTFT and end-to-end tool-call trace capture.
