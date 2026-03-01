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

const DEGRADED_LATENCY_MS = 80;
const CRITICAL_LATENCY_MS = 160;
const HIGH_VRAM_PERCENT = 80;
const CRITICAL_VRAM_PERCENT = 92;

type RuntimeConnectionState = 'online' | 'probing' | 'offline';
type RuntimeLatencyState = 'nominal' | 'degraded' | 'critical' | 'unknown';
type RuntimePressureState = 'normal' | 'high' | 'critical' | 'unknown';

function formatUptime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function deriveConnectionState(
  isConnected: boolean,
  connectionType: string,
): RuntimeConnectionState {
  if (isConnected) return 'online';
  if (connectionType === 'probing') return 'probing';
  return 'offline';
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
  const activeRequests = status?.active_requests ?? 0;

  const runtimeConnectionState = deriveConnectionState(isConnected, connectionType);
  const isBusy = activeRequests > 0;

  const latencyState: RuntimeLatencyState = useMemo(() => {
    if (latencyMs == null) return 'unknown';
    if (latencyMs >= CRITICAL_LATENCY_MS) return 'critical';
    if (latencyMs >= DEGRADED_LATENCY_MS) return 'degraded';
    return 'nominal';
  }, [latencyMs]);

  const pressureState: RuntimePressureState = useMemo(() => {
    if (vramPercent == null) return 'unknown';
    if (vramPercent >= CRITICAL_VRAM_PERCENT) return 'critical';
    if (vramPercent >= HIGH_VRAM_PERCENT) return 'high';
    return 'normal';
  }, [vramPercent]);

  const stateLabel =
    runtimeConnectionState === 'online'
      ? latencyState === 'critical' || latencyState === 'degraded'
        ? 'Degraded'
        : isBusy
          ? 'Busy'
          : pressureState === 'high' || pressureState === 'critical'
            ? 'Pressure'
            : 'Nominal'
      : runtimeConnectionState === 'probing'
        ? 'Probing'
        : 'Offline';

  const dotClass =
    runtimeConnectionState === 'online'
      ? 'bg-neon-green opta-live-dot'
      : runtimeConnectionState === 'probing'
        ? 'bg-neon-amber animate-pulse'
        : 'bg-neon-red';

  const stripClass = cn(
    'fixed bottom-0 inset-x-0 z-40 h-7 glass-subtle border-t border-white/5 flex items-center px-4',
    'opta-state-scan opta-state-border',
    'runtime-state-strip',
    `runtime-state-strip--${runtimeConnectionState}`,
    isBusy && 'runtime-state-strip--busy',
    (latencyState === 'degraded' || latencyState === 'critical') && 'runtime-state-strip--degraded',
    (pressureState === 'high' || pressureState === 'critical') && 'runtime-state-strip--pressure',
  );

  return (
    <div
      className={stripClass}
      data-runtime-connection={runtimeConnectionState}
      data-runtime-latency={latencyState}
      data-runtime-activity={isBusy ? 'busy' : 'idle'}
      data-runtime-pressure={pressureState}
    >
      {/* Status dot */}
      <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', dotClass)} />
      <span
        className={cn(
          'ml-2 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wide',
          runtimeConnectionState === 'offline'
            ? 'border-neon-red/30 text-neon-red bg-neon-red/10'
              : runtimeConnectionState === 'probing' ||
                latencyState === 'degraded' ||
                latencyState === 'critical' ||
                pressureState === 'high' ||
                pressureState === 'critical'
              ? 'border-neon-amber/30 text-neon-amber bg-neon-amber/10'
              : isBusy
                ? 'border-neon-cyan/30 text-neon-cyan bg-neon-cyan/10'
                : 'border-neon-green/30 text-neon-green bg-neon-green/10',
        )}
      >
        {stateLabel}
      </span>

      {runtimeConnectionState !== 'online' ? (
        <span className="ml-3 text-[11px] font-mono text-text-muted">
          {runtimeConnectionState === 'probing' ? 'Checking connection...' : 'Disconnected'}
        </span>
      ) : (
        <>
          {/* Model name */}
          <span className="ml-3 text-[11px] font-mono text-text-secondary">{modelName}</span>

          {/* Divider */}
          <div className="w-px h-3 bg-white/10 mx-3" />

          {/* TPS */}
          <span className="text-[11px] font-mono text-text-muted">{tps} t/s</span>

          {/* Active requests */}
          <div className="w-px h-3 bg-white/10 mx-3" />
          <span
            className={cn(
              'text-[11px] font-mono',
              isBusy ? 'text-neon-cyan animate-pulse' : 'text-text-muted',
            )}
          >
            {activeRequests} req
          </span>

          {/* VRAM % */}
          {vramPercent != null && (
            <>
              <div className="w-px h-3 bg-white/10 mx-3" />
              <span
                className={cn(
                  'text-[11px] font-mono',
                  pressureState === 'critical'
                    ? 'text-neon-red animate-pulse'
                    : pressureState === 'high'
                      ? 'text-neon-amber'
                      : 'text-text-muted',
                )}
              >
                {vramPercent}% VRAM
              </span>
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
              <span
                className={cn(
                  'text-[11px] font-mono',
                  latencyState === 'critical'
                    ? 'text-neon-red'
                    : latencyState === 'degraded'
                      ? 'text-neon-amber'
                      : 'text-text-muted',
                )}
              >
                {latencyMs}ms
              </span>
            </>
          )}
        </>
      )}
    </div>
  );
}
