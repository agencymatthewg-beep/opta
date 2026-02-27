'use client';

/**
 * ThroughputChart — Real-time tokens/second line chart.
 *
 * Uses Recharts LineChart with CircularBuffer data. CRITICAL: Both
 * isAnimationActive={false} AND animationDuration={0} are set on the
 * Line component to prevent re-render storms on live streaming data
 * (see 03-RESEARCH.md Pitfall 3).
 *
 * Wrapped in @opta/ui Card glass variant. Shows ghost sparkline when idle.
 * Optional average TPS reference line (dashed violet).
 */

import {
  AreaChart,
  Area,
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
// Ghost data generator
// ---------------------------------------------------------------------------

function makeGhostData(): ThroughputPoint[] {
  const now = Date.now();
  return Array.from({ length: 30 }, (_, i) => ({
    timestamp: now - (29 - i) * 1000,
    tokensPerSecond: 0,
  }));
}

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
  const isIdle = data.length === 0;
  const chartData = isIdle ? makeGhostData() : data;

  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4 text-neon-purple" />
          Throughput
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <ResponsiveContainer width="100%" height={80}>
            <AreaChart
              data={chartData}
              margin={{ top: 4, right: 8, bottom: 4, left: 8 }}
            >
              <defs>
                <linearGradient id="tpsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-neon-purple)" stopOpacity={isIdle ? 0.03 : 0.35} />
                  <stop offset="95%" stopColor="var(--color-neon-purple)" stopOpacity={0} />
                </linearGradient>
              </defs>
              {!isIdle && (
                <>
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
                  <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--color-chart-axis)', strokeWidth: 1, strokeDasharray: '4 4' }} />
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
                </>
              )}
              <Area
                type="monotone"
                dataKey="tokensPerSecond"
                stroke="var(--color-neon-purple)"
                strokeWidth={2}
                strokeOpacity={isIdle ? 0.12 : 1}
                fillOpacity={1}
                fill="url(#tpsGradient)"
                activeDot={isIdle ? false : { r: 4, fill: 'var(--color-neon-purple)', strokeWidth: 0, style: { filter: 'drop-shadow(0 0 4px var(--color-neon-purple))' } }}
                isAnimationActive={false}
                animationDuration={0}
              />
            </AreaChart>
          </ResponsiveContainer>
          {isIdle && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p className="text-xs text-text-muted/60 italic">Inference activity will appear here</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
