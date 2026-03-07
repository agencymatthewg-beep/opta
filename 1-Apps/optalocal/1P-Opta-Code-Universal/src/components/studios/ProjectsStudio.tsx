import { useState, useEffect, type CSSProperties } from "react";
import {
    FolderKey,
    FolderGit2,
    FolderLock,
    FolderOpen,
    Plus,
    RefreshCw,
    Trash2,
    Settings,
    X,
    Play,
    Target,
    FileText,
} from "lucide-react";
import type { DaemonSessionSummary } from "../../types";
import { invokeNative, isNativeDesktop } from "../../lib/runtime";
import { openFolder } from "../../lib/openUrl";

interface WorkspaceProject {
    name: string;
    path: string;
    has_goal: boolean;
    has_index: boolean;
}

const ACCENT = "#f472b6"; // Pink for projects

interface ProjectsStudioProps {
    isFullscreen: boolean;
    onClose: () => void;
    sessions: DaemonSessionSummary[];
    activeSessionId: string | null;
    onSelectSession: (sessionId: string) => void;
    onCreateSession: (workspace: string) => Promise<void>;
    connectionState: string;
}

export function ProjectsStudio({
    isFullscreen,
    onClose,
    sessions,
    activeSessionId,
    onSelectSession,
    onCreateSession,
    connectionState,
}: ProjectsStudioProps) {
    const [activeTab, setActiveTab] = useState<"projects" | "recent" | "workspaces">("projects");
    const [refreshing, setRefreshing] = useState(false);
    const [optaProjects, setOptaProjects] = useState<WorkspaceProject[]>([]);
    const [projectsLoading, setProjectsLoading] = useState(false);
    const [projectsError, setProjectsError] = useState<string | null>(null);

    const loadOptaProjects = async () => {
        if (!isNativeDesktop()) return;
        setProjectsLoading(true);
        setProjectsError(null);
        try {
            const result = await invokeNative<WorkspaceProject[]>("get_workspace_projects");
            setOptaProjects(result);
        } catch (e) {
            setProjectsError(e instanceof Error ? e.message : String(e));
        } finally {
            setProjectsLoading(false);
        }
    };

    useEffect(() => {
        void loadOptaProjects();
    }, []);

    // Group sessions by workspace
    const workspaceMap = new Map<string, DaemonSessionSummary[]>();
    for (const session of sessions) {
        const ws = session.workspace || "default";
        if (!workspaceMap.has(ws)) workspaceMap.set(ws, []);
        workspaceMap.get(ws)!.push(session);
    }

    const workspaces = Array.from(workspaceMap.entries()).map(([name, wsSessions]) => ({
        name,
        sessions: wsSessions,
        latestActivity: wsSessions.length > 0
            ? new Date(Math.max(...wsSessions.map(s => s.updatedAt ? new Date(s.updatedAt).getTime() : 0)))
            : null,
    })).sort((a, b) => {
        // Sort by latest activity descending
        if (!a.latestActivity) return 1;
        if (!b.latestActivity) return -1;
        return b.latestActivity.getTime() - a.latestActivity.getTime();
    });

    const recentSessions = [...sessions].sort((a, b) => {
        const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return timeB - timeA;
    }).slice(0, 50); // Top 50 recent

    const handleRefresh = async () => {
        setRefreshing(true);
        await Promise.all([
            loadOptaProjects(),
            new Promise((resolve) => setTimeout(resolve, 400)),
        ]);
        setRefreshing(false);
    };

    const shellClass = [
        "opta-studio-shell",
        "opta-studio-shell--embedded",
        isFullscreen ? "opta-studio-shell--fullscreen" : "",
    ]
        .filter(Boolean)
        .join(" ");

    const isConnected = connectionState === "connected";

    // Using a custom icon based on workspace name heuristics (like in the prototypes)
    const getWorkspaceIcon = (name: string) => {
        if (name.includes("daemon") || name.includes("rust") || name.includes("go")) return <FolderGit2 size={18} />;
        if (name.includes("auth") || name.includes("account")) return <FolderLock size={18} />;
        return <FolderKey size={18} />;
    };

    return (
        <div
            className={shellClass}
            style={{ "--studio-feature-accent": ACCENT } as CSSProperties}
            onClick={(e) => e.stopPropagation()}
        >
            {/* Top Chrome */}
            <div className="opta-studio-top-chrome">
                <div className="opta-studio-top-chrome-left">
                    <div className="opta-studio-shortcut-panel">
                        <span className="opta-studio-shortcut-title">Projects Studio</span>
                        <span className="opta-studio-shortcut-copy">
                            Ctrl+P toggle · Shift+Space fullscreen · Esc close
                        </span>
                    </div>
                </div>
                <div className="opta-studio-top-chrome-center">
                    <div className="opta-studio-command-row">
                        <div className="opta-studio-panel-title">
                            <span
                                className="opta-studio-layer-badge"
                                style={{ "--settings-accent": ACCENT } as CSSProperties}
                            >
                                <FolderKey
                                    size={13}
                                    style={{ display: "inline", verticalAlign: "middle", marginRight: 5 }}
                                />
                                Workspace Management
                            </span>
                        </div>
                    </div>
                </div>
                <div className="opta-studio-top-chrome-right">
                    <button
                        type="button"
                        onClick={onClose}
                        className="opta-studio-close-btn"
                        aria-label="Close Projects Studio"
                    >
                        <X size={20} />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="feature-studio-content">
                <div className="feature-studio-section-header">
                    <h3 className="feature-studio-section-title" style={{ color: ACCENT }}>
                        Projects
                    </h3>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span
                            className={`feature-studio-status-dot ${isConnected ? "feature-studio-status-dot--up" : "feature-studio-status-dot--down"}`}
                        />
                        <span style={{ fontSize: 11, color: isConnected ? ACCENT : "#71717a" }}>
                            {isConnected
                                ? `Daemon Online · ${optaProjects.length} project${optaProjects.length !== 1 ? "s" : ""}`
                                : "Daemon offline"}
                        </span>
                        <button
                            type="button"
                            className="feature-studio-action-secondary"
                            onClick={() => void handleRefresh()}
                            disabled={refreshing}
                            style={{ color: ACCENT, borderColor: `${ACCENT}44` }}
                        >
                            <RefreshCw
                                size={13}
                                className={refreshing ? "feature-studio-spin" : ""}
                            />
                            Refresh
                        </button>
                        <button
                            type="button"
                            className="feature-studio-action-secondary"
                            onClick={() => void onCreateSession("default")}
                            style={{ color: ACCENT, borderColor: `${ACCENT}44`, marginLeft: "0.25rem" }}
                        >
                            <Plus size={13} />
                            New Chat
                        </button>
                    </div>
                </div>

                {/* Tab bar: Opta Projects | Workspaces | Recent Chats */}
                <div className="feature-studio-tab-bar" style={{ marginTop: "1.25rem" }}>
                    <button
                        type="button"
                        className={`feature-studio-tab ${activeTab === "projects" ? "is-active" : ""}`}
                        style={
                            activeTab === "projects"
                                ? ({
                                    "--tab-accent": ACCENT,
                                    color: ACCENT,
                                    borderColor: `${ACCENT}55`,
                                } as CSSProperties)
                                : {}
                        }
                        onClick={() => setActiveTab("projects")}
                    >
                        <FolderOpen size={13} />
                        Opta Projects ({optaProjects.length})
                    </button>
                    <button
                        type="button"
                        className={`feature-studio-tab ${activeTab === "workspaces" ? "is-active" : ""}`}
                        style={
                            activeTab === "workspaces"
                                ? ({
                                    "--tab-accent": ACCENT,
                                    color: ACCENT,
                                    borderColor: `${ACCENT}55`,
                                } as CSSProperties)
                                : {}
                        }
                        onClick={() => setActiveTab("workspaces")}
                    >
                        <FolderKey size={13} />
                        Sessions ({workspaces.length})
                    </button>
                    <button
                        type="button"
                        className={`feature-studio-tab ${activeTab === "recent" ? "is-active" : ""}`}
                        style={
                            activeTab === "recent"
                                ? ({
                                    "--tab-accent": ACCENT,
                                    color: ACCENT,
                                    borderColor: `${ACCENT}55`,
                                } as CSSProperties)
                                : {}
                        }
                        onClick={() => setActiveTab("recent")}
                    >
                        <Play size={13} />
                        Recent Chats ({sessions.length})
                    </button>
                </div>

                {/* Opta Projects (filesystem) */}
                {activeTab === "projects" && (
                    <>
                        {!isNativeDesktop() ? (
                            <div className="feature-studio-empty-state">
                                <FolderOpen size={28} style={{ opacity: 0.25, color: ACCENT }} />
                                <p>Desktop App Required</p>
                                <p className="feature-studio-empty-hint">
                                    Launch the native Opta Code app to browse your Opta Workspace projects.
                                </p>
                            </div>
                        ) : projectsLoading ? (
                            <div className="feature-studio-empty-state">
                                <RefreshCw size={22} className="feature-studio-spin" style={{ color: ACCENT, opacity: 0.5 }} />
                                <p style={{ marginTop: "0.75rem", color: "#71717a", fontSize: 13 }}>Loading projects…</p>
                            </div>
                        ) : projectsError ? (
                            <div className="feature-studio-empty-state">
                                <FolderOpen size={28} style={{ opacity: 0.25, color: "#f87171" }} />
                                <p style={{ color: "#f87171" }}>Could not load projects</p>
                                <p className="feature-studio-empty-hint">{projectsError}</p>
                            </div>
                        ) : optaProjects.length > 0 ? (
                            <div className="feature-studio-model-list">
                                {optaProjects.map((project) => (
                                    <div
                                        key={project.path}
                                        className="feature-studio-model-row feature-studio-model-row--loaded"
                                        style={{ borderLeft: `3px solid ${ACCENT}` }}
                                    >
                                        <div className="feature-studio-model-info" style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                                            <div style={{ color: ACCENT, background: `${ACCENT}15`, padding: "0.4rem", borderRadius: "8px" }}>
                                                <FolderOpen size={18} />
                                            </div>
                                            <div>
                                                <span className="feature-studio-model-name" style={{ fontSize: "1rem", fontWeight: 600 }}>
                                                    {project.name}
                                                </span>
                                                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem", flexWrap: "wrap" }}>
                                                    {project.has_goal && (
                                                        <span
                                                            className="feature-studio-model-badge feature-studio-model-badge--loaded"
                                                            style={{ background: `${ACCENT}18`, color: ACCENT, borderColor: `${ACCENT}44`, display: "flex", alignItems: "center", gap: 3 }}
                                                        >
                                                            <Target size={9} /> Goal
                                                        </span>
                                                    )}
                                                    {project.has_index && (
                                                        <span
                                                            className="feature-studio-model-badge"
                                                            style={{ background: "#ffffff0a", color: "#a1a1aa", borderColor: "#a1a1aa33", display: "flex", alignItems: "center", gap: 3 }}
                                                        >
                                                            <FileText size={9} /> Index
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="feature-studio-model-right">
                                            <button
                                                type="button"
                                                className="feature-studio-action-mini"
                                                onClick={() => void onCreateSession(project.path)}
                                                style={{ color: ACCENT, borderColor: `${ACCENT}44` }}
                                                title={`New chat in ${project.name}`}
                                            >
                                                <Plus size={11} /> New Chat
                                            </button>
                                            <button
                                                type="button"
                                                className="feature-studio-action-mini"
                                                onClick={() => void openFolder(project.path)}
                                                style={{ color: "#a1a1aa", borderColor: "#a1a1aa44" }}
                                                title="Open in Finder"
                                            >
                                                <FolderOpen size={11} /> Open
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="feature-studio-empty-state">
                                <FolderOpen size={28} style={{ opacity: 0.25, color: ACCENT }} />
                                <p>No Projects Yet</p>
                                <p className="feature-studio-empty-hint">
                                    Run <code style={{ fontFamily: "JetBrains Mono", fontSize: 11, background: `${ACCENT}15`, padding: "2px 5px", borderRadius: 4 }}>opta workspace new &lt;name&gt;</code> to create your first project.
                                </p>
                            </div>
                        )}
                    </>
                )}

                {/* Workspaces List */}
                {activeTab === "workspaces" && (
                    <>
                        {workspaces.length > 0 ? (
                            <div className="feature-studio-model-list">
                                {workspaces.map((ws) => {
                                    return (
                                        <div
                                            key={ws.name}
                                            className="feature-studio-model-row feature-studio-model-row--loaded"
                                            style={{ borderLeft: `3px solid ${ACCENT}` }}
                                        >
                                            <div className="feature-studio-model-info" style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                                                <div style={{ color: ACCENT, background: `${ACCENT}15`, padding: "0.4rem", borderRadius: "8px" }}>
                                                    {getWorkspaceIcon(ws.name.toLowerCase())}
                                                </div>
                                                <div>
                                                    <span className="feature-studio-model-name" style={{ fontSize: "1rem", fontWeight: 600 }}>
                                                        {ws.name}
                                                    </span>
                                                    <div style={{ display: "flex", gap: "1rem", marginTop: "0.25rem" }}>
                                                        <span className="feature-studio-model-params">
                                                            {ws.sessions.length} Chat{ws.sessions.length !== 1 ? "s" : ""}
                                                        </span>
                                                        {ws.latestActivity && (
                                                            <span className="feature-studio-model-params">
                                                                Last active {ws.latestActivity.toLocaleDateString()}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="feature-studio-model-right">
                                                <button
                                                    type="button"
                                                    className="feature-studio-action-mini"
                                                    onClick={() => void onCreateSession(ws.name)}
                                                    style={{ color: ACCENT, borderColor: `${ACCENT}44` }}
                                                    title="New Session in Workspace"
                                                >
                                                    <Plus size={11} /> New Chat
                                                </button>
                                                <button
                                                    type="button"
                                                    className="feature-studio-action-mini"
                                                    style={{ color: "#a1a1aa", borderColor: "#a1a1aa44" }}
                                                    title="Workspace Settings"
                                                >
                                                    <Settings size={11} /> Config
                                                </button>
                                                <button
                                                    type="button"
                                                    className="feature-studio-action-mini feature-studio-action-mini--danger"
                                                    title="Delete Workspace"
                                                >
                                                    <Trash2 size={11} /> Delete
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="feature-studio-empty-state">
                                <FolderKey size={28} style={{ opacity: 0.25, color: ACCENT }} />
                                <p>No Workspaces Found</p>
                                <p className="feature-studio-empty-hint">
                                    Create a new session to initialize a workspace.
                                </p>
                            </div>
                        )}
                    </>
                )}

                {/* Recent Chats List */}
                {activeTab === "recent" && (
                    <>
                        {recentSessions.length > 0 ? (
                            <div className="feature-studio-model-list">
                                {recentSessions.map((session) => {
                                    const isActive = session.sessionId === activeSessionId;
                                    return (
                                        <div
                                            key={session.sessionId}
                                            className={`feature-studio-model-row feature-studio-model-row--available`}
                                            style={{ borderLeft: isActive ? `3px solid ${ACCENT}` : `3px solid transparent` }}
                                        >
                                            <div className="feature-studio-model-info">
                                                <span className="feature-studio-model-name" style={{ fontWeight: isActive ? 600 : 500, color: isActive ? ACCENT : undefined }}>
                                                    {session.title || session.sessionId.slice(0, 8)}
                                                </span>
                                                <span className="feature-studio-model-params" style={{ fontFamily: "JetBrains Mono" }}>
                                                    [{session.workspace || "default"}]
                                                </span>
                                                {session.updatedAt && (
                                                    <span className="feature-studio-model-params">
                                                        {new Date(session.updatedAt).toLocaleString()}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="feature-studio-model-right">
                                                {isActive && (
                                                    <span className="feature-studio-model-badge feature-studio-model-badge--loaded" style={{ background: `${ACCENT}22`, color: ACCENT, borderColor: `${ACCENT}44` }}>
                                                        Active Context
                                                    </span>
                                                )}
                                                <button
                                                    type="button"
                                                    className="feature-studio-action-mini"
                                                    onClick={() => {
                                                        onSelectSession(session.sessionId);
                                                        onClose();
                                                    }}
                                                    style={{ color: isActive ? ACCENT : "#a1a1aa", borderColor: isActive ? `${ACCENT}44` : "#a1a1aa44" }}
                                                    title="Open Session"
                                                >
                                                    <Play size={11} /> Open
                                                </button>
                                                <button
                                                    type="button"
                                                    className="feature-studio-action-mini feature-studio-action-mini--danger"
                                                    title="Delete Session"
                                                >
                                                    <Trash2 size={11} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="feature-studio-empty-state">
                                <Play size={28} style={{ opacity: 0.25, color: ACCENT }} />
                                <p>No Recent Chats Found</p>
                            </div>
                        )}
                    </>
                )}

                <div
                    className="feature-studio-info-strip"
                    style={{ borderColor: `${ACCENT}22`, color: `${ACCENT}99` }}
                >
                    <FolderOpen size={12} />
                    {activeTab === "projects"
                        ? "Opta Projects live in ~/Documents/Opta Workspace/Projects/"
                        : "Sessions grouped by workspace — managed by the daemon"}
                </div>
            </div>
        </div>
    );
}
