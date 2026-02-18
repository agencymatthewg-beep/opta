# Phase 03: Web Dashboard — Research

## Metadata

| Field | Value |
|-------|-------|
| Phase | 03 — Web Dashboard |
| Goal | Real-time server monitoring: VRAM gauge, loaded models list, throughput chart, model load/unload |
| Depends On | Phase 02 (Admin endpoints) |
| Plans | 03-01 (SSE connection manager), 03-02 (VRAM gauge + models), 03-03 (Throughput chart + model management) |
| Stack | Next.js 16.1.6, React 19.2.3, Tailwind CSS 4, Framer Motion, Recharts |
| Researched | 2026-02-18 |

---

## Research Summary

Phase 03 requires four primary technical capabilities: (1) a robust SSE connection to the LMX server's `/admin/events` endpoint with custom header support, (2) real-time gauge/meter components for VRAM visualization, (3) a time-series chart for throughput (tokens/second), and (4) a model load/unload management UI. The research confirms that all four are well-supported by mature libraries in the React ecosystem, with specific patterns needed to handle the `EventSource` custom headers limitation, efficient state updates from streaming data, and performant chart rendering at high update frequencies.

---

## Standard Stack

### SSE Connection: `@microsoft/fetch-event-source`

**Selected over:** native `EventSource`, `sse.js`, `event-source-polyfill`, `sse-ts`, `react-eventsource`

**Why this library:**
- Built on the Fetch API — supports custom headers (`X-Admin-Key`), POST method, and request bodies natively
- Integrates with the browser Page Visibility API: auto-closes the connection when the tab is hidden, reconnects with `Last-Event-ID` when visible again (reduces server load)
- Provides `onopen`, `onmessage`, `onclose`, `onerror` callbacks with full control over retry logic via `FatalError` / `RetriableError` types
- Written in TypeScript with types included
- Maintained by Microsoft, widely adopted (used in Copilot, Azure OpenAI streaming)
- 1.2KB gzipped — minimal bundle impact

**Alternatives considered:**
| Library | Verdict | Reason |
|---------|---------|--------|
| Native `EventSource` | Rejected | Cannot send custom headers (X-Admin-Key). Would require query-param auth, which leaks keys in server logs and browser history |
| `sse.js` (mpetazzoni) | Viable backup | Supports custom headers via `{headers: {...}}` option, has `autoReconnect`, `reconnectDelay`, `maxRetries`. Less ergonomic than fetch-event-source but no external dependencies. Good fallback if Microsoft package has issues |
| `event-source-polyfill` | Rejected | Supports headers but less actively maintained, heavier API surface |
| `sse-ts` | Rejected | TypeScript-native but small community, fewer downloads |
| `react-eventsource` | Rejected | Built on @microsoft/fetch-event-source anyway — adds unnecessary abstraction layer when we need fine-grained control |

### Charting: Recharts 3.x

**Selected over:** visx, nivo, lightweight-charts, Chart.js, Apache ECharts

**Why Recharts:**
- Declarative React components (LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer) — fits our component-based architecture
- SVG-based rendering — integrates cleanly with Tailwind CSS theming and our OLED-dark design tokens
- Recharts 3.0 (mid-2025) brought complete state management rewrite, z-index support, improved TypeScript types, accessibility by default, better animation control
- `isAnimationActive={false}` + `animationDuration={0}` pattern for real-time streaming data — prevents full re-renders on each data update
- `ResponsiveContainer` handles resize automatically
- `ReferenceLine` and `ReferenceArea` useful for VRAM threshold markers
- Large ecosystem: 88.7 benchmark score, 112+ code snippets in Context7, High source reputation
- Gentle learning curve — no D3 knowledge required

**Alternatives considered:**
| Library | Verdict | Reason |
|---------|---------|--------|
| visx (Airbnb) | Rejected for this use case | Low-level D3 primitives — gives maximum control but steep learning curve. Overkill for standard line charts and gauges. Better for highly custom novel visualizations |
| nivo | Close second | Supports SVG, Canvas, and HTML rendering. Canvas mode would be better for >1000 data points. Our throughput chart will have 60-300 points — SVG is fine |
| lightweight-charts | Rejected | Specialized for financial/trading charts (candlesticks, OHLC). Wrong domain |
| Chart.js / react-chartjs-2 | Rejected | Canvas-only — harder to style with Tailwind CSS, doesn't integrate with SVG-based Framer Motion animations |
| Apache ECharts | Rejected | Best raw performance for massive datasets, but heavyweight bundle (~1MB), imperative API, poor React integration |

### VRAM Gauge: Custom SVG + Framer Motion

**Selected over:** `react-circular-progressbar`, Syncfusion gauge, pre-built gauge libraries

**Why custom SVG:**
- Framer Motion is already mandatory in the design system — `motion.circle` with `strokeDashoffset` animation provides silky 120fps gauge fill
- Full control over OLED-optimized colors (violet accent gradients on `#09090b` background)
- SVG `<circle>` with `stroke-dasharray` / `stroke-dashoffset` is the standard technique for circular progress — well-documented, ~30 lines of code
- Zero additional dependencies
- Can match exact glass-effect aesthetic from `@opta/ui` Card glass variant

**Technique:**
```
SVG circle → stroke-dasharray = circumference
           → stroke-dashoffset = circumference * (1 - percentage)
           → motion.circle animates strokeDashoffset on value change
           → Gradient stops for color transitions (green → yellow → red)
```

**`react-circular-progressbar` considered:** Good library (SVG-based, customizable), but adds a dependency for something achievable in ~30 lines with Framer Motion we already ship. Doesn't support Framer Motion spring physics natively.

### Dashboard Layout: CSS Grid (native)

**Selected over:** `react-grid-layout`, Gridstack.js, Syncfusion Dashboard Layout

**Why native CSS Grid:**
- The dashboard has a fixed, known layout — not user-configurable (no drag-to-rearrange requirement)
- CSS Grid `grid-template-areas` gives semantic, readable layout definitions
- `auto-fit` / `minmax()` handle responsive breakpoints cleanly
- Zero-dependency — Tailwind CSS 4 has first-class grid support
- `react-grid-layout` (draggable/resizable widgets) is overkill for a monitoring dashboard where widget positions are predetermined

**If drag-to-rearrange is requested later:** Upgrade to `react-grid-layout` (2.2.2, actively maintained). It supports breakpoints, responsive layouts, and `onLayoutChange` persistence callbacks. The CSS Grid foundation will make migration straightforward.

---

## Architecture Patterns

### Pattern 1: SSE Connection Manager Hook

```typescript
// useSSE.ts — custom hook wrapping @microsoft/fetch-event-source
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { useRef, useCallback, useState, useEffect } from 'react';

type ConnectionState = 'connecting' | 'open' | 'closed' | 'error';

interface UseSSEOptions<T> {
  url: string;
  headers?: Record<string, string>;
  onMessage: (data: T) => void;
  onError?: (error: Error) => void;
  enabled?: boolean;
  retryInterval?: number;   // ms, default 3000
  maxRetries?: number;       // default 10
}

function useSSE<T>({ url, headers, onMessage, onError, enabled = true, retryInterval = 3000, maxRetries = 10 }: UseSSEOptions<T>) {
  const [connectionState, setConnectionState] = useState<ConnectionState>('closed');
  const abortRef = useRef<AbortController | null>(null);
  const retriesRef = useRef(0);

  const connect = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setConnectionState('connecting');

    await fetchEventSource(url, {
      headers,
      signal: ctrl.signal,
      onopen: async (response) => {
        if (response.ok) {
          setConnectionState('open');
          retriesRef.current = 0;
        } else {
          throw new Error(`SSE failed: ${response.status}`);
        }
      },
      onmessage: (event) => {
        try {
          const data = JSON.parse(event.data) as T;
          onMessage(data);
        } catch { /* skip malformed */ }
      },
      onerror: (err) => {
        setConnectionState('error');
        retriesRef.current++;
        if (retriesRef.current >= maxRetries) {
          ctrl.abort();
          onError?.(new Error('Max retries exceeded'));
          return; // stop retrying
        }
        // Exponential backoff: retryInterval * 2^retries, max 30s
        return Math.min(retryInterval * 2 ** retriesRef.current, 30_000);
      },
      onclose: () => {
        setConnectionState('closed');
      },
    });
  }, [url, headers, onMessage, onError, retryInterval, maxRetries]);

  useEffect(() => {
    if (enabled) connect();
    return () => abortRef.current?.abort();
  }, [enabled, connect]);

  const disconnect = useCallback(() => {
    abortRef.current?.abort();
    setConnectionState('closed');
  }, []);

  return { connectionState, disconnect, reconnect: connect };
}
```

**Key decisions:**
- `AbortController` in a `useRef` — survives re-renders without triggering them
- Retry counter in `useRef` — mutations don't cause re-renders
- Exponential backoff with cap at 30 seconds
- `enabled` flag for conditional connection (e.g., only when dashboard tab is active)
- Page Visibility handled automatically by `@microsoft/fetch-event-source`

### Pattern 2: Buffered State Updates for Real-Time Data

```typescript
// useBufferedState.ts — batch SSE events into periodic React state updates
import { useRef, useState, useEffect, useCallback } from 'react';

function useBufferedState<T>(initialState: T, intervalMs = 500) {
  const [state, setState] = useState<T>(initialState);
  const bufferRef = useRef<T>(initialState);

  // Update buffer without triggering re-render
  const push = useCallback((updater: (prev: T) => T) => {
    bufferRef.current = updater(bufferRef.current);
  }, []);

  // Flush buffer to state on interval
  useEffect(() => {
    const id = setInterval(() => {
      setState(bufferRef.current);
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return [state, push] as const;
}
```

**Why buffer:**
- SSE events can arrive at 10-50Hz (especially throughput metrics)
- Direct `setState` on every event causes 10-50 re-renders/second — wasteful
- Buffer in a ref, flush to state at 2Hz (500ms) — smooth visual updates, 96% fewer re-renders
- React 19 automatic batching helps, but batching within a single `setInterval` tick is more predictable

### Pattern 3: Time-Windowed Circular Buffer for Chart Data

```typescript
// CircularBuffer.ts — fixed-size sliding window for time-series data
class CircularBuffer<T> {
  private buffer: (T | undefined)[];
  private head = 0;
  private count = 0;

  constructor(private capacity: number) {
    this.buffer = new Array(capacity);
  }

  push(item: T): void {
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) this.count++;
  }

  toArray(): T[] {
    if (this.count < this.capacity) {
      return this.buffer.slice(0, this.count) as T[];
    }
    // Unwrap circular buffer into chronological order
    return [
      ...this.buffer.slice(this.head),
      ...this.buffer.slice(0, this.head),
    ] as T[];
  }

  get length(): number { return this.count; }
  get isFull(): boolean { return this.count === this.capacity; }
}
```

**Usage:** `new CircularBuffer<ThroughputPoint>(300)` — keeps last 5 minutes of data at 1-second granularity. Oldest points are automatically evicted. `toArray()` returns data in chronological order for Recharts.

### Pattern 4: Dashboard Layout Grid

```css
/* CSS Grid layout for monitoring dashboard */
.dashboard-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: 1fr 1fr 1fr;
  grid-template-rows: auto auto 1fr;
  grid-template-areas:
    "vram    models  status"
    "chart   chart   chart"
    "actions actions actions";
}

/* Tablet: 2-column */
@media (max-width: 1024px) {
  .dashboard-grid {
    grid-template-columns: 1fr 1fr;
    grid-template-areas:
      "vram    status"
      "models  models"
      "chart   chart"
      "actions actions";
  }
}

/* Mobile: single column */
@media (max-width: 640px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
    grid-template-areas:
      "vram" "status" "models" "chart" "actions";
  }
}
```

Tailwind CSS 4 equivalent uses `grid-cols-3`, `grid-cols-2`, `grid-cols-1` with responsive prefixes and `col-span-*` utilities.

---

## Don't Hand-Roll

| Component | Use Instead | Why |
|-----------|-------------|-----|
| SSE connection with headers | `@microsoft/fetch-event-source` | Handles reconnection, Page Visibility, abort, error classification. ~200 lines of edge cases you don't want to maintain |
| Time-series line chart | Recharts `LineChart` + `ResponsiveContainer` | SVG rendering, axes, tooltips, responsive sizing — all declarative. Custom D3 code would be 500+ lines |
| Circular gauge animation | Framer Motion `motion.circle` | Spring physics, GPU-accelerated, interruptible transitions. Manual `requestAnimationFrame` + SVG manipulation is fragile |
| Event stream parsing | `@microsoft/fetch-event-source` | SSE protocol has edge cases (multi-line data fields, retry headers, event IDs). The fetch-event-source parser handles all of them |
| Responsive grid | Tailwind CSS 4 grid utilities | `grid-cols-3 lg:grid-cols-2 sm:grid-cols-1` — no JS resize observers needed |

---

## Common Pitfalls

### 1. EventSource Cannot Send Custom Headers

**Problem:** The native `EventSource` API only supports no-payload GET requests with no custom headers. Attempting to pass `X-Admin-Key` via the constructor options fails silently — the header is simply not sent.

**Trap:** Passing the admin key as a query parameter (`/admin/events?key=xxx`) "works" but leaks the key in server access logs, browser history, and any proxy logs.

**Solution:** Use `@microsoft/fetch-event-source` which is built on `fetch()` and supports all standard request options including headers. Alternatively, `sse.js` supports `{headers: {...}}` in its constructor.

### 2. Re-render Storm from High-Frequency SSE Updates

**Problem:** Calling `setState` on every SSE event (10-50Hz for throughput metrics) causes the entire dashboard to re-render at that frequency. React 19's automatic batching helps within the same microtask, but SSE events arrive in separate macrotasks.

**Trap:** Using `useMemo` or `React.memo` on child components mitigates but doesn't eliminate the problem — the parent still re-renders on every state update, and diffing is still work.

**Solution:** Buffer events in a `useRef`, flush to state on a fixed interval (500ms). Use separate state atoms for independent data streams (VRAM status vs throughput vs model list) so updates to one don't re-render the others. Consider `useSyncExternalStore` for truly zero-overhead subscriptions.

### 3. Recharts Animation on Streaming Data

**Problem:** Recharts defaults to `isAnimationActive={true}` on all chart elements. With streaming data, this means the entire chart re-animates from scratch on every data update — causing stuttering and high CPU usage.

**Trap:** Setting `isAnimationActive={false}` alone is insufficient. A known Recharts bug causes line dots to render after a 1500ms delay even with animation disabled.

**Solution:** Set both `isAnimationActive={false}` AND `animationDuration={0}` on all `<Line>` and `<Area>` components that receive streaming data. This eliminates both the animation and the dot-render delay.

### 4. Memory Leak from Unbounded Chart Data

**Problem:** Naively appending every throughput data point to a state array causes unbounded growth. After hours of monitoring, the array has thousands of points, chart rendering slows, and memory usage climbs.

**Solution:** Use a circular buffer with a fixed capacity (e.g., 300 points = 5 minutes at 1/sec). Old data is automatically evicted. The `toArray()` method returns chronological data for Recharts.

### 5. SSE Connection Not Cleaned Up

**Problem:** If the component unmounts while the SSE connection is still open (e.g., navigating away from the dashboard), the connection persists, events continue firing, and `setState` is called on an unmounted component.

**Trap:** React 19 removed the "setState on unmounted component" warning, but the leak still exists — just silently.

**Solution:** Always abort the `AbortController` in the `useEffect` cleanup function. `@microsoft/fetch-event-source` respects the abort signal and tears down the connection cleanly.

### 6. SVG Gauge Stroke Direction

**Problem:** SVG circles draw clockwise from the 3 o'clock position by default. A VRAM gauge should fill from 12 o'clock (top) clockwise.

**Solution:** Apply `transform="rotate(-90)"` to the SVG or use `transform-origin: center` + `rotate(-90deg)` in CSS. Set `stroke-dasharray` to the circumference and animate `stroke-dashoffset` from circumference (empty) to 0 (full).

### 7. SSE Reconnect Thundering Herd

**Problem:** If the server restarts, all connected clients try to reconnect simultaneously, creating a thundering herd that can overload the server.

**Solution:** Add jitter to the reconnect delay. Instead of pure exponential backoff (`3s, 6s, 12s`), add random jitter: `delay * (1 + Math.random() * 0.5)`. This spreads reconnections across a time window.

---

## Code Examples

### VRAM Circular Gauge with Framer Motion

```tsx
import { motion } from 'framer-motion';

interface VRAMGaugeProps {
  usedGB: number;
  totalGB: number;
  size?: number;
}

export function VRAMGauge({ usedGB, totalGB, size = 160 }: VRAMGaugeProps) {
  const percentage = totalGB > 0 ? usedGB / totalGB : 0;
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - percentage);

  // Color transitions: green (0-60%) → yellow (60-80%) → red (80-100%)
  const color = percentage < 0.6
    ? 'var(--color-emerald-400)'
    : percentage < 0.8
      ? 'var(--color-amber-400)'
      : 'var(--color-red-400)';

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={8}
        />
        {/* Animated fill */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ type: 'spring', stiffness: 60, damping: 15 }}
        />
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-white font-sora">
          {usedGB.toFixed(1)}
        </span>
        <span className="text-xs text-white/50">
          / {totalGB.toFixed(0)} GB
        </span>
      </div>
    </div>
  );
}
```

### Throughput Time-Series Chart

```tsx
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

interface ThroughputPoint {
  timestamp: number;    // Unix ms
  tokensPerSecond: number;
}

interface ThroughputChartProps {
  data: ThroughputPoint[];
  averageTps?: number;
}

export function ThroughputChart({ data, averageTps }: ThroughputChartProps) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
        <XAxis
          dataKey="timestamp"
          tickFormatter={(ts) => new Date(ts).toLocaleTimeString([], { minute: '2-digit', second: '2-digit' })}
          stroke="rgba(255,255,255,0.3)"
          tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.5)' }}
        />
        <YAxis
          stroke="rgba(255,255,255,0.3)"
          tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.5)' }}
          tickFormatter={(v) => `${v} t/s`}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'rgba(9,9,11,0.9)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8,
            color: '#fff',
          }}
          labelFormatter={(ts) => new Date(ts).toLocaleTimeString()}
          formatter={(value: number) => [`${value.toFixed(1)} tokens/s`, 'Throughput']}
        />
        {averageTps && (
          <ReferenceLine
            y={averageTps}
            stroke="rgba(139,92,246,0.6)"
            strokeDasharray="4 4"
            label={{ value: `avg ${averageTps.toFixed(0)}`, fill: 'rgba(139,92,246,0.8)', fontSize: 11 }}
          />
        )}
        <Line
          type="monotone"
          dataKey="tokensPerSecond"
          stroke="var(--color-violet-400)"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
          animationDuration={0}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

### Model Load/Unload Card

```tsx
import { Card, CardHeader, CardTitle, CardContent } from '@opta/ui';
import { Badge } from '@opta/ui';
import { Button } from '@opta/ui';
import { motion, AnimatePresence } from 'framer-motion';

interface LoadedModel {
  id: string;
  name: string;
  vram_gb: number;
  loaded_at: string;
  status: 'ready' | 'loading' | 'unloading';
}

interface ModelListProps {
  models: LoadedModel[];
  onUnload: (modelId: string) => void;
  isUnloading: string | null;  // model ID currently being unloaded
}

export function ModelList({ models, onUnload, isUnloading }: ModelListProps) {
  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle>Loaded Models</CardTitle>
      </CardHeader>
      <CardContent>
        <AnimatePresence mode="popLayout">
          {models.map((model) => (
            <motion.div
              key={model.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex items-center justify-between py-3 border-b border-white/5 last:border-0"
            >
              <div className="flex items-center gap-3">
                <Badge variant={model.status === 'ready' ? 'default' : 'secondary'}>
                  {model.status}
                </Badge>
                <div>
                  <p className="text-sm font-medium text-white">{model.name}</p>
                  <p className="text-xs text-white/40">{model.vram_gb.toFixed(1)} GB VRAM</p>
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                disabled={isUnloading === model.id}
                onClick={() => onUnload(model.id)}
              >
                {isUnloading === model.id ? 'Unloading...' : 'Unload'}
              </Button>
            </motion.div>
          ))}
        </AnimatePresence>
        {models.length === 0 && (
          <p className="text-sm text-white/40 text-center py-8">No models loaded</p>
        )}
      </CardContent>
    </Card>
  );
}
```

### SSE Hook Usage in Dashboard Page

```tsx
import { useSSE } from '@/hooks/useSSE';
import { useBufferedState } from '@/hooks/useBufferedState';

interface ServerEvent {
  type: 'status' | 'throughput' | 'model_change';
  data: ServerStatus | ThroughputPoint | ModelChangeEvent;
}

function DashboardPage() {
  const [status, pushStatus] = useBufferedState<ServerStatus | null>(null, 500);
  const throughputBuffer = useRef(new CircularBuffer<ThroughputPoint>(300));
  const [chartData, setChartData] = useState<ThroughputPoint[]>([]);

  const handleSSEMessage = useCallback((event: ServerEvent) => {
    switch (event.type) {
      case 'status':
        pushStatus(() => event.data as ServerStatus);
        break;
      case 'throughput':
        throughputBuffer.current.push(event.data as ThroughputPoint);
        break;
      case 'model_change':
        // Trigger a fresh status fetch
        pushStatus(() => event.data as ServerStatus);
        break;
    }
  }, [pushStatus]);

  // Flush chart data on interval
  useEffect(() => {
    const id = setInterval(() => {
      setChartData(throughputBuffer.current.toArray());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const { connectionState } = useSSE<ServerEvent>({
    url: 'http://192.168.188.11:1234/admin/events',
    headers: { 'X-Admin-Key': process.env.NEXT_PUBLIC_LMX_ADMIN_KEY! },
    onMessage: handleSSEMessage,
  });

  return (
    <div className="grid grid-cols-3 gap-4 lg:grid-cols-2 sm:grid-cols-1">
      <VRAMGauge
        usedGB={status?.gpu.vram_used_gb ?? 0}
        totalGB={status?.gpu.vram_total_gb ?? 0}
      />
      <ModelList models={status?.loaded_models ?? []} />
      <ConnectionIndicator state={connectionState} />
      <div className="col-span-full">
        <ThroughputChart data={chartData} />
      </div>
    </div>
  );
}
```

---

## SOTA Updates

### Recharts 3.0 (Released mid-2025)
- Complete state management rewrite — better performance on frequent updates
- Z-index support for chart element layering
- Improved TypeScript types (strict generics)
- Accessibility enabled by default (keyboard navigation, ARIA)
- `recharts-scale` dependency removed — scales maintained internally
- 3500+ unit tests in the rewrite — more reliable than v2.x

### React 19.2 (Current)
- Automatic batching covers all contexts (setTimeout, promises, native events) — reduces re-renders from SSE callbacks
- `useEffectEvent` (experimental) — stable function references for event handlers without stale closures
- Suspense SSR batching — reveals Suspense boundaries in groups

### @microsoft/fetch-event-source (v2.0.1)
- Built on Fetch API with ReadableStream parsing
- Page Visibility API integration for connection lifecycle
- TypeScript-first with full type exports
- AbortController support for clean teardown

### Framer Motion / Motion (v11+)
- Renamed to "Motion" but `framer-motion` npm package still active
- `motion.circle` supports all SVG attributes including `strokeDashoffset`
- Spring physics for natural gauge animations
- `AnimatePresence` with `mode="popLayout"` for smooth list item removal (model unload)

---

## Open Questions

### Q1: SSE vs WebSocket for throughput streaming
**Context:** The LMX server already has an `/admin/events` SSE endpoint. SSE is unidirectional (server to client), which is sufficient for monitoring. WebSocket would only be needed if we want bidirectional communication (e.g., sending commands through the same connection).

**Current stance:** SSE is correct for monitoring. Model load/unload commands use separate REST endpoints (POST). No need for WebSocket complexity.

**Revisit if:** We add interactive features that require low-latency bidirectional communication (e.g., real-time prompt streaming, collaborative model management).

### Q2: Chart update frequency
**Context:** Flushing chart data at 1-second intervals (1Hz) vs 500ms (2Hz) vs 2-second (0.5Hz).

**Current stance:** 1-second flush for the throughput chart (matches typical metric granularity). 500ms flush for VRAM gauge (feels responsive but not wasteful). Test both and tune based on perceived smoothness vs CPU usage.

### Q3: Admin key storage
**Context:** `X-Admin-Key` needs to reach the SSE endpoint. Options: (a) `NEXT_PUBLIC_` env var exposed to client, (b) Next.js route handler that proxies SSE and adds the header server-side, (c) cookie-based auth.

**Current stance:** For a LAN-only monitoring dashboard, `NEXT_PUBLIC_` env var is acceptable (the key never leaves the local network). If the dashboard is ever exposed to the internet, switch to a Next.js proxy route that adds the header server-side.

**Risk:** `NEXT_PUBLIC_` values are embedded in the JavaScript bundle. Anyone with access to the page can extract the key. On a private LAN this is low risk.

### Q4: Dashboard as a page vs standalone app
**Context:** Should this be a page within an existing Opta web app, or a standalone lightweight dashboard?

**Current stance:** Standalone page within the Opta Life Web app (`1-Apps/1F-Opta-Life-Web/`) or a new dedicated monitoring app. Depends on Phase 2 decisions about where admin UI lives.

### Q5: react-grid-layout for future drag-to-rearrange
**Context:** Current design is fixed layout. If users want customizable widget positions later, `react-grid-layout` (v2.2.2) is the standard solution with breakpoints, persistence, and responsive support.

**Current stance:** Start with CSS Grid. The component boundaries (VRAMGauge, ThroughputChart, ModelList) are designed as self-contained widgets — migration to react-grid-layout would require wrapping each in a grid item, not rewriting them.

---

## Sources

### SSE and Real-Time Connection
- [MDN: Using Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)
- [Server-Sent Events — javascript.info](https://javascript.info/server-sent-events)
- [@microsoft/fetch-event-source — npm](https://www.npmjs.com/package/@microsoft/fetch-event-source)
- [sse.js — GitHub (mpetazzoni)](https://github.com/mpetazzoni/sse.js/)
- [Using Fetch Event Source for SSE in React — LogRocket](https://blog.logrocket.com/using-fetch-event-source-server-sent-events-react/)
- [How to Implement SSE in React — OneUptime](https://oneuptime.com/blog/post/2026-01-15-server-sent-events-sse-react/view)
- [react-eventsource — npm](https://www.npmjs.com/package/react-eventsource?activeTab=readme)
- [sse-ts — npm](https://github.com/smartmuki/sse-ts)
- [Next.js SSE Discussion #48427](https://github.com/vercel/next.js/discussions/48427)
- [Next.js 16 Route Handlers — Strapi](https://strapi.io/blog/nextjs-16-route-handlers-explained-3-advanced-usecases)

### Charting Libraries
- [Recharts Documentation — Context7](https://context7.com/recharts/recharts/llms.txt)
- [Recharts 3.0 Migration Guide — GitHub Wiki](https://github.com/recharts/recharts/wiki/3.0-migration-guide)
- [Recharts v3.0.0 Release](https://github.com/recharts/recharts/releases/tag/v3.0.0)
- [Performance issue with realtime data — Recharts #949](https://github.com/recharts/recharts/issues/949)
- [Real-time chart — Recharts #287](https://github.com/recharts/recharts/issues/287)
- [Best React Chart Libraries 2025 — LogRocket](https://blog.logrocket.com/best-react-chart-libraries-2025/)
- [React Charting Libraries Comparison — Capital One](https://www.capitalone.com/tech/software-engineering/comparison-data-visualization-libraries-for-react/)
- [Comparing 8 Popular React Charting Libraries — Medium](https://medium.com/@ponshriharini/comparing-8-popular-react-charting-libraries-performance-features-and-use-cases-cc178d80b3ba)

### Gauge and SVG Animation
- [Animated Circular Progress Bar — MagicUI](https://magicui.design/docs/components/animated-circular-progress-bar)
- [Build SVG Circular Progress Component — LogRocket](https://blog.logrocket.com/build-svg-circular-progress-component-react-hooks/)
- [How to Animate SVG Paths with Framer Motion](https://blog.noelcserepy.com/how-to-animate-svg-paths-with-framer-motion)
- [SVG Animation in React — Motion docs](https://motion.dev/docs/react-svg-animation)
- [Framer Motion Component API](https://www.framer.com/motion/component/)
- [react-circular-progressbar — npm](https://www.npmjs.com/package/react-circular-progressbar)

### Dashboard Layout
- [react-grid-layout — GitHub](https://github.com/react-grid-layout/react-grid-layout)
- [Interactive Dashboards with Recharts and React-Grid-Layout — Medium](https://medium.com/@mohdkhan.mk99/interactive-dashboards-recharts-react-grid-layout-a12952bbd0e0)
- [Building Responsive React Dashboards with Grid Layouts — Codezup](https://codezup.com/building-responsive-dashboard-react-grid-layouts/)
- [Tremor — Dashboard Components](https://www.tremor.so/)

### Real-Time Data Management
- [Queueing State Updates — React docs](https://react.dev/learn/queueing-a-series-of-state-updates)
- [Automatic Batching in React 18 — GitHub Discussion](https://github.com/reactwg/react-18/discussions/21)
- [React 19.2 Release Guide — CodeWithSeb](https://www.codewithseb.com/blog/react-19-2-release-guide-activity-useeffectevent-ssr-batching-and-more-explained)
- [UX Design Patterns for Loading — Pencil & Paper](https://www.pencilandpaper.io/articles/ux-pattern-analysis-loading-feedback)
- [Asynchronous Mobile UX Patterns — Medium](https://medium.com/snapp-mobile/asynchronous-mobile-ux-patterns-785ea69c4391)
- [Loading & Unloading Models — LM Studio JS DeepWiki](https://deepwiki.com/lmstudio-ai/lmstudio-js/5.1-loading-and-unloading-models)
