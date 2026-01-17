/**
 * MemoryMeter - The Liquid Fill Memory Monitor
 *
 * Enhanced memory visualization featuring a liquid fill effect with
 * surface tension waves. Wave amplitude increases with memory pressure
 * and bubbles rise during memory allocation.
 *
 * Phase 36-02: Telemetry Visualization Upgrade
 * @see DESIGN_SYSTEM.md - Part 4: The Obsidian Glass Material System
 */

import { memo, useMemo, useEffect, useState, useRef } from 'react';
import { motion, useSpring, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { springs } from '@/lib/animation';

// Animation configuration
const WAVE_AMPLITUDE_BASE = 3;
const WAVE_AMPLITUDE_HIGH = 8;
const BUBBLE_COUNT_MAX = 5;

interface Bubble {
  id: number;
  x: number;
  size: number;
  duration: number;
  delay: number;
}

interface MemoryMeterProps {
  usedGb: number;
  totalGb: number;
  percent: number;
}

/**
 * Liquid Fill Memory Meter
 * Features:
 * - Liquid fill visual with surface tension
 * - Wave animation that intensifies with pressure
 * - Color gradient: blue (low) -> purple (medium) -> red (high)
 * - Bubbles rise when memory is being allocated
 */
const MemoryMeter = memo(function MemoryMeter({ usedGb, totalGb, percent }: MemoryMeterProps) {
  const prefersReducedMotion = useReducedMotion();
  const prevPercentRef = useRef(percent);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const bubbleIdRef = useRef(0);

  // Spring-animated percentage for smooth transitions
  useSpring(percent, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  // Detect memory allocation (percent increasing) and spawn bubbles
  useEffect(() => {
    if (prefersReducedMotion) return;

    const percentDiff = percent - prevPercentRef.current;
    prevPercentRef.current = percent;

    // Only spawn bubbles when memory is increasing
    if (percentDiff > 0.5) {
      const newBubbleCount = Math.min(Math.ceil(percentDiff / 2), BUBBLE_COUNT_MAX);
      const newBubbles: Bubble[] = Array.from({ length: newBubbleCount }, () => ({
        id: bubbleIdRef.current++,
        x: 15 + Math.random() * 70, // Random x position (15-85%)
        size: 4 + Math.random() * 6, // Random size (4-10px)
        duration: 1.5 + Math.random() * 1, // Random duration (1.5-2.5s)
        delay: Math.random() * 0.3, // Random delay (0-0.3s)
      }));

      setBubbles((prev) => [...prev, ...newBubbles]);

      // Remove bubbles after animation completes
      const maxDuration = Math.max(...newBubbles.map((b) => b.duration + b.delay)) * 1000 + 500;
      setTimeout(() => {
        setBubbles((prev) => prev.filter((b) => !newBubbles.some((nb) => nb.id === b.id)));
      }, maxDuration);
    }
  }, [percent, prefersReducedMotion]);

  // Color configuration based on memory pressure
  const colors = useMemo(() => {
    if (percent >= 85) {
      return {
        primary: '#EF4444', // Red
        secondary: '#DC2626',
        glow: 'rgba(239, 68, 68, 0.4)',
        textClass: 'text-danger',
        gradient: 'from-red-600 via-red-500 to-rose-400',
      };
    }
    if (percent >= 60) {
      return {
        primary: '#9333EA', // Purple
        secondary: '#7C3AED',
        glow: 'rgba(147, 51, 234, 0.4)',
        textClass: 'text-warning',
        gradient: 'from-purple-600 via-violet-500 to-purple-400',
      };
    }
    return {
      primary: '#3B82F6', // Blue
      secondary: '#2563EB',
      glow: 'rgba(59, 130, 246, 0.4)',
      textClass: 'text-success',
      gradient: 'from-blue-600 via-blue-500 to-cyan-400',
    };
  }, [percent]);

  // Wave amplitude increases with memory pressure
  const waveAmplitude = useMemo(() => {
    if (percent >= 80) return WAVE_AMPLITUDE_HIGH;
    if (percent >= 60) return WAVE_AMPLITUDE_BASE + 2;
    return WAVE_AMPLITUDE_BASE;
  }, [percent]);

  // SVG path for the liquid surface with wave effect
  const generateWavePath = (amplitude: number, offset: number = 0) => {
    const width = 100;
    const points: string[] = [];
    const segments = 20;

    for (let i = 0; i <= segments; i++) {
      const x = (i / segments) * width;
      const y = Math.sin((i / segments) * Math.PI * 2 + offset) * amplitude;
      points.push(`${i === 0 ? 'M' : 'L'} ${x} ${y}`);
    }

    // Close the path to fill below the wave
    points.push(`L ${width} 100 L 0 100 Z`);
    return points.join(' ');
  };

  return (
    <motion.div
      className="flex flex-col gap-4 w-full"
      role="meter"
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Memory usage: ${usedGb.toFixed(1)} GB of ${totalGb.toFixed(1)} GB (${Math.round(percent)} percent)`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={prefersReducedMotion ? { duration: 0 } : springs.smooth}
    >
      {/* Header */}
      <motion.div
        className="flex items-center justify-between"
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={prefersReducedMotion ? { duration: 0 } : { delay: 0.1, ...springs.gentle }}
      >
        <div className="flex items-baseline gap-2">
          <span className={cn('text-3xl font-bold tabular-nums', colors.textClass)}>
            {Math.round(percent)}
            <span className="text-lg">%</span>
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground/60 font-medium uppercase tracking-wider">
          RAM
        </span>
      </motion.div>

      {/* Liquid Container */}
      <div
        className={cn(
          'relative h-24 w-full rounded-xl overflow-hidden',
          'bg-[#05030a]/60 backdrop-blur-lg',
          'border border-white/[0.06]'
        )}
      >
        {/* Ambient glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at 50% 100%, ${colors.glow} 0%, transparent 60%)`,
          }}
        />

        {/* Liquid fill */}
        <motion.div
          className="absolute inset-x-0 bottom-0 overflow-hidden"
          style={{
            height: `${percent}%`,
          }}
          initial={{ height: '0%' }}
          animate={{ height: `${percent}%` }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Liquid gradient background */}
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(180deg, ${colors.primary}40 0%, ${colors.secondary}80 100%)`,
            }}
          />

          {/* Wave surface - top layer */}
          {!prefersReducedMotion && (
            <>
              <motion.svg
                className="absolute inset-x-0 top-0 w-full"
                viewBox="0 0 100 20"
                preserveAspectRatio="none"
                style={{ height: '20px', marginTop: '-10px' }}
                initial={{ x: 0 }}
                animate={{ x: [0, -50, 0] }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: 'linear',
                }}
              >
                <motion.path
                  d={generateWavePath(waveAmplitude, 0)}
                  fill={colors.primary}
                  fillOpacity={0.6}
                  animate={{ d: generateWavePath(waveAmplitude, Math.PI) }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    repeatType: 'reverse',
                    ease: 'easeInOut',
                  }}
                />
              </motion.svg>

              {/* Second wave layer for depth */}
              <motion.svg
                className="absolute inset-x-0 top-0 w-full"
                viewBox="0 0 100 20"
                preserveAspectRatio="none"
                style={{ height: '20px', marginTop: '-8px' }}
                initial={{ x: 0 }}
                animate={{ x: [0, 30, 0] }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: 'linear',
                }}
              >
                <motion.path
                  d={generateWavePath(waveAmplitude * 0.6, Math.PI / 2)}
                  fill={colors.secondary}
                  fillOpacity={0.4}
                  animate={{ d: generateWavePath(waveAmplitude * 0.6, Math.PI * 1.5) }}
                  transition={{
                    duration: 2.5,
                    repeat: Infinity,
                    repeatType: 'reverse',
                    ease: 'easeInOut',
                  }}
                />
              </motion.svg>
            </>
          )}

          {/* Bubbles */}
          <AnimatePresence>
            {bubbles.map((bubble) => (
              <motion.div
                key={bubble.id}
                className="absolute rounded-full"
                style={{
                  left: `${bubble.x}%`,
                  width: bubble.size,
                  height: bubble.size,
                  background: `radial-gradient(circle at 30% 30%, white 0%, ${colors.primary}60 100%)`,
                  boxShadow: `0 0 ${bubble.size / 2}px ${colors.glow}`,
                }}
                initial={{ bottom: 0, opacity: 0, scale: 0 }}
                animate={{
                  bottom: '100%',
                  opacity: [0, 0.8, 0.8, 0],
                  scale: [0.5, 1, 1, 0.5],
                }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: bubble.duration,
                  delay: bubble.delay,
                  ease: 'easeOut',
                }}
              />
            ))}
          </AnimatePresence>

          {/* Surface tension highlight */}
          <div
            className="absolute inset-x-0 top-0 h-1"
            style={{
              background: `linear-gradient(90deg, transparent 0%, ${colors.primary}60 50%, transparent 100%)`,
            }}
          />
        </motion.div>

        {/* Glass reflection overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, transparent 50%)',
          }}
        />

        {/* Memory pressure indicator lines */}
        <div className="absolute inset-0 pointer-events-none">
          {[25, 50, 75].map((line) => (
            <div
              key={line}
              className="absolute inset-x-0 border-t border-white/[0.04]"
              style={{ bottom: `${line}%` }}
            />
          ))}
        </div>
      </div>

      {/* Stats */}
      <motion.div
        className="flex items-center justify-center gap-2 text-xs"
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={prefersReducedMotion ? { duration: 0 } : { delay: 0.3, ...springs.gentle }}
      >
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full bg-primary/60',
            'shadow-[0_0_6px_rgba(168,85,247,0.4)]'
          )}
        />
        <span className="text-foreground/80 font-medium tabular-nums">{usedGb.toFixed(1)} GB</span>
        <span className="text-muted-foreground/40">/</span>
        <span className="text-muted-foreground/70 tabular-nums">{totalGb.toFixed(1)} GB</span>
      </motion.div>
    </motion.div>
  );
});

export default MemoryMeter;
