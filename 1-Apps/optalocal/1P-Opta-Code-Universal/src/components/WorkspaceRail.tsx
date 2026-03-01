import { useRef, useState } from "react";
import { AlertTriangle, Copy, Search, X, Pin, PinOff } from "lucide-react";
import { useLocalStorage } from "../hooks/useLocalStorage";
import type { DaemonSessionSummary } from "../types";
import {
  getBrowserVisualShortLabel,
  type BrowserVisualState,
  type BrowserVisualSummary,
} from "../lib/browserVisualState";

interface WorkspaceRailProps {
  sessions: DaemonSessionSummary[];
  activeSessionId: string | null;
  selectedWorkspace: string;
  streamingBySession?: Record<string, boolean>;
  pendingPermissionsBySession?: Record<string, unknown[]>;
  browserVisualBySession?: Record<string, BrowserVisualSummary>;
  onSelectWorkspace: (workspace: string) => void;
  onSelectSession: (sessionId: string) => void;
  onRemoveSession?: (sessionId: string) => void;
}

export function WorkspaceRail({
  sessions,
  activeSessionId,
  selectedWorkspace,
  streamingBySession = {},
  pendingPermissionsBySession = {},
  browserVisualBySession = {},
  onSelectWorkspace,
  onSelectSession,
  onRemoveSession,
}: WorkspaceRailProps) {
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pinnedWorkspaces, setPinnedWorkspaces] = useLocalStorage<string[]>("opta:pinnedWorkspaces", []);
  const copyTimerRef = useRef<number | null>(null);

  const dynamicWorkspaces = [
    "all",
    ...new Set(sessions.map((session) => session.workspace)),
  ];

  // Combine pinned and dynamic distinctively
  const workspaces = [...new Set(["all", ...pinnedWorkspaces, ...dynamicWorkspaces])];

  const handleTogglePin = (workspace: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPinnedWorkspaces(prev =>
      prev.includes(workspace) ? prev.filter(w => w !== workspace) : [...prev, workspace]
    );
  };

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
        {workspaces.map((workspace) => {
          const isPinned = pinnedWorkspaces.includes(workspace);
          const isAll = workspace === "all";
          return (
            <div key={workspace} className={`workspace-chip-row ${workspace === selectedWorkspace ? "active" : ""}`}>
              <button
                type="button"
                className={`workspace-chip-btn ${workspace === selectedWorkspace ? "active" : ""}`}
                onClick={() => onSelectWorkspace(workspace)}
              >
                {workspace}
              </button>
              {!isAll && (
                <button
                  type="button"
                  className="workspace-pin-btn"
                  onClick={(e) => handleTogglePin(workspace, e)}
                  title={isPinned ? "Unpin Project" : "Pin Project"}
                >
                  {isPinned ? <Pin size={12} fill="currentColor" /> : <PinOff size={12} />}
                </button>
              )}
            </div>
          );
        })}
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
          visible.map((session) => {
            const isSessionStreaming = streamingBySession[session.sessionId] ?? false;
            const pendingCount = pendingPermissionsBySession[session.sessionId]?.length ?? 0;
            const browserSummary = browserVisualBySession[session.sessionId];
            const browserState: BrowserVisualState =
              browserSummary?.state ??
              (pendingCount > 0 ? "blocked" : isSessionStreaming ? "working" : "idle");
            const showBrowserCue =
              browserState === "active" ||
              browserState === "blocked" ||
              browserState === "working";
            const browserLabel = getBrowserVisualShortLabel(browserState);

            return (
              <div
                key={session.sessionId}
                className={`session-row${session.sessionId === activeSessionId ? " active" : ""}${isSessionStreaming ? " session-row--streaming" : ""}${showBrowserCue ? ` session-row--browser-${browserState}` : ""}`}
              >
                <button
                  type="button"
                  className="session-main"
                  onClick={() => onSelectSession(session.sessionId)}
                >
                  <span className="session-title-row">
                    <strong>{session.title}</strong>
                    {isSessionStreaming && (
                      <span
                        className="session-streaming-dot"
                        aria-label="Agent is working"
                        title="Agent is working"
                      />
                    )}
                    {pendingCount > 0 && (
                      <span
                        className="session-permission-badge"
                        aria-label={`${pendingCount} pending permission${pendingCount !== 1 ? "s" : ""}`}
                        title="Permission required"
                      >
                        <AlertTriangle size={10} aria-hidden="true" />
                        {pendingCount}
                      </span>
                    )}
                    {showBrowserCue && (
                      <span
                        className={`session-browser-chip session-browser-chip-${browserState}`}
                        aria-label={`Browser ${browserLabel}`}
                        title={`Browser ${browserSummary?.activityText ?? browserLabel}`}
                      >
                        {browserLabel}
                      </span>
                    )}
                  </span>
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
            );
          })
        )}
      </div>
    </aside>
  );
}
