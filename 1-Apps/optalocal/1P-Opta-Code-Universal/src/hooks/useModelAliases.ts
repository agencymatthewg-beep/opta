import { useCallback, useEffect, useState } from "react";
import { daemonClient } from "../lib/daemonClient";
import type { DaemonConnectionOptions, ModelAlias, ModelHealthCheck, ModelLibraryEntry } from "../types";

export interface UseModelAliasesState {
  aliases: ModelAlias[];
  health: ModelHealthCheck[];
  library: ModelLibraryEntry[];
  loading: boolean;
  libraryLoading: boolean;
  healthLoading: boolean;
  saving: boolean;
  error: string | null;
  refreshAliases: () => Promise<void>;
  refreshHealth: () => Promise<void>;
  searchLibrary: (query?: string, limit?: number) => Promise<void>;
  setAlias: (alias: string, target: string, provider?: string) => Promise<void>;
  deleteAlias: (alias: string) => Promise<void>;
}

export function useModelAliases(connection: DaemonConnectionOptions): UseModelAliasesState {
  const [aliases, setAliases] = useState<ModelAlias[]>([]);
  const [health, setHealth] = useState<ModelHealthCheck[]>([]);
  const [library, setLibrary] = useState<ModelLibraryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [healthLoading, setHealthLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshAliases = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await daemonClient.modelAliasesList(connection);
      setAliases(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [connection]);

  const refreshHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      const list = await daemonClient.modelsHealth(connection);
      setHealth(list);
    } catch {
      // Health check failure is non-fatal
    } finally {
      setHealthLoading(false);
    }
  }, [connection]);

  const searchLibrary = useCallback(
    async (query?: string, limit = 20) => {
      setLibraryLoading(true);
      try {
        const list = await daemonClient.modelsBrowseLibrary(connection, query, limit);
        setLibrary(list);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLibraryLoading(false);
      }
    },
    [connection],
  );

  useEffect(() => {
    void refreshAliases();
  }, [refreshAliases]);

  const setAlias = useCallback(
    async (alias: string, target: string, provider?: string) => {
      setSaving(true);
      setError(null);
      try {
        await daemonClient.modelAliasSet(connection, alias, target, provider);
        await refreshAliases();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setSaving(false);
      }
    },
    [connection, refreshAliases],
  );

  const deleteAlias = useCallback(
    async (alias: string) => {
      setSaving(true);
      setError(null);
      try {
        await daemonClient.modelAliasDelete(connection, alias);
        setAliases((prev) => prev.filter((a) => a.alias !== alias));
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setSaving(false);
      }
    },
    [connection],
  );

  return { aliases, health, library, loading, libraryLoading, healthLoading, saving, error, refreshAliases, refreshHealth, searchLibrary, setAlias, deleteAlias };
}
