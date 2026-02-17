# Opta CLI — Competitive Implementation Queue

**Generated:** 2026-02-16 by Opta Max
**Source:** docs/competitive/COMPETITIVE-MATRIX.md
**Status:** Active — run sequentially via Claude Code

---

## Execution Order (Recommended)

Each task is a self-contained Claude Code session. Run:
```bash
cd /Users/matthewbyrden/Synced/Opta/1-Apps/1D-Opta-CLI-TS && claude --dangerously-skip-permissions
```

Then paste the one-liner from each task.

| Order | Task | File | Lines | Gap Closed | Dependencies |
|-------|------|------|-------|------------|-------------|
| 1 | **JSON Output Flag** | `auto-01-json-output.md` | ~30 | JSON output (score 2) | None |
| 2 | **Web Fetch Tool** | `auto-02-web-fetch-tool.md` | ~120 | Web fetch (score 3) | None |
| 3 | **Auto-Compact** | `auto-03-auto-compact.md` | ~150 | Context management (score 3) | None |
| 4 | **Multi-Edit Tool** | `auto-04-multi-edit-tool.md` | ~80 | Batch edit (score 3) | None |
| 5 | **Undo / Rollback** | `auto-05-undo-rollback.md` | ~150 | Undo (score 3) | Auto-04 (snapshots for multi_edit) |
| 6 | **Hooks / Lifecycle** | `auto-06-hooks-lifecycle.md` | ~180 | Hooks (score 3) | None |
| 7 | **Custom Tools** | `auto-07-custom-tools.md` | ~120 | User-defined tools (score 3) | None |
| 8 | **Token Display** | `auto-08-token-display.md` | ~60 | Token usage (score 2) | Auto-03 (estimateTokens) |

**Total: ~890 lines of new code across 8 tasks**

---

## Quick Wins First (Under 1 hour each)

1. ✨ Auto-01: JSON output (~30 lines, 20 min)
2. ✨ Auto-08: Token display (~60 lines, 30 min)
3. ✨ Auto-04: Multi-edit (~80 lines, 40 min)

## Medium Tasks (1-2 hours each)

4. 🔧 Auto-02: Web fetch (~120 lines, 1h)
5. 🔧 Auto-07: Custom tools (~120 lines, 1h)
6. 🔧 Auto-05: Undo/rollback (~150 lines, 1.5h)

## Larger Tasks (2+ hours)

7. ⚡ Auto-03: Auto-compact (~150 lines, 2h)
8. ⚡ Auto-06: Hooks/lifecycle (~180 lines, 2h)

---

## After Completing All 8

### Updated Feature Count
- Before: 22/42 (52%)
- After: **30/42 (71%)** — closes 8 gaps
- Remaining gaps: sub-agents, MCP, LSP, IDE extension, vision, git, thinking display (7 features)
- New tools: web_fetch, multi_edit, custom tools (12 total tools)

### Still Need V2 (Architectural)
| Feature | Why It Needs V2 |
|---------|----------------|
| Sub-agents | Requires agent architecture redesign (message routing, parallel execution) |
| MCP | Protocol implementation + server discovery + permission wrapping |
| Git checkpoints | Builds on Auto-05 undo, adds git layer |
| Export map | Builds on V2 OPIS, needs file analysis pipeline |

### Still Need External Work
| Feature | Why |
|---------|-----|
| LSP | Requires Go/Rust native module or language server process management |
| IDE extension | Separate project (VS Code extension + Opta CLI server mode) |
| Vision | Requires multimodal model support in inference layer |

---

## Tracking

After each task completes, update the COMPETITIVE-MATRIX.md:
1. Change the feature status from ⬜ to ✅
2. Recalculate summary scores
3. Note the implementation date in scan history
