import { useCallback } from "react";
import type { DaemonConnectionOptions } from "../types";
import {
  fetchAccountStatus,
  runAccountBrowserLogin,
} from "../lib/runtime/index";
import { useAuthDeepLinkListener } from "../lib/runtime/deepLinks";

export interface AccountsAuthControlsOptions {
  connection: DaemonConnectionOptions;
  onNotice?: (message: string) => void;
}

export function useAccountsAuthControls({
  connection,
  onNotice,
}: AccountsAuthControlsOptions): { handleAccountsLogin: () => Promise<void> } {
  const handleAccountsLogin = useCallback(async () => {
    try {
      onNotice?.("Opening Opta Accounts in your browser…");
      await runAccountBrowserLogin(connection);
      onNotice?.("Login complete. Account status refreshed.");
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Unknown error during login.";
      onNotice?.(`Accounts login failed: ${errorMessage}`);
    }
  }, [connection, onNotice]);

  useAuthDeepLinkListener({
    notify: (message) => onNotice?.(message),
    onAuthCallback: async (url: string) => {
      try {
        await fetchAccountStatus(connection);
        onNotice?.("Opta Account linked successfully.");
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Refresh failed.";
        onNotice?.(`Account refresh failed: ${errorMessage}`);
      }
    },
  });

  return { handleAccountsLogin };
}
