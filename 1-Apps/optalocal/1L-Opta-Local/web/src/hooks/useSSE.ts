'use client';

/**
 * useSSE — Generic SSE hook wrapping @microsoft/fetch-event-source.
 *
 * Provides auto-reconnect with exponential backoff + jitter,
 * AbortController-based cleanup, and connection state tracking.
 * Page Visibility API handling is built into fetch-event-source
 * (pauses on tab hide, reconnects on show).
 *
 * IMPORTANT: Uses fetch-event-source instead of native EventSource
 * because EventSource cannot send custom headers (X-Admin-Key would
 * be exposed in URL query params).
 */

import { fetchEventSource } from '@microsoft/fetch-event-source';
import { useRef, useCallback, useState, useEffect } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ConnectionState = 'connecting' | 'open' | 'closed' | 'error';

export interface UseSSEOptions<T> {
  /** SSE endpoint URL */
  url: string;
  /** Custom headers (e.g. { 'X-Admin-Key': '...' }) */
  headers?: Record<string, string>;
  /** Callback fired for each parsed SSE message */
  onMessage: (data: T) => void;
  /** Callback fired on connection error */
  onError?: (error: Error) => void;
  /** Whether the connection should be active (default true) */
  enabled?: boolean;
  /** Base retry interval in ms (default 3000) */
  retryInterval?: number;
  /** Maximum number of reconnection attempts (default 10) */
  maxRetries?: number;
}

export interface UseSSEReturn {
  /** Current connection state */
  connectionState: ConnectionState;
  /** Manually close the connection */
  disconnect: () => void;
  /** Manually reconnect (resets retry counter) */
  reconnect: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSSE<T>({
  url,
  headers,
  onMessage,
  onError,
  enabled = true,
  retryInterval = 3000,
  maxRetries = 10,
}: UseSSEOptions<T>): UseSSEReturn {
  const [connectionState, setConnectionState] =
    useState<ConnectionState>('closed');

  // AbortController survives re-renders without triggering them
  const abortRef = useRef<AbortController | null>(null);
  // Retry counter in useRef — mutations don't cause re-renders
  const retriesRef = useRef(0);

  const connect = useCallback(async () => {
    // Abort any existing connection before starting a new one
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setConnectionState('connecting');

    await fetchEventSource(url, {
      headers,
      signal: ctrl.signal,

      async onopen(response) {
        if (response.ok) {
          setConnectionState('open');
          retriesRef.current = 0;
        } else {
          throw new Error(`SSE connection failed: ${response.status}`);
        }
      },

      onmessage(event) {
        try {
          const data = JSON.parse(event.data) as T;
          onMessage(data);
        } catch {
          // Skip malformed JSON — do not crash the connection
        }
      },

      onerror(err) {
        setConnectionState('error');
        retriesRef.current++;

        if (retriesRef.current >= maxRetries) {
          ctrl.abort();
          onError?.(
            err instanceof Error
              ? err
              : new Error('Max SSE retries exceeded'),
          );
          // Return undefined to stop retrying
          return;
        }

        // Exponential backoff with jitter:
        // delay * 2^retries * (1 + Math.random() * 0.5), capped at 30s
        const backoff =
          retryInterval *
          Math.pow(2, retriesRef.current) *
          (1 + Math.random() * 0.5);
        return Math.min(backoff, 30_000);
      },

      onclose() {
        setConnectionState('closed');
      },
    });
  }, [url, headers, onMessage, onError, retryInterval, maxRetries]);

  // Auto-connect when enabled, cleanup on unmount or disable
  useEffect(() => {
    if (enabled) {
      void connect();
    }
    return () => {
      abortRef.current?.abort();
    };
  }, [enabled, connect]);

  const disconnect = useCallback(() => {
    abortRef.current?.abort();
    setConnectionState('closed');
  }, []);

  const reconnect = useCallback(() => {
    retriesRef.current = 0;
    void connect();
  }, [connect]);

  return { connectionState, disconnect, reconnect };
}
