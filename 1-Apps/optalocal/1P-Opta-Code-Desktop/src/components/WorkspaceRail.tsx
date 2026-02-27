import type { DaemonSessionSummary } from "../types";

interface WorkspaceRailProps {
  sessions: DaemonSessionSummary[];
  activeSessionId: string | null;
  selectedWorkspace: string;
  onSelectWorkspace: (workspace: string) => void;
  onSelectSession: (sessionId: string) => void;
}

export function WorkspaceRail({
  sessions,
  activeSessionId,
  selectedWorkspace,
  onSelectWorkspace,
  onSelectSession,
}: WorkspaceRailProps) {
  const workspaces = [
    "all",
    ...new Set(sessions.map((session) => session.workspace)),
  ];
  const visible =
    selectedWorkspace === "all"
      ? sessions
      : sessions.filter((session) => session.workspace === selectedWorkspace);

  return (
    <aside className="workspace-rail glass-subtle">
      <header>
        <h2>Workspaces</h2>
      </header>
      <div className="workspace-chips">
        {workspaces.map((workspace) => (
          <button
            key={workspace}
            type="button"
            className={workspace === selectedWorkspace ? "active" : ""}
            onClick={() => onSelectWorkspace(workspace)}
          >
            {workspace}
          </button>
        ))}
      </div>

      <div className="session-list">
        {visible.length === 0 ? (
          <p className="empty">No sessions in this workspace.</p>
        ) : (
          visible.map((session) => (
            <button
              key={session.sessionId}
              type="button"
              className={
                session.sessionId === activeSessionId
                  ? "session active"
                  : "session"
              }
              onClick={() => onSelectSession(session.sessionId)}
            >
              <strong>{session.title}</strong>
              <span>{session.sessionId}</span>
            </button>
          ))
        )}
      </div>
    </aside>
  );
}
