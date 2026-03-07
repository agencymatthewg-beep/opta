/**
 * openUrl — safely open an external URL in the system default browser.
 *
 * In Tauri native builds, `target="_blank"` anchors DO NOT open in the
 * system browser by default — they try to navigate the webview itself and
 * are silently blocked by the app's CSP.  This utility intercepts that and
 * calls tauri-plugin-opener to hand off to the OS, matching how Antigravity
 * *should* handle it.
 *
 * In browser/web mode (localhost:5173 dev) it falls back to window.open().
 */
export async function openUrl(url: string): Promise<void> {
    // Basic safety guard — only http(s) URLs
    try {
        const { protocol } = new URL(url);
        if (protocol !== "http:" && protocol !== "https:") return;
    } catch {
        return;
    }

    // Check if we are inside a Tauri context
    if (typeof window !== "undefined" && "__TAURI__" in window) {
        try {
            // tauri-plugin-opener exposes openUrl via the @tauri-apps/plugin-opener package
            const { openUrl: tauriOpenUrl } = await import("@tauri-apps/plugin-opener");
            await tauriOpenUrl(url);
            return;
        } catch (e) {
            // Fallback if plugin not available
            console.warn("[openUrl] tauri-plugin-opener unavailable, falling back:", e);
        }
    }

    // Web / dev fallback
    window.open(url, "_blank", "noopener,noreferrer");
}

/**
 * openFolder — open a local filesystem path in the OS file manager.
 *
 * Uses tauri-plugin-opener's openPath in native builds.
 * No-ops gracefully in web/dev mode (path can't be opened from browser).
 */
export async function openFolder(folderPath: string): Promise<void> {
    if (!folderPath) return;

    if (typeof window !== "undefined" && "__TAURI__" in window) {
        try {
            const { openPath } = await import("@tauri-apps/plugin-opener");
            await openPath(folderPath);
            return;
        } catch (e) {
            console.warn("[openFolder] tauri-plugin-opener unavailable:", e);
        }
    }

    // Web mode: no-op — can't open local paths from a browser tab
    console.info("[openFolder] Skipped (web mode):", folderPath);
}

/**
 * handleExternalClick — onClick handler for <a> elements that should open
 * external URLs via openUrl instead of navigating the webview.
 *
 * Usage:
 *   <a href={url} onClick={handleExternalClick}>…</a>
 */
export function handleExternalClick(e: React.MouseEvent<HTMLAnchorElement>): void {
    const href = e.currentTarget.href;
    if (!href) return;
    try {
        const { protocol } = new URL(href);
        if (protocol === "http:" || protocol === "https:") {
            e.preventDefault();
            void openUrl(href);
        }
    } catch {
        // relative or malformed URL — let browser handle it
    }
}
