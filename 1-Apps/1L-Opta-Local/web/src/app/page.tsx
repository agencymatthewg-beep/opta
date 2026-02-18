'use client';

/**
 * Dashboard -- Root page (/).
 *
 * Connects to LMX /admin/events via SSE, displays live VRAM gauge,
 * loaded models list, throughput chart, and server stats. Uses global
 * ConnectionProvider for dynamic base URL (LAN/WAN auto-failover).
 *
 * Throughput data uses a CircularBuffer (capacity 300 = 5 min at 1/sec)
 * flushed to React state on a 1-second interval -- separate from the
 * 500ms VRAM/status flush to avoid coupling chart redraws to gauge updates.
 *
 * Responsive CSS Grid layout:
 * 3 columns (desktop) -> 2 columns (tablet) -> 1 column (mobile).
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { RefreshCw, Plus } from 'lucide-react';
import { Button } from '@opta/ui';

import { useSSE } from '@/hooks/useSSE';
import { useBufferedState } from '@/hooks/useBufferedState';
import { useConnectionContextSafe } from '@/components/shared/ConnectionProvider';
import type { ServerStatus } from '@/types/lmx';
import { CircularBuffer } from '@/lib/circular-buffer';
import type { ThroughputPoint } from '@/lib/circular-buffer';

import { VRAMGauge } from '@/components/dashboard/VRAMGauge';
import { ModelList } from '@/components/dashboard/ModelList';
import { ThroughputChart } from '@/components/dashboard/ThroughputChart';
import { ModelLoadDialog } from '@/components/dashboard/ModelLoadDialog';

// ---------------------------------------------------------------------------
// SSE event shape
// ---------------------------------------------------------------------------

interface SSEEvent {
  type: 'status' | 'model_change' | 'throughput';
  data: ServerStatus | ThroughputPoint;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** 300 data points = 5 minutes at 1 data point per second */
const THROUGHPUT_BUFFER_CAPACITY = 300;

/** Flush chart data to React state every 1 second */
const CHART_FLUSH_INTERVAL_MS = 1000;

// ---------------------------------------------------------------------------
// Dashboard page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  // ---- Connection from global provider (null while settings load) ----
  const connection = useConnectionContextSafe();
  const baseUrl = connection?.baseUrl ?? '';
  const isConnected = connection?.isConnected ?? false;
  const client = connection?.client ?? null;
  const connectionType = connection?.connectionType ?? 'probing';
  const adminKey = connection?.adminKey ?? '';

  // ---- Derived SSE URL (reacts to LAN/WAN changes) ----
  const sseUrl = useMemo(() => {
    if (!isConnected) return '';
    return `${baseUrl}/admin/events`;
  }, [baseUrl, isConnected]);

  // ---- Admin key header for SSE ----
  const sseHeaders = useMemo(() => {
    if (!adminKey) return undefined;
    return { 'X-Admin-Key': adminKey };
  }, [adminKey]);

  // ---- Buffered server status (500ms flush) ----
  const [status, pushStatus] = useBufferedState<ServerStatus | null>(
    null,
    500,
  );

  // ---- Throughput circular buffer + state (1s flush) ----
  const throughputBufferRef = useRef(
    new CircularBuffer<ThroughputPoint>(THROUGHPUT_BUFFER_CAPACITY),
  );
  const [chartData, setChartData] = useState<ThroughputPoint[]>([]);

  // Flush throughput buffer to React state on 1-second interval
  useEffect(() => {
    const id = setInterval(() => {
      setChartData(throughputBufferRef.current.toArray());
    }, CHART_FLUSH_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  // Compute average TPS from chart data
  const averageTps = useMemo(() => {
    if (chartData.length === 0) return undefined;
    const sum = chartData.reduce((acc, p) => acc + p.tokensPerSecond, 0);
    return sum / chartData.length;
  }, [chartData]);

  // ---- SSE message handler ----
  const handleMessage = useCallback(
    (event: SSEEvent) => {
      switch (event.type) {
        case 'status':
        case 'model_change':
          pushStatus(() => event.data as ServerStatus);
          break;
        case 'throughput':
          throughputBufferRef.current.push(event.data as ThroughputPoint);
          break;
      }
    },
    [pushStatus],
  );

  // ---- SSE connection ----
  const { connectionState, reconnect } = useSSE<SSEEvent>({
    url: sseUrl,
    headers: sseHeaders,
    onMessage: handleMessage,
    enabled: isConnected && sseUrl !== '',
  });

  // ---- Synthesize throughput from status TPS ----
  // If the server sends status events with tokens_per_second but no
  // dedicated throughput events, create synthetic throughput points.
  const lastStatusTpsRef = useRef<number | null>(null);
  useEffect(() => {
    if (status?.tokens_per_second != null) {
      const tps = status.tokens_per_second;
      if (lastStatusTpsRef.current !== tps) {
        lastStatusTpsRef.current = tps;
        throughputBufferRef.current.push({
          timestamp: Date.now(),
          tokensPerSecond: tps,
        });
      }
    }
  }, [status]);

  // ---- Model unload handler (uses connection-aware client) ----
  const [unloadingId, setUnloadingId] = useState<string | null>(null);

  const handleUnload = useCallback(
    async (modelId: string) => {
      if (!client) return;
      setUnloadingId(modelId);
      try {
        await client.unloadModel(modelId);
      } catch {
        // Error will be reflected when next SSE status event arrives
      } finally {
        setUnloadingId(null);
      }
    },
    [client],
  );

  // ---- Model load handler ----
  const [isLoadOpen, setIsLoadOpen] = useState(false);
  const [isLoadingModel, setIsLoadingModel] = useState(false);

  const handleLoadModel = useCallback(
    async (modelPath: string, quantization?: string) => {
      if (!client) return;
      setIsLoadingModel(true);
      try {
        await client.loadModel({
          model_path: modelPath,
          quantization,
        });
        // Success -- close the dialog. SSE will update models list.
        setIsLoadOpen(false);
      } finally {
        setIsLoadingModel(false);
      }
    },
    [client],
  );

  // ---- Dashboard render ----
  return (
    <main className="min-h-screen p-6">
      {/* Page header */}
      <header className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-text-primary">Dashboard</h1>
          {/* SSE connection state indicator (subtle) */}
          {connectionType !== 'offline' && connectionState === 'error' && (
            <span className="text-xs text-neon-red">SSE disconnected</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="glass"
            size="sm"
            onClick={() => setIsLoadOpen((prev) => !prev)}
            aria-label="Load a model"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Load Model
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={reconnect}
            aria-label="Reconnect SSE"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Model Load Dialog (collapsible panel) */}
      <div className="mb-4">
        <ModelLoadDialog
          onLoad={handleLoadModel}
          isLoading={isLoadingModel}
          isOpen={isLoadOpen}
          onClose={() => setIsLoadOpen(false)}
        />
      </div>

      {/* Dashboard grid: 3 -> 2 -> 1 columns */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {/* VRAM Gauge */}
        <VRAMGauge
          usedGB={status?.vram_used_gb ?? 0}
          totalGB={status?.vram_total_gb ?? 0}
        />

        {/* Loaded Models */}
        <div className="md:col-span-1 xl:col-span-2">
          <ModelList
            models={status?.loaded_models ?? []}
            onUnload={handleUnload}
            isUnloading={unloadingId}
          />
        </div>

        {/* Throughput Chart -- full width */}
        <div className="col-span-full">
          <ThroughputChart data={chartData} averageTps={averageTps} />
        </div>

        {/* Server Stats */}
        <div className="glass-subtle col-span-full rounded-xl p-6">
          <h2 className="mb-4 text-sm font-semibold text-text-secondary uppercase tracking-wider">
            Server Info
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatItem
              label="Active Requests"
              value={status?.active_requests ?? 0}
            />
            <StatItem
              label="Tokens/sec"
              value={status?.tokens_per_second.toFixed(1) ?? '0.0'}
            />
            <StatItem
              label="Temperature"
              value={`${status?.temperature_celsius.toFixed(0) ?? '\u2014'}\u00B0C`}
            />
            <StatItem
              label="Uptime"
              value={formatUptime(status?.uptime_seconds ?? 0)}
            />
          </div>
        </div>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatItem({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div>
      <p className="text-xs text-text-muted">{label}</p>
      <p className="text-lg font-semibold text-text-primary">{value}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatUptime(seconds: number): string {
  if (seconds <= 0) return '\u2014';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
