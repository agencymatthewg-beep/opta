
## Session — 2026-03-06 (04:00 AEST) Overnight Opta CLI Debug Session

### Executive Summary
- Removed TUI-side stdout thinking writes to eliminate cursor shake/ANSI churn while streaming.
- Throttled live thinking updates (40ms flush) and fixed offline startup gating so slash diagnostics remain available while normal prompts are blocked.
- Confirmed LMX model load and benchmarked MiniMax M2.5 4b (Avg 39.0 tok/s, 830ms TTFT).
- Tool-calling end-to-end verified via `opta do` run_command (pwd); local agent loop succeeded but CLI process lingered after completion (manual terminate).
- Opus TUI launch attempted; failed due to HF auth/invalid repo_id (`opus`) and triggered max update depth warning (needs follow-up).

### Changes Made
1. **Thinking stream stability**
   - Files: `src/ui/thinking.ts`, `src/core/agent-streaming.ts`
   - Added `enableTerminalOutput` to suppress stdout writes when TUI streaming callbacks are active.
   - Impact: eliminates cursor shake in TUI mode.

2. **TUI responsiveness + offline gating**
   - Files: `src/tui/hooks/useStreamingEvents.ts`, `src/tui/App.tsx`, `src/tui/hooks/useSubmitHandler.ts`
   - Throttled thinking text updates (40ms flush) to reduce re-render jitter.
   - Offline startup notice persists until connection recovery.
   - Offline prompts blocked in submit handler while keeping `/` commands + shell available.
   - Impact: smoother streaming and offline diagnostics remain usable.

### Tests Run (This Session)
- `npm run test:tui` ✅ 396/396

### LMX / Opus / Tooling Validation
- `opta status` ✅ (LMX OK)
- `opta models list` ✅
- `opta models load mlx-community/MiniMax-M2.5-4bit` ✅ (already loaded)
- `opta models benchmark mlx-community/MiniMax-M2.5-4bit` ✅
  - Avg tok/s 39.0 · Avg TTFT 830ms · Backend mlx
- Tool calling: `opta do "Use run_command to execute: pwd..." --device Mono512.local:1234 --dangerous`
  - `run_command` executed, returned OK. Process did not exit cleanly after completion (manual terminate).
- Response completeness: `opta do "Write exactly 60 words..." --device Mono512.local:1234`
  - Full response returned, no truncation warning; LMX reconnect warnings observed; process lingered (manual terminate).
- Opus TUI launch: `opta tui --model opus` ❌
  - HF 401 / repo not found for `opus` + admin key rejection.
  - Repeated "Maximum update depth exceeded" warning in TUI render loop.

### Blockers / Risks
- `opta do` processes linger after completion when using local agent loop (needs investigation).
- Opus model ID invalid for LMX download; requires correct repo_id + auth.

### Files Modified This Session
- `src/ui/thinking.ts`
- `src/core/agent-streaming.ts`
- `src/tui/hooks/useStreamingEvents.ts`
- `src/tui/App.tsx`
- `src/tui/hooks/useSubmitHandler.ts`

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
