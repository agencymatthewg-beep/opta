import { Brain } from "lucide-react";
import { useMemo } from "react";
import { WidgetShell } from "./WidgetShell";
import type { TimelineItem } from "../../types";

interface Props { timelineItems: TimelineItem[]; }

export function WidgetSessionMemory({ timelineItems }: Props) {
  const stats = useMemo(() => {
    const turns = timelineItems.filter((i) => i.kind === "system" && i.stats).length;
    const tokens = timelineItems
      .filter((i) => i.kind === "system" && i.stats)
      .reduce((s, i) => s + (i.stats?.tokens ?? 0), 0);
    const compactions = timelineItems.filter((i) =>
      i.kind === "system" && i.title.toLowerCase().includes("compact")
    ).length;
    return { turns, tokens, compactions };
  }, [timelineItems]);

  return (
    <WidgetShell icon={<Brain size={14} />} title="Session Stats" accentVar="--opta-primary">
      <div className="widget-stat-row">
        <span className="widget-stat-label">Turns</span>
        <span className="widget-stat-value">{stats.turns}</span>
      </div>
      <div className="widget-stat-row">
        <span className="widget-stat-label">Total Tokens</span>
        <span className="widget-stat-value accent">{stats.tokens.toLocaleString()}</span>
      </div>
      {stats.compactions > 0 && (
        <div className="widget-stat-row">
          <span className="widget-stat-label">Compactions</span>
          <span className="widget-stat-value">{stats.compactions}</span>
        </div>
      )}
    </WidgetShell>
  );
}
