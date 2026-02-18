---
phase: 03-web-dashboard
plan: 01
subsystem: sse-infrastructure
tags: [typescript, sse, fetch-event-source, hooks, circular-buffer, real-time, streaming]

# Dependency graph
requires:
  - 01-02
provides:
  - Generic SSE connection hook with auto-reconnect and exponential backoff
  - Buffered state hook for batched React re-renders from high-frequency data
  - Circular buffer utility for fixed-size time-series sliding window
  - ThroughputPoint type for chart data
affects: [03-02, 03-03]

# Tech tracking
tech-stack:
  added: []
  patterns: [SSE via @microsoft/fetch-event-source, exponential backoff with jitter, buffered state flush, circular buffer sliding window]

key-files:
  created:
    - 1-Apps/1L-Opta-Local/web/src/hooks/useSSE.ts
    - 1-Apps/1L-Opta-Local/web/src/hooks/useBufferedState.ts
    - 1-Apps/1L-Opta-Local/web/src/lib/circular-buffer.ts

key-decisions:
  - "useSSE wraps @microsoft/fetch-event-source (not native EventSource) to support custom X-Admin-Key header"
  - "Exponential backoff with jitter: delay * 2^retries * (1 + Math.random() * 0.5), capped at 30s"
  - "useBufferedState stores in useRef and flushes to useState on setInterval (default 500ms) to cap re-renders at 2Hz"
  - "CircularBuffer uses head/count tracking with modular arithmetic for O(1) push and O(n) toArray"

patterns-established:
  - "SSE hook pattern: AbortController in useRef, retry counter in useRef, connect/disconnect/reconnect returned"
  - "Buffered state pattern: push() updater function (prev => next) avoids stale closures"
  - "Circular buffer pattern: toArray() unwraps circular structure into chronological order for Recharts"

issues-created: []

# Metrics
duration: 3min
completed: 2026-02-18
---

# Phase 3 Plan 1: SSE Connection Infrastructure Summary

**Generic SSE connection hook with auto-reconnect, buffered state hook for batched renders, and circular buffer utility for time-series chart data**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-18
- **Completed:** 2026-02-18
- **Tasks:** 2
- **Files created:** 3

## Accomplishments
- Created `useSSE<T>` generic hook wrapping `@microsoft/fetch-event-source` with connection state tracking (`connecting | open | closed | error`), AbortController cleanup, exponential backoff with jitter (capped at 30s), and configurable max retries
- Page Visibility API handling is automatic via fetch-event-source (pauses on tab hide, reconnects on show)
- Created `useBufferedState<T>` hook that stores updates in a useRef buffer and flushes to useState on a fixed interval (default 500ms), reducing re-renders from 10-50Hz SSE events to 2Hz
- Created `CircularBuffer<T>` class with push(), toArray() (chronological), length, isFull, and clear() methods for fixed-size sliding window data
- Exported `ThroughputPoint` type (`{ timestamp: number, tokensPerSecond: number }`) for dashboard chart data

## Task Commits

Each task was committed atomically:

1. **Task 1: SSE connection hook with auto-reconnect** - `0270dd0` (feat)
2. **Task 2: Buffered state hook and circular buffer utility** - `9d8a825` (feat)

## Files Created
- `1-Apps/1L-Opta-Local/web/src/hooks/useSSE.ts` - Generic SSE hook with auto-reconnect, exponential backoff + jitter, AbortController cleanup
- `1-Apps/1L-Opta-Local/web/src/hooks/useBufferedState.ts` - Batched state updates from high-frequency SSE events (default 500ms flush)
- `1-Apps/1L-Opta-Local/web/src/lib/circular-buffer.ts` - Fixed-size sliding window with chronological toArray() + ThroughputPoint type

## Decisions Made
- Used `@microsoft/fetch-event-source` over native EventSource because EventSource cannot send custom headers (X-Admin-Key would leak in query params)
- Exponential backoff formula: `retryInterval * 2^retries * (1 + Math.random() * 0.5)` with 30s cap prevents thundering herd on server restart
- useBufferedState uses updater function pattern `(prev: T) => T` to avoid stale closures in SSE callbacks
- CircularBuffer stores `(T | undefined)[]` internally with head/count modular arithmetic for O(1) push
- Separated `reconnect()` from initial connect — reconnect resets the retry counter for manual reconnection

## Deviations from Plan

None - plan executed exactly as written. Dependencies were already installed per instructions.

## Issues Encountered
None

## Verification Checklist
- [x] `pnpm run build` succeeds without errors
- [x] useSSE hook compiles with generic type parameter
- [x] useBufferedState compiles with generic type parameter
- [x] CircularBuffer toArray returns chronological order
- [x] SSE hook supports custom headers for admin key authentication
- [x] Buffer and circular buffer utilities are generic and reusable

## Next Phase Readiness
- Plan 03-01 (SSE connection infrastructure) complete
- Ready for Plan 03-02 (VRAM gauge + models list) — can use `useSSE` to subscribe to `/admin/events` and `useBufferedState` for VRAM metrics
- Ready for Plan 03-03 (Throughput chart + model management) — can use `CircularBuffer<ThroughputPoint>` for time-series chart data

---
*Phase: 03-web-dashboard*
*Completed: 2026-02-18*
