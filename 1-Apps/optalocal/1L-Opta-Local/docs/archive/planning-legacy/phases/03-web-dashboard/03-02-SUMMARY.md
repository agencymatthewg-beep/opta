---
phase: 03-web-dashboard
plan: 02
subsystem: dashboard-components
tags: [typescript, react, framer-motion, sse, vram-gauge, model-list, dashboard, responsive-grid]

# Dependency graph
requires:
  - 03-01
provides:
  - VRAMGauge circular SVG gauge with spring animation and color transitions
  - ConnectionIndicator SSE state badge with 4 visual states
  - ModelList with AnimatePresence transitions and unload support
  - Dashboard page with real-time SSE data and responsive CSS Grid layout
affects: [03-03]

# Tech tracking
tech-stack:
  added: []
  patterns: [SVG stroke-dashoffset gauge, Framer Motion spring on motion.circle, AnimatePresence popLayout, CSS Grid responsive 1/2/3 columns, buffered SSE status updates, async connection settings loading]

key-files:
  created:
    - 1-Apps/1L-Opta-Local/web/src/components/dashboard/VRAMGauge.tsx
    - 1-Apps/1L-Opta-Local/web/src/components/dashboard/ConnectionIndicator.tsx
    - 1-Apps/1L-Opta-Local/web/src/components/dashboard/ModelList.tsx
  modified:
    - 1-Apps/1L-Opta-Local/web/src/app/page.tsx

key-decisions:
  - "VRAMGauge uses custom SVG + motion.circle (not react-circular-progressbar) for zero-dependency gauge with Framer Motion spring physics"
  - "Color transitions at 60% (emerald->amber) and 80% (amber->red) thresholds using CSS custom properties"
  - "ConnectionIndicator uses motion.div pulse animation for connecting state (scale oscillation via repeat)"
  - "ModelList uses AnimatePresence mode='popLayout' for smooth list item removal on model unload"
  - "Dashboard loads connection settings asynchronously from encrypted localStorage (getConnectionSettings is async due to Web Crypto decryption)"
  - "SSE enabled flag gates connection — no SSE until settings are loaded"
  - "Model unload uses dynamic import of createClient to avoid circular dependency issues"
  - "Dashboard grid: grid-cols-1 md:grid-cols-2 xl:grid-cols-3 (mobile-first responsive)"
  - "Server stats panel spans full width (col-span-full) showing active requests, tokens/sec, temperature, uptime"

patterns-established:
  - "Gauge pattern: SVG -rotate-90 for 12 o'clock start, stroke-dasharray=circumference, motion.circle animates strokeDashoffset"
  - "Connection badge pattern: state config lookup function returning {label, icon, classes, pulse} for each ConnectionState"
  - "Dashboard SSE pattern: useEffect loads async settings, useMemo derives SSE URL/headers, useSSE with enabled flag"

issues-created: []

# Metrics
duration: 5min
completed: 2026-02-18
status: review
---

# Phase 3 Plan 2: Dashboard Components Summary

**VRAM gauge, loaded models list, connection indicator, and real-time dashboard page**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-18
- **Completed:** 2026-02-18
- **Tasks:** 2
- **Files created:** 3
- **Files modified:** 1

## Accomplishments

- Created `VRAMGauge` component: circular SVG gauge using stroke-dasharray/stroke-dashoffset technique with Framer Motion `motion.circle` spring animation (stiffness: 60, damping: 15). Color transitions: emerald (0-60%), amber (60-80%), red (80-100%) using CSS custom properties. Center text shows used GB / total GB with percentage. Wrapped in @opta/ui Card glass variant with Cpu icon header.

- Created `ConnectionIndicator` component: compact pill badge showing 4 SSE connection states. Connecting state uses amber color with Loader2 spin icon and scale pulse animation via Framer Motion repeat. Open state shows emerald with Wifi icon. Closed/error states use muted/red with WifiOff. Includes ARIA role="status" for accessibility.

- Created `ModelList` component: renders loaded models inside a glass Card with AnimatePresence mode="popLayout" for smooth add/remove transitions. Each model row displays a success badge, truncated model name, VRAM usage in GB, and quantization info. Unload button (ghost variant with X icon) disables during unload operation. Empty state shows centered "No models loaded" text. Model count displayed as badge in card header.

- Replaced smoke-test `page.tsx` with real dashboard page: uses `useSSE` hook to connect to LMX `/admin/events` endpoint with X-Admin-Key header. Connection settings loaded asynchronously from encrypted localStorage. `useBufferedState` caps re-renders at 2Hz (500ms flush). Responsive CSS Grid layout (1 column mobile, 2 tablet, 3 desktop). Header with title, ConnectionIndicator, reconnect button, nav to /chat and /settings. Server stats panel shows active requests, tokens/sec, temperature, and formatted uptime. Handles settings loading, settings error, and offline LMX states gracefully.

## Task Commits

Each task was committed atomically:

1. **Task 1: VRAMGauge and ConnectionIndicator** - `8fadb42` (feat)
2. **Task 2: ModelList and dashboard page** - `16d7628` (feat)

## Files Created
- `1-Apps/1L-Opta-Local/web/src/components/dashboard/VRAMGauge.tsx` - Circular SVG gauge with spring-animated fill and color transitions
- `1-Apps/1L-Opta-Local/web/src/components/dashboard/ConnectionIndicator.tsx` - SSE connection state badge with 4 visual states
- `1-Apps/1L-Opta-Local/web/src/components/dashboard/ModelList.tsx` - AnimatePresence model list with unload support

## Files Modified
- `1-Apps/1L-Opta-Local/web/src/app/page.tsx` - Replaced smoke-test with real-time SSE dashboard

## Decisions Made
- Used custom SVG + Framer Motion instead of react-circular-progressbar to avoid an extra dependency and leverage spring physics already available
- Dashboard loads connection settings asynchronously because `getConnectionSettings()` uses Web Crypto API for admin key decryption
- SSE connection is gated by an `enabled` flag that only activates after settings are loaded
- Used dynamic import for `createClient` in the unload handler to keep the page component's direct import graph clean
- Grid layout uses Tailwind responsive prefixes (md:, xl:) with mobile-first breakpoints rather than raw CSS Grid template areas
- Model unload errors are not surfaced as toasts yet (will be picked up by next SSE status push) — toast system is deferred to 03-03

## Deviations from Plan

- Added a Server Stats panel (active requests, tokens/sec, temperature, uptime) in addition to VRAM gauge and model list. This data was already in the `ServerStatus` type and provides useful at-a-glance monitoring.
- Used `md:` and `xl:` breakpoints instead of `lg:` and `sm:` for cleaner responsive behavior with the 3-panel layout.
- Model list spans 2 columns on xl (xl:col-span-2) to fill the remaining space next to the gauge.

## Issues Encountered
None

## Verification Checklist
- [x] `pnpm run build` succeeds without errors
- [x] Root page (/) shows dashboard layout, not smoke-test
- [x] VRAMGauge renders with animated circle (spring physics)
- [x] ModelList renders with AnimatePresence transitions
- [x] ConnectionIndicator shows appropriate state
- [x] Dashboard connects to SSE endpoint (shows connecting/error gracefully if LMX offline)
- [x] Responsive grid layout (1/2/3 columns across breakpoints)
- [x] No `any` types — strict TypeScript throughout
- [x] All colors use CSS custom properties (no hex/rgb literals except rgba for track stroke)

## Next Phase Readiness
- Plan 03-02 (dashboard components) complete
- Ready for Plan 03-03 (Throughput chart + model management) — dashboard page is wired for SSE, components are self-contained and composable, CircularBuffer from 03-01 is ready for throughput data

---
*Phase: 03-web-dashboard*
*Completed: 2026-02-18*
