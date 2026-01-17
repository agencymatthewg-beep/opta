/**
 * DiskMeter - The Holographic Storage Visualization
 *
 * Enhanced disk visualization featuring a 3D cylinder representation
 * with sectors that light up based on usage, data blocks that appear
 * with I/O activity, and a holographic grid overlay.
 *
 * Phase 36-04: Telemetry Visualization Upgrade
 * @see DESIGN_SYSTEM.md - Part 4: The Obsidian Glass Material System
 */

import { memo, useMemo, useState, useEffect, useRef } from 'react';
import { motion, useSpring, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { springs } from '@/lib/animation';

// Visualization configuration
const SECTOR_COUNT = 12;
const DATA_BLOCK_MAX = 6;

interface DataBlock {
  id: number;
  angle: number;
  radius: number;
  size: number;
  duration: number;
}

interface DiskMeterProps {
  usedGb: number;
  totalGb: number;
  percent: number;
  /** Optional: disk I/O activity (0-100) to trigger data block animations */
  ioActivity?: number;
}

/**
 * Holographic Disk Meter
 * Features:
 * - 3D cylinder/disk representation
 * - Sectors light up based on usage
 * - Data blocks appear/disappear with I/O
 * - Holographic grid overlay
 * - Rotation animation when disk is active
 */
const DiskMeter = memo(function DiskMeter({
  usedGb,
  totalGb,
  percent,
  ioActivity = 0,
}: DiskMeterProps) {
  const prefersReducedMotion = useReducedMotion();
  const [dataBlocks, setDataBlocks] = useState<DataBlock[]>([]);
  const blockIdRef = useRef(0);
  const prevIoRef = useRef(ioActivity);

  // Spring-animated percentage for smooth transitions
  useSpring(percent, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  // Rotation based on I/O activity
  const diskRotation = useSpring(0, {
    stiffness: 50,
    damping: 20,
  });


  // Simulate I/O activity with data blocks
  useEffect(() => {
    if (prefersReducedMotion) return;

    // Simulate I/O based on percentage changes
    const ioDiff = Math.abs(percent - prevIoRef.current);
    prevIoRef.current = percent;

    if (ioDiff > 0.5 || ioActivity > 10) {
      const blockCount = Math.min(Math.ceil(ioActivity / 20) + 1, DATA_BLOCK_MAX);

      const newBlocks: DataBlock[] = Array.from({ length: blockCount }, () => ({
        id: blockIdRef.current++,
        angle: Math.random() * 360,
        radius: 30 + Math.random() * 25,
        size: 4 + Math.random() * 4,
        duration: 0.8 + Math.random() * 0.6,
      }));

      setDataBlocks((prev) => [...prev, ...newBlocks]);

      // Rotate disk slightly with activity
      diskRotation.set(diskRotation.get() + 15);

      // Remove blocks after animation
      const maxDuration = Math.max(...newBlocks.map((b) => b.duration)) * 1000 + 200;
      setTimeout(() => {
        setDataBlocks((prev) => prev.filter((b) => !newBlocks.some((nb) => nb.id === b.id)));
      }, maxDuration);
    }
  }, [percent, ioActivity, prefersReducedMotion, diskRotation]);

  // Color configuration based on usage level
  const colors = useMemo(() => {
    if (percent >= 85) {
      return {
        primary: '#EF4444',
        secondary: '#DC2626',
        glow: 'rgba(239, 68, 68, 0.5)',
        grid: 'rgba(239, 68, 68, 0.2)',
        textClass: 'text-danger',
      };
    }
    if (percent >= 60) {
      return {
        primary: '#F59E0B',
        secondary: '#D97706',
        glow: 'rgba(245, 158, 11, 0.5)',
        grid: 'rgba(245, 158, 11, 0.2)',
        textClass: 'text-warning',
      };
    }
    return {
      primary: '#22C55E',
      secondary: '#16A34A',
      glow: 'rgba(34, 197, 94, 0.4)',
      grid: 'rgba(34, 197, 94, 0.2)',
      textClass: 'text-success',
    };
  }, [percent]);

  // Format size to show TB if >= 1000 GB
  const formatSize = (gb: number) => {
    if (gb >= 1000) {
      return `${(gb / 1000).toFixed(1)} TB`;
    }
    return `${gb.toFixed(0)} GB`;
  };

  // Generate sector paths
  const sectors = useMemo(() => {
    const centerX = 60;
    const centerY = 55;
    const innerRadius = 20;
    const outerRadius = 45;
    const gapAngle = 2; // Gap between sectors in degrees

    return Array.from({ length: SECTOR_COUNT }, (_, i) => {
      const startAngle = (i * 360) / SECTOR_COUNT + gapAngle / 2;
      const endAngle = ((i + 1) * 360) / SECTOR_COUNT - gapAngle / 2;

      const startRad = (startAngle * Math.PI) / 180;
      const endRad = (endAngle * Math.PI) / 180;

      const x1Inner = centerX + innerRadius * Math.cos(startRad);
      const y1Inner = centerY + innerRadius * Math.sin(startRad);
      const x1Outer = centerX + outerRadius * Math.cos(startRad);
      const y1Outer = centerY + outerRadius * Math.sin(startRad);
      const x2Inner = centerX + innerRadius * Math.cos(endRad);
      const y2Inner = centerY + innerRadius * Math.sin(endRad);
      const x2Outer = centerX + outerRadius * Math.cos(endRad);
      const y2Outer = centerY + outerRadius * Math.sin(endRad);

      const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;

      const path = [
        `M ${x1Inner} ${y1Inner}`,
        `L ${x1Outer} ${y1Outer}`,
        `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${x2Outer} ${y2Outer}`,
        `L ${x2Inner} ${y2Inner}`,
        `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${x1Inner} ${y1Inner}`,
        'Z',
      ].join(' ');

      return { path, index: i };
    });
  }, []);

  // Calculate filled sectors based on percentage
  const filledSectorCount = Math.ceil((percent / 100) * SECTOR_COUNT);

  const isActive = ioActivity > 5 || dataBlocks.length > 0;

  return (
    <motion.div
      className="flex flex-col gap-4 w-full"
      role="meter"
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Disk usage: ${formatSize(usedGb)} of ${formatSize(totalGb)} (${Math.round(percent)} percent)`}
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
          Disk
        </span>
      </motion.div>

      {/* Holographic Disk Visualization */}
      <div className="relative flex justify-center py-2">
        {/* Ambient glow */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          animate={{
            opacity: 0.3 + (percent / 100) * 0.3,
          }}
        >
          <div
            className="w-32 h-32 rounded-full blur-xl"
            style={{
              background: `radial-gradient(circle, ${colors.glow} 0%, transparent 70%)`,
            }}
          />
        </motion.div>

        {/* 3D Disk SVG */}
        <motion.svg
          className="w-32 h-32 relative z-10"
          viewBox="0 0 120 110"
          aria-hidden="true"
          style={{
            rotateZ: diskRotation,
          }}
        >
          <defs>
            {/* Holographic gradient */}
            <linearGradient id="diskHoloGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={colors.primary} stopOpacity="0.3" />
              <stop offset="50%" stopColor={colors.secondary} stopOpacity="0.5" />
              <stop offset="100%" stopColor={colors.primary} stopOpacity="0.3" />
            </linearGradient>

            {/* Glow filter */}
            <filter id="diskGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Grid pattern */}
            <pattern id="holoGrid" width="10" height="10" patternUnits="userSpaceOnUse">
              <path
                d="M 10 0 L 0 0 0 10"
                fill="none"
                stroke={colors.grid}
                strokeWidth="0.5"
              />
            </pattern>
          </defs>

          {/* 3D cylinder effect - bottom ellipse */}
          <ellipse
            cx="60"
            cy="85"
            rx="48"
            ry="12"
            fill="none"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="1"
          />

          {/* 3D cylinder side */}
          <path
            d="M 12 55 L 12 85 A 48 12 0 0 0 108 85 L 108 55"
            fill="url(#diskHoloGradient)"
            fillOpacity="0.2"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="1"
          />

          {/* Disk surface with sectors */}
          <g>
            {/* Disk background */}
            <ellipse
              cx="60"
              cy="55"
              rx="48"
              ry="12"
              fill="rgba(5,3,10,0.8)"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="1"
            />

            {/* Holographic grid overlay */}
            <ellipse
              cx="60"
              cy="55"
              rx="45"
              ry="11"
              fill="url(#holoGrid)"
              fillOpacity="0.3"
            />

            {/* Sectors */}
            <g transform="translate(0, -5) scale(1, 0.26)">
              {sectors.map(({ path, index }) => {
                const isFilled = index < filledSectorCount;
                const isPartial = index === filledSectorCount - 1 && percent % (100 / SECTOR_COUNT) !== 0;

                return (
                  <motion.path
                    key={index}
                    d={path}
                    fill={isFilled ? colors.primary : 'rgba(255,255,255,0.03)'}
                    fillOpacity={isFilled ? (isPartial ? 0.5 : 0.7) : 1}
                    stroke={isFilled ? colors.primary : 'rgba(255,255,255,0.08)'}
                    strokeWidth="0.5"
                    filter={isFilled ? 'url(#diskGlow)' : undefined}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{
                      delay: index * 0.05,
                      duration: 0.3,
                    }}
                  />
                );
              })}
            </g>

            {/* Center hub */}
            <ellipse
              cx="60"
              cy="55"
              rx="15"
              ry="4"
              fill="rgba(5,3,10,0.9)"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="1"
            />

            {/* Center hub hole */}
            <ellipse
              cx="60"
              cy="55"
              rx="5"
              ry="1.5"
              fill="rgba(0,0,0,0.5)"
            />
          </g>

          {/* Data blocks animation */}
          <AnimatePresence>
            {dataBlocks.map((block) => {
              const rad = (block.angle * Math.PI) / 180;
              const x = 60 + block.radius * Math.cos(rad) * 0.8;
              const y = 55 + block.radius * Math.sin(rad) * 0.2;

              return (
                <motion.rect
                  key={block.id}
                  x={x - block.size / 2}
                  y={y - block.size / 4}
                  width={block.size}
                  height={block.size / 2}
                  fill={colors.primary}
                  filter="url(#diskGlow)"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: [0, 1, 1, 0], scale: [0.5, 1, 1, 0.5] }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: block.duration, ease: 'easeInOut' }}
                />
              );
            })}
          </AnimatePresence>

          {/* Activity indicator - spinning ring */}
          {isActive && !prefersReducedMotion && (
            <motion.ellipse
              cx="60"
              cy="55"
              rx="48"
              ry="12"
              fill="none"
              stroke={colors.primary}
              strokeWidth="1"
              strokeDasharray="8 8"
              initial={{ strokeDashoffset: 0 }}
              animate={{ strokeDashoffset: -32 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              opacity={0.6}
            />
          )}
        </motion.svg>

        {/* Holographic scan line effect */}
        {!prefersReducedMotion && (
          <motion.div
            className="absolute inset-0 pointer-events-none overflow-hidden"
            style={{ perspective: '500px' }}
          >
            <motion.div
              className="absolute left-1/2 -translate-x-1/2 w-24 h-0.5"
              style={{
                background: `linear-gradient(90deg, transparent 0%, ${colors.primary}60 50%, transparent 100%)`,
                top: '50%',
              }}
              animate={{ y: [-20, 20, -20] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            />
          </motion.div>
        )}
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
            'w-1.5 h-1.5 rounded-full bg-accent/60',
            'shadow-[0_0_6px_rgba(147,51,234,0.4)]'
          )}
        />
        <span className="text-foreground/80 font-medium tabular-nums">{formatSize(usedGb)}</span>
        <span className="text-muted-foreground/40">/</span>
        <span className="text-muted-foreground/70 tabular-nums">{formatSize(totalGb)}</span>
      </motion.div>
    </motion.div>
  );
});

export default DiskMeter;
