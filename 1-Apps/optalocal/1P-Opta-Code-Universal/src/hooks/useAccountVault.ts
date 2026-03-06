import { useCallback, useEffect, useState } from "react";
import { daemonClient } from "../lib/daemonClient";
import type { AccountStatus, DaemonConnectionOptions, KeychainStatus, VaultStatus } from "../types";

export interface UseAccountVaultState {
  account: AccountStatus | null;
  vault: VaultStatus | null;
  keychain: KeychainStatus | null;
  loading: boolean;
  syncing: boolean;
  actionRunning: boolean;
  error: string | null;
  successMessage: string | null;
  refresh: () => Promise<void>;
  login: (options?: { provider?: string; token?: string }) => Promise<{ url?: string } | null>;
  logout: () => Promise<void>;
  pullVault: () => Promise<void>;
  pushVault: () => Promise<void>;
  refreshKeychain: () => Promise<void>;
}

export function useAccountVault(connection: DaemonConnectionOptions): UseAccountVaultState {
  const [account, setAccount] = useState<AccountStatus | null>(null);
  const [vault, setVault] = useState<VaultStatus | null>(null);
  const [keychain, setKeychain] = useState<KeychainStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [actionRunning, setActionRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const clearMessages = () => {
    setError(null);
    setSuccessMessage(null);
  };

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [accountData, vaultData, keychainData] = await Promise.allSettled([
        daemonClient.accountStatus(connection),
        daemonClient.vaultStatus(connection),
        daemonClient.keychainStatus(connection),
      ]);
      if (accountData.status === "fulfilled") setAccount(accountData.value);
      if (vaultData.status === "fulfilled") setVault(vaultData.value);
      if (keychainData.status === "fulfilled") setKeychain(keychainData.value);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [connection]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const refreshKeychain = useCallback(async () => {
    try {
      const keychainData = await daemonClient.keychainStatus(connection);
      setKeychain(keychainData);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [connection]);

  const login = useCallback(
    async (options?: { provider?: string; token?: string }) => {
      setActionRunning(true);
      clearMessages();
      try {
        const result = await daemonClient.accountLogin(connection, options);
        if (result.success) {
          await refresh();
          setSuccessMessage("Logged in successfully.");
        }
        return result;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return null;
      } finally {
        setActionRunning(false);
      }
    },
    [connection, refresh],
  );

  const logout = useCallback(async () => {
    setActionRunning(true);
    clearMessages();
    try {
      await daemonClient.accountLogout(connection);
      await refresh();
      setSuccessMessage("Logged out successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setActionRunning(false);
    }
  }, [connection, refresh]);

  const pullVault = useCallback(async () => {
    setSyncing(true);
    clearMessages();
    try {
      const result = await daemonClient.vaultPull(connection);
      setSuccessMessage(`Vault synced — ${result.applied} keys applied.`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSyncing(false);
    }
  }, [connection, refresh]);

  const pushVault = useCallback(async () => {
    setSyncing(true);
    clearMessages();
    try {
      const result = await daemonClient.vaultPushRules(connection);
      setSuccessMessage(`Vault rules pushed — ${result.pushed} rules uploaded.`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSyncing(false);
    }
  }, [connection, refresh]);

  return { account, vault, keychain, loading, syncing, actionRunning, error, successMessage, refresh, login, logout, pullVault, pushVault, refreshKeychain };
}
