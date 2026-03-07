import { Cpu } from "lucide-react";
import { useState } from "react";
import { WidgetShell } from "./WidgetShell";
import { useModels } from "../../hooks/useModels";
import { daemonClient } from "../../lib/daemonClient";
import type { DaemonConnectionOptions } from "../../types";

interface Props { connection: DaemonConnectionOptions | null; }

export function WidgetModelSwitcher({ connection }: Props) {
  const { loadedModels, loading } = useModels(connection);
  const [activeModel, setActiveModel] = useState<string | null>(null);

  const switchModel = async (modelId: string) => {
    if (!connection) return;
    const prev = activeModel;
    setActiveModel(modelId);
    try {
      await daemonClient.configSet(connection, "model", modelId);
    } catch {
      setActiveModel(prev); // revert optimistic update on failure
    }
  };

  return (
    <WidgetShell icon={<Cpu size={14} />} title="Switch Model" accentVar="--opta-neon-cyan">
      {loading && <span className="widget-stat-label">Loading…</span>}
      {!loading && loadedModels.length === 0 && (
        <span className="widget-stat-label">No models loaded</span>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {loadedModels.map((m) => (
          <button
            key={m.model_id}
            className={`wp-catalog-btn ${activeModel === m.model_id ? "wp-catalog-btn--active" : ""}`}
            onClick={() => switchModel(m.model_id)}
            type="button"
            style={{ fontSize: 11 }}
          >
            {m.model_id}
            {activeModel === m.model_id && <span className="wp-catalog-btn-check">✓</span>}
          </button>
        ))}
      </div>
    </WidgetShell>
  );
}
