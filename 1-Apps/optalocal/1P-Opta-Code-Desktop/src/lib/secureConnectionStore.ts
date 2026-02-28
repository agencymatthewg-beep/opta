type TauriInvoke = (
  command: string,
  args?: Record<string, unknown>,
) => Promise<unknown>;

interface TauriBridge {
  core?: {
    invoke?: TauriInvoke;
  };
}

function getTauriInvoke(): TauriInvoke | null {
  const maybeBridge = (globalThis as { __TAURI__?: TauriBridge }).__TAURI__;
  const maybeInvoke = maybeBridge?.core?.invoke;
  return typeof maybeInvoke === "function" ? maybeInvoke : null;
}

export function isSecureConnectionStoreAvailable(): boolean {
  return getTauriInvoke() !== null;
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
