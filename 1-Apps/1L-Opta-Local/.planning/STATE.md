# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-18)

**Core value:** Chat with your local AI from anywhere — phone, laptop, LAN, or WAN — with zero terminal commands.
**Current focus:** Web Command Center built (Phases 1-5). User verification required before iOS.

## Current Position

Phase: 5 of 8 (Web Sessions)
Plan: 3 of 3 in current phase
Status: WEB COMPLETE — awaiting user verification before iOS phases
Last activity: 2026-02-18 — Phase 6 research complete, Opus 4.6 web design research complete
Gate: USER MUST explicitly verify web works as intended → then iOS phases unlock

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

- iOS phases (6-8) BLOCKED on explicit user verification that web works as intended
- Do NOT suggest iOS as next step until user says web is verified

### Pending Work (resume next session)

1. **Replan roadmap** — incorporate Opus 4.6 web design research findings into planning approach
2. **Web verification** — user needs to test web app against LMX server and confirm it works
3. **iOS phases** — only after user explicitly approves web → then plan phase 6

### Opus 4.6 Web Design Research (completed, not yet applied)

Key findings to apply when replanning:
- Install official `/frontend-design` skill from Anthropic cookbook
- Create `opta-design-tokens` skill with CSS variables, glass system, Sora font
- Use Sonnet 4.6 for component-level work, Opus 4.6 for architecture/coordination
- Screenshot-driven verification loops for pixel-perfect UI
- Add frontend aesthetics prompt block to per-app CLAUDE.md
- Use `/clear` aggressively between design tasks

## Session Continuity

Last session: 2026-02-18 ~16:30
Stopped at: Web audit complete (7.5/10). 4 critical, 7 important, 6 minor issues found.
Resume with: Fix audit issues (start with critical C1-C4), then user tests web app
Resume file: .planning/AUDIT-WEB.md
