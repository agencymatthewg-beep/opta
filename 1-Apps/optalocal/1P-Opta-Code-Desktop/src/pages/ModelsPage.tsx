import { useModels } from "../hooks/useModels";
import type { DaemonConnectionOptions } from "../types";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatGb(gb: number): string {
  return `${gb.toFixed(1)} GB`;
}

function memoryPercent(used: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((used / total) * 100));
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
    refreshLmx,
  } = useModels(connection);

  const usedPercent = memory
    ? memoryPercent(memory.used_gb, memory.total_unified_memory_gb)
    : 0;

  return (
    <section className="models-page">
      {/* LMX Status Card */}
      <div className="models-status-card glass">
        <div className="status-header">
          <h2>LMX Inference Server</h2>
          <span
            className={`status-badge ${lmxReachable ? "online" : "offline"}`}
          >
            {lmxReachable ? "Online" : "Offline"}
          </span>
          <button
            type="button"
            className="refresh-btn"
            onClick={() => void refreshLmx()}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
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
              <dt>Loaded Models</dt>
              <dd>{loadedModels.length}</dd>
            </div>
          </dl>
        ) : null}
        {error ? <p className="models-error">{error}</p> : null}
      </div>

      {/* Memory Bar */}
      {memory ? (
        <div className="models-memory glass-subtle">
          <h3>Unified Memory</h3>
          <div className="memory-bar-container">
            <div
              className="memory-bar-fill"
              style={{ width: `${usedPercent}%` }}
              title={`${formatGb(memory.used_gb)} / ${formatGb(memory.total_unified_memory_gb)}`}
            />
          </div>
          <p className="memory-label">
            {formatGb(memory.used_gb)} /{" "}
            {formatGb(memory.total_unified_memory_gb)} ({usedPercent}%)
          </p>
          {Object.keys(memory.models).length > 0 ? (
            <ul className="memory-breakdown">
              {Object.entries(memory.models).map(([modelId, info]) => (
                <li key={modelId}>
                  <span className="model-name">{modelId}</span>
                  <span className="model-mem">{formatGb(info.memory_gb)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {/* Loaded Models Table */}
      <div className="models-loaded glass-subtle">
        <h3>Loaded Models</h3>
        {loadedModels.length === 0 ? (
          <p className="models-empty">No models loaded</p>
        ) : (
          <table className="models-table">
            <thead>
              <tr>
                <th>Model</th>
                <th>Memory</th>
                <th>Context</th>
                <th>Requests</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loadedModels.map((model) => (
                <tr key={model.model_id}>
                  <td className="model-id">{model.model_id}</td>
                  <td>
                    {model.memory_bytes ? formatBytes(model.memory_bytes) : "—"}
                  </td>
                  <td>{model.context_length?.toLocaleString() ?? "—"}</td>
                  <td>{model.request_count ?? "—"}</td>
                  <td>
                    <button
                      type="button"
                      className="action-btn unload"
                      onClick={() => void unloadModel(model.model_id)}
                    >
                      Unload
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Available Models List */}
      <div className="models-available glass-subtle">
        <h3>Available on Disk</h3>
        {availableModels.length === 0 ? (
          <p className="models-empty">No models on disk</p>
        ) : (
          <table className="models-table">
            <thead>
              <tr>
                <th>Model</th>
                <th>Size</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {availableModels.map((model) => (
                <tr key={model.model_id}>
                  <td className="model-id">{model.model_id}</td>
                  <td>
                    {model.size_bytes ? formatBytes(model.size_bytes) : "—"}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="action-btn load"
                      onClick={() => void loadModel(model.model_id)}
                    >
                      Load
                    </button>
                    <button
                      type="button"
                      className="action-btn delete"
                      onClick={() => void deleteModel(model.model_id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
