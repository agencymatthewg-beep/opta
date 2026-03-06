import type { DaemonRunOperationResponse } from "@opta/daemon-client/types";
import { daemonClient } from "../daemonClient";
import type { DaemonConnectionOptions } from "../../types";

export type TauriInvoke = (
  command: string,
  args?: Record<string, unknown>,
) => Promise<unknown>;

interface TauriBridge {
  core?: {
    invoke?: TauriInvoke;
  };
}

export function getTauriInvoke(): TauriInvoke | null {
  const bridge = (globalThis as { __TAURI__?: TauriBridge }).__TAURI__;
  const invoke = bridge?.core?.invoke;
  return typeof invoke === "function" ? invoke : null;
}

export function isNativeDesktop(): boolean {
  return getTauriInvoke() !== null;
}

export async function invokeNative<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  const invoke = getTauriInvoke();
  if (!invoke) {
    throw new Error("Tauri bridge unavailable in web runtime");
  }
  return (await invoke(command, args)) as T;
}

export interface AccountOperationError extends Error {
  code?: string;
  details?: unknown;
}

const OAUTH_BROWSER_LOGIN_INPUT: Record<string, unknown> = {
  oauth: true,
  timeout: 600,
  returnTo: "opta-code://auth/callback",
};

function unwrapOperationResponse(
  operationId: string,
  response: DaemonRunOperationResponse,
): unknown {
  if (response.ok) {
    return response.result;
  }
  const error = new Error(
    `[${response.error.code}] ${response.error.message}`,
  ) as AccountOperationError;
  error.code = response.error.code;
  error.details = response.error.details;
  throw error;
}

export async function runAccountBrowserLogin(
  connection: DaemonConnectionOptions,
): Promise<{ authResult: unknown; statusResult: unknown }> {
  // In native Tauri mode, use the PKCE OAuth flow directly — no daemon dependency.
  // The OAuth URL is opened in the system browser; the session arrives via deep link
  // (opta-code://auth/callback) and is exchanged in useAccountsAuthControls.
  if (isNativeDesktop()) {
    const { startNativeOAuthFlow } = await import("../auth");
    await startNativeOAuthFlow("google");
    // Session delivery is async (deep link fires later); return placeholder.
    return { authResult: { status: "oauth_pending" }, statusResult: null };
  }

  // Web mode fallback: relay through daemon (requires CLI to be installed).
  const loginResponse = await daemonClient.runOperation(
    connection,
    "account.login",
    { input: OAUTH_BROWSER_LOGIN_INPUT },
  );
  const authResult = unwrapOperationResponse("account.login", loginResponse);
  const statusResponse = await daemonClient.runOperation(
    connection,
    "account.status",
  );
  const statusResult = unwrapOperationResponse("account.status", statusResponse);
  return { authResult, statusResult };
}

export async function fetchAccountStatus(
  connection: DaemonConnectionOptions,
): Promise<unknown> {
  const response = await daemonClient.runOperation(
    connection,
    "account.status",
  );
  return unwrapOperationResponse("account.status", response);
}
