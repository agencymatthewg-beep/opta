# Opta Code — Production Optimization Implementation Plan

**Goal:** Elevate `1P-Opta-Code-Universal` to production grade by resolving critical UX parity gaps, rendering performance bottlenecks, and telemetry visualization.

## 1. Timeline Virtualization & Markdown Debouncing
**Problem:** The `TimelineCards.tsx` component streams markdown updates directly to the DOM. Long chat sessions with high-throughput local models cause React re-render thrashing, degrading perceived UI performance.
**Implementation Steps:**
- **Debounce Engine:** Implement a custom `useStreamingMarkdown` hook that batches rapid daemon WebSocket token bursts (e.g., buffering 50ms of tokens) before committing state to React.
- **Off-screen Virtualization:** Introduce `react-window` or `react-virtuoso` to the timeline container to unmount historical cards that are out of the scroll viewport, guaranteeing smooth scrolling regardless of session length.

## 2. Rich Runtime Telemetry Dashboard (Design: Neon Nodes)
**Problem:** The current "Terminal" view is a flattened text log, ignoring the rich JSON data (`v3` events) emitted by the daemon regarding tool execution phases, sub-agent spawns, and Atpo interventions.
**Implementation Steps:**
- **Daemon Event Ingestion:** Update the daemon client to subscribe to the granular `tool.start`, `tool.end`, and `agent.phase` WS events.
- **Insights Drawer UI:** Replace the raw text panel with a new `TelemetryPanel.tsx` component based on the Opta Local aesthetic (Neon Nodes). It should feature:
  - Live progress bars for active tool executions.
  - Sub-agent dependency graphs/trees.
  - VRAM/Token Speed meters.

## 3. Per-Turn Composer Overrides (Design: Inline Pills)
**Problem:** Users cannot override the global config for a single turn (e.g., `opta do --model sonnet --dangerous`) inside the Desktop UI.
**Implementation Steps:**
- **Composer Inline Pills:** Add a "Run Options" horizontal pill menu just above the `Composer.tsx` input bar.
- **UI Toggles:** Include quick-select drops for Model (e.g., LMX, Anthropic), Mode (Chat/Do/Plan/Research), and a toggle switch for "Dangerous Mode" (autonomy level 4).
- **Payload Mapping:** Wire these local state overrides into the `daemonClient.submitTurn()` payload payload options.

---
**Status:** Designs approved. Proceeding with implementation in order: Composer Overrides -> Telemetry Dashboard -> Timeline Virtualization.
