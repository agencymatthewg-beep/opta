import type { DaemonConnectionOptions } from "../types";
import {
  discoverLmxViaMdnsHints,
  type LmxDiscoveryInfo,
} from "./lanScanner";
import { daemonClient } from "./daemonClient";

function mapDaemonDiscoveryTarget(target: {
  host: string;
  port: number;
  name?: string;
  latencyMs?: number;
}): LmxDiscoveryInfo {
  return {
    host: target.host,
    port: target.port,
    latencyMs: target.latencyMs ?? 0,
    machineName: target.name,
    via: "daemon",
  };
}

export async function discoverLmxCandidates(
  connection: DaemonConnectionOptions,
  extraHints: string[] = [],
  onFound?: (info: LmxDiscoveryInfo) => void,
): Promise<LmxDiscoveryInfo[]> {
  try {
    const daemonTargets = await daemonClient.discoveryList(connection);
    if (daemonTargets.length > 0) {
      const mapped = daemonTargets.map(mapDaemonDiscoveryTarget);
      for (const target of mapped) {
        onFound?.(target);
      }
      return mapped;
    }
  } catch {
    // Fall back to direct local discovery only when daemon-backed discovery fails.
  }

  return discoverLmxViaMdnsHints(extraHints, onFound);
}
