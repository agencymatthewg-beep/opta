interface SettingsViewProps {
    onOpenSettingsTab: (tab: string) => void;
    designMode?: string;
}

import {
    Network,
    Cpu,
    Terminal,
    Activity,
    Layers,
    Globe,
    Server,
    Shield,
    ShieldAlert,
    BookOpen,
    Wrench,
    Brain,
    FileCheck,
    Webhook,
    Key,
    LayoutDashboard
} from "lucide-react";

interface SettingsViewProps {
    onOpenSettingsTab: (tab: string) => void;
    designMode?: string;
}

const SETTINGS_CATEGORIES = [
    { id: "connection", title: "Connection", desc: "Daemon remote host logic and HTTP/WS sockets", icon: Network },
    { id: "lmx", title: "LMX Internal Service", desc: "Local model execution and host management", icon: Cpu },
    { id: "daemon", title: "Opta Daemon", desc: "Background process and worker pool", icon: Terminal },
    { id: "autonomy", title: "Autonomy", desc: "Execution modes and limits", icon: Activity },
    { id: "genui", title: "Generative UI", desc: "Generative artifacts and rendering logic", icon: Layers },
    { id: "model-provider", title: "Model Providers", desc: "Cloud fallbacks (Anthropic, OpenAI)", icon: Globe },
    { id: "fleet", title: "Fleet Control", desc: "Remote agent coordination", icon: Server },
    { id: "permissions", title: "Permissions", desc: "Tool approval gates and overrides", icon: Shield },
    { id: "safety", title: "Safety", desc: "Content guardrails and validation", icon: ShieldAlert },
    { id: "browser", title: "Browser MCP", desc: "Playwright automation and evaluation", icon: LayoutDashboard },
    { id: "research", title: "Research", desc: "Search MCP plugins and aggregators", icon: BookOpen },
    { id: "tools-agents", title: "Tools & Agents", desc: "Built-in tool constraints", icon: Wrench },
    { id: "learning", title: "Learning", desc: "Context compaction and semantic memory", icon: Brain },
    { id: "policy", title: "Global Policy", desc: "Overarching bounds and autonomy", icon: FileCheck },
    { id: "mcp", title: "MCP Servers", desc: "Third-party resource connections", icon: Webhook },
    { id: "secrets", title: "Secrets Vault", desc: "Credential and key management", icon: Key },
];

export function SettingsView({ onOpenSettingsTab, designMode = "0" }: SettingsViewProps) {
    return (
        <div className={`settings-view dm-setting-layout-${designMode}`}>
            <div className="settings-view-header">
                <div className="settings-view-title">
                    <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                    >
                        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                        <circle cx="12" cy="12" r="3" />
                    </svg>
                    Opta Settings
                </div>
                <span className="settings-view-hint">ESC or Ctrl+S to close</span>
            </div>

            <div className={`settings-view-grid dm-grid-${designMode}`}>
                {SETTINGS_CATEGORIES.map((cat) => (
                    <button
                        key={cat.id}
                        className="settings-view-card"
                        onClick={() => onOpenSettingsTab(cat.id)}
                        type="button"
                    >
                        <div className="settings-card-icon-wrap">
                            <cat.icon strokeWidth={1.5} />
                        </div>
                        <div className="settings-card-title">{cat.title}</div>
                        <div className="settings-card-desc">{cat.desc}</div>
                    </button>
                ))}
            </div>
        </div>
    );
}
