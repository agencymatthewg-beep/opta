---
phase: 03-web-dashboard
plan: 03
subsystem: throughput-chart-model-management
tags: [typescript, react, recharts, framer-motion, sse, throughput, circular-buffer, model-load, model-unload, dashboard]

# Dependency graph
requires:
  - 03-01
  - 03-02
provides:
  - ThroughputChart real-time line chart with Recharts (no animation stutter)
  - ModelLoadDialog collapsible glass panel for loading models via HuggingFace path
  - Dashboard integration with CircularBuffer throughput history and model management
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: [Recharts isAnimationActive={false} + animationDuration={0} for streaming data, CircularBuffer 300-point throughput window, 1-second chart flush interval separate from 500ms status flush, synthetic throughput from status TPS, collapsible panel with Framer Motion height animation]

key-files:
  created:
    - 1-Apps/1L-Opta-Local/web/src/components/dashboard/ThroughputChart.tsx
    - 1-Apps/1L-Opta-Local/web/src/components/dashboard/ModelLoadDialog.tsx
  modified:
    - 1-Apps/1L-Opta-Local/web/src/app/page.tsx

key-decisions:
  - "Recharts Line uses BOTH isAnimationActive={false} AND animationDuration={0} -- prevents full chart re-animation on each data update (Recharts bug causes dot rendering delay with only one flag)"
  - "Chart data flushed at 1-second interval (separate from 500ms status flush) to avoid coupling chart redraws to gauge updates"
  - "CircularBuffer capacity 300 = 5 minutes of throughput history at 1 data point per second"
  - "Average TPS computed from chart data and shown as dashed ReferenceLine"
  - "Synthetic throughput generation from status.tokens_per_second when no dedicated throughput SSE events arrive"
  - "ModelLoadDialog is a collapsible panel (not a modal overlay) -- toggled by header button, dismissible with X"
  - "ModelLoadDialog uses AnimatePresence + motion.div height animation for smooth expand/collapse"
  - "Load errors thrown from onLoad callback are caught and displayed inline (red error box with AlertCircle icon)"
  - "Custom Tooltip component uses glass-strong class for OLED-dark theme consistency"
  - "XAxis formats timestamps as MM:SS, YAxis shows 't/s' suffix"
  - "Dashboard page uses useConnectionContextSafe() (null-safe) for connection provider compatibility"

patterns-established:
  - "Recharts real-time pattern: isAnimationActive={false} + animationDuration={0} + CircularBuffer + setInterval flush"
  - "Collapsible panel pattern: AnimatePresence wrapping motion.div with height auto animation and overflow hidden"
  - "Throughput synthesis pattern: derive chart data from status TPS when no dedicated throughput SSE events exist"

issues-created: []

# Metrics
duration: 8min
completed: 2026-02-18
---

# Phase 3 Plan 3: Throughput Chart and Model Management Summary

**Real-time throughput chart, model load dialog, and dashboard integration**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-18
- **Completed:** 2026-02-18
- **Tasks:** 2
- **Files created:** 2
- **Files modified:** 1

## Accomplishments

- Created `ThroughputChart` component: Recharts `LineChart` wrapped in `ResponsiveContainer` (240px height) with responsive full-width sizing. Line uses `monotone` interpolation, `var(--color-neon-purple)` stroke, no dots, strokeWidth 2. Both `isAnimationActive={false}` and `animationDuration={0}` are set to prevent re-render storms on streaming data (Recharts Pitfall 3 from research). Custom tooltip component uses `.glass-strong` class for OLED-dark theme consistency. XAxis formats timestamps as MM:SS, YAxis shows `t/s` suffix. Optional `averageTps` prop renders a dashed `ReferenceLine` at the average value. Empty state shows centered "Waiting for data..." text. Wrapped in `@opta/ui` Card glass variant with Activity icon header.

- Created `ModelLoadDialog` component: collapsible glass-styled panel (not a modal) with Framer Motion height animation via AnimatePresence. Contains a text input for HuggingFace model path (placeholder: `mlx-community/Qwen2.5-Coder-32B-Instruct-4bit`), a quantization selector (Default, 4-bit, 8-bit), and a Load button with loading state (Loader2 with animate-spin). Error state displays inline with AlertCircle icon in a red-tinted box. Close button (X icon) in the card header. Form submission calls parent `onLoad` handler and clears the form on success.

- Updated dashboard page (`page.tsx`) to integrate both components: Added `CircularBuffer<ThroughputPoint>` in a `useRef` (capacity 300 = 5 minutes at 1 data point per second). SSE handler routes `throughput` events to the buffer. Chart data flushed to React state on a separate 1-second interval (independent from 500ms status flush). Average TPS computed via `useMemo` from chart data. Synthetic throughput points generated from `status.tokens_per_second` when no dedicated throughput SSE events arrive. "Load Model" button in header toggles `ModelLoadDialog` panel. Load handler calls `client.loadModel()` with model path and optional quantization. Dashboard grid layout now includes full-width throughput chart between models list and server stats panel.

## Task Commits

1. **feat(03-03): throughput chart and model load dialog** - `c998e27`

Note: Dashboard page integration was captured in the prior commit `434d7b0` (feat(04-02)) due to a concurrent session writing the page before this plan's commit step ran. The component files themselves are committed here.

## Files Created
- `1-Apps/1L-Opta-Local/web/src/components/dashboard/ThroughputChart.tsx` - Real-time Recharts line chart with no-animation pattern and glass tooltip
- `1-Apps/1L-Opta-Local/web/src/components/dashboard/ModelLoadDialog.tsx` - Collapsible model load panel with quantization selector and error handling

## Files Modified
- `1-Apps/1L-Opta-Local/web/src/app/page.tsx` - CircularBuffer integration, throughput synthesis, model load/unload, chart placement in grid

## Decisions Made
- Used `isAnimationActive={false}` AND `animationDuration={0}` on the Recharts Line component (both flags are required due to a known Recharts bug where dot rendering is delayed with only one flag)
- Chose a collapsible panel instead of a modal overlay for model loading -- avoids focus trapping complexity and feels more integrated with the dashboard layout
- Chart flush interval (1 second) is intentionally different from status flush (500ms) to decouple chart redraws from gauge updates
- Synthetic throughput points are generated from status events when no dedicated throughput SSE events exist, ensuring the chart has data even if the server only sends status updates
- Custom tooltip component uses glass-strong class rather than inline contentStyle to maintain design system consistency

## Deviations from Plan

- Plan specified violet-400 stroke color for the chart line; implementation uses `var(--color-neon-purple)` (which maps to `#a855f7`, a purple/violet) to stay consistent with the design token system rather than hardcoding Tailwind color values.
- Plan mentioned an `@opta/ui Card` wrapping -- both ThroughputChart and ModelLoadDialog use `Card variant="glass"` from `@opta/ui` as specified.
- Dashboard page was already updated by a concurrent session before this plan's commit step, so the page modification is split across two commits.

## Issues Encountered
- File race condition: `page.tsx` was auto-committed by a concurrent session (434d7b0) before this plan's commit step ran. All changes are present and correct -- just split across two commits.

## Verification Checklist
- [x] `pnpm run build` succeeds without errors
- [x] ThroughputChart renders with responsive width and 240px height
- [x] Chart uses both `isAnimationActive={false}` and `animationDuration={0}` (no animation stutter)
- [x] Empty state shows "Waiting for data..." when data array is empty
- [x] ModelLoadDialog accepts model path and quantization
- [x] Load button shows loading spinner during API call
- [x] Error state displays inline error message
- [x] Dashboard grid accommodates chart (col-span-full)
- [x] CircularBuffer capacity 300 for 5-minute history
- [x] No `any` types -- strict TypeScript throughout
- [x] All colors use CSS custom properties (no hex/rgb literals in component code)
- [x] Framer Motion used for ModelLoadDialog enter/exit animation

## Phase 03 Completion Status

All three plans in Phase 03 are now complete:
- **03-01**: SSE connection manager (useSSE, useBufferedState, CircularBuffer)
- **03-02**: Dashboard components (VRAMGauge, ConnectionIndicator, ModelList, dashboard page)
- **03-03**: Throughput chart and model management (ThroughputChart, ModelLoadDialog, full integration)

The web dashboard is feature-complete with: VRAM gauge, model list with unload, throughput chart, model load dialog, connection status, server stats, and responsive layout.

---
*Phase: 03-web-dashboard*
*Completed: 2026-02-18*
