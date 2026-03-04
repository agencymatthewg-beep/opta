import { useState, useEffect, useCallback } from "react";
import {
  X,
  Network,
  Cpu,
  ShieldAlert,
  Webhook,
  Terminal,
  RefreshCw,
  RotateCcw,
  Lightbulb,
  Copy,
  CheckCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { DaemonConnectionOptions } from "../types";
import { probeDaemonConnection } from "../lib/connectionProbe";
import {
  daemonClient,
  type DaemonLmxEndpointCandidate,
} from "../lib/daemonClient";
import { ConnectionAddressBook } from "./settings/ConnectionAddressBook";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  connection: DaemonConnectionOptions;
  onSaveConnection: (conn: DaemonConnectionOptions) => void;
}

type TabId = "connection" | "lmx" | "models" | "autonomy" | "genui" | "daemon";

const DEFAULT_CONNECTION_FORM = {
  host: "127.0.0.1",
  port: "9999",
  token: "",
  protocol: "",
};

const DEFAULT_LMX = {
  host: "192.168.188.11",
  port: "1234",
  fallbackHosts: "",
  autoDiscover: true,
  adminKey: "",
  adminKeysByHost: "{}",
};

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
  const [copiedToken, setCopiedToken] = useState(false);
  const [probeMessage, setProbeMessage] = useState<{
    text: string;
    status: "ok" | "err" | "testing";
  } | null>(null);

  // --- Daemon Controls State ---
  const [daemonStatus, setDaemonStatus] = useState<string | null>(null);
  const [daemonStatusLoading, setDaemonStatusLoading] = useState(false);
  const [daemonOpResult, setDaemonOpResult] = useState<string | null>(null);
  const [daemonOpRunning, setDaemonOpRunning] = useState(false);

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

  // NOTE: All hooks and functions that use state setters must live BEFORE the early-return
  // guard below. React requires hooks to be called unconditionally in the same order.

  const runDaemonOp = useCallback(async (op: string) => {
    setDaemonOpRunning(true);
    setDaemonOpResult(null);
    try {
      const response = await daemonClient.runOperation(connection, op, {});
      if (response.ok) {
        setDaemonOpResult(`✓ ${op} completed successfully.`);
      } else {
        setDaemonOpResult(`✗ ${op} failed: ${response.error?.message ?? "Unknown error"}`);
      }
    } catch (err) {
      setDaemonOpResult(`✗ ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setDaemonOpRunning(false);
    }
  }, [connection]);

  const checkDaemonHealth = useCallback(async () => {
    setDaemonStatusLoading(true);
    setDaemonStatus(null);
    try {
      const result = await daemonClient.health(connection);
      setDaemonStatus(`✓ Daemon online — status: ${result.status}`);
    } catch (err) {
      setDaemonStatus(`✗ Daemon offline or unreachable: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setDaemonStatusLoading(false);
    }
  }, [connection]);

  const copyToken = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(connForm.token);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    } catch { /* ignore */ }
  }, [connForm.token]);

  // --- LMX Probe (regular async fn, not a hook) ---
  async function runLmxAccessProbe() {
    setLmxTesting(true);
    setLmxNotice("Testing LMX admin access...");
    try {
      const status = await daemonClient.lmxStatus(connection);
      const modelCount = Array.isArray(status.models)
        ? status.models.length
        : 0;
      setLmxNotice(
        `✓ LMX admin reachable — ${modelCount} loaded model${modelCount === 1 ? "" : "s"}.`,
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
          "✗ LMX reachable but admin access is unauthorized. Check 'Default Admin Key' — run `opta config get connection.adminKey` in terminal to find it.",
        );
      } else if (lower.includes("404") || lower.includes("not found")) {
        setLmxNotice(
          "✗ LMX host responded but the status endpoint was not found (404). The LMX server may be running an older version, or the host/port points to a non-LMX service. Check LMX Host & Port.",
        );
      } else if (lower.includes("timed out")) {
        setLmxNotice(
          "✗ LMX check timed out. The Mac Studio at this IP may be offline or the port is blocked. Try pinging it first.",
        );
      } else if (lower.includes("connection refused") || lower.includes("econnrefused")) {
        setLmxNotice(
          "✗ Connection refused — LMX is not running at this host/port. Start it with `opta-lmx` on the Mac Studio.",
        );
      } else {
        setLmxNotice(`✗ LMX probe failed: ${message}`);
      }
    } finally {
      setLmxTesting(false);
    }
  }

  // --- Early return gate (must come AFTER all hooks) ---
  if (!isOpen) return null;


  const renderTabContent = () => {
    switch (activeTab) {
      case "connection":
        return (
          <motion.div
            key="connection"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
              <div>
                <h3 className="opta-studio-section-title" style={{ marginBottom: "0.4rem" }}>Client Connection</h3>
                <p style={{ color: "#a1a1aa", fontSize: "0.85rem", lineHeight: 1.5, margin: 0 }}>
                  Manage saved daemon targets and discover new ones on your local network.
                </p>
              </div>
            </div>
            <ConnectionAddressBook
              activeConnection={connection}
              onConnectionChange={onSaveConnection}
            />
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
              <div>
                <h3 className="opta-studio-section-title" style={{ marginBottom: "0.4rem" }}>LMX Inference Routing</h3>
                <p style={{ color: "#a1a1aa", fontSize: "0.85rem", lineHeight: 1.5, margin: 0 }}>
                  Where the daemon routes inference requests. Point this to your Mac Studio.
                </p>
              </div>
              <button
                type="button"
                className="opta-studio-btn-secondary"
                style={{ whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.78rem" }}
                onClick={() => {
                  setLmxHost(DEFAULT_LMX.host);
                  setLmxPort(DEFAULT_LMX.port);
                  setLmxFallbackHosts(DEFAULT_LMX.fallbackHosts);
                  setLmxAutoDiscover(DEFAULT_LMX.autoDiscover);
                  setLmxAdminKey(DEFAULT_LMX.adminKey);
                  setLmxAdminKeysByHost(DEFAULT_LMX.adminKeysByHost);
                }}
              >
                <RotateCcw size={13} /> Restore Defaults
              </button>
            </div>

            <div
              style={{
                padding: "10px 14px",
                borderRadius: "8px",
                border: "1px solid rgba(139,92,246,0.3)",
                background: "rgba(139,92,246,0.08)",
                marginBottom: "1.5rem",
                display: "flex",
                gap: "0.5rem",
                alignItems: "flex-start",
              }}
            >
              <Lightbulb size={14} style={{ color: "#a855f7", marginTop: "2px", flexShrink: 0 }} />
              <p style={{ margin: 0, fontSize: "0.79rem", color: "#c4b5fd", lineHeight: 1.5 }}>
                Your Mac Studio address is typically <code style={{ fontFamily: "JetBrains Mono", fontSize: "0.78rem" }}>192.168.188.11</code> on port <code style={{ fontFamily: "JetBrains Mono", fontSize: "0.78rem" }}>1234</code>. Get the LMX admin key by running <code style={{ fontFamily: "JetBrains Mono", fontSize: "0.78rem" }}>opta config get connection.adminKey</code> on the Mac Studio.
              </p>
            </div>

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
      case "daemon":
        return (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h3 className="opta-studio-section-title" style={{ marginBottom: "0.4rem" }}>Daemon Control Centre</h3>
            <p style={{ color: "#a1a1aa", fontSize: "0.85rem", marginBottom: "1.5rem", lineHeight: 1.5 }}>
              Start, stop, or restart the Opta daemon process. The daemon must be running for all Opta Code features to work.
            </p>

            <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap" }}>
              <button
                type="button"
                className="opta-studio-btn-secondary"
                disabled={daemonStatusLoading}
                onClick={() => void checkDaemonHealth()}
                style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
              >
                <RefreshCw size={14} style={daemonStatusLoading ? { animation: "spin 1s linear infinite" } : {}} />
                {daemonStatusLoading ? "Checking..." : "Check Health"}
              </button>
              <button
                type="button"
                className="opta-studio-btn"
                disabled={daemonOpRunning}
                onClick={() => void runDaemonOp("daemon.start")}
              >
                Start Daemon
              </button>
              <button
                type="button"
                className="opta-studio-btn-secondary"
                disabled={daemonOpRunning}
                onClick={() => void runDaemonOp("daemon.stop")}
                style={{ borderColor: "rgba(239,68,68,0.4)", color: "#fca5a5" }}
              >
                Stop Daemon
              </button>
            </div>

            {daemonStatus && (
              <div style={{
                padding: "10px 14px",
                borderRadius: "8px",
                border: `1px solid ${daemonStatus.startsWith("✓") ? "rgba(16,185,129,0.35)" : "rgba(239,68,68,0.35)"}`,
                background: daemonStatus.startsWith("✓") ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
                marginBottom: "1rem",
                fontSize: "0.8rem",
                color: daemonStatus.startsWith("✓") ? "rgba(110,231,183,0.95)" : "rgba(252,165,165,0.95)",
                fontFamily: "JetBrains Mono",
              }}>
                {daemonStatus}
              </div>
            )}

            {daemonOpResult && (
              <div style={{
                padding: "10px 14px",
                borderRadius: "8px",
                border: `1px solid ${daemonOpResult.startsWith("✓") ? "rgba(16,185,129,0.35)" : "rgba(239,68,68,0.35)"}`,
                background: daemonOpResult.startsWith("✓") ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
                marginBottom: "1rem",
                fontSize: "0.8rem",
                color: daemonOpResult.startsWith("✓") ? "rgba(110,231,183,0.95)" : "rgba(252,165,165,0.95)",
                fontFamily: "JetBrains Mono",
              }}>
                {daemonOpResult}
              </div>
            )}

            <div
              style={{
                padding: "12px 16px",
                borderRadius: "8px",
                border: "1px solid var(--opta-border)",
                background: "rgba(0,0,0,0.2)",
              }}
            >
              <h4 style={{ margin: "0 0 8px", fontSize: "0.85rem", color: "#fafafa", fontFamily: "Sora" }}>Quick Reference</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {[
                  ["Start daemon", "opta daemon start"],
                  ["Stop daemon", "opta daemon stop"],
                  ["Check status", "opta daemon status"],
                  ["View logs", "opta daemon logs"],
                  ["Get admin key", "opta config get connection.adminKey"],
                ].map(([label, cmd]) => (
                  <div key={cmd} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
                    <span style={{ fontSize: "0.78rem", color: "#a1a1aa" }}>{label}</span>
                    <code style={{ fontFamily: "JetBrains Mono", fontSize: "0.74rem", color: "#c4b5fd", background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)", borderRadius: "4px", padding: "2px 6px" }}>{cmd}</code>
                  </div>
                ))}
              </div>
            </div>
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
            <button
              className={`opta-studio-tab ${activeTab === "daemon" ? "active" : ""}`}
              onClick={() => setActiveTab("daemon")}
            >
              <Terminal size={16} /> Daemon Controls
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
