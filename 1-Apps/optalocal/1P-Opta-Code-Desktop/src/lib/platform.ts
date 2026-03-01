type TauriInvoke = (
  command: string,
  args?: Record<string, unknown>,
) => Promise<unknown>;

function getTauriInvoke(): TauriInvoke | null {
  const bridge = (
    globalThis as { __TAURI__?: { core?: { invoke?: TauriInvoke } } }
  ).__TAURI__;
  const fn_ = bridge?.core?.invoke;
  return typeof fn_ === "function" ? fn_ : null;
}

export type Platform = "macos" | "windows" | "linux";

export async function getPlatform(): Promise<Platform> {
  const invoke = getTauriInvoke();
  if (invoke) {
    try {
      return (await invoke("get_platform")) as Platform;
    } catch {
      // fall through to UA detection
    }
  }
  // Browser / dev-mode fallback via navigator.userAgent
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("win")) return "windows";
  if (ua.includes("mac") || ua.includes("darwin")) return "macos";
  return "linux";
}
