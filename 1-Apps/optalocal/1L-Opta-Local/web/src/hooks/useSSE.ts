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

  // Stable callback refs: callbacks are updated on every render so callers
  // never need to memoize them, but they don't cause connect() to be recreated
  // (which would abort and restart the SSE connection on every render).
  const onMessageRef = useRef(onMessage);
  const onErrorRef = useRef(onError);
  useEffect(() => { onMessageRef.current = onMessage; });
  useEffect(() => { onErrorRef.current = onError; });

  // Serialize headers to a stable string so the connection only restarts when
  // the header *values* change, not when the object reference changes.
  const headersKey = JSON.stringify(headers ?? {});
  const headersRef = useRef(headers);
  useEffect(() => { headersRef.current = headers; }, [headersKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const connect = useCallback(async () => {
    // Abort any existing connection before starting a new one
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setConnectionState('connecting');

    await fetchEventSource(url, {
      headers: headersRef.current,
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
          onMessageRef.current(data);
        } catch {
          // Skip malformed JSON — do not crash the connection
        }
      },

      onerror(err) {
        setConnectionState('error');
        retriesRef.current++;

        if (retriesRef.current >= maxRetries) {
          ctrl.abort();
          onErrorRef.current?.(
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
    // Intentionally excludes onMessage/onError (stable refs) and headersRef
    // (stable ref updated from headersKey). Connection restarts only when the
    // URL, header content, or timing constants change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, headersKey, retryInterval, maxRetries]);

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
