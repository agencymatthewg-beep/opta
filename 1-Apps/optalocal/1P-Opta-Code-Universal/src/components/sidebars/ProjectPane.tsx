import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { DaemonSessionSummary, AgentBarItem } from "../../types";
import type { ConnectionHealthState } from "../../hooks/useConnectionHealth";
import { handleExternalClick } from "../../lib/openUrl";
import { Plus, ChevronRight } from "lucide-react";

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
    deviceLabel?: string;
    onDeviceLabelChange?: (label: string) => void;
    collapsed?: boolean;
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
    deviceLabel,
    onDeviceLabelChange,
    collapsed = false,
}: ProjectPaneProps) {
    const agentItems = deriveAgentItems(
        sessions,
        streamingBySession,
        pendingPermissionsBySession,
    );

    const isConnected = connectionState === "connected";

    // Track expanded state for workspaces
    const [expandedWorkspaces, setExpandedWorkspaces] = useState<Record<string, boolean>>({
        default: true
    });

    const toggleWorkspace = (workspace: string) => {
        setExpandedWorkspaces(prev => ({
            ...prev,
            [workspace]: !(prev[workspace] ?? true)
        }));
    };

    // Group sessions by workspace
    const workspaceMap = new Map<string, DaemonSessionSummary[]>();
    for (const session of sessions) {
        const ws = session.workspace || "default";
        if (!workspaceMap.has(ws)) workspaceMap.set(ws, []);
        workspaceMap.get(ws)!.push(session);
    }

    return (
        <aside
            className={`project-pane glass-subtle${collapsed ? " collapsed" : ""}`}
            aria-hidden={collapsed || undefined}
        >
            {/* Projects Section */}
            <div className="pp-header">
                <span className="pp-title">Projects</span>
                <button
                    className="pp-icon-btn pp-btn-glass"
                    onClick={onCreateSession}
                    type="button"
                    title="New Session"
                >
                    <Plus size={16} strokeWidth={2.5} />
                </button>
            </div>

            <div className="pp-tree">
                {[...workspaceMap.entries()].map(([workspace, wsSessions]) => {
                    const isExpanded = expandedWorkspaces[workspace] ?? true;
                    return (
                        <div key={workspace} className="pp-workspace-group">
                            <motion.button
                                type="button"
                                className="pp-workspace-label-btn"
                                onClick={() => toggleWorkspace(workspace)}
                                whileHover={{ backgroundColor: "rgba(255, 255, 255, 0.04)" }}
                                whileTap={{ scale: 0.98 }}
                            >
                                <motion.div
                                    animate={{ rotate: isExpanded ? 90 : 0 }}
                                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                >
                                    <ChevronRight size={14} strokeWidth={2.5} style={{ color: "var(--opta-primary)", opacity: 0.8 }} />
                                </motion.div>
                                <span className="pp-workspace-label-text">{workspace}</span>
                            </motion.button>

                            <AnimatePresence initial={false}>
                                {isExpanded && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ type: "spring", stiffness: 300, damping: 25, mass: 0.8 }}
                                        style={{ overflow: "hidden" }}
                                    >
                                        <div className="pp-workspace-sessions-list">
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
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    );
                })}
                {sessions.length === 0 && (
                    <div className="pp-empty">No sessions yet</div>
                )}
            </div>

            {/* Bottom: redesign-9 health block */}
            <div className="pp-health-block">
                <div className="pp-health-row">
                    <span>Daemon</span>
                    <div className={`pp-h-server ${isConnected ? "" : "pp-h-offline"}`}>
                        <span className="pp-health-dot" />
                        {isConnected ? "ONLINE" : "OFFLINE"}
                    </div>
                </div>
                <div className="pp-health-row">
                    <span>LMX Engine</span>
                    <span className="pp-h-perf">—</span>
                </div>
                <div className="pp-health-row pp-health-model">
                    <span>Loaded</span>
                    <span className="pp-m-pill">—</span>
                </div>
            </div>
            <a
                className="pp-user-profile"
                href="https://accounts.optalocal.com"
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleExternalClick}
            >
                <div className="pp-avatar">M</div>
                <div className="pp-user-info">
                    <span className="pp-user-name">Matthew Byrden</span>
                    <span
                        className="pp-user-team pp-device-label"
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => onDeviceLabelChange?.(e.currentTarget.textContent || "Workstation - Opta48")}
                        onClick={(e) => e.preventDefault()}
                    >
                        {deviceLabel ?? "Workstation - Opta48"}
                    </span>
                </div>
            </a>
        </aside>
    );
}
