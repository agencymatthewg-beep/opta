interface SettingsViewProps {
    onOpenSettingsTab: (tab: string) => void;
}

const SETTINGS_CATEGORIES = [
    {
        id: "general",
        title: "General",
        desc: "App preferences, file behavior, and updates",
        colorClass: "sv-general",
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8l-6 6v12a2 2 0 0 0 2 2z" />
                <line x1="14" y1="2" x2="14" y2="22" />
                <line x1="4" y1="12" x2="14" y2="12" />
            </svg>
        ),
    },
    {
        id: "intelligence",
        title: "Intelligence",
        desc: "LMX Engine bindings, default models, and context",
        colorClass: "sv-intel",
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4" />
                <path d="M12 8h.01" />
            </svg>
        ),
    },
    {
        id: "connection",
        title: "Connection",
        desc: "Daemon remote host logic and HTTP/WS sockets",
        colorClass: "sv-conn",
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
                <path d="M12 12v9" />
                <path d="M8 17l4 4 4-4" />
            </svg>
        ),
    },
    {
        id: "interface",
        title: "Interface",
        desc: "Widget grids, typography, and visual bounds",
        colorClass: "sv-ui",
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.29 7 12 12 20.71 7" />
                <line x1="12" y1="22" x2="12" y2="12" />
            </svg>
        ),
    },
];

export function SettingsView({ onOpenSettingsTab }: SettingsViewProps) {
    return (
        <div className="settings-view">
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

            <div className="settings-view-grid">
                {SETTINGS_CATEGORIES.map((cat) => (
                    <button
                        key={cat.id}
                        className={`settings-view-card ${cat.colorClass}`}
                        onClick={() => onOpenSettingsTab(cat.id)}
                        type="button"
                    >
                        {cat.icon}
                        <div>
                            <div className="settings-view-card-title">{cat.title}</div>
                            <div className="settings-view-card-desc">{cat.desc}</div>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}
