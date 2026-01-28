/**
 * CpuMeter - The Energy Core CPU Monitor
 *
 * Enhanced CPU visualization featuring a pulsing energy core with
 * concentric rings that pulse with CPU usage. Core brightness scales
 * with CPU percentage and rings pulse outward at high load.
 *
 * Phase 36-01: Telemetry Visualization Upgrade
 * @see DESIGN_SYSTEM.md - Part 4: The Obsidian Glass Material System
 */

import { memo, useMemo } from 'react';
import { motion, useSpring } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { springs } from '@/lib/animation';

// Number of concentric rings
const RING_COUNT = 4;

// Animation timing
const PULSE_DURATION = 2;
const HIGH_LOAD_THRESHOLD = 70;
const CRITICAL_LOAD_THRESHOLD = 90;

interface CpuMeterProps {
  percent: number;
  cores: number;
  threads: number;
}

/**
 * Energy Core CPU Meter
 * Features:
 * - Central energy core that glows based on CPU load
 * - Concentric rings with varying opacity
 * - Rings pulse outward at high load (>70%)
 * - Glow intensity scales with load
 */
const CpuMeter = memo(function CpuMeter({ percent, cores, threads }: CpuMeterProps) {
  const prefersReducedMotion = useReducedMotion();

  // Spring-animated percentage for smooth transitions
  useSpring(percent, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  // Determine visual state based on load
  const isHighLoad = percent >= HIGH_LOAD_THRESHOLD;
  const isCriticalLoad = percent >= CRITICAL_LOAD_THRESHOLD;

  // Color configuration based on load level
  const colors = useMemo(() => {
    if (percent >= 85) {
      return {
        primary: 'hsl(var(--danger))',
        glow: 'rgba(239, 68, 68, 0.6)',
        ring: 'rgba(239, 68, 68, 0.3)',
        textClass: 'text-danger',
      };
    }
    if (percent >= 60) {
      return {
        primary: 'hsl(var(--warning))',
        glow: 'rgba(234, 179, 8, 0.6)',
        ring: 'rgba(234, 179, 8, 0.3)',
        textClass: 'text-warning',
      };
    }
    return {
      primary: 'hsl(var(--success))',
      glow: 'rgba(34, 197, 94, 0.5)',
      ring: 'rgba(34, 197, 94, 0.3)',
      textClass: 'text-success',
    };
  }, [percent]);

  // Generate ring configurations
  const rings = useMemo(() => {
    return Array.from({ length: RING_COUNT }, (_, i) => {
      const ringIndex = i + 1;
      const radius = 36 + ringIndex * 10; // Start at 36, increase by 10 per ring
      const baseOpacity = 0.3 - i * 0.05; // Decreasing opacity for outer rings
      const strokeWidth = 2 - i * 0.3; // Thinner strokes for outer rings
      return { radius, baseOpacity, strokeWidth, index: i };
    });
  }, []);

  return (
    <motion.div
      className="flex flex-col items-center gap-3"
      role="meter"
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`CPU usage: ${Math.round(percent)} percent`}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={prefersReducedMotion ? { duration: 0 } : springs.smooth}
    >
      {/* Energy Core Container */}
      <div className="relative w-36 h-36">
        {/* Ambient glow behind core - scales with load */}
        <motion.div
          className="absolute inset-0 rounded-full"
          animate={{
            opacity: 0.3 + (percent / 100) * 0.4,
            scale: 1 + (percent / 100) * 0.1,
          }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.5 }}
          style={{
            background: `radial-gradient(circle, ${colors.glow} 0%, transparent 70%)`,
          }}
        />

        {/* SVG Container for rings and core */}
        <svg
          className="w-full h-full relative z-10"
          viewBox="0 0 140 140"
          aria-hidden="true"
        >
          <defs>
            {/* Gradient for core glow */}
            <radialGradient id="coreGradient" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={colors.primary} stopOpacity="0.9" />
              <stop offset="50%" stopColor={colors.primary} stopOpacity="0.5" />
              <stop offset="100%" stopColor={colors.primary} stopOpacity="0" />
            </radialGradient>

            {/* Gradient for ring stroke */}
            <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={colors.primary} stopOpacity="0.8" />
              <stop offset="100%" stopColor={colors.primary} stopOpacity="0.2" />
            </linearGradient>

            {/* Glow filter for energy effect */}
            <filter id="coreGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Concentric Energy Rings */}
          {rings.map(({ radius, baseOpacity, strokeWidth, index }) => {
            const circumference = 2 * Math.PI * radius;
            const fillPercent = Math.min(percent + 15, 100); // Rings fill slightly more than core

            return (
              <motion.g key={index}>
                {/* Background ring track */}
                <circle
                  cx="70"
                  cy="70"
                  r={radius}
                  fill="none"
                  strokeWidth={strokeWidth}
                  className="stroke-white/[0.04]"
                />

                {/* Animated progress ring */}
                <motion.circle
                  cx="70"
                  cy="70"
                  r={radius}
                  fill="none"
                  strokeWidth={strokeWidth}
                  strokeDasharray={circumference}
                  initial={{ strokeDashoffset: circumference }}
                  animate={{
                    strokeDashoffset: circumference - (circumference * fillPercent) / 100,
                    opacity: baseOpacity + (percent / 100) * 0.3,
                  }}
                  transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                  strokeLinecap="round"
                  stroke={colors.primary}
                  style={{
                    transform: 'rotate(-90deg)',
                    transformOrigin: 'center',
                  }}
                />

                {/* Pulse effect for high load - rings pulse outward */}
                {isHighLoad && !prefersReducedMotion && (
                  <motion.circle
                    cx="70"
                    cy="70"
                    r={radius}
                    fill="none"
                    strokeWidth={strokeWidth * 0.5}
                    stroke={colors.ring}
                    initial={{ opacity: 0.4, scale: 1 }}
                    animate={{
                      opacity: [0.4, 0, 0.4],
                      scale: [1, 1.1, 1],
                    }}
                    transition={{
                      duration: PULSE_DURATION - index * 0.2,
                      repeat: Infinity,
                      ease: 'easeInOut',
                      delay: index * 0.15,
                    }}
                    style={{ transformOrigin: 'center' }}
                  />
                )}
              </motion.g>
            );
          })}

          {/* Central Energy Core */}
          <motion.circle
            cx="70"
            cy="70"
            r={24}
            fill="url(#coreGradient)"
            filter="url(#coreGlow)"
            initial={{ opacity: 0.5 }}
            animate={{
              opacity: 0.5 + (percent / 100) * 0.5,
              scale: isCriticalLoad && !prefersReducedMotion ? [1, 1.05, 1] : 1,
            }}
            transition={
              isCriticalLoad && !prefersReducedMotion
                ? { duration: 0.8, repeat: Infinity, ease: 'easeInOut' }
                : { duration: 0.5 }
            }
            style={{ transformOrigin: 'center' }}
          />

          {/* Inner core highlight */}
          <circle
            cx="70"
            cy="70"
            r={16}
            fill={colors.primary}
            fillOpacity={0.2 + (percent / 100) * 0.3}
          />
        </svg>

        {/* Center content - percentage display */}
        <div
          className={cn(
            'absolute inset-0 flex flex-col items-center justify-center',
            'pointer-events-none'
          )}
        >
          <motion.span
            className={cn('text-3xl font-bold tabular-nums', colors.textClass)}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={prefersReducedMotion ? { duration: 0 } : { delay: 0.2, ...springs.snappy }}
          >
            {Math.round(percent)}
            <span className="text-lg">%</span>
          </motion.span>
          <span className="text-[10px] text-muted-foreground/60 font-medium uppercase tracking-wider mt-0.5">
            CPU
          </span>
        </div>

        {/* Critical load warning indicator */}
        {isCriticalLoad && !prefersReducedMotion && (
          <motion.div
            className="absolute -inset-2 rounded-full pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            style={{
              background: `radial-gradient(circle, ${colors.glow} 0%, transparent 60%)`,
            }}
          />
        )}
      </div>

      {/* Stats - cores and threads */}
      <motion.div
        className="flex items-center gap-4 text-xs"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={prefersReducedMotion ? { duration: 0 } : { delay: 0.3, ...springs.gentle }}
      >
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              'w-1.5 h-1.5 rounded-full bg-primary/60',
              'shadow-[0_0_6px_rgba(168,85,247,0.4)]'
            )}
          />
          <span className="text-muted-foreground/70">
            <span className="font-medium text-foreground/80">{cores}</span> cores
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              'w-1.5 h-1.5 rounded-full bg-accent/60',
              'shadow-[0_0_6px_rgba(147,51,234,0.4)]'
            )}
          />
          <span className="text-muted-foreground/70">
            <span className="font-medium text-foreground/80">{threads}</span> threads
          </span>
        </div>
      </motion.div>
    </motion.div>
  );
});

export default CpuMeter;
