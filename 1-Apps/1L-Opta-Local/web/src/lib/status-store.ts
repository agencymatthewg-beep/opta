'use client';

/**
 * Global live-status store — bridges SSE-derived status from the dashboard
 * page to any component (e.g. StatusStrip) without polling.
 *
 * Uses React 18+ `useSyncExternalStore` for tear-free reads.
 * The dashboard page calls `publishLiveStatus` on every SSE status event
 * and `clearLiveStatus` on unmount so non-dashboard pages know to fall back
 * to polling.
 */

import { useSyncExternalStore } from 'react';
import type { ServerStatus } from '@/types/lmx';

// ---------------------------------------------------------------------------
// Module-level store
// ---------------------------------------------------------------------------

let current: ServerStatus | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

/** Called by the dashboard SSE handler to share status globally. */
export function publishLiveStatus(status: ServerStatus): void {
  current = status;
  emit();
}

/** Called when the dashboard unmounts to clear stale data. */
export function clearLiveStatus(): void {
  current = null;
  emit();
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

/**
 * Subscribe to SSE-derived server status. Returns `null` when the dashboard
 * page is not mounted — consumers should fall back to polling in that case.
 */
export function useLiveStatus(): ServerStatus | null {
  return useSyncExternalStore(
    (callback) => {
      listeners.add(callback);
      return () => {
        listeners.delete(callback);
      };
    },
    () => current,
    () => null, // server snapshot (SSR)
  );
}
