---
phase: 04-web-anywhere
plan: 01
subsystem: connection
tags: [typescript, lan-detection, wan-tunnel, cloudflare, state-machine, abort-signal, health-check, settings-ui]

# Dependency graph
requires:
  - 01-02
provides:
  - ConnectionType type and ConnectionProbeResult interface
  - LAN health check with AbortSignal.timeout(1500)
  - Optimal URL resolution (LAN-first, tunnel fallback)
  - useConnection hook with state machine (probing/lan/wan/offline)
  - Settings pages for LMX host/port/key and tunnel configuration
affects: [04-02, 04-03, 05-web-sessions, 02-web-foundation]

# Tech tracking
tech-stack:
  added: []
  patterns: [AbortSignal.timeout LAN health check, useReducer state machine, periodic re-probe with auto-upgrade, visibility-change network detection, mixed content guard]

key-files:
  modified:
    - 1-Apps/1L-Opta-Local/web/src/lib/connection.ts
  created:
    - 1-Apps/1L-Opta-Local/web/src/hooks/useConnection.ts
    - 1-Apps/1L-Opta-Local/web/src/app/settings/layout.tsx
    - 1-Apps/1L-Opta-Local/web/src/app/settings/page.tsx
    - 1-Apps/1L-Opta-Local/web/src/app/settings/tunnel/page.tsx

key-decisions:
  - "LAN health check uses /v1/models (lightweight, no admin key required) with 1.5s timeout"
  - "WAN probe uses 8s timeout to accommodate tunnel latency"
  - "Mixed content guard: isLanAvailable() checks window.location.protocol — HTTPS pages skip LAN probe"
  - "Periodic re-probe every 30s only when NOT on LAN (wan/offline); no polling when on LAN"
  - "useConnection returns memoized LMXClient instance that updates when URL or key changes"
  - "Settings pages use glass-subtle panels, Lucide icons, cn() for conditional classes"

patterns-established:
  - "Connection state machine: probing -> lan | wan | offline with useReducer"
  - "LAN-first probing: try LAN (1.5s), then tunnel (8s), then offline"
  - "Event-driven re-probe: visibilitychange + online events trigger immediate check"
  - "Settings layout: sidebar nav + content area, responsive (stacked on mobile)"

issues-created: []

# Metrics
duration: 5min
completed: 2026-02-18
---

# Phase 4 Plan 1: Tunnel URL Configuration and LAN/WAN Detection Summary

**Connection state machine with LAN-first health check, tunnel fallback, and settings pages for server and tunnel configuration**

## Performance

- **Duration:** 5 min
- **Completed:** 2026-02-18
- **Tasks:** 2
- **Files modified:** 5 (1 modified, 4 created)

## Accomplishments
- Enhanced connection.ts with ConnectionType, ConnectionProbeResult, checkLanHealth (1.5s timeout), getOptimalBaseUrl (LAN-first then tunnel), getActiveUrl, isLanAvailable (mixed content guard), and createClientWithUrl
- Created useConnection hook with useReducer state machine (probing/lan/wan/offline), periodic 30s re-probe when not on LAN, visibilitychange and online event listeners, navigator.onLine pre-check, and memoized LMXClient
- Built settings layout with sidebar navigation (General, Tunnel) using glass-subtle panel, responsive stacking on mobile
- Created general settings page with host/port/admin key inputs, show/hide toggle for key, save and test connection buttons with status feedback
- Created tunnel settings page with URL input, enable/disable toggle, probe-based test showing detected connection type (LAN/WAN/offline) with latency

## Task Commits

Each task was committed atomically:

1. **Task 1: Connection manager with LAN/WAN detection** - `a88aa33` (feat)
2. **Task 2: Settings and tunnel configuration pages** - `b33f0b7` (feat)

## Files Created/Modified
- `1-Apps/1L-Opta-Local/web/src/lib/connection.ts` - Added ConnectionType, health check, optimal URL resolution, getActiveUrl, createClientWithUrl
- `1-Apps/1L-Opta-Local/web/src/hooks/useConnection.ts` - Connection state machine hook with auto-failover and periodic re-probe
- `1-Apps/1L-Opta-Local/web/src/app/settings/layout.tsx` - Settings shell with sidebar nav (General, Tunnel)
- `1-Apps/1L-Opta-Local/web/src/app/settings/page.tsx` - General settings: host, port, admin key, test connection
- `1-Apps/1L-Opta-Local/web/src/app/settings/tunnel/page.tsx` - Tunnel config: URL, enable toggle, probe test

## Decisions Made
- LAN health check probes /v1/models (not /admin/health) because it is lightweight and does not require admin key authentication
- 1.5s LAN timeout chosen per research: fast enough to not annoy, long enough for slow WiFi
- 8s WAN timeout accommodates Cloudflare Tunnel latency including cold starts
- Mixed content guard prevents LAN probing from HTTPS pages (would fail anyway)
- Re-probe only when not on LAN -- once on LAN, already at optimal path
- Button size uses "md" (not "default") per @opta/ui Button component API

## Deviations from Plan

- Button `size` prop used `"md"` instead of `"default"` -- the @opta/ui Button component accepts `"sm" | "md" | "lg"`, not `"default"`. Linter caught this.
- Admin key field on general settings page stored with existing Web Crypto encryption (no changes to storage.ts needed).

## Issues Encountered
- Next.js build lock file (`/.next/lock`) occasionally persisted between builds; cleared with `rm` before retry.

## Next Phase Readiness
- useConnection hook ready for integration into dashboard and chat pages (provides connectionType, baseUrl, client, latencyMs)
- Settings pages ready for navigation from main app layout
- Tunnel URL persistence works through existing saveConnectionSettings
- Ready for Phase 4 Plan 2: connection status indicator component and integration into app header

---
*Phase: 04-web-anywhere*
*Completed: 2026-02-18*
