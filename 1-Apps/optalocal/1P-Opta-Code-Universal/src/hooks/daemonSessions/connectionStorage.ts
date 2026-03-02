import type { DaemonConnectionOptions } from "../../types";

export const STORAGE_KEY = "opta:daemon-connection";

export const DEFAULT_CONNECTION: DaemonConnectionOptions = {
  host: "127.0.0.1",
  port: 9999,
  token: "",
};

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
