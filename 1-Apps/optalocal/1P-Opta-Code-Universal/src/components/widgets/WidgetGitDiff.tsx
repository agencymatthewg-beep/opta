import { useEffect } from "react";
import type { DaemonConnectionOptions } from "../../types";
import { useOperations } from "../../hooks/useOperations";

interface WidgetGitDiffProps {
    connection?: DaemonConnectionOptions;
    sessionId?: string | null;
}

export function WidgetGitDiff({ connection, sessionId }: WidgetGitDiffProps) {
    const { runOperation, lastResult, loading } = useOperations(
        connection || { host: "127.0.0.1", port: 51042, token: "" }
    );

    useEffect(() => {
        if (!sessionId) return;
        runOperation("diff", { session: sessionId });
    }, [sessionId, runOperation]);

    const resultObj = lastResult?.result as any;
    let stdout = "";
    if (resultObj) {
        stdout = resultObj.stdout || resultObj.diff || resultObj.output || "";
        if (typeof stdout !== "string") {
            stdout = JSON.stringify(resultObj, null, 2);
        }
    }

    const lines = stdout.split("\n");

    return (
        <div className="widget-git-diff" style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
            <div className="widget-header">
                <span className="widget-title">
                    <svg
                        className="widget-icon"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                    >
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                    </svg>
                    SESSION DIFF
                </span>
            </div>
            <div className="widget-body" style={{ flex: 1, overflowY: "auto", backgroundColor: "#1e1e1e", color: "#d4d4d4", padding: "0.5rem", fontFamily: "monospace", fontSize: "11px", whiteSpace: "pre" }}>
                {!sessionId && <div style={{ opacity: 0.5 }}>No active session</div>}
                {sessionId && loading && !lastResult && <div style={{ opacity: 0.5 }}>Loading diff...</div>}
                {sessionId && lastResult && !stdout && <div style={{ opacity: 0.5 }}>No changes detected</div>}
                {lines.map((line, idx) => {
                    let color = "inherit";
                    if (line.startsWith("+")) color = "#4ade80";
                    else if (line.startsWith("-")) color = "#f87171";
                    else if (line.startsWith("@@")) color = "#60a5fa";
                    
                    return (
                        <div key={idx} style={{ color, minHeight: "1em" }}>
                            {line || " "}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
