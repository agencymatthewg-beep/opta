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

export function VRAMGauge({ usedGB, totalGB, size = 200 }: VRAMGaugeProps) {
  // Idle state when no model loaded
  if (totalGB === 0) {
    return (
      <Card variant="glass" className="group transition-all hover:bg-white/[0.03] hover:border-white/10 hover:shadow-[0_8px_32px_-8px_rgba(139,92,246,0.15)] relative overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Cpu className="h-4 w-4 text-neon-cyan" />
            VRAM Usage
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center pb-6">
          <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
            <motion.svg width={size} height={size} className="-rotate-90">
              <circle
                cx={size / 2} cy={size / 2} r={(size - 20) / 2}
                fill="none"
                stroke="var(--color-chart-track)"
                strokeWidth={10}
              />
              <motion.circle
                cx={size / 2} cy={size / 2} r={(size - 20) / 2}
                fill="none"
                stroke="var(--color-primary)"
                strokeWidth={10}
                strokeOpacity={0.35}
                strokeDasharray={2 * Math.PI * ((size - 20) / 2)}
                strokeDashoffset={0}
                animate={{ opacity: [0.3, 0.65, 0.3] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
              />
            </motion.svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-text-primary tracking-tight mb-0.5">Ready</span>
              <span className="text-[11px] font-medium text-text-secondary">512 GB VRAM</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const percentage = totalGB > 0 ? Math.min(usedGB / totalGB, 1) : 0;
  const strokeWidth = 10;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - percentage);
  const color = getGaugeColor(percentage);

  return (
    <Card variant="glass" className="group transition-all hover:bg-white/[0.03] hover:border-white/10 hover:shadow-[0_8px_32px_-8px_rgba(139,92,246,0.15)] relative overflow-hidden">
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
          <motion.svg
            width={size}
            height={size}
            className="-rotate-90"
            aria-label={`VRAM usage: ${usedGB.toFixed(1)} of ${totalGB.toFixed(0)} GB`}
            animate={{
              filter: percentage >= 0.8
                ? ['drop-shadow(0 0 2px var(--color-neon-red))', 'drop-shadow(0 0 12px var(--color-neon-red))', 'drop-shadow(0 0 2px var(--color-neon-red))']
                : 'drop-shadow(0 0 0px rgba(0,0,0,0))'
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            {/* Background track */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="var(--color-chart-track)"
              strokeWidth={strokeWidth}
              className="drop-shadow-sm"
            />
            {/* Animated fill */}
            <defs>
              <linearGradient id="vram-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={color} stopOpacity="1" />
                <stop offset="100%" stopColor={color} stopOpacity="0.4" />
              </linearGradient>
            </defs>
            <motion.circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="url(#vram-gradient)"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: offset }}
              transition={{ type: 'spring', stiffness: 60, damping: 15 }}
            />
          </motion.svg>

          {/* Center text overlay */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold tracking-tight text-text-primary tabular-nums">
                {usedGB.toFixed(1)}
              </span>
              <span className="text-[11px] font-semibold text-text-secondary uppercase">
                GB
              </span>
            </div>

            <div className="flex items-center gap-1.5 mt-1 opacity-80">
              <span className="text-[10px] text-text-muted font-medium">
                of {totalGB.toFixed(0)}
              </span>
              <span className="h-2 w-px bg-white/20" />
              <span
                className="text-[11px] font-bold tracking-wider"
                style={{ color }}
              >
                {(percentage * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
