import { useEffect } from "react";
import { FileText, RefreshCw, Search } from "lucide-react";
import { useDaemonControl } from "../hooks/useDaemonControl";
import type { DaemonConnectionOptions } from "../types";

interface DaemonLogsPageProps {
  connection: DaemonConnectionOptions;
}

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return ts;
  }
}

export function DaemonLogsPage({ connection }: DaemonLogsPageProps) {
  const { logs, logsLoading, error, refreshLogs, startPolling, stopPolling } =
    useDaemonControl(connection);

  useEffect(() => {
    void refreshLogs(200);
    startPolling();
    return () => stopPolling();
  }, [refreshLogs, startPolling, stopPolling]);

  return (
    <div className="daemon-logs-page">
      <header className="logs-page-header">
        <div>
          <h2>Daemon Logs</h2>
          <p>
            Streaming daemon log entries.{" "}
            <span className="logs-count">
              {logs.length} line{logs.length !== 1 ? "s" : ""}
            </span>
          </p>
        </div>
        <button
          type="button"
          className="refresh-btn"
          onClick={() => void refreshLogs(200)}
          disabled={logsLoading}
          aria-label="Refresh daemon logs"
        >
          <RefreshCw
            size={13}
            className={logsLoading ? "spin" : ""}
            aria-hidden="true"
          />
          {logsLoading ? "Loading..." : "Refresh"}
        </button>
      </header>

      {error ? (
        <div className="logs-error" role="alert">
          <strong>Failed to load logs:</strong> {error}
          <button type="button" onClick={() => void refreshLogs(200)}>
            Retry
          </button>
        </div>
      ) : null}

      <div className="logs-table-container">
        {logs.length === 0 && !logsLoading ? (
          <div className="logs-empty">
            <FileText size={24} aria-hidden="true" />
            <p>No log entries found.</p>
          </div>
        ) : (
          <table className="logs-table" aria-label="Daemon log entries">
            <thead>
              <tr>
                <th>Time</th>
                <th>Level</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((entry, idx) => (
                <tr
                  // eslint-disable-next-line react/no-array-index-key
                  key={idx}
                  className={`log-row log-level-${entry.level ?? "unknown"}`}
                >
                  <td className="log-timestamp">
                    {entry.timestamp ? formatTimestamp(entry.timestamp) : "--"}
                  </td>
                  <td>
                    <span
                      className={`log-level-badge log-badge-${entry.level ?? "unknown"}`}
                    >
                      {entry.level ?? "log"}
                    </span>
                  </td>
                  <td className="log-message">{entry.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
