import { useCallback, useRef, useState } from "react";
import {
  Activity,
  Box,
  Brain,
  Download,
  HardDrive,
  RefreshCw,
  Trash2,
  Zap,
} from "lucide-react";
import { useModels } from "../hooks/useModels";
import type { DaemonConnectionOptions } from "../types";

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function fmtGb(gb: number): string {
  return `${gb.toFixed(1)} GB`;
}

function memPct(used: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((used / total) * 100));
}

function fmtCtx(ctx?: number): string {
  if (!ctx) return "—";
  if (ctx >= 1_000_000) return `${(ctx / 1_000_000).toFixed(1)}M`;
  if (ctx >= 1_000) return `${(ctx / 1_000).toFixed(0)}K`;
  return String(ctx);
}

interface ModelsPageProps {
  connection: DaemonConnectionOptions | null;
}

export function ModelsPage({ connection }: ModelsPageProps) {
  const {
    lmxStatus,
    loadedModels,
    availableModels,
    memory,
    lmxReachable,
    loading,
    error,
    loadModel,
    unloadModel,
    deleteModel,
    downloadModel,
    refreshLmx,
  } = useModels(connection);

  const [downloadRepo, setDownloadRepo] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const downloadNoticeTimerRef = useRef<number | null>(null);

  const usedPct = memory ? memPct(memory.used_gb, memory.total_unified_memory_gb) : 0;
  const memBarColor =
    usedPct > 85 ? "var(--opta-danger)" : usedPct > 65 ? "var(--opta-warning)" : "var(--opta-primary)";

  const triggerDownload = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    const repo = downloadRepo.trim();
    if (!repo) return;
    setDownloading(true);
    setDownloadNotice(null);
    const id = await downloadModel(repo);
    setDownloading(false);
    if (id) {
      setDownloadNotice(`Download queued · ID: ${id}`);
      setDownloadRepo("");
    } else {
      setDownloadNotice("Download failed — check daemon logs");
    }
    if (downloadNoticeTimerRef.current !== null) window.clearTimeout(downloadNoticeTimerRef.current);
    downloadNoticeTimerRef.current = window.setTimeout(() => setDownloadNotice(null), 5000);
  }, [downloadModel, downloadRepo]);

  const doLoad = useCallback(async (modelId: string) => {
    setPendingAction(modelId);
    await loadModel(modelId);
    setPendingAction(null);
  }, [loadModel]);

  const doUnload = useCallback(async (modelId: string) => {
    setPendingAction(modelId);
    await unloadModel(modelId);
    setPendingAction(null);
  }, [unloadModel]);

  const doDelete = useCallback(async (modelId: string) => {
    setPendingAction(modelId);
    await deleteModel(modelId);
    setPendingAction(null);
  }, [deleteModel]);

  return (
    <section className="models-page">
      {/* Server Status */}
      <div className="models-status-card glass">
        <div className="status-header">
          <Brain size={16} className="models-icon" aria-hidden="true" />
          <h2>LMX Inference Server</h2>
          <span className={`status-badge ${lmxReachable ? "online" : "offline"}`}>
            {lmxReachable ? "Online" : "Offline"}
          </span>
          <button
            type="button"
            className="refresh-btn"
            onClick={() => void refreshLmx()}
            disabled={loading}
          >
            <RefreshCw size={12} className={loading ? "spin" : ""} aria-hidden="true" />
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {lmxReachable && lmxStatus ? (
          <dl className="status-meta">
            {lmxStatus.version ? (
              <div>
                <dt>Version</dt>
                <dd>{lmxStatus.version}</dd>
              </div>
            ) : null}
            {lmxStatus.uptime_seconds !== undefined ? (
              <div>
                <dt>Uptime</dt>
                <dd>{Math.round(lmxStatus.uptime_seconds / 60)}m</dd>
              </div>
            ) : null}
            <div>
              <dt>Loaded</dt>
              <dd>{loadedModels.length} model{loadedModels.length !== 1 ? "s" : ""}</dd>
            </div>
            {memory ? (
              <div>
                <dt>Memory</dt>
                <dd>{fmtGb(memory.used_gb)} / {fmtGb(memory.total_unified_memory_gb)}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}

        {error ? <p className="models-error">{error}</p> : null}
      </div>

      {/* Unified Memory Bar */}
      {memory ? (
        <div className="models-memory glass-subtle">
          <div className="memory-header">
            <HardDrive size={13} aria-hidden="true" />
            <h3>Unified Memory</h3>
            <span className="memory-pct" style={{ color: memBarColor }}>
              {usedPct}%
            </span>
          </div>
          <div className="memory-bar-container">
            <div
              className="memory-bar-fill"
              style={{ width: `${usedPct}%`, background: memBarColor }}
              title={`${fmtGb(memory.used_gb)} / ${fmtGb(memory.total_unified_memory_gb)}`}
            />
          </div>
          <p className="memory-label">
            {fmtGb(memory.used_gb)} used of {fmtGb(memory.total_unified_memory_gb)} total
          </p>
          {Object.keys(memory.models).length > 0 ? (
            <div className="memory-breakdown">
              {Object.entries(memory.models).map(([modelId, info]) => {
                const pct = memPct(info.memory_gb, memory.total_unified_memory_gb);
                return (
                  <div key={modelId} className="memory-model-row">
                    <span className="memory-model-bar-wrap">
                      <span
                        className="memory-model-bar"
                        style={{ width: `${pct}%` }}
                      />
                    </span>
                    <span className="memory-model-name">{modelId}</span>
                    <span className="memory-model-size">{fmtGb(info.memory_gb)}</span>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Loaded Models */}
      <div className="models-loaded glass-subtle">
        <div className="models-section-header">
          <Activity size={13} aria-hidden="true" />
          <h3>Loaded Models</h3>
          {loadedModels.length > 0 ? (
            <span className="models-count">{loadedModels.length}</span>
          ) : null}
        </div>
        {loadedModels.length === 0 ? (
          <p className="models-empty">No models loaded. Load one from disk below.</p>
        ) : (
          <div className="model-cards">
            {loadedModels.map((model) => (
              <div key={model.model_id} className="model-card model-card-loaded">
                <div className="model-card-name">{model.model_id}</div>
                <div className="model-card-meta">
                  {model.memory_bytes ? (
                    <span title="Memory usage">
                      <HardDrive size={11} aria-hidden="true" />
                      {fmtBytes(model.memory_bytes)}
                    </span>
                  ) : null}
                  {model.context_length ? (
                    <span title="Context window">
                      <Box size={11} aria-hidden="true" />
                      {fmtCtx(model.context_length)} ctx
                    </span>
                  ) : null}
                  {model.request_count ? (
                    <span title="Requests served">
                      <Zap size={11} aria-hidden="true" />
                      {model.request_count.toLocaleString()} reqs
                    </span>
                  ) : null}
                </div>
                <div className="model-card-actions">
                  <button
                    type="button"
                    className="action-btn unload"
                    onClick={() => void doUnload(model.model_id)}
                    disabled={pendingAction === model.model_id}
                  >
                    {pendingAction === model.model_id ? "…" : "Unload"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Available on Disk */}
      {availableModels.length > 0 ? (
        <div className="models-available glass-subtle">
          <div className="models-section-header">
            <HardDrive size={13} aria-hidden="true" />
            <h3>On Disk</h3>
            <span className="models-count">{availableModels.length}</span>
          </div>
          <div className="model-cards">
            {availableModels.map((model) => (
              <div key={model.model_id} className="model-card model-card-disk">
                <div className="model-card-name">{model.model_id}</div>
                <div className="model-card-meta">
                  {model.size_bytes ? (
                    <span title="File size">
                      <HardDrive size={11} aria-hidden="true" />
                      {fmtBytes(model.size_bytes)}
                    </span>
                  ) : null}
                  {model.quantization ? (
                    <span className="model-quant-tag">{model.quantization}</span>
                  ) : null}
                </div>
                <div className="model-card-actions">
                  <button
                    type="button"
                    className="action-btn load"
                    onClick={() => void doLoad(model.model_id)}
                    disabled={pendingAction === model.model_id}
                  >
                    {pendingAction === model.model_id ? "…" : "Load"}
                  </button>
                  <button
                    type="button"
                    className="action-btn delete"
                    onClick={() => void doDelete(model.model_id)}
                    disabled={pendingAction === model.model_id}
                  >
                    <Trash2 size={11} aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Download from HuggingFace */}
      <div className="models-download glass-subtle">
        <div className="models-section-header">
          <Download size={13} aria-hidden="true" />
          <h3>Download from HuggingFace</h3>
        </div>
        <p className="download-hint">
          Enter a HuggingFace repo ID (e.g. <code>mlx-community/Qwen2.5-7B-Instruct-4bit</code>) to queue a download via the daemon.
        </p>
        <form className="download-form" onSubmit={(e) => void triggerDownload(e)}>
          <input
            type="text"
            className="download-input"
            placeholder="mlx-community/…"
            value={downloadRepo}
            onChange={(e) => setDownloadRepo(e.target.value)}
            aria-label="HuggingFace repo ID"
            spellCheck={false}
          />
          <button
            type="submit"
            className="download-btn"
            disabled={downloading || !downloadRepo.trim()}
          >
            <Download size={12} aria-hidden="true" />
            {downloading ? "Queuing…" : "Download"}
          </button>
        </form>
        {downloadNotice ? (
          <p className={`download-notice ${downloadNotice.includes("failed") ? "download-error" : "download-ok"}`}>
            {downloadNotice}
          </p>
        ) : null}
      </div>
    </section>
  );
}
