import type { DaemonConnectionOptions } from "../types";

export const DAEMON_FALLBACK_HOST = "127.0.0.1";
export const DAEMON_FALLBACK_PORT = 9999;
export const LMX_DEFAULT_PORT = 1234;

export interface DaemonConnectionSanitizeResult {
  connection: DaemonConnectionOptions;
  corrected: boolean;
  reason?: "lmx-port-reserved";
}

export function isReservedLmxDaemonPort(port: number): boolean {
  return port === LMX_DEFAULT_PORT;
}

export function sanitizeDaemonConnection(
  input: DaemonConnectionOptions,
): DaemonConnectionSanitizeResult {
  if (!isReservedLmxDaemonPort(input.port)) {
    return { connection: input, corrected: false };
  }

  return {
    connection: {
      ...input,
      host: DAEMON_FALLBACK_HOST,
      port: DAEMON_FALLBACK_PORT,
    },
    corrected: true,
    reason: "lmx-port-reserved",
  };
}
