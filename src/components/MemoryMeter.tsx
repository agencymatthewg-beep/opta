/**
 * MemoryMeter - The Obsidian Memory Monitor
 *
 * Linear RAM usage meter with obsidian styling and energy-based glow.
 * Color transitions from success → warning → danger based on usage.
 *
 * @see DESIGN_SYSTEM.md - Part 4: The Obsidian Glass Material System
 */

import { motion, useSpring, useTransform } from 'framer-motion';
import { cn } from '@/lib/utils';

// Easing curve for smooth energy transitions
const smoothOut: [number, number, number, number] = [0.22, 1, 0.36, 1];

interface MemoryMeterProps {
  usedGb: number;
  totalGb: number;
  percent: number;
}

function MemoryMeter({ usedGb, totalGb, percent }: MemoryMeterProps) {
  // Animated value for smooth transitions
  const springValue = useSpring(percent, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  const width = useTransform(springValue, [0, 100], ["0%", "100%"]);

  // Determine color based on usage level
  const getColorClass = (value: number) => {
    if (value >= 85) return 'text-danger';
    if (value >= 60) return 'text-warning';
    return 'text-success';
  };

  const getBarColor = (value: number) => {
    if (value >= 85) return 'hsl(var(--danger))';
    if (value >= 60) return 'hsl(var(--warning))';
    return 'hsl(var(--success))';
  };

  const getGlowClass = (value: number) => {
    if (value >= 85) return 'shadow-[0_0_15px_rgba(239,68,68,0.4)]';
    if (value >= 60) return 'shadow-[0_0_15px_rgba(234,179,8,0.4)]';
    return 'shadow-[0_0_15px_rgba(34,197,94,0.35)]';
  };

  const colorClass = getColorClass(percent);
  const barColor = getBarColor(percent);
  const glowClass = getGlowClass(percent);
  const isHighUsage = percent >= 90;

  return (
    <motion.div
      className="flex flex-col gap-4 w-full"
      role="meter"
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Memory usage: ${usedGb.toFixed(1)} GB of ${totalGb.toFixed(1)} GB (${Math.round(percent)} percent)`}
      // Ignition animation
      initial={{
        opacity: 0,
        y: 8,
        filter: 'brightness(0.5) blur(2px)',
      }}
      animate={{
        opacity: 1,
        y: 0,
        filter: 'brightness(1) blur(0px)',
      }}
      transition={{ duration: 0.5, ease: smoothOut }}
    >
      {/* Header */}
      <motion.div
        className="flex items-center justify-between"
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, ease: smoothOut }}
      >
        <div className="flex items-baseline gap-2">
          <span className={cn("text-3xl font-bold tabular-nums", colorClass)}>
            {Math.round(percent)}
            <span className="text-lg">%</span>
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground/60 font-medium uppercase tracking-wider">
          RAM
        </span>
      </motion.div>

      {/* Progress bar - obsidian glass container */}
      <div className={cn(
        "relative h-3 w-full rounded-full overflow-hidden",
        "bg-white/[0.03]",
        "border border-white/[0.06]",
        isHighUsage && "animate-pulse"
      )}>
        <motion.div
          className={cn(
            "absolute inset-y-0 left-0 rounded-full",
            glowClass
          )}
          style={{
            width,
            background: `linear-gradient(90deg, hsl(var(--success)) 0%, ${barColor} 100%)`,
          }}
          initial={{ width: "0%" }}
          animate={{ width: `${percent}%` }}
          transition={{
            duration: 0.8,
            ease: smoothOut,
          }}
        />
      </div>

      {/* Stats - obsidian styled */}
      <motion.div
        className="flex items-center justify-center gap-2 text-xs"
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, ease: smoothOut }}
      >
        <span className={cn(
          "w-1.5 h-1.5 rounded-full bg-primary/60",
          "shadow-[0_0_6px_rgba(168,85,247,0.4)]"
        )} />
        <span className="text-foreground/80 font-medium tabular-nums">
          {usedGb.toFixed(1)} GB
        </span>
        <span className="text-muted-foreground/40">/</span>
        <span className="text-muted-foreground/70 tabular-nums">
          {totalGb.toFixed(1)} GB
        </span>
      </motion.div>
    </motion.div>
  );
}

export default MemoryMeter;
