import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, RefreshCw, Search } from "lucide-react";
import { getTauriInvoke, isNativeDesktop } from "../lib/runtime";

interface LogEntry {
  raw: string;
  timestamp?: string;
  level?: string;
  message?: string;
}

function parseLine(line: string): LogEntry {
  try {
    const parsed = JSON.parse(line) as Record<string, unknown>;
    return {
      raw: line,
      timestamp:
        typeof parsed.timestamp === "string"
          ? parsed.timestamp
          : typeof parsed.ts === "string"
            ? parsed.ts
            : typeof parsed.time === "string"
              ? parsed.time
              : undefined,
      level:
        typeof parsed.level === "string"
          ? parsed.level.toLowerCase()
          : undefined,
      message:
        typeof parsed.message === "string"
          ? parsed.message
          : typeof parsed.msg === "string"
            ? parsed.msg
            : line,
    };
  } catch {
    return { raw: line, message: line };
  }
}

export function DaemonLogsPage() {
  const nativeDesktop = isNativeDesktop();
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const pollRef = useRef<number | null>(null);
  const logEndRef = useRef<HTMLDivElement | null>(null);

  const refresh = useCallback(async () => {
    const invoke = getTauriInvoke();
    if (!invoke) {
      setError("Tauri bridge not available — logs require the desktop app");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const lines = (await invoke("read_daemon_logs", {
        lastN: 200,
      })) as string[];
      setEntries(lines.map(parseLine));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    if (!nativeDesktop) return;
    pollRef.current = window.setInterval(() => void refresh(), 2000);
    return () => {
      if (pollRef.current !== null) window.clearInterval(pollRef.current);
    };
  }, [nativeDesktop, refresh]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries]);

  const lowerFilter = filter.toLowerCase();
  const filtered = lowerFilter
    ? entries.filter(
        (e) =>
          e.message?.toLowerCase().includes(lowerFilter) ||
          e.level?.toLowerCase().includes(lowerFilter) ||
          e.timestamp?.toLowerCase().includes(lowerFilter),
      )
    : entries;

  return (
    <div className="daemon-logs-page">
      <header className="logs-page-header">
        <div>
          <h2>Daemon Logs</h2>
          <p>
            Streaming daemon log entries.{" "}
            <span className="logs-count">
              {filtered.length} line{filtered.length !== 1 ? "s" : ""}
            </span>
          </p>
        </div>
        <button
          type="button"
          className="refresh-btn"
          onClick={() => void refresh()}
          disabled={loading}
          aria-label="Refresh daemon logs"
        >
          <RefreshCw
            size={13}
            className={loading ? "spin" : ""}
            aria-hidden="true"
          />
          {loading ? "Loading..." : "Refresh"}
        </button>
      </header>

      <div className="logs-filter-bar">
        <Search size={13} aria-hidden="true" />
        <input
          className="logs-filter-input"
          type="text"
          placeholder="Filter logs by message, level, or timestamp..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label="Filter logs"
        />
      </div>

      {error ? (
        <div className="logs-error" role="alert">
          <strong>Failed to load logs:</strong> {error}
          <button type="button" onClick={() => void refresh()}>
            Retry
          </button>
        </div>
      ) : null}

      <div className="logs-table-container">
        {filtered.length === 0 && !loading ? (
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
              {filtered.map((entry, idx) => (
                <tr key={idx} className={`log-row log-level-${entry.level || "unknown"}`}>
                  <td className="log-timestamp">
                    {entry.timestamp
                      ? formatTimestamp(entry.timestamp)
                      : "--"}
                  </td>
                  <td>
                    <span
                      className={`log-level-badge log-badge-${entry.level || "unknown"}`}
                    >
                      {entry.level || "log"}
                    </span>
                  </td>
                  <td className="log-message">{entry.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div ref={logEndRef} />
      </div>
    </div>
  );
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
