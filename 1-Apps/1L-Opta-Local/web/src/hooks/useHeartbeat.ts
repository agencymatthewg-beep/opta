'use client';

/**
 * useHeartbeat — Lightweight connection health monitor.
 *
 * Pings GET /admin/status every 10 seconds while enabled.
 * Tracks consecutive failures and latency. After 3 consecutive
 * failures, isHealthy transitions to false, triggering the
 * reconnection banner before the SSE error timeout fires.
 *
 * Uses useRef for the interval ID to avoid stale closures,
 * and AbortController with a 3-second timeout per ping.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HeartbeatState {
  consecutiveFailures: number;
  lastPingMs: number | null;
  isHealthy: boolean;
}

interface UseHeartbeatOptions {
  /** LMX server base URL (e.g. "http://192.168.188.11:8000") */
  baseUrl: string;
  /** Admin key for authenticated endpoints */
  adminKey: string;
  /** Whether heartbeat pinging is active (should be true during SSE sessions) */
  enabled: boolean;
}

interface UseHeartbeatReturn {
  /** Whether the server is responding to pings (false after 3 consecutive failures) */
  isHealthy: boolean;
  /** Number of consecutive ping failures (0 when healthy) */
  consecutiveFailures: number;
  /** Last successful ping round-trip time in ms, or null if never pinged */
  lastPingMs: number | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Ping interval in milliseconds */
const PING_INTERVAL_MS = 10_000;

/** Abort fetch after this many milliseconds */
const PING_TIMEOUT_MS = 3_000;

/** Number of consecutive failures before marking unhealthy */
const FAILURE_THRESHOLD = 3;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useHeartbeat({
  baseUrl,
  adminKey,
  enabled,
}: UseHeartbeatOptions): UseHeartbeatReturn {
  const [state, setState] = useState<HeartbeatState>({
    consecutiveFailures: 0,
    lastPingMs: null,
    isHealthy: true,
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Keep latest values in refs to avoid stale closures in the interval callback
  const baseUrlRef = useRef(baseUrl);
  const adminKeyRef = useRef(adminKey);

  baseUrlRef.current = baseUrl;
  adminKeyRef.current = adminKey;

  const ping = useCallback(async () => {
    const url = baseUrlRef.current;
    if (!url) return;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
    const start = performance.now();

    try {
      const headers: Record<string, string> = {};
      if (adminKeyRef.current) {
        headers['X-Admin-Key'] = adminKeyRef.current;
      }

      const response = await fetch(`${url}/admin/status`, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const latency = Math.round(performance.now() - start);
        setState({
          consecutiveFailures: 0,
          lastPingMs: latency,
          isHealthy: true,
        });
      } else {
        // Non-OK response counts as failure
        setState((prev) => {
          const failures = prev.consecutiveFailures + 1;
          return {
            ...prev,
            consecutiveFailures: failures,
            isHealthy: failures < FAILURE_THRESHOLD,
          };
        });
      }
    } catch {
      clearTimeout(timeoutId);
      setState((prev) => {
        const failures = prev.consecutiveFailures + 1;
        return {
          ...prev,
          consecutiveFailures: failures,
          isHealthy: failures < FAILURE_THRESHOLD,
        };
      });
    }
  }, []);

  // Start/stop the heartbeat interval based on enabled flag
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (enabled) {
      // Ping immediately on enable, then every PING_INTERVAL_MS
      void ping();
      intervalRef.current = setInterval(() => {
        void ping();
      }, PING_INTERVAL_MS);
    } else {
      // Reset state when disabled
      setState({
        consecutiveFailures: 0,
        lastPingMs: null,
        isHealthy: true,
      });
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, ping]);

  return {
    isHealthy: state.isHealthy,
    consecutiveFailures: state.consecutiveFailures,
    lastPingMs: state.lastPingMs,
  };
}
