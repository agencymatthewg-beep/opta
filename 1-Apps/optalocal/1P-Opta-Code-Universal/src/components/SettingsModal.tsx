import {
  Suspense,
  useState,
  useEffect,
  useCallback,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  ArrowUp,
  X,
  RefreshCw,
  RotateCcw,
  Lightbulb,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { DaemonConnectionOptions } from "../types";
import { probeDaemonConnection } from "../lib/connectionProbe";
import {
  daemonClient,
  type DaemonLmxEndpointCandidate,
} from "../lib/daemonClient";
import { ConnectionAddressBook } from "./settings/ConnectionAddressBook";
import { SettingsTabModelProvider } from "./settings/SettingsTabModelProvider";
import { SettingsTabPermissions } from "./settings/SettingsTabPermissions";
import { SettingsTabSafety } from "./settings/SettingsTabSafety";
import { SettingsTabBrowser } from "./settings/SettingsTabBrowser";
import { SettingsTabResearch } from "./settings/SettingsTabResearch";
import { SettingsTabToolsAgents } from "./settings/SettingsTabToolsAgents";
import { SettingsTabLearning } from "./settings/SettingsTabLearning";
import { SettingsTabPolicy } from "./settings/SettingsTabPolicy";
import { SettingsTabMcp } from "./settings/SettingsTabMcp";
import { SettingsTabFleet } from "./settings/SettingsTabFleet";
import { SettingsTabSecrets } from "./settings/SettingsTabSecrets";
import { ErrorBoundary } from "./ErrorBoundary";
import {
  LazyAccountControlPage,
  LazyAppCatalogPage,
  LazyBackgroundJobsPage,
  LazyCliOperationsPage,
  LazyConfigStudioPage,
  LazyDaemonControlPage,
  LazyDaemonLogsPage,
  LazyEnvProfilesPage,
  LazyMcpManagementPage,
  LazyModelAliasesPage,
  LazySessionMemoryPage,
  LazySystemInfoPage,
  LazySystemOperationsPage,
  preloadSettingsModalLazyTab,
} from "./settingsModalLazyPages";
import {
  SETTINGS_CATEGORIES,
  SETTINGS_CATEGORIES_BY_GROUP,
  SETTINGS_GROUP_LABELS,
  normalizeSettingsTabId,
  type SettingsCategoryGroup,
  type SettingsTabId,
} from "./settingsStudioConfig";

interface SettingsModalProps {
  isOpen: boolean;
  onClose?: () => void;
  initialTab?: SettingsTabId;
  connection: DaemonConnectionOptions;
  onSaveConnection: (conn: DaemonConnectionOptions) => void;
  embedded?: boolean;
  onBackLayer?: () => void;
  isDeepLayer?: boolean;
  isFullscreen?: boolean;
  activeTab?: SettingsTabId;
  isSettingEditMode?: boolean;
  onActiveTabChange?: (tab: SettingsTabId) => void;
  connectionState?: "connected" | "connecting" | "disconnected";
  defaultSessionId?: string | null;
  onManageTiles?: () => void;
}

const DEFAULT_CONNECTION_FORM = {
  host: "127.0.0.1",
  port: "9999",
  token: "",
  protocol: "",
};

const DEFAULT_LMX = {
  host: "127.0.0.1",
  port: "1234",
  fallbackHosts: "",
  autoDiscover: true,
  adminKey: "",
  adminKeysByHost: "{}",
};

const OPTA_LOGO_LETTERS = ["O", "P", "T", "A"] as const;

function SettingsLazyChunkFallback({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        minHeight: "160px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: "0.5rem",
        color: "var(--opta-text)",
      }}
    >
      <strong style={{ fontSize: "0.88rem", fontFamily: "Sora" }}>
        Loading {label}
      </strong>
      <p
        style={{
          margin: 0,
          fontSize: "0.8rem",
          color: "#a1a1aa",
        }}
      >
        This section is loaded on demand to reduce initial Settings Studio
        bundle cost.
      </p>
    </div>
  );
}

function SettingsLazyChunkError({
  label,
  error,
}: {
  label: string;
  error: Error;
}) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        border: "1px solid rgba(248,113,113,0.45)",
        borderRadius: "10px",
        padding: "0.9rem",
        background: "rgba(127,29,29,0.18)",
        color: "rgba(254,226,226,0.95)",
        display: "grid",
        gap: "0.45rem",
      }}
    >
      <strong style={{ fontSize: "0.88rem", fontFamily: "Sora" }}>
        {label} failed to load
      </strong>
      <p style={{ margin: 0, fontSize: "0.78rem", color: "rgba(254,202,202,0.94)" }}>
        Switch tabs and return to retry this chunk load. If it keeps failing,
        refresh the app.
      </p>
      <code
        style={{
          display: "block",
          fontSize: "0.72rem",
          borderRadius: "8px",
          padding: "0.55rem",
          overflowX: "auto",
          background: "rgba(0,0,0,0.3)",
          border: "1px solid rgba(248,113,113,0.3)",
          color: "rgba(254,202,202,0.95)",
        }}
      >
        {error.message}
      </code>
    </div>
  );
}

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

function readBooleanSetting(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value === "true") return true;
    if (value === "false") return false;
  }
  if (typeof value === "number") return value > 0;
  return fallback;
}

function readStringSetting(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function readPositiveInteger(value: unknown, fallback: number): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : Number.NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.round(parsed);
}

export function SettingsModal({
  isOpen,
  onClose,
  initialTab,
  connection,
  onSaveConnection,
  embedded = false,
  onBackLayer,
  isDeepLayer = false,
  isFullscreen = false,
  activeTab: controlledActiveTab,
  isSettingEditMode = false,
  onActiveTabChange,
  connectionState = "disconnected",
  defaultSessionId,
  onManageTiles,
}: SettingsModalProps) {
  const sidebarTabRefs =
    useRef<Partial<Record<SettingsTabId, HTMLButtonElement | null>>>({});
  const contentRef = useRef<HTMLElement | null>(null);
  const [internalActiveTab, setInternalActiveTab] =
    useState<SettingsTabId>("connection-network");
  const activeTab = normalizeSettingsTabId(
    controlledActiveTab ?? internalActiveTab,
  );
  const isTabControlled = controlledActiveTab !== undefined;

  const setActiveTab = useCallback(
    (tab: SettingsTabId) => {
      const normalizedTab = normalizeSettingsTabId(tab);
      if (!isTabControlled) {
        setInternalActiveTab(normalizedTab);
      }
      onActiveTabChange?.(normalizedTab);
    },
    [isTabControlled, onActiveTabChange],
  );

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

  // --- Unified Studio Category State ---
  const [runtimeAutoRestart, setRuntimeAutoRestart] = useState(true);
  const [runtimeMaxWorkers, setRuntimeMaxWorkers] = useState("4");
  const [runtimeHealthIntervalSec, setRuntimeHealthIntervalSec] = useState("12");

  const [mcpAutoSync, setMcpAutoSync] = useState(true);
  const [mcpRequireSigned, setMcpRequireSigned] = useState(false);
  const [mcpIsolationMode, setMcpIsolationMode] =
    useState<"workspace" | "profile" | "strict">("workspace");

  const [defaultProfileId, setDefaultProfileId] = useState("default");
  const [profileSwitchConfirm, setProfileSwitchConfirm] = useState(true);

  const [accountsDangerousAuthRequired, setAccountsDangerousAuthRequired] =
    useState(true);
  const [vaultAutoLockMinutes, setVaultAutoLockMinutes] = useState("15");

  const [tilesAutoDock, setTilesAutoDock] = useState(true);
  const [tilesShowTelemetry, setTilesShowTelemetry] = useState(true);
  const [tilesDensity, setTilesDensity] =
    useState<"compact" | "comfortable" | "cinema">("comfortable");

  const [appsInstallPolicy, setAppsInstallPolicy] =
    useState<"allowlisted" | "moderated" | "open">("moderated");
  const [appsAutoUpdate, setAppsAutoUpdate] = useState(true);

  const [memoryRetentionDays, setMemoryRetentionDays] = useState("30");
  const [memorySemanticRecall, setMemorySemanticRecall] = useState(true);
  const [memoryAutoSummaries, setMemoryAutoSummaries] = useState(true);

  const [cliConfirmDestructive, setCliConfirmDestructive] = useState(true);
  const [cliDefaultShell, setCliDefaultShell] =
    useState<"zsh" | "bash" | "pwsh">("zsh");
  const [cliVerboseDiagnostics, setCliVerboseDiagnostics] = useState(false);

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
    if (!isTabControlled) {
      setInternalActiveTab(normalizeSettingsTabId(initialTab));
      return;
    }
    if (initialTab) {
      onActiveTabChange?.(normalizeSettingsTabId(initialTab));
    }
  }, [isOpen, initialTab, isTabControlled, onActiveTabChange]);

  useEffect(() => {
    if (!isOpen || !onClose) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (embedded) return;
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [embedded, isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const sidebarTab = sidebarTabRefs.current[activeTab];
    sidebarTab?.scrollIntoView({
      block: "nearest",
      behavior: "smooth",
    });
    const deepLayout = contentRef.current?.closest(
      ".opta-studio-layout--deep",
    ) as HTMLElement | null;
    const scrollTarget =
      (deepLayout && deepLayout.scrollHeight > deepLayout.clientHeight + 1
        ? deepLayout
        : contentRef.current) ?? null;
    if (!scrollTarget) return;

    const resetScroll = () => {
      scrollTarget.scrollTo({
        top: 0,
        behavior: "auto",
      });
    };

    resetScroll();
    const rafId = window.requestAnimationFrame(resetScroll);
    const timeoutA = window.setTimeout(resetScroll, 80);
    const timeoutB = window.setTimeout(resetScroll, 180);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(timeoutA);
      window.clearTimeout(timeoutB);
    };
  }, [activeTab, isOpen, isDeepLayer]);

  useEffect(() => {
    if (!isOpen) return;
    preloadSettingsModalLazyTab(activeTab);
  }, [activeTab, isOpen]);

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
          runtimeAutoRestartRaw,
          runtimeMaxWorkersRaw,
          runtimeHealthIntervalRaw,
          mcpAutoSyncRaw,
          mcpRequireSignedRaw,
          mcpIsolationModeRaw,
          defaultProfileRaw,
          profileSwitchConfirmRaw,
          accountsDangerousAuthRequiredRaw,
          vaultAutoLockMinutesRaw,
          tilesAutoDockRaw,
          tilesShowTelemetryRaw,
          tilesDensityRaw,
          appsInstallPolicyRaw,
          appsAutoUpdateRaw,
          memoryRetentionDaysRaw,
          memorySemanticRecallRaw,
          memoryAutoSummariesRaw,
          cliConfirmDestructiveRaw,
          cliDefaultShellRaw,
          cliVerboseDiagnosticsRaw,
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
          daemonClient
            .configGet(connection, "runtime.autoRestart")
            .catch(() => true),
          daemonClient
            .configGet(connection, "runtime.maxWorkers")
            .catch(() => 4),
          daemonClient
            .configGet(connection, "runtime.healthIntervalSec")
            .catch(() => 12),
          daemonClient
            .configGet(connection, "mcp.autoSync")
            .catch(() => true),
          daemonClient
            .configGet(connection, "mcp.requireSignedRegistries")
            .catch(() => false),
          daemonClient
            .configGet(connection, "mcp.isolationMode")
            .catch(() => "workspace"),
          daemonClient
            .configGet(connection, "profiles.default")
            .catch(() => "default"),
          daemonClient
            .configGet(connection, "profiles.confirmSwitch")
            .catch(() => true),
          daemonClient
            .configGet(connection, "accounts.requireDangerousAuth")
            .catch(() => true),
          daemonClient
            .configGet(connection, "vault.autoLockMinutes")
            .catch(() => 15),
          daemonClient
            .configGet(connection, "workspace.tiles.autoDock")
            .catch(() => true),
          daemonClient
            .configGet(connection, "workspace.tiles.showTelemetry")
            .catch(() => true),
          daemonClient
            .configGet(connection, "workspace.tiles.density")
            .catch(() => "comfortable"),
          daemonClient
            .configGet(connection, "apps.installPolicy")
            .catch(() => "moderated"),
          daemonClient
            .configGet(connection, "apps.autoUpdate")
            .catch(() => true),
          daemonClient
            .configGet(connection, "memory.retentionDays")
            .catch(() => 30),
          daemonClient
            .configGet(connection, "memory.semanticRecall")
            .catch(() => true),
          daemonClient
            .configGet(connection, "memory.autoSummaries")
            .catch(() => true),
          daemonClient
            .configGet(connection, "cli.confirmDestructive")
            .catch(() => true),
          daemonClient
            .configGet(connection, "cli.defaultShell")
            .catch(() => "zsh"),
          daemonClient
            .configGet(connection, "cli.verboseDiagnostics")
            .catch(() => false),
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

        setRuntimeAutoRestart(readBooleanSetting(runtimeAutoRestartRaw, true));
        setRuntimeMaxWorkers(
          String(readPositiveInteger(runtimeMaxWorkersRaw, 4)),
        );
        setRuntimeHealthIntervalSec(
          String(readPositiveInteger(runtimeHealthIntervalRaw, 12)),
        );

        setMcpAutoSync(readBooleanSetting(mcpAutoSyncRaw, true));
        setMcpRequireSigned(readBooleanSetting(mcpRequireSignedRaw, false));
        setMcpIsolationMode(
          mcpIsolationModeRaw === "profile" || mcpIsolationModeRaw === "strict"
            ? mcpIsolationModeRaw
            : "workspace",
        );

        setDefaultProfileId(readStringSetting(defaultProfileRaw, "default"));
        setProfileSwitchConfirm(readBooleanSetting(profileSwitchConfirmRaw, true));

        setAccountsDangerousAuthRequired(
          readBooleanSetting(accountsDangerousAuthRequiredRaw, true),
        );
        setVaultAutoLockMinutes(
          String(readPositiveInteger(vaultAutoLockMinutesRaw, 15)),
        );

        setTilesAutoDock(readBooleanSetting(tilesAutoDockRaw, true));
        setTilesShowTelemetry(readBooleanSetting(tilesShowTelemetryRaw, true));
        setTilesDensity(
          tilesDensityRaw === "compact" || tilesDensityRaw === "cinema"
            ? tilesDensityRaw
            : "comfortable",
        );

        setAppsInstallPolicy(
          appsInstallPolicyRaw === "allowlisted" ||
            appsInstallPolicyRaw === "open"
            ? appsInstallPolicyRaw
            : "moderated",
        );
        setAppsAutoUpdate(readBooleanSetting(appsAutoUpdateRaw, true));

        setMemoryRetentionDays(
          String(readPositiveInteger(memoryRetentionDaysRaw, 30)),
        );
        setMemorySemanticRecall(readBooleanSetting(memorySemanticRecallRaw, true));
        setMemoryAutoSummaries(readBooleanSetting(memoryAutoSummariesRaw, true));

        setCliConfirmDestructive(
          readBooleanSetting(cliConfirmDestructiveRaw, true),
        );
        setCliDefaultShell(
          cliDefaultShellRaw === "bash" || cliDefaultShellRaw === "pwsh"
            ? cliDefaultShellRaw
            : "zsh",
        );
        setCliVerboseDiagnostics(
          readBooleanSetting(cliVerboseDiagnosticsRaw, false),
        );
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
          "✗ LMX check timed out. The configured host may be offline or the port is blocked. Try pinging it first.",
        );
      } else if (lower.includes("connection refused") || lower.includes("econnrefused")) {
        setLmxNotice(
          "✗ Connection refused — LMX is not running at this host/port. Start it with `opta-lmx` on the target host.",
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


  const renderConnectionModule = () => (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "1.5rem",
        }}
      >
        <div>
          <p style={{ color: "#a1a1aa", fontSize: "0.85rem", lineHeight: 1.5, margin: 0 }}>
            Manage saved daemon targets and discover new ones on your local network.
            Port <code style={{ fontFamily: "JetBrains Mono", fontSize: "0.78rem" }}>1234</code>{" "}
            is reserved for LMX inference, not daemon{" "}
            <code style={{ fontFamily: "JetBrains Mono", fontSize: "0.78rem" }}>/v3</code>{" "}
            traffic.
          </p>
        </div>
      </div>
      <ConnectionAddressBook
        activeConnection={connection}
        onConnectionChange={onSaveConnection}
      />
    </>
  );

  const renderAutonomyModule = () => (
    <>
      <p
        style={{
          color: "#a1a1aa",
          fontSize: "0.85rem",
          marginBottom: "1.5rem",
          lineHeight: 1.5,
        }}
      >
        Configure the default Agentic Task Planning & Orchestration profile. Higher
        levels allow the AI to execute more tools autonomously without asking for
        permission.
      </p>

      <div className="opta-studio-slider-container">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: "0.5rem",
          }}
        >
          <span style={{ color: "#fafafa", fontFamily: "Sora", fontWeight: 500 }}>
            Autonomy Level {autonomyLevel}
          </span>
          <span style={{ color: "#a855f7", fontFamily: "JetBrains Mono", fontSize: "0.8rem" }}>
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
            <option value="execution">Execution (Fast, Action-Biased)</option>
            <option value="ceo">CEO (Deliberative, Multi-Stage ATPO)</option>
          </select>
        </div>
      </div>
    </>
  );

  const renderGenUiModule = () => (
    <>
      <p
        style={{
          color: "#a1a1aa",
          fontSize: "0.85rem",
          marginBottom: "1.5rem",
          lineHeight: 1.5,
        }}
      >
        Enable rich HTML artifact generation and auto-browser launching.
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
          <span style={{ fontFamily: "Sora", color: "#fafafa", fontSize: "0.9rem" }}>
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
              void saveRemoteSettings("genui.autoOpenBrowser", e.target.checked);
            }}
          />
          <span style={{ fontFamily: "Sora", color: "#fafafa", fontSize: "0.9rem" }}>
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
          <p>Prompt the agent to scaffold a production-ready HTML view (/gu).</p>
        </div>
        <div className="opta-studio-card">
          <h4>Improve</h4>
          <p>Iterate on existing UI to fix layouts and hierarchy (/improve).</p>
        </div>
        <div className="opta-studio-card">
          <h4>ATPO Dashboard</h4>
          <p>Generate a visual dashboard of the current planning state (/atpo).</p>
        </div>
        <div className="opta-studio-card">
          <h4>Code Review</h4>
          <p>Generate an interactive HTML security and review report (/codereview).</p>
        </div>
      </div>
    </>
  );

  const renderLmxModule = () => (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
        <div>
          <p style={{ color: "#a1a1aa", fontSize: "0.85rem", lineHeight: 1.5, margin: 0 }}>
            Where the daemon routes inference requests. Point this to your LMX host.
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
          Use <code style={{ fontFamily: "JetBrains Mono", fontSize: "0.78rem" }}>localhost</code>{" "}
          for local LMX or <code style={{ fontFamily: "JetBrains Mono", fontSize: "0.78rem" }}>lmx-host.local</code>{" "}
          for LAN discovery, usually on port{" "}
          <code style={{ fontFamily: "JetBrains Mono", fontSize: "0.78rem" }}>1234</code>.
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
          placeholder='{"localhost":"keyA","lmx-host.local":"keyB"}'
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
              setLmxNotice("Port must be a valid number between 1 and 65535.");
              setLmxSaving(false);
              return;
            }

            let adminMap: Record<string, string>;
            try {
              adminMap = parseAdminKeysByHostInput(lmxAdminKeysByHost);
            } catch (err) {
              setLmxNotice(err instanceof Error ? err.message : String(err));
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
    </>
  );

  const renderDaemonModule = () => (
    <>
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
    </>
  );

  const renderDaemonRuntimePolicyModule = () => (
    <div>
      <p className="st-desc">
        Stabilize runtime behavior in one place so daemon controls, background jobs,
        and keyboard navigation stay coherent in both fullscreen and docked modes.
      </p>
      <fieldset className="st-fieldset" style={{ marginTop: "0.95rem" }}>
        <legend className="st-legend">Execution Controls</legend>
        <label className="st-checkbox-label">
          <input
            type="checkbox"
            checked={runtimeAutoRestart}
            onChange={(event) => {
              const next = event.target.checked;
              setRuntimeAutoRestart(next);
              void saveRemoteSettings("runtime.autoRestart", next);
            }}
          />
          <span>Auto-restart daemon when runtime exits unexpectedly</span>
        </label>
        <div className="st-row" style={{ marginTop: "0.75rem" }}>
          <label className="st-label">
            Max concurrent workers
            <input
              className="st-input"
              inputMode="numeric"
              value={runtimeMaxWorkers}
              onChange={(event) => setRuntimeMaxWorkers(event.target.value)}
              onBlur={(event) => {
                const normalized = readPositiveInteger(event.target.value, 4);
                setRuntimeMaxWorkers(String(normalized));
                void saveRemoteSettings("runtime.maxWorkers", normalized);
              }}
            />
            <span className="st-hint">
              Caps simultaneous background operation workers.
            </span>
          </label>
          <label className="st-label">
            Health check interval (seconds)
            <input
              className="st-input"
              inputMode="numeric"
              value={runtimeHealthIntervalSec}
              onChange={(event) => setRuntimeHealthIntervalSec(event.target.value)}
              onBlur={(event) => {
                const normalized = readPositiveInteger(event.target.value, 12);
                setRuntimeHealthIntervalSec(String(normalized));
                void saveRemoteSettings("runtime.healthIntervalSec", normalized);
              }}
            />
            <span className="st-hint">
              Lower values detect failures faster; higher values reduce polling load.
            </span>
          </label>
        </div>
      </fieldset>
    </div>
  );

  const renderMcpIntegrationsStudioModule = () => (
    <div>
      <p className="st-desc">
        Define default MCP onboarding behavior so every server follows the same trust,
        sync, and isolation posture before module-specific overrides are applied.
      </p>
      <fieldset className="st-fieldset" style={{ marginTop: "0.95rem" }}>
        <legend className="st-legend">Registry Controls</legend>
        <label className="st-checkbox-label">
          <input
            type="checkbox"
            checked={mcpAutoSync}
            onChange={(event) => {
              const next = event.target.checked;
              setMcpAutoSync(next);
              void saveRemoteSettings("mcp.autoSync", next);
            }}
          />
          <span>Auto-sync approved MCP server manifests</span>
        </label>
        <label className="st-checkbox-label" style={{ marginTop: "0.55rem" }}>
          <input
            type="checkbox"
            checked={mcpRequireSigned}
            onChange={(event) => {
              const next = event.target.checked;
              setMcpRequireSigned(next);
              void saveRemoteSettings("mcp.requireSignedRegistries", next);
            }}
          />
          <span>Require signed registry entries before activation</span>
        </label>
        <label className="st-label" style={{ marginTop: "0.75rem" }}>
          Default isolation mode
          <select
            className="st-select"
            value={mcpIsolationMode}
            onChange={(event) => {
              const next =
                event.target.value === "profile" || event.target.value === "strict"
                  ? event.target.value
                  : "workspace";
              setMcpIsolationMode(next);
              void saveRemoteSettings("mcp.isolationMode", next);
            }}
          >
            <option value="workspace">Workspace isolation</option>
            <option value="profile">Profile isolation</option>
            <option value="strict">Strict sandbox</option>
          </select>
        </label>
      </fieldset>
    </div>
  );

  const renderEnvironmentProfilesStudioModule = () => (
    <div>
      <p className="st-desc">
        Route every settings surface through explicit environment profiles so local,
        LAN, and cloud contexts stay deterministic across sessions.
      </p>
      <fieldset className="st-fieldset" style={{ marginTop: "0.95rem" }}>
        <legend className="st-legend">Defaults</legend>
        <div className="st-row">
          <label className="st-label">
            Default profile ID
            <input
              className="st-input"
              value={defaultProfileId}
              onChange={(event) => setDefaultProfileId(event.target.value)}
              onBlur={(event) => {
                const next = readStringSetting(event.target.value, "default");
                setDefaultProfileId(next);
                void saveRemoteSettings("profiles.default", next);
              }}
            />
          </label>
        </div>
        <label className="st-checkbox-label" style={{ marginTop: "0.55rem" }}>
          <input
            type="checkbox"
            checked={profileSwitchConfirm}
            onChange={(event) => {
              const next = event.target.checked;
              setProfileSwitchConfirm(next);
              void saveRemoteSettings("profiles.confirmSwitch", next);
            }}
          />
          <span>Require confirmation before switching active profile</span>
        </label>
      </fieldset>
    </div>
  );

  const renderAccountsVaultStudioModule = () => (
    <div>
      <p className="st-desc">
        Keep account controls and secret handling in one hardened lane with explicit
        authentication and vault lock rules.
      </p>
      <fieldset className="st-fieldset" style={{ marginTop: "0.95rem" }}>
        <legend className="st-legend">Auth Guardrails</legend>
        <label className="st-checkbox-label">
          <input
            type="checkbox"
            checked={accountsDangerousAuthRequired}
            onChange={(event) => {
              const next = event.target.checked;
              setAccountsDangerousAuthRequired(next);
              void saveRemoteSettings("accounts.requireDangerousAuth", next);
            }}
          />
          <span>Require account auth before dangerous operations</span>
        </label>
        <label className="st-label" style={{ marginTop: "0.75rem" }}>
          Vault auto-lock (minutes)
          <input
            className="st-input"
            inputMode="numeric"
            value={vaultAutoLockMinutes}
            onChange={(event) => setVaultAutoLockMinutes(event.target.value)}
            onBlur={(event) => {
              const normalized = readPositiveInteger(event.target.value, 15);
              setVaultAutoLockMinutes(String(normalized));
              void saveRemoteSettings("vault.autoLockMinutes", normalized);
            }}
          />
        </label>
      </fieldset>
    </div>
  );

  const renderTilesWorkspaceModule = () => (
    <div className="opta-studio-tile-layout-module">
      <p className="st-desc">
        Workspace tile controls are now consolidated into Settings Studio.
        Use these actions to enter layout mode and manage visual arrangement from one place.
      </p>
      <div className="st-row" style={{ marginTop: "1rem" }}>
        <button
          type="button"
          className="opta-studio-btn"
          onClick={() => onManageTiles?.()}
        >
          Open Tile Layout Mode
        </button>
        <button
          type="button"
          className="opta-studio-btn-secondary"
          onClick={() => window.dispatchEvent(new CustomEvent("opta:workspace:recenter"))}
        >
          Recenter Workspace
        </button>
      </div>
      <div className="st-fieldset" style={{ marginTop: "1rem" }}>
        <legend>Keyboard Use</legend>
        <p className="st-desc">
          Navigate cards with W/A/S/D or arrows, Enter to edit, Enter again to save,
          Esc to cancel, Shift+Space to toggle fullscreen.
        </p>
      </div>
      <fieldset className="st-fieldset" style={{ marginTop: "0.95rem" }}>
        <legend className="st-legend">Tile System Controls</legend>
        <label className="st-checkbox-label">
          <input
            type="checkbox"
            checked={tilesAutoDock}
            onChange={(event) => {
              const next = event.target.checked;
              setTilesAutoDock(next);
              void saveRemoteSettings("workspace.tiles.autoDock", next);
            }}
          />
          <span>Auto-dock tile clusters to the nearest lane</span>
        </label>
        <label className="st-checkbox-label" style={{ marginTop: "0.55rem" }}>
          <input
            type="checkbox"
            checked={tilesShowTelemetry}
            onChange={(event) => {
              const next = event.target.checked;
              setTilesShowTelemetry(next);
              void saveRemoteSettings("workspace.tiles.showTelemetry", next);
            }}
          />
          <span>Show live telemetry widgets in workspace side rail</span>
        </label>
        <label className="st-label" style={{ marginTop: "0.75rem" }}>
          Density profile
          <select
            className="st-select"
            value={tilesDensity}
            onChange={(event) => {
              const next =
                event.target.value === "compact" || event.target.value === "cinema"
                  ? event.target.value
                  : "comfortable";
              setTilesDensity(next);
              void saveRemoteSettings("workspace.tiles.density", next);
            }}
          >
            <option value="compact">Compact</option>
            <option value="comfortable">Comfortable</option>
            <option value="cinema">Cinema</option>
          </select>
        </label>
      </fieldset>
    </div>
  );

  const renderAppsCatalogStudioModule = () => (
    <div>
      <p className="st-desc">
        Control how app modules are admitted into the workspace while keeping
        install/update flows consistent with the new Studio layout.
      </p>
      <fieldset className="st-fieldset" style={{ marginTop: "0.95rem" }}>
        <legend className="st-legend">Admission Policy</legend>
        <label className="st-label">
          Install policy
          <select
            className="st-select"
            value={appsInstallPolicy}
            onChange={(event) => {
              const next =
                event.target.value === "allowlisted" || event.target.value === "open"
                  ? event.target.value
                  : "moderated";
              setAppsInstallPolicy(next);
              void saveRemoteSettings("apps.installPolicy", next);
            }}
          >
            <option value="allowlisted">Allowlisted only</option>
            <option value="moderated">Moderated</option>
            <option value="open">Open catalog</option>
          </select>
        </label>
        <label className="st-checkbox-label" style={{ marginTop: "0.55rem" }}>
          <input
            type="checkbox"
            checked={appsAutoUpdate}
            onChange={(event) => {
              const next = event.target.checked;
              setAppsAutoUpdate(next);
              void saveRemoteSettings("apps.autoUpdate", next);
            }}
          />
          <span>Auto-update installed apps on trusted channels</span>
        </label>
      </fieldset>
    </div>
  );

  const renderSessionMemoryStudioModule = () => (
    <div>
      <p className="st-desc">
        Tune retention, semantic recall, and summarization so long-running sessions
        remain fast without losing strategic context.
      </p>
      <fieldset className="st-fieldset" style={{ marginTop: "0.95rem" }}>
        <legend className="st-legend">Retention</legend>
        <div className="st-row">
          <label className="st-label">
            Retention window (days)
            <input
              className="st-input"
              inputMode="numeric"
              value={memoryRetentionDays}
              onChange={(event) => setMemoryRetentionDays(event.target.value)}
              onBlur={(event) => {
                const normalized = readPositiveInteger(event.target.value, 30);
                setMemoryRetentionDays(String(normalized));
                void saveRemoteSettings("memory.retentionDays", normalized);
              }}
            />
          </label>
        </div>
        <label className="st-checkbox-label" style={{ marginTop: "0.55rem" }}>
          <input
            type="checkbox"
            checked={memorySemanticRecall}
            onChange={(event) => {
              const next = event.target.checked;
              setMemorySemanticRecall(next);
              void saveRemoteSettings("memory.semanticRecall", next);
            }}
          />
          <span>Enable semantic recall across sessions</span>
        </label>
        <label className="st-checkbox-label" style={{ marginTop: "0.55rem" }}>
          <input
            type="checkbox"
            checked={memoryAutoSummaries}
            onChange={(event) => {
              const next = event.target.checked;
              setMemoryAutoSummaries(next);
              void saveRemoteSettings("memory.autoSummaries", next);
            }}
          />
          <span>Auto-summarize long sessions after completion</span>
        </label>
      </fieldset>
    </div>
  );

  const renderCliAdvancedStudioModule = () => (
    <div>
      <p className="st-desc">
        Align advanced CLI and system operations with explicit confirmations and
        shell defaults so parity tools stay safe under keyboard-only workflows.
      </p>
      <fieldset className="st-fieldset" style={{ marginTop: "0.95rem" }}>
        <legend className="st-legend">Execution Defaults</legend>
        <label className="st-checkbox-label">
          <input
            type="checkbox"
            checked={cliConfirmDestructive}
            onChange={(event) => {
              const next = event.target.checked;
              setCliConfirmDestructive(next);
              void saveRemoteSettings("cli.confirmDestructive", next);
            }}
          />
          <span>Require explicit confirmation for destructive commands</span>
        </label>
        <label className="st-checkbox-label" style={{ marginTop: "0.55rem" }}>
          <input
            type="checkbox"
            checked={cliVerboseDiagnostics}
            onChange={(event) => {
              const next = event.target.checked;
              setCliVerboseDiagnostics(next);
              void saveRemoteSettings("cli.verboseDiagnostics", next);
            }}
          />
          <span>Enable verbose diagnostics in advanced command output</span>
        </label>
        <label className="st-label" style={{ marginTop: "0.75rem" }}>
          Default shell
          <select
            className="st-select"
            value={cliDefaultShell}
            onChange={(event) => {
              const next =
                event.target.value === "bash" || event.target.value === "pwsh"
                  ? event.target.value
                  : "zsh";
              setCliDefaultShell(next);
              void saveRemoteSettings("cli.defaultShell", next);
            }}
          >
            <option value="zsh">zsh</option>
            <option value="bash">bash</option>
            <option value="pwsh">PowerShell</option>
          </select>
        </label>
      </fieldset>
    </div>
  );

  const renderTabContent = () => {
    const wrap = (key: string, content: ReactNode) => (
      <motion.div
        key={key}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
      >
        {content}
      </motion.div>
    );

    const renderLazyModule = (label: string, module: ReactNode) => (
      <ErrorBoundary
        fallback={(error) => (
          <SettingsLazyChunkError label={label} error={error} />
        )}
      >
        <Suspense fallback={<SettingsLazyChunkFallback label={label} />}>
          {module}
        </Suspense>
      </ErrorBoundary>
    );

    switch (activeTab) {
      case "connection-network":
        return wrap("connection-network", renderConnectionModule());
      case "lmx-models":
        return wrap(
          "lmx-models",
          <div className="opta-studio-module-stack">
            <section className="opta-studio-module-card">{renderLmxModule()}</section>
            <section className="opta-studio-module-card">
              <SettingsTabModelProvider connection={connection} />
            </section>
            <section className="opta-studio-module-card">
              {renderLazyModule(
                "Model Aliases",
                <LazyModelAliasesPage connection={connection} />,
              )}
            </section>
          </div>,
        );
      case "daemon-runtime":
        return wrap(
          "daemon-runtime",
          <div className="opta-studio-module-stack">
            <section className="opta-studio-module-card">{renderDaemonModule()}</section>
            <section className="opta-studio-module-card">
              {renderDaemonRuntimePolicyModule()}
            </section>
            <section className="opta-studio-module-card">
              <SettingsTabFleet connection={connection} />
            </section>
            <section className="opta-studio-module-card">
              {renderLazyModule(
                "Daemon Control",
                <LazyDaemonControlPage connection={connection} />,
              )}
            </section>
          </div>,
        );
      case "autonomy-policies":
        return wrap(
          "autonomy-policies",
          <div className="opta-studio-module-stack">
            <section className="opta-studio-module-card">{renderAutonomyModule()}</section>
            <section className="opta-studio-module-card">{renderGenUiModule()}</section>
            <section className="opta-studio-module-card">
              <SettingsTabPolicy connection={connection} />
            </section>
          </div>,
        );
      case "permissions-safety":
        return wrap(
          "permissions-safety",
          <div className="opta-studio-module-stack">
            <section className="opta-studio-module-card">
              <SettingsTabPermissions connection={connection} />
            </section>
            <section className="opta-studio-module-card">
              <SettingsTabSafety connection={connection} />
            </section>
          </div>,
        );
      case "browser-research":
        return wrap(
          "browser-research",
          <div className="opta-studio-module-stack">
            <section className="opta-studio-module-card">
              <SettingsTabBrowser connection={connection} />
            </section>
            <section className="opta-studio-module-card">
              <SettingsTabResearch connection={connection} />
            </section>
          </div>,
        );
      case "tools-agents-learning":
        return wrap(
          "tools-agents-learning",
          <div className="opta-studio-module-stack">
            <section className="opta-studio-module-card">
              <SettingsTabToolsAgents connection={connection} />
            </section>
            <section className="opta-studio-module-card">
              <SettingsTabLearning connection={connection} />
            </section>
          </div>,
        );
      case "mcp-integrations":
        return wrap(
          "mcp-integrations",
          <div className="opta-studio-module-stack">
            <section className="opta-studio-module-card">
              {renderMcpIntegrationsStudioModule()}
            </section>
            <section className="opta-studio-module-card">
              <SettingsTabMcp connection={connection} />
            </section>
            <section className="opta-studio-module-card">
              {renderLazyModule(
                "MCP Management",
                <LazyMcpManagementPage connection={connection} />,
              )}
            </section>
          </div>,
        );
      case "environment-profiles":
        return wrap(
          "environment-profiles",
          <div className="opta-studio-module-stack">
            <section className="opta-studio-module-card">
              {renderEnvironmentProfilesStudioModule()}
            </section>
            <section className="opta-studio-module-card">
              {renderLazyModule(
                "Environment Profiles",
                <LazyEnvProfilesPage connection={connection} />,
              )}
            </section>
          </div>,
        );
      case "config-studio":
        return wrap(
          "config-studio",
          <section className="opta-studio-module-card">
            {renderLazyModule(
              "Config Studio",
              <LazyConfigStudioPage connection={connection} />,
            )}
          </section>,
        );
      case "accounts-vault":
        return wrap(
          "accounts-vault",
          <div className="opta-studio-module-stack">
            <section className="opta-studio-module-card">
              {renderAccountsVaultStudioModule()}
            </section>
            <section className="opta-studio-module-card">
              {renderLazyModule(
                "Account Control",
                <LazyAccountControlPage connection={connection} />,
              )}
            </section>
            <section className="opta-studio-module-card">
              <SettingsTabSecrets connection={connection} />
            </section>
          </div>,
        );
      case "tiles-workspace-layout":
        return wrap(
          "tiles-workspace-layout",
          <section className="opta-studio-module-card">{renderTilesWorkspaceModule()}</section>,
        );
      case "apps-catalog":
        return wrap(
          "apps-catalog",
          <div className="opta-studio-module-stack">
            <section className="opta-studio-module-card">
              {renderAppsCatalogStudioModule()}
            </section>
            <section className="opta-studio-module-card">
              {renderLazyModule(
                "Apps Catalog",
                <LazyAppCatalogPage connection={connection} />,
              )}
            </section>
          </div>,
        );
      case "session-memory":
        return wrap(
          "session-memory",
          <div className="opta-studio-module-stack">
            <section className="opta-studio-module-card">
              {renderSessionMemoryStudioModule()}
            </section>
            <section className="opta-studio-module-card">
              {renderLazyModule(
                "Session Memory",
                <LazySessionMemoryPage connection={connection} />,
              )}
            </section>
          </div>,
        );
      case "background-jobs":
        return wrap(
          "background-jobs",
          <section className="opta-studio-module-card">
            {renderLazyModule(
              "Background Jobs",
              <LazyBackgroundJobsPage
                connection={connection}
                defaultSessionId={defaultSessionId}
              />,
            )}
          </section>,
        );
      case "daemon-logs":
        return wrap(
          "daemon-logs",
          <section className="opta-studio-module-card">
            {renderLazyModule("Daemon Logs", <LazyDaemonLogsPage connection={connection} />)}
          </section>,
        );
      case "cli-system-advanced":
        return wrap(
          "cli-system-advanced",
          <div className="opta-studio-module-stack">
            <section className="opta-studio-module-card">
              {renderCliAdvancedStudioModule()}
            </section>
            <section className="opta-studio-module-card">
              {renderLazyModule(
                "System Info",
                <LazySystemInfoPage connection={connection} />,
              )}
            </section>
            <section className="opta-studio-module-card">
              {renderLazyModule(
                "System Operations",
                <LazySystemOperationsPage
                  connection={connection}
                  connectionState={connectionState}
                />,
              )}
            </section>
            <section className="opta-studio-module-card">
              {renderLazyModule(
                "CLI Operations",
                <LazyCliOperationsPage connection={connection} />,
              )}
            </section>
          </div>,
        );
      default:
        return null;
    }
  };

  const activeCategory = SETTINGS_CATEGORIES.find(
    (category) => category.id === activeTab,
  );
  const activeCategoryIndex = SETTINGS_CATEGORIES.findIndex(
    (category) => category.id === activeTab,
  );
  const activeAccentColor = activeCategory?.accentColor ?? "#a78bfa";
  const ActiveCategoryIcon = activeCategory?.icon;
  const [categoryWheelDirection, setCategoryWheelDirection] = useState<
    "left" | "right"
  >("right");
  const prevCategoryIndexRef = useRef(activeCategoryIndex);

  useEffect(() => {
    if (activeCategoryIndex < 0) return;
    const previous = prevCategoryIndexRef.current;
    if (previous === activeCategoryIndex) return;
    const length = SETTINGS_CATEGORIES.length;
    const forward = (activeCategoryIndex - previous + length) % length;
    const backward = (previous - activeCategoryIndex + length) % length;
    setCategoryWheelDirection(forward <= backward ? "right" : "left");
    prevCategoryIndexRef.current = activeCategoryIndex;
  }, [activeCategoryIndex]);

  const getRelativeCategory = useCallback(
    (offset: number) => {
      if (activeCategoryIndex < 0) return null;
      const length = SETTINGS_CATEGORIES.length;
      return SETTINGS_CATEGORIES[(activeCategoryIndex + offset + length) % length] ?? null;
    },
    [activeCategoryIndex],
  );

  const keyboardHint = isDeepLayer
    ? isSettingEditMode
      ? "Edit mode · ←↑↓→ or W/A/S/D adjust · Enter apply + save · Esc cancel · Shift+←/→ category · Tab/Backspace down layer · Space up layer · Shift+Space fullscreen"
      : "Navigate mode · ←↑↓→ or W/A/S/D highlight · Enter select/edit · Shift+←/→ category · Tab/Backspace down layer · Space up layer · Shift+Space fullscreen"
    : "Layer 2 · ←↑↓→ or W/A/S/D highlight · Enter open category · Shift+←/→ switch category · Tab/Backspace down layer · Space up layer";

  let word = "SETTINGS";
  let dynamicStyle: CSSProperties = {};

  const mapCategoryToWord: Record<string, string> = {
    "connection-network": "CONNECTION",
    "lmx-models": "INFERENCE",
    "daemon-runtime": "DAEMON",
    "autonomy-policies": "AUTONOMY",
    "permissions-safety": "SAFETY",
    "browser-research": "RESEARCH",
    "tools-agents-learning": "AGENTS",
    "mcp-integrations": "INTEGRATIONS",
    "environment-profiles": "PROFILES",
    "config-studio": "CONFIG",
    "accounts-vault": "VAULT",
    "tiles-workspace-layout": "WORKSPACE",
    "apps-catalog": "CATALOG",
    "session-memory": "MEMORY",
    "background-jobs": "JOBS",
    "daemon-logs": "LOGS",
    "cli-system-advanced": "ADVANCED",
  };

  const hexToRgba = (hex: string, alpha: number) => {
    const h = hex.replace("#", "");
    const r = parseInt(h.length === 3 ? h[0] + h[0] : h.substring(0, 2), 16);
    const g = parseInt(h.length === 3 ? h[1] + h[1] : h.substring(2, 4), 16);
    const b = parseInt(h.length === 3 ? h[2] + h[2] : h.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  if (isDeepLayer && activeCategory) {
    word = mapCategoryToWord[activeCategory.id] ?? "SETTINGS";
    dynamicStyle = {
      "--opta-primary-glow": activeCategory.accentColor,
      "--opta-dynamic-filter": hexToRgba(activeCategory.accentColor, 0.34),
    } as CSSProperties;
  } else {
    dynamicStyle = {
      "--opta-primary-glow": "#f1f5f9",
      "--opta-dynamic-filter": "rgba(241, 245, 249, 0.22)",
    } as CSSProperties;
  }

  const shell = (
    <div
      className={`opta-studio-shell ${embedded ? "opta-studio-shell--embedded" : ""} ${isDeepLayer ? "opta-studio-shell--deep" : ""} ${isFullscreen ? "opta-studio-shell--fullscreen" : ""}`}
      onClick={(e) => e.stopPropagation()}
    >
      {isFullscreen && (
        <div
          className={`opta-studio-logo-reserve ${isDeepLayer ? "is-docked" : ""} ${isFullscreen ? "is-active" : ""}`}
          aria-hidden="true"
        >
          <div className="opta-studio-logo-stack">
            <div className="opta-studio-logo-word" aria-label={word} style={dynamicStyle}>
              {word.split("").map((letter, index) => (
                <span
                  key={`settings-logo-letter-${letter}-${index}`}
                  className={`opta-studio-logo-letter opta-studio-logo-letter-${index + 1}`}
                >
                  {letter}
                </span>
              ))}
            </div>
            <div className="opta-studio-logo-sub">Code Environment</div>
          </div>
        </div>
      )}

      <div className="opta-studio-top-chrome">
        <div className="opta-studio-top-chrome-left">
          <div className="opta-studio-shortcut-panel">
            <span className="opta-studio-shortcut-title">Keyboard Layout</span>
            <span className="opta-studio-shortcut-copy">{keyboardHint}</span>
          </div>
        </div>
        <div className="opta-studio-top-chrome-center">
          <div className="opta-studio-command-row">
            {onBackLayer ? (
              <button
                type="button"
                className="opta-studio-btn-secondary opta-studio-header-btn"
                onClick={onBackLayer}
              >
                <ArrowUp size={14} /> Back Layer
              </button>
            ) : null}
            <h2 className="opta-studio-panel-title">
              <span className="opta-studio-panel-eyebrow">Category Configuration</span>
              <span className="opta-studio-layer-badge">
                {isDeepLayer ? "Layer 3 · Category Configuration" : "Layer 2 · Category Selection"}
              </span>
            </h2>
          </div>
        </div>
        <div className="opta-studio-top-chrome-right">
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="opta-studio-close-btn"
              aria-label="Close settings"
            >
              <X size={20} />
            </button>
          ) : null}
        </div>
      </div>

      {isDeepLayer && activeCategory ? (
        <div className="opta-studio-category-wheel-shell">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activeCategory.id}
              className="opta-studio-category-wheel"
              style={
                {
                  "--settings-accent": activeAccentColor,
                } as CSSProperties
              }
              initial={{
                opacity: 0,
                x: categoryWheelDirection === "right" ? 22 : -22,
                scale: 0.985,
              }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{
                opacity: 0,
                x: categoryWheelDirection === "right" ? -18 : 18,
                scale: 0.985,
              }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="opta-studio-category-wheel-item slot-far-left icon-only">
                {(() => {
                  const category = getRelativeCategory(-2);
                  if (!category) return null;
                  const Icon = category.icon;
                  return <Icon size={14} />;
                })()}
              </div>

              <div className="opta-studio-category-wheel-item slot-left text-only">
                <span>{getRelativeCategory(-1)?.title ?? ""}</span>
              </div>

              <div className="opta-studio-category-wheel-item slot-center current">
                <div className="opta-studio-category-logo">
                  {ActiveCategoryIcon ? <ActiveCategoryIcon size={16} /> : null}
                </div>
                <div className="opta-studio-category-copy">
                  <span>Active Category</span>
                  <strong>{activeCategory.title}</strong>
                </div>
              </div>

              <div className="opta-studio-category-wheel-item slot-right text-only">
                <span>{getRelativeCategory(1)?.title ?? ""}</span>
              </div>

              <div className="opta-studio-category-wheel-item slot-far-right icon-only">
                {(() => {
                  const category = getRelativeCategory(2);
                  if (!category) return null;
                  const Icon = category.icon;
                  return <Icon size={14} />;
                })()}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      ) : null}

      <div className={`opta-studio-layout ${isDeepLayer ? "opta-studio-layout--deep" : ""} ${isFullscreen ? "opta-studio-layout--fullscreen" : ""}`}>
        {!isDeepLayer ? (
          <aside className="opta-studio-sidebar">
            {(["infrastructure", "control", "security", "workspace"] as const).map((group) => (
              <div key={group} className="opta-studio-tab-group">
                <div className="opta-studio-tab-group-label">
                  {SETTINGS_GROUP_LABELS[group as SettingsCategoryGroup]}
                </div>
                {SETTINGS_CATEGORIES_BY_GROUP[group as SettingsCategoryGroup].map((category) => {
                  const Icon = category.icon;
                  return (
                    <button
                      key={category.id}
                      className={`opta-studio-tab ${activeTab === category.id ? "active" : ""}`}
                      onClick={() => setActiveTab(category.id)}
                      onMouseEnter={() => preloadSettingsModalLazyTab(category.id)}
                      onFocus={() => preloadSettingsModalLazyTab(category.id)}
                      ref={(element) => {
                        sidebarTabRefs.current[category.id] = element;
                      }}
                      style={
                        {
                          "--settings-accent": category.accentColor,
                        } as CSSProperties
                      }
                    >
                      <Icon size={16} /> {category.title}
                    </button>
                  );
                })}
              </div>
            ))}
          </aside>
        ) : null}

        <main className="opta-studio-content" ref={contentRef}>
          <AnimatePresence mode="wait">{renderTabContent()}</AnimatePresence>
        </main>
      </div>
    </div>
  );

  if (embedded) {
    return (
      <div className={`opta-studio-embedded ${isDeepLayer ? "opta-studio-embedded--deep" : ""} ${isFullscreen ? "opta-studio-embedded--fullscreen" : ""}`}>
        {shell}
      </div>
    );
  }

  return (
    <div
      className="opta-studio-backdrop"
      onClick={() => onClose?.()}
      role="dialog"
      aria-modal="true"
    >
      {shell}
    </div>
  );
}
