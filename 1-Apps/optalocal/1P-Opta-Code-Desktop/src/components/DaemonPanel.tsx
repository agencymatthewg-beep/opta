import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, RefreshCw, Square } from "lucide-react";

type TauriInvoke = (
  command: string,
  args?: Record<string, unknown>,
) => Promise<unknown>;

interface TauriBridge {
  core?: { invoke?: TauriInvoke };
}

function getTauriInvoke(): TauriInvoke | null {
  const bridge = (globalThis as { __TAURI__?: TauriBridge }).__TAURI__;
  const fn_ = bridge?.core?.invoke;
  return typeof fn_ === "function" ? fn_ : null;
}

interface DaemonState {
  pid?: number;
  startedAt?: string;
  status?: string;
}

interface DaemonPanelProps {
  connectionState: "connected" | "connecting" | "disconnected";
}

export function DaemonPanel({ connectionState }: DaemonPanelProps) {
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
    if (!invoke) return;
    try {
      const raw = (await invoke("daemon_action", {
        action: "status",
      })) as string;
      const parsed = JSON.parse(raw) as DaemonState;
      setState(parsed);
    } catch {
      setState(null);
    }
  }, []);

  const handleAction = useCallback(
    async (action: "restart" | "stop") => {
      if (action === "stop") {
        const confirmed = window.confirm(
          "Stop the Opta daemon? Active sessions will be interrupted.",
        );
        if (!confirmed) return;
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
    [fetchStatus, showNotice],
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
      </dl>

      {actionNotice ? (
        <div className="daemon-panel-notice" role="status" aria-live="polite">
          {actionNotice}
        </div>
      ) : null}

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
