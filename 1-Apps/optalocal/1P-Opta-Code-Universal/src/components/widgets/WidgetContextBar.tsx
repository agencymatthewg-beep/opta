import { AlignLeft } from "lucide-react";
import { useMemo } from "react";
import { WidgetShell } from "./WidgetShell";
import type { TimelineItem } from "../../types";

interface Props {
  timelineItems: TimelineItem[];
  contextLimit?: number;
}

export function WidgetContextBar({ timelineItems, contextLimit = 32_000 }: Props) {
  const totalTokens = useMemo(() =>
    timelineItems
      .filter((item) => item.kind === "system" && item.stats)
      .reduce((sum, item) => sum + (item.stats?.tokens ?? 0), 0),
    [timelineItems]
  );

  const pct = Math.min(100, (totalTokens / contextLimit) * 100);
  const isWarning = pct >= 70;
  const accentVar = isWarning ? "--opta-neon-amber" : "--opta-primary";
  const badge = pct >= 70 ? "NEAR LIMIT" : undefined;

  return (
    <WidgetShell icon={<AlignLeft size={14} />} title="Context" badge={badge} accentVar={accentVar}>
      <div className="widget-stat-row">
        <span className="widget-stat-label">Used</span>
        <span className="widget-stat-value accent">{totalTokens.toLocaleString()}</span>
      </div>
      <div className="widget-stat-row">
        <span className="widget-stat-label">Limit</span>
        <span className="widget-stat-value">{contextLimit.toLocaleString()}</span>
      </div>
      <div className="widget-progress-bar" style={{ marginTop: 6 }}>
        <div className="widget-progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </WidgetShell>
  );
}
