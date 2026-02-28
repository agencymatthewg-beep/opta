'use client';

/**
 * ConnectionProvider — Global connection context.
 *
 * Resolves LMX connection settings using a priority chain:
 *   1. Supabase user_settings (cross-device sync, authenticated users)
 *   2. Daemon handshake at 127.0.0.1:9999 (zero-config local discovery)
 *   3. Encrypted localStorage (existing per-device fallback)
 *
 * If daemon discovers settings and the user is authenticated, the daemon
 * config is saved to Supabase for cross-device sync.
 *
 * After initial resolution, listens for localStorage updates from the
 * Settings page and re-reads settings on change.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import {
  type ConnectionSettings,
  DEFAULT_SETTINGS,
  getConnectionSettings,
  CONNECTION_SETTINGS_UPDATED_EVENT,
} from '@/lib/connection';
import { useConnection, type UseConnectionReturn } from '@/hooks/useConnection';
import { useAuth } from '@/components/shared/AuthProvider';
import { getUserSettings, saveUserSettings } from '@/lib/supabase/settings';
import { fetchDaemonConfig } from '@/lib/daemon-handshake';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const ConnectionContext = createContext<UseConnectionReturn | null>(null);

/** Access connection state from any descendant. Returns null while settings are loading. */
export function useConnectionContextSafe(): UseConnectionReturn | null {
  return useContext(ConnectionContext);
}

/** Access connection state from any descendant. Throws if used outside loaded provider. */
export function useConnectionContext(): UseConnectionReturn {
  const ctx = useContext(ConnectionContext);
  if (!ctx) {
    throw new Error(
      'useConnectionContext must be used within a loaded ConnectionProvider',
    );
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// Internal wrapper that uses the hook after settings are loaded
// ---------------------------------------------------------------------------

function ConnectionProviderInner({
  settings,
  children,
}: {
  settings: ConnectionSettings;
  children: ReactNode;
}) {
  const connection = useConnection(settings);

  return (
    <ConnectionContext.Provider value={connection}>
      {children}
    </ConnectionContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Public provider (resolves settings via priority chain)
// ---------------------------------------------------------------------------

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const [settings, setSettings] = useState<ConnectionSettings | null>(null);
  const didInitialResolve = useRef(false);

  // ---- Initial settings resolution (priority chain) ----
  useEffect(() => {
    if (authLoading) return;
    if (didInitialResolve.current) return;
    didInitialResolve.current = true;

    let cancelled = false;

    async function resolveSettings() {
      // Priority 1: Supabase user settings (cross-device)
      if (user) {
        try {
          const cloud = await getUserSettings();
          if (cloud && !cancelled) {
            // Merge cloud settings with local admin key (stays per-device)
            const local = await getConnectionSettings();
            setSettings({
              host: cloud.lmx_host,
              port: cloud.lmx_port,
              adminKey: local.adminKey,
              useTunnel: cloud.use_tunnel,
              tunnelUrl: cloud.tunnel_url ?? '',
            });
            return;
          }
        } catch {
          // Supabase fetch failed — fall through to daemon
        }
      }

      // Priority 2: Daemon handshake (zero-config local discovery)
      try {
        const daemon = await fetchDaemonConfig();
        if (daemon && !cancelled) {
          const resolved: ConnectionSettings = {
            host: daemon.lmx_host,
            port: daemon.lmx_port,
            adminKey: daemon.admin_key ?? '',
            useTunnel: false,
            tunnelUrl: daemon.tunnel_url ?? '',
          };
          setSettings(resolved);

          // Persist daemon-discovered config to Supabase (non-blocking)
          if (user) {
            void saveUserSettings({
              lmx_host: resolved.host,
              lmx_port: resolved.port,
              tunnel_url: resolved.tunnelUrl || null,
              use_tunnel: resolved.useTunnel,
            });
          }
          return;
        }
      } catch {
        // Daemon not running — fall through to localStorage
      }

      // Priority 3: Encrypted localStorage defaults
      try {
        const local = await getConnectionSettings();
        if (!cancelled) setSettings(local);
      } catch {
        if (!cancelled) setSettings(DEFAULT_SETTINGS);
      }
    }

    void resolveSettings();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  // ---- Listen for manual setting changes (Settings page writes to localStorage) ----
  useEffect(() => {
    async function reloadFromStorage() {
      try {
        const s = await getConnectionSettings();
        setSettings(s);
      } catch {
        setSettings(DEFAULT_SETTINGS);
      }
    }

    const handleSettingsUpdated = () => {
      void reloadFromStorage();
    };

    const handleStorage = (event: StorageEvent) => {
      if (!event.key || event.key.startsWith('opta-local:')) {
        void reloadFromStorage();
      }
    };

    window.addEventListener(
      CONNECTION_SETTINGS_UPDATED_EVENT,
      handleSettingsUpdated,
    );
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener(
        CONNECTION_SETTINGS_UPDATED_EVENT,
        handleSettingsUpdated,
      );
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  // While settings are loading, render children without connection context
  if (!settings) {
    return (
      <ConnectionContext.Provider value={null}>
        {children}
      </ConnectionContext.Provider>
    );
  }

  return (
    <ConnectionProviderInner settings={settings}>
      {children}
    </ConnectionProviderInner>
  );
}
