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
import { OperationsPage } from "./pages/OperationsPage";
import { ConfigStudioPage } from "./pages/ConfigStudioPage";
import { DaemonPanel } from "./components/DaemonPanel";
import {
  downloadAsFile,
  exportToMarkdown,
} from "./lib/sessionExporter";
import { useCommandPalette } from "./hooks/useCommandPalette";
import { useDaemonSessions } from "./hooks/useDaemonSessions";
import { OptaRing } from "./components/OptaRing";
import { useBrowserLiveHost } from "./hooks/useBrowserLiveHost";
import { LiveBrowserView } from "./components/LiveBrowserView";
import {
  deriveBrowserVisualState,
  type BrowserVisualSummary,
} from "./lib/browserVisualState";
import { getTauriInvoke, isNativeDesktop } from "./lib/runtime";
import type { PaletteCommand } from "./types";
import "./opta.css";

type AppPage = "sessions" | "models" | "operations" | "config" | "jobs" | "logs";
const ACCOUNTS_PORTAL_URL = "https://accounts.optalocal.com";

export type BrowserViewMode = "default" | "expanded" | "minimized";

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
  const [submissionMode, setSubmissionMode] = useState<"chat" | "do">("chat");
  const [selectedWorkspace, setSelectedWorkspace] = useLocalStorage("opta:selectedWorkspace", "all");
  const [notice, setNotice] = useState<string | null>(null);
  const [activePage, setActivePage] = useState<AppPage>("sessions");
  const [showToken, setShowToken] = useState(false);
  const [hasEverConnected, setHasEverConnected] = useState(false);
  const [browserViewMode, setBrowserViewMode] = useState<BrowserViewMode>("default");

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
    refreshNow,
    resolvePermission,
    runtime,
    sessions,
    setActiveSessionId,
    setConnection,
    submitMessage,
    timelineBySession,
    trackSession,
    createSession,
    removeSession,
    initialCheckDone,
  } = useDaemonSessions();

  const { getSlotForSession } = useBrowserLiveHost();

  const activeSession = useMemo(
    () =>
      sessions.find((session) => session.sessionId === activeSessionId) ?? null,
    [activeSessionId, sessions],
  );

  const activeBrowserSlot = activeSessionId ? getSlotForSession(activeSessionId) : undefined;

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
        ? browserVisualBySession[activeSessionId] ??
        deriveBrowserVisualState({
          connectionState,
          isStreaming,
          pendingPermissions,
          timelineItems,
        })
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
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setBrowserViewMode((current) => {
          if (current === "default") return "expanded";
          if (current === "expanded") return "minimized";
          return "default";
        });
        setNotice(`Browser mode: ${browserViewMode === "default" ? "Expanded" : browserViewMode === "expanded" ? "Minimized" : "Default"}`);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [browserViewMode]);

  useEffect(() => {
    if (connectionState === "connected") setHasEverConnected(true);
  }, [connectionState]);

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
        title: "Open operations console",
        description: "Run any CLI command-family operation via the daemon API",
        keywords: ["operations", "doctor", "env", "mcp", "keychain", "benchmark", "embed", "rerank"],
        run: () => setActivePage("operations"),
      },
      {
        id: "open-config-studio",
        title: "Open config studio",
        description: "Inspect, search, and edit daemon config values",
        keywords: ["config", "settings", "keys", "reset"],
        run: () => setActivePage("config"),
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
    [activeSessionId, createSession, refreshNow, selectedWorkspace, timelineBySession, trackSession],
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

  const onSubmitComposer = useCallback(async () => {
    if (!activeSessionId) {
      setNotice("Select or create a session first.");
      return;
    }
    const outbound = composerDraft.trim();
    if (!outbound) return;
    try {
      await submitMessage(outbound, submissionMode);
      setComposerDraft("");
      setNotice(submissionMode === "do" ? "Task dispatched to agent" : "Message submitted to daemon");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    }
  }, [activeSessionId, composerDraft, submitMessage, submissionMode]);

  // Setup wizard gate — renders before anything else
  if (firstRun === null) {
    // Loading: blank OLED screen while we check first-run status
    return <div style={{ background: "#09090b", height: "100vh" }} />;
  }
  if (firstRun) {
    return <SetupWizard onComplete={() => setFirstRun(false)} />;
  }

  return (
    <>
      <div className="bg-singularity-anim" aria-hidden="true" />
      <div className={`app-shell ${palette.isOpen ? "palette-open" : ""}`}>
        <div
          ref={shellBodyRef}
          className="app-shell-body"
          aria-hidden={palette.isOpen ? "true" : undefined}
        >
          <header className="app-topbar" style={{ position: "relative" }}>
            <div className="identity">
              <p style={{ marginTop: "1rem" }}>
                Operator cockpit for parallel sessions, model control, and daemon
                telemetry.
              </p>
              <div className="identity-pills">
                <span className={`signal signal-${connectionState}`}>
                  {connectionState === "connected"
                    ? "Live"
                    : connectionState === "connecting"
                      ? "Syncing"
                      : "Offline"}
                </span>
                <span>{sessionCount} tracked sessions</span>
                {activeStreamCount > 0 && (
                  <span className="pill-active-agents">
                    {activeStreamCount} agent{activeStreamCount !== 1 ? "s" : ""} working
                  </span>
                )}
                {totalPendingPermissions > 0 && (
                  <span className="pill-pending-perms">
                    {totalPendingPermissions} permission{totalPendingPermissions !== 1 ? "s" : ""} waiting
                  </span>
                )}
                <span
                  className={`browser-pill browser-pill-${activeBrowserVisual.state}`}
                >
                  Browser {activeBrowserVisual.activityText}
                </span>
                {browserWorkingCount > 0 && (
                  <span className="pill-browser-working">
                    {browserWorkingCount} browser session{browserWorkingCount !== 1 ? "s" : ""} working
                  </span>
                )}
                {browserBlockedCount > 0 && (
                  <span className="pill-browser-blocked">
                    {browserBlockedCount} browser session{browserBlockedCount !== 1 ? "s" : ""} blocked
                  </span>
                )}
                <span className={`mode-pill mode-pill-${submissionMode}`}>
                  {submissionMode === "do" ? "Do mode" : "Chat mode"}
                </span>
                <span>{showTerminal ? "Runtime visible" : "Runtime hidden"}</span>
              </div>
              {connectionState === "disconnected" && (
                <div className="daemon-offline-hint">
                  <p>Run <code>opta daemon start</code> to connect</p>
                  {connectionError ? <p className="daemon-offline-hint-error">{connectionError}</p> : null}
                </div>
              )}
            </div>

            <div
              style={{
                position: "absolute",
                left: "50%",
                transform: "translateX(-50%)",
                top: "1rem",
                pointerEvents: "none",
                display: "flex",
                justifyContent: "center",
                zIndex: 10
              }}
            >
              <pre className="app-logo-ascii" style={{ color: "var(--primary-glow)", textShadow: "0 0 12px rgba(168, 85, 247, 0.6)", lineHeight: "1.1", fontSize: "12px", margin: 0 }}>
                {`
   .·:·.    ██████╗  ██████╗  ████████╗ █████╗ 
  :  O  :  ██╔═══██╗ ██╔══██╗ ╚══██╔══╝██╔══██╗
   '·:·'   ██║   ██║ ██████╔╝    ██║   ███████║
           ╚██████╔╝ ██╔═══╝     ██║   ██║  ██║
            ╚═════╝  ╚═╝         ╚═╝   ╚═╝  ╚═╝
`}
              </pre>
            </div>

            <div className="top-actions" style={{ alignItems: "center" }}>
              <div style={{ marginRight: "1rem", display: "flex" }}>
                <OptaRing size={48} paused={palette.isOpen} />
              </div>
              <div className="segmented-nav-pill">
                <button
                  type="button"
                  className={activePage === "sessions" ? "active" : ""}
                  onClick={() => setActivePage("sessions")}
                >
                  Sessions
                </button>
                <button
                  type="button"
                  className={activePage === "models" ? "active" : ""}
                  onClick={() => setActivePage("models")}
                >
                  Models
                </button>
                <button
                  type="button"
                  className={activePage === "operations" ? "active" : ""}
                  onClick={() => setActivePage("operations")}
                >
                  Operations
                </button>
                <button
                  type="button"
                  className={activePage === "config" ? "active" : ""}
                  onClick={() => setActivePage("config")}
                >
                  Config
                </button>
                <button
                  type="button"
                  className={activePage === "jobs" ? "active" : ""}
                  onClick={() => setActivePage("jobs")}
                >
                  Jobs
                </button>
                <button
                  type="button"
                  className={activePage === "logs" ? "active" : ""}
                  onClick={() => setActivePage("logs")}
                >
                  Logs
                </button>
                <button type="button" onClick={palette.open}>
                  Palette (Cmd/Ctrl+K)
                </button>
              </div>
            </div>

            <div style={{ position: "absolute", top: "1.25rem", right: "1.5rem", zIndex: 10, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.5rem" }}>
              <div className="minimal-tools-group" style={{ borderLeft: "none", paddingLeft: "0", margin: 0 }}>
                <button
                  type="button"
                  className={`minimal-emoji-btn ${showTerminal ? "active" : ""}`}
                  title={showTerminal ? "Hide Runtime Telemetry" : "Show Runtime Telemetry"}
                  onClick={() => setShowTerminal((current) => !current)}
                >
                  {showTerminal ? "🖥️" : "💻"}
                </button>
                <button
                  type="button"
                  className="minimal-emoji-btn"
                  title="Settings"
                  onClick={() => setIsSettingsOpen(true)}
                >
                  ⚙️
                </button>
              </div>

              <a
                href={ACCOUNTS_PORTAL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="accounts-btn accounts-btn-pulse"
                aria-label="Open Opta Accounts portal"
              >
                Accounts
              </a>
            </div>
          </header>

          <main
            className={`workspace-layout ${showTerminal ? "with-terminal" : "without-terminal"}`}
          >
            {activePage === "models" ? (
              <ModelsPage connection={connection} />
            ) : activePage === "operations" ? (
              <OperationsPage connection={connection} />
            ) : activePage === "config" ? (
              <ConfigStudioPage connection={connection} />
            ) : activePage === "jobs" ? (
              <BackgroundJobsPage connection={connection} />
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

                <div className={`browser-layout-row browser-mode-${browserViewMode}`}>
                  <div className="timeline-module">
                    {activeSessionId && timelineItems.length > 0 && (
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
              </>
            )}

            {showTerminal ? (
              <aside
                className="runtime-panel"
                aria-label="Runtime status and stats"
              >
                <header>
                  <h2>Runtime</h2>
                  <p>Daemon telemetry + session health</p>
                </header>
                <dl>
                  <div>
                    <dt>Connection</dt>
                    <dd className={`state-${connectionState}`}>
                      {connectionState}
                    </dd>
                  </div>
                  <div>
                    <dt>Tracked Sessions</dt>
                    <dd>{sessionCount}</dd>
                  </div>
                  <div>
                    <dt>Runtime Sessions</dt>
                    <dd>{runtime?.sessionCount ?? "—"}</dd>
                  </div>
                  <div>
                    <dt>Active Turns</dt>
                    <dd>{runtime?.activeTurnCount ?? "—"}</dd>
                  </div>
                  <div>
                    <dt>Queued Turns</dt>
                    <dd>{runtime?.queuedTurnCount ?? "—"}</dd>
                  </div>
                  <div>
                    <dt>Subscribers</dt>
                    <dd>{runtime?.subscriberCount ?? "—"}</dd>
                  </div>
                </dl>
                {connectionError ? (
                  <div className="runtime-error">
                    <strong>Connection Error</strong>
                    <p className="runtime-error-detail">{connectionError}</p>
                  </div>
                ) : null}
                <button type="button" onClick={() => void refreshNow()}>
                  Refresh Now
                </button>
                <DaemonPanel
                  connection={connection}
                  connectionState={connectionState}
                />
              </aside>
            ) : null}
          </main>

          <div className={`bottom-modules bottom-mode-${browserViewMode}`}>
            <div className="bottom-modules-inner">
              <div className="status-strip" aria-live="polite">
                <span>State: {connectionState}</span>
                <span>Sessions: {sessionCount}</span>
                <span
                  className={`status-browser status-browser-${activeBrowserVisual.state}`}
                >
                  Browser: {activeBrowserVisual.activityText}
                </span>
                <span>
                  Active:{" "}
                  {activeSession
                    ? `${activeSession.title} (${activeSession.sessionId})`
                    : "none"}
                </span>
                {notice ? <strong>{notice}</strong> : null}
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
          </div>

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
        </div >

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
