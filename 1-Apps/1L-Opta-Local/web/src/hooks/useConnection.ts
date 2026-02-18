'use client';

/**
 * Connection manager hook with LAN/WAN auto-detection.
 *
 * State machine: probing -> lan | wan | offline
 * - On mount: probe LAN first (1.5s timeout), then tunnel if configured
 * - Periodic re-probe every 30s when in 'wan' or 'offline' mode (auto-upgrade to LAN)
 * - No re-probe when in 'lan' mode (already optimal)
 * - Re-probes on visibility change (tab refocus) and online event
 * - Uses navigator.onLine as quick pre-check before probing
 */

import { useReducer, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  type ConnectionSettings,
  type ConnectionType,
  type ConnectionProbeResult,
  getOptimalBaseUrl,
  getActiveUrl,
  createClientWithUrl,
} from '@/lib/connection';
import { LMXClient } from '@/lib/lmx-client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Extended connection mode including the initial probing state */
export type ConnectionMode = 'probing' | ConnectionType;

interface ConnectionState {
  mode: ConnectionMode;
  latencyMs: number | null;
  error: string | null;
}

type ConnectionAction =
  | { type: 'PROBE_START' }
  | { type: 'LAN_OK'; latencyMs: number }
  | { type: 'WAN_OK'; latencyMs: number }
  | { type: 'ALL_FAILED'; error: string }
  | { type: 'DISCONNECTED' };

/** Public return type of useConnection */
export interface UseConnectionReturn {
  /** Current connection mode: 'probing' | 'lan' | 'wan' | 'offline' */
  connectionType: ConnectionMode;
  /** Active base URL for API calls */
  baseUrl: string;
  /** Whether the server is reachable (LAN or WAN) */
  isConnected: boolean;
  /** Last measured latency in milliseconds, null if unknown */
  latencyMs: number | null;
  /** Error message if connection failed, null otherwise */
  error: string | null;
  /** Trigger an immediate connection re-check */
  recheckNow: () => void;
  /** Configured LMXClient instance using the active URL */
  client: LMXClient;
  /** Admin key for authenticated endpoints (SSE, admin API) */
  adminKey: string;
}

// ---------------------------------------------------------------------------
// Reducer (state machine)
// ---------------------------------------------------------------------------

const initialState: ConnectionState = {
  mode: 'probing',
  latencyMs: null,
  error: null,
};

function connectionReducer(
  state: ConnectionState,
  action: ConnectionAction,
): ConnectionState {
  switch (action.type) {
    case 'PROBE_START':
      return { ...state, mode: 'probing', error: null };
    case 'LAN_OK':
      return { mode: 'lan', latencyMs: action.latencyMs, error: null };
    case 'WAN_OK':
      return { mode: 'wan', latencyMs: action.latencyMs, error: null };
    case 'ALL_FAILED':
      return { mode: 'offline', latencyMs: null, error: action.error };
    case 'DISCONNECTED':
      return { ...state, mode: 'probing' };
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Re-probe interval when not on LAN (30 seconds) */
const REPROBE_INTERVAL_MS = 30_000;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useConnection(settings: ConnectionSettings): UseConnectionReturn {
  const [state, dispatch] = useReducer(connectionReducer, initialState);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const settingsRef = useRef(settings);

  // Keep settings ref current to avoid stale closures in probe
  settingsRef.current = settings;

  const probe = useCallback(async () => {
    // Quick pre-check: if browser reports offline, skip network probing
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      dispatch({ type: 'ALL_FAILED', error: 'Browser reports offline' });
      return;
    }

    dispatch({ type: 'PROBE_START' });

    const result: ConnectionProbeResult | null = await getOptimalBaseUrl(
      settingsRef.current,
    );

    if (!result) {
      dispatch({
        type: 'ALL_FAILED',
        error: 'Server unreachable via LAN and WAN',
      });
      return;
    }

    switch (result.type) {
      case 'lan':
        dispatch({ type: 'LAN_OK', latencyMs: result.latencyMs });
        break;
      case 'wan':
        dispatch({ type: 'WAN_OK', latencyMs: result.latencyMs });
        break;
      default:
        dispatch({
          type: 'ALL_FAILED',
          error: 'Server unreachable via LAN and WAN',
        });
    }
  }, []);

  // Initial probe on mount
  useEffect(() => {
    probe();
  }, [probe]);

  // Periodic re-probe when NOT on LAN (auto-upgrade back to LAN when available)
  useEffect(() => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Only re-probe when not on LAN (wan or offline need periodic checks)
    if (state.mode === 'wan' || state.mode === 'offline') {
      intervalRef.current = setInterval(probe, REPROBE_INTERVAL_MS);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [state.mode, probe]);

  // Re-probe on visibility change (tab refocus, lid open) and online event
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        probe();
      }
    };
    const handleOnline = () => {
      probe();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('online', handleOnline);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', handleOnline);
    };
  }, [probe]);

  // Derive the active base URL from connection state
  const baseUrl = useMemo(() => {
    if (state.mode === 'wan' || state.mode === 'offline' || state.mode === 'probing') {
      return getActiveUrl(
        settings,
        state.mode === 'wan' ? 'wan' : 'lan',
      );
    }
    return getActiveUrl(settings, 'lan');
  }, [settings, state.mode]);

  // Create a memoized LMXClient that updates when URL or key changes
  const client = useMemo(
    () => createClientWithUrl(baseUrl, settings.adminKey),
    [baseUrl, settings.adminKey],
  );

  const isConnected = state.mode === 'lan' || state.mode === 'wan';

  return {
    connectionType: state.mode,
    baseUrl,
    isConnected,
    latencyMs: state.latencyMs,
    error: state.error,
    recheckNow: probe,
    client,
    adminKey: settings.adminKey,
  };
}
