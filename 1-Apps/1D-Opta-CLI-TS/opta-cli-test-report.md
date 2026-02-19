# Opta CLI — Overnight Debug Session Report

**Date:** 2026-02-19 04:00 AEST  
**Session Type:** Automated overnight cron  
**Focus Areas:** Display & TUI Issues, Models Functionality

---

## Summary

| Area | Status | Details |
|------|--------|---------|
| TypeScript typecheck | ✅ Fixed | Was 9 errors, now 0 |
| Test suite | ✅ Fixed | Was 2 failures, now 896/896 passing |
| Build | ✅ Clean | ESM + DTS build succeeds |
| Thinking shake (ANSI cursor) | ✅ Already resolved | No cursor movement codes in thinking renderer |
| TUI `spaceBetween` rendering | ✅ Fixed | 9 instances in WelcomeScreen.tsx |
| Test accuracy (pricing) | ✅ Fixed | Test expectations matched to actual code behavior |
| Test accuracy (statusbar) | ✅ Fixed | Test matched to actual "Free" display for LMX |

---

## Bugs Found & Fixed

### 1. WelcomeScreen.tsx — TypeScript Error: `spaceBetween` → `space-between` (FIXED)

**File:** `src/tui/WelcomeScreen.tsx`  
**Issue:** 9 instances of `justifyContent="spaceBetween"` using React-style camelCase instead of Ink's CSS-style `space-between`.  
**Impact:** TypeScript compilation failed with 9 TS2820 errors. The TUI WelcomeScreen may not have rendered properly in the Ink framework.  
**Fix:** Replaced all `spaceBetween` with `space-between`.

### 2. pricing.test.ts — Incorrect Test Expectation (FIXED)

**File:** `tests/utils/pricing.test.ts`  
**Issue:** Test expected `formatCost()` to return `<$0.0001` for `estimateCost(10, 5, 'anthropic')`, but the actual cost is `$0.000105` (> $0.0001 threshold), so the code correctly returns `~$0.0001`.  
**Fix:** Updated test to expect `~$0.0001` for the given inputs. Added separate test for truly tiny costs (1 input + 1 output token → `<$0.0001`).

### 3. statusbar.test.ts — Wrong Cost Format Expectation (FIXED)

**File:** `tests/ui/statusbar.test.ts`  
**Issue:** Test expected `$0.00` in the summary string, but the StatusBar uses `'lmx'` as default provider (local inference), so `estimateCost()` returns "Free" not a dollar amount.  
**Fix:** Updated test to expect `Free` for local models. Added new test with `provider: 'anthropic'` to verify cloud cost formatting.

---

## Display & TUI Analysis

### Thinking Shake — Already Resolved ✅

The original thinking shake issue (rapid stdout updates with ANSI cursor codes) has already been addressed:

- `ThinkingRenderer` (src/ui/thinking.ts) now buffers all content until `</think>` is found
- No cursor movement sequences (CSI `A`, `B`, `H`, etc.) are used
- Only prints a single `⚙ thinking...` line, then the collapsed summary
- Comments in the code confirm this was an intentional fix: "Don't stream every chunk - that causes shaking"

ANSI codes found in codebase are limited to:
- `src/tui/render.tsx` — Alt screen buffer enter/leave + cursor hide/show (standard terminal fullscreen)
- `src/ui/box.ts` — ANSI stripping regex for width calculation

### TUI Component Review

All 26 TUI components were reviewed:

| Component | Status | Notes |
|-----------|--------|-------|
| App.tsx | ✅ Clean | Well-structured, proper state management |
| Header.tsx | ✅ Clean | Responsive compact mode |
| InputBox.tsx | ✅ Clean | Good cursor rendering, autocomplete |
| MessageList.tsx | ✅ Clean | Turn separators, WelcomeScreen integration |
| ScrollView.tsx | ✅ Clean | Proportional scrollbar, auto-scroll |
| StreamingIndicator.tsx | ✅ Clean | Multi-phase with Braille spinner |
| ThinkingBlock.tsx | ✅ Clean | Expanded/collapsed modes |
| ToolCard.tsx | ✅ Clean | Rich tool-specific arg rendering |
| PermissionPrompt.tsx | ✅ Clean | Auto-deny countdown, Y/n/a prompt |
| ModelPicker.tsx | ✅ Clean | Arrow nav, current model indicator |
| CommandBrowser.tsx | ✅ Clean | Categorized command list |
| HelpOverlay.tsx | ✅ Clean | Keybinding reference |
| WelcomeScreen.tsx | ✅ Fixed | spaceBetween → space-between |
| Sidebar.tsx | ✅ Clean | Connection, token, context stats |
| StatusBar.tsx | ✅ Clean | Context bar, token split display |
| SplitPane.tsx | ✅ Clean | Left/right sidebar support |
| MarkdownText.tsx | ✅ Clean | Width-aware, streaming debounce |
| ErrorDisplay.tsx | ✅ Present | Not reviewed (simple component) |
| InsightBlock.tsx | ✅ Present | Not reviewed (simple component) |
| FocusContext.tsx | ✅ Clean | 3-panel cycle |
| capture.ts | ✅ Clean | Console redirection for TUI |
| adapter.ts | ✅ Clean | EventEmitter bridge, permission flow |
| render.tsx | ✅ Clean | Alt buffer management, TTY fallback |
| keybindings.ts | ✅ Clean | Configurable bindings |
| useKeyboard.ts | ✅ Clean | Binding matcher |
| useTerminalSize.ts | ✅ Present | Not reviewed |

### TUI Architecture Quality Notes

- **Streaming pipeline is solid:** `agent.ts` → `agent-streaming.ts` → `ThinkingRenderer` → `TuiEmitter` → React components
- **Permission flow is well-designed:** Promise-based bridge between agent loop and TUI, with 30s auto-deny
- **Console capture for slash commands:** Clean approach for bridging console.log-based handlers into TUI
- **No raw ANSI cursor manipulation in TUI mode:** All rendering goes through Ink's React tree

---

## Models Functionality Analysis

### LMX Client (`src/lmx/client.ts`)

- Clean OpenAI-compatible adapter wrapping `/admin/*` endpoints
- Raw API response types properly mapped to public types
- `lookupContextLimit()` delegates to `core/models.ts` canonical profiles
- Timeout not explicitly set on fetch calls (could improve with `AbortSignal.timeout`)

### Models Command (`src/commands/models.ts`)

- `list`, `use`, `info`, `load`, `unload`, `scan` subcommands all implemented
- `scan` provides rich output: loaded, on-disk, presets, cloud, memory usage
- JSON output mode (`--json`) available for automation
- Error handling with `ExitError` for proper exit codes

### Agent Streaming (`src/core/agent-streaming.ts`)

- Retry with exponential backoff for transient errors (ECONNREFUSED, 5xx, etc.)
- Stream token accumulation with proper tool call index tracking
- `stream_options: { include_usage: true }` for API token usage reporting
- Thinking renderer integration: buffers until `</think>` detected

### Potential Improvement: Response Truncation Guard

The agent loop doesn't currently check for `finish_reason: 'length'` (truncated response). If the model hits its max output token limit, the response silently truncates without warning. Consider adding:

```typescript
// In collectStream, after the loop:
if (lastFinishReason === 'length') {
  console.warn(chalk.yellow('⚠ Response was truncated (hit token limit)'));
}
```

### Tool Calling E2E

Tool calling pipeline is well-structured:
1. `agent.ts` orchestrates the loop
2. `agent-streaming.ts` collects tool calls from streamed chunks
3. `agent-permissions.ts` resolves approval (allow/ask/deny)
4. `agent-execution.ts` dispatches tools in parallel with semaphore
5. Results fed back to model for next iteration

Circuit breaker: warn at configurable count, pause at threshold, hard-stop at max.

---

## Test Suite Status

```
Test Files  81 passed (81)
Tests       896 passed (896)
Duration    12.64s
```

All tests green. No flaky tests detected.

---

## Recommendations for Next Session

### High Priority
1. **Add `finish_reason: 'length'` detection** — Warn when model output is truncated
2. **Commit these fixes** — The WelcomeScreen, pricing, and statusbar fixes should be committed
3. **LMX connection test** — Run `opta status` / `opta models` against Mono512 to verify end-to-end

### Medium Priority
4. **TUI real-terminal test with Opus** — The components look solid in code review but need real hardware test
5. **Add fetch timeout to LMX client** — `AbortSignal.timeout(10000)` on admin API calls
6. **TTFT tracking in REPL mode** — The TUI adapter tracks it, but the REPL status bar doesn't show it

### Low Priority
7. **MarkdownText initial render flash** — First render shows raw text before `marked` loads (async init)
8. **ScrollView line estimation** — Approximate; could cause minor scroll position drift on very long messages
9. **CLAUDE.md sync** — File structure in CLAUDE.md is slightly outdated (missing some new files like `onboard.ts`, `ErrorDisplay.tsx`, `InsightBlock.tsx`, etc.)

---

## Files Modified

| File | Change |
|------|--------|
| `src/tui/WelcomeScreen.tsx` | Fixed 9× `spaceBetween` → `space-between` |
| `tests/utils/pricing.test.ts` | Fixed test expectations, added new test case |
| `tests/ui/statusbar.test.ts` | Fixed cost format expectation, added cloud cost test |
