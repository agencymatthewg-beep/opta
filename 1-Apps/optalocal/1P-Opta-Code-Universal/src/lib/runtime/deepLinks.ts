import { useEffect } from "react";

interface TauriDeepLinkEvent {
  payload?: unknown;
}

type UnlistenFn = () => void;

interface TauriEventModule {
  listen?: (
    event: string,
    handler: (event: TauriDeepLinkEvent) => void,
  ) => Promise<UnlistenFn>;
}

interface TauriWindowBridge {
  __TAURI__?: {
    event?: TauriEventModule;
  };
}

const AUTH_CALLBACK_PREFIX = "opta-code://auth/callback";

function normalizePayload(payload: unknown): string[] {
  if (typeof payload === "string") return [payload];
  if (Array.isArray(payload)) {
    return payload.filter((value): value is string => typeof value === "string");
  }
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    if (Array.isArray(record.payload)) {
      return record.payload.filter(
        (value): value is string => typeof value === "string",
      );
    }
  }
  return [];
}

export interface AuthDeepLinkOptions {
  onAuthCallback: (url: string) => Promise<void> | void;
  notify?: (message: string) => void;
}

export function useAuthDeepLinkListener({
  onAuthCallback,
  notify,
}: AuthDeepLinkOptions): void {
  useEffect(() => {
    const bridge = (globalThis as TauriWindowBridge).__TAURI__;
    const eventApi = bridge?.event;
    const listen = eventApi?.listen;
    if (typeof listen !== "function") return;

    let disposed = false;
    let unlisten: UnlistenFn | null = null;

    listen("deep-link://new-url", async (event) => {
      for (const url of normalizePayload(event.payload)) {
        if (typeof url !== "string") continue;
        if (!url.toLowerCase().startsWith(AUTH_CALLBACK_PREFIX)) continue;
        notify?.("Auth callback received. Completing sign-in\u2026");
        try {
          await onAuthCallback(url);
        } catch {
          // Best-effort: swallow errors to avoid crashing the listener.
        }
      }
    })
      .then((fn) => {
        if (disposed) {
          fn();
        } else {
          unlisten = fn;
        }
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [onAuthCallback, notify]);
}
