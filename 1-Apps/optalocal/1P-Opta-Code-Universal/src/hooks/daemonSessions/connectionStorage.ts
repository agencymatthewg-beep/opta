import type { DaemonConnectionOptions } from "../../types";

export const STORAGE_KEY = "opta:daemon-connection";

type RuntimeConnectionHints = typeof globalThis & {
  __OPTA_DAEMON_URL__?: string;
  __OPTA_DAEMON_CONNECTION__?: Partial<DaemonConnectionOptions>;
};

function parseDaemonUrl(urlRaw: string): Partial<DaemonConnectionOptions> | null {
  const trimmed = urlRaw.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    const protocol: DaemonConnectionOptions["protocol"] =
      parsed.protocol === "https:" ? "https" : "http";
    const host = parsed.hostname.trim();
    if (!host) return null;
    if (!parsed.port) {
      return { host, protocol };
    }
    const port = Number.parseInt(parsed.port, 10);
    if (!Number.isFinite(port) || port < 1 || port > 65_535) return null;
    return { host, port, protocol };
  } catch {
    return null;
  }
}

function resolveDefaultConnection(): DaemonConnectionOptions {
  const runtime = globalThis as RuntimeConnectionHints;
  const baseline: DaemonConnectionOptions = {
    host: "127.0.0.1",
    port: 9999,
    token: "",
  };

  const hintedConn = runtime.__OPTA_DAEMON_CONNECTION__;
  const withConnectionHint: DaemonConnectionOptions = {
    ...baseline,
    ...(hintedConn?.host ? { host: hintedConn.host } : {}),
    ...(typeof hintedConn?.port === "number" ? { port: hintedConn.port } : {}),
    ...(hintedConn?.protocol ? { protocol: hintedConn.protocol } : {}),
  };

  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  const hintedUrl = runtime.__OPTA_DAEMON_URL__ ?? env?.VITE_OPTA_DAEMON_URL ?? "";
  const parsedUrl = parseDaemonUrl(hintedUrl);

  return parsedUrl ? { ...withConnectionHint, ...parsedUrl } : withConnectionHint;
}

export const DEFAULT_CONNECTION: DaemonConnectionOptions =
  resolveDefaultConnection();

export function loadStoredConnection(): DaemonConnectionOptions {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONNECTION;
    const parsed = JSON.parse(raw) as Partial<DaemonConnectionOptions>;
    return {
      host: typeof parsed.host === "string" ? parsed.host : DEFAULT_CONNECTION.host,
      port: typeof parsed.port === "number" ? parsed.port : DEFAULT_CONNECTION.port,
      token: typeof parsed.token === "string" ? parsed.token : DEFAULT_CONNECTION.token,
      protocol: parsed.protocol ?? DEFAULT_CONNECTION.protocol,
    };
  } catch {
    return DEFAULT_CONNECTION;
  }
}

export function saveConnection(
  conn: DaemonConnectionOptions,
  persistToken: boolean,
): void {
  try {
    const stored: Partial<DaemonConnectionOptions> = {
      host: conn.host,
      port: conn.port,
      protocol: conn.protocol,
    };
    if (persistToken) {
      stored.token = conn.token;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // ignore quota/security errors
  }
}
