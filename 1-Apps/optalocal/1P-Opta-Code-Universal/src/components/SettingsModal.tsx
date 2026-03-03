import { useState, useEffect } from "react";
import {
  X,
  Network,
  Cpu,
  ShieldAlert,
  CpuIcon,
  Webhook,
  Fingerprint,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { DaemonConnectionOptions } from "../types";
import { probeDaemonConnection } from "../lib/connectionProbe";
import {
  daemonClient,
  type DaemonLmxEndpointCandidate,
} from "../lib/daemonClient";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  connection: DaemonConnectionOptions;
  onSaveConnection: (conn: DaemonConnectionOptions) => void;
}

type TabId = "connection" | "lmx" | "models" | "autonomy" | "genui";

function parseHostList(raw: string): string[] {
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(
      (entry, index, list) => entry.length > 0 && list.indexOf(entry) === index,
    );
}

function normalizeAdminKeyMap(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const next: Record<string, string> = {};
  for (const [host, key] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof key !== "string") continue;
    const hostTrimmed = host.trim();
    const keyTrimmed = key.trim();
    if (!hostTrimmed || !keyTrimmed) continue;
    next[hostTrimmed] = keyTrimmed;
  }
  return next;
}

function parseAdminKeysByHostInput(raw: string): Record<string, string> {
  const trimmed = raw.trim();
  if (!trimmed) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error('Admin keys must be valid JSON object: {"host":"key"}');
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Admin keys must be a JSON object");
  }
  return normalizeAdminKeyMap(parsed);
}

function formatAdminKeysByHost(raw: unknown): string {
  const map =
    typeof raw === "string"
      ? (() => {
          try {
            return normalizeAdminKeyMap(JSON.parse(raw));
          } catch {
            return {};
          }
        })()
      : normalizeAdminKeyMap(raw);
  return JSON.stringify(map, null, 2);
}

export function SettingsModal({
  isOpen,
  onClose,
  connection,
  onSaveConnection,
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>("connection");

  // --- Connection State ---
  const [connForm, setConnForm] = useState({
    host: connection.host,
    port: String(connection.port),
    token: connection.token,
    protocol: connection.protocol ?? "",
  });
  const [showToken, setShowToken] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [probeMessage, setProbeMessage] = useState<{
    text: string;
    status: "ok" | "err" | "testing";
  } | null>(null);

  // --- LMX Target State ---
  const [lmxHost, setLmxHost] = useState("");
  const [lmxPort, setLmxPort] = useState("1234");
  const [lmxFallbackHosts, setLmxFallbackHosts] = useState("");
  const [lmxAutoDiscover, setLmxAutoDiscover] = useState(true);
  const [lmxAdminKey, setLmxAdminKey] = useState("");
  const [lmxAdminKeysByHost, setLmxAdminKeysByHost] = useState("{}");
  const [lmxEndpoints, setLmxEndpoints] = useState<
    DaemonLmxEndpointCandidate[]
  >([]);
  const [lmxNotice, setLmxNotice] = useState<string | null>(null);
  const [lmxLoading, setLmxLoading] = useState(false);
  const [lmxSaving, setLmxSaving] = useState(false);
  const [lmxTesting, setLmxTesting] = useState(false);

  // --- Autonomy State ---
  const [autonomyLevel, setAutonomyLevel] = useState(2);
  const [autonomyMode, setAutonomyMode] = useState("execution");

  // --- GenUI State ---
  const [genuiEnabled, setGenuiEnabled] = useState(true);
  const [genuiAutoOpen, setGenuiAutoOpen] = useState(true);

  useEffect(() => {
    setConnForm({
      host: connection.host,
      port: String(connection.port),
      token: connection.token,
      protocol: connection.protocol ?? "",
    });
    setProbeMessage(null);
    setLmxNotice(null);
  }, [connection, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    const loadRemoteSettings = async () => {
      setLmxLoading(true);
      try {
        // Parallel fetch of remote config state from daemon
        const [
          hostRaw,
          portRaw,
          fallbackRaw,
          autoDiscRaw,
          adminKeyRaw,
          adminKeysByHostRaw,
          discovery,
          autoLevelRaw,
          autoModeRaw,
          genuiEnRaw,
          genuiAutoRaw,
        ] = await Promise.all([
          daemonClient
            .configGet(connection, "connection.host")
            .catch(() => connection.host),
          daemonClient
            .configGet(connection, "connection.port")
            .catch(() => connection.port),
          daemonClient
            .configGet(connection, "connection.fallbackHosts")
            .catch(() => []),
          daemonClient
            .configGet(connection, "connection.autoDiscover")
            .catch(() => true),
          daemonClient
            .configGet(connection, "connection.adminKey")
            .catch(() => ""),
          daemonClient
            .configGet(connection, "connection.adminKeysByHost")
            .catch(() => ({})),
          daemonClient.lmxDiscovery(connection).catch(() => null),
          daemonClient.configGet(connection, "autonomy.level").catch(() => 2),
          daemonClient
            .configGet(connection, "autonomy.mode")
            .catch(() => "execution"),
          daemonClient.configGet(connection, "genui.enabled").catch(() => true),
          daemonClient
            .configGet(connection, "genui.autoOpenBrowser")
            .catch(() => true),
        ]);

        if (cancelled) return;

        setLmxHost(typeof hostRaw === "string" ? hostRaw : connection.host);
        setLmxPort(String(portRaw ?? connection.port));
        setLmxFallbackHosts(
          Array.isArray(fallbackRaw) ? fallbackRaw.join(", ") : "",
        );
        setLmxAutoDiscover(autoDiscRaw === true || autoDiscRaw === "true");
        setLmxAdminKey(typeof adminKeyRaw === "string" ? adminKeyRaw : "");
        setLmxAdminKeysByHost(formatAdminKeysByHost(adminKeysByHostRaw));
        setLmxEndpoints(daemonClient.extractLmxEndpointCandidates(discovery));

        setAutonomyLevel(typeof autoLevelRaw === "number" ? autoLevelRaw : 2);
        setAutonomyMode(
          typeof autoModeRaw === "string" ? autoModeRaw : "execution",
        );

        setGenuiEnabled(genuiEnRaw === true || genuiEnRaw === "true");
        setGenuiAutoOpen(genuiAutoRaw === true || genuiAutoRaw === "true");
      } catch (error) {
        if (!cancelled)
          console.error("Failed to load settings from daemon", error);
      } finally {
        if (!cancelled) setLmxLoading(false);
      }
    };

    void loadRemoteSettings();
    return () => {
      cancelled = true;
    };
  }, [connection, isOpen]);

  async function runConnectionProbe() {
    const nextPort = Number.parseInt(connForm.port, 10);
    if (!Number.isFinite(nextPort)) {
      setProbeMessage({ text: "Invalid port", status: "err" });
      return;
    }

    setTestingConnection(true);
    setProbeMessage({ text: "Testing daemon endpoint...", status: "testing" });
    try {
      const probe = await probeDaemonConnection({
        host: connForm.host.trim() || connection.host,
        port: nextPort,
        token: connForm.token.trim(),
        protocol:
          connForm.protocol === "http" || connForm.protocol === "https"
            ? connForm.protocol
            : undefined,
      });

      if (probe.type !== "offline" && !connForm.protocol) {
        setConnForm((prev) => ({ ...prev, protocol: probe.protocol }));
      }

      if (probe.type === "offline") {
        setProbeMessage({ text: `Failed: ${probe.diagnostic}`, status: "err" });
      } else {
        setProbeMessage({ text: `Connected: ${probe.url}`, status: "ok" });
      }
    } catch (error) {
      setProbeMessage({
        text: `Failed: ${error instanceof Error ? error.message : String(error)}`,
        status: "err",
      });
    } finally {
      setTestingConnection(false);
    }
  }

  async function saveRemoteSettings(key: string, value: unknown) {
    try {
      await daemonClient.configSet(connection, key, value);
    } catch (e) {
      console.error(`Failed to save ${key}`, e);
    }
  }

  if (!isOpen) return null;

  async function runLmxAccessProbe() {
    setLmxTesting(true);
    setLmxNotice("Testing LMX admin access...");
    try {
      const status = await daemonClient.lmxStatus(connection);
      const modelCount = Array.isArray(status.models)
        ? status.models.length
        : 0;
      setLmxNotice(
        `LMX admin reachable (${modelCount} loaded model${modelCount === 1 ? "" : "s"}).`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const lower = message.toLowerCase();
      if (
        lower.includes("invalid or missing admin key") ||
        lower.includes("unauthorized") ||
        lower.includes("401") ||
        lower.includes("403")
      ) {
        setLmxNotice(
          "LMX reachable but admin access is unauthorized. Verify connection.adminKey and connection.adminKeysByHost.",
        );
      } else if (lower.includes("timed out")) {
        setLmxNotice(
          "LMX check timed out. Verify host/port routing and network reachability.",
        );
      } else {
        setLmxNotice(`LMX probe failed: ${message}`);
      }
    } finally {
      setLmxTesting(false);
    }
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case "connection":
        return (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <h3 className="opta-studio-section-title">Daemon Connection</h3>
            <p
              style={{
                color: "#a1a1aa",
                fontSize: "0.85rem",
                marginBottom: "1.5rem",
                lineHeight: 1.5,
              }}
            >
              Connect Opta Code to the local daemon that brokers LLM
              communication, file operations, and ATPO cycles.
            </p>

            <div className="opta-studio-form-group">
              <label>Daemon Host</label>
              <input
                className="opta-studio-input"
                placeholder="127.0.0.1"
                value={connForm.host}
                onChange={(e) =>
                  setConnForm((prev) => ({ ...prev, host: e.target.value }))
                }
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "1rem",
              }}
            >
              <div className="opta-studio-form-group">
                <label>Port</label>
                <input
                  className="opta-studio-input"
                  placeholder="9999"
                  value={connForm.port}
                  onChange={(e) =>
                    setConnForm((prev) => ({ ...prev, port: e.target.value }))
                  }
                />
              </div>
              <div className="opta-studio-form-group">
                <label>Protocol</label>
                <select
                  className="opta-studio-select"
                  value={connForm.protocol}
                  onChange={(e) =>
                    setConnForm((prev) => ({
                      ...prev,
                      protocol: e.target.value,
                    }))
                  }
                >
                  <option value="">Auto-detect</option>
                  <option value="http">HTTP (Local)</option>
                  <option value="https">HTTPS (Secure)</option>
                </select>
              </div>
            </div>

            <div className="opta-studio-form-group">
              <label>Auth Token</label>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input
                  className="opta-studio-input"
                  type={showToken ? "text" : "password"}
                  placeholder="Leave blank for unauthenticated"
                  value={connForm.token}
                  onChange={(e) =>
                    setConnForm((prev) => ({ ...prev, token: e.target.value }))
                  }
                />
                <button
                  type="button"
                  className="opta-studio-btn-secondary"
                  onClick={() => setShowToken(!showToken)}
                >
                  {showToken ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: "2rem",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "1rem" }}
              >
                <button
                  type="button"
                  className="opta-studio-btn-secondary"
                  onClick={runConnectionProbe}
                  disabled={testingConnection}
                >
                  {testingConnection ? "Testing..." : "Test Connection"}
                </button>
                {probeMessage && (
                  <div
                    className={`opta-studio-status-badge ${probeMessage.status === "ok" ? "connected" : "disconnected"}`}
                  >
                    <div
                      className={`opta-studio-dot ${probeMessage.status === "ok" ? "connected" : "disconnected"}`}
                    />
                    {probeMessage.text}
                  </div>
                )}
              </div>
              <button
                className="opta-studio-btn"
                onClick={() => {
                  onSaveConnection({
                    host: connForm.host.trim() || connection.host,
                    port: Number.parseInt(connForm.port, 10) || connection.port,
                    token: connForm.token.trim(),
                    protocol:
                      connForm.protocol === "http" ||
                      connForm.protocol === "https"
                        ? connForm.protocol
                        : undefined,
                  });
                  onClose();
                }}
              >
                Save & Reconnect
              </button>
            </div>
          </motion.div>
        );
      case "autonomy":
        return (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h3 className="opta-studio-section-title">ATPO Autonomy</h3>
            <p
              style={{
                color: "#a1a1aa",
                fontSize: "0.85rem",
                marginBottom: "1.5rem",
                lineHeight: 1.5,
              }}
            >
              Configure the default Agentic Task Planning & Orchestration (ATPO)
              profile. Higher levels allow the AI to execute more tools
              autonomously without asking for permission.
            </p>

            <div className="opta-studio-slider-container">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "0.5rem",
                }}
              >
                <span
                  style={{
                    color: "#fafafa",
                    fontFamily: "Sora",
                    fontWeight: 500,
                  }}
                >
                  Autonomy Level {autonomyLevel}
                </span>
                <span
                  style={{
                    color: "#a855f7",
                    fontFamily: "JetBrains Mono",
                    fontSize: "0.8rem",
                  }}
                >
                  {autonomyLevel === 5 ? "MAX" : "SAFE"}
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                value={autonomyLevel}
                className="opta-studio-slider"
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setAutonomyLevel(val);
                  void saveRemoteSettings("autonomy.level", val);
                }}
              />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  color: "#a1a1aa",
                  fontSize: "0.75rem",
                  fontFamily: "Sora",
                }}
              >
                <span>L1: Supervised</span>
                <span>L3: Balanced</span>
                <span>L5: CEO (Unattended)</span>
              </div>
            </div>

            <div style={{ marginTop: "2rem" }}>
              <div className="opta-studio-form-group">
                <label>Operating Mode</label>
                <select
                  className="opta-studio-select"
                  value={autonomyMode}
                  onChange={(e) => {
                    setAutonomyMode(e.target.value);
                    void saveRemoteSettings("autonomy.mode", e.target.value);
                  }}
                >
                  <option value="execution">
                    Execution (Fast, Action-Biased)
                  </option>
                  <option value="ceo">
                    CEO (Deliberative, Multi-Stage ATPO)
                  </option>
                </select>
              </div>
            </div>
          </motion.div>
        );
      case "genui":
        return (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h3 className="opta-studio-section-title">Generative UI</h3>
            <p
              style={{
                color: "#a1a1aa",
                fontSize: "0.85rem",
                marginBottom: "1.5rem",
                lineHeight: 1.5,
              }}
            >
              Enable rich HTML artifact generation and auto-browser launching.
              When enabled, the local LMX model will stream fully styled, Opta
              Aesthetic interfaces.
            </p>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
                marginBottom: "2rem",
              }}
            >
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={genuiEnabled}
                  style={{
                    width: "18px",
                    height: "18px",
                    accentColor: "#8b5cf6",
                  }}
                  onChange={(e) => {
                    setGenuiEnabled(e.target.checked);
                    void saveRemoteSettings("genui.enabled", e.target.checked);
                  }}
                />
                <span
                  style={{
                    fontFamily: "Sora",
                    color: "#fafafa",
                    fontSize: "0.9rem",
                  }}
                >
                  Enable GenUI Artifacts
                </span>
              </label>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={genuiAutoOpen}
                  style={{
                    width: "18px",
                    height: "18px",
                    accentColor: "#8b5cf6",
                  }}
                  onChange={(e) => {
                    setGenuiAutoOpen(e.target.checked);
                    void saveRemoteSettings(
                      "genui.autoOpenBrowser",
                      e.target.checked,
                    );
                  }}
                />
                <span
                  style={{
                    fontFamily: "Sora",
                    color: "#fafafa",
                    fontSize: "0.9rem",
                  }}
                >
                  Automatically Open in Browser
                </span>
              </label>
            </div>

            <h4
              style={{
                color: "#fafafa",
                fontFamily: "Sora",
                fontSize: "0.95rem",
                marginBottom: "1rem",
              }}
            >
              Available GenUI Actions
            </h4>
            <div className="opta-studio-action-grid">
              <div className="opta-studio-card">
                <h4>Generate UI</h4>
                <p>
                  Prompt the agent to scaffold a production-ready HTML view
                  (/gu).
                </p>
              </div>
              <div className="opta-studio-card">
                <h4>Improve</h4>
                <p>
                  Iterate on existing UI to fix layouts and hierarchy
                  (/improve).
                </p>
              </div>
              <div className="opta-studio-card">
                <h4>ATPO Dashboard</h4>
                <p>
                  Generate a visual dashboard of the current agent planning
                  state (/atpo).
                </p>
              </div>
              <div className="opta-studio-card">
                <h4>Code Review</h4>
                <p>
                  Generate an interactive HTML security and review report
                  (/codereview).
                </p>
              </div>
            </div>
          </motion.div>
        );
      case "lmx":
        return (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h3 className="opta-studio-section-title">LMX Inference Routing</h3>
            <p
              style={{
                color: "#a1a1aa",
                fontSize: "0.85rem",
                marginBottom: "1.5rem",
                lineHeight: 1.5,
              }}
            >
              Configure where the local daemon routes inference requests. This
              is useful for connecting to a remote Mac Studio.
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "3fr 1fr",
                gap: "1rem",
              }}
            >
              <div className="opta-studio-form-group">
                <label>LMX Host</label>
                <input
                  className="opta-studio-input"
                  value={lmxHost}
                  onChange={(e) => setLmxHost(e.target.value)}
                />
              </div>
              <div className="opta-studio-form-group">
                <label>Port</label>
                <input
                  className="opta-studio-input"
                  value={lmxPort}
                  onChange={(e) => setLmxPort(e.target.value)}
                />
              </div>
            </div>

            <div className="opta-studio-form-group">
              <label>Fallback Hosts (Comma separated)</label>
              <input
                className="opta-studio-input"
                value={lmxFallbackHosts}
                onChange={(e) => setLmxFallbackHosts(e.target.value)}
              />
            </div>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.6rem",
                marginBottom: "1rem",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={lmxAutoDiscover}
                style={{
                  width: "16px",
                  height: "16px",
                  accentColor: "#8b5cf6",
                }}
                onChange={(e) => setLmxAutoDiscover(e.target.checked)}
              />
              <span
                style={{
                  color: "#fafafa",
                  fontFamily: "Sora",
                  fontSize: "0.86rem",
                }}
              >
                Auto-discover LAN LMX endpoints
              </span>
            </label>

            <div className="opta-studio-form-group">
              <label>Default Admin Key</label>
              <input
                className="opta-studio-input"
                type="password"
                value={lmxAdminKey}
                onChange={(e) => setLmxAdminKey(e.target.value)}
                placeholder="Optional global admin key"
              />
            </div>

            <div className="opta-studio-form-group">
              <label>Admin Keys by Host (JSON)</label>
              <textarea
                className="opta-studio-input"
                value={lmxAdminKeysByHost}
                onChange={(e) => setLmxAdminKeysByHost(e.target.value)}
                rows={6}
                spellCheck={false}
                placeholder='{"192.168.188.11":"keyA","192.168.188.8":"keyB"}'
              />
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: "1rem",
              }}
            >
              <button
                className="opta-studio-btn-secondary"
                disabled={lmxTesting}
                onClick={() => {
                  void runLmxAccessProbe();
                }}
                style={{ marginRight: "0.75rem" }}
              >
                {lmxTesting ? "Testing..." : "Test LMX Access"}
              </button>
              <button
                className="opta-studio-btn"
                disabled={lmxSaving}
                onClick={async () => {
                  setLmxSaving(true);
                  const nextPort = Number.parseInt(lmxPort, 10);
                  if (
                    !Number.isFinite(nextPort) ||
                    nextPort <= 0 ||
                    nextPort > 65_535
                  ) {
                    setLmxNotice(
                      "Port must be a valid number between 1 and 65535.",
                    );
                    setLmxSaving(false);
                    return;
                  }

                  let adminMap: Record<string, string>;
                  try {
                    adminMap = parseAdminKeysByHostInput(lmxAdminKeysByHost);
                  } catch (err) {
                    setLmxNotice(
                      err instanceof Error ? err.message : String(err),
                    );
                    setLmxSaving(false);
                    return;
                  }

                  try {
                    await Promise.all([
                      daemonClient.configSet(
                        connection,
                        "connection.host",
                        lmxHost.trim(),
                      ),
                      daemonClient.configSet(
                        connection,
                        "connection.port",
                        nextPort,
                      ),
                      daemonClient.configSet(
                        connection,
                        "connection.fallbackHosts",
                        parseHostList(lmxFallbackHosts),
                      ),
                      daemonClient.configSet(
                        connection,
                        "connection.autoDiscover",
                        lmxAutoDiscover,
                      ),
                      daemonClient.configSet(
                        connection,
                        "connection.adminKey",
                        lmxAdminKey.trim(),
                      ),
                      daemonClient.configSet(
                        connection,
                        "connection.adminKeysByHost",
                        adminMap,
                      ),
                    ]);
                    setLmxNotice("LMX routing + admin auth settings saved.");
                  } catch (err) {
                    setLmxNotice(
                      `Failed to save LMX settings: ${err instanceof Error ? err.message : String(err)}`,
                    );
                  }
                  setLmxSaving(false);
                }}
              >
                {lmxSaving ? "Saving..." : "Save Routing"}
              </button>
            </div>
            {lmxNotice ? (
              <p
                style={{
                  marginTop: "0.75rem",
                  color: "#a1a1aa",
                  fontSize: "0.8rem",
                }}
              >
                {lmxNotice}
              </p>
            ) : null}
          </motion.div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="opta-studio-backdrop" onClick={onClose}>
      <div className="opta-studio-shell" onClick={(e) => e.stopPropagation()}>
        <header className="opta-studio-header">
          <h2>
            <span className="moonlight">Opta</span> Settings Studio
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "#a1a1aa",
              cursor: "pointer",
            }}
          >
            <X size={20} />
          </button>
        </header>

        <div className="opta-studio-layout">
          <aside className="opta-studio-sidebar">
            <button
              className={`opta-studio-tab ${activeTab === "connection" ? "active" : ""}`}
              onClick={() => setActiveTab("connection")}
            >
              <Network size={16} /> Client Connection
            </button>
            <button
              className={`opta-studio-tab ${activeTab === "lmx" ? "active" : ""}`}
              onClick={() => setActiveTab("lmx")}
            >
              <Cpu size={16} /> LMX Routing
            </button>
            <button
              className={`opta-studio-tab ${activeTab === "autonomy" ? "active" : ""}`}
              onClick={() => setActiveTab("autonomy")}
            >
              <ShieldAlert size={16} /> ATPO Autonomy
            </button>
            <button
              className={`opta-studio-tab ${activeTab === "genui" ? "active" : ""}`}
              onClick={() => setActiveTab("genui")}
            >
              <Webhook size={16} /> Generative UI
            </button>
          </aside>

          <main className="opta-studio-content">
            <AnimatePresence mode="wait">{renderTabContent()}</AnimatePresence>
          </main>
        </div>
      </div>
    </div>
  );
}
