import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAnimationVisibility } from '@/hooks/useAnimationVisibility';

// Import ring state images
import opta0Percent from '@/assets/branding/opta-0-percent.png';
import opta50Percent from '@/assets/branding/opta-50-percent.png';

// Re-export types from the canonical source
export type { RingState, RingSize } from '@/components/OptaRing3D/types';
import type { RingState, RingSize } from '@/components/OptaRing3D/types';

/**
 * OptaRing - The Protagonist of the Living Artifact (PNG-based 2D Version)
 *
 * The Opta Ring is the "AI brain" of the application. It sits dark and observant
 * in its dormant state (0%) until called upon, then ignites to its active state (50%).
 *
 * This is the legacy PNG-based implementation for simpler use cases where
 * full 3D rendering is not needed. For the complete experience with all 7 states,
 * glassmorphism shaders, and explosion effects, use OptaRing3D.
 *
 * ## State Mapping (7 states -> 4 visual states)
 * | RingState | Visual State | Description |
 * |-----------|--------------|-------------|
 * | dormant | dormant/breathe | Dark obsidian glass, faint glow |
 * | sleeping | dormant | Transitioning to dormant |
 * | waking | active | Transitioning to active |
 * | active | active | Internal plasma swirls, 50% brightness |
 * | processing | processing | Rhythmic pulse between 0% and 50% |
 * | exploding | active | Maps to active with glow |
 * | recovering | active | Maps to active with glow |
 *
 * @see DESIGN_SYSTEM.md - Part 9: The Opta Ring
 * @see OptaRing3D for the full 3D implementation
 */

// =============================================================================
// TYPES
// =============================================================================

/** Position styling options for the ring */
export type RingPosition = 'inline' | 'centered' | 'floating';

/** Visual state for PNG animation (simplified from 7-state RingState) */
type VisualState = 'dormant' | 'active' | 'processing' | 'breathe';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Easing curve for smooth deceleration (ease-out-expo approximation) */
const SMOOTH_OUT_EASING: [number, number, number, number] = [0.22, 1, 0.36, 1];

/** State transition duration in seconds */
const STATE_TRANSITION_DURATION_S = 0.6;

/** Processing pulse duration in seconds */
const PROCESSING_PULSE_DURATION_S = 1.5;

/** Breathing animation duration in seconds */
const BREATHING_DURATION_S = 3;

/** Processing opacity range [min, max, min] */
const PROCESSING_OPACITY_KEYFRAMES = [0.3, 0.9, 0.3];

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Maps extended RingState to visual state for PNG animation.
 * Reduces 7 states to 4 visual representations.
 *
 * @param state - The current RingState
 * @param breathe - Whether to apply breathing animation when dormant
 * @returns The mapped visual state for animation variants
 */
function mapToVisualState(state: RingState, breathe: boolean): VisualState {
  switch (state) {
    case 'dormant':
      return breathe ? 'breathe' : 'dormant';
    case 'sleeping':
      return 'dormant';
    case 'waking':
    case 'active':
    case 'exploding':
    case 'recovering':
      return 'active';
    case 'processing':
      return 'processing';
    default:
      return breathe ? 'breathe' : 'dormant';
  }
}

/**
 * Props for the OptaRing component.
 */
interface OptaRingProps {
  /**
   * Current state of the ring.
   * @default 'dormant'
   */
  state?: RingState;

  /**
   * Size of the ring using predefined scale.
   * @default 'md'
   */
  size?: RingSize;

  /**
   * Position styling mode.
   * @default 'inline'
   */
  position?: RingPosition;

  /**
   * Whether to show breathing animation when dormant.
   * Creates a subtle pulsing glow effect.
   * @default true
   */
  breathe?: boolean;

  /** Callback fired when state transition animation completes */
  onTransitionComplete?: () => void;

  /** Additional CSS classes */
  className?: string;

  /** Click handler for interactive ring */
  onClick?: () => void;
}

// =============================================================================
// STYLE MAPPINGS
// =============================================================================

/** CSS classes for each ring size */
const SIZE_CLASSES: Readonly<Record<RingSize, string>> = {
  xs: 'w-6 h-6',
  sm: 'w-10 h-10',
  md: 'w-16 h-16',
  lg: 'w-24 h-24',
  xl: 'w-32 h-32',
  hero: 'w-48 h-48 md:w-64 md:h-64',
} as const;

/** CSS classes for each position mode */
const POSITION_CLASSES: Readonly<Record<RingPosition, string>> = {
  inline: '',
  centered: 'mx-auto',
  floating: 'fixed z-50',
} as const;

// =============================================================================
// ANIMATION VARIANTS
// =============================================================================

/** Animation variants for the 50% overlay layer */
const overlayVariants = {
  dormant: {
    opacity: 0,
    transition: {
      duration: STATE_TRANSITION_DURATION_S,
      ease: SMOOTH_OUT_EASING,
    },
  },
  active: {
    opacity: 1,
    transition: {
      duration: STATE_TRANSITION_DURATION_S,
      ease: SMOOTH_OUT_EASING,
    },
  },
  processing: {
    opacity: PROCESSING_OPACITY_KEYFRAMES,
    transition: {
      duration: PROCESSING_PULSE_DURATION_S,
      repeat: Infinity,
      ease: 'easeInOut' as const,
    },
  },
};

/** Glow effect variants for state transitions */
const glowVariants = {
  dormant: {
    filter: 'drop-shadow(0 0 10px rgba(168, 85, 247, 0.15))',
    transition: {
      duration: STATE_TRANSITION_DURATION_S,
      ease: SMOOTH_OUT_EASING,
    },
  },
  active: {
    filter: 'drop-shadow(0 0 40px rgba(168, 85, 247, 0.6))',
    transition: {
      duration: STATE_TRANSITION_DURATION_S,
      ease: SMOOTH_OUT_EASING,
    },
  },
  processing: {
    filter: [
      'drop-shadow(0 0 15px rgba(168, 85, 247, 0.3))',
      'drop-shadow(0 0 50px rgba(168, 85, 247, 0.7))',
      'drop-shadow(0 0 15px rgba(168, 85, 247, 0.3))',
    ],
    transition: {
      duration: PROCESSING_PULSE_DURATION_S,
      repeat: Infinity,
      ease: 'easeInOut' as const,
    },
  },
};

/** Breathing animation variants for idle dormant state */
const breatheVariants = {
  breathe: {
    filter: [
      'drop-shadow(0 0 10px rgba(168, 85, 247, 0.15)) brightness(0.9)',
      'drop-shadow(0 0 25px rgba(168, 85, 247, 0.35)) brightness(1)',
      'drop-shadow(0 0 10px rgba(168, 85, 247, 0.15)) brightness(0.9)',
    ],
    transition: {
      duration: BREATHING_DURATION_S,
      repeat: Infinity,
      ease: 'easeInOut' as const,
    },
  },
};

// =============================================================================
// COMPONENT
// =============================================================================

export function OptaRing({
  state = 'dormant',
  size = 'md',
  position = 'inline',
  breathe = true,
  onTransitionComplete,
  className,
  onClick,
}: OptaRingProps): React.ReactNode {
  const { ref, isVisible } = useAnimationVisibility({ rootMargin: '100px' });

  // Map extended state to visual state for PNG animation
  const visualState = mapToVisualState(state, breathe);

  // Determine which variant set to use based on visual state
  // When not visible, disable infinite breathing/processing animations to save resources
  const useBreathVariants = visualState === 'breathe' && isVisible;

  // For processing/breathe states, fall back to dormant when not visible
  const effectiveVisualState = !isVisible && (visualState === 'processing' || visualState === 'breathe')
    ? 'dormant'
    : visualState;

  return (
    <motion.div
      ref={ref}
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
      transition={{ duration: 0.5, ease: SMOOTH_OUT_EASING }}
    >
      {/* Glow container */}
      <motion.div
        className="relative w-full h-full"
        variants={useBreathVariants ? breatheVariants : glowVariants}
        animate={effectiveVisualState}
        onAnimationComplete={onTransitionComplete}
      >
        {/* 0% State - Always visible base layer (dark obsidian) */}
        <img
          src={opta0Percent}
          alt=""
          className="absolute inset-0 w-full h-full object-contain"
          draggable={false}
        />

        {/* 50% State - Overlay layer with controlled opacity */}
        <motion.img
          src={opta50Percent}
          alt=""
          className="absolute inset-0 w-full h-full object-contain"
          variants={overlayVariants}
          animate={effectiveVisualState === 'breathe' ? 'dormant' : effectiveVisualState}
          draggable={false}
        />
      </motion.div>

      {/* Accessibility label */}
      <span className="sr-only">
        Opta Ring - {
          state === 'processing' ? 'Loading' :
          state === 'active' || state === 'waking' || state === 'exploding' || state === 'recovering' ? 'Active' :
          'Ready'
        }
      </span>
    </motion.div>
  );
}

// =============================================================================
// CONVENIENCE COMPONENTS
// =============================================================================

/**
 * OptaRingLoader - Loading State Convenience Component
 *
 * DESIGN RULE: Never use standard spinners. Always use OptaRing pulsing.
 * This component provides a consistent loading indicator throughout the app.
 *
 * @example
 * ```tsx
 * {isLoading && <OptaRingLoader size="sm" />}
 * ```
 */
export function OptaRingLoader({
  size = 'md',
  className,
}: {
  /** Ring size for the loader */
  size?: RingSize;
  /** Additional CSS classes */
  className?: string;
}): React.ReactNode {
  return <OptaRing state="processing" size={size} breathe={false} className={className} />;
}

/**
 * OptaRingButton - Interactive Ring Button Component
 *
 * Wraps OptaRing in a button with hover and tap animations.
 * Useful for primary CTAs and navigation triggers.
 *
 * @example
 * ```tsx
 * <OptaRingButton onClick={handleOptimize} size="xl">
 *   Optimize
 * </OptaRingButton>
 * ```
 */
export function OptaRingButton({
  children,
  onClick,
  size = 'lg',
  className,
}: {
  /** Content to display centered over the ring */
  children?: React.ReactNode;
  /** Click handler */
  onClick?: () => void;
  /** Ring size */
  size?: RingSize;
  /** Additional CSS classes */
  className?: string;
}): React.ReactNode {
  return (
    <motion.button
      className={cn('relative group', className)}
      onClick={onClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <OptaRing
        state="dormant"
        size={size}
        breathe={true}
        className="group-hover:[&>div]:animate-none group-hover:[&_img:last-child]:opacity-80"
      />
      {children && (
        <div className="absolute inset-0 flex items-center justify-center text-white font-semibold">
          {children}
        </div>
      )}
    </motion.button>
  );
}

export default OptaRing;
