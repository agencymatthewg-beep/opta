import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

// Import ring state images
import opta0Percent from '@/assets/branding/opta-0-percent.png';
import opta50Percent from '@/assets/branding/opta-50-percent.png';

// Re-export types from the canonical source
export type { RingState, RingSize } from '@/components/OptaRing3D/types';
import type { RingState, RingSize } from '@/components/OptaRing3D/types';

/**
 * OptaRing - The Protagonist of the Living Artifact (PNG-based 2D version)
 *
 * The Opta Ring is the "AI brain" of the application. It sits dark and observant
 * in its dormant state (0%) until called upon, then ignites to its active state (50%).
 *
 * This is the legacy PNG-based implementation. For the full 3D experience,
 * use OptaRing3D which supports all 7 states.
 *
 * Supported States (maps to visual):
 * - dormant: Dark obsidian glass, faint glow
 * - active: Internal plasma swirls, 50% brightness
 * - processing: Rhythmic pulse between 0% and 50%
 * - waking/sleeping: Maps to active/dormant for transition animation
 * - exploding/recovering: Maps to active with glow
 *
 * @see DESIGN_SYSTEM.md - Part 9: The Opta Ring
 * @see OptaRing3D for the full 3D implementation
 */

export type RingPosition = 'inline' | 'centered' | 'floating';

/** Helper type for visual state mapping */
type VisualState = 'dormant' | 'active' | 'processing' | 'breathe';

/** Map extended RingState to visual state for PNG animation */
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

interface OptaRingProps {
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
}

// Size mappings
const sizeClasses: Record<RingSize, string> = {
  xs: 'w-6 h-6',
  sm: 'w-10 h-10',
  md: 'w-16 h-16',
  lg: 'w-24 h-24',
  xl: 'w-32 h-32',
  hero: 'w-48 h-48 md:w-64 md:h-64',
};

// Position mappings
const positionClasses: Record<RingPosition, string> = {
  inline: '',
  centered: 'mx-auto',
  floating: 'fixed z-50',
};

// Easing curve for smooth deceleration
const smoothOut: [number, number, number, number] = [0.22, 1, 0.36, 1];

// Animation variants for the 50% overlay
const overlayVariants = {
  dormant: {
    opacity: 0,
    transition: {
      duration: 0.6,
      ease: smoothOut,
    },
  },
  active: {
    opacity: 1,
    transition: {
      duration: 0.6,
      ease: smoothOut,
    },
  },
  processing: {
    opacity: [0.3, 0.9, 0.3],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: 'easeInOut' as const,
    },
  },
};

// Glow animation variants
const glowVariants = {
  dormant: {
    filter: 'drop-shadow(0 0 10px rgba(168, 85, 247, 0.15))',
    transition: {
      duration: 0.6,
      ease: smoothOut,
    },
  },
  active: {
    filter: 'drop-shadow(0 0 40px rgba(168, 85, 247, 0.6))',
    transition: {
      duration: 0.6,
      ease: smoothOut,
    },
  },
  processing: {
    filter: [
      'drop-shadow(0 0 15px rgba(168, 85, 247, 0.3))',
      'drop-shadow(0 0 50px rgba(168, 85, 247, 0.7))',
      'drop-shadow(0 0 15px rgba(168, 85, 247, 0.3))',
    ],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: 'easeInOut' as const,
    },
  },
};

// Breathing animation for dormant state
const breatheVariants = {
  breathe: {
    filter: [
      'drop-shadow(0 0 10px rgba(168, 85, 247, 0.15)) brightness(0.9)',
      'drop-shadow(0 0 25px rgba(168, 85, 247, 0.35)) brightness(1)',
      'drop-shadow(0 0 10px rgba(168, 85, 247, 0.15)) brightness(0.9)',
    ],
    transition: {
      duration: 3,
      repeat: Infinity,
      ease: 'easeInOut' as const,
    },
  },
};

export function OptaRing({
  state = 'dormant',
  size = 'md',
  position = 'inline',
  breathe = true,
  onTransitionComplete,
  className,
  onClick,
}: OptaRingProps) {
  // Map extended state to visual state for PNG animation
  const visualState = mapToVisualState(state, breathe);

  // Determine which variant set to use based on visual state
  const useBreathVariants = visualState === 'breathe';

  return (
    <motion.div
      className={cn(
        'relative select-none',
        sizeClasses[size],
        positionClasses[position],
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      transition={{ duration: 0.5, ease: smoothOut }}
    >
      {/* Glow container */}
      <motion.div
        className="relative w-full h-full"
        variants={useBreathVariants ? breatheVariants : glowVariants}
        animate={visualState}
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
          animate={visualState === 'breathe' ? 'dormant' : visualState}
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

/**
 * OptaRingLoader - Convenience component for loading states
 *
 * RULE: Never use standard spinners. Always use OptaRing pulsing.
 */
export function OptaRingLoader({
  size = 'md',
  className,
}: {
  size?: RingSize;
  className?: string;
}) {
  return <OptaRing state="processing" size={size} breathe={false} className={className} />;
}

/**
 * OptaRingButton - Ring that acts as a clickable button
 *
 * Useful for primary CTAs and navigation triggers.
 */
export function OptaRingButton({
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
