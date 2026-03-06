import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Save } from "lucide-react";
import type { DaemonConnectionOptions } from "../../types";
import { daemonClient } from "../../lib/daemonClient";

interface Props {
    connection: DaemonConnectionOptions;
}

type PermLevel = "allow" | "ask" | "deny";

const PERMISSION_GROUPS: Array<{ label: string; keys: string[] }> = [
    { label: "File Operations", keys: ["read_file", "list_dir", "search_files", "find_files", "edit_file", "write_file", "multi_edit", "delete_file"] },
    { label: "Shell", keys: ["run_command"] },
    { label: "User Interaction", keys: ["ask_user"] },
    { label: "Project Docs", keys: ["read_project_docs"] },
    { label: "Web", keys: ["web_search", "web_fetch"] },
    { label: "Research", keys: ["research_query", "research_health"] },
    { label: "Browser Automation", keys: ["browser_open", "browser_navigate", "browser_click", "browser_type", "browser_snapshot", "browser_screenshot", "browser_close"] },
    { label: "Learning & Memory", keys: ["learning_log", "learning_summary", "learning_retrieve", "save_memory"] },
    { label: "Background Processes", keys: ["bg_start", "bg_status", "bg_output", "bg_kill"] },
    { label: "LSP", keys: ["lsp_definition", "lsp_references", "lsp_hover", "lsp_symbols", "lsp_document_symbols", "lsp_diagnostics", "lsp_code_actions", "lsp_rename"] },
    { label: "Sub-agents", keys: ["spawn_agent", "delegate_task"] },
    { label: "Git", keys: ["git_status", "git_diff", "git_log", "git_commit"] },
];

const DEFAULT_PERMS: Record<string, PermLevel> = {
    read_file: "allow", list_dir: "allow", search_files: "allow", find_files: "allow",
    edit_file: "ask", write_file: "ask", multi_edit: "ask", delete_file: "ask",
    run_command: "ask", ask_user: "allow", read_project_docs: "allow",
    web_search: "allow", web_fetch: "allow", research_query: "allow", research_health: "allow",
    browser_open: "ask", browser_navigate: "allow", browser_click: "ask",
    browser_type: "ask", browser_snapshot: "allow", browser_screenshot: "allow", browser_close: "allow",
    learning_log: "allow", learning_summary: "allow", learning_retrieve: "allow", save_memory: "allow",
    bg_start: "ask", bg_status: "allow", bg_output: "allow", bg_kill: "ask",
    lsp_definition: "allow", lsp_references: "allow", lsp_hover: "allow",
    lsp_symbols: "allow", lsp_document_symbols: "allow", lsp_diagnostics: "allow",
    lsp_code_actions: "allow", lsp_rename: "ask",
    spawn_agent: "ask", delegate_task: "ask",
    git_status: "allow", git_diff: "allow", git_log: "allow", git_commit: "ask",
};

export function SettingsTabPermissions({ connection }: Props) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [perms, setPerms] = useState<Record<string, PermLevel>>({ ...DEFAULT_PERMS });

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            try {
                const raw = await daemonClient.configGet(connection, "permissions").catch(() => ({}));
                if (cancelled) return;
                if (raw && typeof raw === "object") {
                    setPerms({ ...DEFAULT_PERMS, ...raw as Record<string, PermLevel> });
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        void load();
        return () => { cancelled = true; };
    }, [connection]);

    const setPerm = (key: string, level: PermLevel) => {
        setPerms(prev => ({ ...prev, [key]: level }));
    };

    const save = useCallback(async () => {
        setSaving(true);
        await daemonClient.configSet(connection, "permissions", perms).catch(() => { });
        setSaving(false);
    }, [connection, perms]);

    const resetAll = () => setPerms({ ...DEFAULT_PERMS });

    if (loading) return <div className="settings-tab-loading">Loading permissions...</div>;

    return (
        <motion.div key="permissions" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <div className="st-header">
                <div>
                    <p className="st-desc">Control which tools require approval before execution. Changes are saved globally for this Opta profile.</p>
                </div>
                <div className="st-header-actions">
                    <button type="button" className="st-reset-btn" onClick={resetAll}>Reset Defaults</button>
                    <button type="button" className="st-save-btn" onClick={save} disabled={saving}>
                        <Save size={14} /> {saving ? "Saving..." : "Save All"}
                    </button>
                </div>
            </div>

            {PERMISSION_GROUPS.map(group => (
                <fieldset key={group.label} className="st-fieldset">
                    <legend className="st-legend">{group.label}</legend>
                    <div className="st-perm-grid">
                        {group.keys.map(key => (
                            <div key={key} className="st-perm-row">
                                <span className="st-perm-name">{key}</span>
                                <div className="st-perm-pills">
                                    {(["allow", "ask", "deny"] as PermLevel[]).map(level => (
                                        <button
                                            key={level}
                                            type="button"
                                            className={`st-perm-pill st-perm-${level} ${perms[key] === level ? "st-perm-active" : ""}`}
                                            onClick={() => setPerm(key, level)}
                                        >
                                            {level}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </fieldset>
            ))}
        </motion.div>
    );
}
