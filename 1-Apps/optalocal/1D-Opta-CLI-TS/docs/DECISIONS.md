---
title: Architecture Decisions
purpose: Settled design choices and rationale for current Opta CLI architecture
updated: 2026-02-20
reference: docs/plans/2026-02-20-level3-daemon-program-plan.md
---

# Opta CLI — Architecture Decisions (L3 Era)

This document records current, active decisions. Earlier pre-daemon decisions
are superseded unless explicitly listed as legacy compatibility notes.

## Decision 0: Browser MCP Bridge + Sub-Agent Delegation (2026-02-28)

### Decision
Replace the 7-tool legacy `browser_*` surface (browser_open, browser_navigate, browser_click, browser_type, browser_snapshot, browser_screenshot, browser_close) with `@playwright/mcp` providing 30+ tools. All Playwright MCP calls route through `BrowserMcpInterceptor` preserving the full safety stack. Browser goals are delegated to full-peer sub-agents via `BrowserSubAgentDelegator`.

### Rationale
- **Coverage gap**: Legacy surface was missing scroll, hover, JS eval, tab management, drag, dialog handling. The 7-tool subset forced workarounds.
- **Safety preserved**: `BrowserMcpInterceptor` wraps every MCP call: policy evaluation → gate/deny → execute → approval log → artifact record. Zero safety regression from the cutover.
- **Sub-agent autonomy**: Main agent delegates browser goals as a single `delegateToBrowserSubAgent()` call. The sub-agent runs a full Playwright loop; the main agent sees one tool result.
- **Hard cutover**: Zero legacy tool schemas, executors, or permissions remain. Single clean path reduces cognitive overhead and eliminates dual-path bugs.

### Files
- `src/browser/mcp-interceptor.ts` — policy/approval/artifact pipeline
- `src/browser/sub-agent-delegator.ts` — autonomous browser goal delegation
- `src/mcp/registry.ts` — intercepts Playwright MCP calls via `PLAYWRIGHT_MCP_SERVER_KEY`
- `src/browser/policy-engine.ts` — extended with MCP-only tool risk tiers
- `src/browser/adaptation.ts` — MCP signal vocabulary (high/medium risk sets)

### Gate
All 139+ pre-existing browser tests pass with zero legacy tool references in `src/core/tools/`.

---

## Decision 1: Level 3 Process Separation Is the Default Architecture

### Decision
- Use two OS processes:
  - `opta daemon` for agent loop/runtime/tool/LMX/session ownership
  - `opta tui` (alias of `opta chat --tui`) for terminal rendering and input only

### Rationale
- Terminal rendering stays responsive under inference/tool load.
- TUI can reconnect without losing daemon session state.
- Multi-client attach (terminal + web) is possible.

## Decision 2: Transport Split = HTTP Control + WebSocket Events

### Decision
- HTTP for lifecycle/control endpoints.
- WebSocket for ordered realtime event streams and client actions.
- SSE remains as a read-only fallback/debug channel.

### Rationale
- WS gives bidirectional low-overhead streaming for high event rates.
- HTTP control endpoints keep operational behavior scriptable.
- SSE improves browser/curl operability without replacing WS.

## Decision 3: Fastify Is the Daemon HTTP Framework

### Decision
- Standardize daemon API hosting on Fastify.

### Rationale
- Strong typed route ergonomics and plugin ecosystem.
- Reliable lifecycle hooks and operational behavior in Node.
- Simple integration with WebSocket routes.

## Decision 4: Strict Command Compatibility Is Mandatory

### Decision
- Preserve existing user command surface (`opta chat`, `opta do`, `opta server`, flags).
- Internals may route through daemon APIs, but UX contract remains stable.

### Rationale
- Avoid breaking scripts during architecture migration.
- Enable gradual rollout while retaining emergency fallback paths.

## Decision 5: Daemon Lifecycle Uses Hybrid Start Model

### Decision
- `opta chat` / `opta do` auto-start and attach to daemon when needed.
- Explicit lifecycle commands are supported:
  - `opta daemon start|stop|status|logs`

### Rationale
- Best default UX for normal users.
- Strong operational controls for debugging and automation.

## Decision 6: Session Semantics = Single Active Turn + Multi-Writer Queue

### Decision
- Each session executes one active turn at a time.
- Multiple writers can submit turns; ordering is deterministic by daemon ingress sequence.
- Permission races are resolved with first-valid-decision-wins CAS semantics.

### Rationale
- Deterministic behavior under concurrent clients.
- Avoid state corruption from parallel writes in one session.

## Decision 7: Security Baseline = Loopback + Session Token

### Decision
- Daemon binds to `127.0.0.1` by default.
- `Authorization: Bearer <token>` required for protected routes.
- Query-token fallback allowed for browser-only channels where headers are constrained.

### Rationale
- Local-first security posture with minimal friction.
- Supports browser websocket/eventsource constraints for local web clients.

## Decision 8: Event Durability = Append-Only Log + Snapshots

### Decision
- Persist per-session event stream and snapshots on disk under daemon state.
- Reconnect/replay uses monotonic sequence cursors (`afterSeq`).

### Rationale
- Crash recovery and reconnect continuity without fragile in-memory assumptions.
- Enables deterministic replay for diagnostics.

## Decision 9: Rendering Policy = Adaptive Token Batching (2-32ms)

### Decision
- Replace fixed token flush cadence with adaptive batching based on token rate.
- Immediate flush on newline, tool boundaries, errors, and turn completion.

### Rationale
- Better smoothness/input responsiveness under both low and bursty token rates.
- Matches high-FPS terminal behavior without over-rendering.

## Legacy Compatibility Notes

- `/v1/chat` remains available as a compatibility shim on daemon.
- `opta server` now uses daemon backend behavior instead of a separate standalone runtime.
