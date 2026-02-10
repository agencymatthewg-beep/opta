/**
 * HoloShimmer Component
 *
 * Holographic shimmer effect for loading cards and premium elements.
 * Creates a rainbow gradient that moves across the surface.
 *
 * Effect details:
 * - Gradient: rainbow at 10% opacity
 * - Angle: 45deg, moving across surface
 * - Animation: translate -100% to 200% over 2s
 * - Trigger: only during loading state
 * - Blend mode: overlay
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

export interface HoloShimmerProps {
  /** Whether shimmer is active (typically during loading) */
  isLoading?: boolean;
  /** Shimmer opacity (0-1, default 0.1) */
  opacity?: number;
  /** Animation duration in seconds (default 2) */
  duration?: number;
  /** Gradient angle in degrees (default 45) */
  angle?: number;
  /** Blend mode for shimmer overlay (default 'overlay') */
  blendMode?: 'overlay' | 'soft-light' | 'screen' | 'hard-light';
  /** Additional CSS classes */
  className?: string;
  /** Children to render with shimmer effect */
  children: React.ReactNode;
  /** Delay before animation starts (in seconds) */
  delay?: number;
  /** Whether to show shimmer once or loop */
  loop?: boolean;
}

// =============================================================================
// HOLOGRAPHIC GRADIENT
// =============================================================================

/**
 * Creates the holographic rainbow gradient CSS
 */
function createHoloGradient(angle: number, opacity: number): string {
  // Rainbow colors with specified opacity
  const colors = [
    `rgba(255, 0, 0, ${opacity})`,      // Red
    `rgba(255, 127, 0, ${opacity})`,    // Orange
    `rgba(255, 255, 0, ${opacity})`,    // Yellow
    `rgba(0, 255, 0, ${opacity})`,      // Green
    `rgba(0, 0, 255, ${opacity})`,      // Blue
    `rgba(75, 0, 130, ${opacity})`,     // Indigo
    `rgba(148, 0, 211, ${opacity})`,    // Violet
    `rgba(255, 0, 0, ${opacity})`,      // Back to red for seamless loop
  ];

  const colorStops = colors.map((color, i) =>
    `${color} ${(i / (colors.length - 1)) * 100}%`
  ).join(', ');

  return `linear-gradient(${angle}deg, ${colorStops})`;
}

// =============================================================================
// SHIMMER OVERLAY
// =============================================================================

interface ShimmerOverlayProps {
  opacity: number;
  duration: number;
  angle: number;
  blendMode: string;
  reducedMotion: boolean;
  delay: number;
  loop: boolean;
}

function ShimmerOverlay({
  opacity,
  duration,
  angle,
  blendMode,
  reducedMotion,
  delay,
  loop,
}: ShimmerOverlayProps) {
  const gradient = useMemo(() => createHoloGradient(angle, opacity), [angle, opacity]);

  // Static version for reduced motion
  if (reducedMotion) {
    return (
      <div
        className="absolute inset-0 pointer-events-none rounded-inherit"
        style={{
          background: gradient,
          backgroundSize: '200% 100%',
          backgroundPosition: 'center',
          mixBlendMode: blendMode as React.CSSProperties['mixBlendMode'],
        }}
      />
    );
  }

  return (
    <motion.div
      className="absolute inset-0 pointer-events-none rounded-inherit"
      style={{
        background: gradient,
        backgroundSize: '300% 100%',
        mixBlendMode: blendMode as React.CSSProperties['mixBlendMode'],
      }}
      initial={{ backgroundPosition: '-100% 0%', opacity: 0 }}
      animate={{
        backgroundPosition: ['200% 0%'],
        opacity: [0, 1, 1, 0],
      }}
      transition={{
        duration,
        delay,
        repeat: loop ? Infinity : 0,
        repeatDelay: 0.5,
        ease: 'easeInOut',
        times: [0, 0.1, 0.9, 1],
      }}
    />
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function HoloShimmer({
  isLoading = false,
  opacity = 0.1,
  duration = 2,
  angle = 45,
  blendMode = 'overlay',
  className,
  children,
  delay = 0,
  loop = true,
}: HoloShimmerProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className={cn('relative overflow-hidden', className)}>
      {/* Content layer */}
      <div className="relative z-10">
        {children}
      </div>

      {/* Holographic shimmer overlay */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            className="absolute inset-0 z-20 pointer-events-none overflow-hidden rounded-inherit"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <ShimmerOverlay
              opacity={opacity}
              duration={duration}
              angle={angle}
              blendMode={blendMode}
              reducedMotion={prefersReducedMotion}
              delay={delay}
              loop={loop}
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
 * Subtle holographic shimmer
 */
export function SubtleHoloShimmer(
  props: Omit<HoloShimmerProps, 'opacity'>
) {
  return <HoloShimmer opacity={0.05} {...props} />;
}

/**
 * Intense holographic shimmer
 */
export function IntenseHoloShimmer(
  props: Omit<HoloShimmerProps, 'opacity'>
) {
  return <HoloShimmer opacity={0.2} {...props} />;
}

/**
 * Fast holographic shimmer
 */
export function FastHoloShimmer(
  props: Omit<HoloShimmerProps, 'duration'>
) {
  return <HoloShimmer duration={1} {...props} />;
}

/**
 * Purple-tinted shimmer matching Opta brand
 */
export function PurpleShimmer({
  children,
  isLoading = false,
  duration = 2,
  className,
  delay = 0,
  loop = true,
}: Omit<HoloShimmerProps, 'opacity' | 'angle' | 'blendMode'>) {
  const prefersReducedMotion = useReducedMotion();

  // Purple/violet gradient
  const gradient = `linear-gradient(
    45deg,
    rgba(147, 51, 234, 0) 0%,
    rgba(147, 51, 234, 0.15) 25%,
    rgba(139, 92, 246, 0.2) 50%,
    rgba(147, 51, 234, 0.15) 75%,
    rgba(147, 51, 234, 0) 100%
  )`;

  return (
    <div className={cn('relative overflow-hidden', className)}>
      <div className="relative z-10">
        {children}
      </div>

      <AnimatePresence>
        {isLoading && (
          <motion.div
            className="absolute inset-0 z-20 pointer-events-none overflow-hidden rounded-inherit"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <motion.div
              className="absolute inset-0 pointer-events-none rounded-inherit"
              style={{
                background: gradient,
                backgroundSize: '300% 100%',
              }}
              initial={{ backgroundPosition: '-100% 0%' }}
              animate={
                prefersReducedMotion
                  ? {}
                  : { backgroundPosition: ['200% 0%'] }
              }
              transition={{
                duration,
                delay,
                repeat: loop ? Infinity : 0,
                repeatDelay: 0.5,
                ease: 'easeInOut',
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// =============================================================================
// SKELETON SHIMMER (for loading skeletons)
// =============================================================================

export interface SkeletonShimmerProps {
  /** Width of skeleton element */
  width?: string | number;
  /** Height of skeleton element */
  height?: string | number;
  /** Border radius */
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
  /** Additional CSS classes */
  className?: string;
}

const roundedClasses = {
  none: '',
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  full: 'rounded-full',
};

/**
 * Standalone shimmer skeleton element
 */
export function SkeletonShimmer({
  width = '100%',
  height = 20,
  rounded = 'md',
  className,
}: SkeletonShimmerProps) {
  const prefersReducedMotion = useReducedMotion();

  const shimmerGradient = `linear-gradient(
    90deg,
    rgba(255, 255, 255, 0) 0%,
    rgba(255, 255, 255, 0.05) 50%,
    rgba(255, 255, 255, 0) 100%
  )`;

  return (
    <div
      className={cn(
        'bg-white/5 overflow-hidden',
        roundedClasses[rounded],
        className
      )}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
      }}
    >
      <motion.div
        className="w-full h-full"
        style={{
          background: shimmerGradient,
          backgroundSize: '200% 100%',
        }}
        initial={{ backgroundPosition: '-200% 0%' }}
        animate={
          prefersReducedMotion
            ? {}
            : { backgroundPosition: ['200% 0%'] }
        }
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    </div>
  );
}

export default HoloShimmer;
