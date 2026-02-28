import { useState } from "react";
import { Search } from "lucide-react";
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
  const [search, setSearch] = useState("");

  const workspaces = [
    "all",
    ...new Set(sessions.map((session) => session.workspace)),
  ];

  const byWorkspace =
    selectedWorkspace === "all"
      ? sessions
      : sessions.filter((session) => session.workspace === selectedWorkspace);

  const visible = search.trim()
    ? byWorkspace.filter(
        (session) =>
          session.title.toLowerCase().includes(search.toLowerCase()) ||
          session.sessionId.includes(search),
      )
    : byWorkspace;

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

      <div className="rail-search-wrap">
        <Search size={13} className="rail-search-icon" aria-hidden="true" />
        <input
          type="search"
          className="rail-search"
          placeholder="Filter sessions…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Filter sessions"
        />
      </div>

      <div className="session-list">
        {visible.length === 0 ? (
          <p className="empty">
            {search ? "No sessions match." : "No sessions in this workspace."}
          </p>
        ) : (
          visible.map((session) => (
            <button
              key={session.sessionId}
              type="button"
              className={
                session.sessionId === activeSessionId ? "session active" : "session"
              }
              onClick={() => onSelectSession(session.sessionId)}
            >
              <strong>{session.title}</strong>
              <span>{session.sessionId.slice(0, 12)}</span>
              {session.updatedAt ? (
                <span>
                  {new Date(session.updatedAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              ) : null}
            </button>
          ))
        )}
      </div>
    </aside>
  );
}
