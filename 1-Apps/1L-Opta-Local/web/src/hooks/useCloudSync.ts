/**
 * useCloudSync — Manages cloud sync lifecycle.
 *
 * Handles initial pull of remote sessions, tracks sync state,
 * and provides the one-time local-to-cloud migration on first sign-in.
 */

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuthSafe } from '@/components/shared/AuthProvider';
import { pullRemoteSessions, pushAllLocalSessions } from '@/lib/cloud-sync';

interface UseCloudSyncReturn {
  /** Whether initial sync (pull) has completed */
  hasSynced: boolean;
  /** Whether sync is currently in progress */
  isSyncing: boolean;
  /** Number of sessions imported from cloud on last pull */
  lastImportCount: number;
  /** Whether the one-time migration has been performed */
  hasMigrated: boolean;
  /** Trigger a manual pull from cloud */
  pullNow: () => Promise<void>;
  /** Run the one-time local-to-cloud migration */
  migrateLocalToCloud: (deviceId: string | null) => Promise<number>;
}

const MIGRATION_KEY = 'opta-local:cloud-migration-done';

export function useCloudSync(): UseCloudSyncReturn {
  const auth = useAuthSafe();
  const [hasSynced, setHasSynced] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastImportCount, setLastImportCount] = useState(0);
  const [hasMigrated, setHasMigrated] = useState(false);
  const didInitialSync = useRef(false);

  // Check migration status on mount
  useEffect(() => {
    if (auth?.user) {
      const key = `${MIGRATION_KEY}:${auth.user.id}`;
      setHasMigrated(localStorage.getItem(key) === 'true');
    }
  }, [auth?.user]);

  // Initial pull on sign-in
  useEffect(() => {
    if (!auth?.supabase || !auth.user || didInitialSync.current) return;
    didInitialSync.current = true;

    const pull = async () => {
      setIsSyncing(true);
      try {
        const count = await pullRemoteSessions(auth.supabase);
        setLastImportCount(count);
        setHasSynced(true);
      } catch {
        console.warn('[cloud-sync] Initial pull failed');
      } finally {
        setIsSyncing(false);
      }
    };

    pull();
  }, [auth?.supabase, auth?.user]);

  const pullNow = useCallback(async () => {
    if (!auth?.supabase || !auth.user) return;
    setIsSyncing(true);
    try {
      const count = await pullRemoteSessions(auth.supabase);
      setLastImportCount(count);
    } catch {
      console.warn('[cloud-sync] Manual pull failed');
    } finally {
      setIsSyncing(false);
    }
  }, [auth?.supabase, auth?.user]);

  const migrateLocalToCloud = useCallback(
    async (deviceId: string | null): Promise<number> => {
      if (!auth?.supabase || !auth.user) return 0;
      setIsSyncing(true);
      try {
        const count = await pushAllLocalSessions(
          auth.supabase,
          auth.user.id,
          deviceId,
        );
        // Mark migration complete
        const key = `${MIGRATION_KEY}:${auth.user.id}`;
        localStorage.setItem(key, 'true');
        setHasMigrated(true);
        return count;
      } catch {
        console.warn('[cloud-sync] Migration failed');
        return 0;
      } finally {
        setIsSyncing(false);
      }
    },
    [auth?.supabase, auth?.user],
  );

  return {
    hasSynced,
    isSyncing,
    lastImportCount,
    hasMigrated,
    pullNow,
    migrateLocalToCloud,
  };
}
