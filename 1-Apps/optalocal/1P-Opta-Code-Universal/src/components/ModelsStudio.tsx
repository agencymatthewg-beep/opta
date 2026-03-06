import { useState, type CSSProperties } from "react";
import {
  Activity,
  Cpu,
  Download,
  Loader2,
  RefreshCw,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { useModels } from "../hooks/useModels";
import type { DaemonConnectionOptions } from "../types";

const OPTA_LOGO_LETTERS = ["O", "P", "T", "A"] as const;

const ACCENT = "#a78bfa";

interface ModelsStudioProps {
  isFullscreen: boolean;
  onClose: () => void;
  connection: DaemonConnectionOptions | null;
}

export function ModelsStudio({
  isFullscreen,
  onClose,
  connection,
}: ModelsStudioProps) {
  const {
    loadedModels,
    availableModels,
    memory,
    lmxReachable,
    lmxTarget,
    loading,
    error,
    loadModel,
    unloadModel,
    deleteModel,
    refreshLmx,
  } = useModels(connection);

  const [actionId, setActionId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"loaded" | "available">("loaded");

  const doLoad = async (modelId: string) => {
    setActionId(`load:${modelId}`);
    await loadModel(modelId);
    setActionId(null);
  };

  const doUnload = async (modelId: string) => {
    setActionId(`unload:${modelId}`);
    await unloadModel(modelId);
    setActionId(null);
  };

  const doDelete = async (modelId: string) => {
    setActionId(`delete:${modelId}`);
    await deleteModel(modelId);
    setActionId(null);
  };

  const lmxHost = lmxTarget
    ? `${lmxTarget.host}:${lmxTarget.port}`
    : "192.168.188.11:1234";

  const vramUsed = memory?.used_gb ?? 0;
  const vramTotal = memory?.total_unified_memory_gb ?? 0;
  const vramPercent =
    vramTotal > 0 ? Math.round((vramUsed / vramTotal) * 100) : 0;

  const formatModelId = (id: string) => {
    const parts = id.split("/");
    return parts[parts.length - 1] ?? id;
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes) return "";
    if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)}GB`;
    if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(0)}MB`;
    return `${bytes}B`;
  };

  const vramColor =
    vramPercent > 80 ? "#ef4444" : vramPercent > 60 ? "#f59e0b" : ACCENT;

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
            MODELS
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
                <Cpu
                  size={13}
                  style={{ display: "inline", verticalAlign: "middle", marginRight: 5 }}
                />
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
        {/* Inference status header */}
        <div className="feature-studio-section-header">
          <h3 className="feature-studio-section-title" style={{ color: ACCENT }}>
            Inference Status
          </h3>
          <button
            type="button"
            className="feature-studio-action-secondary"
            onClick={() => void refreshLmx()}
            disabled={loading}
            style={{ color: ACCENT, borderColor: `${ACCENT}44` }}
          >
            <RefreshCw size={13} className={loading ? "feature-studio-spin" : ""} />
            {loading ? "Checking…" : "Refresh"}
          </button>
        </div>

        {/* LMX status bar */}
        <div
          className={`feature-studio-status-bar ${lmxReachable ? "feature-studio-status-bar--online" : "feature-studio-status-bar--offline"}`}
          style={{ borderColor: lmxReachable ? `${ACCENT}44` : "#ef444444" }}
        >
          <span
            className={`feature-studio-status-dot ${lmxReachable ? "feature-studio-status-dot--up" : "feature-studio-status-dot--down"}`}
          />
          <span>{lmxReachable ? "LMX Online" : "LMX Offline"}</span>
          <span className="feature-studio-status-host">{lmxHost}</span>
          {memory && (
            <span className="feature-studio-status-vram">
              {vramUsed.toFixed(1)}GB / {vramTotal}GB RAM
            </span>
          )}
        </div>

        {/* Memory usage bar */}
        {memory && vramTotal > 0 && (
          <div
            style={{
              margin: "0.5rem 0 0.75rem",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 10,
                color: "#71717a",
              }}
            >
              <span>Unified Memory</span>
              <span style={{ color: vramColor }}>{vramPercent}% used</span>
            </div>
            <div
              style={{
                height: 4,
                background: "#27272a",
                borderRadius: 2,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${vramPercent}%`,
                  background: vramColor,
                  borderRadius: 2,
                  transition: "width 0.4s ease",
                  boxShadow: `0 0 6px ${vramColor}66`,
                }}
              />
            </div>
          </div>
        )}

        {error && !lmxReachable && (
          <div
            style={{ fontSize: 11, color: "#ef4444aa", padding: "0.25rem 0 0.5rem" }}
          >
            {error}
          </div>
        )}

        {/* Tab bar: Loaded vs Available */}
        <div className="feature-studio-tab-bar" style={{ marginTop: "0.75rem" }}>
          <button
            type="button"
            className={`feature-studio-tab ${activeTab === "loaded" ? "is-active" : ""}`}
            style={
              activeTab === "loaded"
                ? ({
                    "--tab-accent": ACCENT,
                    color: ACCENT,
                    borderColor: `${ACCENT}55`,
                  } as CSSProperties)
                : {}
            }
            onClick={() => setActiveTab("loaded")}
          >
            <Zap size={13} />
            Loaded ({loadedModels.length})
          </button>
          <button
            type="button"
            className={`feature-studio-tab ${activeTab === "available" ? "is-active" : ""}`}
            style={
              activeTab === "available"
                ? ({
                    "--tab-accent": ACCENT,
                    color: ACCENT,
                    borderColor: `${ACCENT}55`,
                  } as CSSProperties)
                : {}
            }
            onClick={() => setActiveTab("available")}
          >
            <Download size={13} />
            Available ({availableModels.length})
          </button>
        </div>

        {/* Loaded models */}
        {activeTab === "loaded" && (
          <>
            {loadedModels.length > 0 ? (
              <div className="feature-studio-model-list">
                {loadedModels.map((model) => {
                  const isUnloading =
                    actionId === `unload:${model.model_id}`;
                  return (
                    <div
                      key={model.model_id}
                      className="feature-studio-model-row feature-studio-model-row--loaded"
                      style={{ borderLeft: `3px solid ${ACCENT}` }}
                    >
                      <div className="feature-studio-model-info">
                        <span className="feature-studio-model-name">
                          {formatModelId(model.model_id)}
                        </span>
                        {model.memory_bytes != null && (
                          <span className="feature-studio-model-params">
                            {formatBytes(model.memory_bytes)}
                          </span>
                        )}
                        {model.context_length != null && (
                          <span className="feature-studio-model-params">
                            {(model.context_length / 1000).toFixed(0)}k ctx
                          </span>
                        )}
                        {model.request_count != null && model.request_count > 0 && (
                          <span className="feature-studio-model-params">
                            {model.request_count} req
                          </span>
                        )}
                      </div>
                      <div className="feature-studio-model-right">
                        <span className="feature-studio-model-badge feature-studio-model-badge--loaded">
                          Loaded
                        </span>
                        <button
                          type="button"
                          className="feature-studio-action-mini"
                          onClick={() => void doUnload(model.model_id)}
                          disabled={!!actionId}
                          style={{ color: "#f59e0b", borderColor: "#f59e0b44" }}
                          title="Unload from memory"
                        >
                          {isUnloading ? (
                            <Loader2 size={11} className="feature-studio-spin" />
                          ) : (
                            "Unload"
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="feature-studio-empty-state">
                <Cpu size={28} style={{ opacity: 0.25, color: ACCENT }} />
                <p>{lmxReachable ? "No models loaded" : "LMX offline"}</p>
                {lmxReachable && (
                  <p className="feature-studio-empty-hint">
                    Switch to Available to load a model
                  </p>
                )}
              </div>
            )}
          </>
        )}

        {/* Available models */}
        {activeTab === "available" && (
          <>
            {availableModels.length > 0 ? (
              <div className="feature-studio-model-list">
                {availableModels.map((model) => {
                  const isLoading = actionId === `load:${model.model_id}`;
                  const isDeleting = actionId === `delete:${model.model_id}`;
                  return (
                    <div
                      key={model.model_id}
                      className="feature-studio-model-row feature-studio-model-row--available"
                    >
                      <div className="feature-studio-model-info">
                        <span className="feature-studio-model-name">
                          {formatModelId(model.model_id)}
                        </span>
                        {model.size_bytes != null && (
                          <span className="feature-studio-model-params">
                            {formatBytes(model.size_bytes)}
                          </span>
                        )}
                        {model.quantization && (
                          <span className="feature-studio-model-params">
                            {model.quantization}
                          </span>
                        )}
                      </div>
                      <div className="feature-studio-model-right">
                        <span className="feature-studio-model-badge feature-studio-model-badge--available">
                          Available
                        </span>
                        <button
                          type="button"
                          className="feature-studio-action-mini"
                          onClick={() => void doLoad(model.model_id)}
                          disabled={!!actionId}
                          style={{ color: ACCENT, borderColor: `${ACCENT}44` }}
                          title="Load into memory"
                        >
                          {isLoading ? (
                            <Loader2 size={11} className="feature-studio-spin" />
                          ) : (
                            "Load"
                          )}
                        </button>
                        <button
                          type="button"
                          className="feature-studio-action-mini feature-studio-action-mini--danger"
                          onClick={() => void doDelete(model.model_id)}
                          disabled={!!actionId}
                          title="Delete from disk"
                        >
                          {isDeleting ? (
                            <Loader2 size={11} className="feature-studio-spin" />
                          ) : (
                            <Trash2 size={11} />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="feature-studio-empty-state">
                <Activity size={28} style={{ opacity: 0.25, color: ACCENT }} />
                <p>
                  {lmxReachable
                    ? "No local models found"
                    : "LMX offline — cannot list models"}
                </p>
                <p className="feature-studio-empty-hint">
                  Models are stored on Mono512
                </p>
              </div>
            )}
          </>
        )}

        <div
          className="feature-studio-info-strip"
          style={{ borderColor: `${ACCENT}22`, color: `${ACCENT}99` }}
        >
          <Cpu size={12} />
          Opta LMX on Mono512 (192.168.188.11) · MLX Apple Silicon inference ·
          OpenAI-compatible
        </div>
      </div>
    </div>
  );
}
