'use client';

/**
 * VRAMGauge — Circular SVG gauge showing VRAM usage.
 *
 * Uses stroke-dasharray/stroke-dashoffset on a motion.circle for
 * spring-animated fill. Color transitions: emerald (0-60%),
 * amber (60-80%), red (80-100%). Wrapped in @opta/ui Card glass variant.
 */

import { motion } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardContent } from '@opta/ui';
import { Cpu } from 'lucide-react';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface VRAMGaugeProps {
  /** VRAM currently in use (GB) */
  usedGB: number;
  /** Total available VRAM (GB) */
  totalGB: number;
  /** SVG viewport size in pixels (default 160) */
  size?: number;
}

// ---------------------------------------------------------------------------
// Color helper
// ---------------------------------------------------------------------------

function getGaugeColor(percentage: number): string {
  if (percentage < 0.6) return 'var(--color-neon-green)';
  if (percentage < 0.8) return 'var(--color-neon-amber)';
  return 'var(--color-neon-red)';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VRAMGauge({ usedGB, totalGB, size = 160 }: VRAMGaugeProps) {
  const percentage = totalGB > 0 ? Math.min(usedGB / totalGB, 1) : 0;
  const strokeWidth = 8;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - percentage);
  const color = getGaugeColor(percentage);

  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Cpu className="h-4 w-4 text-neon-cyan" />
          VRAM Usage
        </CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-center pb-6">
        <div
          className="relative flex items-center justify-center"
          style={{ width: size, height: size }}
        >
          {/* SVG rotated -90deg so fill starts from 12 o'clock */}
          <svg
            width={size}
            height={size}
            className="-rotate-90"
            aria-label={`VRAM usage: ${usedGB.toFixed(1)} of ${totalGB.toFixed(0)} GB`}
          >
            {/* Background track */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="var(--color-chart-track)"
              strokeWidth={strokeWidth}
            />
            {/* Animated fill */}
            <motion.circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: offset }}
              transition={{ type: 'spring', stiffness: 60, damping: 15 }}
            />
          </svg>

          {/* Center text overlay */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-text-primary tabular-nums">
              {usedGB.toFixed(1)}
            </span>
            <span className="text-[11px] text-text-secondary">
              / {totalGB.toFixed(0)} GB
            </span>
            <span
              className="mt-1.5 text-[10px] font-semibold uppercase tracking-widest"
              style={{ color }}
            >
              {(percentage * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
