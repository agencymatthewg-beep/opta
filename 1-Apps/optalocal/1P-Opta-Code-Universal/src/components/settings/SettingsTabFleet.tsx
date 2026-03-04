import { useEffect } from "react";
import { useOperations } from "../../hooks/useOperations";
import type { DaemonConnectionOptions } from "../../types";
import { Activity, Server, HardDrive } from "lucide-react";

export function SettingsTabFleet({ connection }: { connection: DaemonConnectionOptions }) {
  const { runOperation, lastResult, running } = useOperations(connection);
  
  const fetchHealth = async () => {
    await runOperation("doctor", {});
  };

  const fetchModels = async () => {
    await runOperation("models.dashboard", {});
  };

  const fetchLocalModels = async () => {
    await runOperation("models.browse.local", {});
  };

  useEffect(() => { 
    void fetchHealth();
  }, [connection]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-xl font-semibold text-white mb-1">Fleet & Model Dashboard</h3>
        <p className="text-sm text-zinc-400 m-0 leading-relaxed">
          Monitor your inference hardware and manage loaded models.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <button 
          onClick={() => void fetchHealth()} 
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={running}
        >
          <Activity size={16} /> Run Diagnostics
        </button>
        <button 
          onClick={() => void fetchModels()} 
          className="bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={running}
        >
          <Server size={16} /> Browse Models
        </button>
        <button 
          onClick={() => void fetchLocalModels()} 
          className="bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={running}
        >
          <HardDrive size={16} /> Local Models
        </button>
      </div>

      <div className="p-4 rounded-xl border border-white/10 bg-black/20 min-h-[200px]">
        <h4 className="text-sm font-medium text-white mb-3 m-0 flex items-center gap-2">
          Operation Results 
          {running ? <span className="text-xs text-zinc-400">(Loading...)</span> : null}
        </h4>
        
        {lastResult ? (
          <pre className="font-mono text-xs text-purple-200 m-0 whitespace-pre-wrap break-words">
            {JSON.stringify(lastResult.result, null, 2)}
          </pre>
        ) : (
          <p className="text-sm text-zinc-400 m-0">
            No recent operations.
          </p>
        )}
      </div>
    </div>
  );
}
