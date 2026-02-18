'use client';

/**
 * ThroughputChart — Real-time tokens/second line chart.
 *
 * Uses Recharts LineChart with CircularBuffer data. CRITICAL: Both
 * isAnimationActive={false} AND animationDuration={0} are set on the
 * Line component to prevent re-render storms on live streaming data
 * (see 03-RESEARCH.md Pitfall 3).
 *
 * Wrapped in @opta/ui Card glass variant. Shows empty state when no data.
 * Optional average TPS reference line (dashed violet).
 */

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@opta/ui';
import { Activity } from 'lucide-react';
import type { ThroughputPoint } from '@/lib/circular-buffer';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ThroughputChartProps {
  /** Time-series throughput data (chronological, from CircularBuffer.toArray()) */
  data: ThroughputPoint[];
  /** Optional average tokens/sec — renders a dashed reference line */
  averageTps?: number;
}

// ---------------------------------------------------------------------------
// Custom tooltip
// ---------------------------------------------------------------------------

interface TooltipPayloadItem {
  value: number;
  dataKey: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: number;
}

function ChartTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length || label == null) return null;

  const tps = payload[0]?.value ?? 0;
  const time = new Date(label).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div className="glass-strong rounded-lg px-3 py-2 text-xs">
      <p className="text-text-secondary">{time}</p>
      <p className="mt-0.5 font-semibold text-text-primary">
        {tps.toFixed(1)} tokens/s
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Axis tick formatter
// ---------------------------------------------------------------------------

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatYAxis(value: number): string {
  return `${value} t/s`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ThroughputChart({ data, averageTps }: ThroughputChartProps) {
  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4 text-neon-purple" />
          Throughput
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex h-[240px] items-center justify-center">
            <p className="text-sm text-text-muted">Waiting for data...</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart
              data={data}
              margin={{ top: 8, right: 16, bottom: 8, left: 16 }}
            >
              <XAxis
                dataKey="timestamp"
                tickFormatter={formatTime}
                stroke="var(--color-chart-axis)"
                tick={{ fontSize: 11, fill: 'var(--color-chart-tick)' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="var(--color-chart-axis)"
                tick={{ fontSize: 11, fill: 'var(--color-chart-tick)' }}
                tickFormatter={formatYAxis}
                tickLine={false}
                axisLine={false}
                width={56}
              />
              <Tooltip content={<ChartTooltip />} />
              {averageTps != null && averageTps > 0 && (
                <ReferenceLine
                  y={averageTps}
                  stroke="var(--color-chart-ref-stroke)"
                  strokeDasharray="4 4"
                  label={{
                    value: `avg ${averageTps.toFixed(0)}`,
                    fill: 'var(--color-chart-ref-label)',
                    fontSize: 11,
                    position: 'insideTopRight',
                  }}
                />
              )}
              <Line
                type="monotone"
                dataKey="tokensPerSecond"
                stroke="var(--color-neon-purple)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
                animationDuration={0}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
