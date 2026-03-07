import { Radio } from "lucide-react";
import { motion } from "framer-motion";
import { WidgetShell } from "./WidgetShell";
import type { ConnectionHealthState } from "../../hooks/useConnectionHealth";

interface Props {
  health: ConnectionHealthState | null;
}

const STATE_COLOR: Record<string, string> = {
  connected: "var(--opta-neon-green, #4ade80)",
  connecting: "var(--opta-neon-amber, #fbbf24)",
  disconnected: "var(--opta-error, #f87171)",
  offline: "var(--opta-text-secondary, rgba(255,255,255,0.3))",
};

export function WidgetDaemonRing({ health }: Props) {
  const status = health?.status ?? "connecting";
  const color = STATE_COLOR[status] ?? STATE_COLOR.connecting;
  const badge = status === "connected" ? "ONLINE" : status.toUpperCase();
  const accentVar = status === "connected" ? "--opta-neon-green" : "--opta-error";

  return (
    <WidgetShell icon={<Radio size={14} />} title="Connection" badge={badge} accentVar={accentVar}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 0" }}>
        <div style={{ position: "relative", width: 20, height: 20, flexShrink: 0 }}>
          {status === "connected" && (
            <motion.div
              style={{
                position: "absolute", inset: 0, borderRadius: "50%",
                border: `1.5px solid ${color}`, opacity: 0.4,
              }}
              animate={{ scale: [1, 1.7], opacity: [0.4, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
            />
          )}
          <div style={{
            position: "absolute", inset: 4, borderRadius: "50%",
            background: color, boxShadow: `0 0 6px ${color}`,
          }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span className="widget-stat-value" style={{ fontSize: 12 }}>
            {health?.host ?? "—"}
          </span>
          {health?.latencyMs != null && (
            <span className="widget-stat-label" style={{ fontSize: 10 }}>
              {health.latencyMs} ms · {health.latencyTier}
            </span>
          )}
        </div>
      </div>
    </WidgetShell>
  );
}
