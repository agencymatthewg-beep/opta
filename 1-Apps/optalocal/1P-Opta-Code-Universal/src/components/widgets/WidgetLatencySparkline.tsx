import { TrendingUp } from "lucide-react";
import { useMemo } from "react";
import { WidgetShell } from "./WidgetShell";
import type { TimelineItem } from "../../types";

interface Props { timelineItems: TimelineItem[]; }

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return <div style={{ height: 28 }} />;
  const max = Math.max(...values, 1);
  const w = 200;
  const h = 28;
  const step = w / (values.length - 1);
  const pts = values
    .map((v, i) => `${i * step},${h - (v / max) * h}`)
    .join(" ");
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ height: h }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function WidgetLatencySparkline({ timelineItems }: Props) {
  const speeds = useMemo(() =>
    timelineItems
      .filter((i) => i.kind === "system" && i.stats?.speed != null)
      .slice(-8)
      .map((i) => i.stats!.speed),
    [timelineItems]
  );
  const latest = speeds.at(-1) ?? 0;
  const avg = speeds.length > 0 ? speeds.reduce((s, v) => s + v, 0) / speeds.length : 0;

  return (
    <WidgetShell icon={<TrendingUp size={14} />} title="Speed" accentVar="--opta-neon-cyan">
      <div className="widget-stat-row">
        <span className="widget-stat-label">Now</span>
        <span className="widget-stat-value accent">{latest.toFixed(1)} tok/s</span>
      </div>
      <div className="widget-stat-row">
        <span className="widget-stat-label">Avg (8 turns)</span>
        <span className="widget-stat-value">{avg.toFixed(1)} tok/s</span>
      </div>
      <Sparkline values={speeds} color="var(--opta-neon-cyan, #22d3ee)" />
    </WidgetShell>
  );
}
