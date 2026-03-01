import type { DaemonConnectionOptions } from "../types";
import { isNativeDesktop } from "./runtime";

export type ConnectionType = "lan" | "wan" | "offline";
export type DiagnosticCategory =
  | "OK"
  | "NODE_DOWN"
  | "UNAUTHORIZED"
  | "TIMEOUT"
  | "UNKNOWN";

export interface ConnectionProbeResult {
  url: string;
  protocol: "http" | "https";
  type: ConnectionType;
  latencyMs: number;
  diagnostic: DiagnosticCategory;
}

const LAN_TIMEOUT_MS = 1500;
const WAN_TIMEOUT_MS = 8000;

function canProbeLanFromRuntime(): boolean {
  if (isNativeDesktop()) return true;
  if (typeof window === "undefined") return true;
  return window.location.protocol === "http:";
}

function makeTimeoutSignal(timeoutMs: number): AbortSignal {
  if (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal) {
    return AbortSignal.timeout(timeoutMs);
  }
  const controller = new AbortController();
  globalThis.setTimeout(() => controller.abort(), timeoutMs);
  return controller.signal;
}

async function probeUrl(
  url: string,
  timeoutMs: number,
  token?: string,
): Promise<{ latencyMs: number | null; diagnostic: DiagnosticCategory }> {
  try {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    const startedAt = performance.now();
    const response = await fetch(`${url}/v3/health`, {
      headers,
      signal: makeTimeoutSignal(timeoutMs),
    });

    if (response.status === 401 || response.status === 403) {
      return { latencyMs: null, diagnostic: "UNAUTHORIZED" };
    }
    if (response.ok) {
      return {
        latencyMs: Math.round(performance.now() - startedAt),
        diagnostic: "OK",
      };
    }
    return { latencyMs: null, diagnostic: "UNKNOWN" };
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      return { latencyMs: null, diagnostic: "TIMEOUT" };
    }
    return { latencyMs: null, diagnostic: "NODE_DOWN" };
  }
}

// Migrated from 1L-Opta-Local/web connection probing so web runtime can choose
// the best reachable daemon endpoint without native IPC.
export async function probeDaemonConnection(
  connection: DaemonConnectionOptions,
  options?: { tunnelUrl?: string; useTunnel?: boolean },
): Promise<ConnectionProbeResult> {
  const protocols: Array<"http" | "https"> = connection.protocol
    ? [connection.protocol]
    : ["http", "https"];
  let lastDiagnostic: DiagnosticCategory = "UNKNOWN";

  for (const protocol of protocols) {
    if (protocol === "http" && !canProbeLanFromRuntime()) {
      continue;
    }
    const url = `${protocol}://${connection.host}:${connection.port}`;
    const result = await probeUrl(url, LAN_TIMEOUT_MS, connection.token);
    lastDiagnostic = result.diagnostic;
    if (result.latencyMs !== null || result.diagnostic === "UNAUTHORIZED") {
      return {
        url,
        protocol,
        type: "lan",
        latencyMs: result.latencyMs ?? 0,
        diagnostic: result.diagnostic,
      };
    }
  }

  if (options?.useTunnel && options.tunnelUrl) {
    const sanitized = options.tunnelUrl.replace(/\/+$/, "");
    const protocol = sanitized.startsWith("https://") ? "https" : "http";
    const result = await probeUrl(sanitized, WAN_TIMEOUT_MS, connection.token);
    if (result.latencyMs !== null || result.diagnostic === "UNAUTHORIZED") {
      return {
        url: sanitized,
        protocol,
        type: "wan",
        latencyMs: result.latencyMs ?? 0,
        diagnostic: result.diagnostic,
      };
    }
    lastDiagnostic = result.diagnostic;
  }

  return {
    url: `${connection.protocol ?? "http"}://${connection.host}:${connection.port}`,
    protocol: connection.protocol ?? "http",
    type: "offline",
    latencyMs: 0,
    diagnostic: lastDiagnostic,
  };
}
