---
status: review
---

# Opta Local Web — Roadmap

> Web platform delivery plan. iOS is currently deferred while web is stabilized.

---

## Current Phase: Phase 5 — Stabilization + Ship Readiness

---

## Phases

### Phase 0: Project Setup
**Goal:** Scaffold Next.js app and core design system
**Status:** Complete

| # | Task | Status | Acceptance Criteria |
|---|------|--------|-------------------|
| 1 | Initialize Next.js app | Done | `npm run dev` serves app at localhost:3004 |
| 2 | Configure @opta/ui integration | Done | Glass panels render with consistent styling |
| 3 | Set up LMX client library | Done | Can fetch core LMX endpoints |
| 4 | Set up Tailwind + design tokens | Done | Shared color tokens available via CSS vars |

---

### Phase 1: Foundation — Chat + Connection
**Goal:** Working streaming chat with manual connection
**Status:** Complete

| # | Task | Status | Acceptance Criteria |
|---|------|--------|-------------------|
| 1 | Connection settings page | Done | Enter host/port/key, persist in browser storage |
| 2 | Streaming chat UI | Done | Tokens stream in real-time with markdown rendering |
| 3 | Model picker | Done | Select model from `/v1/models` |
| 4 | Chat history | Done | Message history persists across refreshes |

---

### Phase 2: Dashboard
**Goal:** Real-time server monitoring
**Status:** Complete

| # | Task | Status | Acceptance Criteria |
|---|------|--------|-------------------|
| 1 | SSE connection to `/admin/events` | Done | Auto-connect and reconnect behavior in place |
| 2 | VRAM gauge component | Done | Animated gauge with used/total display |
| 3 | Loaded models list | Done | Displays loaded models with unload action |
| 4 | Model load flow | Done | One-click load path with config options |
| 5 | Throughput chart | Done | Tokens/sec history chart rendered |

---

### Phase 3: Anywhere (WAN Access)
**Goal:** Connect to LMX from outside LAN
**Status:** Complete

| # | Task | Status | Acceptance Criteria |
|---|------|--------|-------------------|
| 1 | Tunnel URL configuration | Done | Tunnel URL saved in settings |
| 2 | Connection type indicator | Done | LAN/WAN/offline status visualized |
| 3 | Auto-failover | Done | LAN-first probing with WAN fallback |

---

### Phase 4: Sessions
**Goal:** Resume CLI sessions in browser
**Status:** Complete

| # | Task | Status | Acceptance Criteria |
|---|------|--------|-------------------|
| 1 | Session list page | Done | Fetch and display sessions from LMX Session API |
| 2 | Session resume | Done | Load full session history and continue chat |
| 3 | Session search | Done | Filter by title/model/tag |

---

### Phase 5: Stabilization + Ship Readiness (Current)
**Goal:** Harden reliability and deployment readiness
**Status:** Complete

| # | Task | Status | Acceptance Criteria |
|---|------|--------|-------------------|
| 1 | Restore quality gates | Done | `npm run lint`, `npm run typecheck`, and `npm run build` pass |
| 2 | Next.js proxy migration | Done | Deprecated `middleware` convention removed |
| 3 | Connection settings reactivity | Done | Saving settings refreshes live connection context |
| 4 | Streaming robustness | Done | Stream cancellation signal wired to fetch |
| 5 | Web-only doc sync | Done | Feature/roadmap/workflow docs reflect current implementation |

---

### Later (Backlog)
- [ ] RAG Studio hardening and UX polish
- [ ] Multi-model router
- [ ] Image/Vision chat
- [ ] Multi-server fleet expansion
- [ ] Shared conversations
- [ ] Automation scheduler
- [ ] Benchmark suite refinement
- [ ] Context window visualizer

### Never (Anti-Features)
- Full IDE in browser
- Cloud API proxying (local models only)
- Heavy multi-tenant account model for v1 local mode

---

*Updated: 2026-02-28*
