import { useEffect, useCallback } from "react";
import { useOperations } from "../../hooks/useOperations";
import type { DaemonConnectionOptions } from "../../types";
import { Activity, Server, HardDrive } from "lucide-react";

export function SettingsTabFleet({ connection }: { connection: DaemonConnectionOptions }) {
  const { runOperation, lastResult, running } = useOperations(connection);
  
  const fetchHealth = useCallback(async () => {
    await runOperation("doctor", {});
  }, [runOperation]);

  const fetchModels = async () => {
    await runOperation("models.dashboard", {});
  };

  const fetchLocalModels = async () => {
    await runOperation("models.browse.local", {});
  };

  useEffect(() => { 
    void fetchHealth();
  }, [connection, fetchHealth]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="opta-studio-section-title" style={{ marginBottom: "0.45rem" }}>
          Fleet & Model Dashboard
        </h3>
        <p className="st-desc">
          Monitor your inference hardware and manage loaded models.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <button 
          onClick={() => void fetchHealth()} 
          className="opta-studio-btn"
          disabled={running}
        >
          <Activity size={16} /> Run Diagnostics
        </button>
        <button 
          onClick={() => void fetchModels()} 
          className="opta-studio-btn-secondary"
          disabled={running}
        >
          <Server size={16} /> Browse Models
        </button>
        <button 
          onClick={() => void fetchLocalModels()} 
          className="opta-studio-btn-secondary"
          disabled={running}
        >
          <HardDrive size={16} /> Local Models
        </button>
      </div>

      <div className="st-fieldset" style={{ minHeight: "220px" }}>
        <h4 className="st-legend" style={{ marginBottom: "0.8rem" }}>
          Operation Results 
          {running ? <span className="st-hint" style={{ fontSize: "0.68rem" }}>(Loading...)</span> : null}
        </h4>
        
        {lastResult ? (
          lastResult.error ? (
            <pre className="st-code st-code-error">
              {typeof lastResult.error === 'string' ? lastResult.error : JSON.stringify(lastResult.error, null, 2)}
            </pre>
          ) : (
            <pre className="st-code st-code-ok">
              {JSON.stringify(lastResult.result, null, 2)}
            </pre>
          )
        ) : (
          <p className="st-desc" style={{ margin: 0 }}>
            No recent operations.
          </p>
        )}
      </div>
    </div>
  );
}
