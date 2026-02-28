---
title: Opta CLI Roadmap
scope: Level 3 daemon-first delivery and stabilization
updated: 2026-02-28
reference: docs/FEATURE-PLAN.md
status: active
---

# Opta CLI — Roadmap

## Current Status (2026-02-28)

- Architecture direction is locked to **Level 3** (`opta tui` aliasing `opta chat --tui` + `opta daemon`).
- Core daemon runtime, protocol v3 types, session queueing, and reconnect stream paths are in place.
- `opta chat` and `opta do` can operate via daemon attach paths.
- `/v1/chat` compatibility is retained on daemon.

## Phase A: Foundation Completion (In Progress)

### Goals
- Harden protocol contracts and runtime behavior.
- Complete cancellation, replay, and multi-writer determinism.
- Remove known TUI instability hotspots.

### Scope
- v3 envelope/schema validation and route parity.
- Active-turn cancel propagation and queue correctness.
- Markdown renderer crash fallback hardening.
- Health/metrics/log diagnostics for daemon operations.

### Exit Criteria
- [ ] Typecheck + test suite green.
- [ ] No hard UI stalls in tool-heavy streaming turns.
- [ ] Reconnect/replay recovers current session state.

## Phase B: Compatibility Lock (Next)

### Goals
- Preserve legacy command UX while routing through daemon runtime.

### Scope
- `opta chat`, `opta do`, `opta server` strict behavior parity.
- Completion/help surfaces updated for daemon lifecycle commands.
- One release window with emergency fallback toggle retained.

### Exit Criteria
- Existing scripts run without command rewrites.
- Compatibility shim coverage includes common automation flows.

## Phase C: Cross-Client Interop (Next)

### Goals
- Support terminal and web clients against one daemon/session model.

### Scope
- Shared daemon client library for Opta Local web.
- WS primary + SSE fallback attach paths.
- Multi-writer behavior under concurrent clients.

### Exit Criteria
- Terminal + web can concurrently attach and submit turns deterministically.

## Phase D: LMX Transport Optimization (Parallel)

### Goals
- Reduce token latency and improve cancellation semantics against Opta LMX.

### Scope
- WS-first LMX stream preference (`/v1/chat/stream`) with SSE fallback.
- End-to-end cancellation behavior for in-flight turns.
- Usage accounting resilience when stream usage metadata is missing/degraded.

### Exit Criteria
- Stable streaming under sustained load.
- Accurate or explicitly degraded token accounting without crashes.

## Phase E: Production Hardening

### Goals
- Operational confidence and maintainability.

### Scope
- Soak/perf testing (p95 latency + event-loop lag thresholds).
- Crash recovery validation from snapshots/events.
- Documentation alignment and stale architecture cleanup.

### Exit Criteria
- Release-quality reliability across long-running sessions and reconnect scenarios.

## Deferred / Later

- Native alternate TUI client implementations (e.g. non-React runtime).
- Rich remote multi-device orchestration features.
- Additional provider transport optimizations beyond current LMX focus.
