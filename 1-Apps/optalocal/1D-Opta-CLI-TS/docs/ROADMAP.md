---
title: Opta CLI Roadmap
updated: 2026-02-28
status: active
---

# Opta CLI — Roadmap

## Current State (2026-02-28)

**Version:** `0.5.0-alpha.1`

The core feature set is complete. The CLI ships a production-quality agent loop, full-screen TUI, daemon HTTP/WS server, browser automation, MCP/LSP integration, and full Codex Desktop parity spec coverage. What remains before v1.0 is operational: soak testing, macOS packaging, and documentation.

### What is shipped and working

| Area | Status |
|------|--------|
| Core agent loop (streaming, tools, compaction, circuit breaker) | ✅ Complete |
| Premium TUI — all 10 phases (markdown, input, slash, tool cards, thinking, permissions, scrollback, integration, keybindings, polish) | ✅ Complete |
| Daemon — HTTP v3 REST + WebSocket, worker pool, session manager, permission coordinator | ✅ Complete |
| LMX provider (primary) + Anthropic provider (cloud fallback) | ✅ Complete |
| LMX WebSocket stream + SSE fallback + zero-noise reconnect | ✅ Complete |
| Browser automation — Playwright MCP bridge, sub-agent delegator, policy engine, visual diff | ✅ Complete |
| MCP server registry, LSP client lifecycle | ✅ Complete |
| Settings overlay (9 pages), Account Sign In, Keychain storage | ✅ Complete |
| All 10 P0 parity scenarios (Codex Desktop Parity Spec) | ✅ Complete |
| All 6 P1 parity scenarios | ✅ Complete |
| 2,367 tests passing (212 test files) | ✅ Green |

---

## Path to v1.0

### Phase 1 — Stability Lock (Complete)

**Goal:** Verify the system holds under real workloads with no known flakes.

| Task | Status |
|------|--------|
| Full `npm test` passes on clean tree | ✅ Done |
| `npm run typecheck` passes | ✅ Done |
| Daemon parity suite (`test:parity:ws9`) | ✅ Done |
| Browser safety/runtime regression suites | ✅ Done |
| Cancel/reconnect flake audit | ✅ Done |

**Exit criteria:** No known flakes in session attach, reconnect, or cancel paths.

---

### Phase 2 — Runtime Confidence

**Goal:** Evidence-based confidence that the system performs under load.

| Task | Status |
|------|--------|
| Cancellation propagation: CLI → daemon → LMX transport | ⬜ TODO |
| Replay/reconnect across process restarts | ⬜ TODO |
| Multi-writer determinism (CLI + secondary client attach) | ⬜ TODO |
| p95 latency + event-loop lag soak runs (store evidence) | ⬜ TODO |

**Exit criteria:** All paths verified with documented evidence.

---

### Phase 3 — Release Readiness

**Goal:** A macOS user can install and run `opta` on a clean machine end to end.

| Task | Status |
|------|--------|
| macOS packaging — artifact naming and signing workflow | ⬜ TODO |
| Validate `opta --help` on clean machine post-install | ⬜ TODO |
| Validate first-run LMX connect flow on LAN defaults | ⬜ TODO |
| Publish release notes with hardware/runtime constraints | ⬜ TODO |

**Exit criteria:** macOS install verified on clean machine end to end.

---

### Phase 4 — Documentation Lock

**Goal:** All docs match actual runtime behavior. No stale defaults or architecture descriptions.

| Task | Status |
|------|--------|
| Align `docs/ROADMAP.md` with current state | ✅ Done (this document) |
| Align `docs/ECOSYSTEM.md` with implemented behavior | ✅ Done |
| Publish daemon operator runbook | ✅ Done (`docs/OPERATOR-RUNBOOK.md`) |
| Publish known-good command matrix | ✅ Done (`docs/COMMAND-MATRIX.md`) |
| Update `docs/INDEX.md` with new doc inventory | ✅ Done |
| Update `README.md` version and status | ✅ Done |

**Exit criteria:** All docs accurately describe what ships, not what was planned.

---

## v1.0 Release Criteria

All of the following must be true:

- [ ] Phases 1–4 all complete
- [ ] No known P0/P1 defects in daemon attach/reconnect/permission flow
- [ ] macOS install path verified on clean machine end to end
- [ ] CI remote configured and all parity checks green
- [ ] `docs/` accurately reflects shipped behavior

---

## Deferred (Post-v1.0)

These are out of scope for v1.0:

- Windows packaging / installer
- Opta Init funnel integration (download link, first-run wizard)
- Additional provider transports beyond LMX + Anthropic
- Native alternate TUI client implementations
- Rich remote multi-device orchestration
- Cloud session sync
