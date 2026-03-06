import { useState, useEffect, type CSSProperties } from "react";
import { AppWindow, Package, RefreshCw, Server, Trash2, X } from "lucide-react";
import { daemonClient } from "../lib/daemonClient";
import type { DaemonConnectionOptions } from "../types";

const OPTA_LOGO_LETTERS = ["O", "P", "T", "A"] as const;

const ACCENT = "#f472b6";

type ActiveTab = "apps" | "mcp";

interface InstalledApp {
  id: string;
  name: string;
  version?: string;
  path?: string;
}

interface McpServer {
  name: string;
  transport: string;
  command?: string;
  args?: string[];
  url?: string;
}

interface AtpoStudioProps {
  isFullscreen: boolean;
  onClose: () => void;
  connection: DaemonConnectionOptions | null;
}

const APP_COLORS: Record<string, string> = {
  "opta-cli": "#22d3ee",
  "opta-daemon": "#22d3ee",
  "opta-lmx": "#a78bfa",
  "opta-code-universal": "#f472b6",
};

function getAppColor(appId: string): string {
  return APP_COLORS[appId] ?? "#71717a";
}

export function AtpoStudio({ isFullscreen, onClose, connection }: AtpoStudioProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("apps");
  const [apps, setApps] = useState<InstalledApp[]>([]);
  const [mcpServers, setMcpServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const fetchApps = async () => {
    if (!connection) return;
    try {
      const res = await daemonClient.runOperation(connection, "apps.list", {
        input: {},
      });
      if (res.ok && Array.isArray(res.result)) {
        setApps(res.result as InstalledApp[]);
      }
    } catch {
      // daemon may not expose apps.list — stay empty
    }
  };

  const fetchMcp = async () => {
    if (!connection) return;
    try {
      const res = await daemonClient.runOperation(connection, "mcp.list", {
        input: {},
      });
      if (
        res.ok &&
        res.result &&
        typeof res.result === "object" &&
        !Array.isArray(res.result)
      ) {
        const servers: McpServer[] = Object.entries(
          res.result as Record<string, unknown>,
        ).map(([name, cfg]) => {
          const c = cfg as Record<string, unknown>;
          return {
            name,
            transport: String(c.transport ?? "stdio"),
            command: typeof c.command === "string" ? c.command : undefined,
            args: Array.isArray(c.args) ? c.args.map(String) : undefined,
            url: typeof c.url === "string" ? c.url : undefined,
          };
        });
        setMcpServers(servers);
      }
    } catch {
      // daemon may not expose mcp.list — stay empty
    }
  };

  const refresh = async () => {
    setLoading(true);
    await Promise.all([fetchApps(), fetchMcp()]);
    setLoading(false);
  };

  const handleRemoveMcp = async (name: string) => {
    if (!connection) return;
    setRemoving(name);
    try {
      await daemonClient.runOperation(connection, "mcp.remove", {
        input: { name },
      });
      await fetchMcp();
    } finally {
      setRemoving(null);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection]);

  const shellClass = [
    "opta-studio-shell",
    "opta-studio-shell--embedded",
    isFullscreen ? "opta-studio-shell--fullscreen" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={shellClass}
      style={{ "--studio-feature-accent": ACCENT } as CSSProperties}
      onClick={(e) => e.stopPropagation()}
    >

      {/* Top Chrome */}
      <div className="opta-studio-top-chrome">
        <div className="opta-studio-top-chrome-left">
          <div className="opta-studio-shortcut-panel">
            <span className="opta-studio-shortcut-title">Atpo Studio</span>
            <span className="opta-studio-shortcut-copy">
              Ctrl+A toggle · Shift+Space fullscreen · Esc close
            </span>
          </div>
        </div>
        <div className="opta-studio-top-chrome-center">
          <div className="opta-studio-command-row">
            <div className="opta-studio-panel-title">
              <span
                className="opta-studio-layer-badge"
                style={{ "--settings-accent": ACCENT } as CSSProperties}
              >
                <AppWindow
                  size={13}
                  style={{ display: "inline", verticalAlign: "middle", marginRight: 5 }}
                />
                App &amp; Module Management
              </span>
            </div>
          </div>
        </div>
        <div className="opta-studio-top-chrome-right">
          <button
            type="button"
            onClick={onClose}
            className="opta-studio-close-btn"
            aria-label="Close Atpo Studio"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="feature-studio-content">
        {/* Tab bar */}
        <div className="feature-studio-tab-bar">
          <button
            type="button"
            className={`feature-studio-tab ${activeTab === "apps" ? "is-active" : ""}`}
            style={
              activeTab === "apps"
                ? ({
                    "--tab-accent": ACCENT,
                    color: ACCENT,
                    borderColor: `${ACCENT}55`,
                  } as CSSProperties)
                : {}
            }
            onClick={() => setActiveTab("apps")}
          >
            <Package size={13} />
            Opta Apps ({apps.length})
          </button>
          <button
            type="button"
            className={`feature-studio-tab ${activeTab === "mcp" ? "is-active" : ""}`}
            style={
              activeTab === "mcp"
                ? ({
                    "--tab-accent": ACCENT,
                    color: ACCENT,
                    borderColor: `${ACCENT}55`,
                  } as CSSProperties)
                : {}
            }
            onClick={() => setActiveTab("mcp")}
          >
            <Server size={13} />
            MCP Servers ({mcpServers.length})
          </button>

          <div className="feature-studio-tab-spacer" />

          <button
            type="button"
            className="feature-studio-action-secondary"
            style={{ color: ACCENT, borderColor: `${ACCENT}44` }}
            onClick={() => void refresh()}
            disabled={loading}
          >
            <RefreshCw size={13} className={loading ? "feature-studio-spin" : ""} />
            Refresh
          </button>
        </div>

        {/* Apps tab */}
        {activeTab === "apps" && (
          <div className="feature-studio-app-list">
            {apps.length > 0 ? (
              apps.map((app) => {
                const color = getAppColor(app.id);
                return (
                  <div
                    key={app.id}
                    className="feature-studio-app-row"
                    style={{ borderLeft: `3px solid ${color}55` }}
                  >
                    <div
                      className="feature-studio-app-icon"
                      style={{ background: `${color}18`, color }}
                    >
                      <Package size={16} />
                    </div>
                    <div className="feature-studio-app-info">
                      <div className="feature-studio-app-name">
                        {app.name}
                        {app.version && (
                          <span className="feature-studio-app-version">
                            v{app.version}
                          </span>
                        )}
                        <span
                          className="feature-studio-app-category"
                          style={{ color, borderColor: `${color}44` }}
                        >
                          {app.id}
                        </span>
                      </div>
                      {app.path && (
                        <div
                          className="feature-studio-app-desc"
                          style={{
                            fontFamily: "JetBrains Mono, monospace",
                            fontSize: 10,
                          }}
                        >
                          {app.path}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="feature-studio-empty-state">
                <Package size={28} style={{ opacity: 0.25, color: ACCENT }} />
                <p>
                  {connection
                    ? "No installed apps detected"
                    : "Connect daemon to view apps"}
                </p>
              </div>
            )}
          </div>
        )}

        {/* MCP tab */}
        {activeTab === "mcp" && (
          <div className="feature-studio-app-list">
            {mcpServers.length > 0 ? (
              mcpServers.map((server) => {
                const transport =
                  server.transport === "stdio"
                    ? [server.command, ...(server.args ?? [])]
                        .filter(Boolean)
                        .join(" ")
                    : server.url ?? "unknown";
                return (
                  <div
                    key={server.name}
                    className="feature-studio-app-row"
                    style={{ borderLeft: `3px solid ${ACCENT}55` }}
                  >
                    <div
                      className="feature-studio-app-icon"
                      style={{ background: `${ACCENT}18`, color: ACCENT }}
                    >
                      <Server size={16} />
                    </div>
                    <div className="feature-studio-app-info">
                      <div className="feature-studio-app-name">
                        {server.name}
                        <span
                          className="feature-studio-app-category"
                          style={{ color: ACCENT, borderColor: `${ACCENT}44` }}
                        >
                          {server.transport}
                        </span>
                      </div>
                      <div
                        className="feature-studio-app-desc"
                        style={{
                          fontFamily: "JetBrains Mono, monospace",
                          fontSize: 10,
                        }}
                      >
                        {transport}
                      </div>
                    </div>
                    <div className="feature-studio-app-actions">
                      <button
                        type="button"
                        className="feature-studio-action-mini feature-studio-action-mini--danger"
                        onClick={() => void handleRemoveMcp(server.name)}
                        disabled={removing === server.name}
                        title="Remove MCP server"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="feature-studio-empty-state">
                <Server size={28} style={{ opacity: 0.25, color: ACCENT }} />
                <p>
                  {connection
                    ? "No MCP servers configured"
                    : "Connect daemon to view MCP servers"}
                </p>
                <p className="feature-studio-empty-hint">
                  Add via: opta mcp add &lt;name&gt; &lt;command&gt;
                </p>
              </div>
            )}
          </div>
        )}

        <div
          className="feature-studio-info-strip"
          style={{ borderColor: `${ACCENT}22`, color: `${ACCENT}99` }}
        >
          <AppWindow size={12} />
          Atpo manages Opta module lifecycle · apps, MCP servers, and capability
          extensions
        </div>
      </div>
    </div>
  );
}
