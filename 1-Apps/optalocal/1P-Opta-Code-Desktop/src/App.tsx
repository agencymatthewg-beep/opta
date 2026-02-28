import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CommandPalette } from "./components/CommandPalette";
import { Composer } from "./components/Composer";
import { TimelineCards } from "./components/TimelineCards";
import { WorkspaceRail } from "./components/WorkspaceRail";
import { ModelsPage } from "./pages/ModelsPage";
import { useCommandPalette } from "./hooks/useCommandPalette";
import { useDaemonSessions } from "./hooks/useDaemonSessions";
import type { PaletteCommand } from "./types";
import "./opta.css";

type AppPage = "sessions" | "models";

function App() {
  const [showTerminal, setShowTerminal] = useState(true);
  const [composerDraft, setComposerDraft] = useState("");
  const [selectedWorkspace, setSelectedWorkspace] = useState("all");
  const [notice, setNotice] = useState<string | null>(null);
  const [activePage, setActivePage] = useState<AppPage>("sessions");

  const {
    activeSessionId,
    connection,
    connectionError,
    connectionState,
    isStreaming,
    refreshNow,
    runtime,
    sessions,
    setActiveSessionId,
    setConnection,
    submitMessage,
    timelineBySession,
    trackSession,
    createSession,
  } = useDaemonSessions();

  const [connectionForm, setConnectionForm] = useState({
    host: connection.host,
    port: String(connection.port),
    token: connection.token,
  });

  useEffect(() => {
    setConnectionForm({
      host: connection.host,
      port: String(connection.port),
      token: connection.token,
    });
  }, [connection.host, connection.port, connection.token]);

  const activeSession = useMemo(
    () =>
      sessions.find((session) => session.sessionId === activeSessionId) ?? null,
    [activeSessionId, sessions],
  );

  const timelineItems = activeSessionId
    ? (timelineBySession[activeSessionId] ?? [])
    : [];
  const sessionCount = sessions.length;

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 3800);
    return () => window.clearTimeout(timeout);
  }, [notice]);

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
    ],
    [createSession, refreshNow, selectedWorkspace, trackSession],
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
      await submitMessage(outbound);
      setComposerDraft("");
      setNotice("Message submitted to daemon");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    }
  }, [activeSessionId, composerDraft, submitMessage]);

  return (
    <div className={`app-shell ${palette.isOpen ? "palette-open" : ""}`}>
      <div
        ref={shellBodyRef}
        className="app-shell-body"
        aria-hidden={palette.isOpen}
      >
        <header className="app-topbar">
          <div className="identity">
            <h1>Opta Code Desktop</h1>
            <p>
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
              <span>{showTerminal ? "Runtime visible" : "Runtime hidden"}</span>
            </div>
          </div>

          <form
            className="connection-form"
            onSubmit={(event) => {
              event.preventDefault();
              const nextPort = Number.parseInt(connectionForm.port, 10);
              setConnection({
                host: connectionForm.host.trim() || connection.host,
                port: Number.isFinite(nextPort) ? nextPort : connection.port,
                token: connectionForm.token.trim() || connection.token,
              });
              setNotice("Daemon connection updated");
              void refreshNow();
            }}
          >
            <label>
              Host
              <input
                value={connectionForm.host}
                onChange={(event) =>
                  setConnectionForm((previous) => ({
                    ...previous,
                    host: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              Port
              <input
                value={connectionForm.port}
                onChange={(event) =>
                  setConnectionForm((previous) => ({
                    ...previous,
                    port: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              Token
              <input
                type="password"
                value={connectionForm.token}
                onChange={(event) =>
                  setConnectionForm((previous) => ({
                    ...previous,
                    token: event.target.value,
                  }))
                }
              />
            </label>
            <button type="submit">Connect</button>
          </form>

          <div className="top-actions">
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
            <button type="button" onClick={palette.open}>
              Palette (Cmd/Ctrl+K)
            </button>
            <button
              type="button"
              onClick={() => setShowTerminal((current) => !current)}
            >
              {showTerminal ? "Hide Runtime" : "Show Runtime"}
            </button>
          </div>
        </header>

        <main
          className={`workspace-layout ${showTerminal ? "with-terminal" : "without-terminal"}`}
        >
          {activePage === "models" ? (
            <ModelsPage connection={connection} />
          ) : (
            <>
              <WorkspaceRail
                sessions={sessions}
                activeSessionId={activeSessionId}
                selectedWorkspace={selectedWorkspace}
                onSelectWorkspace={setSelectedWorkspace}
                onSelectSession={(sessionId) => {
                  setActiveSessionId(sessionId);
                  const next = sessions.find(
                    (session) => session.sessionId === sessionId,
                  );
                  if (next) setSelectedWorkspace(next.workspace);
                }}
              />

              <TimelineCards
                sessionId={activeSessionId}
                sessionTitle={activeSession?.title}
                items={timelineItems}
                isStreaming={isStreaming}
              />
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
                <p className="runtime-error">{connectionError}</p>
              ) : null}
              <button type="button" onClick={() => void refreshNow()}>
                Refresh Now
              </button>
            </aside>
          ) : null}
        </main>

        <div className="status-strip" aria-live="polite">
          <span>State: {connectionState}</span>
          <span>Sessions: {sessionCount}</span>
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
          disabled={!activeSessionId}
        />
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
    </div>
  );
}

export default App;
