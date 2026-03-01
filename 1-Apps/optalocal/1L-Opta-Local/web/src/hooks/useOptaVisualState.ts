'use client';

import { useMemo } from 'react';
import type { ConnectionMode, UseConnectionReturn } from '@/hooks/useConnection';

export type OptaVisualState =
  | 'healthy'
  | 'degraded'
  | 'offline'
  | 'probing'
  | 'busy';

export type OptaMotionMode = 'active' | 'steady' | 'reduced';

export interface OptaVisualRuntimeSignals {
  busy?: boolean;
  degraded?: boolean;
  /** Optional explicit motion override. */
  motion?: OptaMotionMode;
  /** Latency threshold that triggers a degraded state. Defaults to 350ms. */
  latencyDegradedMs?: number;
}

type ConnectionSnapshot =
  | Pick<UseConnectionReturn, 'connectionType' | 'isConnected' | 'latencyMs' | 'error'>
  | null
  | undefined;

interface VisualTone {
  text: string;
  border: string;
  bg: string;
  glow: string;
}

interface VisualMeta {
  label: string;
  tone: VisualTone;
}

export interface OptaVisualStateResult {
  connection: ConnectionMode;
  visualState: OptaVisualState;
  motion: OptaMotionMode;
  label: string;
  connectionLabel: string;
  tone: VisualTone;
  toneClassName: string;
  dataAttributes: {
    'data-connection': ConnectionMode;
    'data-visual-state': OptaVisualState;
    'data-opta-motion': OptaMotionMode;
  };
}

const DEFAULT_LATENCY_DEGRADED_MS = 350;

const CONNECTION_LABELS: Record<ConnectionMode, string> = {
  lan: 'LAN',
  wan: 'WAN',
  offline: 'Offline',
  probing: 'Probing',
};

const VISUAL_META: Record<OptaVisualState, VisualMeta> = {
  healthy: {
    label: 'Healthy',
    tone: {
      text: 'text-neon-green',
      border: 'border-neon-green/35',
      bg: 'bg-neon-green/10',
      glow: 'shadow-[0_0_20px_rgba(34,197,94,0.18)]',
    },
  },
  degraded: {
    label: 'Degraded',
    tone: {
      text: 'text-neon-amber',
      border: 'border-neon-amber/35',
      bg: 'bg-neon-amber/10',
      glow: 'shadow-[0_0_20px_rgba(245,158,11,0.18)]',
    },
  },
  offline: {
    label: 'Offline',
    tone: {
      text: 'text-neon-red',
      border: 'border-neon-red/35',
      bg: 'bg-neon-red/10',
      glow: 'shadow-[0_0_20px_rgba(239,68,68,0.16)]',
    },
  },
  probing: {
    label: 'Probing',
    tone: {
      text: 'text-neon-blue',
      border: 'border-neon-blue/35',
      bg: 'bg-neon-blue/10',
      glow: 'shadow-[0_0_20px_rgba(59,130,246,0.18)]',
    },
  },
  busy: {
    label: 'Busy',
    tone: {
      text: 'text-neon-indigo',
      border: 'border-neon-indigo/35',
      bg: 'bg-neon-indigo/10',
      glow: 'shadow-[0_0_22px_rgba(99,102,241,0.2)]',
    },
  },
};

function resolveVisualState(
  connection: ConnectionMode,
  isConnected: boolean,
  latencyMs: number | null,
  error: string | null,
  runtime: OptaVisualRuntimeSignals,
): OptaVisualState {
  if (connection === 'probing') return 'probing';
  if (connection === 'offline' || !isConnected) return 'offline';
  if (runtime.busy) return 'busy';
  if (runtime.degraded) return 'degraded';
  if (connection === 'wan') return 'degraded';
  if (error) return 'degraded';
  if (
    latencyMs != null &&
    latencyMs >= (runtime.latencyDegradedMs ?? DEFAULT_LATENCY_DEGRADED_MS)
  ) {
    return 'degraded';
  }
  return 'healthy';
}

function resolveMotion(
  visualState: OptaVisualState,
  runtimeMotion?: OptaMotionMode,
): OptaMotionMode {
  if (runtimeMotion) return runtimeMotion;
  if (visualState === 'offline') return 'reduced';
  if (visualState === 'probing' || visualState === 'busy') return 'active';
  return 'steady';
}

/**
 * Maps connection + optional runtime signals to a reusable visual state model.
 */
export function useOptaVisualState(
  connection?: ConnectionSnapshot,
  runtimeSignals: OptaVisualRuntimeSignals = {},
): OptaVisualStateResult {
  const busy = runtimeSignals.busy ?? false;
  const degraded = runtimeSignals.degraded ?? false;
  const latencyDegradedMs = runtimeSignals.latencyDegradedMs;
  const runtimeMotion = runtimeSignals.motion;

  return useMemo(() => {
    const normalizedConnection = connection?.connectionType ?? 'probing';
    const isConnected = connection?.isConnected ?? false;
    const latencyMs = connection?.latencyMs ?? null;
    const error = connection?.error ?? null;

    const visualState = resolveVisualState(
      normalizedConnection,
      isConnected,
      latencyMs,
      error,
      {
        busy,
        degraded,
        latencyDegradedMs,
      },
    );
    const motion = resolveMotion(visualState, runtimeMotion);
    const meta = VISUAL_META[visualState];

    return {
      connection: normalizedConnection,
      visualState,
      motion,
      label: meta.label,
      connectionLabel: CONNECTION_LABELS[normalizedConnection],
      tone: meta.tone,
      toneClassName: `${meta.tone.text} ${meta.tone.border} ${meta.tone.bg} ${meta.tone.glow}`,
      dataAttributes: {
        'data-connection': normalizedConnection,
        'data-visual-state': visualState,
        'data-opta-motion': motion,
      },
    };
  }, [connection, busy, degraded, latencyDegradedMs, runtimeMotion]);
}
