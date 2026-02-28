import { useRef, useState } from "react";
import { Copy, Search, X } from "lucide-react";
import type { DaemonSessionSummary } from "../types";

interface WorkspaceRailProps {
  sessions: DaemonSessionSummary[];
  activeSessionId: string | null;
  selectedWorkspace: string;
  onSelectWorkspace: (workspace: string) => void;
  onSelectSession: (sessionId: string) => void;
  onRemoveSession?: (sessionId: string) => void;
}

export function WorkspaceRail({
  sessions,
  activeSessionId,
  selectedWorkspace,
  onSelectWorkspace,
  onSelectSession,
  onRemoveSession,
}: WorkspaceRailProps) {
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copyTimerRef = useRef<number | null>(null);

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

  const copyId = (sessionId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    void navigator.clipboard.writeText(sessionId).then(() => {
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
      setCopiedId(sessionId);
      copyTimerRef.current = window.setTimeout(() => setCopiedId(null), 1400);
    });
  };

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
            <div
              key={session.sessionId}
              className={`session-row ${session.sessionId === activeSessionId ? "active" : ""}`}
            >
              <button
                type="button"
                className="session-main"
                onClick={() => onSelectSession(session.sessionId)}
              >
                <strong>{session.title}</strong>
                <span className="session-id-tag">
                  {session.sessionId.slice(0, 12)}
                </span>
                {session.updatedAt ? (
                  <span className="session-time">
                    {new Date(session.updatedAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                ) : null}
              </button>

              <div className="session-actions">
                <button
                  type="button"
                  className="session-action-btn"
                  title="Copy session ID"
                  aria-label="Copy session ID"
                  onClick={(e) => copyId(session.sessionId, e)}
                >
                  <Copy size={11} aria-hidden="true" />
                  {copiedId === session.sessionId ? (
                    <span className="copy-flash">✓</span>
                  ) : null}
                </button>
                {onRemoveSession ? (
                  <button
                    type="button"
                    className="session-action-btn session-remove-btn"
                    title="Remove from rail"
                    aria-label="Remove session from rail"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveSession(session.sessionId);
                    }}
                  >
                    <X size={11} aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
