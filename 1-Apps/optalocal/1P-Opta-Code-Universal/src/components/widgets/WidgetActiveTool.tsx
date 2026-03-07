import { Zap } from "lucide-react";
import { useMemo } from "react";
import { WidgetShell } from "./WidgetShell";

interface RawEvent { event?: string; data?: unknown; ts?: string; }
interface Props { rawEvents: unknown[]; }

function getActiveTool(rawEvents: unknown[]): string | null {
  let lastStart: string | null = null;
  let lastStartIndex = -1;
  for (let i = rawEvents.length - 1; i >= 0; i--) {
    const e = rawEvents[i] as RawEvent;
    if (e?.event === "tool.start" && typeof e.data === "string") {
      lastStart = e.data;
      lastStartIndex = i;
      break;
    }
  }
  if (!lastStart || lastStartIndex < 0) return null;
  for (let i = lastStartIndex + 1; i < rawEvents.length; i++) {
    const e = rawEvents[i] as RawEvent;
    if (e?.event === "tool.end") return null;
  }
  return lastStart;
}

export function WidgetActiveTool({ rawEvents }: Props) {
  const activeTool = useMemo(() => getActiveTool(rawEvents), [rawEvents]);
  const badge = activeTool ? "RUNNING" : undefined;

  return (
    <WidgetShell icon={<Zap size={14} />} title="Active Tool" badge={badge} accentVar="--opta-neon-green">
      <div className="widget-stat-row">
        <span className="widget-stat-label">Tool</span>
        <span className="widget-stat-value accent">{activeTool ?? "Idle"}</span>
      </div>
    </WidgetShell>
  );
}
