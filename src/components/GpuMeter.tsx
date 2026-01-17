/**
 * GpuMeter - The Obsidian GPU Monitor
 *
 * Circular GPU usage meter with obsidian styling and energy-based glow.
 * Color transitions from success → warning → danger based on usage.
 *
 * @see DESIGN_SYSTEM.md - Part 4: The Obsidian Glass Material System
 */

import { motion, useSpring, useTransform } from 'framer-motion';
import { cn } from '@/lib/utils';
import { MonitorOff } from 'lucide-react';

// Easing curve for smooth energy transitions
const smoothOut: [number, number, number, number] = [0.22, 1, 0.36, 1];

interface GpuMeterProps {
  available: boolean;
  name?: string;
  percent?: number;
  temperature?: number;
}

function GpuMeter({ available, name, percent = 0, temperature }: GpuMeterProps) {
  // Animated value for smooth transitions
  const springValue = useSpring(percent, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  // Calculate stroke dashoffset for the progress ring
  const radius = 46;
  const circumference = 2 * Math.PI * radius;

  const dashOffset = useTransform(
    springValue,
    [0, 100],
    [circumference, 0]
  );

  if (!available) {
    return (
      <motion.div
        className="flex flex-col items-center justify-center gap-3 py-4"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: smoothOut }}
        role="status"
        aria-label="No GPU detected"
      >
        <div className={cn(
          "w-32 h-32 rounded-full flex items-center justify-center",
          "bg-[#05030a]/60 backdrop-blur-lg",
          "border-2 border-dashed border-white/[0.08]"
        )}>
          <MonitorOff className="w-8 h-8 text-muted-foreground/30" strokeWidth={1.5} aria-hidden="true" />
        </div>
        <span className="text-xs text-muted-foreground/60">No GPU detected</span>
      </motion.div>
    );
  }

  // Determine color based on usage level
  const getColorClass = (value: number) => {
    if (value >= 85) return 'text-danger';
    if (value >= 60) return 'text-warning';
    return 'text-success';
  };

  const getStrokeColor = (value: number) => {
    if (value >= 85) return 'hsl(var(--danger))';
    if (value >= 60) return 'hsl(var(--warning))';
    return 'hsl(var(--success))';
  };

  const getGlowClass = (value: number) => {
    if (value >= 85) return 'drop-shadow-[0_0_15px_rgba(239,68,68,0.6)]';
    if (value >= 60) return 'drop-shadow-[0_0_15px_rgba(234,179,8,0.6)]';
    return 'drop-shadow-[0_0_15px_rgba(34,197,94,0.5)]';
  };

  // Temperature color
  const getTempColorClass = (temp: number) => {
    if (temp >= 80) return 'text-danger border-danger/30 bg-danger/10 shadow-[0_0_8px_rgba(239,68,68,0.3)]';
    if (temp >= 65) return 'text-warning border-warning/30 bg-warning/10 shadow-[0_0_8px_rgba(234,179,8,0.3)]';
    return 'text-success border-success/30 bg-success/10 shadow-[0_0_8px_rgba(34,197,94,0.3)]';
  };

  const colorClass = getColorClass(percent);
  const strokeColor = getStrokeColor(percent);
  const glowClass = getGlowClass(percent);
  const isHighUsage = percent >= 90;

  return (
    <motion.div
      className="flex flex-col items-center gap-3"
      role="meter"
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`GPU usage: ${Math.round(percent)} percent${temperature !== undefined ? `, temperature: ${temperature} degrees Celsius` : ''}`}
      // Simple fade-in (filter removed for performance)
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: smoothOut }}
    >
      {/* Meter ring */}
      <div className={cn(
        "relative w-32 h-32",
        isHighUsage && "animate-pulse"
      )}>
        {/* Ambient glow behind ring */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: `radial-gradient(circle, ${strokeColor}15 0%, transparent 70%)`,
          }}
        />

        <svg
          className="w-full h-full -rotate-90 relative z-10"
          viewBox="0 0 120 120"
          aria-hidden="true"
        >
          {/* Background circle - obsidian glass ring */}
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            strokeWidth="8"
            className="stroke-white/[0.06]"
          />
          {/* Gradient definition */}
          <defs>
            <linearGradient id="gpuGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={strokeColor} stopOpacity="0.8" />
              <stop offset="100%" stopColor={strokeColor} stopOpacity="1" />
            </linearGradient>
          </defs>
          {/* Progress circle */}
          <motion.circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            strokeWidth="8"
            strokeDasharray={circumference}
            style={{ strokeDashoffset: dashOffset }}
            strokeLinecap="round"
            stroke="url(#gpuGradient)"
            className={cn("transition-all duration-300", glowClass)}
          />
        </svg>

        {/* Center content - obsidian glass background */}
        <div className={cn(
          "absolute inset-4 flex flex-col items-center justify-center rounded-full",
          "bg-[#05030a]/60 backdrop-blur-lg",
          "border border-white/[0.06]"
        )}>
          <motion.span
            className={cn("text-3xl font-bold tabular-nums", colorClass)}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, ease: smoothOut }}
          >
            {Math.round(percent)}
            <span className="text-lg">%</span>
          </motion.span>
          <span className="text-[10px] text-muted-foreground/60 font-medium uppercase tracking-wider mt-0.5">
            GPU
          </span>
        </div>

        {/* Temperature badge - obsidian styled */}
        {temperature !== undefined && (
          <motion.div
            className={cn(
              "absolute -bottom-1 left-1/2 -translate-x-1/2",
              "px-2.5 py-1 rounded-full text-[10px] font-semibold",
              "border backdrop-blur-sm",
              getTempColorClass(temperature)
            )}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.4, ease: smoothOut }}
          >
            {temperature}°C
          </motion.div>
        )}
      </div>

      {/* GPU name - obsidian styled */}
      <motion.div
        className="flex items-center gap-1.5 text-xs"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, ease: smoothOut }}
      >
        <span className={cn(
          "w-1.5 h-1.5 rounded-full bg-primary/60",
          "shadow-[0_0_6px_rgba(168,85,247,0.4)]"
        )} />
        <span className="text-muted-foreground/70 truncate max-w-[120px]" title={name}>
          <span className="font-medium text-foreground/80">{name || 'Unknown GPU'}</span>
        </span>
      </motion.div>
    </motion.div>
  );
}

export default GpuMeter;
