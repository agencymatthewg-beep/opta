/**
 * OptaRingFallback - PNG/CSS Fallback for Non-WebGL Browsers
 *
 * Provides a fully functional OptaRing component that works without WebGL.
 * Uses PNG images with CSS animations as a fallback when:
 * - WebGL is not available
 * - Hardware tier is 'fallback'
 * - User prefers reduced motion
 *
 * Features:
 * - Original PNG OptaRing images (0% and 50% states)
 * - CSS-only animations (no WebGL/Canvas)
 * - No particles or complex effects
 * - Simplified glass effects via CSS backdrop-filter
 * - Full accessibility support
 *
 * @see DESIGN_SYSTEM.md - Part 9: The Opta Ring
 */

import { memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/useReducedMotion';

// Import ring state images
import opta0Percent from '@/assets/branding/opta-0-percent.png';
import opta50Percent from '@/assets/branding/opta-50-percent.png';

// =============================================================================
// TYPES
// =============================================================================

export type RingState = 'dormant' | 'active' | 'processing';
export type RingSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'hero';
export type RingPosition = 'inline' | 'centered' | 'floating';

export interface OptaRingFallbackProps {
  /** Current state of the ring */
  state?: RingState;
  /** Size of the ring */
  size?: RingSize;
  /** Position styling */
  position?: RingPosition;
  /** Whether to show a breathing animation when dormant */
  breathe?: boolean;
  /** Callback when state transition completes */
  onTransitionComplete?: () => void;
  /** Additional CSS classes */
  className?: string;
  /** Click handler */
  onClick?: () => void;
  /** Accessibility label override */
  ariaLabel?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const SIZE_CLASSES: Record<RingSize, string> = {
  xs: 'w-6 h-6',
  sm: 'w-10 h-10',
  md: 'w-16 h-16',
  lg: 'w-24 h-24',
  xl: 'w-32 h-32',
  hero: 'w-48 h-48 md:w-64 md:h-64',
};

const POSITION_CLASSES: Record<RingPosition, string> = {
  inline: '',
  centered: 'mx-auto',
  floating: 'fixed z-50',
};

// CSS keyframe animation names (defined in index.css or via Tailwind config)
const GLOW_KEYFRAMES = `
  @keyframes opta-glow-pulse {
    0%, 100% {
      filter: drop-shadow(0 0 15px rgba(168, 85, 247, 0.3));
    }
    50% {
      filter: drop-shadow(0 0 50px rgba(168, 85, 247, 0.7));
    }
  }
  @keyframes opta-breathe {
    0%, 100% {
      filter: drop-shadow(0 0 10px rgba(168, 85, 247, 0.15)) brightness(0.9);
    }
    50% {
      filter: drop-shadow(0 0 25px rgba(168, 85, 247, 0.35)) brightness(1);
    }
  }
`;

// =============================================================================
// ANIMATION VARIANTS (Framer Motion)
// =============================================================================

const overlayVariants = {
  dormant: {
    opacity: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
  },
  active: {
    opacity: 1,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
  },
  processing: {
    opacity: [0.3, 0.9, 0.3],
    transition: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' as const },
  },
};

const reducedMotionOverlayVariants = {
  dormant: { opacity: 0, transition: { duration: 0.1 } },
  active: { opacity: 1, transition: { duration: 0.1 } },
  processing: { opacity: 0.6, transition: { duration: 0.1 } },
};

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * OptaRingFallback - CSS-only ring component for maximum compatibility
 *
 * @example
 * ```tsx
 * // Basic usage
 * <OptaRingFallback state="dormant" size="lg" />
 *
 * // Loading state
 * <OptaRingFallback state="processing" size="md" />
 *
 * // Interactive
 * <OptaRingFallback
 *   state="dormant"
 *   size="xl"
 *   onClick={() => console.log('clicked')}
 * />
 * ```
 */
export const OptaRingFallback = memo(function OptaRingFallback({
  state = 'dormant',
  size = 'md',
  position = 'inline',
  breathe = true,
  onTransitionComplete,
  className,
  onClick,
  ariaLabel,
}: OptaRingFallbackProps) {
  const prefersReducedMotion = useReducedMotion();

  // Determine glow style based on state
  const glowStyle = useMemo(() => {
    // No glow animations for reduced motion
    if (prefersReducedMotion) {
      switch (state) {
        case 'active':
          return { filter: 'drop-shadow(0 0 30px rgba(168, 85, 247, 0.5))' };
        case 'processing':
          return { filter: 'drop-shadow(0 0 25px rgba(168, 85, 247, 0.4))' };
        default:
          return { filter: 'drop-shadow(0 0 10px rgba(168, 85, 247, 0.15))' };
      }
    }

    // Animated glow for normal motion
    switch (state) {
      case 'active':
        return { filter: 'drop-shadow(0 0 40px rgba(168, 85, 247, 0.6))' };
      case 'processing':
        return {
          animation: 'opta-glow-pulse 1.5s ease-in-out infinite',
        };
      case 'dormant':
        return breathe
          ? { animation: 'opta-breathe 3s ease-in-out infinite' }
          : { filter: 'drop-shadow(0 0 10px rgba(168, 85, 247, 0.15))' };
      default:
        return {};
    }
  }, [state, breathe, prefersReducedMotion]);

  // Select animation variants based on reduced motion preference
  const activeVariants = prefersReducedMotion
    ? reducedMotionOverlayVariants
    : overlayVariants;

  // Accessibility label
  const accessibilityLabel = ariaLabel || getAccessibilityLabel(state);

  return (
    <>
      {/* Inject keyframe animations (only on client) */}
      {typeof window !== 'undefined' && !prefersReducedMotion && (
        <style dangerouslySetInnerHTML={{ __html: GLOW_KEYFRAMES }} />
      )}

      <motion.div
        className={cn(
          'relative select-none',
          SIZE_CLASSES[size],
          POSITION_CLASSES[position],
          onClick && 'cursor-pointer',
          className
        )}
        onClick={onClick}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={
          prefersReducedMotion
            ? { duration: 0.1 }
            : { duration: 0.5, ease: [0.22, 1, 0.36, 1] }
        }
        role={onClick ? 'button' : 'img'}
        tabIndex={onClick ? 0 : undefined}
        aria-label={accessibilityLabel}
        onKeyDown={(e) => {
          if (onClick && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onClick();
          }
        }}
      >
        {/* Glow container */}
        <div className="relative w-full h-full" style={glowStyle}>
          {/* 0% State - Always visible base layer (dark obsidian) */}
          <img
            src={opta0Percent}
            alt=""
            className="absolute inset-0 w-full h-full object-contain"
            draggable={false}
          />

          {/* 50% State - Overlay layer with controlled opacity */}
          <AnimatePresence mode="wait">
            <motion.img
              key={state}
              src={opta50Percent}
              alt=""
              className="absolute inset-0 w-full h-full object-contain"
              variants={activeVariants}
              initial="dormant"
              animate={state}
              exit="dormant"
              onAnimationComplete={onTransitionComplete}
              draggable={false}
            />
          </AnimatePresence>
        </div>

        {/* Screen reader label (hidden visually) */}
        <span className="sr-only">{accessibilityLabel}</span>
      </motion.div>
    </>
  );
});

// =============================================================================
// CONVENIENCE COMPONENTS
// =============================================================================

/**
 * OptaRingFallbackLoader - Convenience component for loading states
 * Uses processing state with appropriate accessibility.
 */
export const OptaRingFallbackLoader = memo(function OptaRingFallbackLoader({
  size = 'md',
  className,
}: {
  size?: RingSize;
  className?: string;
}) {
  return (
    <OptaRingFallback
      state="processing"
      size={size}
      breathe={false}
      className={className}
      ariaLabel="Loading"
    />
  );
});

/**
 * OptaRingFallbackButton - Ring that acts as a clickable button
 */
export const OptaRingFallbackButton = memo(function OptaRingFallbackButton({
  children,
  onClick,
  size = 'lg',
  className,
}: {
  children?: React.ReactNode;
  onClick?: () => void;
  size?: RingSize;
  className?: string;
}) {
  return (
    <motion.button
      className={cn('relative group', className)}
      onClick={onClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <OptaRingFallback state="dormant" size={size} breathe />
      {children && (
        <div className="absolute inset-0 flex items-center justify-center text-white font-semibold">
          {children}
        </div>
      )}
    </motion.button>
  );
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get accessibility label based on ring state
 */
function getAccessibilityLabel(state: RingState): string {
  switch (state) {
    case 'processing':
      return 'Opta Ring - Loading';
    case 'active':
      return 'Opta Ring - Active';
    case 'dormant':
    default:
      return 'Opta Ring - Ready';
  }
}

/**
 * Static fallback for SSR or when JavaScript is disabled
 * Returns a simple div with CSS that mimics the ring appearance
 */
export function StaticRingFallback({
  size = 'md',
  className,
}: {
  size?: RingSize;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'relative select-none',
        SIZE_CLASSES[size],
        className
      )}
      role="img"
      aria-label="Opta Ring"
    >
      <img
        src={opta0Percent}
        alt="Opta Ring"
        className="w-full h-full object-contain"
        style={{ filter: 'drop-shadow(0 0 10px rgba(168, 85, 247, 0.15))' }}
      />
    </div>
  );
}

export default OptaRingFallback;
