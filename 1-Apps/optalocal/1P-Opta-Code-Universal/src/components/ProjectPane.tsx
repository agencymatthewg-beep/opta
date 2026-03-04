import type { DaemonSessionSummary, AgentBarItem } from "../types";
import type { ConnectionHealthState } from "../hooks/useConnectionHealth";

interface ProjectPaneProps {
    sessions: DaemonSessionSummary[];
    activeSessionId: string | null;
    streamingBySession: Record<string, boolean>;
    pendingPermissionsBySession: Record<string, unknown[]>;
    connectionState: string;
    connectionHealth?: ConnectionHealthState;
    connectionHost: string;
    connectionPort: number;
    onSelectSession: (sessionId: string) => void;
    onCreateSession: () => void;
}

function deriveAgentItems(
    sessions: DaemonSessionSummary[],
    streamingBySession: Record<string, boolean>,
    pendingPermissionsBySession: Record<string, unknown[]>,
): AgentBarItem[] {
    const items: AgentBarItem[] = [];
    for (const session of sessions) {
        const sid = session.sessionId;
        const isStreaming = streamingBySession[sid] ?? false;
        const hasPending = (pendingPermissionsBySession[sid]?.length ?? 0) > 0;

        if (isStreaming) {
            items.push({
                sessionId: sid,
                sessionTitle: session.title || sid.slice(0, 8),
                state: "streaming",
                elapsedMs: 0,
            });
        } else if (hasPending) {
            items.push({
                sessionId: sid,
                sessionTitle: session.title || sid.slice(0, 8),
                state: "blocked",
                elapsedMs: 0,
            });
        }
    }
    return items;
}

export function ProjectPane({
    sessions,
    activeSessionId,
    streamingBySession,
    pendingPermissionsBySession,
    connectionState,
    connectionHost,
    connectionPort,
    onSelectSession,
    onCreateSession,
}: ProjectPaneProps) {
    const agentItems = deriveAgentItems(
        sessions,
        streamingBySession,
        pendingPermissionsBySession,
    );

    const isConnected = connectionState === "connected";

    // Group sessions by workspace
    const workspaceMap = new Map<string, DaemonSessionSummary[]>();
    for (const session of sessions) {
        const ws = session.workspace || "default";
        if (!workspaceMap.has(ws)) workspaceMap.set(ws, []);
        workspaceMap.get(ws)!.push(session);
    }

    return (
        <aside className="project-pane">
            {/* Agent Status Section */}
            {agentItems.length > 0 && (
                <>
                    <div className="pp-header">
                        <span className="pp-title">ACTIVE AGENTS</span>
                    </div>
                    <div className="pp-agent-list">
                        {agentItems.map((agent) => (
                            <button
                                key={agent.sessionId}
                                className={`pp-agent-pill pp-agent-${agent.state}`}
                                onClick={() => onSelectSession(agent.sessionId)}
                                type="button"
                            >
                                <span className="pp-agent-dot" />
                                <span className="pp-agent-name">{agent.sessionTitle}</span>
                                <span className="pp-agent-status">
                                    {agent.state === "streaming"
                                        ? "Running"
                                        : agent.state === "blocked"
                                            ? "REVIEW"
                                            : agent.state}
                                </span>
                            </button>
                        ))}
                    </div>
                </>
            )}

            {/* Projects Section */}
            <div className="pp-header">
                <span className="pp-title">PROJECTS</span>
                <button
                    className="pp-icon-btn"
                    onClick={onCreateSession}
                    type="button"
                    title="New Session"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                </button>
            </div>

            <div className="pp-tree">
                {[...workspaceMap.entries()].map(([workspace, wsSessions]) => (
                    <div key={workspace} className="pp-workspace-group">
                        <div className="pp-workspace-label">▾ {workspace}</div>
                        {wsSessions.map((session) => {
                            const isActive = session.sessionId === activeSessionId;
                            const isSessionStreaming = streamingBySession[session.sessionId] ?? false;
                            return (
                                <button
                                    key={session.sessionId}
                                    className={`pp-session ${isActive ? "pp-session-active" : ""}`}
                                    onClick={() => onSelectSession(session.sessionId)}
                                    type="button"
                                >
                                    <span className="pp-session-name">
                                        {session.title || session.sessionId.slice(0, 8)}
                                    </span>
                                    {isSessionStreaming && <span className="pp-session-dot pp-dot-live" />}
                                </button>
                            );
                        })}
                    </div>
                ))}
                {sessions.length === 0 && (
                    <div className="pp-empty">No sessions yet</div>
                )}
            </div>

            {/* Bottom Area: Health + Profile */}
            <div className="pp-bottom">
                <div className="pp-health">
                    <div className="pp-health-row">
                        <span>Daemon</span>
                        <span className={`pp-health-status ${isConnected ? "pp-status-online" : "pp-status-offline"}`}>
                            <span className="pp-health-dot" />
                            {isConnected ? `${connectionHost}:${connectionPort}` : "OFFLINE"}
                        </span>
                    </div>
                </div>
                <a
                    className="pp-user-profile"
                    href="https://accounts.optalocal.com"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    <div className="pp-avatar">M</div>
                    <div className="pp-user-info">
                        <span className="pp-user-name">Matthew Byrden</span>
                        <span className="pp-user-team">Opta Local Pro</span>
                    </div>
                </a>
            </div>
        </aside>
    );
}
