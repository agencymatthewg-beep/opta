import { useEffect } from "react";
import type { DaemonConnectionOptions } from "../../types";
import { useOperations } from "../../hooks/useOperations";
import { GitCommit } from "lucide-react";

interface WidgetGitDiffProps {
  connection?: DaemonConnectionOptions;
  sessionId?: string | null;
}

interface DiffResult {
  stdout?: string;
  diff?: string;
  output?: string;
  [key: string]: unknown;
}

export function WidgetGitDiff({ connection, sessionId }: WidgetGitDiffProps) {
  const { runOperation, lastResult, loading, error } = useOperations(
    connection || { host: "127.0.0.1", port: 51042, token: "" },
  );

  useEffect(() => {
    if (!sessionId) return;
    void runOperation("diff", { session: sessionId });
  }, [sessionId, runOperation]);

  const resultObj = lastResult?.result as DiffResult | undefined;
  let stdout = "";
  if (resultObj) {
    stdout = typeof resultObj.stdout === "string" ? resultObj.stdout :
             typeof resultObj.diff === "string" ? resultObj.diff :
             typeof resultObj.output === "string" ? resultObj.output : "";
    if (!stdout && typeof resultObj === "object") {
      stdout = JSON.stringify(resultObj, null, 2);
    }
  }

  const lines = stdout ? stdout.split("\n") : [];

  return (
    <div className="flex flex-col h-full overflow-hidden w-full h-full bg-black/20 rounded-lg">
      <div className="widget-header">
        <span className="widget-title flex items-center gap-1.5 uppercase text-[10px] font-bold tracking-wider text-white/50">
          <GitCommit size={14} className="text-white/40" />
          SESSION DIFF
        </span>
      </div>
      <div className="flex-1 overflow-y-auto bg-[#1e1e1e] text-[#d4d4d4] p-2 font-mono text-[11px] whitespace-pre">
        {!sessionId && <div className="opacity-50">No active session</div>}
        {sessionId && loading && !lastResult && !error && (
          <div className="opacity-50">Loading diff...</div>
        )}
        {error && (
          <div className="text-red-400">Error loading diff: {error}</div>
        )}
        {sessionId && lastResult && !stdout && !error && (
          <div className="opacity-50">No changes detected</div>
        )}
        {stdout &&
          lines.map((line, idx) => {
            let colorClass = "text-inherit";
            if (line.startsWith("+")) colorClass = "text-green-400";
            else if (line.startsWith("-")) colorClass = "text-red-400";
            else if (line.startsWith("@@")) colorClass = "text-blue-400";

            return (
              <div key={idx} className={`${colorClass} min-h-[1em]`}>
                {line || " "}
              </div>
            );
          })}
      </div>
    </div>
  );
}
