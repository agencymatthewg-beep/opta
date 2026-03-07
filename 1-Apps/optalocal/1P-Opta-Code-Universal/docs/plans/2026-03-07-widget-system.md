# Widget System v2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add drag-and-drop reordering to the existing widget pane, introduce a shared `WidgetShell` aesthetic base, then implement 10 new status and utility widgets that plug into the existing slot system.

**Architecture:** The existing `useWidgetLayout` hook already has `moveWidget(from, to)` — we wire HTML5 drag events in `WidgetPane.tsx` to call it. All new widgets extend a shared `WidgetShell` wrapper component that provides the consistent header/icon/badge pattern. Each new widget calls its own data hook (e.g. `useModels`, `useConnectionHealth`) so they are self-contained and only run when actually placed in the pane.

**Tech Stack:** React 18, Framer Motion 12, Vitest 4 + @testing-library/react 16, native HTML5 Drag-and-Drop API (no new library), Lucide React icons, existing `daemonClient` + existing hooks.

---

## Codebase Context (Read Before Touching Anything)

| File | What It Does |
|------|-------------|
| `src/types.ts:124` | `WidgetId` union type — add new IDs here |
| `src/hooks/useWidgetLayout.ts` | Layout state + `moveWidget(fromIndex, toIndex)` — already written |
| `src/components/sidebars/WidgetPane.tsx` | Renders slots; `WidgetContent` switch dispatches to widget components |
| `src/components/widgets/WidgetAtpo.tsx` | Reference widget — uses `widget-bento-card` CSS base |
| `src/hooks/useConnectionHealth.ts` | Polls daemon `/v3/health` every 30 s; returns `status`, `latencyMs`, `latencyTier` |
| `src/hooks/useModels.ts` | Polls LMX every 5 s; returns `lmxStatus`, `loadedModels`, `lmxReachable`, `memory` |
| `src/App.tsx:1219` | Already calls `useConnectionHealth` — result named `useConnectionHealthResult` |
| `src/App.tsx:3014` | `<WidgetPane .../>` call — add `onMoveWidget` prop here |
| `src/opta.css:7108` | `.wp-tile` base styles |
| `src/opta.css:8393` | `.widget-bento-card` styles — the shared card base |

---

## Phase 1 — Foundation

### Task 1: Wire Drag-and-Drop

**Goal:** Tiles in edit mode become draggable and call the existing `moveWidget` when dropped.

**Files:**
- Modify: `src/components/sidebars/WidgetPane.tsx`
- Modify: `src/App.tsx` (add `onMoveWidget` prop pass-through)
- Modify: `src/opta.css` (add drag state CSS)
- Create: `src/components/sidebars/WidgetPane.test.tsx`

**Step 1: Write the failing test**

```tsx
// src/components/sidebars/WidgetPane.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { WidgetPane } from "./WidgetPane";

const slots = [
  { id: "s1", widgetId: "cli-stream" as const, size: "M" as const },
  { id: "s2", widgetId: "atpo" as const, size: "M" as const },
];

it("calls onMoveWidget when tile is dragged and dropped", () => {
  const onMove = vi.fn();
  render(
    <WidgetPane
      slots={slots}
      isEditing={true}
      onToggleEdit={vi.fn()}
      onRemoveWidget={vi.fn()}
      onAddWidget={vi.fn()}
      onMoveWidget={onMove}
      timelineItems={[]}
      rawEvents={[]}
    />
  );
  const tiles = screen.getAllByRole("listitem");
  fireEvent.dragStart(tiles[0]!);
  fireEvent.dragOver(tiles[1]!);
  fireEvent.drop(tiles[1]!);
  expect(onMove).toHaveBeenCalledWith(0, 1);
});
```

**Step 2: Run test to verify it fails**

```bash
cd 1-Apps/optalocal/1P-Opta-Code-Universal
npm test -- src/components/sidebars/WidgetPane.test.tsx
```

Expected: FAIL — `onMoveWidget` prop does not exist yet.

**Step 3: Add `onMoveWidget` to WidgetPane**

In `src/components/sidebars/WidgetPane.tsx`, update `WidgetPaneProps`:

```tsx
interface WidgetPaneProps {
  // ... existing props unchanged ...
  onMoveWidget: (fromIndex: number, toIndex: number) => void;  // ADD THIS
}
```

Add drag state tracking inside `WidgetPane`:

```tsx
export function WidgetPane({ ..., onMoveWidget, ... }: WidgetPaneProps) {
  const dragSourceRef = useRef<number | null>(null);  // ADD - needs: import { useRef } from "react"

  // ADD these event handlers:
  const handleDragStart = (index: number) => {
    dragSourceRef.current = index;
  };
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Required to allow drop
  };
  const handleDrop = (toIndex: number) => {
    if (dragSourceRef.current !== null && dragSourceRef.current !== toIndex) {
      onMoveWidget(dragSourceRef.current, toIndex);
    }
    dragSourceRef.current = null;
  };
```

Update the `.wp-tile` div to wire events (replace existing `<div key={slot.id} className="wp-tile ...">` with):

```tsx
<div
  key={slot.id}
  role="listitem"
  className={`wp-tile wp-tile-${slot.size.toLowerCase()} ${designMode === "3" ? "wp-tile-bento" : ""}`}
  draggable={isEditing}
  onDragStart={() => handleDragStart(slots.indexOf(slot))}
  onDragOver={handleDragOver}
  onDrop={() => handleDrop(slots.indexOf(slot))}
>
```

**Step 4: Add drag CSS to `src/opta.css`**

Find `.wp-tile {` block (line ~7108) and add after the closing brace:

```css
/* Drag-and-drop states */
.wp-tile[draggable="true"] {
  cursor: grab;
}
.wp-tile[draggable="true"]:active {
  cursor: grabbing;
}
.wp-tile.wp-tile-dragging {
  opacity: 0.35;
  border-style: dashed;
  border-color: rgba(139, 92, 246, 0.4);
}
.wp-tile.wp-tile-drag-over {
  border-color: var(--opta-primary);
  background: rgba(139, 92, 246, 0.08);
  transform: scale(1.01);
}
```

**Step 5: Thread `onMoveWidget` through `App.tsx`**

In `src/App.tsx` at line ~3014, add the prop:

```tsx
<WidgetPane
  slots={widgetLayout.layout.slots}
  isEditing={widgetLayout.isEditing}
  onToggleEdit={widgetLayout.toggleEditMode}
  onRemoveWidget={widgetLayout.removeWidget}
  onAddWidget={(wid) => widgetLayout.addWidget(wid, "M")}
  onMoveWidget={widgetLayout.moveWidget}   {/* ADD THIS LINE */}
  timelineItems={timelineItems}
  rawEvents={activeSessionId ? rawEventsBySession[activeSessionId] || [] : []}
  connection={connection}
  sessionId={activeSessionId}
/>
```

**Step 6: Run test to verify it passes**

```bash
npm test -- src/components/sidebars/WidgetPane.test.tsx
```

Expected: PASS

**Step 7: Run typecheck**

```bash
npm run typecheck
```

Expected: No errors.

**Step 8: Commit**

```bash
git add src/components/sidebars/WidgetPane.tsx src/components/sidebars/WidgetPane.test.tsx src/App.tsx src/opta.css
git commit -m "feat(code): wire HTML5 drag-and-drop to widget pane tile reordering"
```

---

### Task 2: WidgetShell — Shared Aesthetic Base

**Goal:** Create a single wrapper component all new widgets use so their headers, icons, accents, and badges are visually identical without copy-pasting.

**Files:**
- Create: `src/components/widgets/WidgetShell.tsx`
- Create: `src/components/widgets/WidgetShell.test.tsx`
- Modify: `src/opta.css` (add `.widget-shell-*` CSS classes)

**Step 1: Write the failing test**

```tsx
// src/components/widgets/WidgetShell.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Activity } from "lucide-react";
import { WidgetShell } from "./WidgetShell";

it("renders title and badge", () => {
  render(
    <WidgetShell icon={<Activity size={14} />} title="Active Tool" badge="RUNNING" accentVar="--opta-neon-cyan">
      <span>content</span>
    </WidgetShell>
  );
  expect(screen.getByText("Active Tool")).toBeInTheDocument();
  expect(screen.getByText("RUNNING")).toBeInTheDocument();
  expect(screen.getByText("content")).toBeInTheDocument();
});

it("renders without badge", () => {
  render(
    <WidgetShell icon={<Activity size={14} />} title="Active Tool">
      <span>content</span>
    </WidgetShell>
  );
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- src/components/widgets/WidgetShell.test.tsx
```

Expected: FAIL — module not found.

**Step 3: Create `WidgetShell.tsx`**

```tsx
// src/components/widgets/WidgetShell.tsx
import type { ReactNode, CSSProperties } from "react";

interface WidgetShellProps {
  /** A Lucide icon element, e.g. <Activity size={14} /> */
  icon: ReactNode;
  title: string;
  /** Optional uppercase badge text, e.g. "RUNNING" */
  badge?: string;
  /**
   * CSS variable name for the widget's accent color.
   * e.g. "--opta-neon-cyan" for LMX, "--opta-primary" for daemon.
   * Defaults to --opta-primary.
   */
  accentVar?: string;
  children: ReactNode;
}

export function WidgetShell({ icon, title, badge, accentVar = "--opta-primary", children }: WidgetShellProps) {
  return (
    <div
      className="widget-bento-card widget-shell"
      style={{ "--widget-accent": `var(${accentVar})` } as CSSProperties}
    >
      <div className="bento-card-header">
        <div className="bento-card-title">
          <span className="bento-card-icon widget-shell-icon">{icon}</span>
          {title}
        </div>
        {badge && <span className="bento-badge" role="status">{badge}</span>}
      </div>
      <div className="widget-shell-body">{children}</div>
    </div>
  );
}
```

**Step 4: Add CSS to `src/opta.css`** — append after `.widget-bento-card` block (line ~8404):

```css
/* ── WidgetShell v2 base ────────────────────────────────────────────────── */
.widget-shell {
  --widget-accent: var(--opta-primary);
}
.widget-shell .bento-card-icon {
  color: var(--widget-accent);
}
.widget-shell .bento-badge {
  background: color-mix(in srgb, var(--widget-accent) 15%, transparent);
  color: var(--widget-accent);
  border-color: color-mix(in srgb, var(--widget-accent) 35%, transparent);
}
.widget-shell-body {
  padding-top: 10px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
/* Stat row: label + value pair */
.widget-stat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
}
.widget-stat-label {
  color: var(--opta-text-secondary, rgba(255,255,255,0.45));
  font-family: "Sora", sans-serif;
}
.widget-stat-value {
  font-family: "JetBrains Mono", monospace;
  font-size: 11px;
  color: var(--opta-text-primary, #fafafa);
}
.widget-stat-value.accent { color: var(--widget-accent); }
/* Thin progress bar used by multiple widgets */
.widget-progress-bar {
  height: 3px;
  border-radius: 99px;
  background: rgba(255,255,255,0.06);
  overflow: hidden;
}
.widget-progress-fill {
  height: 100%;
  border-radius: 99px;
  background: var(--widget-accent);
  transition: width 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
```

**Step 5: Run test to verify it passes**

```bash
npm test -- src/components/widgets/WidgetShell.test.tsx
```

Expected: PASS

**Step 6: Commit**

```bash
git add src/components/widgets/WidgetShell.tsx src/components/widgets/WidgetShell.test.tsx src/opta.css
git commit -m "feat(code): add WidgetShell shared aesthetic base for widget v2 system"
```

---

### Task 3: Extend WidgetId + Widget Catalog UI

**Goal:** Add the 10 new widget IDs to the type system and replace the 3 hardcoded add-buttons in `WidgetPane.tsx` with a proper catalog picker.

**Files:**
- Modify: `src/types.ts` (extend `WidgetId`)
- Create: `src/components/widgets/WIDGET_REGISTRY.ts`
- Modify: `src/components/sidebars/WidgetPane.tsx` (replace hardcoded buttons)

**Step 1: Extend `WidgetId` in `src/types.ts`**

Find `export type WidgetId =` (line ~124) and replace with:

```typescript
export type WidgetId =
  | "atpo"
  | "benchmark"
  | "runtime"
  | "next-steps"
  | "tool-log"
  | "plan-completion"
  | "cli-stream"
  | "git-diff"
  // Widget System v2 — status & utility tiles
  | "lmx-status"
  | "context-bar"
  | "active-tool"
  | "session-memory"
  | "model-switcher"
  | "latency-sparkline"
  | "daemon-ring"
  | "command-bar"
  | "working-dir"
  | "browser-session";
```

**Step 2: Create `WIDGET_REGISTRY.ts`**

```typescript
// src/components/widgets/WIDGET_REGISTRY.ts
import type { WidgetId } from "../../types";

export interface WidgetMeta {
  id: WidgetId;
  label: string;
  description: string;
  accentVar: string;
  group: "ai" | "system" | "project";
}

export const WIDGET_REGISTRY: WidgetMeta[] = [
  // Existing
  { id: "atpo", label: "Plan Progress", description: "Active plan phases and steps", accentVar: "--opta-neon-pink", group: "ai" },
  { id: "cli-stream", label: "CLI Logs", description: "Live daemon event stream", accentVar: "--opta-neon-cyan", group: "system" },
  { id: "git-diff", label: "Git Diff", description: "Uncommitted file changes", accentVar: "--opta-neon-amber", group: "project" },
  // v2 — Quick Wins
  { id: "lmx-status", label: "AI Server", description: "Connection status and loaded model", accentVar: "--opta-neon-cyan", group: "system" },
  { id: "context-bar", label: "Context", description: "Token usage vs context limit", accentVar: "--opta-primary", group: "ai" },
  { id: "active-tool", label: "Active Tool", description: "Current tool being executed", accentVar: "--opta-neon-green", group: "ai" },
  // v2 — Worth Exploring
  { id: "session-memory", label: "Session Stats", description: "Turn count, tokens, compaction history", accentVar: "--opta-primary", group: "ai" },
  { id: "model-switcher", label: "Switch Model", description: "Quick-select from loaded LMX models", accentVar: "--opta-neon-cyan", group: "ai" },
  { id: "latency-sparkline", label: "Speed", description: "Token generation speed over recent turns", accentVar: "--opta-neon-cyan", group: "system" },
  { id: "daemon-ring", label: "Connection", description: "Daemon health and latency", accentVar: "--opta-primary", group: "system" },
  { id: "command-bar", label: "Quick Commands", description: "Your most-used slash commands", accentVar: "--opta-primary", group: "project" },
  { id: "working-dir", label: "Working Directory", description: "Current project path", accentVar: "--opta-neon-amber", group: "project" },
  { id: "browser-session", label: "Browser", description: "Active browser automation sessions", accentVar: "--opta-neon-cyan", group: "ai" },
];
```

**Step 3: Replace hardcoded add buttons in `WidgetPane.tsx`**

Replace the `{isEditing && (<>...3 buttons...</>)}` block with:

```tsx
{isEditing && (
  <div className="wp-catalog">
    <div className="wp-catalog-label">ADD WIDGET</div>
    {WIDGET_REGISTRY.map((meta) => {
      const alreadyAdded = slots.some((s) => s.widgetId === meta.id);
      return (
        <button
          key={meta.id}
          className={`wp-catalog-btn ${alreadyAdded ? "wp-catalog-btn--added" : ""}`}
          onClick={() => !alreadyAdded && onAddWidget(meta.id)}
          type="button"
          title={meta.description}
          disabled={alreadyAdded}
        >
          <span className="wp-catalog-btn-name">{meta.label}</span>
          {alreadyAdded && <span className="wp-catalog-btn-check">✓</span>}
        </button>
      );
    })}
  </div>
)}
```

Add the import at the top:
```tsx
import { WIDGET_REGISTRY } from "../widgets/WIDGET_REGISTRY";
```

**Step 4: Add CSS to `src/opta.css`** (append to widget section):

```css
/* ── Widget Catalog ─────────────────────────────────────────────────────── */
.wp-catalog {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  background: rgba(255,255,255,0.02);
  border: 1px dashed rgba(255,255,255,0.1);
  border-radius: 10px;
}
.wp-catalog-label {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 1.5px;
  color: var(--opta-text-secondary, rgba(255,255,255,0.4));
  padding: 0 4px 4px;
}
.wp-catalog-btn {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  border-radius: 7px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--opta-text-primary, #fafafa);
  font-size: 11px;
  font-family: "Sora", sans-serif;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s, border-color 0.15s;
}
.wp-catalog-btn:hover:not(:disabled) {
  background: rgba(139, 92, 246, 0.1);
  border-color: rgba(139, 92, 246, 0.3);
}
.wp-catalog-btn--added {
  opacity: 0.4;
  cursor: default;
}
.wp-catalog-btn-check {
  color: var(--opta-neon-green, #4ade80);
  font-size: 10px;
}
```

**Step 5: Run typecheck**

```bash
npm run typecheck
```

Expected: No errors. The new `WidgetId` values need to be handled in `WidgetContent` — TypeScript will NOT error because the switch has a `default` fallback ("Coming soon"). That's correct for now; we fill them in subsequent tasks.

**Step 6: Commit**

```bash
git add src/types.ts src/components/widgets/WIDGET_REGISTRY.ts src/components/sidebars/WidgetPane.tsx src/opta.css
git commit -m "feat(code): extend WidgetId with 10 new IDs and replace hardcoded add-buttons with widget catalog"
```

---

## Phase 2 — Quick Win Widgets

### Task 4: WidgetLmxStatus — AI Server Connection

**Goal:** Show LMX `connected`/`degraded`/`disconnected` state, discovery source, latency, and loaded model name.

**Data source:** `useModels(connection)` — already polls every 5 s; returns `lmxStatus`, `loadedModels`, `lmxReachable`.

**Files:**
- Create: `src/components/widgets/WidgetLmxStatus.tsx`
- Create: `src/components/widgets/WidgetLmxStatus.test.tsx`
- Modify: `src/components/sidebars/WidgetPane.tsx` (add case to `WidgetContent` switch + pass `connection`)

**Step 1: Write the failing test**

```tsx
// src/components/widgets/WidgetLmxStatus.test.tsx
import { render, screen } from "@testing-library/react";
import { vi, it, expect, beforeEach } from "vitest";
import { WidgetLmxStatus } from "./WidgetLmxStatus";
import * as useModelsModule from "../../hooks/useModels";

beforeEach(() => {
  vi.spyOn(useModelsModule, "useModels").mockReturnValue({
    lmxReachable: true,
    loadedModels: [{ id: "kimi-k2-3bit", name: "Kimi K2.5", loaded: true } as any],
    lmxStatus: { state: "connected", latencyMs: 22 } as any,
    lmxDiscovery: null,
    lmxEndpointCandidates: [],
    lmxTarget: null,
    availableModels: [],
    memory: null,
    loading: false,
    error: null,
  } as any);
});

it("shows connected state", () => {
  render(<WidgetLmxStatus connection={{ host: "192.168.188.11", port: 1234 } as any} />);
  expect(screen.getByText("CONNECTED")).toBeInTheDocument();
  expect(screen.getByText("Kimi K2.5")).toBeInTheDocument();
  expect(screen.getByText(/22.*ms/)).toBeInTheDocument();
});

it("shows disconnected state", () => {
  vi.spyOn(useModelsModule, "useModels").mockReturnValue({
    lmxReachable: false, loadedModels: [], lmxStatus: null, lmxDiscovery: null,
    lmxEndpointCandidates: [], lmxTarget: null, availableModels: [], memory: null,
    loading: false, error: "unreachable",
  } as any);
  render(<WidgetLmxStatus connection={{ host: "192.168.188.11", port: 1234 } as any} />);
  expect(screen.getByText("OFFLINE")).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- src/components/widgets/WidgetLmxStatus.test.tsx
```

Expected: FAIL — module not found.

**Step 3: Create `WidgetLmxStatus.tsx`**

```tsx
// src/components/widgets/WidgetLmxStatus.tsx
import { Wifi } from "lucide-react";
import { WidgetShell } from "./WidgetShell";
import { useModels } from "../../hooks/useModels";
import type { DaemonConnectionOptions } from "../../types";

interface Props {
  connection: DaemonConnectionOptions | null;
}

export function WidgetLmxStatus({ connection }: Props) {
  const { lmxReachable, loadedModels, lmxStatus, lmxDiscovery } = useModels(connection);

  const state = !connection
    ? "no-config"
    : lmxReachable
      ? (loadedModels.length > 0 ? "connected" : "degraded")
      : "disconnected";

  const badge = state === "connected" ? "CONNECTED" : state === "degraded" ? "NO MODEL" : "OFFLINE";
  const accentVar = state === "connected" ? "--opta-neon-cyan" : state === "degraded" ? "--opta-neon-amber" : "--opta-error";
  const latency = (lmxStatus as any)?.latencyMs ?? null;
  const activeModel = loadedModels[0]?.name ?? loadedModels[0]?.id ?? "—";
  const source = (lmxDiscovery as any)?.source ?? "config";

  return (
    <WidgetShell icon={<Wifi size={14} />} title="AI Server" badge={badge} accentVar={accentVar}>
      <div className="widget-stat-row">
        <span className="widget-stat-label">Model</span>
        <span className="widget-stat-value accent">{activeModel}</span>
      </div>
      {latency !== null && (
        <div className="widget-stat-row">
          <span className="widget-stat-label">Latency</span>
          <span className="widget-stat-value">{latency} ms</span>
        </div>
      )}
      <div className="widget-stat-row">
        <span className="widget-stat-label">Found via</span>
        <span className="widget-stat-value">{source}</span>
      </div>
    </WidgetShell>
  );
}
```

**Step 4: Wire into `WidgetContent` switch in `WidgetPane.tsx`**

Add import at top:
```tsx
import { WidgetLmxStatus } from "../widgets/WidgetLmxStatus";
```

Add case to the switch (before `default:`):
```tsx
case "lmx-status":
  return <WidgetLmxStatus connection={connection ?? null} />;
```

**Step 5: Run test + typecheck**

```bash
npm test -- src/components/widgets/WidgetLmxStatus.test.tsx
npm run typecheck
```

Expected: Both pass.

**Step 6: Commit**

```bash
git add src/components/widgets/WidgetLmxStatus.tsx src/components/widgets/WidgetLmxStatus.test.tsx src/components/sidebars/WidgetPane.tsx
git commit -m "feat(code): add WidgetLmxStatus tile showing AI server connection and loaded model"
```

---

### Task 5: WidgetContextBar — Token Context Usage

**Goal:** Show current session token count vs context limit with a progress bar. Turn amber at 70% (compaction trigger).

**Data source:** `timelineItems` — items with `kind === "system"` and `stats.tokens` are `turn.done` events.

**Files:**
- Create: `src/components/widgets/WidgetContextBar.tsx`
- Create: `src/components/widgets/WidgetContextBar.test.tsx`
- Modify: `src/components/sidebars/WidgetPane.tsx`

**Step 1: Write the failing test**

```tsx
// src/components/widgets/WidgetContextBar.test.tsx
import { render, screen } from "@testing-library/react";
import { it, expect } from "vitest";
import { WidgetContextBar } from "./WidgetContextBar";
import type { TimelineItem } from "../../types";

const makeItem = (tokens: number): TimelineItem => ({
  id: "1", kind: "system", title: "turn.done", stats: { tokens, speed: 20, elapsed: 1000, toolCalls: 0 },
});

it("shows token count and progress bar", () => {
  render(<WidgetContextBar timelineItems={[makeItem(8000), makeItem(6000)]} contextLimit={32000} />);
  expect(screen.getByText(/14,000/)).toBeInTheDocument();
  expect(screen.getByText(/32,000/)).toBeInTheDocument();
});

it("shows amber warning at 70% capacity", () => {
  render(<WidgetContextBar timelineItems={[makeItem(23000)]} contextLimit={32000} />);
  expect(screen.getByText("NEAR LIMIT")).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- src/components/widgets/WidgetContextBar.test.tsx
```

**Step 3: Create `WidgetContextBar.tsx`**

```tsx
// src/components/widgets/WidgetContextBar.tsx
import { AlignLeft } from "lucide-react";
import { useMemo } from "react";
import { WidgetShell } from "./WidgetShell";
import type { TimelineItem } from "../../types";

interface Props {
  timelineItems: TimelineItem[];
  /** Default 32k for most LMX models */
  contextLimit?: number;
}

export function WidgetContextBar({ timelineItems, contextLimit = 32_000 }: Props) {
  const totalTokens = useMemo(() =>
    timelineItems
      .filter((item) => item.kind === "system" && item.stats)
      .reduce((sum, item) => sum + (item.stats?.tokens ?? 0), 0),
    [timelineItems]
  );

  const pct = Math.min(100, (totalTokens / contextLimit) * 100);
  const isWarning = pct >= 70;
  const accentVar = isWarning ? "--opta-neon-amber" : "--opta-primary";
  const badge = pct >= 90 ? "NEAR LIMIT" : pct >= 70 ? "NEAR LIMIT" : undefined;

  return (
    <WidgetShell icon={<AlignLeft size={14} />} title="Context" badge={badge} accentVar={accentVar}>
      <div className="widget-stat-row">
        <span className="widget-stat-label">Used</span>
        <span className="widget-stat-value accent">{totalTokens.toLocaleString()}</span>
      </div>
      <div className="widget-stat-row">
        <span className="widget-stat-label">Limit</span>
        <span className="widget-stat-value">{contextLimit.toLocaleString()}</span>
      </div>
      <div className="widget-progress-bar" style={{ marginTop: 6 }}>
        <div className="widget-progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </WidgetShell>
  );
}
```

**Step 4: Wire into `WidgetContent` switch + import**

```tsx
import { WidgetContextBar } from "../widgets/WidgetContextBar";
// ...
case "context-bar":
  return <WidgetContextBar timelineItems={timelineItems} />;
```

**Step 5: Run test + typecheck, then commit**

```bash
npm test -- src/components/widgets/WidgetContextBar.test.tsx
npm run typecheck
git add src/components/widgets/WidgetContextBar.tsx src/components/widgets/WidgetContextBar.test.tsx src/components/sidebars/WidgetPane.tsx
git commit -m "feat(code): add WidgetContextBar showing token usage vs context window limit"
```

---

### Task 6: WidgetActiveTool — Live Tool Execution

**Goal:** Show which tool is currently executing, using raw WS events. Shows idle state when no tool is active.

**Data source:** `rawEvents` — look for objects with `event === "tool.start"` after the last `event === "tool.end"`.

**Files:**
- Create: `src/components/widgets/WidgetActiveTool.tsx`
- Create: `src/components/widgets/WidgetActiveTool.test.tsx`
- Modify: `src/components/sidebars/WidgetPane.tsx`

**Step 1: Write the failing test**

```tsx
// src/components/widgets/WidgetActiveTool.test.tsx
import { render, screen } from "@testing-library/react";
import { it, expect } from "vitest";
import { WidgetActiveTool } from "./WidgetActiveTool";

it("shows tool name when tool is running", () => {
  const rawEvents = [
    { event: "tool.start", data: "read_file", ts: "2026-03-07T00:00:01Z" },
  ];
  render(<WidgetActiveTool rawEvents={rawEvents} />);
  expect(screen.getByText("read_file")).toBeInTheDocument();
  expect(screen.getByText("RUNNING")).toBeInTheDocument();
});

it("shows idle when no active tool", () => {
  const rawEvents = [
    { event: "tool.start", data: "run_command", ts: "2026-03-07T00:00:01Z" },
    { event: "tool.end", data: "run_command", ts: "2026-03-07T00:00:02Z" },
  ];
  render(<WidgetActiveTool rawEvents={rawEvents} />);
  expect(screen.getByText("Idle")).toBeInTheDocument();
  expect(screen.queryByText("RUNNING")).not.toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- src/components/widgets/WidgetActiveTool.test.tsx
```

**Step 3: Create `WidgetActiveTool.tsx`**

```tsx
// src/components/widgets/WidgetActiveTool.tsx
import { Zap } from "lucide-react";
import { useMemo } from "react";
import { WidgetShell } from "./WidgetShell";

interface RawEvent { event?: string; data?: unknown; ts?: string; }

interface Props {
  rawEvents: unknown[];
}

function getActiveTool(rawEvents: unknown[]): string | null {
  // Walk backwards — find last tool.start that doesn't have a matching tool.end after it
  let lastStart: string | null = null;
  let lastStartIndex = -1;
  for (let i = rawEvents.length - 1; i >= 0; i--) {
    const e = rawEvents[i] as RawEvent;
    if (e?.event === "tool.start" && typeof e.data === "string") {
      lastStart = e.data;
      lastStartIndex = i;
      break;
    }
  }
  if (!lastStart || lastStartIndex < 0) return null;
  // Check if a matching tool.end follows it
  for (let i = lastStartIndex + 1; i < rawEvents.length; i++) {
    const e = rawEvents[i] as RawEvent;
    if (e?.event === "tool.end") return null;
  }
  return lastStart;
}

export function WidgetActiveTool({ rawEvents }: Props) {
  const activeTool = useMemo(() => getActiveTool(rawEvents), [rawEvents]);
  const badge = activeTool ? "RUNNING" : undefined;

  return (
    <WidgetShell icon={<Zap size={14} />} title="Active Tool" badge={badge} accentVar="--opta-neon-green">
      <div className="widget-stat-row">
        <span className="widget-stat-label">Tool</span>
        <span className="widget-stat-value accent">{activeTool ?? "Idle"}</span>
      </div>
    </WidgetShell>
  );
}
```

**Step 4: Wire into `WidgetContent` switch**

```tsx
import { WidgetActiveTool } from "../widgets/WidgetActiveTool";
// ...
case "active-tool":
  return <WidgetActiveTool rawEvents={rawEvents} />;
```

**Step 5: Run test + typecheck, then commit**

```bash
npm test -- src/components/widgets/WidgetActiveTool.test.tsx
npm run typecheck
git add src/components/widgets/WidgetActiveTool.tsx src/components/widgets/WidgetActiveTool.test.tsx src/components/sidebars/WidgetPane.tsx
git commit -m "feat(code): add WidgetActiveTool showing live tool execution from WS events"
```

---

## Phase 3 — Worth Exploring Widgets

### Task 7: WidgetSessionMemory — Session Stats

**Goal:** Show cumulative turn count, total tokens in/out, and whether compaction has fired.

**Data source:** `timelineItems` — count by kind, accumulate `stats.tokens`.

**Files:**
- Create: `src/components/widgets/WidgetSessionMemory.tsx`
- Modify: `src/components/sidebars/WidgetPane.tsx`

**No test for this one** — pure derived math from existing timelineItems, covered by the existing TimelineCards tests.

**Step 1: Create `WidgetSessionMemory.tsx`**

```tsx
// src/components/widgets/WidgetSessionMemory.tsx
import { Brain } from "lucide-react";
import { useMemo } from "react";
import { WidgetShell } from "./WidgetShell";
import type { TimelineItem } from "../../types";

interface Props { timelineItems: TimelineItem[]; }

export function WidgetSessionMemory({ timelineItems }: Props) {
  const stats = useMemo(() => {
    const turns = timelineItems.filter((i) => i.kind === "system" && i.stats).length;
    const tokens = timelineItems
      .filter((i) => i.kind === "system" && i.stats)
      .reduce((s, i) => s + (i.stats?.tokens ?? 0), 0);
    const compactions = timelineItems.filter((i) =>
      i.kind === "system" && i.title.toLowerCase().includes("compact")
    ).length;
    return { turns, tokens, compactions };
  }, [timelineItems]);

  return (
    <WidgetShell icon={<Brain size={14} />} title="Session Stats" accentVar="--opta-primary">
      <div className="widget-stat-row">
        <span className="widget-stat-label">Turns</span>
        <span className="widget-stat-value">{stats.turns}</span>
      </div>
      <div className="widget-stat-row">
        <span className="widget-stat-label">Total Tokens</span>
        <span className="widget-stat-value accent">{stats.tokens.toLocaleString()}</span>
      </div>
      {stats.compactions > 0 && (
        <div className="widget-stat-row">
          <span className="widget-stat-label">Compactions</span>
          <span className="widget-stat-value">{stats.compactions}</span>
        </div>
      )}
    </WidgetShell>
  );
}
```

**Step 2: Wire into switch, typecheck, commit**

```tsx
import { WidgetSessionMemory } from "../widgets/WidgetSessionMemory";
// ...
case "session-memory":
  return <WidgetSessionMemory timelineItems={timelineItems} />;
```

```bash
npm run typecheck
git add src/components/widgets/WidgetSessionMemory.tsx src/components/sidebars/WidgetPane.tsx
git commit -m "feat(code): add WidgetSessionMemory showing turn count and cumulative token usage"
```

---

### Task 8: WidgetModelSwitcher — Quick Model Select

**Goal:** List loaded LMX models as clickable pills. Clicking one writes `model` to daemon config for the next turn.

**Data source:** `useModels(connection).loadedModels`. Write via `daemonClient.configSet(connection, "model", modelId)`.

**Files:**
- Create: `src/components/widgets/WidgetModelSwitcher.tsx`
- Modify: `src/components/sidebars/WidgetPane.tsx`

**Step 1: Create `WidgetModelSwitcher.tsx`**

```tsx
// src/components/widgets/WidgetModelSwitcher.tsx
import { Cpu } from "lucide-react";
import { useState } from "react";
import { WidgetShell } from "./WidgetShell";
import { useModels } from "../../hooks/useModels";
import { daemonClient } from "../../lib/daemonClient";
import type { DaemonConnectionOptions } from "../../types";

interface Props { connection: DaemonConnectionOptions | null; }

export function WidgetModelSwitcher({ connection }: Props) {
  const { loadedModels, loading } = useModels(connection);
  const [activeModel, setActiveModel] = useState<string | null>(null);

  const switchModel = async (modelId: string) => {
    if (!connection) return;
    setActiveModel(modelId);
    await daemonClient.configSet(connection, "model", modelId);
  };

  return (
    <WidgetShell icon={<Cpu size={14} />} title="Switch Model" accentVar="--opta-neon-cyan">
      {loading && <span className="widget-stat-label">Loading…</span>}
      {!loading && loadedModels.length === 0 && (
        <span className="widget-stat-label">No models loaded</span>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {loadedModels.map((m) => (
          <button
            key={m.id}
            className={`wp-catalog-btn ${activeModel === m.id ? "wp-catalog-btn--active" : ""}`}
            onClick={() => switchModel(m.id)}
            type="button"
            style={{ fontSize: 11 }}
          >
            {m.name ?? m.id}
            {activeModel === m.id && <span className="wp-catalog-btn-check">✓</span>}
          </button>
        ))}
      </div>
    </WidgetShell>
  );
}
```

Add `.wp-catalog-btn--active` CSS to `opta.css`:
```css
.wp-catalog-btn--active {
  border-color: var(--opta-neon-cyan, #22d3ee);
  background: rgba(34, 211, 238, 0.08);
}
```

**Step 2: Wire into switch, typecheck, commit**

```tsx
import { WidgetModelSwitcher } from "../widgets/WidgetModelSwitcher";
// ...
case "model-switcher":
  return <WidgetModelSwitcher connection={connection ?? null} />;
```

```bash
npm run typecheck
git add src/components/widgets/WidgetModelSwitcher.tsx src/components/sidebars/WidgetPane.tsx src/opta.css
git commit -m "feat(code): add WidgetModelSwitcher for quick LMX model selection"
```

---

### Task 9: WidgetLatencySparkline — Speed Chart

**Goal:** Render a tiny SVG sparkline of tokens-per-second for the last 8 turns.

**Data source:** `timelineItems` — `stats.speed` (already populated as `tok/s`) on `kind === "system"` items.

**Files:**
- Create: `src/components/widgets/WidgetLatencySparkline.tsx`
- Modify: `src/components/sidebars/WidgetPane.tsx`

**Step 1: Create `WidgetLatencySparkline.tsx`**

```tsx
// src/components/widgets/WidgetLatencySparkline.tsx
import { TrendingUp } from "lucide-react";
import { useMemo } from "react";
import { WidgetShell } from "./WidgetShell";
import type { TimelineItem } from "../../types";

interface Props { timelineItems: TimelineItem[]; }

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return <div style={{ height: 28 }} />;
  const max = Math.max(...values, 1);
  const w = 200;
  const h = 28;
  const step = w / (values.length - 1);
  const pts = values
    .map((v, i) => `${i * step},${h - (v / max) * h}`)
    .join(" ");
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ height: h }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function WidgetLatencySparkline({ timelineItems }: Props) {
  const speeds = useMemo(() =>
    timelineItems
      .filter((i) => i.kind === "system" && i.stats?.speed != null)
      .slice(-8)
      .map((i) => i.stats!.speed),
    [timelineItems]
  );
  const latest = speeds.at(-1) ?? 0;
  const avg = speeds.length > 0 ? speeds.reduce((s, v) => s + v, 0) / speeds.length : 0;

  return (
    <WidgetShell icon={<TrendingUp size={14} />} title="Speed" accentVar="--opta-neon-cyan">
      <div className="widget-stat-row">
        <span className="widget-stat-label">Now</span>
        <span className="widget-stat-value accent">{latest.toFixed(1)} tok/s</span>
      </div>
      <div className="widget-stat-row">
        <span className="widget-stat-label">Avg (8 turns)</span>
        <span className="widget-stat-value">{avg.toFixed(1)} tok/s</span>
      </div>
      <Sparkline values={speeds} color="var(--opta-neon-cyan, #22d3ee)" />
    </WidgetShell>
  );
}
```

**Step 2: Wire into switch, typecheck, commit**

```tsx
import { WidgetLatencySparkline } from "../widgets/WidgetLatencySparkline";
// ...
case "latency-sparkline":
  return <WidgetLatencySparkline timelineItems={timelineItems} />;
```

```bash
npm run typecheck
git add src/components/widgets/WidgetLatencySparkline.tsx src/components/sidebars/WidgetPane.tsx
git commit -m "feat(code): add WidgetLatencySparkline showing token speed sparkline over last 8 turns"
```

---

### Task 10: WidgetDaemonRing — Connection Health

**Goal:** Show daemon connection state with Framer Motion animated status ring, latency tier, and ms.

**Data source:** `useConnectionHealth(connection, knownState)` — already available in App.tsx as `useConnectionHealthResult`.

**Note:** Rather than calling `useConnectionHealth` again (double-probing), pass a lightweight prop. Extend `WidgetPane` props to accept `connectionHealth?: ConnectionHealthState`.

**Files:**
- Create: `src/components/widgets/WidgetDaemonRing.tsx`
- Modify: `src/components/sidebars/WidgetPane.tsx` (add `connectionHealth` prop)
- Modify: `src/App.tsx` (pass `useConnectionHealthResult`)

**Step 1: Create `WidgetDaemonRing.tsx`**

```tsx
// src/components/widgets/WidgetDaemonRing.tsx
import { Radio } from "lucide-react";
import { motion } from "framer-motion";
import { WidgetShell } from "./WidgetShell";
import type { ConnectionHealthState } from "../../hooks/useConnectionHealth";

interface Props {
  health: ConnectionHealthState | null;
}

const STATE_COLOR: Record<string, string> = {
  connected: "var(--opta-neon-green, #4ade80)",
  connecting: "var(--opta-neon-amber, #fbbf24)",
  disconnected: "var(--opta-error, #f87171)",
  offline: "var(--opta-text-secondary, rgba(255,255,255,0.3))",
};

export function WidgetDaemonRing({ health }: Props) {
  const status = health?.status ?? "connecting";
  const color = STATE_COLOR[status] ?? STATE_COLOR.connecting;
  const badge = status === "connected" ? "ONLINE" : status.toUpperCase();
  const accentVar = status === "connected" ? "--opta-neon-green" : "--opta-error";

  return (
    <WidgetShell icon={<Radio size={14} />} title="Connection" badge={badge} accentVar={accentVar}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 0" }}>
        {/* Animated pulse ring */}
        <div style={{ position: "relative", width: 20, height: 20, flexShrink: 0 }}>
          {status === "connected" && (
            <motion.div
              style={{
                position: "absolute", inset: 0, borderRadius: "50%",
                border: `1.5px solid ${color}`, opacity: 0.4,
              }}
              animate={{ scale: [1, 1.7], opacity: [0.4, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
            />
          )}
          <div style={{
            position: "absolute", inset: 4, borderRadius: "50%",
            background: color, boxShadow: `0 0 6px ${color}`,
          }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span className="widget-stat-value" style={{ fontSize: 12 }}>
            {health?.host ?? "—"}
          </span>
          {health?.latencyMs != null && (
            <span className="widget-stat-label" style={{ fontSize: 10 }}>
              {health.latencyMs} ms · {health.latencyTier}
            </span>
          )}
        </div>
      </div>
    </WidgetShell>
  );
}
```

**Step 2: Thread health into WidgetPane**

In `src/components/sidebars/WidgetPane.tsx`, add to `WidgetPaneProps`:
```tsx
connectionHealth?: import("../../hooks/useConnectionHealth").ConnectionHealthState | null;
```

In `WidgetContent` props, add `connectionHealth`. Wire the case:
```tsx
import { WidgetDaemonRing } from "../widgets/WidgetDaemonRing";
// ...
case "daemon-ring":
  return <WidgetDaemonRing health={connectionHealth ?? null} />;
```

In `src/App.tsx`:
```tsx
<WidgetPane
  // ... existing props ...
  connectionHealth={useConnectionHealthResult}  {/* ADD */}
/>
```

**Step 3: Typecheck, commit**

```bash
npm run typecheck
git add src/components/widgets/WidgetDaemonRing.tsx src/components/sidebars/WidgetPane.tsx src/App.tsx
git commit -m "feat(code): add WidgetDaemonRing with animated health pulse and latency tier"
```

---

### Task 11: WidgetCommandBar — Frequent Slash Commands

**Goal:** Show the user's 5 most-used slash commands as clickable chips that inject text into the composer.

**Data source:** localStorage key `opta:command-frequency` — a `Record<string, number>` updated when commands run.

**Files:**
- Create: `src/components/widgets/WidgetCommandBar.tsx`
- Modify: `src/components/sidebars/WidgetPane.tsx`

**Note on composer integration:** The widget emits a custom event `opta:inject-command` with the command string. App.tsx or Composer.tsx listens for it and sets the input value. This decouples the widget from the composer implementation.

**Step 1: Create `WidgetCommandBar.tsx`**

```tsx
// src/components/widgets/WidgetCommandBar.tsx
import { Hash } from "lucide-react";
import { useMemo } from "react";
import { WidgetShell } from "./WidgetShell";

const STORAGE_KEY = "opta:command-frequency";
const DEFAULT_COMMANDS = ["/commit", "/build", "/test", "/fix", "/explain"];

function loadFrequency(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function recordCommandUsage(command: string) {
  const freq = loadFrequency();
  freq[command] = (freq[command] ?? 0) + 1;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(freq));
}

export function WidgetCommandBar() {
  const commands = useMemo(() => {
    const freq = loadFrequency();
    const sorted = Object.entries(freq).sort(([, a], [, b]) => b - a).slice(0, 5).map(([cmd]) => cmd);
    return sorted.length > 0 ? sorted : DEFAULT_COMMANDS;
  }, []);

  const inject = (cmd: string) => {
    window.dispatchEvent(new CustomEvent("opta:inject-command", { detail: cmd }));
  };

  return (
    <WidgetShell icon={<Hash size={14} />} title="Quick Commands" accentVar="--opta-primary">
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {commands.map((cmd) => (
          <button
            key={cmd}
            className="wp-catalog-btn"
            onClick={() => inject(cmd)}
            type="button"
            style={{ fontSize: 11, fontFamily: "JetBrains Mono, monospace" }}
          >
            {cmd}
          </button>
        ))}
      </div>
    </WidgetShell>
  );
}
```

**Step 2: Wire into switch, typecheck, commit**

```tsx
import { WidgetCommandBar } from "../widgets/WidgetCommandBar";
// ...
case "command-bar":
  return <WidgetCommandBar />;
```

```bash
npm run typecheck
git add src/components/widgets/WidgetCommandBar.tsx src/components/sidebars/WidgetPane.tsx
git commit -m "feat(code): add WidgetCommandBar with top-5 frequently-used slash command chips"
```

---

### Task 12: WidgetWorkingDir — Project Path Breadcrumb

**Goal:** Show the current project working directory as a breadcrumb. Each segment is clickable (opens in Finder via Tauri).

**Data source:** `sessionId` → session workspace path from `useDaemonSessions`. For now use the `connection?.host` as fallback since we don't have direct cwd prop threading. **Proper fix:** extend `WidgetPane` with `projectCwd?: string` prop, populated from `activeSession?.workspace` in App.tsx.

**Files:**
- Create: `src/components/widgets/WidgetWorkingDir.tsx`
- Modify: `src/components/sidebars/WidgetPane.tsx` (add `projectCwd` prop)
- Modify: `src/App.tsx` (pass `activeSession?.workspace`)

**Step 1: Create `WidgetWorkingDir.tsx`**

```tsx
// src/components/widgets/WidgetWorkingDir.tsx
import { FolderOpen } from "lucide-react";
import { WidgetShell } from "./WidgetShell";
import { getTauriInvoke, isNativeDesktop } from "../../lib/runtime";

interface Props {
  cwd: string | null | undefined;
}

export function WidgetWorkingDir({ cwd }: Props) {
  const parts = cwd ? cwd.replace(/^\//, "").split("/") : [];
  const openSegment = async (upTo: number) => {
    if (!isNativeDesktop() || !cwd) return;
    const path = "/" + parts.slice(0, upTo + 1).join("/");
    const invoke = getTauriInvoke();
    if (invoke) {
      await invoke("plugin:opener|open_path", { path }).catch(() => {});
    }
  };

  return (
    <WidgetShell icon={<FolderOpen size={14} />} title="Working Directory" accentVar="--opta-neon-amber">
      {!cwd ? (
        <span className="widget-stat-label">No project open</span>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 0", alignItems: "center" }}>
          {parts.map((part, i) => (
            <span key={i} style={{ display: "flex", alignItems: "center" }}>
              {i > 0 && <span className="widget-stat-label" style={{ padding: "0 2px" }}>/</span>}
              <button
                className="widget-dir-segment"
                onClick={() => openSegment(i)}
                type="button"
              >
                {part}
              </button>
            </span>
          ))}
        </div>
      )}
    </WidgetShell>
  );
}
```

Add CSS to `opta.css`:
```css
.widget-dir-segment {
  background: transparent;
  border: none;
  color: var(--opta-neon-amber, #fbbf24);
  font-family: "JetBrains Mono", monospace;
  font-size: 10px;
  cursor: pointer;
  padding: 1px 3px;
  border-radius: 3px;
}
.widget-dir-segment:hover {
  background: rgba(251, 191, 36, 0.12);
}
```

**Step 2: Thread `projectCwd` into WidgetPane**

In `WidgetPaneProps`, add:
```tsx
projectCwd?: string | null;
```

In `WidgetContent`, add to the props interface and pass through. Wire case:
```tsx
import { WidgetWorkingDir } from "../widgets/WidgetWorkingDir";
// ...
case "working-dir":
  return <WidgetWorkingDir cwd={projectCwd} />;
```

In `App.tsx`, find the active session workspace and pass it:
```tsx
// Near where activeSession is resolved (look for activeSession?.title usage)
const activeSessionWorkspace = activeSession?.workspace ?? null;  // ADD

<WidgetPane
  // ... existing props ...
  projectCwd={activeSessionWorkspace}  {/* ADD */}
/>
```

**Step 3: Typecheck, commit**

```bash
npm run typecheck
git add src/components/widgets/WidgetWorkingDir.tsx src/components/sidebars/WidgetPane.tsx src/App.tsx src/opta.css
git commit -m "feat(code): add WidgetWorkingDir breadcrumb with Tauri folder opener"
```

---

### Task 13: WidgetBrowserSession — Browser Activity

**Goal:** Show active Playwright browser sessions. Lights up when a session is open, shows the current page title.

**Data source:** `rawEvents` — look for `event === "browser.session.open"` / `"browser.session.close"`.

**Files:**
- Create: `src/components/widgets/WidgetBrowserSession.tsx`
- Modify: `src/components/sidebars/WidgetPane.tsx`

**Step 1: Create `WidgetBrowserSession.tsx`**

```tsx
// src/components/widgets/WidgetBrowserSession.tsx
import { Globe } from "lucide-react";
import { useMemo } from "react";
import { WidgetShell } from "./WidgetShell";

interface RawEvent { event?: string; data?: unknown; }

interface Props { rawEvents: unknown[]; }

interface SessionInfo { slotId: string; url?: string; title?: string; }

function extractActiveSessions(rawEvents: unknown[]): SessionInfo[] {
  const sessions: Map<string, SessionInfo> = new Map();
  for (const raw of rawEvents) {
    const e = raw as RawEvent;
    if (e?.event === "browser.session.open" && e.data && typeof e.data === "object") {
      const d = e.data as SessionInfo;
      if (d.slotId) sessions.set(d.slotId, d);
    }
    if (e?.event === "browser.session.close" && e.data && typeof e.data === "object") {
      const d = e.data as { slotId?: string };
      if (d.slotId) sessions.delete(d.slotId);
    }
    // Also handle navigation events
    if (e?.event === "browser.navigate" && e.data && typeof e.data === "object") {
      const d = e.data as SessionInfo;
      if (d.slotId && sessions.has(d.slotId)) {
        sessions.set(d.slotId, { ...sessions.get(d.slotId)!, ...d });
      }
    }
  }
  return Array.from(sessions.values());
}

export function WidgetBrowserSession({ rawEvents }: Props) {
  const sessions = useMemo(() => extractActiveSessions(rawEvents), [rawEvents]);
  const badge = sessions.length > 0 ? `${sessions.length} ACTIVE` : undefined;

  return (
    <WidgetShell icon={<Globe size={14} />} title="Browser" badge={badge} accentVar="--opta-neon-cyan">
      {sessions.length === 0 ? (
        <span className="widget-stat-label">No active sessions</span>
      ) : (
        sessions.map((s) => (
          <div key={s.slotId} className="widget-stat-row">
            <span className="widget-stat-label" style={{ maxWidth: "60%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {s.title ?? s.url ?? s.slotId}
            </span>
          </div>
        ))
      )}
    </WidgetShell>
  );
}
```

**Step 2: Wire into switch, typecheck, commit**

```tsx
import { WidgetBrowserSession } from "../widgets/WidgetBrowserSession";
// ...
case "browser-session":
  return <WidgetBrowserSession rawEvents={rawEvents} />;
```

```bash
npm run typecheck
git add src/components/widgets/WidgetBrowserSession.tsx src/components/sidebars/WidgetPane.tsx
git commit -m "feat(code): add WidgetBrowserSession showing active Playwright browser sessions"
```

---

## Phase 4 — Integration Test + Full Run

### Task 14: Smoke Test All Widgets Render

**Goal:** Verify the complete `WidgetContent` switch renders all 10 new widget IDs without throwing.

**Files:**
- Create: `src/components/sidebars/WidgetPaneIntegration.test.tsx`

**Step 1: Write the integration test**

```tsx
// src/components/sidebars/WidgetPaneIntegration.test.tsx
import { render } from "@testing-library/react";
import { it, expect, vi } from "vitest";
import { WidgetContent } from "./WidgetPane";
import type { WidgetId } from "../../types";

// Mock hooks that make network calls
vi.mock("../../hooks/useModels", () => ({
  useModels: () => ({
    lmxReachable: false, loadedModels: [], lmxStatus: null,
    lmxDiscovery: null, lmxEndpointCandidates: [], lmxTarget: null,
    availableModels: [], memory: null, loading: false, error: null,
    loadModel: vi.fn(), confirmLoad: vi.fn(), downloadProgress: vi.fn(),
    listDownloads: vi.fn(), unloadModel: vi.fn(), deleteModel: vi.fn(),
    downloadModel: vi.fn(), runModelHistory: vi.fn(), runModelHealth: vi.fn(),
    runModelScan: vi.fn(), saveLmxTarget: vi.fn(), refreshLmx: vi.fn(),
  }),
}));

const V2_WIDGET_IDS: WidgetId[] = [
  "lmx-status", "context-bar", "active-tool", "session-memory",
  "model-switcher", "latency-sparkline", "daemon-ring",
  "command-bar", "working-dir", "browser-session",
];

it.each(V2_WIDGET_IDS)("widget '%s' renders without throwing", (widgetId) => {
  expect(() =>
    render(
      <WidgetContent
        widgetId={widgetId}
        timelineItems={[]}
        rawEvents={[]}
        connection={null}
        sessionId={null}
        connectionHealth={null}
        projectCwd={null}
      />
    )
  ).not.toThrow();
});
```

**Step 2: Run test**

```bash
npm test -- src/components/sidebars/WidgetPaneIntegration.test.tsx
```

Expected: 10 passing.

**Step 3: Run full test suite**

```bash
npm test
```

Expected: All existing tests still pass. New tests green.

**Step 4: Final commit**

```bash
git add src/components/sidebars/WidgetPaneIntegration.test.tsx
git commit -m "test(code): add integration smoke tests for all 10 widget v2 tiles"
```

---

## Summary of All Changes

| File | Change |
|------|--------|
| `src/types.ts` | +10 new `WidgetId` values |
| `src/hooks/useWidgetLayout.ts` | No changes — `moveWidget` already exists |
| `src/components/sidebars/WidgetPane.tsx` | +drag events, +`onMoveWidget`/`connectionHealth`/`projectCwd` props, +10 switch cases, +catalog UI |
| `src/App.tsx` | Pass `onMoveWidget`, `connectionHealth`, `projectCwd` to WidgetPane |
| `src/opta.css` | ~80 lines: drag states, WidgetShell CSS, catalog CSS, dir segment CSS |
| `src/components/widgets/WIDGET_REGISTRY.ts` | New — 13-entry catalog metadata |
| `src/components/widgets/WidgetShell.tsx` | New — shared aesthetic wrapper |
| `src/components/widgets/WidgetLmxStatus.tsx` | New |
| `src/components/widgets/WidgetContextBar.tsx` | New |
| `src/components/widgets/WidgetActiveTool.tsx` | New |
| `src/components/widgets/WidgetSessionMemory.tsx` | New |
| `src/components/widgets/WidgetModelSwitcher.tsx` | New |
| `src/components/widgets/WidgetLatencySparkline.tsx` | New |
| `src/components/widgets/WidgetDaemonRing.tsx` | New |
| `src/components/widgets/WidgetCommandBar.tsx` | New |
| `src/components/widgets/WidgetWorkingDir.tsx` | New |
| `src/components/widgets/WidgetBrowserSession.tsx` | New |

**No new npm dependencies required.**
