import React, { useEffect, useState } from "react";
import type { V3Envelope } from "@opta/protocol-shared";

interface TelemetryPanelProps {
  metrics?: { vramUtilized: number; vramTotal: number; tokensPerSec: number };
  events: V3Envelope[];
}

export function TelemetryPanel({ metrics, events }: TelemetryPanelProps) {
  // Compute basic agent state from recent events
  // This is a naive heuristic for the prototype; could be more robust.
  const [activeSubAgent, setActiveSubAgent] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [atpoState, setAtpoState] = useState<string | null>(null);

  useEffect(() => {
    // Process events in order to derive live state
    for (const env of events) {
      const eventName = env.event as string;
      if (eventName === "agent.phase") {
        const payload = env.payload as any;
        if (payload.phase === "spawn_subagent") {
          setActiveSubAgent(payload.agentType || "Sub-agent");
        } else if (payload.phase === "return_to_main") {
          setActiveSubAgent(null);
          setActiveTool(null);
        }
      } else if (eventName === "tool.start") {
        const payload = env.payload as any;
        setActiveTool(payload.name);
      } else if (eventName === "tool.end") {
        setActiveTool(null);
      } else if (eventName === "atpo.intervene") {
        const payload = env.payload as any;
        setAtpoState(`Analyzed context: ${payload.reason || "loop detected"}`);
        setTimeout(() => setAtpoState(null), 5000);
      }
    }
  }, [events]);

  const tokensPerSec = metrics?.tokensPerSec ?? 0;
  const vramUtilized = metrics?.vramUtilized ?? 0;
  const vramTotal = metrics?.vramTotal ?? 32;
  const vramPercent =
    Math.min(100, Math.round((vramUtilized / vramTotal) * 100)) || 0;

  return (
    <div className="telemetry-panel">
      <div className="telemetry-header">
        <div className="telemetry-title">
          <span className="live-dot"></span> Telemetry Stream
        </div>
        <h2>Session Runtime</h2>
      </div>

      <div className="telemetry-content">
        <div className="meter-group">
          <div className="meter">
            <div className="meter-header">
              <span>VRAM UTILIZATION</span>
              <span className="meter-val">
                {vramUtilized.toFixed(1)} / {vramTotal} GB
              </span>
            </div>
            <div className="bar-bg">
              <div
                className="bar-fill"
                style={{ width: `${vramPercent}%` }}
              ></div>
            </div>
          </div>
          <div className="meter">
            <div className="meter-header">
              <span>TOKEN SPEED</span>
              <span className="meter-val">{tokensPerSec.toFixed(1)} t/s</span>
            </div>
            <div className="bar-bg">
              <div
                className="bar-fill bar-fill-green"
                style={{
                  width: `${Math.min(100, (tokensPerSec / 50) * 100)}%`,
                }}
              ></div>
            </div>
          </div>
        </div>

        <div>
          <div className="section-title">Execution Graph</div>

          <div className="tree-node">
            <div className="node-icon">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2v20" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
            <div className="node-info">
              <div className="node-name">Main Agent (Do)</div>
              <div className="node-phase">
                {activeSubAgent
                  ? "Waiting for sub-agent..."
                  : activeTool
                    ? "Executing tool..."
                    : "Thinking..."}
              </div>
            </div>
          </div>

          {activeSubAgent && (
            <div className="tree-node" style={{ marginLeft: "20px" }}>
              <div className="node-icon sub">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4" />
                  <path d="M12 8h.01" />
                </svg>
              </div>
              <div className="node-info">
                <div className="node-name">{activeSubAgent}</div>
                <div className="node-phase">
                  {activeTool ? (
                    <>
                      <div className="spinner"></div>
                      Executing tool:{" "}
                      <span style={{ color: "var(--cyan)" }}>{activeTool}</span>
                    </>
                  ) : (
                    "Analyzing task..."
                  )}
                </div>
              </div>
            </div>
          )}

          {atpoState && (
            <div className="tree-node">
              <div className="node-icon supervisor">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M2 12h4l3-9 5 18 3-9h5" />
                </svg>
              </div>
              <div className="node-info">
                <div className="node-name">ATPO Supervisor</div>
                <div className="node-phase" style={{ color: "var(--amber)" }}>
                  {atpoState}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
