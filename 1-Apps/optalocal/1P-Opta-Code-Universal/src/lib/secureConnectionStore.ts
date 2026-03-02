import { getTauriInvoke, isNativeDesktop } from "./runtime";

export interface DaemonConnectionMetadata {
  host: string;
  port: number;
  pid?: number;
  startedAt?: string;
  daemonId?: string;
  logsPath?: string;
}

export function isSecureConnectionStoreAvailable(): boolean {
  return isNativeDesktop();
}

export async function loadToken(host: string, port: number): Promise<string> {
  const invoke = getTauriInvoke();
  if (!invoke) return "";
  const result = await invoke("get_connection_secret", { host, port });
  return typeof result === "string" ? result : "";
}

export async function saveToken(
  host: string,
  port: number,
  token: string,
): Promise<void> {
  const invoke = getTauriInvoke();
  if (!invoke) return;
  await invoke("set_connection_secret", { host, port, token });
}

export async function clearToken(host: string, port: number): Promise<void> {
  const invoke = getTauriInvoke();
  if (!invoke) return;
  await invoke("delete_connection_secret", { host, port });
}

export async function bootstrapDaemonConnection(
  startIfNeeded = false,
): Promise<DaemonConnectionMetadata | null> {
  const invoke = getTauriInvoke();
  if (!invoke) return null;
  const result = await invoke("bootstrap_daemon_connection", { startIfNeeded });
  if (!result || typeof result !== "object") return null;
  return result as DaemonConnectionMetadata;
}
