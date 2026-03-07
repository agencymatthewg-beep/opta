import { Wifi } from "lucide-react";
import { WidgetShell } from "./WidgetShell";
import { useModels } from "../../hooks/useModels";
import type { DaemonConnectionOptions } from "../../types";

interface Props {
  connection: DaemonConnectionOptions | null;
}

export function WidgetLmxStatus({ connection }: Props) {
  const { lmxReachable, loadedModels, lmxStatus, lmxDiscovery } = useModels(connection);

  const state = !connection
    ? "no-config"
    : lmxReachable
      ? (loadedModels.length > 0 ? "connected" : "degraded")
      : "disconnected";

  const badge = state === "connected" ? "CONNECTED" : state === "degraded" ? "NO MODEL" : "OFFLINE";
  const accentVar = state === "connected" ? "--opta-neon-cyan" : state === "degraded" ? "--opta-neon-amber" : "--opta-error";
  const latency = (lmxStatus as any)?.latencyMs ?? null;
  const activeModel = loadedModels[0]?.name ?? loadedModels[0]?.id ?? "—";
  const source = (lmxDiscovery as any)?.source ?? "config";

  return (
    <WidgetShell icon={<Wifi size={14} />} title="AI Server" badge={badge} accentVar={accentVar}>
      <div className="widget-stat-row">
        <span className="widget-stat-label">Model</span>
        <span className="widget-stat-value accent">{activeModel}</span>
      </div>
      {latency !== null && (
        <div className="widget-stat-row">
          <span className="widget-stat-label">Latency</span>
          <span className="widget-stat-value">{latency} ms</span>
        </div>
      )}
      <div className="widget-stat-row">
        <span className="widget-stat-label">Found via</span>
        <span className="widget-stat-value">{source}</span>
      </div>
    </WidgetShell>
  );
}
