'use client';

/**
 * Dashboard — Root page (/).
 *
 * Connects to LMX /admin/events via SSE, displays live VRAM gauge,
 * loaded models list, and connection status. Responsive CSS Grid layout:
 * 3 columns (desktop) -> 2 columns (tablet) -> 1 column (mobile).
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { MessageSquare, Settings, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@opta/ui';

import { useSSE } from '@/hooks/useSSE';
import { useBufferedState } from '@/hooks/useBufferedState';
import { getConnectionSettings, getBaseUrl } from '@/lib/connection';
import type { ConnectionSettings } from '@/lib/connection';
import type { ServerStatus } from '@/types/lmx';

import { VRAMGauge } from '@/components/dashboard/VRAMGauge';
import { ModelList } from '@/components/dashboard/ModelList';
import { ConnectionIndicator } from '@/components/dashboard/ConnectionIndicator';

// ---------------------------------------------------------------------------
// SSE event shape
// ---------------------------------------------------------------------------

interface SSEEvent {
  type: 'status' | 'model_change';
  data: ServerStatus;
}

// ---------------------------------------------------------------------------
// Dashboard page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  // ---- Connection settings (loaded from encrypted localStorage) ----
  const [settings, setSettings] = useState<ConnectionSettings | null>(null);
  const [settingsError, setSettingsError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getConnectionSettings()
      .then((s) => {
        if (!cancelled) setSettings(s);
      })
      .catch(() => {
        if (!cancelled) setSettingsError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ---- Derived SSE URL and headers ----
  const sseUrl = useMemo(() => {
    if (!settings) return '';
    return `${getBaseUrl(settings)}/admin/events`;
  }, [settings]);

  const sseHeaders = useMemo(() => {
    if (!settings?.adminKey) return undefined;
    return { 'X-Admin-Key': settings.adminKey };
  }, [settings]);

  // ---- Buffered server status ----
  const [status, pushStatus] = useBufferedState<ServerStatus | null>(
    null,
    500,
  );

  // ---- SSE message handler ----
  const handleMessage = useCallback(
    (event: SSEEvent) => {
      switch (event.type) {
        case 'status':
        case 'model_change':
          pushStatus(() => event.data);
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
    enabled: !!settings && sseUrl !== '',
  });

  // ---- Model unload handler ----
  const [unloadingId, setUnloadingId] = useState<string | null>(null);

  const handleUnload = useCallback(
    async (modelId: string) => {
      if (!settings) return;
      setUnloadingId(modelId);
      try {
        const { createClient } = await import('@/lib/connection');
        const client = createClient(settings);
        await client.unloadModel(modelId);
      } catch {
        // Error will be reflected when next SSE status event arrives
      } finally {
        setUnloadingId(null);
      }
    },
    [settings],
  );

  // ---- Loading / error states ----
  if (settingsError) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <div className="glass-subtle max-w-sm rounded-xl p-8 text-center">
          <p className="mb-2 text-lg font-semibold text-text-primary">
            Settings Error
          </p>
          <p className="mb-4 text-sm text-text-secondary">
            Could not load connection settings. Please configure your server
            connection.
          </p>
          <Link href="/settings">
            <Button variant="primary" size="md">
              <Settings className="mr-2 h-4 w-4" />
              Go to Settings
            </Button>
          </Link>
        </div>
      </main>
    );
  }

  if (!settings) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <p className="text-sm text-text-muted">Loading settings...</p>
      </main>
    );
  }

  // ---- Dashboard render ----
  return (
    <main className="min-h-screen p-6">
      {/* Header */}
      <header className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-text-primary">
            Opta Local
          </h1>
          <ConnectionIndicator state={connectionState} />
        </div>

        <nav className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={reconnect}
            aria-label="Reconnect SSE"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Link href="/chat">
            <Button variant="glass" size="sm">
              <MessageSquare className="mr-1.5 h-4 w-4" />
              Chat
            </Button>
          </Link>
          <Link href="/settings">
            <Button variant="ghost" size="sm">
              <Settings className="h-4 w-4" />
            </Button>
          </Link>
        </nav>
      </header>

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
              value={`${status?.temperature_celsius.toFixed(0) ?? '—'}\u00B0C`}
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
  if (seconds <= 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
