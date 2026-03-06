import { useCallback, useEffect } from "react";
import type { DaemonConnectionOptions } from "../types";
import {
  fetchAccountStatus,
  runAccountBrowserLogin,
  isNativeDesktop,
} from "../lib/runtime/index";
import { useAuthDeepLinkListener } from "../lib/runtime/deepLinks";
import {
  exchangeNativeAuthCode,
  onNativeAuthStateChange,
} from "../lib/auth";

export interface AccountsAuthControlsOptions {
  connection: DaemonConnectionOptions;
  onNotice?: (message: string) => void;
  onNativeSessionChange?: (hasSession: boolean) => void;
}

export function useAccountsAuthControls({
  connection,
  onNotice,
  onNativeSessionChange,
}: AccountsAuthControlsOptions): { handleAccountsLogin: () => Promise<void> } {
  const handleAccountsLogin = useCallback(async () => {
    try {
      onNotice?.("Opening sign-in in your browser\u2026");
      await runAccountBrowserLogin(connection);
      // In native mode: session arrives via deep link, not here.
      // In web mode: login completes synchronously via daemon relay.
      if (!isNativeDesktop()) {
        onNotice?.("Login complete. Account status refreshed.");
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Unknown error during login.";
      onNotice?.(`Accounts login failed: ${errorMessage}`);
    }
  }, [connection, onNotice]);

  // Native mode: exchange PKCE code when deep link fires.
  useAuthDeepLinkListener({
    notify: (message) => onNotice?.(message),
    onAuthCallback: async (url: string) => {
      if (isNativeDesktop()) {
        try {
          await exchangeNativeAuthCode(url);
          // onAuthStateChange will fire next — handled by the subscription below.
        } catch (err) {
          const errorMessage =
            err instanceof Error ? err.message : "Code exchange failed.";
          onNotice?.(`Sign-in failed: ${errorMessage}`);
        }
      } else {
        // Web mode fallback: just refresh daemon account status.
        try {
          await fetchAccountStatus(connection);
          onNotice?.("Opta Account linked successfully.");
        } catch (err) {
          const errorMessage =
            err instanceof Error ? err.message : "Refresh failed.";
          onNotice?.(`Account refresh failed: ${errorMessage}`);
        }
      }
    },
  });

  // Native mode: subscribe to Supabase auth state for real-time session updates.
  useEffect(() => {
    if (!isNativeDesktop()) return;
    const unsub = onNativeAuthStateChange((session) => {
      const hasSession = session !== null;
      onNativeSessionChange?.(hasSession);
      if (hasSession) {
        onNotice?.("Signed in successfully.");
      }
    });
    return unsub;
  }, [onNotice, onNativeSessionChange]);

  return { handleAccountsLogin };
}
