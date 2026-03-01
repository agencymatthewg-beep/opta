import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, RefreshCw, Square } from "lucide-react";
import type { DaemonConnectionOptions } from "../types";
import { probeDaemonConnection } from "../lib/connectionProbe";
import { getTauriInvoke, isNativeDesktop } from "../lib/runtime";

interface DaemonState {
  pid?: number;
  startedAt?: string;
  status?: string;
  endpoint?: string;
  diagnostic?: string;
  mode?: "native" | "lan" | "wan" | "offline";
}

interface DaemonPanelProps {
  connection: DaemonConnectionOptions;
  connectionState: "connected" | "connecting" | "disconnected";
}

export function DaemonPanel({ connection, connectionState }: DaemonPanelProps) {
  const nativeDesktop = isNativeDesktop();
  const [state, setState] = useState<DaemonState | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const noticeTimerRef = useRef<number | null>(null);

  const showNotice = useCallback((msg: string) => {
    if (noticeTimerRef.current !== null)
      window.clearTimeout(noticeTimerRef.current);
    setActionNotice(msg);
    noticeTimerRef.current = window.setTimeout(
      () => setActionNotice(null),
      3000,
    );
  }, []);

  const fetchStatus = useCallback(async () => {
    const invoke = getTauriInvoke();
    if (!invoke) {
      const probe = await probeDaemonConnection(connection).catch(() => null);
      if (!probe) {
        setState({
          status: "disconnected",
          mode: "offline",
          diagnostic: "UNKNOWN",
        });
        return;
      }
      setState({
        status:
          probe.diagnostic === "OK" || probe.diagnostic === "UNAUTHORIZED"
            ? "reachable"
            : "disconnected",
        endpoint: probe.url,
        diagnostic: probe.diagnostic,
        mode: probe.type,
      });
      return;
    }
    try {
      const raw = (await invoke("daemon_action", {
        action: "status",
      })) as string;
      const parsed = JSON.parse(raw) as DaemonState;
      setState({ ...parsed, mode: "native" });
    } catch {
      setState(null);
    }
  }, [connection]);

  const handleAction = useCallback(
    async (action: "restart" | "stop") => {
      if (action === "stop") {
        const confirmed = window.confirm(
          "Stop the Opta daemon? Active sessions will be interrupted.",
        );
        if (!confirmed) return;
      }
      if (!nativeDesktop) {
        showNotice("Daemon control actions require native desktop mode");
        return;
      }
      const invoke = getTauriInvoke();
      if (!invoke) {
        showNotice("Tauri bridge not available");
        return;
      }
      setLoading(true);
      try {
        const result = (await invoke("daemon_action", { action })) as string;
        showNotice(`Daemon ${result}`);
        // Wait briefly for state file to update, then refresh
        window.setTimeout(() => void fetchStatus(), 1500);
      } catch (err) {
        showNotice(
          `Action failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      } finally {
        setLoading(false);
      }
    },
    [fetchStatus, nativeDesktop, showNotice],
  );

  useEffect(() => {
    void fetchStatus();
    const timer = window.setInterval(() => void fetchStatus(), 8000);
    return () => {
      window.clearInterval(timer);
      if (noticeTimerRef.current !== null)
        window.clearTimeout(noticeTimerRef.current);
    };
  }, [fetchStatus]);

  const uptime = state?.startedAt
    ? formatUptime(new Date(state.startedAt))
    : null;

  return (
    <div className="daemon-panel glass-subtle">
      <header className="daemon-panel-header">
        <Activity size={14} aria-hidden="true" />
        <h3>Daemon</h3>
        <span
          className={`daemon-status-dot daemon-status-${connectionState}`}
        />
      </header>

      <dl className="daemon-panel-stats">
        <div>
          <dt>Status</dt>
          <dd className={`state-${connectionState}`}>
            {state?.status || connectionState}
          </dd>
        </div>
        {!nativeDesktop && state?.mode ? (
          <div>
            <dt>Mode</dt>
            <dd>{state.mode}</dd>
          </div>
        ) : null}
        {state?.pid != null && (
          <div>
            <dt>PID</dt>
            <dd>{state.pid}</dd>
          </div>
        )}
        {uptime != null && (
          <div>
            <dt>Uptime</dt>
            <dd>{uptime}</dd>
          </div>
        )}
        {!nativeDesktop && state?.diagnostic ? (
          <div>
            <dt>Probe</dt>
            <dd>{state.diagnostic.toLowerCase()}</dd>
          </div>
        ) : null}
      </dl>

      {actionNotice ? (
        <div className="daemon-panel-notice" role="status" aria-live="polite">
          {actionNotice}
        </div>
      ) : null}

      {nativeDesktop ? (
        <div className="daemon-panel-actions">
          <button
            type="button"
            className="daemon-action-btn"
            onClick={() => void handleAction("restart")}
            disabled={loading}
            title="Restart daemon"
          >
            <RefreshCw
              size={12}
              className={loading ? "spin" : ""}
              aria-hidden="true"
            />
            Restart
          </button>
          <button
            type="button"
            className="daemon-action-btn daemon-action-stop"
            onClick={() => void handleAction("stop")}
            disabled={loading}
            title="Stop daemon"
          >
            <Square size={12} aria-hidden="true" />
            Stop
          </button>
        </div>
      ) : (
        <p className="text-secondary" style={{ marginTop: 12, fontSize: 12 }}>
          Web runtime: daemon control actions are unavailable; HTTP/WS client mode is active.
        </p>
      )}
    </div>
  );
}

function formatUptime(startedAt: Date): string {
  const ms = Date.now() - startedAt.getTime();
  if (ms < 0) return "just now";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}
