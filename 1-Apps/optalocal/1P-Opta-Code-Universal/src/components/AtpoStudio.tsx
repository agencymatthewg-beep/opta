import { useState, type CSSProperties } from "react";
import { AppWindow, Package, RefreshCw, Trash2, X } from "lucide-react";

const OPTA_LOGO_LETTERS = ["O", "P", "T", "A"] as const;

const ACCENT = "#f472b6";

interface AppEntry {
  id: string;
  name: string;
  version: string;
  category: "core" | "tool" | "integration";
  updateAvailable: boolean;
  description: string;
}

// Seeded app catalog reflecting the actual optalocal ecosystem
const INSTALLED_APPS: AppEntry[] = [
  {
    id: "opta-browser",
    name: "Opta Browser",
    version: "1.0.0",
    category: "core",
    updateAvailable: false,
    description: "Playwright-backed browser automation and localhost management",
  },
  {
    id: "opta-lmx",
    name: "Opta LMX",
    version: "0.8.1",
    category: "core",
    updateAvailable: false,
    description: "MLX local inference engine for Apple Silicon",
  },
  {
    id: "opta-daemon",
    name: "Opta Daemon",
    version: "1.2.4",
    category: "core",
    updateAvailable: false,
    description: "Background orchestration daemon with HTTP/WS API",
  },
  {
    id: "opta-mcp",
    name: "MCP Integrations",
    version: "0.5.0",
    category: "integration",
    updateAvailable: true,
    description: "Model Context Protocol server registry and client",
  },
];

const CATALOG_APPS: AppEntry[] = [
  {
    id: "opta-research",
    name: "Opta Research",
    version: "0.3.0",
    category: "tool",
    updateAvailable: false,
    description: "Multi-provider web search (Brave, Exa, Tavily)",
  },
  {
    id: "opta-lsp",
    name: "Opta LSP",
    version: "0.2.0",
    category: "tool",
    updateAvailable: false,
    description: "Language server protocol client and lifecycle manager",
  },
];

interface AtpoStudioProps {
  isFullscreen: boolean;
  onClose: () => void;
}

type ActiveTab = "installed" | "catalog";

const CATEGORY_COLORS: Record<AppEntry["category"], string> = {
  core: "#22d3ee",
  tool: "#a78bfa",
  integration: "#f472b6",
};

export function AtpoStudio({ isFullscreen, onClose }: AtpoStudioProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("installed");
  const [removing, setRemoving] = useState<string | null>(null);

  const handleRemove = (appId: string) => {
    // In a real implementation this would call the daemon API
    setRemoving(appId);
    setTimeout(() => setRemoving(null), 1200);
  };

  const shellClass = [
    "opta-studio-shell",
    "opta-studio-shell--embedded",
    isFullscreen ? "opta-studio-shell--fullscreen" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const displayedApps = activeTab === "installed" ? INSTALLED_APPS : CATALOG_APPS;

  return (
    <div
      className={shellClass}
      style={{ "--studio-feature-accent": ACCENT } as CSSProperties}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Opta Text Logo */}
      <div
        className={`opta-studio-logo-reserve is-docked ${isFullscreen ? "is-active" : ""}`}
        aria-hidden="true"
      >
        <div className="opta-studio-logo-stack">
          <div className="opta-studio-logo-word" aria-label="OPTA">
            {OPTA_LOGO_LETTERS.map((letter, index) => (
              <span
                key={`atpo-logo-${letter}`}
                className={`opta-studio-logo-letter opta-studio-logo-letter-${index + 1} opta-studio-logo-letter--atpo`}
              >
                {letter}
              </span>
            ))}
          </div>
          <div
            className="opta-studio-logo-settings"
            style={{ color: ACCENT, textShadow: `0 0 18px ${ACCENT}88` }}
          >
            OPTA ATPO
          </div>
          <div className="opta-studio-logo-sub">App &amp; Module Management</div>
        </div>
      </div>

      {/* Top Chrome */}
      <div className="opta-studio-top-chrome">
        <div className="opta-studio-top-chrome-left">
          <div className="opta-studio-shortcut-panel">
            <span className="opta-studio-shortcut-title">Atpo Studio</span>
            <span className="opta-studio-shortcut-copy">
              Ctrl+A toggle · Shift+Space fullscreen · Esc close
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
                <AppWindow size={13} style={{ display: "inline", verticalAlign: "middle", marginRight: 5 }} />
                App &amp; Module Management
              </span>
            </div>
          </div>
        </div>
        <div className="opta-studio-top-chrome-right">
          <button
            type="button"
            onClick={onClose}
            className="opta-studio-close-btn"
            aria-label="Close Atpo Studio"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="feature-studio-content">
        {/* Tab bar */}
        <div className="feature-studio-tab-bar">
          <button
            type="button"
            className={`feature-studio-tab ${activeTab === "installed" ? "is-active" : ""}`}
            style={
              activeTab === "installed"
                ? ({ "--tab-accent": ACCENT, color: ACCENT, borderColor: `${ACCENT}55` } as CSSProperties)
                : {}
            }
            onClick={() => setActiveTab("installed")}
          >
            <Package size={13} />
            Installed ({INSTALLED_APPS.length})
          </button>
          <button
            type="button"
            className={`feature-studio-tab ${activeTab === "catalog" ? "is-active" : ""}`}
            style={
              activeTab === "catalog"
                ? ({ "--tab-accent": ACCENT, color: ACCENT, borderColor: `${ACCENT}55` } as CSSProperties)
                : {}
            }
            onClick={() => setActiveTab("catalog")}
          >
            <AppWindow size={13} />
            Catalog ({CATALOG_APPS.length})
          </button>

          <div className="feature-studio-tab-spacer" />

          <button
            type="button"
            className="feature-studio-action-secondary"
            style={{ color: ACCENT, borderColor: `${ACCENT}44` }}
            onClick={() => {/* check updates */}}
          >
            <RefreshCw size={13} />
            Check Updates
          </button>
        </div>

        {/* App list */}
        <div className="feature-studio-app-list">
          {displayedApps.map((app) => {
            const catColor = CATEGORY_COLORS[app.category];
            const isRemoving = removing === app.id;
            return (
              <div
                key={app.id}
                className={`feature-studio-app-row ${isRemoving ? "feature-studio-app-row--removing" : ""}`}
                style={{ borderLeft: `3px solid ${catColor}55` }}
              >
                <div className="feature-studio-app-icon" style={{ background: `${catColor}18`, color: catColor }}>
                  <Package size={16} />
                </div>
                <div className="feature-studio-app-info">
                  <div className="feature-studio-app-name">
                    {app.name}
                    <span className="feature-studio-app-version">v{app.version}</span>
                    <span
                      className="feature-studio-app-category"
                      style={{ color: catColor, borderColor: `${catColor}44` }}
                    >
                      {app.category}
                    </span>
                  </div>
                  <div className="feature-studio-app-desc">{app.description}</div>
                </div>
                <div className="feature-studio-app-actions">
                  {app.updateAvailable && (
                    <button
                      type="button"
                      className="feature-studio-action-mini feature-studio-action-mini--update"
                      style={{ color: "#10b981", borderColor: "#10b98144" }}
                    >
                      Update
                    </button>
                  )}
                  {activeTab === "installed" ? (
                    <button
                      type="button"
                      className="feature-studio-action-mini feature-studio-action-mini--danger"
                      onClick={() => handleRemove(app.id)}
                      disabled={isRemoving}
                    >
                      <Trash2 size={11} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="feature-studio-action-mini"
                      style={{ color: ACCENT, borderColor: `${ACCENT}44` }}
                    >
                      Install
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div
          className="feature-studio-info-strip"
          style={{ borderColor: `${ACCENT}22`, color: `${ACCENT}99` }}
        >
          <AppWindow size={12} />
          Atpo manages Opta module lifecycle · install, update, and remove capability modules
        </div>
      </div>
    </div>
  );
}
