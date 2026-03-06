import { useState, useEffect, type CSSProperties } from "react";
import { ExternalLink, Globe, Monitor, RefreshCw, X } from "lucide-react";
import type { BrowserLiveHostStatus, BrowserLiveHostSlot } from "../lib/browserLiveHostClient";

const OPTA_LOGO_LETTERS = ["O", "P", "T", "A"] as const;

const ACCENT = "#22d3ee";

interface LocalhostEntry {
  port: number;
  name: string;
  tag: string;
}

const LOCALHOST_REGISTRY: LocalhostEntry[] = [
  { port: 5173, name: "Opta Code Desktop", tag: "Desktop" },
  { port: 9999, name: "Opta Daemon", tag: "Daemon" },
  { port: 1234, name: "Opta LMX", tag: "LMX" },
  { port: 3000, name: "Opta Home", tag: "Web" },
  { port: 3001, name: "Opta Init", tag: "Web" },
  { port: 3003, name: "Opta LMX Dashboard", tag: "Web" },
  { port: 3006, name: "Opta Help", tag: "Web" },
  { port: 3007, name: "Opta Learn", tag: "Web" },
];

type PortStatus = "idle" | "checking" | "up" | "down";

interface BrowserStudioProps {
  isFullscreen: boolean;
  onClose: () => void;
  liveHostStatus?: BrowserLiveHostStatus | null;
  onRefreshLiveHost?: () => Promise<void>;
}

export function BrowserStudio({
  isFullscreen,
  onClose,
  liveHostStatus,
  onRefreshLiveHost,
}: BrowserStudioProps) {
  const [portStatuses, setPortStatuses] = useState<Record<number, PortStatus>>({});
  const [checking, setChecking] = useState(false);
  const [refreshingHost, setRefreshingHost] = useState(false);

  const checkPort = async (port: number): Promise<PortStatus> => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1200);
      await fetch(`http://localhost:${port}`, {
        signal: controller.signal,
        mode: "no-cors",
      });
      clearTimeout(timeout);
      return "up";
    } catch {
      return "down";
    }
  };

  const pingAll = async () => {
    setChecking(true);
    const next: Record<number, PortStatus> = {};
    LOCALHOST_REGISTRY.forEach((e) => {
      next[e.port] = "checking";
    });
    setPortStatuses(next);
    const results = await Promise.all(
      LOCALHOST_REGISTRY.map(async (e) => ({
        port: e.port,
        status: await checkPort(e.port),
      })),
    );
    const final: Record<number, PortStatus> = {};
    results.forEach(({ port, status }) => {
      final[port] = status;
    });
    setPortStatuses(final);
    setChecking(false);
  };

  const pingOne = async (port: number) => {
    setPortStatuses((p) => ({ ...p, [port]: "checking" }));
    const status = await checkPort(port);
    setPortStatuses((p) => ({ ...p, [port]: status }));
  };

  const handleRefreshHost = async () => {
    if (!onRefreshLiveHost) return;
    setRefreshingHost(true);
    await onRefreshLiveHost();
    setRefreshingHost(false);
  };

  // Auto-ping on open
  useEffect(() => {
    void pingAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shellClass = [
    "opta-studio-shell",
    "opta-studio-shell--embedded",
    isFullscreen ? "opta-studio-shell--fullscreen" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const hostRunning = liveHostStatus?.running ?? false;
  const activeSessions = liveHostStatus?.slots.filter((s) => s.sessionId) ?? [];

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
                key={`browser-logo-${letter}`}
                className={`opta-studio-logo-letter opta-studio-logo-letter-${index + 1} opta-studio-logo-letter--browser`}
              >
                {letter}
              </span>
            ))}
          </div>
          <div
            className="opta-studio-logo-settings"
            style={{ color: ACCENT, textShadow: `0 0 18px ${ACCENT}88` }}
          >
            OPTA BROWSER
          </div>
          <div className="opta-studio-logo-sub">Localhost &amp; Web Sessions</div>
        </div>
      </div>

      {/* Top Chrome */}
      <div className="opta-studio-top-chrome">
        <div className="opta-studio-top-chrome-left">
          <div className="opta-studio-shortcut-panel">
            <span className="opta-studio-shortcut-title">Browser Studio</span>
            <span className="opta-studio-shortcut-copy">
              Ctrl+B toggle · Shift+Space fullscreen · Esc close
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
                <Globe
                  size={13}
                  style={{ display: "inline", verticalAlign: "middle", marginRight: 5 }}
                />
                Localhost &amp; Browser Management
              </span>
            </div>
          </div>
        </div>
        <div className="opta-studio-top-chrome-right">
          <button
            type="button"
            onClick={onClose}
            className="opta-studio-close-btn"
            aria-label="Close Browser Studio"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="feature-studio-content">
        {/* Live Browser Sessions */}
        <div className="feature-studio-section-header">
          <h3 className="feature-studio-section-title" style={{ color: ACCENT }}>
            <Monitor
              size={14}
              style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }}
            />
            Browser Sessions
          </h3>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              className={`feature-studio-status-dot ${hostRunning ? "feature-studio-status-dot--up" : "feature-studio-status-dot--down"}`}
            />
            <span style={{ fontSize: 11, color: hostRunning ? ACCENT : "#71717a" }}>
              {hostRunning
                ? `Live · ${liveHostStatus!.openSessionCount} session${liveHostStatus!.openSessionCount !== 1 ? "s" : ""}`
                : "Host offline"}
            </span>
            {onRefreshLiveHost && (
              <button
                type="button"
                className="feature-studio-action-secondary"
                onClick={() => void handleRefreshHost()}
                disabled={refreshingHost}
                style={{ color: ACCENT, borderColor: `${ACCENT}44` }}
              >
                <RefreshCw
                  size={13}
                  className={refreshingHost ? "feature-studio-spin" : ""}
                />
                Refresh
              </button>
            )}
          </div>
        </div>

        {activeSessions.length > 0 ? (
          <div className="feature-studio-app-list">
            {activeSessions.map((slot: BrowserLiveHostSlot) => (
              <div
                key={slot.slotIndex}
                className="feature-studio-app-row"
                style={{ borderLeft: `3px solid ${ACCENT}55` }}
              >
                <div
                  className="feature-studio-app-icon"
                  style={{
                    background: `${ACCENT}18`,
                    color: ACCENT,
                    fontSize: 11,
                    fontFamily: "JetBrains Mono, monospace",
                    fontWeight: 700,
                  }}
                >
                  :{slot.port}
                </div>
                <div className="feature-studio-app-info">
                  <div
                    className="feature-studio-app-name"
                    style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 12 }}
                  >
                    {slot.currentUrl ?? (
                      <span style={{ color: "#52525b" }}>No URL</span>
                    )}
                  </div>
                  {slot.sessionId && (
                    <div className="feature-studio-app-desc">
                      Session:{" "}
                      <code style={{ color: `${ACCENT}aa`, fontSize: 10 }}>
                        {slot.sessionId.slice(0, 12)}…
                      </code>
                    </div>
                  )}
                </div>
                <div className="feature-studio-app-actions">
                  <button
                    type="button"
                    className="feature-studio-action-mini"
                    onClick={() =>
                      window.open(`http://127.0.0.1:${slot.port}`, "_blank")
                    }
                    title="Open in browser"
                    style={{ color: ACCENT, borderColor: `${ACCENT}44` }}
                  >
                    <ExternalLink size={11} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div
            className="feature-studio-empty-state"
            style={{ padding: "0.75rem 0 1rem" }}
          >
            <Globe size={22} style={{ opacity: 0.25, color: ACCENT }} />
            <p style={{ fontSize: 12, margin: "0.25rem 0 0" }}>
              {hostRunning
                ? "No active browser sessions"
                : "Browser host not running"}
            </p>
          </div>
        )}

        {/* Safe ports strip from live host */}
        {hostRunning && liveHostStatus && liveHostStatus.safePorts.length > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "0.4rem 0.75rem",
              background: `${ACCENT}08`,
              border: `1px solid ${ACCENT}22`,
              borderRadius: 8,
              marginTop: "0.5rem",
              flexWrap: "wrap",
            }}
          >
            <span style={{ color: `${ACCENT}88`, fontSize: 11, marginRight: 4 }}>
              Safe ports:
            </span>
            {liveHostStatus.safePorts.slice(0, 12).map((port) => (
              <span
                key={port}
                style={{
                  fontSize: 10,
                  fontFamily: "JetBrains Mono, monospace",
                  color: ACCENT,
                  border: `1px solid ${ACCENT}44`,
                  borderRadius: 4,
                  padding: "1px 5px",
                }}
              >
                {port}
              </span>
            ))}
          </div>
        )}

        {/* Localhost Registry */}
        <div
          className="feature-studio-section-header"
          style={{ marginTop: "1.25rem" }}
        >
          <h3 className="feature-studio-section-title" style={{ color: ACCENT }}>
            Localhost Registry
          </h3>
          <button
            type="button"
            className="feature-studio-action-secondary"
            onClick={() => void pingAll()}
            disabled={checking}
            style={{ color: ACCENT, borderColor: `${ACCENT}44` }}
          >
            <RefreshCw size={13} className={checking ? "feature-studio-spin" : ""} />
            {checking ? "Checking…" : "Ping All"}
          </button>
        </div>

        <div className="feature-studio-port-grid">
          {LOCALHOST_REGISTRY.map(({ port, name, tag }) => {
            const status = portStatuses[port] ?? "idle";
            return (
              <div
                key={port}
                className={`feature-studio-port-card feature-studio-port-card--${status}`}
                style={{
                  "--card-accent": ACCENT,
                  borderColor: status === "up" ? `${ACCENT}66` : undefined,
                } as CSSProperties}
              >
                <div className="feature-studio-port-top">
                  <span
                    className="feature-studio-port-number"
                    style={{ color: status === "up" ? ACCENT : undefined }}
                  >
                    :{port}
                  </span>
                  <span className="feature-studio-port-tag">{tag}</span>
                </div>
                <div className="feature-studio-port-name">{name}</div>
                <div
                  className={`feature-studio-port-status feature-studio-port-status--${status}`}
                >
                  {status === "up" && (
                    <>
                      <span className="feature-studio-status-dot feature-studio-status-dot--up" />
                      Live
                    </>
                  )}
                  {status === "down" && (
                    <>
                      <span className="feature-studio-status-dot feature-studio-status-dot--down" />
                      Down
                    </>
                  )}
                  {status === "checking" && (
                    <>
                      <span className="feature-studio-status-dot feature-studio-status-dot--checking" />
                      Checking
                    </>
                  )}
                  {status === "idle" && (
                    <>
                      <span className="feature-studio-status-dot" />
                      Unchecked
                    </>
                  )}
                </div>
                <div className="feature-studio-port-actions">
                  <button
                    type="button"
                    className="feature-studio-action-mini"
                    onClick={() => void pingOne(port)}
                    disabled={status === "checking"}
                    title="Ping port"
                  >
                    Ping
                  </button>
                  <button
                    type="button"
                    className="feature-studio-action-mini"
                    onClick={() =>
                      window.open(`http://localhost:${port}`, "_blank")
                    }
                    title="Open in browser"
                  >
                    <ExternalLink size={11} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div
          className="feature-studio-info-strip"
          style={{ borderColor: `${ACCENT}22`, color: `${ACCENT}99` }}
        >
          <Globe size={12} />
          Browser automation via Playwright MCP · Sessions managed by Opta Daemon
        </div>
      </div>
    </div>
  );
}
