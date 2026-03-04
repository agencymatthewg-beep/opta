import React, { useEffect, useState } from "react";
import { useOperations } from "../../hooks/useOperations";
import type { DaemonConnectionOptions } from "../../types";
import { RefreshCw, Plus, Trash2, Activity, Play } from "lucide-react";
import { motion } from "framer-motion";

export function SettingsTabMcp({ connection }: { connection: DaemonConnectionOptions }) {
  const { runOperation, lastResult, running } = useOperations(connection);
  const [servers, setServers] = useState<any[]>([]);
  const [newServerName, setNewServerName] = useState("");
  const [newServerCommand, setNewServerCommand] = useState("");

  const fetchServers = async () => {
    await runOperation('mcp.list', {});
  };

  useEffect(() => {
    fetchServers();
  }, [connection]);

  useEffect(() => {
    if (lastResult?.id === 'mcp.list' && lastResult.ok) {
      const payload = lastResult.result as any;
      if (payload && Array.isArray(payload.servers)) {
        setServers(payload.servers);
      } else if (Array.isArray(payload)) {
        setServers(payload);
      } else if (payload && typeof payload === 'object') {
        // Handle object with server keys format if that's what's returned
        const serverList = Object.entries(payload).map(([name, details]) => ({
          name,
          ...(typeof details === 'object' && details !== null ? details : {})
        }));
        setServers(serverList);
      }
    }
  }, [lastResult]);

  const handleAdd = async () => {
    if (!newServerName || !newServerCommand) return;
    
    // Simple parser to separate command and arguments (naive)
    const parts = newServerCommand.split(' ');
    const command = parts[0];
    const args = parts.slice(1);
    
    await runOperation('mcp.add', { 
      name: newServerName, 
      command: command,
      args: args
    });
    setNewServerName("");
    setNewServerCommand("");
    await fetchServers();
  };

  const handleRemove = async (name: string) => {
    await runOperation('mcp.remove', { name });
    await fetchServers();
  };

  const handleTest = async (name: string) => {
    await runOperation('mcp.test', { name });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-6"
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h3 className="opta-studio-section-title" style={{ marginBottom: "0.4rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Activity size={18} /> MCP Integrations
          </h3>
          <p style={{ color: "#a1a1aa", fontSize: "0.85rem", lineHeight: 1.5, margin: 0 }}>
            Manage Model Context Protocol servers to give the agent access to external tools and data.
          </p>
        </div>
        <button
          className="opta-studio-btn-secondary"
          onClick={fetchServers}
          disabled={running}
          style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
        >
          <RefreshCw size={14} className={running ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      <div style={{ padding: "16px", borderRadius: "8px", background: "rgba(0,0,0,0.2)", border: "1px solid var(--opta-border)" }}>
        <h4 style={{ margin: "0 0 12px", fontSize: "0.9rem", color: "#fafafa" }}>Add New Server</h4>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <input
            className="opta-studio-input"
            style={{ flex: 1, minWidth: "150px" }}
            placeholder="Name (e.g. github)"
            value={newServerName}
            onChange={(e) => setNewServerName(e.target.value)}
          />
          <input
            className="opta-studio-input"
            style={{ flex: 2, minWidth: "200px" }}
            placeholder="Command & Args (e.g. npx -y @modelcontextprotocol/server-github)"
            value={newServerCommand}
            onChange={(e) => setNewServerCommand(e.target.value)}
          />
          <button
            className="opta-studio-btn"
            onClick={handleAdd}
            disabled={running || !newServerName || !newServerCommand}
            style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
          >
            <Plus size={14} /> Add
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <h4 style={{ margin: "0 0 4px", fontSize: "0.9rem", color: "#fafafa" }}>Configured Servers</h4>
        {servers.length === 0 ? (
          <div style={{ padding: "20px", textAlign: "center", color: "#a1a1aa", fontSize: "0.85rem", border: "1px dashed var(--opta-border)", borderRadius: "8px" }}>
            No MCP servers configured. Add one above.
          </div>
        ) : (
          servers.map((server, idx) => (
            <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", background: "rgba(255,255,255,0.03)", border: "1px solid var(--opta-border)", borderRadius: "8px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ fontWeight: 600, color: "#fafafa", fontSize: "0.9rem" }}>{server.name || "Unknown Server"}</span>
                <span style={{ fontFamily: "JetBrains Mono", fontSize: "0.75rem", color: "#a1a1aa" }}>
                  {server.command} {Array.isArray(server.args) ? server.args.join(" ") : ""}
                </span>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  className="opta-studio-btn-secondary"
                  onClick={() => handleTest(server.name)}
                  disabled={running}
                  title="Test Connection"
                  style={{ padding: "6px", minWidth: "auto" }}
                >
                  <Play size={14} />
                </button>
                <button
                  className="opta-studio-btn-secondary"
                  onClick={() => handleRemove(server.name)}
                  disabled={running}
                  title="Remove Server"
                  style={{ padding: "6px", minWidth: "auto", color: "#ef4444", borderColor: "rgba(239,68,68,0.3)" }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      
      {lastResult?.id === 'mcp.test' && (
        <div style={{
          padding: "10px 14px",
          borderRadius: "8px",
          border: `1px solid ${lastResult.ok ? "rgba(16,185,129,0.35)" : "rgba(239,68,68,0.35)"}`,
          background: lastResult.ok ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
          fontSize: "0.8rem",
          color: lastResult.ok ? "rgba(110,231,183,0.95)" : "rgba(252,165,165,0.95)",
          fontFamily: "JetBrains Mono",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word"
        }}>
          {lastResult.ok ? `✓ Test successful` : `✗ Test failed: ${lastResult.error?.message || "Unknown error"}`}
        </div>
      )}
    </motion.div>
  );
}
