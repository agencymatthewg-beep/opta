/**
 * ScanLines Component
 *
 * Horizontal scan line effect inspired by TRON and CRT monitors.
 * Creates a retro-futuristic loading aesthetic.
 *
 * Effect details:
 * - Repeating horizontal lines via CSS gradient
 * - Line height: 2px, gap: 4px
 * - Color: white at 3% opacity
 * - Animation: translateY from 0 to -6px (loop)
 * - Speed: 50ms per step for retro CRT feel
 *
 * @see DESIGN_SYSTEM.md - Premium Visual Effects
 */

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/useReducedMotion';

// =============================================================================
// TYPES
// =============================================================================

export interface ScanLinesProps {
  /** Whether scan lines are visible */
  active?: boolean;
  /** Line opacity (0-1, default 0.03) */
  opacity?: number;
  /** Line height in pixels (default 2) */
  lineHeight?: number;
  /** Gap between lines in pixels (default 4) */
  gap?: number;
  /** Animation speed in ms per step (default 50) */
  stepSpeed?: number;
  /** Line color (default white) */
  color?: string;
  /** Additional CSS classes */
  className?: string;
  /** Children to render beneath scan lines */
  children?: React.ReactNode;
}

// =============================================================================
// SCAN LINE OVERLAY
// =============================================================================

interface ScanLineOverlayProps {
  opacity: number;
  lineHeight: number;
  gap: number;
  stepSpeed: number;
  color: string;
  reducedMotion: boolean;
}

function ScanLineOverlay({
  opacity,
  lineHeight,
  gap,
  stepSpeed,
  color,
  reducedMotion,
}: ScanLineOverlayProps) {
  // Calculate total pattern height for seamless loop
  const patternHeight = lineHeight + gap;

  // Convert color to rgba with opacity
  const lineColor = useMemo(() => {
    // Handle hex colors
    if (color.startsWith('#')) {
      const hex = color.slice(1);
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }
    // Handle rgb/rgba colors
    if (color.startsWith('rgb')) {
      const match = color.match(/\d+/g);
      if (match) {
        const [r, g, b] = match;
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
      }
    }
    // Default to white
    return `rgba(255, 255, 255, ${opacity})`;
  }, [color, opacity]);

  // Create the repeating gradient pattern
  const gradientPattern = `repeating-linear-gradient(
    0deg,
    ${lineColor} 0px,
    ${lineColor} ${lineHeight}px,
    transparent ${lineHeight}px,
    transparent ${patternHeight}px
  )`;

  // Static version for reduced motion
  if (reducedMotion) {
    return (
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: gradientPattern,
        }}
      />
    );
  }

  // Animated version with vertical scrolling
  return (
    <motion.div
      className="absolute inset-0 pointer-events-none"
      style={{
        background: gradientPattern,
        backgroundSize: `100% ${patternHeight * 2}px`,
      }}
      initial={{ backgroundPositionY: 0 }}
      animate={{ backgroundPositionY: -patternHeight }}
      transition={{
        duration: (stepSpeed * patternHeight) / 1000,
        repeat: Infinity,
        ease: 'linear',
      }}
    />
  );
}

// =============================================================================
// FLICKER EFFECT
// =============================================================================

interface FlickerOverlayProps {
  reducedMotion: boolean;
}

function FlickerOverlay({ reducedMotion }: FlickerOverlayProps) {
  if (reducedMotion) return null;

  return (
    <motion.div
      className="absolute inset-0 pointer-events-none bg-white"
      initial={{ opacity: 0 }}
      animate={{
        opacity: [0, 0.01, 0, 0.02, 0, 0, 0.01, 0],
      }}
      transition={{
        duration: 0.5,
        repeat: Infinity,
        ease: 'linear',
        times: [0, 0.1, 0.15, 0.3, 0.35, 0.7, 0.85, 1],
      }}
    />
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function ScanLines({
  active = true,
  opacity = 0.03,
  lineHeight = 2,
  gap = 4,
  stepSpeed = 50,
  color = '#ffffff',
  className,
  children,
}: ScanLinesProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className={cn('relative overflow-hidden', className)}>
      {/* Content layer */}
      {children}

      {/* Scan lines overlay */}
      <AnimatePresence>
        {active && (
          <motion.div
            className="absolute inset-0 z-10 pointer-events-none overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Main scan lines */}
            <ScanLineOverlay
              opacity={opacity}
              lineHeight={lineHeight}
              gap={gap}
              stepSpeed={stepSpeed}
              color={color}
              reducedMotion={prefersReducedMotion}
            />

            {/* Subtle CRT flicker */}
            <FlickerOverlay reducedMotion={prefersReducedMotion} />

            {/* Vignette effect for CRT authenticity */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: `radial-gradient(
                  ellipse at center,
                  transparent 60%,
                  rgba(0, 0, 0, 0.15) 100%
                )`,
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// =============================================================================
// PRESET VARIANTS
// =============================================================================

/**
 * Heavy scan lines for dramatic effect
 */
export function HeavyScanLines(
  props: Omit<ScanLinesProps, 'opacity' | 'lineHeight'>
) {
  return <ScanLines opacity={0.06} lineHeight={3} {...props} />;
}

/**
 * Subtle scan lines for ambient effect
 */
export function SubtleScanLines(
  props: Omit<ScanLinesProps, 'opacity'>
) {
  return <ScanLines opacity={0.015} {...props} />;
}

/**
 * Fast scan lines for loading states
 */
export function FastScanLines(
  props: Omit<ScanLinesProps, 'stepSpeed'>
) {
  return <ScanLines stepSpeed={30} {...props} />;
}

/**
 * Purple-tinted scan lines matching Opta brand
 */
export function PurpleScanLines(
  props: Omit<ScanLinesProps, 'color' | 'opacity'>
) {
  return <ScanLines color="#9333EA" opacity={0.04} {...props} />;
}

// =============================================================================
// STANDALONE SCAN LINE BACKGROUND
// =============================================================================

export interface ScanLineBackgroundProps {
  /** Whether effect is active */
  active?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Full-screen scan line background overlay
 * Use sparingly for loading screens or cinematic moments
 */
export function ScanLineBackground({
  active = true,
  className,
}: ScanLineBackgroundProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          className={cn(
            'fixed inset-0 z-50 pointer-events-none overflow-hidden',
            className
          )}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          <ScanLineOverlay
            opacity={0.025}
            lineHeight={2}
            gap={4}
            stepSpeed={50}
            color="#ffffff"
            reducedMotion={prefersReducedMotion}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default ScanLines;
