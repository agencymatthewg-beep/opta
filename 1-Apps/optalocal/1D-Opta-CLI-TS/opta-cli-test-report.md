# Opta CLI Test Report — 2026-03-02 (04:00 AEST)

## Summary

| Metric | Status |
|--------|--------|
| TypeScript | ✅ 0 errors |
| TypeScript (browser) | ✅ 0 errors |
| Tests | ✅ 2609/2609 passing (234 files) |
| Tests (TUI only) | ✅ 383/383 (37 files) |
| Build | ✅ Clean ESM + DTS (~3.5s) |
| LMX Server | ✅ Online — MiniMax-M2.5-4bit loaded |
| Anthropic API | ✅ Working (via SDK) |

## Bugs Fixed (7)

### 1. Commander.js option conflict — --format/--provider/--device shadowed on subcommands
- **Root cause:** Root program defined --format, --provider, --device, --model etc. AND the do subcommand defined the same options. Commander.js absorbs options at parent level, leaving subcommand opts empty. `do --format json ""` silently ignored --format.
- **Fix:** Added `.enablePositionalOptions().passThroughOptions()` to root Command. Passes unrecognized options through to subcommands.
- **Impact:** `do --format json` now correctly outputs JSON. All subcommand options work independently from root.
- **Files:** `src/index.ts`

### 2. storage.test.ts — single quotes instead of template literals (3 instances)
- **Root cause:** `expect(path).toBe('${process.env.HOME ...}')` used single quotes instead of backticks — literal string not template. esbuild parse error.
- **Fix:** Replaced single quotes with backticks at lines 73, 279, 332.
- **Files:** `tests/accounts/storage.test.ts`

### 3. storage.test.ts — stale /mock-home assertion
- **Root cause:** mkdir assertion hardcoded `/mock-home/.config/opta` but node:os mock returns process.env.HOME (real HOME dir).
- **Fix:** Changed assertion to use template literal with process.env.HOME.
- **Files:** `tests/accounts/storage.test.ts`

### 4. cli.test.ts — stale --resume and --plan assertions (2 tests)
- **Root cause:** do command removed --resume and --plan flags but test still expected them in help output.
- **Fix:** Removed stale assertions from both help tests.
- **Files:** `tests/cli.test.ts`

### 5. lifecycle-crash-guardian.test.ts — mock missing isWindows export (3 tests)
- **Root cause:** vi.mock for platform/index.js only provided restrictFileToCurrentUser but module also exports isWindows, isMacOS, isLinux, homedir, etc. Code at paths.ts:16 accesses isWindows which was undefined.
- **Fix:** Added all missing exports to mock.
- **Files:** `tests/daemon/lifecycle-crash-guardian.test.ts`

### 6. session-manager.test.ts — cancelSessionTurns return type changed (2 tests)
- **Root cause:** cancelSessionTurns() refactored to return { cancelledQueued, cancelledActive } instead of plain number.
- **Fix:** Changed assertions to .toEqual({ cancelledQueued: 0, cancelledActive: false }).
- **Files:** `tests/daemon/session-manager.test.ts`

### 7. session-manager-cancel.test.ts — cancelSessionTurns return type changed (1 test)
- **Root cause:** Same as #6. Active turn cancel expected .toBe(1).
- **Fix:** Changed assertion to .toEqual({ cancelledQueued: 0, cancelledActive: true }).
- **Files:** `tests/daemon/session-manager-cancel.test.ts`

## TUI Health

- No ANSI cursor movement codes in src/tui/ ✅ (thinking shake eliminated)
- Only ANSI escapes: bracketed paste mode — intentional
- All 383 TUI tests pass across 37 files
- Menu rendering clean

## LMX Server Tests

| Test | Result |
|------|--------|
| Connectivity | ✅ Online |
| Model loaded | ✅ mlx-community/MiniMax-M2.5-4bit (loaded via admin API, 22.1s, 151GB) |
| Embedding model | ✅ BAAI/bge-base-en-v1.5 |
| Non-streaming response | ✅ Working |
| Streaming response | ✅ Working |
| Tool calling | ✅ Correct tool_calls response with finish_reason: "tool_calls" |
| TTFT (streaming) | 2.39s |
| Generation speed | 30.3 tok/s ✅ (exceeds 25 tok/s target) |

### LMX Notes
- TTFT of 2.39s above 1s target — MiniMax-M2.5 internal CoT processing
- 30.3 tok/s exceeds 25 tok/s target ✅ (improvement from 23.3 tok/s last session)
- Model not auto-loaded at LMX start — loaded manually via admin API
- Tool calling works correctly with proper function.arguments JSON

## Test Progression

| Session | Total Tests | Passing | Failing |
|---------|-------------|---------|---------|
| 2026-02-20 | 896 | 896 | 0 |
| 2026-02-27 | 1714 | 1714 | 0 |
| 2026-02-28 | 2503 | 2502 | 1 (expected skip) |
| 2026-03-01 | 2436 | 2403 | 33 (Xcode license) |
| **2026-03-02** | **2609** | **2609** | **0** |

## Files Modified This Session

1. `src/index.ts` — Added .enablePositionalOptions().passThroughOptions() to root Command
2. `tests/accounts/storage.test.ts` — Fixed 3 template literal quotes + 1 stale path assertion
3. `tests/cli.test.ts` — Removed stale --resume and --plan assertions
4. `tests/daemon/lifecycle-crash-guardian.test.ts` — Added missing platform mock exports
5. `tests/daemon/session-manager.test.ts` — Updated return type assertions for cancelSessionTurns
6. `tests/daemon/session-manager-cancel.test.ts` — Updated return type assertion for cancelSessionTurns

## Action Items

- [ ] Commit accumulated changes across sessions
- [ ] Target TTFT <1s — model pre-warm or prompt optimization for MiniMax CoT
- [ ] Add LMX launchd auto-start on Mono512 with model pre-load
- [ ] Version bump: 0.5.0-alpha.1 → 0.5.0-beta.1 after E2E verified
