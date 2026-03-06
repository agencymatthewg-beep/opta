import { useCallback, useEffect, useState } from "react";
import { daemonClient } from "../lib/daemonClient";
import type { DaemonConnectionOptions, EnvProfile } from "../types";

export interface UseEnvProfilesState {
  profiles: EnvProfile[];
  activeProfile: string | null;
  loading: boolean;
  error: string | null;
  saving: boolean;
  refresh: () => Promise<void>;
  saveProfile: (profile: Pick<EnvProfile, "name" | "vars" | "description">) => Promise<void>;
  deleteProfile: (name: string) => Promise<void>;
  activateProfile: (name: string) => Promise<void>;
  deactivate: () => Promise<void>;
}

export function useEnvProfiles(connection: DaemonConnectionOptions): UseEnvProfilesState {
  const [profiles, setProfiles] = useState<EnvProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await daemonClient.envList(connection);
      setProfiles(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [connection]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const saveProfile = useCallback(
    async (profile: Pick<EnvProfile, "name" | "vars" | "description">) => {
      setSaving(true);
      try {
        await daemonClient.envSave(connection, profile);
        await refresh();
      } finally {
        setSaving(false);
      }
    },
    [connection, refresh],
  );

  const deleteProfile = useCallback(
    async (name: string) => {
      setSaving(true);
      try {
        await daemonClient.envDelete(connection, name);
        await refresh();
      } finally {
        setSaving(false);
      }
    },
    [connection, refresh],
  );

  const activateProfile = useCallback(
    async (name: string) => {
      setSaving(true);
      try {
        await daemonClient.envUse(connection, name);
        await refresh();
      } finally {
        setSaving(false);
      }
    },
    [connection, refresh],
  );

  // Deactivate by switching to a built-in empty/default env
  const deactivate = useCallback(async () => {
    setSaving(true);
    try {
      await daemonClient.envUse(connection, "");
      await refresh();
    } catch {
      // env.use with empty name may not be supported — silently refresh
      await refresh();
    } finally {
      setSaving(false);
    }
  }, [connection, refresh]);

  const activeProfile = profiles.find((p) => p.isActive)?.name ?? null;

  return { profiles, activeProfile, loading, error, saving, refresh, saveProfile, deleteProfile, activateProfile, deactivate };
}
