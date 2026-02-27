'use client';

/**
 * useBufferedState — Batched state updates for high-frequency data.
 *
 * Stores the latest value in a useRef (no re-renders on update),
 * then flushes the ref to useState on a fixed interval (default 500ms).
 * This prevents re-render storms from SSE events arriving at 10-50Hz.
 *
 * Usage:
 *   const [status, pushStatus] = useBufferedState<ServerStatus | null>(null, 500);
 *   // In SSE handler:
 *   pushStatus(() => newStatus);
 *   // Component re-renders at most every 500ms with the latest value
 */

import { useRef, useState, useEffect, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * @param initialState - Initial state value
 * @param intervalMs - Flush interval in milliseconds (default 500)
 * @returns [state, push] where push takes an updater function (prev: T) => T
 */
export function useBufferedState<T>(
  initialState: T,
  intervalMs = 500,
): readonly [T, (updater: (prev: T) => T) => void] {
  const [state, setState] = useState<T>(initialState);
  const bufferRef = useRef<T>(initialState);

  // Update buffer without triggering a re-render
  const push = useCallback((updater: (prev: T) => T) => {
    bufferRef.current = updater(bufferRef.current);
  }, []);

  // Flush buffer to state on a fixed interval
  useEffect(() => {
    const id = setInterval(() => {
      setState(bufferRef.current);
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return [state, push] as const;
}
