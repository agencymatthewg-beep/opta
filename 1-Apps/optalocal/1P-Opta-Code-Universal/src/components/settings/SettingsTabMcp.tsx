import React, { useEffect, useState, useCallback } from "react";
import { useOperations } from "../../hooks/useOperations";
import type { DaemonConnectionOptions } from "../../types";
import { RefreshCw, Plus, Trash2, Activity, Play } from "lucide-react";
import { motion } from "framer-motion";

export interface McpServer {
  name: string;
  command: string;
  args?: string[];
}

export function SettingsTabMcp({ connection }: { connection: DaemonConnectionOptions }) {
  const { runOperation, lastResult, running } = useOperations(connection);
  const [servers, setServers] = useState<McpServer[]>([]);
  const [newServerName, setNewServerName] = useState("");
  const [newServerCommand, setNewServerCommand] = useState("");

  const fetchServers = useCallback(async () => {
    await runOperation('mcp.list', {});
  }, [runOperation]);

  useEffect(() => {
    fetchServers();
  }, [fetchServers, connection]);

  useEffect(() => {
    if (lastResult?.id === 'mcp.list' && lastResult.ok) {
      const payload = lastResult.result as { servers?: McpServer[] } | McpServer[] | Record<string, Partial<McpServer>>;
      if (payload && 'servers' in payload && Array.isArray(payload.servers)) {
        setServers(payload.servers as McpServer[]);
      } else if (Array.isArray(payload)) {
        setServers(payload as McpServer[]);
      } else if (payload && typeof payload === 'object') {
        // Handle object with server keys format if that's what's returned
        const serverList = Object.entries(payload).map(([name, details]) => ({
          name,
          command: details.command || '',
          args: details.args || []
        }));
        setServers(serverList);
      }
    }
  }, [lastResult]);

  const handleAdd = async () => {
    if (!newServerName || !newServerCommand) return;

    // Robust parser to handle quotes
    const parseArgs = (cmd: string) => {
      const match = cmd.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g);
      if (!match) return [];
      return match.map(m => m.replace(/^['"]|['"]$/g, ''));
    };

    const parts = parseArgs(newServerCommand);
    const command = parts[0];
    const args = parts.slice(1);

    const result = await runOperation('mcp.add', {
      name: newServerName,
      command: command,
      args: args
    });

    if (result && result.ok) {
      setNewServerName("");
      setNewServerCommand("");
      await fetchServers();
    }
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
      <div className="flex justify-between items-start">
        <div>
          <p className="text-zinc-400 text-[0.85rem] leading-relaxed m-0">
            Manage Model Context Protocol servers to give the agent access to external tools and data.
          </p>
        </div>
        <button
          className="opta-studio-btn-secondary flex items-center gap-1.5"
          onClick={fetchServers}
          disabled={running}
        >
          <RefreshCw size={14} className={running ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      <div className="p-4 rounded-lg bg-black/20 border border-[var(--opta-border)]">
        <h4 className="m-0 mb-3 text-sm text-gray-50">Add New Server</h4>
        <div className="flex gap-3 flex-wrap">
          <input
            className="opta-studio-input flex-1 min-w-[150px]"
            placeholder="Name (e.g. github)"
            value={newServerName}
            onChange={(e) => setNewServerName(e.target.value)}
          />
          <input
            className="opta-studio-input flex-[2] min-w-[200px]"
            placeholder="Command & Args (e.g. npx -y @modelcontextprotocol/server-github)"
            value={newServerCommand}
            onChange={(e) => setNewServerCommand(e.target.value)}
          />
          <button
            className="opta-studio-btn flex items-center gap-1.5"
            onClick={handleAdd}
            disabled={running || !newServerName || !newServerCommand}
          >
            <Plus size={14} /> Add
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h4 className="m-0 mb-1 text-sm text-gray-50">Configured Servers</h4>
        {servers.length === 0 ? (
          <div className="p-5 text-center text-zinc-400 text-sm border border-dashed border-[var(--opta-border)] rounded-lg">
            No MCP servers configured. Add one above.
          </div>
        ) : (
          servers.map((server) => (
            <div key={server.name} className="flex justify-between items-center p-3 bg-white/5 border border-[var(--opta-border)] rounded-lg">
              <div className="flex flex-col gap-1">
                <span className="font-semibold text-gray-50 text-sm">{server.name || "Unknown Server"}</span>
                <span className="font-mono text-xs text-zinc-400">
                  {server.command} {Array.isArray(server.args) ? server.args.join(" ") : ""}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  className="opta-studio-btn-secondary p-1.5 min-w-0"
                  onClick={() => handleTest(server.name)}
                  disabled={running}
                  title="Test Connection"
                >
                  <Play size={14} />
                </button>
                <button
                  className="opta-studio-btn-secondary p-1.5 min-w-0 text-red-500 border-red-500/30"
                  onClick={() => handleRemove(server.name)}
                  disabled={running}
                  title="Remove Server"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {lastResult?.id === 'mcp.test' && (
        <div className={`p-2.5 px-3.5 rounded-lg border text-xs font-mono whitespace-pre-wrap break-words ${lastResult.ok ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-300/95" : "border-red-500/35 bg-red-500/10 text-red-300/95"}`}>
          {lastResult.ok ? `✓ Test successful` : `✗ Test failed: ${lastResult.error?.message || "Unknown error"}`}
        </div>
      )}
    </motion.div>
  );
}
