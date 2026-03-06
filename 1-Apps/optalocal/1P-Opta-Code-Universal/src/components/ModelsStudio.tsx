import { useState, useEffect, type CSSProperties } from "react";
import { Activity, Cpu, RefreshCw, X, Zap } from "lucide-react";

const OPTA_LOGO_LETTERS = ["O", "P", "T", "A"] as const;

const ACCENT = "#a78bfa";

interface ModelEntry {
  id: string;
  name: string;
  params: string;
  status: "loaded" | "available" | "unknown";
  tokensPerSec?: number;
}

interface LmxStatus {
  online: boolean;
  host: string;
  models: ModelEntry[];
  vramUsedGb?: number;
  vramTotalGb?: number;
}

const DEFAULT_STATUS: LmxStatus = {
  online: false,
  host: "192.168.188.11:1234",
  models: [],
};

interface ModelsStudioProps {
  isFullscreen: boolean;
  onClose: () => void;
}

export function ModelsStudio({ isFullscreen, onClose }: ModelsStudioProps) {
  const [lmxStatus, setLmxStatus] = useState<LmxStatus>(DEFAULT_STATUS);
  const [loading, setLoading] = useState(false);
  const [routing, setRouting] = useState<"lmx" | "cloud">("lmx");

  const fetchLmxStatus = async () => {
    setLoading(true);
    try {
      // Try the LMX healthz endpoint via daemon proxy or direct
      const res = await fetch("http://localhost:9999/lmx/health", {
        signal: AbortSignal.timeout(2500),
      });
      if (res.ok) {
        const data = (await res.json()) as Record<string, unknown>;
        const models = Array.isArray(data.models)
          ? (data.models as Array<Record<string, unknown>>).map((m) => ({
              id: String(m.id ?? m.name ?? "unknown"),
              name: String(m.name ?? m.id ?? "Unknown Model"),
              params: String(m.params ?? ""),
              status: m.loaded ? ("loaded" as const) : ("available" as const),
              tokensPerSec: typeof m.tokens_per_sec === "number" ? m.tokens_per_sec : undefined,
            }))
          : [];
        setLmxStatus({
          online: true,
          host: "192.168.188.11:1234",
          models,
          vramUsedGb: typeof data.vram_used_gb === "number" ? data.vram_used_gb : undefined,
          vramTotalGb: typeof data.vram_total_gb === "number" ? data.vram_total_gb : undefined,
        });
      } else {
        setLmxStatus({ ...DEFAULT_STATUS });
      }
    } catch {
      setLmxStatus({ ...DEFAULT_STATUS });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchLmxStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shellClass = [
    "opta-studio-shell",
    "opta-studio-shell--embedded",
    isFullscreen ? "opta-studio-shell--fullscreen" : "",
  ]
    .filter(Boolean)
    .join(" ");

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
                key={`models-logo-${letter}`}
                className={`opta-studio-logo-letter opta-studio-logo-letter-${index + 1} opta-studio-logo-letter--models`}
              >
                {letter}
              </span>
            ))}
          </div>
          <div
            className="opta-studio-logo-settings"
            style={{ color: ACCENT, textShadow: `0 0 18px ${ACCENT}88` }}
          >
            OPTA MODELS
          </div>
          <div className="opta-studio-logo-sub">LMX Inference Engine</div>
        </div>
      </div>

      {/* Top Chrome */}
      <div className="opta-studio-top-chrome">
        <div className="opta-studio-top-chrome-left">
          <div className="opta-studio-shortcut-panel">
            <span className="opta-studio-shortcut-title">Models Studio</span>
            <span className="opta-studio-shortcut-copy">
              Ctrl+M toggle · Shift+Space fullscreen · Esc close
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
                <Cpu size={13} style={{ display: "inline", verticalAlign: "middle", marginRight: 5 }} />
                LMX &amp; Model Management
              </span>
            </div>
          </div>
        </div>
        <div className="opta-studio-top-chrome-right">
          <button
            type="button"
            onClick={onClose}
            className="opta-studio-close-btn"
            aria-label="Close Models Studio"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="feature-studio-content">
        {/* Routing row */}
        <div className="feature-studio-section-header">
          <h3 className="feature-studio-section-title" style={{ color: ACCENT }}>
            Inference Routing
          </h3>
          <button
            type="button"
            className="feature-studio-action-secondary"
            onClick={() => void fetchLmxStatus()}
            disabled={loading}
            style={{ color: ACCENT, borderColor: `${ACCENT}44` }}
          >
            <RefreshCw size={13} className={loading ? "feature-studio-spin" : ""} />
            {loading ? "Checking…" : "Refresh"}
          </button>
        </div>

        <div className="feature-studio-routing-bar">
          <button
            type="button"
            className={`feature-studio-routing-pill ${routing === "lmx" ? "is-active" : ""}`}
            style={routing === "lmx" ? { "--pill-accent": ACCENT, borderColor: `${ACCENT}66`, color: ACCENT } as CSSProperties : {}}
            onClick={() => setRouting("lmx")}
          >
            <Zap size={12} />
            LMX Primary
            <span
              className={`feature-studio-routing-dot ${lmxStatus.online ? "feature-studio-routing-dot--up" : "feature-studio-routing-dot--down"}`}
            />
          </button>
          <button
            type="button"
            className={`feature-studio-routing-pill ${routing === "cloud" ? "is-active" : ""}`}
            style={routing === "cloud" ? { "--pill-accent": "#60a5fa", borderColor: "#60a5fa66", color: "#60a5fa" } as CSSProperties : {}}
            onClick={() => setRouting("cloud")}
          >
            <Activity size={12} />
            Cloud Fallback
            <span className="feature-studio-routing-dot feature-studio-routing-dot--up" />
          </button>
        </div>

        {/* LMX status bar */}
        <div
          className={`feature-studio-status-bar ${lmxStatus.online ? "feature-studio-status-bar--online" : "feature-studio-status-bar--offline"}`}
          style={{ borderColor: lmxStatus.online ? `${ACCENT}44` : "#ef444444" }}
        >
          <span
            className={`feature-studio-status-dot ${lmxStatus.online ? "feature-studio-status-dot--up" : "feature-studio-status-dot--down"}`}
          />
          <span>{lmxStatus.online ? "LMX Online" : "LMX Offline"}</span>
          <span className="feature-studio-status-host">{lmxStatus.host}</span>
          {lmxStatus.vramUsedGb !== undefined && lmxStatus.vramTotalGb !== undefined && (
            <span className="feature-studio-status-vram">
              VRAM {lmxStatus.vramUsedGb.toFixed(1)}GB / {lmxStatus.vramTotalGb}GB
            </span>
          )}
        </div>

        {/* Model list */}
        <div className="feature-studio-section-header" style={{ marginTop: "1rem" }}>
          <h3 className="feature-studio-section-title" style={{ color: ACCENT }}>
            Models
          </h3>
        </div>

        {lmxStatus.online && lmxStatus.models.length > 0 ? (
          <div className="feature-studio-model-list">
            {lmxStatus.models.map((model) => (
              <div
                key={model.id}
                className={`feature-studio-model-row feature-studio-model-row--${model.status}`}
                style={
                  model.status === "loaded"
                    ? { borderLeft: `3px solid ${ACCENT}` }
                    : {}
                }
              >
                <div className="feature-studio-model-info">
                  <span className="feature-studio-model-name">{model.name}</span>
                  {model.params && (
                    <span className="feature-studio-model-params">{model.params}</span>
                  )}
                </div>
                <div className="feature-studio-model-right">
                  {model.tokensPerSec !== undefined && (
                    <span className="feature-studio-model-speed">
                      {model.tokensPerSec.toFixed(1)} tok/s
                    </span>
                  )}
                  <span
                    className={`feature-studio-model-badge feature-studio-model-badge--${model.status}`}
                  >
                    {model.status === "loaded" ? "Loaded" : "Available"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="feature-studio-empty-state">
            <Cpu size={32} style={{ opacity: 0.3, color: ACCENT }} />
            <p>
              {lmxStatus.online
                ? "No models reported"
                : "LMX unreachable — ensure Opta LMX is running on Mono512"}
            </p>
            <p className="feature-studio-empty-hint">
              Configure in Settings Studio → LMX &amp; Models
            </p>
          </div>
        )}

        <div
          className="feature-studio-info-strip"
          style={{ borderColor: `${ACCENT}22`, color: `${ACCENT}99` }}
        >
          <Cpu size={12} />
          Opta LMX on Mono512 (192.168.188.11) · MLX Apple Silicon inference · OpenAI-compatible
        </div>
      </div>
    </div>
  );
}
