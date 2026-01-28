/**
 * ChromaticLoading Component
 *
 * CSS filter-based chromatic aberration effect for loading screens.
 * Splits RGB channels with slight offset to create a premium glitch effect.
 *
 * Effect details:
 * - Red channel: translate(-2px, 0)
 * - Blue channel: translate(2px, 0)
 * - Green channel: no offset (base)
 * - Animated offset pulses 0 -> 3px -> 0
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

export interface ChromaticLoadingProps {
  /** Content to render with chromatic effect */
  children: React.ReactNode;
  /** Whether the loading state is active */
  isLoading: boolean;
  /** Intensity of the chromatic effect (0-1, default 0.5) */
  intensity?: number;
  /** Animation speed in seconds (default 1) */
  speed?: number;
  /** Additional CSS classes */
  className?: string;
  /** Callback when loading animation completes */
  onAnimationComplete?: () => void;
}

// =============================================================================
// CHROMATIC LAYER COMPONENT
// =============================================================================

interface ChromaticLayerProps {
  color: 'red' | 'blue';
  offset: number;
  speed: number;
  reducedMotion: boolean;
}

function ChromaticLayer({ color, offset, speed, reducedMotion }: ChromaticLayerProps) {
  // Direction based on color channel
  const direction = color === 'red' ? -1 : 1;
  const colorValue = color === 'red' ? '#ff0000' : '#0000ff';

  // Animation values
  const maxOffset = offset * direction;

  if (reducedMotion) {
    // Static offset for reduced motion
    return (
      <div
        className="absolute inset-0 mix-blend-screen pointer-events-none"
        style={{
          backgroundColor: colorValue,
          opacity: 0.15,
          transform: `translateX(${maxOffset * 0.5}px)`,
          filter: `blur(${Math.abs(offset) * 0.5}px)`,
        }}
      />
    );
  }

  return (
    <motion.div
      className="absolute inset-0 mix-blend-screen pointer-events-none"
      style={{
        backgroundColor: colorValue,
      }}
      initial={{
        opacity: 0.1,
        x: 0,
        filter: 'blur(0px)',
      }}
      animate={{
        opacity: [0.08, 0.2, 0.08],
        x: [0, maxOffset, 0],
        filter: [`blur(0px)`, `blur(${Math.abs(offset) * 0.5}px)`, `blur(0px)`],
      }}
      transition={{
        duration: speed,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function ChromaticLoading({
  children,
  isLoading,
  intensity = 0.5,
  speed = 1,
  className,
  onAnimationComplete,
}: ChromaticLoadingProps) {
  const prefersReducedMotion = useReducedMotion();

  // Calculate offset based on intensity (0-1 maps to 0-3px)
  const offset = useMemo(() => {
    const baseOffset = 2; // Base offset of 2px
    const maxOffset = 3; // Max offset of 3px at full intensity
    return baseOffset + (maxOffset - baseOffset) * intensity;
  }, [intensity]);

  // If reduced motion is preferred and not loading, skip effect entirely
  if (prefersReducedMotion && !isLoading) {
    return (
      <div className={cn('relative', className)}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      className={cn('relative overflow-hidden', className)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onAnimationComplete={() => {
        if (!isLoading && onAnimationComplete) {
          onAnimationComplete();
        }
      }}
    >
      {/* Main content layer */}
      <div className="relative z-10">
        {children}
      </div>

      {/* Chromatic aberration overlay */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            className="absolute inset-0 z-20 pointer-events-none overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Red channel - shifts left */}
            <ChromaticLayer
              color="red"
              offset={offset}
              speed={speed}
              reducedMotion={prefersReducedMotion}
            />

            {/* Blue channel - shifts right */}
            <ChromaticLayer
              color="blue"
              offset={offset}
              speed={speed}
              reducedMotion={prefersReducedMotion}
            />

            {/* Optional: subtle noise overlay for texture */}
            <div
              className="absolute inset-0 opacity-[0.02] pointer-events-none"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading indicator pulse glow */}
      <AnimatePresence>
        {isLoading && !prefersReducedMotion && (
          <motion.div
            className="absolute inset-0 z-0 pointer-events-none rounded-inherit"
            initial={{ opacity: 0 }}
            animate={{
              opacity: [0, 0.3, 0],
              boxShadow: [
                'inset 0 0 0px rgba(147, 51, 234, 0)',
                'inset 0 0 30px rgba(147, 51, 234, 0.3)',
                'inset 0 0 0px rgba(147, 51, 234, 0)',
              ],
            }}
            exit={{ opacity: 0 }}
            transition={{
              duration: speed * 1.5,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// =============================================================================
// PRESET VARIANTS
// =============================================================================

/**
 * Subtle chromatic loading effect
 */
export function SubtleChromaticLoading(
  props: Omit<ChromaticLoadingProps, 'intensity'>
) {
  return <ChromaticLoading intensity={0.3} {...props} />;
}

/**
 * Intense chromatic loading effect
 */
export function IntenseChromaticLoading(
  props: Omit<ChromaticLoadingProps, 'intensity'>
) {
  return <ChromaticLoading intensity={0.8} {...props} />;
}

/**
 * Fast chromatic loading effect
 */
export function FastChromaticLoading(
  props: Omit<ChromaticLoadingProps, 'speed'>
) {
  return <ChromaticLoading speed={0.5} {...props} />;
}

export default ChromaticLoading;
