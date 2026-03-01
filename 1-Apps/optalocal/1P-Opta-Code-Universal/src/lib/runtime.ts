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
