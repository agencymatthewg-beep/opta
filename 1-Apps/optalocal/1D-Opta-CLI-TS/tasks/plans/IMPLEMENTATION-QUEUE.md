# Opta CLI — Competitive Implementation Queue

**Generated:** 2026-02-16 by Opta Max
**Source:** docs/competitive/COMPETITIVE-MATRIX.md
**Status:** COMPLETE — all 8 tasks implemented and verified 2026-02-17

---

## Execution Order (Recommended)

Each task is a self-contained Claude Code session. Run:
```bash
cd /Users/matthewbyrden/Synced/Opta/1-Apps/1D-Opta-CLI-TS && claude --dangerously-skip-permissions
```

Then paste the one-liner from each task.

| Order | Task | File | Status | Evidence |
|-------|------|------|--------|----------|
| 1 | **JSON Output Flag** | `auto-01-json-output.md` | DONE | `do.ts` has `parseDoOutput`/`formatDoResult`, `chat.ts` has `formatChatJsonLine`, `index.ts` has `-f, --format` on both commands |
| 2 | **Web Fetch Tool** | `auto-02-web-fetch-tool.md` | DONE | `web_fetch` in `schemas.ts`, `execWebFetch` in `executors.ts` with URL validation, HTML extraction, 10s timeout |
| 3 | **Auto-Compact** | `auto-03-auto-compact.md` | DONE | `estimateTokens()` + `compactHistory()` in `agent.ts`, auto-triggers at configurable threshold, `COMPACTION_PROMPT` in `context.ts` |
| 4 | **Multi-Edit Tool** | `auto-04-multi-edit-tool.md` | DONE | `multi_edit` schema in `schemas.ts`, `execMultiEdit` in `executors.ts` with file grouping, partial failure reporting, 20-edit limit |
| 5 | **Undo / Rollback** | `auto-05-undo-rollback.md` | DONE | `/undo` slash command in `workflow.ts` using git checkpoints (`git/checkpoints.ts`), supports `/undo list` and `/undo N` |
| 6 | **Hooks / Lifecycle** | `auto-06-hooks-lifecycle.md` | DONE | `HookManager` in `hooks/manager.ts`, `integration.ts` helpers, 6 events wired in `agent.ts`, NoOpHookManager for zero-hooks case |
| 7 | **Custom Tools** | `auto-07-custom-tools.md` | DONE | `tools/custom.ts` with `loadCustomTools`, `executeCustomTool`, `toToolSchema`; integrated in `mcp/registry.ts` |
| 8 | **Token Display** | `auto-08-token-display.md` | DONE | `StatusBar` class in `ui/statusbar.ts`, tokens/speed/tools per turn + cumulative session stats, printed after each turn in `agent.ts` |

**Total: All 8 tasks complete. 689 tests passing.**

---

## After Completing All 8

### Updated Feature Count
- Before: 22/42 (52%)
- After: **30/42 (71%)** — closes 8 gaps
- Additional features implemented beyond the queue: sub-agents, MCP, LSP, git checkpoints, background processes, thinking display
- Remaining gaps: IDE extension, vision

### Still Need V2 (Architectural)
| Feature | Why It Needs V2 |
|---------|----------------|
| Export map | Builds on V2 OPIS, needs file analysis pipeline |

### Still Need External Work
| Feature | Why |
|---------|-----|
| IDE extension | Separate project (VS Code extension + Opta CLI server mode) |
| Vision | Requires multimodal model support in inference layer |

---

## Tracking

After each task completes, update the COMPETITIVE-MATRIX.md:
1. Change the feature status from ⬜ to ✅
2. Recalculate summary scores
3. Note the implementation date in scan history
