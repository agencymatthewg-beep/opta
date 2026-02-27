'use client';

/**
 * StatusStrip -- Fixed bottom status bar showing live server metrics
 *
 * Primary data source: SSE-derived status via `useLiveStatus()` from the
 * global status store (published by the dashboard page).
 *
 * Fallback: When the dashboard is not mounted (`useLiveStatus()` returns null),
 * polls via `LMXClient.getStatus()` every 10 seconds.
 */

import { useState, useEffect, useMemo } from 'react';
import type { ServerStatus } from '@/types/lmx';
import { useConnectionContextSafe } from '@/components/shared/ConnectionProvider';
import { useLiveStatus } from '@/lib/status-store';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatUptime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 10_000;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StatusStrip() {
  const connection = useConnectionContextSafe();
  const liveStatus = useLiveStatus();
  const [polledStatus, setPolledStatus] = useState<ServerStatus | null>(null);

  const isConnected = connection?.isConnected ?? false;
  const connectionType = connection?.connectionType ?? 'probing';
  const latencyMs = connection?.latencyMs;

  // Fallback polling: only active when live status is unavailable
  useEffect(() => {
    if (liveStatus !== null) {
      // SSE-derived status available -- no polling needed
      return;
    }

    if (!isConnected || !connection?.client) {
      setPolledStatus(null);
      return;
    }

    const { client } = connection;
    let cancelled = false;

    const fetchStatus = async () => {
      try {
        const data = await client.getStatus();
        if (!cancelled) {
          setPolledStatus(data);
        }
      } catch {
        // Silently fail -- polled status remains stale or null
      }
    };

    fetchStatus(); // Initial fetch
    const interval = setInterval(fetchStatus, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [liveStatus, isConnected, connection?.client]);

  // Merge: prefer live SSE status over polled
  const effectiveStatus: ServerStatus | null = liveStatus ?? polledStatus;

  // Derive display values
  const modelName = useMemo(() => {
    if (!effectiveStatus?.loaded_models || effectiveStatus.loaded_models.length === 0) return 'No model';
    const name = effectiveStatus.loaded_models[0]?.name ?? 'Unknown';
    return name.length > 20 ? `${name.slice(0, 17)}...` : name;
  }, [effectiveStatus]);

  const vramPercent = useMemo(() => {
    if (!effectiveStatus) return null;
    const { vram_used_gb, vram_total_gb } = effectiveStatus;
    if (!vram_total_gb) return null;
    return Math.round((vram_used_gb / vram_total_gb) * 100);
  }, [effectiveStatus]);

  const tps = effectiveStatus?.tokens_per_second?.toFixed(1) ?? '0.0';
  const uptime = effectiveStatus?.uptime_seconds != null ? formatUptime(effectiveStatus.uptime_seconds) : null;

  // Connection status
  const dotClass = isConnected
    ? 'bg-neon-green opta-live-dot'
    : connectionType === 'probing'
      ? 'bg-neon-amber'
      : 'bg-neon-red';

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 h-7 glass-subtle border-t border-white/5 flex items-center px-4">
      {/* Status dot */}
      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClass}`} />

      {!isConnected ? (
        <span className="ml-2 text-[11px] font-mono text-text-muted">Offline</span>
      ) : (
        <>
          {/* Model name */}
          <span className="ml-3 text-[11px] font-mono text-text-secondary">{modelName}</span>

          {/* Divider */}
          <div className="w-px h-3 bg-white/10 mx-3" />

          {/* TPS */}
          <span className="text-[11px] font-mono text-text-muted">{tps} t/s</span>

          {/* VRAM % */}
          {vramPercent != null && (
            <>
              <div className="w-px h-3 bg-white/10 mx-3" />
              <span className="text-[11px] font-mono text-text-muted">{vramPercent}% VRAM</span>
            </>
          )}

          {/* Uptime */}
          {uptime && (
            <>
              <div className="w-px h-3 bg-white/10 mx-3" />
              <span className="text-[11px] font-mono text-text-muted">{uptime}</span>
            </>
          )}

          {/* Ping */}
          {latencyMs != null && (
            <>
              <div className="w-px h-3 bg-white/10 mx-3" />
              <span className="text-[11px] font-mono text-text-muted">{latencyMs}ms</span>
            </>
          )}


        </>
      )}
    </div>
  );
}
