/**
 * PulseRing Component
 *
 * Animated pulse ring effect for optimization feedback.
 * Features expanding concentric circles with wave effect.
 *
 * Use cases:
 * - Around Stealth Mode button during optimization
 * - Score card when score improves
 * - Process termination feedback
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

export interface PulseRingProps {
  /** Show pulse animation */
  active?: boolean;
  /** CSS color or design system token */
  color?: string;
  /** Diameter in px */
  size?: number;
  /** Number of concentric rings (default 3) */
  pulseCount?: number;
  /** Animation duration in ms (default 2000) */
  duration?: number;
  /** Additional CSS classes */
  className?: string;
  /** Ring stroke width */
  strokeWidth?: number;
  /** Opacity of rings (0-1) */
  opacity?: number;
}

// =============================================================================
// RING COMPONENT
// =============================================================================

interface RingProps {
  index: number;
  totalRings: number;
  size: number;
  color: string;
  duration: number;
  strokeWidth: number;
  opacity: number;
  reducedMotion: boolean;
}

function Ring({
  index,
  totalRings,
  size,
  color,
  duration,
  strokeWidth,
  opacity,
  reducedMotion,
}: RingProps) {
  // Calculate stagger delay for wave effect
  const delay = (index / totalRings) * (duration / 1000);

  // Ring starts at 30% of full size and expands to 100%
  const initialScale = 0.3;
  const finalScale = 1;

  // Animation variants
  const ringVariants = {
    initial: {
      scale: initialScale,
      opacity: opacity,
    },
    animate: {
      scale: finalScale,
      opacity: 0,
      transition: {
        duration: reducedMotion ? 0 : duration / 1000,
        delay: reducedMotion ? 0 : delay,
        repeat: reducedMotion ? 0 : Infinity,
        ease: 'easeOut' as const,
      },
    },
  };

  const center = size / 2;
  const radius = (size / 2) - strokeWidth;

  // For reduced motion, show static rings at different sizes
  if (reducedMotion) {
    const staticScale = initialScale + (index / totalRings) * (finalScale - initialScale);
    const staticOpacity = opacity * (1 - index / totalRings);

    return (
      <circle
        cx={center}
        cy={center}
        r={radius * staticScale}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        opacity={staticOpacity}
        style={{ filter: 'blur(2px)' }}
      />
    );
  }

  return (
    <motion.circle
      cx={center}
      cy={center}
      r={radius}
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      variants={ringVariants}
      initial="initial"
      animate="animate"
      style={{
        filter: 'blur(2px)',
        transformOrigin: `${center}px ${center}px`,
      }}
    />
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function PulseRing({
  active = false,
  color = 'var(--primary)',
  size = 100,
  pulseCount = 3,
  duration = 2000,
  className,
  strokeWidth = 2,
  opacity = 0.6,
}: PulseRingProps) {
  const prefersReducedMotion = useReducedMotion();

  // Resolve CSS variable color if needed
  const resolvedColor = useMemo(() => {
    if (color.startsWith('var(')) {
      // Return the CSS variable as-is, browser will resolve it
      return color;
    }
    return color;
  }, [color]);

  // Generate ring indices
  const ringIndices = useMemo(() => {
    return Array.from({ length: pulseCount }, (_, i) => i);
  }, [pulseCount]);

  return (
    <div
      className={cn(
        'absolute inset-0 pointer-events-none flex items-center justify-center',
        className
      )}
    >
      <AnimatePresence>
        {active && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute"
            style={{ width: size, height: size }}
          >
            <svg
              width={size}
              height={size}
              viewBox={`0 0 ${size} ${size}`}
              className="overflow-visible"
            >
              {/* Glow filter for enhanced visual effect */}
              <defs>
                <filter id="pulseGlow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Render concentric rings */}
              <g filter="url(#pulseGlow)">
                {ringIndices.map((index) => (
                  <Ring
                    key={index}
                    index={index}
                    totalRings={pulseCount}
                    size={size}
                    color={resolvedColor}
                    duration={duration}
                    strokeWidth={strokeWidth}
                    opacity={opacity}
                    reducedMotion={prefersReducedMotion}
                  />
                ))}
              </g>
            </svg>
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
 * Success pulse ring (green, faster)
 */
export function SuccessPulseRing(props: Omit<PulseRingProps, 'color' | 'duration'>) {
  return (
    <PulseRing
      color="var(--success)"
      duration={1500}
      pulseCount={4}
      {...props}
    />
  );
}

/**
 * Warning pulse ring (amber, medium speed)
 */
export function WarningPulseRing(props: Omit<PulseRingProps, 'color'>) {
  return (
    <PulseRing
      color="var(--warning)"
      {...props}
    />
  );
}

/**
 * Danger pulse ring (red, faster)
 */
export function DangerPulseRing(props: Omit<PulseRingProps, 'color' | 'duration'>) {
  return (
    <PulseRing
      color="var(--destructive)"
      duration={1200}
      pulseCount={4}
      {...props}
    />
  );
}

/**
 * Primary pulse ring (purple)
 */
export function PrimaryPulseRing(props: Omit<PulseRingProps, 'color'>) {
  return (
    <PulseRing
      color="var(--primary)"
      {...props}
    />
  );
}

export default PulseRing;
