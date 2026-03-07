import { Globe } from "lucide-react";
import { useMemo } from "react";
import { WidgetShell } from "./WidgetShell";

interface RawEvent { event?: string; data?: unknown; }
interface Props { rawEvents: unknown[]; }
interface SessionInfo { slotId: string; url?: string; title?: string; }

function extractActiveSessions(rawEvents: unknown[]): SessionInfo[] {
  const sessions: Map<string, SessionInfo> = new Map();
  for (const raw of rawEvents) {
    const e = raw as RawEvent;
    if (e?.event === "browser.session.open" && e.data && typeof e.data === "object") {
      const d = e.data as SessionInfo;
      if (d.slotId) sessions.set(d.slotId, d);
    }
    if (e?.event === "browser.session.close" && e.data && typeof e.data === "object") {
      const d = e.data as { slotId?: string };
      if (d.slotId) sessions.delete(d.slotId);
    }
    if (e?.event === "browser.navigate" && e.data && typeof e.data === "object") {
      const d = e.data as SessionInfo;
      if (d.slotId && sessions.has(d.slotId)) {
        sessions.set(d.slotId, { ...sessions.get(d.slotId)!, ...d });
      }
    }
  }
  return Array.from(sessions.values());
}

export function WidgetBrowserSession({ rawEvents }: Props) {
  const sessions = useMemo(() => extractActiveSessions(rawEvents), [rawEvents]);
  const badge = sessions.length > 0 ? `${sessions.length} ACTIVE` : undefined;

  return (
    <WidgetShell icon={<Globe size={14} />} title="Browser" badge={badge} accentVar="--opta-neon-cyan">
      {sessions.length === 0 ? (
        <span className="widget-stat-label">No active sessions</span>
      ) : (
        sessions.map((s) => (
          <div key={s.slotId} className="widget-stat-row">
            <span className="widget-stat-label" style={{ maxWidth: "60%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {s.title ?? s.url ?? s.slotId}
            </span>
          </div>
        ))
      )}
    </WidgetShell>
  );
}
