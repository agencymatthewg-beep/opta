'use client';

/**
 * ConnectionProvider — Global connection context.
 *
 * Loads connection settings from encrypted localStorage on mount,
 * then uses the useConnection hook to probe LAN/WAN/offline.
 * Provides connection state and client to all descendants.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react';
import {
  type ConnectionSettings,
  DEFAULT_SETTINGS,
  getConnectionSettings,
  CONNECTION_SETTINGS_UPDATED_EVENT,
} from '@/lib/connection';
import { useConnection, type UseConnectionReturn } from '@/hooks/useConnection';

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
// Public provider (handles async settings load)
// ---------------------------------------------------------------------------

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<ConnectionSettings | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      try {
        const s = await getConnectionSettings();
        if (!cancelled) setSettings(s);
      } catch {
        // Fall back to defaults if storage read fails
        if (!cancelled) setSettings(DEFAULT_SETTINGS);
      }
    }

    const handleSettingsUpdated = () => {
      void loadSettings();
    };

    const handleStorage = (event: StorageEvent) => {
      if (!event.key || event.key.startsWith('opta-local:')) {
        void loadSettings();
      }
    };

    void loadSettings();
    window.addEventListener(
      CONNECTION_SETTINGS_UPDATED_EVENT,
      handleSettingsUpdated,
    );
    window.addEventListener('storage', handleStorage);

    return () => {
      cancelled = true;
      window.removeEventListener(
        CONNECTION_SETTINGS_UPDATED_EVENT,
        handleSettingsUpdated,
      );
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  // While settings are loading, render children without connection context
  // (ConnectionBadge will show probing state)
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
