# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-18)

**Core value:** Chat with your local AI from anywhere — phone, laptop, LAN, or WAN — with zero terminal commands.
**Current focus:** Phases 1-5 complete — Web Command Center fully built. Ready for Phase 6 (iOS Foundation).

## Current Position

Phase: 5 of 8 (Web Sessions)
Plan: 3 of 3 in current phase
Status: Phase complete — all web phases done
Last activity: 2026-02-18 — Completed 05-03-PLAN.md

Progress: █████████████░░░░░ 12/18 (67%)

## Performance Metrics

**Velocity:**
- Total plans completed: 12
- Average duration: ~5 min
- Total execution time: ~1 hour (parallel execution across 4 phases)

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. Web Project Setup | 2/2 | 5 min | 2.5 min |
| 2. Web Foundation | 2/2 | ~8 min | ~4 min |
| 3. Web Dashboard | 3/3 | ~15 min | ~5 min |
| 4. Web Anywhere | 2/2 | ~10 min | ~5 min |
| 5. Web Sessions | 3/3 | ~18 min | ~6 min |

**Recent Trend:**
- Phases 2-5 executed in parallel waves (not sequential)
- Wave-based parallelism with up to 4 concurrent agents
- Trend: Accelerating via parallelism

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- OPIS: Web first, iOS second (faster iteration, validates API patterns)
- OPIS: Direct browser-to-LMX (no intermediate backend)
- OPIS: /frontend-design skill mandatory for all UI work
- 01-01: Port 3004 for Opta Local Web (3000=AICompare, 3001=Opta Life Web)
- 01-01: Tailwind 4 CSS-only tokens (no tailwind.config.js)
- 01-02: LMXClient uses native fetch with ReadableStream for streaming
- 01-02: Admin key encrypted via AES-GCM with PBKDF2 (Web Crypto API)
- 02-01: Streamdown for streaming markdown (not react-markdown)
- 02-01: useTransition for non-blocking token appends
- 02-02: idb-keyval for chat persistence (<600 bytes)
- 02-02: Radix UI Select for ModelPicker
- 03-01: @microsoft/fetch-event-source for SSE (custom headers support)
- 03-01: CircularBuffer for time-series data (capacity 300 = 5min)
- 03-03: Recharts isAnimationActive={false} + animationDuration={0} for real-time data
- 04-01: Named tunnels mandatory (quick tunnels don't support SSE)
- 04-01: LAN detection via AbortSignal.timeout(1500ms) health check
- 04-02: AppShell with global ConnectionProvider and ConnectionBadge
- 05-01: LMX session API reads ~/.config/opta/sessions/ JSON files
- 05-02: Fuse.js fuzzy search + @tanstack/react-virtual for session list
- 05-03: Tool calls render from assistant message side (not tool-role messages)
- 05-03: Stable deterministic IDs: {sessionId}-msg-{index}

### Deferred Issues

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-02-18 03:15
Stopped at: Completed all web phases (1-5). Ready for iOS (Phase 6).
Resume file: None
