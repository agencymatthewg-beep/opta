import { getTauriInvoke, isNativeDesktop } from "./runtime";

export type Platform = "macos" | "windows" | "linux";

export { isNativeDesktop };

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
