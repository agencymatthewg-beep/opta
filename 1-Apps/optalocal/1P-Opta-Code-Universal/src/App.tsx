import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocalStorage } from "./hooks/useLocalStorage";
import { CommandPalette } from "./components/CommandPalette";
import { Composer } from "./components/Composer";
import { SetupWizard } from "./components/SetupWizard";
import { SettingsModal } from "./components/SettingsModal";
import { Download, Settings as SettingsIcon } from "lucide-react";
import { TimelineCards } from "./components/TimelineCards";
import { WorkspaceRail } from "./components/WorkspaceRail";
import { ModelsPage } from "./pages/ModelsPage";
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
import { useBrowserLiveHost } from "./hooks/useBrowserLiveHost";
import { useConnectionHealth } from "./hooks/useConnectionHealth";
import { LiveBrowserView } from "./components/LiveBrowserView";
import { OPEN_SETUP_WIZARD_EVENT } from "./components/ErrorBoundary";
import {
  deriveBrowserVisualState,
  type BrowserVisualSummary,
} from "./lib/browserVisualState";
import { getTauriInvoke, isNativeDesktop } from "./lib/runtime";
import type {
  PaletteCommand,
  SessionSubmitMode,
  SessionTurnOverrides,
} from "./types";

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

  const useConnectionHealthResult = useConnectionHealth(connection, connectionState);

  const { getSlotForSession } = useBrowserLiveHost();

  const activeSession = useMemo(
    () =>
      sessions.find((session) => session.sessionId === activeSessionId) ?? null,
    [activeSessionId, sessions],
  );

  const activeBrowserSlot = activeSessionId
    ? getSlotForSession(activeSessionId)
    : undefined;

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

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
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
  }, []);

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
      if (!activeSessionId) {
        setNotice("Select or create a session first.");
        return;
      }
      const outbound = composerDraft.trim();
      if (!outbound) return;
      try {
        await submitMessage(outbound, submissionMode, overrides);
        setComposerDraft("");
        setNotice(modeSubmitNotice(submissionMode));
      } catch (error) {
        setNotice(error instanceof Error ? error.message : String(error));
      }
    },
    [activeSessionId, composerDraft, submitMessage, submissionMode],
  );

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
      <div className="bg-singularity-anim" aria-hidden="true" />
      <div className={`app-shell ${palette.isOpen ? "palette-open" : ""}`}>
        <div
          ref={shellBodyRef}
          className="app-shell-body"
          aria-hidden={palette.isOpen ? "true" : undefined}
        >
          <header className="app-topbar glass">
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <svg width="32" height="32" viewBox="0 0 48 48" fill="none" style={{ filter: "drop-shadow(0 0 8px rgba(168,85,247,0.4))" }}>
                <circle cx="24" cy="24" r="22" stroke="rgba(168,85,247,0.3)" strokeWidth="1.5" strokeDasharray="4 4" />
                <path d="M 32 14 A 14 14 0 1 0 32 34" stroke="#a855f7" strokeWidth="3" strokeLinecap="round" />
                <line x1="16" y1="36" x2="36" y2="12" stroke="#a855f7" strokeWidth="3" strokeLinecap="round" />
              </svg>
              <span style={{ fontWeight: 600, letterSpacing: "1px", color: "var(--opta-text-primary)" }}>OPTA CODE</span>
            </div>

            <div className="stats">
              <span className={`signal signal-${connectionState}`}>
                <span className="status-dot">●</span>
                {connectionState === "connected" ? `${connection.host}:${connection.port}` : connectionState}
              </span>
              <span>AGENTS: {activeStreamCount}</span>
              <span>SESSIONS: {sessionCount}</span>
              <button type="button" onClick={() => setActivePage("account")} className="accounts-btn accounts-btn-pulse" aria-label="Open Account Controls" style={{ marginLeft: "1rem" }}>ACCOUNTS</button>
            </div>
          </header>

          <div className="main-layout">
            <div className="panel glass nav-rail">
              <button type="button" className={`nav-item ${activePage === "sessions" ? "active" : ""}`} onClick={() => setActivePage("sessions")}>
                Sessions
              </button>
              <button type="button" className={`nav-item ${activePage === "models" ? "active" : ""}`} onClick={() => setActivePage("models")}>
                Models
              </button>
              <button type="button" className={`nav-item ${activePage === "tools" ? "active" : ""}`} onClick={() => setActivePage("tools")}>
                Tools
              </button>
              <button type="button" className={`nav-item ${activePage === "apps" ? "active" : ""}`} onClick={() => setActivePage("apps")}>
                Apps
              </button>
              <button type="button" className={`nav-item ${activePage === "memory" ? "active" : ""}`} onClick={() => setActivePage("memory")}>
                Memory
              </button>
              <button type="button" className={`nav-item ${activePage === "system" ? "active" : ""}`} onClick={() => setActivePage("system")}>
                System
              </button>
              <button type="button" className={`nav-item ${activePage === "cli" ? "active" : ""}`} onClick={() => setActivePage("cli")}>
                CLI Bridge
              </button>
              <button type="button" className={`nav-item ${activePage === "env" ? "active" : ""}`} onClick={() => setActivePage("env")}>
                Env
              </button>
              <button type="button" className={`nav-item ${activePage === "mcp" ? "active" : ""}`} onClick={() => setActivePage("mcp")}>
                MCP
              </button>
              <button type="button" className={`nav-item ${activePage === "config" ? "active" : ""}`} onClick={() => setActivePage("config")}>
                Config
              </button>
              <button type="button" className={`nav-item ${activePage === "account" ? "active" : ""}`} onClick={() => setActivePage("account")}>
                Account
              </button>
              <button type="button" className={`nav-item ${activePage === "jobs" ? "active" : ""}`} onClick={() => setActivePage("jobs")}>
                Jobs
              </button>
              <button type="button" className={`nav-item ${activePage === "logs" ? "active" : ""}`} onClick={() => setActivePage("logs")}>
                Logs
              </button>
              <div style={{ flex: 1 }}></div>
              <button type="button" className="nav-item" onClick={palette.open}>
                Palette
              </button>
              <button type="button" className={`nav-item ${showTerminal ? "active" : ""}`} onClick={() => setShowTerminal(c => !c)}>
                {showTerminal ? "Hide Telemetry" : "Show Telemetry"}
              </button>
              <button type="button" className="nav-item" onClick={() => setIsSettingsOpen(true)}>
                Settings
              </button>
            </div>

            <main
              className={`workspace-layout ${activePage !== "sessions" ? "single-pane" : ""
                } ${showTerminal ? "with-terminal" : "without-terminal"}`}
            >
              {activePage === "models" ? (
                <ModelsPage
                  connection={connection}
                  onOpenSettings={() => setIsSettingsOpen(true)}
                />
              ) : activePage === "tools" ? (
                <ToolingOperationsPage connection={connection} />
              ) : activePage === "apps" ? (
                <AppCatalogPage connection={connection} />
              ) : activePage === "memory" ? (
                <SessionMemoryPage connection={connection} />
              ) : activePage === "system" ? (
                <SystemOperationsPage
                  connection={connection}
                  connectionState={connectionState}
                  onOpenCliBridge={() => setActivePage("cli")}
                />
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
                <BackgroundJobsPage
                  connection={connection}
                  defaultSessionId={activeSessionId}
                />
              ) : activePage === "logs" ? (
                <DaemonLogsPage />
              ) : (
                <>
                  <WorkspaceRail
                    sessions={sessions}
                    activeSessionId={activeSessionId}
                    selectedWorkspace={selectedWorkspace}
                    streamingBySession={streamingBySession}
                    pendingPermissionsBySession={pendingPermissionsBySession}
                    browserVisualBySession={browserVisualBySession}
                    connectionHealth={useConnectionHealthResult}
                    onSelectWorkspace={setSelectedWorkspace}
                    onSelectSession={(sessionId) => {
                      setActiveSessionId(sessionId);
                      const next = sessions.find(
                        (session) => session.sessionId === sessionId,
                      );
                      if (next) setSelectedWorkspace(next.workspace);
                    }}
                    onRemoveSession={removeSession}
                  />

                  <div
                    className="workspace-center-column"
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      flex: 1,
                      minWidth: 0,
                      gap: "1rem",
                      height: "calc(100vh - 120px)",
                    }}
                  >
                    <div
                      className={`browser-layout-row browser-mode-${browserViewMode}`}
                      style={{ flex: 1, minHeight: 0 }}
                    >
                      <div className="timeline-module">
                        {activeSessionId && timelineItems.length > 0 && (
                          <div className="session-export-bar">
                            <button
                              type="button"
                              className="session-export-btn"
                              onClick={() => {
                                const md = exportToMarkdown(
                                  activeSessionId,
                                  timelineItems,
                                );
                                downloadAsFile(
                                  `opta-session-${activeSessionId}.md`,
                                  md,
                                );
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
                      <div className="browser-module">
                        {activeBrowserSlot ? (
                          <LiveBrowserView
                            slot={activeBrowserSlot}
                            showNativeControls={nativeDesktop}
                          />
                        ) : (
                          <LiveBrowserView showNativeControls={nativeDesktop} />
                        )}
                      </div>
                    </div>

                    <Composer
                      value={composerDraft}
                      onChange={setComposerDraft}
                      onSubmit={onSubmitComposer}
                      onCancel={() => void cancelActiveTurn()}
                      isStreaming={isStreaming}
                      disabled={!activeSessionId}
                      mode={submissionMode}
                      onModeChange={setSubmissionMode}
                    />
                  </div>
                </>
              )}

              {showTerminal ? (
                <TelemetryPanel
                  metrics={{
                    vramUtilized: 0,
                    vramTotal: 32,
                    tokensPerSec: 0,
                  }}
                  events={
                    activeSessionId
                      ? rawEventsBySession[activeSessionId] || []
                      : []
                  }
                />
              ) : null}
            </main>

          </div> {/* end main-layout */}

          <SettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
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
                    onClick={() => void copyReconnectDiagnostics()}
                  >
                    Copy diagnostics
                  </button>
                  <button type="button" onClick={() => void repairConnection()}>
                    Repair daemon connection
                  </button>
                  <button type="button" onClick={() => setFirstRun(true)}>
                    Open setup wizard
                  </button>
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
    </>
  );
}

export default App;
