/**
 * GpuMeter - The Heat Visualization GPU Monitor
 *
 * Enhanced GPU visualization featuring a heat map gradient based on
 * temperature with radial heat emanation, shimmer effects at high temps,
 * and a spinning fan icon based on utilization.
 *
 * Phase 36-03: Telemetry Visualization Upgrade
 * @see DESIGN_SYSTEM.md - Part 4: The Obsidian Glass Material System
 */

import { memo, useMemo } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';
import { cn } from '@/lib/utils';
import { MonitorOff, Fan } from 'lucide-react';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { springs } from '@/lib/animation';

// Temperature thresholds
const TEMP_WARM = 70;
const TEMP_HOT = 80;
const TEMP_CRITICAL = 90;

// Heat shimmer configuration
const SHIMMER_LAYERS = 3;

interface GpuMeterProps {
  available: boolean;
  name?: string;
  percent?: number;
  temperature?: number;
}

/**
 * Heat Visualization GPU Meter
 * Features:
 * - Heat map gradient based on temperature
 * - Cool: blue -> Warm: purple -> Hot: red
 * - Radial heat emanation from center
 * - Heat shimmer effect at high temps (>80C)
 * - Fan icon spins faster with utilization
 */
const GpuMeter = memo(function GpuMeter({
  available,
  name,
  percent = 0,
  temperature,
}: GpuMeterProps) {
  const prefersReducedMotion = useReducedMotion();

  // Spring-animated percentage for smooth transitions
  const springPercent = useSpring(percent, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  // Calculate stroke dashoffset for the progress ring
  const radius = 46;
  const circumference = 2 * Math.PI * radius;

  const dashOffset = useTransform(springPercent, [0, 100], [circumference, 0]);

  // Unavailable state
  if (!available) {
    return (
      <motion.div
        className="flex flex-col items-center justify-center gap-3 py-4"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={prefersReducedMotion ? { duration: 0 } : springs.smooth}
        role="status"
        aria-label="No GPU detected"
      >
        <div
          className={cn(
            'w-32 h-32 rounded-full flex items-center justify-center',
            'bg-[#05030a]/60 backdrop-blur-lg',
            'border-2 border-dashed border-white/[0.08]'
          )}
        >
          <MonitorOff
            className="w-8 h-8 text-muted-foreground/30"
            strokeWidth={1.5}
            aria-hidden="true"
          />
        </div>
        <span className="text-xs text-muted-foreground/60">No GPU detected</span>
      </motion.div>
    );
  }

  // Temperature-based color configuration
  const colors = useMemo(() => {
    const temp = temperature ?? 50;

    if (temp >= TEMP_CRITICAL) {
      return {
        primary: '#EF4444', // Red
        secondary: '#DC2626',
        glow: 'rgba(239, 68, 68, 0.7)',
        heatRays: 'rgba(239, 68, 68, 0.3)',
        textClass: 'text-danger',
        gradient: ['#DC2626', '#EF4444', '#F87171'],
      };
    }
    if (temp >= TEMP_HOT) {
      return {
        primary: '#F97316', // Orange
        secondary: '#EA580C',
        glow: 'rgba(249, 115, 22, 0.6)',
        heatRays: 'rgba(249, 115, 22, 0.25)',
        textClass: 'text-warning',
        gradient: ['#EA580C', '#F97316', '#FB923C'],
      };
    }
    if (temp >= TEMP_WARM) {
      return {
        primary: '#9333EA', // Purple
        secondary: '#7C3AED',
        glow: 'rgba(147, 51, 234, 0.5)',
        heatRays: 'rgba(147, 51, 234, 0.2)',
        textClass: 'text-warning',
        gradient: ['#7C3AED', '#9333EA', '#A855F7'],
      };
    }
    return {
      primary: '#3B82F6', // Blue (Cool)
      secondary: '#2563EB',
      glow: 'rgba(59, 130, 246, 0.4)',
      heatRays: 'rgba(59, 130, 246, 0.15)',
      textClass: 'text-success',
      gradient: ['#2563EB', '#3B82F6', '#60A5FA'],
    };
  }, [temperature]);

  // Usage-based color (for the ring)
  const usageColors = useMemo(() => {
    if (percent >= 85) {
      return {
        stroke: 'hsl(var(--danger))',
        glow: 'drop-shadow-[0_0_15px_rgba(239,68,68,0.6)]',
        textClass: 'text-danger',
      };
    }
    if (percent >= 60) {
      return {
        stroke: 'hsl(var(--warning))',
        glow: 'drop-shadow-[0_0_15px_rgba(234,179,8,0.6)]',
        textClass: 'text-warning',
      };
    }
    return {
      stroke: 'hsl(var(--success))',
      glow: 'drop-shadow-[0_0_15px_rgba(34,197,94,0.5)]',
      textClass: 'text-success',
    };
  }, [percent]);

  // Temperature indicator styling
  const tempColors = useMemo(() => {
    const temp = temperature ?? 50;
    if (temp >= TEMP_CRITICAL)
      return 'text-danger border-danger/30 bg-danger/10 shadow-[0_0_8px_rgba(239,68,68,0.3)]';
    if (temp >= TEMP_HOT)
      return 'text-warning border-warning/30 bg-warning/10 shadow-[0_0_8px_rgba(249,115,22,0.3)]';
    if (temp >= TEMP_WARM)
      return 'text-warning border-warning/30 bg-warning/10 shadow-[0_0_8px_rgba(234,179,8,0.3)]';
    return 'text-success border-success/30 bg-success/10 shadow-[0_0_8px_rgba(34,197,94,0.3)]';
  }, [temperature]);

  // Fan spin speed based on utilization
  const fanSpinDuration = useMemo(() => {
    if (percent >= 90) return 0.3; // Very fast
    if (percent >= 70) return 0.5;
    if (percent >= 50) return 0.8;
    if (percent >= 30) return 1.2;
    return 2; // Slow
  }, [percent]);

  // Heat shimmer effect for high temperatures
  const isHot = (temperature ?? 50) >= TEMP_HOT;
  const isCritical = (temperature ?? 50) >= TEMP_CRITICAL;

  return (
    <motion.div
      className="flex flex-col items-center gap-3"
      role="meter"
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`GPU usage: ${Math.round(percent)} percent${temperature !== undefined ? `, temperature: ${temperature} degrees Celsius` : ''}`}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={prefersReducedMotion ? { duration: 0 } : springs.smooth}
    >
      {/* Heat Visualization Container */}
      <div className="relative w-36 h-36">
        {/* Radial heat emanation background */}
        <motion.div
          className="absolute inset-0 rounded-full"
          animate={{
            opacity: 0.3 + (percent / 100) * 0.4,
            scale: 1 + ((temperature ?? 50) / 100) * 0.15,
          }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.5 }}
          style={{
            background: `radial-gradient(circle, ${colors.glow} 0%, ${colors.heatRays} 40%, transparent 70%)`,
          }}
        />

        {/* Heat shimmer effect for high temps */}
        {isHot && !prefersReducedMotion && (
          <>
            {Array.from({ length: SHIMMER_LAYERS }).map((_, i) => (
              <motion.div
                key={i}
                className="absolute inset-0 rounded-full pointer-events-none"
                style={{
                  background: `radial-gradient(circle at ${50 + (i - 1) * 10}% ${40 + i * 10}%, ${colors.heatRays} 0%, transparent 50%)`,
                }}
                animate={{
                  opacity: [0.3, 0.6, 0.3],
                  scale: [1, 1.05, 1],
                  y: [0, -3, 0],
                }}
                transition={{
                  duration: 1.5 + i * 0.3,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: i * 0.2,
                }}
              />
            ))}
          </>
        )}

        {/* Critical heat warning pulse */}
        {isCritical && !prefersReducedMotion && (
          <motion.div
            className="absolute -inset-2 rounded-full"
            style={{
              background: `radial-gradient(circle, ${colors.glow} 0%, transparent 60%)`,
            }}
            animate={{ opacity: [0.4, 0.7, 0.4] }}
            transition={{ duration: 0.8, repeat: Infinity }}
          />
        )}

        {/* SVG for progress ring */}
        <svg className="w-full h-full -rotate-90 relative z-10" viewBox="0 0 120 120" aria-hidden="true">
          <defs>
            {/* Heat gradient for core */}
            <radialGradient id="gpuHeatGradient" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={colors.gradient[2]} stopOpacity="0.9" />
              <stop offset="50%" stopColor={colors.gradient[1]} stopOpacity="0.6" />
              <stop offset="100%" stopColor={colors.gradient[0]} stopOpacity="0.3" />
            </radialGradient>

            {/* Glow filter */}
            <filter id="gpuGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Background circle - obsidian glass ring */}
          <circle cx="60" cy="60" r={radius} fill="none" strokeWidth="8" className="stroke-white/[0.06]" />

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
            stroke={usageColors.stroke}
            className={usageColors.glow}
          />

          {/* Heat core */}
          <motion.circle
            cx="60"
            cy="60"
            r={30}
            fill="url(#gpuHeatGradient)"
            filter="url(#gpuGlow)"
            animate={{
              opacity: 0.5 + ((temperature ?? 50) / 100) * 0.5,
            }}
            transition={{ duration: 0.5 }}
          />
        </svg>

        {/* Center content */}
        <div
          className={cn(
            'absolute inset-4 flex flex-col items-center justify-center rounded-full',
            'bg-[#05030a]/60 backdrop-blur-lg',
            'border border-white/[0.06]'
          )}
        >
          {/* Fan icon - spins based on utilization */}
          <motion.div
            animate={
              !prefersReducedMotion && percent > 10
                ? { rotate: 360 }
                : { rotate: 0 }
            }
            transition={
              !prefersReducedMotion && percent > 10
                ? {
                    duration: fanSpinDuration,
                    repeat: Infinity,
                    ease: 'linear',
                  }
                : { duration: 0 }
            }
            className="mb-1"
          >
            <Fan
              className={cn('w-5 h-5', usageColors.textClass)}
              strokeWidth={1.5}
            />
          </motion.div>

          <motion.span
            className={cn('text-2xl font-bold tabular-nums', usageColors.textClass)}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={prefersReducedMotion ? { duration: 0 } : { delay: 0.2, ...springs.snappy }}
          >
            {Math.round(percent)}
            <span className="text-sm">%</span>
          </motion.span>
        </div>

        {/* Temperature badge - styled with heat colors */}
        {temperature !== undefined && (
          <motion.div
            className={cn(
              'absolute -bottom-1 left-1/2 -translate-x-1/2',
              'px-2.5 py-1 rounded-full text-[10px] font-semibold',
              'border backdrop-blur-sm',
              tempColors
            )}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={prefersReducedMotion ? { duration: 0 } : { delay: 0.4, duration: 0.4, ...springs.bouncy }}
          >
            {/* Heat indicator dot */}
            {isHot && !prefersReducedMotion && (
              <motion.span
                className="absolute -left-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: colors.primary }}
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ duration: 0.8, repeat: Infinity }}
              />
            )}
            {temperature}°C
          </motion.div>
        )}
      </div>

      {/* GPU name */}
      <motion.div
        className="flex items-center gap-1.5 text-xs"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={prefersReducedMotion ? { duration: 0 } : { delay: 0.3, ...springs.gentle }}
      >
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full',
            'shadow-[0_0_6px_rgba(168,85,247,0.4)]'
          )}
          style={{ backgroundColor: colors.primary }}
        />
        <span className="text-muted-foreground/70 truncate max-w-[140px]" title={name}>
          <span className="font-medium text-foreground/80">{name || 'Unknown GPU'}</span>
        </span>
      </motion.div>
    </motion.div>
  );
});

export default GpuMeter;
