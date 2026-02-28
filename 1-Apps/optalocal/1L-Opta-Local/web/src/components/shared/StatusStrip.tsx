'use client';

/**
 * StatusStrip — Fixed bottom status bar showing live server metrics
 *
 * Polls /admin/status every 3s when connected. Displays: model name, TPS, VRAM%, uptime, ping.
 * Renders connection status dot with pulse animation when online.
 */

import { useState, useEffect, useMemo } from 'react';
import { cn } from '@opta/ui';
import type { ServerStatus } from '@/types/lmx';
import { useConnectionContextSafe } from '@/components/shared/ConnectionProvider';

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
// Component
// ---------------------------------------------------------------------------

export function StatusStrip() {
  const connection = useConnectionContextSafe();
  const [status, setStatus] = useState<ServerStatus | null>(null);

  const baseUrl = connection?.baseUrl ?? '';
  const adminKey = connection?.adminKey ?? '';
  const isConnected = connection?.isConnected ?? false;
  const connectionType = connection?.connectionType ?? 'probing';
  const latencyMs = connection?.latencyMs;

  // Poll server status when connected
  useEffect(() => {
    if (!isConnected || !baseUrl) {
      setStatus(null);
      return;
    }

    const fetchStatus = async () => {
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (adminKey) {
          headers['X-Admin-Key'] = adminKey;
        }

        const response = await fetch(`${baseUrl}/admin/status`, { headers });
        if (response.ok) {
          const data = await response.json();
          setStatus(data as ServerStatus);
        }
      } catch {
        // Silently fail — status will remain null
      }
    };

    fetchStatus(); // Initial fetch
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, [baseUrl, adminKey, isConnected]);

  // Derive display values
  const modelName = useMemo(() => {
    if (!status?.loaded_models || status.loaded_models.length === 0) return 'No model';
    const name = status.loaded_models[0]?.name ?? 'Unknown';
    return name.length > 20 ? `${name.slice(0, 17)}...` : name;
  }, [status]);

  const vramPercent = useMemo(() => {
    if (!status) return null;
    const { vram_used_gb, vram_total_gb } = status;
    if (!vram_total_gb) return null;
    return Math.round((vram_used_gb / vram_total_gb) * 100);
  }, [status]);

  const tps = status?.tokens_per_second?.toFixed(1) ?? '0.0';
  const uptime = status?.uptime_seconds != null ? formatUptime(status.uptime_seconds) : null;

  // Connection status
  const dotClass = isConnected
    ? 'bg-neon-green opta-live-dot'
    : connectionType === 'probing'
      ? 'bg-neon-amber'
      : 'bg-neon-red';

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 h-7 glass-subtle border-t border-white/5 flex items-center px-4">
      {/* Status dot */}
      <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', dotClass)} />

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
