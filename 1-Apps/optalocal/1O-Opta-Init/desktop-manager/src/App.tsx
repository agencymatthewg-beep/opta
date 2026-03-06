import { useCallback, useEffect, useMemo, useState, useRef, type CSSProperties } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { Activity, Settings } from "lucide-react";
import { buildLmxMagicUrl } from "./lib/magicLink";
import { DaemonDrawer } from "./components/DaemonDrawer";
import { SetupWizard } from "./pages/SetupWizard";
import { TunnelWizard } from "./pages/TunnelWizard";
import type {
  Channel,
  DaemonStatus,
  ManifestPayload,
  InstalledApp,
  ManifestApp,
  ManifestResponse,
  ManagerUpdateCheckResult,
  ManagerUpdateInstallResult,
  ManagerUpdateState,
  AccountProfile,
  BrainEligibilityResult,
  OptaAnywhereSupportResult,
  InstallFlowResult,
  InstallProgressEventPayload,
  GetOptaConfigResult,
  LmxConnectionResult,
  MdnsDiscoveryCommandResult,
  OptaConfig,
} from "./types";
import "./app.css";

// App Logo mapping (Strictly Opta Local Logos only, pure SVGs)
const LOGOS: Record<string, string> = {
  "opta-lmx": "/logos/opta-lmx-mark.svg",
  "opta-cli": "/logos/opta-cli-mark.svg",
  "opta-code-universal": "/logos/opta-code-mark.svg",
  "opta-local": "/logos/opta-local-mark.svg",
  "opta-accounts": "/logos/opta-accounts-mark.svg",
  "opta-status": "/logos/opta-status-mark.svg",
  "opta-learn": "/logos/opta-learn-mark.svg",
  "opta-help": "/logos/opta-help-mark.svg",
  "opta-daemon": "/logos/opta-status-mark.svg", // Using status logo for daemon
  "default": "/logos/opta-local-mark.svg",
};

const BROWSER_PREVIEW_MANIFEST: Record<Channel, ManifestPayload> = {
  stable: {
    channel: "stable",
    updatedAt: "preview",
    apps: [
      {
        id: "opta-cli",
        name: "Opta CLI",
        description: "Command-line interface for local orchestration, model downloading, and stack management.",
        version: "stable-preview",
        website: "https://init.optalocal.com/downloads/opta-cli/latest",
      },
      {
        id: "opta-lmx",
        name: "Opta LMX",
        description: "The core local inference engine. Manage your models, endpoints, and local API traffic.",
        version: "stable-preview",
        website: "https://lmx.optalocal.com",
      },
      {
        id: "opta-code-universal",
        name: "Opta Code",
        description: "Desktop IDE surface powered by your local LMX endpoints.",
        version: "stable-preview",
        website: "https://init.optalocal.com/apps/opta-code",
      },
      {
        id: "opta-local",
        name: "Opta Local",
        description: "Web management dashboard for the Opta ecosystem.",
        version: "stable-preview",
        website: "https://lmx.optalocal.com",
      },
      {
        id: "opta-accounts",
        name: "Opta Accounts",
        description: "Manage your local identity, sync preferences, and cloud backups.",
        version: "stable-preview",
        website: "https://accounts.optalocal.com",
      },
      {
        id: "opta-status",
        name: "Opta Status",
        description: "System health monitoring and service status.",
        version: "stable-preview",
        website: "https://status.optalocal.com",
      },
      {
        id: "opta-learn",
        name: "Opta Learn",
        description: "Discovery and guide portal.",
        version: "stable-preview",
        website: "https://learn.optalocal.com",
      },
      {
        id: "opta-help",
        name: "Opta Help",
        description: "Technical reference documentation.",
        version: "stable-preview",
        website: "https://help.optalocal.com",
      },
      {
        id: "opta-daemon",
        name: "Opta Daemon",
        description: "Background daemon service required for continuous local runtime orchestration.",
        version: "stable-preview",
        website: "https://docs.optalocal.com/daemon",
      },
    ],
  },
  beta: {
    channel: "beta",
    updatedAt: "preview",
    apps: [],
  },
};

const MANAGER_UPDATE_LABELS: Record<ManagerUpdateState, string> = {
  up_to_date: "Up to date",
  update_available: "Update available",
  error: "Error",
};

const CHANNEL_STORAGE_KEY = "opta_init_manager_channel";
const SETUP_COMPLETE_KEY = "init_setup_complete";
const SETUP_CONFIG_CACHE_KEY = "opta_init_setup_config_v1";
const ONE_LAUNCH_COMPLETE_KEY = "opta_lmx_one_launch_complete_v1";
const LMX_STARTUP_FALLBACK_HOST = "localhost";
const LMX_STARTUP_FALLBACK_PORT = 1234;

type DesktopPlatform = "windows" | "macos" | "linux";

function detectDesktopPlatform(): DesktopPlatform {
  if (typeof navigator === "undefined") return "linux";
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("win")) return "windows";
  if (ua.includes("mac")) return "macos";
  return "linux";
}

function managerInstallLocation(platform: DesktopPlatform): string {
  if (platform === "windows") {
    return "%LOCALAPPDATA%\\Programs\\Opta Init";
  }
  if (platform === "macos") {
    return "/Applications/OptaInit.app";
  }
  return "~/.local/share/OptaInit";
}

function normalizeChannel(value: unknown): Channel {
  return value === "beta" ? "beta" : "stable";
}

function resolveInitialChannel(): Channel {
  const envChannel = normalizeChannel(import.meta.env.VITE_OPTA_MANAGER_CHANNEL);
  if (typeof window === "undefined") {
    return envChannel;
  }

  const stored = window.localStorage.getItem(CHANNEL_STORAGE_KEY);
  if (stored === "stable" || stored === "beta") {
    return stored;
  }

  return envChannel;
}

function parseOptaConfigPayload(payload: unknown): OptaConfig | null {
  if (!payload || typeof payload !== "object") return null;
  const value = payload as Record<string, unknown>;
  const nested = value.config;
  if (nested && typeof nested === "object") {
    return nested as OptaConfig;
  }
  return value as OptaConfig;
}

function readCachedSetupConfig(): OptaConfig | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(SETUP_CONFIG_CACHE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as OptaConfig;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function isSetupComplete(config: OptaConfig | null | undefined): boolean {
  if (!config) return false;
  if (config.setupComplete === true || config.completed === true) return true;
  const hasProfile = typeof config.profile === "string" && config.profile.trim().length > 0;
  const hasInstallPath = typeof config.installPath === "string" && config.installPath.trim().length > 0;
  const hasDocsPath = typeof config.docsPath === "string" && config.docsPath.trim().length > 0;
  return hasProfile && hasInstallPath && hasDocsPath;
}

function parseLmxConnection(payload: unknown): LmxConnectionResult {
  if (!payload || typeof payload !== "object") return {};
  const value = payload as Record<string, unknown>;

  const directHost = typeof value.host === "string" ? value.host : undefined;
  const directPort = typeof value.port === "number" ? value.port : undefined;
  const directTunnelUrl = typeof value.tunnelUrl === "string" ? value.tunnelUrl : null;

  const nested = value.connection;
  if (nested && typeof nested === "object") {
    const nestedValue = nested as Record<string, unknown>;
    return {
      host: directHost ?? (typeof nestedValue.host === "string" ? nestedValue.host : undefined),
      port: directPort ?? (typeof nestedValue.port === "number" ? nestedValue.port : undefined),
      tunnelUrl: directTunnelUrl ?? (typeof nestedValue.tunnelUrl === "string" ? nestedValue.tunnelUrl : null),
    };
  }

  return {
    host: directHost,
    port: directPort,
    tunnelUrl: directTunnelUrl,
  };
}

interface LogoPose {
  tiltX: number;
  tiltY: number;
  shadowX: number;
  shadowY?: number;
  hoverScale?: number;
}

const CORE_LOGO_POSE: LogoPose = { tiltX: 0, tiltY: 0, shadowX: 0, shadowY: 10, hoverScale: 1.08 };
const SCENE_WIDTH = 1000;
const SCENE_HEIGHT = 760;
const SCENE_CENTER = { x: 500, y: 360 };

interface SceneNodeSpec extends LogoPose {
  id: string;
  x: number;
  y: number;
  className?: string;
}

const SCENE_NODE_SPECS: SceneNodeSpec[] = [
  { id: "opta-local", x: 500, y: 102, tiltX: 16, tiltY: 0, shadowX: 0, shadowY: 15, hoverScale: 1.14, className: "tier-secondary" },
  { id: "opta-accounts", x: 300, y: 198, tiltX: 8, tiltY: 15, shadowX: -8, shadowY: 13, hoverScale: 1.14, className: "tier-secondary" },
  { id: "opta-daemon", x: 700, y: 198, tiltX: 8, tiltY: -15, shadowX: 8, shadowY: 13, hoverScale: 1.14, className: "tier-secondary" },
  { id: "opta-cli", x: 214, y: 392, tiltX: 5, tiltY: 18, shadowX: -10, shadowY: 14, hoverScale: 1.12, className: "tier-primary" },
  { id: "opta-lmx", x: 786, y: 392, tiltX: 5, tiltY: -18, shadowX: 10, shadowY: 14, hoverScale: 1.12, className: "tier-primary" },
  { id: "opta-learn", x: 356, y: 566, tiltX: -10, tiltY: 12, shadowX: -7, shadowY: 12, hoverScale: 1.14, className: "tier-secondary" },
  { id: "opta-help", x: 644, y: 566, tiltX: -10, tiltY: -12, shadowX: 7, shadowY: 12, hoverScale: 1.14, className: "tier-secondary" },
];

const SCENE_FALLBACK_POINTS = [
  { x: 180, y: 188 },
  { x: 820, y: 188 },
  { x: 142, y: 360 },
  { x: 858, y: 360 },
  { x: 282, y: 575 },
  { x: 718, y: 575 },
];

function parseManagerUpdateCheck(
  payload: ManagerUpdateCheckResult | boolean,
): { status: ManagerUpdateState; warning?: string } {
  if (typeof payload === "boolean") {
    return { status: payload ? "update_available" : "up_to_date" };
  }

  const statusText = typeof payload.status === "string" ? payload.status.toLowerCase() : "";
  const warningFromWarnings =
    Array.isArray(payload.warnings) &&
      typeof payload.warnings[0] === "string" &&
      payload.warnings[0].trim().length > 0
      ? payload.warnings[0]
      : undefined;
  const explicitWarning =
    typeof payload.error === "string" && payload.error.trim().length > 0
      ? payload.error
      : typeof payload.message === "string" && payload.message.trim().length > 0
        ? payload.message
        : warningFromWarnings;
  const detectedAvailability = [
    payload.available,
    payload.updateAvailable,
    payload.update_available,
    payload.hasUpdate,
    payload.has_update,
  ].find((value): value is boolean => typeof value === "boolean");

  if (statusText.includes("error") || statusText.includes("fail")) {
    return {
      status: "error",
      warning: explicitWarning ?? "Manager update check failed.",
    };
  }

  if (typeof payload.error === "string" && payload.error.trim().length > 0) {
    return { status: "error", warning: payload.error };
  }

  if (typeof detectedAvailability === "boolean") {
    return {
      status: detectedAvailability ? "update_available" : "up_to_date",
      warning: warningFromWarnings,
    };
  }

  if (
    statusText.includes("up_to_date")
    || statusText.includes("up-to-date")
    || statusText.includes("uptodate")
    || statusText.includes("latest")
    || statusText.includes("no_update")
  ) {
    return { status: "up_to_date", warning: warningFromWarnings };
  }

  if (statusText.includes("available") || statusText === "update_available" || statusText === "update") {
    return { status: "update_available", warning: warningFromWarnings };
  }

  return { status: "up_to_date", warning: warningFromWarnings };
}

function parseInstallFlowResult(
  payload: InstallFlowResult | boolean | null | undefined,
  successFallback: string,
  errorFallback: string,
): { ok: boolean; message: string } {
  if (payload == null) {
    return { ok: true, message: successFallback };
  }

  if (typeof payload === "boolean") {
    return {
      ok: payload,
      message: payload ? successFallback : errorFallback,
    };
  }

  const statusHint = typeof payload?.status === "string" ? payload.status.toLowerCase() : "";
  const explicitOkFlags = [
    payload?.ok,
    payload?.success,
    payload?.installed,
  ].filter((flag): flag is boolean => typeof flag === "boolean");

  let ok = explicitOkFlags.length > 0 ? explicitOkFlags.some(Boolean) : false;
  if (statusHint.includes("success") || statusHint.includes("completed") || statusHint === "ok") {
    ok = true;
  }
  if (statusHint.includes("error") || statusHint.includes("fail")) {
    ok = false;
  }

  const message =
    (typeof payload?.message === "string" && payload.message.trim().length > 0 && payload.message)
    || (typeof payload?.error === "string" && payload.error.trim().length > 0 && payload.error)
    || (ok ? successFallback : errorFallback);

  return { ok, message };
}

function parseBrainEligibility(
  payload: BrainEligibilityResult | boolean | null | undefined,
): { eligible: boolean; reason?: string } {
  if (typeof payload === "boolean") {
    return { eligible: payload };
  }

  const eligibility =
    [payload?.eligible, payload?.isEligible, payload?.supported]
      .find((value): value is boolean => typeof value === "boolean")
    ?? false;
  const reason =
    (typeof payload?.reason === "string" && payload.reason.trim().length > 0 && payload.reason)
    || (typeof payload?.message === "string" && payload.message.trim().length > 0 && payload.message)
    || (typeof payload?.error === "string" && payload.error.trim().length > 0 && payload.error)
    || undefined;

  return { eligible: eligibility, reason };
}

function parseOptaAnywhereSupport(
  payload: OptaAnywhereSupportResult | boolean | null | undefined,
): { supported: boolean; reason?: string } {
  if (typeof payload === "boolean") {
    return { supported: payload };
  }

  const supported = typeof payload?.supported === "boolean" ? payload.supported : true;
  const reason =
    (typeof payload?.reason === "string" && payload.reason.trim().length > 0 && payload.reason)
    || (typeof payload?.message === "string" && payload.message.trim().length > 0 && payload.message)
    || (typeof payload?.error === "string" && payload.error.trim().length > 0 && payload.error)
    || undefined;

  return { supported, reason };
}

function progressLineFromPayload(payload: InstallProgressEventPayload): string | null {
  const line =
    (typeof payload.line === "string" && payload.line.trim().length > 0 && payload.line)
    || (typeof payload.message === "string" && payload.message.trim().length > 0 && payload.message)
    || (typeof payload.error === "string" && payload.error.trim().length > 0 && payload.error)
    || null;
  return line;
}

function buildAccountsPairingUrl(host: string, port: number): string {
  const pairUrl = new URL("https://lmx.optalocal.com/pair");
  pairUrl.searchParams.set("host", host);
  pairUrl.searchParams.set("port", String(port));

  const signInUrl = new URL("https://accounts.optalocal.com/sign-in");
  signInUrl.searchParams.set("redirect_to", pairUrl.toString());
  return signInUrl.toString();
}

function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;

    const resize = () => {
      const parent = c.parentElement;
      if (parent) {
        c.width = parent.clientWidth;
        c.height = parent.clientHeight;
      }
    };
    resize();
    window.addEventListener("resize", resize);

    const cx = c.width / 2;
    const cy = c.height / 2;

    const particles: any[] = [];
    for (let i = 0; i < 200; i++) {
      particles.push({
        x: Math.random() * c.width,
        y: Math.random() * c.height,
        size: Math.random() * 2,
        speedY: -(Math.random() * 0.3 + 0.05),
        speedX: (Math.random() - 0.5) * 0.2
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, c.width, c.height);

      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 400);
      glow.addColorStop(0, "rgba(168,85,247,0.12)");
      glow.addColorStop(1, "transparent");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, c.width, c.height);

      particles.forEach((p) => {
        p.y += p.speedY;
        p.x += p.speedX;
        if (p.y < 0) p.y = c.height;
        if (p.x < 0) p.x = c.width;
        if (p.x > c.width) p.x = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(168,85,247,0.4)`;
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas ref={canvasRef} className="void-canvas" />;
}

export function App() {
  type InstallProgressMode = "core_stack" | "local_ai";
  type InstallProgressStatus = "running" | "success" | "error";
  type AppAction = "install" | "update" | "delete" | "launch" | "verify" | "open_folder";
  type ConfirmationChoice = "confirm" | "cancel";
  interface InstallProgressSession {
    mode: InstallProgressMode;
    title: string;
    status: InstallProgressStatus;
    lines: string[];
    error?: string;
  }
  interface ActionConfirmationState {
    title: string;
    description: string;
    actionLabel: string;
  }

  const tauriAvailable =
    typeof window !== "undefined" &&
    Boolean((window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
  const platform = useMemo<DesktopPlatform>(() => detectDesktopPlatform(), []);
  const [channel, setChannel] = useState<Channel>(resolveInitialChannel);
  const [cmdProgress, setCmdProgress] = useState<Record<string, { line: string, pct?: number }>>({});

  useEffect(() => {
    if (!tauriAvailable) return;
    const unlisten = listen("cmd-progress", (event: any) => {
      const payload = event.payload as { app_id: string, line: string };
      setCmdProgress((prev: any) => {
        let pct = prev[payload.app_id]?.pct;
        const match = payload.line.match(/(\d{1,3})%/);
        if (match) pct = parseInt(match[1], 10);
        return { ...prev, [payload.app_id]: { line: payload.line, pct } };
      });
    });
    return () => {
      unlisten.then((f: any) => f());
    };
  }, [tauriAvailable]);
  const [manifestResp, setManifestResp] = useState<ManifestResponse | null>(null);
  const [installedApps, setInstalledApps] = useState<InstalledApp[]>([]);
  const [daemon, setDaemon] = useState<DaemonStatus | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [managerUpdateState, setManagerUpdateState] = useState<ManagerUpdateState>("up_to_date");
  const [managerUpdateWarning, setManagerUpdateWarning] = useState<string | null>(null);
  const [managerUpdatePending, setManagerUpdatePending] = useState(false);
  const [accountProfile, setAccountProfile] = useState<AccountProfile | null>(null);
  const [accountPending, setAccountPending] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [brainEligible, setBrainEligible] = useState(false);
  const [brainEligibilityChecked, setBrainEligibilityChecked] = useState(false);
  const [brainEligibilityReason, setBrainEligibilityReason] = useState<string | null>(null);
  const [optaAnywhereSupported, setOptaAnywhereSupported] = useState(true);
  const [optaAnywhereSupportChecked, setOptaAnywhereSupportChecked] = useState(false);
  const [optaAnywhereSupportReason, setOptaAnywhereSupportReason] = useState<string | null>(null);
  const [coreStackPending, setCoreStackPending] = useState(false);
  const [brainInstallPending, setBrainInstallPending] = useState(false);
  const [installProgress, setInstallProgress] = useState<InstallProgressSession | null>(null);

  const [hoveredApp, setHoveredApp] = useState<ManifestApp | null>(null);
  const [actionConfirmation, setActionConfirmation] = useState<ActionConfirmationState | null>(null);
  const [confirmationChoice, setConfirmationChoice] = useState<ConfirmationChoice>("confirm");
  const [showSettings, setShowSettings] = useState(false);
  const [showDaemonDrawer, setShowDaemonDrawer] = useState(false);
  const [showTunnelWizard, setShowTunnelWizard] = useState(false);
  const [setupComplete, setSetupComplete] = useState<boolean | null>(null);
  const oneLaunchAutoTriggeredRef = useRef(false);
  const confirmationActionRef = useRef<(() => void | Promise<void>) | null>(null);

  // LMX connection info — used to build magic links for the dashboard
  const [lmxHost, setLmxHost] = useState<string>(() => {
    if (typeof window === "undefined") return LMX_STARTUP_FALLBACK_HOST;
    return window.localStorage.getItem("opta-lmx-url")
      ?.replace(/^https?:\/\//, "").split(":")[0]
      ?? LMX_STARTUP_FALLBACK_HOST;
  });
  const [lmxPort, setLmxPort] = useState<number>(() => {
    if (typeof window === "undefined") return LMX_STARTUP_FALLBACK_PORT;
    const stored = window.localStorage.getItem("opta-lmx-url");
    const portStr = stored?.replace(/^https?:\/\//, "").split(":")[1];
    const parsed = portStr ? parseInt(portStr, 10) : NaN;
    return Number.isFinite(parsed) ? parsed : LMX_STARTUP_FALLBACK_PORT;
  });

  useEffect(() => {
    const fallbackComplete = typeof window !== "undefined" && window.localStorage.getItem(SETUP_COMPLETE_KEY) === "true";
    const cachedConfig = readCachedSetupConfig();
    if (!tauriAvailable) {
      setSetupComplete(isSetupComplete(cachedConfig) || fallbackComplete);
      return;
    }

    let cancelled = false;
    const hydrateSetupState = async () => {
      try {
        const payload = await invoke<GetOptaConfigResult | OptaConfig>("get_opta_config");
        if (cancelled) return;
        const backendConfig = parseOptaConfigPayload(payload);
        const completed = isSetupComplete(backendConfig) || isSetupComplete(cachedConfig) || fallbackComplete;
        setSetupComplete(completed);
      } catch {
        if (cancelled) return;
        setSetupComplete(isSetupComplete(cachedConfig) || fallbackComplete);
      }
    };

    void hydrateSetupState();
    return () => { cancelled = true; };
  }, [tauriAvailable]);

  // Keep lmx host/port in sync with any changes from stored or discovered connection state.
  useEffect(() => {
    if (!tauriAvailable) return;

    let cancelled = false;
    const hydrateLmxConnection = async () => {
      let resolved: LmxConnectionResult = {};

      try {
        const stored = await invoke<LmxConnectionResult>("get_lmx_connection");
        resolved = parseLmxConnection(stored);
      } catch {
        // Fall through to discovery/default.
      }

      if (!resolved.host || typeof resolved.port !== "number") {
        try {
          const discovery = await invoke<MdnsDiscoveryCommandResult>("discover_and_store_lmx_connection");
          const discovered = parseLmxConnection(discovery);
          if (discovered.host && typeof discovered.port === "number") {
            resolved = discovered;
          }
        } catch {
          // Discovery command may not exist yet.
        }
      }

      if (cancelled) return;
      setLmxHost(resolved.host ?? LMX_STARTUP_FALLBACK_HOST);
      setLmxPort(typeof resolved.port === "number" ? resolved.port : LMX_STARTUP_FALLBACK_PORT);
    };

    void hydrateLmxConnection();
    return () => { cancelled = true; };
  }, [tauriAvailable]);

  const installedIndex = useMemo(() => {
    const map = new Map<string, InstalledApp>();
    for (const app of installedApps) {
      if (!map.has(app.id)) {
        map.set(app.id, app);
      }
    }
    return map;
  }, [installedApps]);

  const refreshData = useCallback(async () => {
    if (!tauriAvailable) {
      setManifestResp({
        manifest: BROWSER_PREVIEW_MANIFEST[channel],
        source: "browser-preview",
      });
      setInstalledApps([]);
      setDaemon({ running: false, message: "browser mode", rawOutput: "", checkedAt: "" });
      setAccountProfile(null);
      return;
    }

    try {
      const [manifestResult, installedResult, daemonResult, accountResult] = await Promise.all([
        invoke<ManifestResponse>("fetch_manifest", { channel }),
        invoke<InstalledApp[]>("list_installed_apps"),
        invoke<DaemonStatus>("daemon_status"),
        invoke<AccountProfile | null>("get_account_status"),
      ]);
      setManifestResp(manifestResult);
      setInstalledApps(installedResult);
      setDaemon(daemonResult);
      setAccountProfile(accountResult);
    } catch (e) {
      console.error("Refresh failed:", e);
    }
  }, [channel, tauriAvailable]);

  useEffect(() => {
    void refreshData();
  }, [refreshData]);

  const startInstallProgress = useCallback((mode: InstallProgressMode, title: string, initialLine: string) => {
    setInstallProgress({
      mode,
      title,
      status: "running",
      lines: [initialLine],
    });
  }, []);

  const appendInstallProgressLine = useCallback((line: string) => {
    setInstallProgress((prev) => {
      if (!prev) return prev;
      return { ...prev, lines: [...prev.lines, line].slice(-120) };
    });
  }, []);

  const completeInstallProgress = useCallback((status: InstallProgressStatus, message?: string) => {
    setInstallProgress((prev) => {
      if (!prev) return prev;
      const nextLines = message ? [...prev.lines, message] : prev.lines;
      return {
        ...prev,
        status,
        lines: nextLines,
        error: status === "error" ? (message ?? prev.error ?? "Operation failed.") : undefined,
      };
    });
  }, []);

  const dismissInstallProgress = useCallback(() => {
    setInstallProgress((prev) => (prev && prev.status !== "running" ? null : prev));
  }, []);

  const closeActionConfirmation = useCallback(() => {
    confirmationActionRef.current = null;
    setActionConfirmation(null);
    setConfirmationChoice("confirm");
  }, []);

  const requestActionConfirmation = useCallback((
    {
      title,
      description,
      actionLabel,
      action,
      defaultChoice = "confirm",
    }: {
      title: string;
      description: string;
      actionLabel: string;
      action: () => void | Promise<void>;
      defaultChoice?: ConfirmationChoice;
    },
  ) => {
    confirmationActionRef.current = action;
    setActionConfirmation({ title, description, actionLabel });
    setConfirmationChoice(defaultChoice);
  }, []);

  const executeConfirmedAction = useCallback(async () => {
    const action = confirmationActionRef.current;
    closeActionConfirmation();
    if (!action) return;
    await action();
  }, [closeActionConfirmation]);

  useEffect(() => {
    if (!actionConfirmation) return;

    const handleConfirmationKeys = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const code = e.code;
      const isConfirmCombo =
        (e.shiftKey && key === "enter")
        || (e.shiftKey && (key === " " || code === "Space"))
        || key === "1"
        || code === "Digit1"
        || code === "Numpad1";
      const isCancelCombo =
        key === "2"
        || code === "Digit2"
        || code === "Numpad2"
        || key === "backspace"
        || key === "escape";

      if (key === "arrowleft" || key === "arrowup") {
        e.preventDefault();
        setConfirmationChoice("cancel");
        return;
      }

      if (key === "arrowright" || key === "arrowdown") {
        e.preventDefault();
        setConfirmationChoice("confirm");
        return;
      }

      if (isCancelCombo) {
        e.preventDefault();
        closeActionConfirmation();
        return;
      }

      if (isConfirmCombo) {
        e.preventDefault();
        void executeConfirmedAction();
        return;
      }

      if (key === "enter") {
        e.preventDefault();
        if (confirmationChoice === "confirm") {
          void executeConfirmedAction();
        } else {
          closeActionConfirmation();
        }
      }
    };

    window.addEventListener("keydown", handleConfirmationKeys, true);
    return () => window.removeEventListener("keydown", handleConfirmationKeys, true);
  }, [actionConfirmation, closeActionConfirmation, confirmationChoice, executeConfirmedAction]);

  useEffect(() => {
    if (!showSettings) return;
    const handleSettingsEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !actionConfirmation) {
        event.preventDefault();
        setShowSettings(false);
      }
    };
    window.addEventListener("keydown", handleSettingsEscape, true);
    return () => window.removeEventListener("keydown", handleSettingsEscape, true);
  }, [showSettings, actionConfirmation]);

  const refreshBrainEligibility = useCallback(async () => {
    if (!tauriAvailable) {
      setBrainEligible(false);
      setBrainEligibilityReason(null);
      setBrainEligibilityChecked(false);
      return;
    }

    try {
      const result = await invoke<BrainEligibilityResult | boolean>("detect_brain_eligibility");
      const parsed = parseBrainEligibility(result);
      setBrainEligible(parsed.eligible);
      setBrainEligibilityReason(parsed.reason ?? null);
    } catch (e) {
      setBrainEligible(false);
      const message = e instanceof Error ? e.message : String(e);
      setBrainEligibilityReason(message);
    } finally {
      setBrainEligibilityChecked(true);
    }
  }, [tauriAvailable]);

  useEffect(() => {
    if (!tauriAvailable) return;
    void refreshBrainEligibility();
  }, [refreshBrainEligibility, tauriAvailable]);

  const refreshOptaAnywhereSupport = useCallback(async () => {
    if (!tauriAvailable) {
      setOptaAnywhereSupported(true);
      setOptaAnywhereSupportReason(null);
      setOptaAnywhereSupportChecked(false);
      return;
    }

    try {
      const result = await invoke<OptaAnywhereSupportResult | boolean>("detect_opta_anywhere_support");
      const parsed = parseOptaAnywhereSupport(result);
      setOptaAnywhereSupported(parsed.supported);
      setOptaAnywhereSupportReason(parsed.reason ?? null);
    } catch (_e) {
      // Keep existing behavior if support detection is unavailable.
      setOptaAnywhereSupported(true);
      setOptaAnywhereSupportReason(null);
    } finally {
      setOptaAnywhereSupportChecked(true);
    }
  }, [tauriAvailable]);

  useEffect(() => {
    if (!tauriAvailable) return;
    void refreshOptaAnywhereSupport();
  }, [refreshOptaAnywhereSupport, tauriAvailable]);

  const checkManagerUpdate = useCallback(async () => {
    if (!tauriAvailable) {
      setManagerUpdateState("up_to_date");
      setManagerUpdateWarning(null);
      return;
    }

    try {
      const result = await invoke<ManagerUpdateCheckResult | boolean>("check_manager_update", { channel });
      const parsed = parseManagerUpdateCheck(result);
      setManagerUpdateState(parsed.status);
      setManagerUpdateWarning(parsed.warning ?? null);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setManagerUpdateState("error");
      setManagerUpdateWarning(`Manager update check failed: ${message}`);
    }
  }, [channel, tauriAvailable]);

  useEffect(() => {
    void checkManagerUpdate();
  }, [checkManagerUpdate]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(CHANNEL_STORAGE_KEY, channel);
  }, [channel]);

  const finalizeOneLaunchPairing = useCallback(async () => {
    appendInstallProgressLine("Verifying daemon health...");
    const daemonStatusResult = await invoke<DaemonStatus>("daemon_status").catch((error) => {
      throw new Error(`daemon_missing: failed to query daemon status (${error instanceof Error ? error.message : String(error)})`);
    });
    if (!daemonStatusResult.running) {
      throw new Error("daemon_unhealthy: daemon service is not running after install.");
    }

    appendInstallProgressLine("Ensuring Opta LMX runtime is installed...");
    try {
      await invoke("install_app", { appId: "opta-lmx", channel });
    } catch (error) {
      throw new Error(`lmx_unreachable: failed to install Opta LMX (${error instanceof Error ? error.message : String(error)})`);
    }

    appendInstallProgressLine("Launching Opta LMX runtime...");
    try {
      await invoke("launch_app", { appId: "opta-lmx" });
    } catch (error) {
      throw new Error(`lmx_unreachable: failed to launch Opta LMX (${error instanceof Error ? error.message : String(error)})`);
    }

    appendInstallProgressLine("Resolving LMX connection details...");
    const lmxConnection = await invoke<{ host?: string; port?: number }>("get_lmx_connection")
      .catch((error) => {
        throw new Error(`lmx_unreachable: failed to resolve LMX connection (${error instanceof Error ? error.message : String(error)})`);
      });
    const resolvedHost = lmxConnection.host ?? lmxHost;
    const resolvedPort = lmxConnection.port ?? lmxPort;
    if (lmxConnection.host) setLmxHost(lmxConnection.host);
    if (typeof lmxConnection.port === "number") setLmxPort(lmxConnection.port);

    appendInstallProgressLine("Opening account sign-in and pairing flow...");
    const signInUrl = buildAccountsPairingUrl(resolvedHost, resolvedPort);
    try {
      await invoke("open_url", { url: signInUrl });
    } catch (error) {
      throw new Error(`accounts_unreachable: failed to open account sign-in (${error instanceof Error ? error.message : String(error)})`);
    }

    if (typeof window !== "undefined") {
      window.localStorage.setItem(ONE_LAUNCH_COMPLETE_KEY, "true");
    }
    appendInstallProgressLine("Pairing browser hand-off started.");
  }, [appendInstallProgressLine, channel, lmxHost, lmxPort]);

  const installManagerUpdate = useCallback(async () => {
    if (
      !tauriAvailable
      || managerUpdatePending
      || accountPending
      || coreStackPending
      || brainInstallPending
      || pendingKey !== null
    ) {
      return;
    }
    setManagerUpdatePending(true);
    try {
      const result = await invoke<ManagerUpdateInstallResult>("install_manager_update", { channel });
      if (result?.ok === false) {
        setManagerUpdateState("error");
        setManagerUpdateWarning(
          result.message
          ?? result.error
          ?? "Manager update failed. Please retry in a moment.",
        );
        return;
      }
      if (typeof result?.message === "string" && result.message.trim().length > 0) {
        setManagerUpdateWarning(result.message);
      }
      await checkManagerUpdate();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setManagerUpdateState("error");
      setManagerUpdateWarning(`Manager update failed: ${message}`);
    } finally {
      setManagerUpdatePending(false);
    }
  }, [
    channel,
    checkManagerUpdate,
    managerUpdatePending,
    tauriAvailable,
    accountPending,
    coreStackPending,
    brainInstallPending,
    pendingKey,
  ]);

  const runCoreStackInstall = useCallback(async () => {
    if (
      !tauriAvailable
      || managerUpdatePending
      || accountPending
      || coreStackPending
      || brainInstallPending
      || pendingKey !== null
    ) {
      return;
    }

    setCoreStackPending(true);
    startInstallProgress("core_stack", "Install Core Stack", "Starting core stack install...");

    let unlistenProgress: UnlistenFn | null = null;
    try {
      unlistenProgress = await listen<InstallProgressEventPayload>("zero-touch-progress", (event) => {
        const line = progressLineFromPayload(event.payload);
        if (line) appendInstallProgressLine(line);
      });

      const result = await invoke<InstallFlowResult | boolean>("bootstrap_zero_touch_install", { channel });
      const parsed = parseInstallFlowResult(
        result,
        "Core stack installed successfully.",
        "Core stack install failed.",
      );

      if (parsed.ok) {
        try {
          await finalizeOneLaunchPairing();
          completeInstallProgress("success", `${parsed.message} Pairing flow started in browser.`);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          completeInstallProgress("error", message);
        }
      } else {
        completeInstallProgress("error", parsed.message);
      }

      await refreshData();
      await refreshBrainEligibility();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      completeInstallProgress("error", `Core stack install failed: ${message}`);
    } finally {
      if (unlistenProgress) {
        unlistenProgress();
      }
      setCoreStackPending(false);
    }
  }, [
    tauriAvailable,
    managerUpdatePending,
    accountPending,
    coreStackPending,
    brainInstallPending,
    pendingKey,
    startInstallProgress,
    appendInstallProgressLine,
    completeInstallProgress,
    channel,
    finalizeOneLaunchPairing,
    refreshData,
    refreshBrainEligibility,
  ]);

  useEffect(() => {
    if (!tauriAvailable) return;
    if (setupComplete !== true) return;
    if (oneLaunchAutoTriggeredRef.current) return;
    if (managerUpdatePending || accountPending || coreStackPending || brainInstallPending || pendingKey !== null) return;
    if (typeof window !== "undefined" && window.localStorage.getItem(ONE_LAUNCH_COMPLETE_KEY) === "true") {
      return;
    }
    oneLaunchAutoTriggeredRef.current = true;
    void runCoreStackInstall();
  }, [
    tauriAvailable,
    managerUpdatePending,
    accountPending,
    coreStackPending,
    brainInstallPending,
    pendingKey,
    setupComplete,
    runCoreStackInstall,
  ]);

  const runLocalAiInstall = useCallback(async () => {
    if (
      !tauriAvailable
      || managerUpdatePending
      || accountPending
      || coreStackPending
      || brainInstallPending
      || pendingKey !== null
    ) {
      return;
    }

    setBrainInstallPending(true);

    try {
      const eligibilityPayload = await invoke<BrainEligibilityResult | boolean>("detect_brain_eligibility");
      const eligibility = parseBrainEligibility(eligibilityPayload);
      setBrainEligible(eligibility.eligible);
      setBrainEligibilityReason(eligibility.reason ?? null);
      setBrainEligibilityChecked(true);

      if (!eligibility.eligible) {
        setInstallProgress({
          mode: "local_ai",
          title: "Install Local AI",
          status: "error",
          lines: [eligibility.reason ?? "This machine is not eligible for Local AI installation."],
          error: eligibility.reason ?? "Local AI install is unavailable on this machine.",
        });
        return;
      }

      startInstallProgress("local_ai", "Install Local AI", "Starting Local AI install...");

      let unlistenProgress: UnlistenFn | null = null;
      try {
        unlistenProgress = await listen<InstallProgressEventPayload>("brain-install-progress", (event) => {
          const line = progressLineFromPayload(event.payload);
          if (line) appendInstallProgressLine(line);
        });

        const result = await invoke<InstallFlowResult | boolean>("install_local_ai_brain");
        const parsed = parseInstallFlowResult(
          result,
          "Local AI installed successfully.",
          "Local AI install failed.",
        );

        completeInstallProgress(parsed.ok ? "success" : "error", parsed.message);

        if (parsed.ok) {
          await refreshData();
          await refreshBrainEligibility();
        }
      } finally {
        if (unlistenProgress) {
          unlistenProgress();
        }
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      completeInstallProgress("error", `Local AI install failed: ${message}`);
    } finally {
      setBrainInstallPending(false);
    }
  }, [
    tauriAvailable,
    managerUpdatePending,
    accountPending,
    coreStackPending,
    brainInstallPending,
    pendingKey,
    startInstallProgress,
    appendInstallProgressLine,
    completeInstallProgress,
    refreshData,
    refreshBrainEligibility,
  ]);

  const runDaemonAction = useCallback(async (action: "start" | "stop") => {
    if (!tauriAvailable || managerUpdatePending || accountPending || coreStackPending || brainInstallPending) return;
    setPendingKey(`daemon:${action}`);
    try {
      await invoke(action === "start" ? "daemon_start" : "daemon_stop");
      setDaemon(await invoke<DaemonStatus>("daemon_status"));
    } catch (e) {
      console.error(e);
    } finally {
      setPendingKey(null);
    }
  }, [accountPending, brainInstallPending, coreStackPending, managerUpdatePending, tauriAvailable]);

  const runAppAction = useCallback(async (app: ManifestApp, action: AppAction) => {
    if (!tauriAvailable || managerUpdatePending || accountPending || coreStackPending || brainInstallPending) return;

    setPendingKey(`${action}:${app.id}`);
    try {
      const command =
        action === "install"
          ? "install_app"
          : action === "update"
            ? "update_app"
            : action === "delete"
              ? "uninstall_app"
              : action === "launch"
                ? "launch_app"
                : action === "verify"
                  ? "verify_app"
                  : "open_app_folder";
      const payload =
        action === "install" || action === "update"
          ? { appId: app.id, channel }
          : { appId: app.id };
      await invoke(command, payload);
      if (action === "install" || action === "update" || action === "delete") {
        setInstalledApps(await invoke<InstalledApp[]>("list_installed_apps"));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setPendingKey(null);
      setCmdProgress((prev: any) => { const n = { ...prev }; delete n[app.id]; return n; });
    }
  }, [channel, managerUpdatePending, accountPending, tauriAvailable, coreStackPending, brainInstallPending]);

  const labelForAppAction = useCallback((action: AppAction): string => {
    switch (action) {
      case "install":
        return "Download";
      case "update":
        return "Update";
      case "delete":
        return "Delete";
      case "launch":
        return "Launch";
      case "verify":
        return "Verify";
      case "open_folder":
        return "Open Folder";
      default:
        return "Continue";
    }
  }, []);

  const requestAppActionConfirmation = useCallback((app: ManifestApp, action: AppAction) => {
    const actionLabel = labelForAppAction(action);
    requestActionConfirmation({
      title: `${actionLabel} ${app.name}?`,
      description: `Confirm to ${actionLabel.toLowerCase()} ${app.name}.`,
      actionLabel,
      action: () => runAppAction(app, action),
    });
  }, [labelForAppAction, requestActionConfirmation, runAppAction]);

  const requestDaemonActionConfirmation = useCallback((action: "start" | "stop") => {
    const actionLabel = action === "start" ? "Start Daemon" : "Stop Daemon";
    requestActionConfirmation({
      title: `${actionLabel}?`,
      description: `Confirm to ${actionLabel.toLowerCase()} for your local runtime.`,
      actionLabel,
      action: () => runDaemonAction(action),
    });
  }, [requestActionConfirmation, runDaemonAction]);

  const requestScanConfirmation = useCallback(() => {
    requestActionConfirmation({
      title: "Scan Opta Apps?",
      description: "This scans the system for installed Opta applications and refreshes local status.",
      actionLabel: "Scan",
      action: () => {
        console.log("Scanning PC for Opta Apps...");
        // Future: invoke("scan_system")
      },
    });
  }, [requestActionConfirmation]);

  const confirmationOpen = actionConfirmation !== null;

  useEffect(() => {
    const handleDaemonDrawerShortcut = (event: KeyboardEvent) => {
      if (confirmationOpen) return;
      if (event.metaKey || event.ctrlKey || event.altKey || !event.shiftKey) return;
      if (event.key.toLowerCase() !== "j") return;
      event.preventDefault();
      setShowDaemonDrawer(true);
    };

    window.addEventListener("keydown", handleDaemonDrawerShortcut);
    return () => window.removeEventListener("keydown", handleDaemonDrawerShortcut);
  }, [confirmationOpen]);

  // Global Keydown for Scan
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (confirmationOpen) {
        return;
      }

      if (
        e.key.toLowerCase() === 's'
        && !e.ctrlKey
        && !e.metaKey
        && setupComplete === true
        && !hoveredApp
        && !managerUpdatePending
        && !coreStackPending
        && !brainInstallPending
      ) {
        requestScanConfirmation();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [
    brainInstallPending,
    confirmationOpen,
    coreStackPending,
    hoveredApp,
    managerUpdatePending,
    setupComplete,
    requestScanConfirmation,
  ]);

  useEffect(() => {
    if (
      !hoveredApp
      || pendingKey !== null
      || managerUpdatePending
      || coreStackPending
      || brainInstallPending
      || setupComplete !== true
      || confirmationOpen
    ) {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const isInstalled = installedIndex.has(hoveredApp.id);

      if (key === 'u' && isInstalled) {
        e.preventDefault();
        requestAppActionConfirmation(hoveredApp, "update");
      } else if (key === 'l' && isInstalled) {
        e.preventDefault();
        requestAppActionConfirmation(hoveredApp, "launch");
      } else if (key === 'x' && isInstalled) {
        e.preventDefault();
        requestAppActionConfirmation(hoveredApp, "delete");
      } else if (key === 'd' && !isInstalled) {
        e.preventDefault();
        requestAppActionConfirmation(hoveredApp, "install");
      } else if (key === 'v') {
        e.preventDefault();
        requestAppActionConfirmation(hoveredApp, "verify");
      } else if (key === 'f') {
        e.preventDefault();
        requestAppActionConfirmation(hoveredApp, "open_folder");
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    hoveredApp,
    installedIndex,
    managerUpdatePending,
    coreStackPending,
    brainInstallPending,
    setupComplete,
    pendingKey,
    confirmationOpen,
    requestAppActionConfirmation,
  ]);

  const runAccountAction = useCallback(async (action: "login" | "logout") => {
    if (!tauriAvailable || accountPending || managerUpdatePending || coreStackPending || brainInstallPending) {
      return;
    }
    setAccountPending(true);
    setAccountError(null);
    try {
      await invoke(action === "login" ? "trigger_login" : "trigger_logout");
      setAccountProfile(await invoke<AccountProfile | null>("get_account_status"));
    } catch (e) {
      console.error("Account action failed:", e);
      setAccountError(e instanceof Error ? e.message : String(e));
    } finally {
      setAccountPending(false);
    }
  }, [accountPending, managerUpdatePending, tauriAvailable, coreStackPending, brainInstallPending]);

  const apps = manifestResp?.manifest.apps ?? [];
  const appById = useMemo(() => {
    return new Map(apps.map((app) => [app.id, app] as const));
  }, [apps]);
  const fallbackAppById = useMemo(() => {
    return new Map(BROWSER_PREVIEW_MANIFEST.stable.apps.map((app) => [app.id, app] as const));
  }, []);

  const coreCode = appById.get("opta-code-universal") ?? fallbackAppById.get("opta-code-universal");
  const centerCodeApp: ManifestApp = coreCode ?? {
    id: "opta-code-universal",
    name: "Opta Code",
    description: "Desktop IDE surface powered by your local LMX endpoints.",
    version: "stable-preview",
    website: "https://init.optalocal.com/apps/opta-code",
  };
  const sceneSpecIds = useMemo(() => new Set(SCENE_NODE_SPECS.map((spec) => spec.id)), []);

  const displayApp = hoveredApp;
  const isInstalled = displayApp ? installedIndex.has(displayApp.id) : false;
  const isPending = displayApp ? pendingKey?.includes(displayApp.id) : false;
  const installBusy = coreStackPending || brainInstallPending;
  const controlsDisabled =
    pendingKey !== null
    || managerUpdatePending
    || installBusy
    || accountPending
    || confirmationOpen
    || setupComplete !== true;
  const showLocalAiAction = brainEligibilityChecked && brainEligible && !controlsDisabled;
  const optaAnywhereDisabled = controlsDisabled || !optaAnywhereSupported;
  const optaAnywhereUnavailableMessage = optaAnywhereSupportReason ?? "This platform is not currently supported.";
  const managerUpdateChipClass =
    managerUpdateState === "update_available"
      ? "update-available"
      : managerUpdateState === "error"
        ? "error"
        : "up-to-date";

  // Floating animation delays
  const getFloatingClass = (index: number) => `floating-${(index % 5) + 1}`;
  const getSceneDriftClass = (index: number) => `scene-drift-${(index % 5) + 1}`;

  const withLogoPose = (
    pose: LogoPose,
    layoutStyle?: CSSProperties,
  ): CSSProperties => ({
    ...layoutStyle,
    ["--logo-tilt-x" as string]: `${pose.tiltX}deg`,
    ["--logo-tilt-y" as string]: `${pose.tiltY}deg`,
    ["--logo-shadow-x" as string]: `${pose.shadowX}px`,
    ["--logo-shadow-y" as string]: `${pose.shadowY ?? 12}px`,
    ["--logo-hover-scale" as string]: String(pose.hoverScale ?? 1.16),
  });

  type PositionedSceneNode = {
    app: ManifestApp;
    x: number;
    y: number;
    pose: LogoPose;
    className: string;
  };

  const sceneNodes = SCENE_NODE_SPECS.reduce<PositionedSceneNode[]>((acc, spec) => {
    const app = appById.get(spec.id) ?? fallbackAppById.get(spec.id);
    if (!app) return acc;
    acc.push({
      app,
      x: spec.x,
      y: spec.y,
      pose: {
        tiltX: spec.tiltX,
        tiltY: spec.tiltY,
        shadowX: spec.shadowX,
        shadowY: spec.shadowY,
        hoverScale: spec.hoverScale,
      },
      className: spec.className ?? "tier-secondary",
    });
    return acc;
  }, []);

  const fallbackNodes: PositionedSceneNode[] = apps
    .filter((app) => app.id !== "opta-code-universal" && app.id !== "opta-status" && !sceneSpecIds.has(app.id))
    .slice(0, SCENE_FALLBACK_POINTS.length)
    .map((app, index) => {
      const point = SCENE_FALLBACK_POINTS[index];
      const tiltY = point.x < SCENE_CENTER.x ? 16 : -16;
      const tiltX = point.y < SCENE_CENTER.y ? 9 : -9;
      return {
        app,
        x: point.x,
        y: point.y,
        pose: { tiltX, tiltY, shadowX: tiltY > 0 ? -8 : 8, shadowY: 12, hoverScale: 1.18 },
        className: "tier-secondary",
      };
    });

  const sceneSatelliteNodes = [...sceneNodes, ...fallbackNodes];

  const renderAppNode = (
    app: ManifestApp,
    customClass: string = "",
    animIndex: number,
    customStyle?: CSSProperties,
    options?: {
      disableFloat?: boolean;
      keySuffix?: string;
    },
  ) => {
    if (!app) return null;
    const { disableFloat = false, keySuffix = "" } = options ?? {};
    const logoPath = LOGOS[app.id] || LOGOS["default"];
    const isAppInstalled = installedIndex.has(app.id);
    const isDaemon = app.id === "opta-daemon";
    const isActive = isDaemon ? daemon?.running : isAppInstalled;

    return (
      <div
        key={`${app.id}${keySuffix}`}
        className={`app-item ${customClass} ${disableFloat ? "" : getFloatingClass(animIndex)}`}
        onMouseEnter={() => setHoveredApp(app)}
        onMouseLeave={() => setHoveredApp(null)}
        onClick={() => {
          if (app.id === "opta-lmx") {
            // Open LMX Dashboard with magic-link: auto-connects to the known LMX endpoint
            const magicUrl = buildLmxMagicUrl({ host: lmxHost, port: lmxPort, via: "lan" });
            invoke("open_url", { url: magicUrl }).catch(console.error);
          } else if (app.website) {
            invoke("open_url", { url: app.website }).catch(console.error);
          }
        }}
        style={{
          cursor: app.website ? "pointer" : "default",
          ...customStyle,
        }}
      >
        <div className="tooltip">
          <div className="tooltip-title">{app.name}</div>
          {hoveredApp?.id === app.id && app.id !== "opta-daemon" && (
            <div className="tooltip-shortcuts">
              {isAppInstalled ? (
                <>
                  <span><kbd>L</kbd> Launch</span>
                  <span><kbd>U</kbd> Update</span>
                  <span><kbd>X</kbd> Delete</span>
                  <span><kbd>V</kbd> Verify</span>
                  <span><kbd>F</kbd> Folder</span>
                </>
              ) : (
                <span><kbd>D</kbd> Download</span>
              )}
            </div>
          )}
        </div>
        <div className="purple-circle"></div>
        <img
          src={logoPath}
          className="app-logo"
          alt={app.name}
          onError={(e) => {
            if (e.currentTarget.src !== LOGOS["default"]) {
              e.currentTarget.src = LOGOS["default"];
            }
          }}
        />
        {isActive && <div className="app-status-pip active"></div>}
      </div>
    );
  };

  return (
    <div className="window-app">
      <ParticleBackground />

      <div className="header">
        <div className="sidebar-text">INIT MANAGER</div>
        <h1 className="main-title">{displayApp ? displayApp.name : "Select Environment"}</h1>
        <div className="header-utility-row">
          <button className="header-icon-btn" onClick={() => setShowSettings(true)} title="Settings" disabled={controlsDisabled}>
            <Settings size={18} />
          </button>
          <button
            className="header-icon-btn"
            onClick={() => setShowDaemonDrawer(true)}
            title="Daemon Activity (Shift+J)"
            disabled={confirmationOpen}
          >
            <Activity size={18} />
          </button>
          <button
            className="header-icon-btn"
            onClick={() => requestActionConfirmation({
              title: "Enable Opta Anywhere?",
              description: "This opens the Opta Anywhere setup flow for secure remote access.",
              actionLabel: "Enable",
              action: () => setShowTunnelWizard(true),
            })}
            title={!optaAnywhereSupported ? `Opta Anywhere unavailable: ${optaAnywhereUnavailableMessage}` : "Enable Opta Anywhere"}
            disabled={optaAnywhereDisabled}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
          </button>
        </div>
        {displayApp && (
          <p className="app-desc-text fade-in">{displayApp.description}</p>
        )}
      </div>

      <div className="cluster-container">
        <div className="scene-layout">
          <div className="network-layer" aria-hidden>
            <svg viewBox={`0 0 ${SCENE_WIDTH} ${SCENE_HEIGHT}`} preserveAspectRatio="xMidYMid meet">
              {sceneSatelliteNodes.map((node, index) => (
                <g key={`network-${node.app.id}`}>
                  <circle className="pulse-dot pulse-dot-primary" r="3.2">
                    <animateMotion
                      dur={`${4.8 + (index % 3) * 0.45}s`}
                      begin={`${index * 0.34}s`}
                      repeatCount="indefinite"
                      path={`M ${SCENE_CENTER.x} ${SCENE_CENTER.y} L ${node.x} ${node.y}`}
                    />
                  </circle>
                  <circle className="pulse-dot pulse-dot-secondary" r="2.3">
                    <animateMotion
                      dur={`${6.25 + (index % 2) * 0.55}s`}
                      begin={`${index * 0.34 + 1.25}s`}
                      repeatCount="indefinite"
                      path={`M ${SCENE_CENTER.x} ${SCENE_CENTER.y} L ${node.x} ${node.y}`}
                    />
                  </circle>
                  <circle className="pulse-dot pulse-dot-return" r="1.9">
                    <animateMotion
                      dur={`${5.6 + (index % 3) * 0.5}s`}
                      begin={`${index * 0.28 + 0.85}s`}
                      repeatCount="indefinite"
                      path={`M ${node.x} ${node.y} L ${SCENE_CENTER.x} ${SCENE_CENTER.y}`}
                    />
                  </circle>
                </g>
              ))}
            </svg>
          </div>

          {sceneSatelliteNodes.map((node, index) =>
            renderAppNode(
              node.app,
              `scene-node satellite-node angled-item ${node.className} ${getSceneDriftClass(index)}`,
              index + 3,
              withLogoPose(node.pose, {
                left: `${(node.x / SCENE_WIDTH) * 100}%`,
                top: `${(node.y / SCENE_HEIGHT) * 100}%`,
              }),
              {
                disableFloat: true,
                keySuffix: `-scene-${index}`,
              },
            ),
          )}

          {renderAppNode(
            centerCodeApp,
            "scene-node center-code-node front-core-item core-focus scene-drift-core",
            0,
            withLogoPose(CORE_LOGO_POSE, {
              left: `${(SCENE_CENTER.x / SCENE_WIDTH) * 100}%`,
              top: `${(SCENE_CENTER.y / SCENE_HEIGHT) * 100}%`,
            }),
            {
              disableFloat: true,
              keySuffix: "-scene-center",
            },
          )}
        </div>
      </div>

      <div className="bottom-panel">
        <div className="centered-bottom-group">
          <div className="status-row">
            <div
              className="status-badge"
              onClick={() => requestDaemonActionConfirmation(daemon?.running ? "stop" : "start")}
              style={{ cursor: "pointer" }}
            >
              <div className={`status-dot ${daemon?.running ? 'active' : ''}`}></div>
              {daemon?.running ? 'Daemon Active' : 'Daemon Stopped'}
              {pendingKey?.includes('daemon') && " (Working...)"}
            </div>
            <div className={`manager-update-chip ${managerUpdateChipClass}`}>
              <span className="manager-update-chip-title">Manager</span>
              <span>{MANAGER_UPDATE_LABELS[managerUpdateState]}</span>
            </div>
            <div className="scan-hint" onClick={() => requestScanConfirmation()} title="Scan system for Opta apps">
              Scan <kbd>S</kbd>
            </div>
          </div>
          {managerUpdateWarning && (
            <p className="manager-update-warning" title={managerUpdateWarning}>
              {managerUpdateWarning}
            </p>
          )}

          <div className="action-buttons centered-actions">
            {managerUpdateState === "update_available" && (
              <button
                className="btn secondary manager-update-button"
                disabled={controlsDisabled}
                onClick={() => requestActionConfirmation({
                  title: "Update Opta Init Manager?",
                  description: "This installs the latest manager update on your selected channel.",
                  actionLabel: "Update",
                  action: () => installManagerUpdate(),
                })}
              >
                {managerUpdatePending ? "Updating Manager..." : "Update Manager"}
              </button>
            )}
            {displayApp ? (
              <div className="fade-in">
                {displayApp.id === "opta-daemon" ? (
                  <button
                    className="btn primary"
                    disabled={controlsDisabled}
                    onClick={() => requestDaemonActionConfirmation(daemon?.running ? "stop" : "start")}
                  >
                    {pendingKey?.includes('daemon') ? "Processing..." : (daemon?.running ? "Stop Daemon" : "Start Daemon")}
                  </button>
                ) : isInstalled ? (
                  <>
                    <button className="btn primary" disabled={controlsDisabled} onClick={() => requestAppActionConfirmation(displayApp, "launch")}>
                      Launch App
                    </button>
                    <button className="btn secondary" disabled={controlsDisabled} onClick={() => requestAppActionConfirmation(displayApp, "update")}>
                      Update
                    </button>
                    <button className="btn danger" disabled={controlsDisabled} onClick={() => requestAppActionConfirmation(displayApp, "delete")}>
                      Delete
                    </button>
                  </>
                ) : isPending ? (
                  <div className="progress-container" style={{ width: '100%', marginTop: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#a1a1aa', marginBottom: '4px', fontFamily: '"JetBrains Mono", monospace' }}>
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '80%' }}>
                        {cmdProgress[displayApp.id]?.line || "Starting..."}
                      </span>
                      <span>{cmdProgress[displayApp.id]?.pct ? `${cmdProgress[displayApp.id].pct}%` : ''}</span>
                    </div>
                    <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        background: '#8b5cf6',
                        width: cmdProgress[displayApp.id]?.pct ? `${cmdProgress[displayApp.id].pct}%` : '100%',
                        transition: 'width 0.2s ease-out',
                        animation: cmdProgress[displayApp.id]?.pct ? 'none' : 'pulse 1.5s infinite'
                      }} />
                    </div>
                  </div>
                ) : (
                  <button className="btn primary" disabled={controlsDisabled} onClick={() => requestAppActionConfirmation(displayApp, "install")}>
                    Install App
                  </button>
                )}
              </div>
            ) : (
              <div className="fade-in hero-actions-stack">
                <div className="hero-action-row">
                <button
                  className="btn hero-btn hero-btn-core"
                  onClick={() => requestActionConfirmation({
                    title: "Install Core Stack?",
                    description: "This installs Opta daemon, core runtime services, and starts pairing setup.",
                    actionLabel: "Install",
                    action: () => runCoreStackInstall(),
                  })}
                  disabled={controlsDisabled}
                >
                  {coreStackPending ? "Installing Core Stack..." : "Install Core Stack"}
                </button>
                <button
                  className="btn hero-btn hero-btn-anywhere"
                  onClick={() => requestActionConfirmation({
                    title: "Enable Opta Anywhere?",
                    description: "This opens the Opta Anywhere setup flow for secure remote access.",
                    actionLabel: "Enable",
                    action: () => setShowTunnelWizard(true),
                  })}
                  disabled={optaAnywhereDisabled}
                  title={!optaAnywhereSupported ? optaAnywhereUnavailableMessage : "Enable Opta Anywhere"}
                >
                  Enable Opta Anywhere
                </button>
                <button
                  className="btn hero-btn hero-btn-refresh"
                  onClick={() => requestActionConfirmation({
                    title: "Refresh Stack?",
                    description: "This refreshes installed apps, daemon status, and account linkage data.",
                    actionLabel: "Refresh",
                    action: () => refreshData(),
                  })}
                  disabled={controlsDisabled}
                >
                  Refresh Stack
                </button>
                </div>
                {showLocalAiAction && (
                  <div className="hero-action-aux">
                    <button
                      className="btn secondary hero-aux-btn"
                      onClick={() => requestActionConfirmation({
                        title: "Install Local AI?",
                        description: "This installs local AI dependencies and the default model for Brain mode.",
                        actionLabel: "Install",
                        action: () => runLocalAiInstall(),
                      })}
                      disabled={controlsDisabled}
                    >
                      {brainInstallPending ? "Installing Local AI..." : "Install Local AI"}
                    </button>
                  </div>
                )}
                {brainEligibilityChecked && !brainEligible && brainEligibilityReason && (
                  <p
                    className="manager-update-warning"
                    style={{ width: "100%", textAlign: "center", marginTop: "2px" }}
                    title={brainEligibilityReason}
                  >
                    Local AI unavailable: {brainEligibilityReason}
                  </p>
                )}
                {optaAnywhereSupportChecked && !optaAnywhereSupported && (
                  <p
                    className="manager-update-warning"
                    style={{ width: "100%", textAlign: "center", marginTop: "2px" }}
                    title={optaAnywhereUnavailableMessage}
                  >
                    Opta Anywhere unavailable: {optaAnywhereUnavailableMessage}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {actionConfirmation && (
        <div
          className="modal-overlay action-confirm-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeActionConfirmation();
            }
          }}
        >
          <div className="modal-content action-confirm-content fade-in" role="dialog" aria-modal="true" aria-label={actionConfirmation.title}>
            <h2 className="modal-title">{actionConfirmation.title}</h2>
            <p className="modal-desc">{actionConfirmation.description}</p>
            <div className="modal-actions action-confirm-actions">
              <button
                className={`btn secondary btn-compact ${confirmationChoice === "cancel" ? "action-choice-selected" : ""}`}
                onMouseEnter={() => setConfirmationChoice("cancel")}
                onClick={() => closeActionConfirmation()}
              >
                Cancel
              </button>
              <button
                className={`btn primary btn-compact ${confirmationChoice === "confirm" ? "action-choice-selected" : ""}`}
                onMouseEnter={() => setConfirmationChoice("confirm")}
                onClick={() => void executeConfirmedAction()}
              >
                {actionConfirmation.actionLabel}
              </button>
            </div>
            <p className="action-confirm-shortcuts">
              Cancel: <kbd>2</kbd> <kbd>Backspace</kbd> <kbd>Esc</kbd> · Continue: <kbd>Shift+Enter</kbd> <kbd>1</kbd> <kbd>Shift+Space</kbd>
            </p>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowSettings(false); }}>
          <div className="settings-modal fade-in">
            <h2 className="modal-title" style={{ textAlign: 'left', marginBottom: '8px' }}>Opta Init Settings</h2>

            <div className="settings-section">
              <h3>Update Channel</h3>
              <div className="settings-row">
                <div className="settings-info">
                  <div className="settings-label">Manager update track</div>
                  <div className="settings-sub">Choose which release stream Opta Init Manager follows.</div>
                </div>
                <select
                  aria-label="Manager update channel"
                  className="settings-select"
                  value={channel}
                  onChange={(event) => setChannel(normalizeChannel(event.target.value))}
                >
                  <option value="stable">Stable</option>
                  <option value="beta">Beta</option>
                </select>
              </div>
              <div className="settings-row">
                <div className="settings-info">
                  <div className="settings-label">Manager update controls</div>
                  <div className="settings-sub">Check updates and refresh install status immediately.</div>
                </div>
                <div className="settings-actions">
                  <button
                    className="btn secondary btn-compact"
                    onClick={() => void checkManagerUpdate()}
                    disabled={controlsDisabled}
                  >
                    Check Updates
                  </button>
                  <button
                    className="btn secondary btn-compact"
                    onClick={() => void refreshData()}
                    disabled={controlsDisabled}
                  >
                    Refresh Stack
                  </button>
                </div>
              </div>
            </div>

            <div className="settings-section">
              <h3>Opta Account</h3>
              <div className="settings-row">
                <div className="settings-info">
                  <div className="settings-label">{accountProfile?.email ?? "Not Linked"}</div>
                  <div className="settings-sub">
                    {accountProfile ? `Role: ${accountProfile.activeRole ?? "Developer"}` : "Sync significant data preferences, identity and cloud backups."}
                  </div>
                  {accountError ? (
                    <div className="settings-sub settings-error">{accountError}</div>
                  ) : null}
                </div>
                <button
                  className="btn secondary btn-compact"
                  disabled={accountPending || controlsDisabled}
                  onClick={() => requestActionConfirmation({
                    title: accountProfile ? "Sign out Opta Account?" : "Link Opta Account?",
                    description: accountProfile
                      ? "You will be signed out from this device until you link again."
                      : "This opens the account link flow in your browser.",
                    actionLabel: accountProfile ? "Sign Out" : "Link",
                    action: () => runAccountAction(accountProfile ? "logout" : "login"),
                  })}
                >
                  {accountPending ? "Working..." : accountProfile ? "Sign Out" : "Link Account"}
                </button>
              </div>
            </div>

            <div className="settings-section">
              <h3>System Components</h3>
              <div className="settings-row">
                <div className="settings-info">
                  <div className="settings-label">Opta Init Manager</div>
                  <div className="settings-sub">{managerInstallLocation(platform)}</div>
                </div>
                <div className="settings-actions">
                  <div className="settings-value">v1.0.0</div>
                  {managerUpdateState === "update_available" && (
                    <button
                      className="btn secondary btn-compact"
                      disabled={controlsDisabled}
                      onClick={() => requestActionConfirmation({
                        title: "Update Opta Init Manager?",
                        description: "This installs the latest manager update on your selected channel.",
                        actionLabel: "Update",
                        action: () => installManagerUpdate(),
                      })}
                    >
                      Update
                    </button>
                  )}
                </div>
              </div>
              {apps.map(app => (
                <div key={app.id} className="settings-row settings-row-app">
                  <div className="settings-info">
                    <div className="settings-label">{app.name}</div>
                    <div className="settings-sub">
                      {installedIndex.has(app.id) ? installedIndex.get(app.id)?.path || "Installed" : "Not Installed"}
                    </div>
                  </div>
                  <div className="settings-actions">
                    <div className="settings-value">
                      {installedIndex.has(app.id) ? installedIndex.get(app.id)!.version : app.version}
                    </div>
                    {installedIndex.has(app.id) ? (
                      <>
                        <button
                          className="btn secondary btn-compact"
                          disabled={controlsDisabled}
                          onClick={() => requestAppActionConfirmation(app, "launch")}
                        >
                          Launch
                        </button>
                        <button
                          className="btn secondary btn-compact"
                          disabled={controlsDisabled}
                          onClick={() => requestAppActionConfirmation(app, "update")}
                        >
                          Update
                        </button>
                        <button
                          className="btn danger btn-compact"
                          disabled={controlsDisabled}
                          onClick={() => requestAppActionConfirmation(app, "delete")}
                        >
                          Delete
                        </button>
                      </>
                    ) : (
                      <button
                        className="btn primary btn-compact"
                        disabled={controlsDisabled}
                        onClick={() => requestAppActionConfirmation(app, "install")}
                      >
                        Install
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="modal-actions" style={{ marginTop: '32px', justifyContent: 'flex-end' }}>
              <button className="btn secondary btn-compact" onClick={() => setShowSettings(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {installProgress && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget && installProgress.status !== "running") {
              dismissInstallProgress();
            }
          }}
        >
          <div className="modal-content fade-in" style={{ textAlign: "left", width: "min(680px, 92vw)", maxWidth: "680px" }}>
            <h2 className="modal-title" style={{ marginBottom: "6px", textAlign: "left", fontSize: "20px" }}>
              {installProgress.title}
            </h2>
            <p className="modal-desc" style={{ marginBottom: "12px" }}>
              {installProgress.mode === "core_stack"
                ? "Installing core Opta services and apps."
                : "Installing local AI runtime and dependencies."}
            </p>

            <div
              style={{
                background: "rgba(9,9,11,0.85)",
                border: "1px solid rgba(63,63,70,0.7)",
                borderRadius: "10px",
                padding: "10px 12px",
                minHeight: "160px",
                maxHeight: "240px",
                overflowY: "auto",
                fontFamily: "JetBrains Mono, monospace",
                fontSize: "11px",
                lineHeight: 1.45,
                color: "#d4d4d8",
              }}
            >
              {installProgress.lines.map((line, index) => (
                <div key={`${installProgress.mode}-${index}`} style={{ marginBottom: "3px" }}>
                  {line}
                </div>
              ))}
            </div>

            <div className="modal-actions" style={{ justifyContent: "space-between", marginTop: "16px" }}>
              <div
                style={{
                  fontSize: "11px",
                  fontFamily: "JetBrains Mono, monospace",
                  color:
                    installProgress.status === "running"
                      ? "#a78bfa"
                      : installProgress.status === "success"
                        ? "#4ade80"
                        : "#fca5a5",
                }}
              >
                {installProgress.status === "running" && "Working..."}
                {installProgress.status === "success" && "Completed successfully"}
                {installProgress.status === "error" && (installProgress.error ?? "Failed")}
              </div>
              <button className="btn secondary btn-compact" onClick={() => dismissInstallProgress()} disabled={installProgress.status === "running"}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showTunnelWizard && (
        <TunnelWizard
          lmxHost={lmxHost}
          lmxPort={lmxPort}
          onClose={() => setShowTunnelWizard(false)}
          onComplete={(tunnelUrl) => {
            console.log("Opta Anywhere configured:", tunnelUrl);
          }}
        />
      )}

      <DaemonDrawer
        isOpen={showDaemonDrawer}
        onClose={() => setShowDaemonDrawer(false)}
      />

      {setupComplete === false && (
        <SetupWizard
          onComplete={() => {
            if (typeof window !== "undefined") {
              window.localStorage.setItem(SETUP_COMPLETE_KEY, "true");
            }
            setSetupComplete(true);
          }}
        />
      )}
    </div>
  );
}
