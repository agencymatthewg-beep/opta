import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocalStorage } from "./hooks/useLocalStorage";
import { CommandPalette } from "./components/CommandPalette";
import { Composer } from "./components/Composer";
import { SetupWizard } from "./components/SetupWizard";
import { SettingsModal } from "./components/SettingsModal";
import type { SettingsTabId } from "./components/SettingsModal";
import { Download } from "lucide-react";
import { TimelineCards } from "./components/TimelineCards";
import { WorkspaceRail } from "./components/WorkspaceRail";
import { ProjectPane } from "./components/ProjectPane";
import { WidgetPane } from "./components/WidgetPane";
import { SettingsView } from "./components/SettingsView";
import { useWidgetLayout } from "./hooks/useWidgetLayout";
import { ModelsPage } from "./pages/ModelsPage";
import { PermissionModal } from "./components/PermissionModal";
import { BackgroundJobsPage } from "./pages/BackgroundJobsPage";
import { DaemonLogsPage } from "./pages/DaemonLogsPage";
import { ToolingOperationsPage } from "./pages/ToolingOperationsPage";
import { AppCatalogPage } from "./pages/AppCatalogPage";
import { SessionMemoryPage } from "./pages/SessionMemoryPage";
import { SystemOperationsPage } from "./pages/SystemOperationsPage";
import { EnvProfilesPage } from "./pages/EnvProfilesPage";
import { McpManagementPage } from "./pages/McpManagementPage";
import { ConfigStudioPage } from "./pages/ConfigStudioPage";
import { AccountControlPage } from "./pages/AccountControlPage";
import { CliOperationsPage } from "./pages/CliOperationsPage";
import { TelemetryPanel } from "./components/TelemetryPanel";
import { downloadAsFile, exportToMarkdown } from "./lib/sessionExporter";
import { useCommandPalette } from "./hooks/useCommandPalette";
import { useDaemonSessions } from "./hooks/useDaemonSessions";
import { daemonClient } from "./lib/daemonClient";
import { useBrowserLiveHost } from "./hooks/useBrowserLiveHost";
import { useConnectionHealth } from "./hooks/useConnectionHealth";
import { LiveBrowserView } from "./components/LiveBrowserView";
import { OPEN_SETUP_WIZARD_EVENT } from "./components/ErrorBoundary";
import {
  deriveBrowserVisualState,
  type BrowserVisualSummary,
} from "./lib/browserVisualState";
import { useAccountsAuthControls } from "./hooks/useAccountsAuthControls";
import { getTauriInvoke, isNativeDesktop } from "./lib/runtime";
import type {
  PaletteCommand,
  SessionSubmitMode,
  SessionTurnOverrides,
} from "./types";

interface TranscriptionResult {
  text: string;
}

interface TTSResult {
  audioBase64: string;
}

type AppPage =
  | "sessions"
  | "models"
  | "tools"
  | "apps"
  | "memory"
  | "system"
  | "cli"
  | "env"
  | "mcp"
  | "config"
  | "account"
  | "jobs"
  | "logs";
const ACCOUNTS_PORTAL_URL = "https://accounts.optalocal.com";

export type BrowserViewMode = "default" | "expanded" | "minimized";

function modePillLabel(mode: SessionSubmitMode): string {
  switch (mode) {
    case "do":
      return "Do mode";
    case "plan":
      return "Plan mode";
    case "review":
      return "Review mode";
    case "research":
      return "Research mode";
    default:
      return "Chat mode";
  }
}

function modeSubmitNotice(mode: SessionSubmitMode): string {
  switch (mode) {
    case "do":
      return "Task dispatched to agent";
    case "plan":
      return "Planning request submitted to daemon";
    case "review":
      return "Review request submitted to daemon";
    case "research":
      return "Research request submitted to daemon";
    default:
      return "Message submitted to daemon";
  }
}

function App() {
  const nativeDesktop = isNativeDesktop();

  // null = loading (show blank), true = first run (show wizard), false = normal app
  const [firstRun, setFirstRun] = useState<boolean | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSettingsView, setIsSettingsView] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] =
    useState<SettingsTabId>("connection");

  useEffect(() => {
    const invoke = getTauriInvoke();
    if (!invoke) {
      // Browser / Vite dev mode — skip wizard
      setFirstRun(false);
      return;
    }
    invoke("check_first_run")
      .then((isFirstRun) => setFirstRun(Boolean(isFirstRun)))
      .catch(() => setFirstRun(false)); // On error, don't block the app
  }, []);

  const [showTerminal, setShowTerminal] = useState(false); // Changed initial state from true to false
  const [composerDraft, setComposerDraft] = useState("");
  const [submissionMode, setSubmissionMode] =
    useState<SessionSubmitMode>("chat");
  const [selectedWorkspace, setSelectedWorkspace] = useLocalStorage(
    "opta:selectedWorkspace",
    "all",
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [activePage, setActivePage] = useState<AppPage>("sessions");
  const [showToken, setShowToken] = useState(false);
  const [hasEverConnected, setHasEverConnected] = useState(false);
  const [disconnectedSinceMs, setDisconnectedSinceMs] = useState<number | null>(
    null,
  );
  const [offlineSeconds, setOfflineSeconds] = useState(0);
  const [browserViewMode, setBrowserViewMode] =
    useState<BrowserViewMode>("default");
  const [designMode, setDesignMode] = useState("3");
  const [deviceLabel, setDeviceLabel] = useState<string>(() => {
    try { return localStorage.getItem("opta:deviceLabel") ?? "Workstation - Opta48"; }
    catch { return "Workstation - Opta48"; }
  });

  // Persist deviceLabel to localStorage whenever it changes
  const handleDeviceLabelChange = useCallback((label: string) => {
    setDeviceLabel(label);
    try { localStorage.setItem("opta:deviceLabel", label); } catch { /* noop */ }
  }, []);


  const openSettings = useCallback((tab: SettingsTabId = "connection") => {
    setSettingsInitialTab(tab);
    setIsSettingsOpen(true);
  }, []);

  const {
    activeSessionId,
    cancelActiveTurn,
    connection,
    connectionError,
    connectionState,
    isStreaming,
    pendingPermissions,
    streamingBySession,
    pendingPermissionsBySession,
    repairConnection,
    refreshNow,
    resolvePermission,
    resolveSessionPermission,
    runtime,
    sessions,
    setActiveSessionId,
    setConnection,
    submitMessage,
    timelineBySession,
    rawEventsBySession,
    trackSession,
    createSession,
    removeSession,
    initialCheckDone,
    runtimePollDelayMs,
  } = useDaemonSessions();

  // V1: Widget layout hook
  const widgetLayout = useWidgetLayout("default");
  const { handleAccountsLogin } = useAccountsAuthControls({
    connection,
    onNotice: (message) => setNotice(message),
  });

  const useConnectionHealthResult = useConnectionHealth(connection, connectionState);

  const { status: browserLiveHostStatus, getSlotForSession } =
    useBrowserLiveHost(connection);

  const activeSession = useMemo(
    () =>
      sessions.find((session) => session.sessionId === activeSessionId) ?? null,
    [activeSessionId, sessions],
  );

  const activeBrowserSlot = activeSessionId
    ? getSlotForSession(activeSessionId)
    : undefined;
  const activeBrowserViewerAuthToken = browserLiveHostStatus?.viewerAuthToken;

  const activeStreamCount = useMemo(
    () => Object.values(streamingBySession).filter(Boolean).length,
    [streamingBySession],
  );

  const totalPendingPermissions = useMemo(
    () =>
      Object.values(pendingPermissionsBySession).reduce(
        (sum, arr) => sum + arr.length,
        0,
      ),
    [pendingPermissionsBySession],
  );

  const firstPendingPermission = useMemo(() => {
    for (const [sessionId, reqs] of Object.entries(pendingPermissionsBySession)) {
      if (reqs && reqs.length > 0) {
        return { ...reqs[0], sessionId };
      }
    }
    return null;
  }, [pendingPermissionsBySession]);

  const timelineItems = activeSessionId
    ? (timelineBySession[activeSessionId] ?? [])
    : [];
  const sessionCount = sessions.length;

  const browserVisualBySession = useMemo<
    Record<string, BrowserVisualSummary>
  >(() => {
    const next: Record<string, BrowserVisualSummary> = {};
    for (const session of sessions) {
      const sessionId = session.sessionId;
      next[sessionId] = deriveBrowserVisualState({
        connectionState,
        isStreaming: streamingBySession[sessionId] ?? false,
        pendingPermissions: pendingPermissionsBySession[sessionId] ?? [],
        timelineItems: timelineBySession[sessionId] ?? [],
      });
    }
    return next;
  }, [
    connectionState,
    sessions,
    streamingBySession,
    pendingPermissionsBySession,
    timelineBySession,
  ]);

  const activeBrowserVisual = useMemo(
    () =>
      activeSessionId
        ? (browserVisualBySession[activeSessionId] ??
          deriveBrowserVisualState({
            connectionState,
            isStreaming,
            pendingPermissions,
            timelineItems,
          }))
        : deriveBrowserVisualState({
          connectionState,
          isStreaming: false,
          pendingPermissions: [],
          timelineItems: [],
        }),
    [
      activeSessionId,
      browserVisualBySession,
      connectionState,
      isStreaming,
      pendingPermissions,
      timelineItems,
    ],
  );

  const browserWorkingCount = useMemo(
    () =>
      Object.values(browserVisualBySession).filter(
        (summary) => summary.state === "working",
      ).length,
    [browserVisualBySession],
  );

  const browserBlockedCount = useMemo(
    () =>
      Object.values(browserVisualBySession).filter(
        (summary) => summary.state === "blocked",
      ).length,
    [browserVisualBySession],
  );

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 3800);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  // Effect: Global Keyboard Shortcuts (e.g., Ctrl+B for browser mode)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if the user is typing in an input/textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        // V1: Ctrl+S toggles in-place settings view
        e.preventDefault();
        setIsSettingsView((prev) => !prev);
      } else if (e.key === "Escape" && isSettingsView) {
        setIsSettingsView(false);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setBrowserViewMode((current) => {
          const next =
            current === "default"
              ? "expanded"
              : current === "expanded"
                ? "minimized"
                : "default";
          const nextLabel =
            next === "expanded"
              ? "Expanded"
              : next === "minimized"
                ? "Minimized"
                : "Default";
          setNotice(`Browser mode: ${nextLabel}`);
          return next;
        });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSettingsView]);

  useEffect(() => {
    if (connectionState === "connected") setHasEverConnected(true);
  }, [connectionState]);

  useEffect(() => {
    if (!hasEverConnected) {
      setDisconnectedSinceMs(null);
      setOfflineSeconds(0);
      return;
    }
    if (connectionState === "connected") {
      setDisconnectedSinceMs(null);
      setOfflineSeconds(0);
      return;
    }
    if (
      connectionState === "disconnected" ||
      connectionState === "connecting"
    ) {
      setDisconnectedSinceMs((current) => current ?? Date.now());
      return;
    }
  }, [connectionState, hasEverConnected]);

  useEffect(() => {
    if (disconnectedSinceMs === null) return;
    const updateOfflineSeconds = () => {
      setOfflineSeconds(
        Math.max(0, Math.floor((Date.now() - disconnectedSinceMs) / 1000)),
      );
    };
    updateOfflineSeconds();
    const timer = window.setInterval(updateOfflineSeconds, 1000);
    return () => window.clearInterval(timer);
  }, [disconnectedSinceMs]);

  useEffect(() => {
    const onOpenSetupWizard = () => setFirstRun(true);
    window.addEventListener(OPEN_SETUP_WIZARD_EVENT, onOpenSetupWizard);
    return () =>
      window.removeEventListener(OPEN_SETUP_WIZARD_EVENT, onOpenSetupWizard);
  }, []);

  useEffect(() => {
    if (selectedWorkspace === "all") return;
    const exists = sessions.some(
      (session) => session.workspace === selectedWorkspace,
    );
    if (!exists) setSelectedWorkspace("all");
  }, [selectedWorkspace, sessions]);

  const paletteCommands = useMemo<PaletteCommand[]>(
    () => [
      {
        id: "new-session",
        title: "Create new session",
        description:
          "Create and select a new daemon session. Optional query: workspace | title",
        keywords: ["new", "thread", "create", "session", "workspace"],
        run: async (query) => {
          const [workspaceInput, titleInput] = query
            .split("|")
            .map((part) => part.trim());
          const workspace =
            workspaceInput ||
            (selectedWorkspace !== "all" ? selectedWorkspace : "Workspace");
          const title = titleInput || undefined;
          const sessionId = await createSession({ workspace, title });
          setSelectedWorkspace(workspace);
          setNotice(`Created session ${sessionId}`);
        },
      },
      {
        id: "track-session",
        title: "Track session by ID",
        description:
          "Add an existing daemon session to the rail using the query text as session ID",
        keywords: ["track", "attach", "id", "session"],
        requiresQuery: true,
        run: async (query) => {
          if (!query.trim()) {
            throw new Error("Provide a session ID in the palette query field.");
          }
          await trackSession(
            query,
            selectedWorkspace !== "all" ? selectedWorkspace : undefined,
          );
          setNotice(`Tracking ${query}`);
        },
      },
      {
        id: "refresh",
        title: "Refresh daemon state",
        description: "Force an immediate metrics + session + events refresh",
        keywords: ["refresh", "poll", "sync"],
        run: async () => {
          await refreshNow();
          setNotice("Daemon data refreshed");
        },
      },
      {
        id: "toggle-terminal",
        title: "Toggle terminal panel",
        description: "Show or hide the right-side runtime panel",
        keywords: ["terminal", "panel", "layout"],
        run: () => setShowTerminal((current) => !current),
      },
      {
        id: "clear-composer",
        title: "Clear composer draft",
        description: "Remove draft text from the composer",
        keywords: ["composer", "clear", "draft"],
        run: () => setComposerDraft(""),
      },
      {
        id: "open-models",
        title: "Open models control room",
        description: "Switch to LMX model operations and memory view",
        keywords: ["models", "lmx", "memory"],
        run: () => setActivePage("models"),
      },
      {
        id: "open-settings",
        title: "Open settings",
        description: "Open Settings Studio in the connection tab",
        keywords: ["settings", "preferences", "config", "studio"],
        run: () => openSettings("connection"),
      },
      {
        id: "open-sessions",
        title: "Open session cockpit",
        description: "Switch to active session orchestration",
        keywords: ["sessions", "timeline", "workspace"],
        run: () => setActivePage("sessions"),
      },
      {
        id: "open-operations",
        title: "Open agent tooling",
        description:
          "Run diff, embedding, rerank, and benchmark operations via daemon API",
        keywords: [
          "tools",
          "operations",
          "benchmark",
          "ceo",
          "embed",
          "rerank",
          "diff",
        ],
        run: () => setActivePage("tools"),
      },
      {
        id: "open-app-catalog",
        title: "Open app catalog",
        description: "Install and manage Opta apps through daemon-backed CLI ops",
        keywords: ["apps", "install", "uninstall", "catalog"],
        run: () => setActivePage("apps"),
      },
      {
        id: "open-session-memory",
        title: "Open session memory",
        description:
          "Search, export, and manage persisted sessions via sessions.* operations",
        keywords: ["sessions", "memory", "search", "export", "delete"],
        run: () => setActivePage("memory"),
      },
      {
        id: "open-system-operations",
        title: "Open system control plane",
        description:
          "Diagnostics, lifecycle, onboarding, and maintenance operations",
        keywords: [
          "system",
          "daemon",
          "serve",
          "doctor",
          "version",
          "update",
          "init",
          "onboard",
          "keychain",
        ],
        run: () => setActivePage("system"),
      },
      {
        id: "open-cli-operations",
        title: "Open CLI bridge",
        description:
          "Advanced bridge to full CLI operation families while keeping Opta CLI as primary TUI",
        keywords: [
          "cli",
          "bridge",
          "advanced",
          "tui",
          "parity",
        ],
        run: () => setActivePage("cli"),
      },
      {
        id: "open-env-profiles",
        title: "Open env management",
        description: "Run daemon env.* operations for profile management",
        keywords: ["env", "profiles", "environment", "vars", "secrets"],
        run: () => setActivePage("env"),
      },
      {
        id: "open-mcp-management",
        title: "Open MCP management",
        description: "Run daemon mcp.* operations for server management",
        keywords: ["mcp", "servers", "management", "tools"],
        run: () => setActivePage("mcp"),
      },
      {
        id: "open-config-studio",
        title: "Open config studio",
        description: "Inspect, search, and edit daemon config values",
        keywords: ["config", "settings", "keys", "reset"],
        run: () => setActivePage("config"),
      },
      {
        id: "open-account-controls",
        title: "Open account controls",
        description:
          "Manage account auth and account key operations via daemon controls",
        keywords: ["account", "signup", "login", "logout", "keys", "auth"],
        run: () => setActivePage("account"),
      },
      {
        id: "open-jobs",
        title: "Open background jobs",
        description: "View and manage daemon background processes",
        keywords: ["jobs", "background", "processes", "kill", "output"],
        run: () => setActivePage("jobs"),
      },
      {
        id: "open-logs",
        title: "Open daemon logs",
        description: "View daemon log entries in real time",
        keywords: ["logs", "daemon", "debug", "errors"],
        run: () => setActivePage("logs"),
      },
      {
        id: "export-session",
        title: "Export active session as Markdown",
        description: "Download the active session timeline as a .md file",
        keywords: ["export", "download", "markdown", "save"],
        run: () => {
          if (!activeSessionId) {
            setNotice("No active session to export.");
            return;
          }
          const items = timelineBySession[activeSessionId] ?? [];
          if (items.length === 0) {
            setNotice("Session has no timeline items to export.");
            return;
          }
          const md = exportToMarkdown(activeSessionId, items);
          downloadAsFile(`opta-session-${activeSessionId}.md`, md);
          setNotice("Session exported as Markdown");
        },
      },
    ],
    [
      activeSessionId,
      createSession,
      openSettings,
      refreshNow,
      selectedWorkspace,
      timelineBySession,
      trackSession,
    ],
  );

  const closePaletteRef = useRef<() => void>(() => undefined);
  const shellBodyRef = useRef<HTMLDivElement | null>(null);
  const handlePaletteApply = useCallback(
    async (command: PaletteCommand, query: string) => {
      try {
        await command.run(query);
        closePaletteRef.current();
      } catch (error) {
        setNotice(error instanceof Error ? error.message : String(error));
      }
    },
    [],
  );

  const palette = useCommandPalette({
    commands: paletteCommands,
    onApply: handlePaletteApply,
  });
  closePaletteRef.current = palette.close;

  useEffect(() => {
    const shellBody = shellBodyRef.current;
    if (!shellBody) return;
    if (palette.isOpen) {
      shellBody.setAttribute("inert", "");
    } else {
      shellBody.removeAttribute("inert");
    }
  }, [palette.isOpen]);

  const onSubmitComposer = useCallback(
    async (overrides?: SessionTurnOverrides) => {
      const outbound = composerDraft.trim();
      if (!outbound) return;
      let sessionId = activeSessionId;
      if (!sessionId) {
        // Auto-create a session when the user types their first prompt
        const ws = selectedWorkspace === "all" ? "default" : selectedWorkspace;
        sessionId = await createSession({ workspace: ws });
        setActiveSessionId(sessionId);
        setActivePage("sessions");
      }
      try {
        await submitMessage(outbound, submissionMode, overrides);
        setComposerDraft("");
        setNotice(modeSubmitNotice(submissionMode));
      } catch (error) {
        setNotice(error instanceof Error ? error.message : String(error));
      }
    },
    [activeSessionId, composerDraft, createSession, selectedWorkspace, submitMessage, submissionMode],
  );

  const onDictate = useCallback(async (audioBase64: string, autoSubmit?: boolean) => {
    if (!connection) return;
    setNotice("Transcribing audio...");
    try {
      const res = await daemonClient.runOperation(connection, 'audio.transcribe', {
        audioBase64,
        audioFormat: 'webm'
      });
      if (res.ok) {
        const text = (res.result as TranscriptionResult).text;
        if (text) {
          const finalDraft = composerDraft ? `${composerDraft} ${text}` : text;
          if (autoSubmit) {
            setComposerDraft("");
            let sessionId = activeSessionId;
            if (!sessionId) {
              const ws = selectedWorkspace === "all" ? "default" : selectedWorkspace;
              sessionId = await createSession({ workspace: ws });
              setActiveSessionId(sessionId);
              setActivePage("sessions");
            }
            try {
              await submitMessage(finalDraft, submissionMode);
              setNotice(modeSubmitNotice(submissionMode));
            } catch (error) {
              setNotice(error instanceof Error ? error.message : String(error));
            }
          } else {
            setComposerDraft(finalDraft);
            setNotice("Dictation complete.");
          }
        }
      } else {
        setNotice(`Transcription failed: ${res.error?.message || 'Unknown error'}`);
      }
    } catch (err) {
      setNotice(`Dictation error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [connection, composerDraft, activeSessionId, selectedWorkspace, createSession, setActiveSessionId, submitMessage, submissionMode]);

  const onTts = useCallback(async (text: string) => {
    if (!connection) return undefined;
    try {
      const res = await daemonClient.runOperation(connection, 'audio.tts', { text });
      if (res.ok) {
        return (res.result as TTSResult).audioBase64;
      } else {
        console.error("TTS failed:", res.error);
      }
    } catch (e) {
      console.error("TTS network error:", e);
    }
    return undefined;
  }, [connection]);

  const reconnectEndpoint = `${connection.protocol ?? "http"}://${connection.host}:${connection.port}`;
  const copyReconnectDiagnostics = useCallback(async () => {
    const diagnostics = [
      `timestamp=${new Date().toISOString()}`,
      `endpoint=${reconnectEndpoint}`,
      `state=${connectionState}`,
      `offline_seconds=${offlineSeconds}`,
      `active_session=${activeSessionId ?? "none"}`,
      `tracked_sessions=${sessionCount}`,
      `error=${connectionError ?? "none"}`,
    ].join(" | ");
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard unavailable");
      }
      await navigator.clipboard.writeText(diagnostics);
      setNotice("Reconnect diagnostics copied");
    } catch {
      setNotice("Could not copy reconnect diagnostics");
    }
  }, [
    activeSessionId,
    connectionError,
    connectionState,
    offlineSeconds,
    reconnectEndpoint,
    sessionCount,
  ]);

  // Setup wizard gate — renders before anything else
  if (firstRun === null) {
    // Loading: blank OLED screen while we check first-run status
    return <div style={{ background: "#09090b", height: "100vh" }} />;
  }
  if (firstRun) {
    return <SetupWizard onComplete={() => setFirstRun(false)} />;
  }

  const showReconnectOverlay =
    initialCheckDone && connectionState !== "connected" && hasEverConnected;

  return (
    <>
      {/* V1 Ambient Blobs */}
      <div className="v1-ambient" aria-hidden="true">
        <div className="v1-blob v1-blob-1" />
        <div className="v1-blob v1-blob-2" />
      </div>
      <div className={`app-shell ${palette.isOpen ? "palette-open" : ""}`}>
        <div
          ref={shellBodyRef}
          className="app-shell-body"
          aria-hidden={palette.isOpen ? "true" : undefined}
        >
          {/* V1 Topbar — redesign-9: logo + Accounts only, no search */}
          <header className="v1-topbar" data-tauri-drag-region>
            <div className="v1-top-left" data-tauri-drag-region>
              <div className="v1-logo" data-tauri-drag-region>
                <svg width="24" height="24" viewBox="0 0 48 48" fill="none" className="v1-logo-svg" data-tauri-drag-region>
                  <circle cx="24" cy="24" r="22" stroke="rgba(168,85,247,0.3)" strokeWidth="1.5" />
                  <path d="M 32 14 A 14 14 0 1 0 32 34" stroke="#a855f7" strokeWidth="3" strokeLinecap="round" />
                  <line x1="16" y1="36" x2="36" y2="12" stroke="#a855f7" strokeWidth="3" strokeLinecap="round" />
                </svg>
                <span className="v1-logo-text" data-tauri-drag-region>OPTA CODE</span>
              </div>
            </div>
            {/* Design Concept: Unified Topbar (0 or 1) */}
            {(designMode === "0" || designMode === "1") && (
              <div className="v1-top-right">
                <div className="v1-app-btn-group">
                  {designMode === "1" && (
                    <button
                      className="v1-app-btn"
                      type="button"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
                      <span>CUSTOMISE TILES</span>
                    </button>
                  )}
                  <button
                    type="button"
                    className="v1-app-btn"
                    onClick={() => { void handleAccountsLogin(); }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--opta-primary-glow)" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    <span>ACCOUNTS</span>
                  </button>
                </div>
              </div>
            )}
            {/* Floating Action Island — inside topbar, positioned top-right */}
            <div className="v1-action-island">
              <button
                type="button"
                className="v1-island-btn"
                onClick={() => widgetLayout.toggleEditMode()}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
                Tiles
              </button>
              <div className="v1-island-divider" />
              <button
                type="button"
                className="v1-island-btn"
                onClick={() => { void handleAccountsLogin(); }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                Accounts
              </button>
            </div>
          </header>


          {/* V1 Agent Bar — horizontal strip above body */}
          {Object.values(streamingBySession).some(Boolean) && (
            <div className="v1-agent-bar">
              <span className="v1-agent-label">AGENTS</span>
              {sessions
                .filter((s) => streamingBySession[s.sessionId])
                .map((s) => (
                  <button
                    key={s.sessionId}
                    type="button"
                    className="v1-agent-pill"
                    onClick={() => { setActiveSessionId(s.sessionId); setActivePage("sessions"); }}
                  >
                    <span className="v1-agent-dot" />
                    {s.title || s.sessionId.slice(0, 8)}
                    {" "}
                    <span style={{ opacity: 0.6 }}>[{s.workspace}]</span>
                  </button>
                ))}
            </div>
          )}

          {/* V1 3-Column Layout */}
          <div className="v1-body">
            {/* Left: Project Pane */}
            <ProjectPane
              sessions={sessions}
              activeSessionId={activeSessionId}
              streamingBySession={streamingBySession}
              pendingPermissionsBySession={pendingPermissionsBySession}
              connectionState={connectionState}
              connectionHealth={useConnectionHealthResult}
              connectionHost={connection.host}
              connectionPort={connection.port}
              onSelectSession={(sessionId) => {
                setActiveSessionId(sessionId);
                setActivePage("sessions");
                const next = sessions.find((s) => s.sessionId === sessionId);
                if (next) setSelectedWorkspace(next.workspace);
              }}
              onCreateSession={async () => {
                const ws = selectedWorkspace === "all" ? "default" : selectedWorkspace;
                const sessionId = await createSession({ workspace: ws });
                setActiveSessionId(sessionId);
                setActivePage("sessions");
                setNotice(`New session created in "${ws}"`);
              }}
              deviceLabel={deviceLabel}
              onDeviceLabelChange={handleDeviceLabelChange}
            />

            {/* Center: Chat or Page Content */}
            <div className="v1-center">
              {/* Branding Header (static outside settings overlay) */}
              {activePage === "sessions" && !activeSessionId && (
                <>
                  <div className="v1-chat-header">
                    Try pressing <b>Ctrl+S</b>
                  </div>
                  <div className="v1-branding">
                    <div className="v1-brand-text">OPTA</div>
                    <div className="v1-brand-sub">Code Environment</div>
                  </div>
                </>
              )}

              {/* Middle Layer (receives Settings Overlay) */}
              <div className="v1-middle-layer">
                {/* Settings View (Ctrl+S overlay) */}
                {isSettingsView && (
                  <div className={`v1-settings-overlay dm-overlay-anim dm-overlay-${designMode}`}>
                    <SettingsView
                      designMode={designMode}
                      onOpenSettingsTab={(tab) => {
                        const categoryToTab: Record<string, SettingsTabId> = {
                          general: "connection",
                          intelligence: "model-provider",
                          connection: "lmx",
                          interface: "browser",
                        };
                        setIsSettingsView(false);
                        openSettings(categoryToTab[tab] ?? "connection");
                      }}
                    />
                  </div>
                )}

                {/* Chat Pane (hidden when settings view active) */}
                <div className={`v1-chat-pane ${isSettingsView ? `v1-chat-hidden dm-chat-anim dm-chat-${designMode}` : ""}`}>
                  {activePage === "models" ? (
                    <ModelsPage connection={connection} onOpenSettings={() => openSettings("lmx")} />
                  ) : activePage === "tools" ? (
                    <ToolingOperationsPage connection={connection} />
                  ) : activePage === "apps" ? (
                    <AppCatalogPage connection={connection} />
                  ) : activePage === "memory" ? (
                    <SessionMemoryPage connection={connection} />
                  ) : activePage === "system" ? (
                    <SystemOperationsPage connection={connection} connectionState={connectionState} onOpenCliBridge={() => setActivePage("cli")} />
                  ) : activePage === "cli" ? (
                    <CliOperationsPage connection={connection} />
                  ) : activePage === "env" ? (
                    <EnvProfilesPage connection={connection} />
                  ) : activePage === "mcp" ? (
                    <McpManagementPage connection={connection} />
                  ) : activePage === "config" ? (
                    <ConfigStudioPage connection={connection} />
                  ) : activePage === "account" ? (
                    <AccountControlPage connection={connection} />
                  ) : activePage === "jobs" ? (
                    <BackgroundJobsPage connection={connection} defaultSessionId={activeSessionId} />
                  ) : activePage === "logs" ? (
                    <DaemonLogsPage />
                  ) : (
                    /* Default: Sessions view */
                    <>
                      {!activeSessionId ? (
                        <div className="v1-messages">
                          <div className="v1-empty-msg">No messages yet. Select a project and start a task.</div>
                        </div>
                      ) : (
                        <div className="v1-timeline-area">
                          {timelineItems.length > 0 && (
                            <div className="session-export-bar">
                              <button
                                type="button"
                                className="session-export-btn"
                                onClick={() => {
                                  const md = exportToMarkdown(activeSessionId, timelineItems);
                                  downloadAsFile(`opta-session-${activeSessionId}.md`, md);
                                  setNotice("Session exported as Markdown");
                                }}
                                title="Export session as Markdown"
                              >
                                <Download size={12} aria-hidden="true" />
                                Export
                              </button>
                            </div>
                          )}
                          <TimelineCards
                            sessionId={activeSessionId}
                            sessionTitle={activeSession?.title}
                            items={timelineItems}
                            isStreaming={isStreaming}
                            pendingPermissions={pendingPermissions}
                            onResolvePermission={resolvePermission}
                            connectionState={connectionState}
                            browserVisualState={activeBrowserVisual}
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Statically positioned Composer below middle layer */}
              {activePage === "sessions" && (
                <Composer
                  value={composerDraft}
                  onChange={setComposerDraft}
                  onSubmit={onSubmitComposer}
                  onCancel={() => void cancelActiveTurn()}
                  onDictate={onDictate}
                  isStreaming={isStreaming}
                  disabled={false}
                  mode={submissionMode}
                  onModeChange={setSubmissionMode}
                  timelineItems={timelineItems}
                  onTts={onTts}
                />
              )}
            </div>

            {/* Right: Widget Pane */}
            {activePage === "sessions" && (
              <>
                <WidgetPane
                  slots={widgetLayout.layout.slots}
                  isEditing={widgetLayout.isEditing}
                  onToggleEdit={widgetLayout.toggleEditMode}
                  onRemoveWidget={widgetLayout.removeWidget}
                  onAddWidget={(wid) => widgetLayout.addWidget(wid, "M")}
                  timelineItems={timelineItems}
                  rawEvents={activeSessionId ? rawEventsBySession[activeSessionId] || [] : []}
                  connection={connection}
                  sessionId={activeSessionId}
                />
                {showTerminal && (
                  <div className="v1-right-panel" style={{ width: '400px', borderLeft: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column' }}>
                    <LiveBrowserView
                      connection={connection}
                      slot={activeBrowserSlot}
                      viewerAuthToken={activeBrowserViewerAuthToken}
                      className="flex-1"
                    />
                  </div>
                )}
              </>
            )}
          </div>

          <SettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            initialTab={settingsInitialTab}
            connection={connection}
            onSaveConnection={(conn) => {
              setConnection(conn);
              setNotice("Daemon connection updated");
              void refreshNow();
            }}
          />

          {showReconnectOverlay ? (
            <div
              className="daemon-reconnect-overlay"
              role="status"
              aria-live="assertive"
            >
              <div className="daemon-reconnect-overlay__panel">
                <h2>Daemon connection lost</h2>
                <p>
                  Opta is retrying automatically. The session view unlocks as
                  soon as the daemon is back online.
                </p>
                <p className="daemon-reconnect-overlay__meta">
                  Endpoint: <code>{reconnectEndpoint}</code>
                </p>
                <p className="daemon-reconnect-overlay__meta">
                  Offline for {offlineSeconds}s. Health checks retry every{" "}
                  {Math.max(1, Math.round(runtimePollDelayMs / 1000))}s.
                </p>
                {connectionError ? (
                  <p className="daemon-reconnect-overlay__error">
                    {connectionError}
                  </p>
                ) : null}
                <div className="daemon-reconnect-overlay__actions">
                  <button
                    type="button"
                    className="opta-button primary"
                    onClick={repairConnection}
                  >
                    Repair daemon connection
                  </button>
                  <button
                    type="button"
                    className="opta-button secondary"
                    onClick={copyReconnectDiagnostics}
                  >
                    Copy diagnostics
                  </button>
                  <button type="button" onClick={() => setDesignMode("0")} style={{ color: designMode === "0" ? "#fff" : "#888", padding: "2px 6px" }}>0: Def</button>
                  <button type="button" onClick={() => setDesignMode("1")} style={{ color: designMode === "1" ? "#fff" : "#888", padding: "2px 6px" }}>1: Topbar</button>
                  <button type="button" onClick={() => setDesignMode("2")} style={{ color: designMode === "2" ? "#fff" : "#888", padding: "2px 6px" }}>2: Widget</button>
                  <button type="button" onClick={() => setDesignMode("3")} style={{ color: designMode === "3" ? "#fff" : "#888", padding: "2px 6px" }}>3: Floating</button>
                  <div style={{ width: '1px', background: 'rgba(255,255,255,0.2)', margin: '0 4px' }} />
                  <button type="button" onClick={() => setDesignMode("4")} style={{ color: designMode === "4" ? "#fff" : "#888", padding: "2px 6px" }}>4: Spatial</button>
                  <button type="button" onClick={() => setDesignMode("5")} style={{ color: designMode === "5" ? "#fff" : "#888", padding: "2px 6px" }}>5: Cinematic</button>
                  <button type="button" onClick={() => setDesignMode("6")} style={{ color: designMode === "6" ? "#fff" : "#888", padding: "2px 6px" }}>6: Fluid</button>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <CommandPalette
          open={palette.isOpen}
          query={palette.query}
          commands={palette.filteredCommands}
          selectedIndex={palette.selectedIndex}
          onQueryChange={palette.setQuery}
          onSelect={palette.setSelectedIndex}
          onApply={palette.applySelected}
          onClose={palette.close}
        />
      </div >
      {firstPendingPermission && (
        <PermissionModal
          request={firstPendingPermission}
          onResolve={resolveSessionPermission}
        />
      )}
    </>
  );
}

export default App;
