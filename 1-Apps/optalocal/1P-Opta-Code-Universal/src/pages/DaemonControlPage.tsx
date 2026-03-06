// TODO: UI design — Gemini will implement the visual design for this page.
// Backend is fully wired: status, logs, start, stop, install, uninstall, poll.
import { useEffect } from "react";
import { useDaemonControl } from "../hooks/useDaemonControl";
import type { DaemonConnectionOptions } from "../types";

interface DaemonControlPageProps {
  connection: DaemonConnectionOptions;
  /** Render live log tail alongside status (default: false) */
  showLogs?: boolean;
}

export function DaemonControlPage({ connection, showLogs = false }: DaemonControlPageProps) {
  const {
    status,
    logs,
    loading,
    actionRunning,
    logsLoading,
    error,
    refreshStatus,
    refreshLogs,
    start,
    stop,
    install,
    uninstall,
    startPolling,
    stopPolling,
  } = useDaemonControl(connection);

  // Activate polling while the page is mounted
  useEffect(() => {
    startPolling();
    return stopPolling;
  }, [startPolling, stopPolling]);

  // Load logs on demand when showLogs is true
  useEffect(() => {
    if (showLogs) void refreshLogs(200);
  }, [showLogs, refreshLogs]);

  const isRunning = status?.state === "running";
  const isStopped = status?.state === "stopped";

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <div className="st-status-banner st-status-banner-error">{error}</div>
      )}

      {/* Status card */}
      <div className="st-fieldset flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Status indicator — design placeholder */}
            <span
              data-state={status?.state ?? "unknown"}
              className="w-2.5 h-2.5 rounded-full bg-zinc-600"
              aria-label={`Daemon state: ${status?.state ?? "unknown"}`}
            />
            <span className="text-sm font-semibold text-gray-50 capitalize">
              {status?.state ?? (loading ? "Checking…" : "Unknown")}
            </span>
          </div>
          <button
            type="button"
            onClick={() => void refreshStatus()}
            disabled={loading || actionRunning}
            className="opta-studio-btn-secondary text-xs"
          >
            Refresh
          </button>
        </div>

        {status && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-zinc-400">
            {status.version && (
              <>
                <dt>Version</dt>
                <dd className="text-gray-50 font-mono">{status.version}</dd>
              </>
            )}
            {status.port && (
              <>
                <dt>Port</dt>
                <dd className="text-gray-50 font-mono">{status.port}</dd>
              </>
            )}
            {status.pid && (
              <>
                <dt>PID</dt>
                <dd className="text-gray-50 font-mono">{status.pid}</dd>
              </>
            )}
            {status.uptime !== undefined && (
              <>
                <dt>Uptime</dt>
                <dd className="text-gray-50">{Math.floor(status.uptime / 60)}m {status.uptime % 60}s</dd>
              </>
            )}
            {status.installedAs && (
              <>
                <dt>Service</dt>
                <dd className="text-gray-50 capitalize">{status.installedAs}</dd>
              </>
            )}
            {status.logPath && (
              <>
                <dt>Log path</dt>
                <dd className="text-gray-50 font-mono text-[10px] truncate">{status.logPath}</dd>
              </>
            )}
          </dl>
        )}
      </div>

      {/* Lifecycle controls */}
      <div className="flex flex-col gap-3">
        <p className="st-label">Lifecycle</p>
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => void start()}
            disabled={actionRunning || isRunning}
            className="opta-studio-btn"
          >
            {actionRunning ? "Working…" : "Start"}
          </button>
          <button
            type="button"
            onClick={() => void stop()}
            disabled={actionRunning || isStopped}
            className="opta-studio-btn-secondary text-red-400 border-red-500/30"
          >
            Stop
          </button>
        </div>
      </div>

      {/* Service manager controls */}
      <div className="flex flex-col gap-3">
        <p className="st-label">System service</p>
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => void install()}
            disabled={actionRunning || Boolean(status?.installedAs)}
            className="opta-studio-btn-secondary"
          >
            Install as service
          </button>
          <button
            type="button"
            onClick={() => void uninstall()}
            disabled={actionRunning || !status?.installedAs}
            className="opta-studio-btn-secondary text-red-400 border-red-500/30"
          >
            Uninstall service
          </button>
        </div>
        {status?.installedAs && (
          <p className="text-xs text-zinc-500">
            Currently managed by <strong className="text-zinc-300">{status.installedAs}</strong>
          </p>
        )}
        {!status?.installedAs && status && (
          <p className="text-xs text-zinc-500">
            Not installed as a system service. Install to auto-start on login.
          </p>
        )}
      </div>

      {/* Log tail (optional) */}
      {showLogs && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="st-label">Log tail</p>
            <button
              type="button"
              onClick={() => void refreshLogs(200)}
              disabled={logsLoading}
              className="opta-studio-btn-secondary text-xs"
            >
              {logsLoading ? "Loading…" : "Refresh logs"}
            </button>
          </div>
          <div className="font-mono text-[11px] text-zinc-400 bg-black/30 rounded-lg p-3 max-h-56 overflow-y-auto border border-[var(--opta-border)]">
            {logs.length === 0 ? (
              <span className="text-zinc-600">No log entries.</span>
            ) : (
              logs.map((entry, i) => (
                <div
                  key={i}
                  className={`leading-5 ${
                    entry.level === "error"
                      ? "text-red-400"
                      : entry.level === "warn"
                        ? "text-amber-400"
                        : "text-zinc-400"
                  }`}
                >
                  {entry.timestamp && (
                    <span className="text-zinc-600 mr-2">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </span>
                  )}
                  {entry.message}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
