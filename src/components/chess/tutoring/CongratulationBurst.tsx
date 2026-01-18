/**
 * CongratulationBurst - Ring Explosion Celebration for Successful Moves
 *
 * Phase 55.4: Visual celebration effect triggered when a player makes
 * a correct move during tutoring. Integrates with the Opta Ring via
 * RingLessonContext.triggerCelebration().
 *
 * Features:
 * - Particle burst effect emanating from center
 * - Glass panel with success message
 * - AnimatePresence for smooth lifecycle
 * - Sound hook integration point
 * - Auto-reset after celebration completes
 *
 * @see src/contexts/RingLessonContext.tsx for ring integration
 * @see src/components/OptaRing3D/useExplosion.ts for explosion timing
 * @see DESIGN_SYSTEM.md - Part 4: Glass Depth System
 */

import { useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence, type Variants, type Easing } from 'framer-motion';
import { Sparkles, Trophy, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRingLesson, useRingLessonState } from '@/contexts/RingLessonContext';
import { smoothOut } from '@/lib/animations';

// =============================================================================
// TYPES
// =============================================================================

export interface CongratulationBurstProps {
  /** Additional CSS classes */
  className?: string;
  /** Custom success message */
  message?: string;
  /** Message subtext */
  subtext?: string;
  /** Icon variant: sparkles, trophy, or star */
  iconVariant?: 'sparkles' | 'trophy' | 'star';
  /** Duration before auto-hide in ms (0 = no auto-hide) */
  autoHideDuration?: number;
  /** Callback when celebration starts */
  onCelebrationStart?: () => void;
  /** Callback when celebration ends */
  onCelebrationEnd?: () => void;
  /** Sound hook - called to trigger success sound */
  onPlaySound?: () => void;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** Default celebration duration matches ring explosion */
const DEFAULT_AUTO_HIDE_DURATION = 1700; // CELEBRATION_DURATION + RECOVERY_DURATION

/** Particle count for the DOM-based burst effect */
const PARTICLE_COUNT = 12;

// =============================================================================
// ANIMATION VARIANTS
// =============================================================================

const containerVariants = {
  hidden: {
    opacity: 0,
    scale: 0.8,
  },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.3,
      ease: smoothOut,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.9,
    transition: {
      duration: 0.25,
      ease: smoothOut,
    },
  },
};

const iconVariants: Variants = {
  hidden: {
    scale: 0,
    rotate: -180,
  },
  visible: {
    scale: 1,
    rotate: 0,
    transition: {
      type: 'spring' as const,
      stiffness: 400,
      damping: 15,
      delay: 0.1,
    },
  },
  exit: {
    scale: 0,
    rotate: 180,
    transition: {
      duration: 0.2,
    },
  },
};

const textVariants = {
  hidden: {
    opacity: 0,
    y: 8,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      delay: 0.2,
      duration: 0.3,
      ease: smoothOut,
    },
  },
};

const particleVariants: Variants = {
  hidden: {
    opacity: 1,
    scale: 1,
  },
  animate: (i: number) => ({
    opacity: [1, 1, 0],
    scale: [0.5, 1, 0.3],
    x: Math.cos((i / PARTICLE_COUNT) * Math.PI * 2) * 80,
    y: Math.sin((i / PARTICLE_COUNT) * Math.PI * 2) * 80,
    transition: {
      duration: 0.8,
      ease: 'easeOut' as Easing,
      times: [0, 0.3, 1],
    },
  }),
};

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

interface ParticleBurstProps {
  isActive: boolean;
}

/**
 * DOM-based particle burst for lightweight celebration effect.
 * Complements the Three.js ring explosion with 2D particles.
 */
function ParticleBurst({ isActive }: ParticleBurstProps) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible">
      <AnimatePresence>
        {isActive &&
          Array.from({ length: PARTICLE_COUNT }).map((_, i) => (
            <motion.div
              key={`particle-${i}`}
              custom={i}
              variants={particleVariants}
              initial="hidden"
              animate="animate"
              exit={{ opacity: 0 }}
              className={cn(
                'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
                'w-2 h-2 rounded-full',
                i % 3 === 0
                  ? 'bg-primary shadow-[0_0_8px_rgba(168,85,247,0.8)]'
                  : i % 3 === 1
                    ? 'bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)]'
                    : 'bg-purple-300 shadow-[0_0_6px_rgba(216,180,254,0.8)]'
              )}
            />
          ))}
      </AnimatePresence>
    </div>
  );
}

/**
 * Get the appropriate icon component for the variant.
 */
function CelebrationIcon({ variant }: { variant: 'sparkles' | 'trophy' | 'star' }) {
  const iconProps = {
    className: 'w-8 h-8 text-primary',
    strokeWidth: 1.5,
  };

  switch (variant) {
    case 'trophy':
      return <Trophy {...iconProps} />;
    case 'star':
      return <Star {...iconProps} />;
    default:
      return <Sparkles {...iconProps} />;
  }
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * CongratulationBurst - Celebration overlay for successful moves.
 *
 * Automatically shows when ringState is 'celebration' and hides
 * when the celebration completes. Integrates with the Opta Ring
 * explosion effect for synchronized visual feedback.
 *
 * @example
 * ```tsx
 * // Basic usage - responds to ringState automatically
 * <CongratulationBurst />
 *
 * // With custom message and sound
 * <CongratulationBurst
 *   message="Excellent Move!"
 *   subtext="You found the best continuation"
 *   onPlaySound={() => playSuccessSound()}
 * />
 * ```
 */
export function CongratulationBurst({
  className,
  message = 'Correct!',
  subtext,
  iconVariant = 'sparkles',
  autoHideDuration = DEFAULT_AUTO_HIDE_DURATION,
  onCelebrationStart,
  onCelebrationEnd,
  onPlaySound,
}: CongratulationBurstProps) {
  const ringState = useRingLessonState();
  // Note: resetRing is available via useRingLesson() if manual reset is needed
  const hasTriggeredRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Determine visibility from ring state
  const isVisible = ringState === 'celebration';

  // Handle celebration start
  useEffect(() => {
    if (isVisible && !hasTriggeredRef.current) {
      hasTriggeredRef.current = true;
      onCelebrationStart?.();
      onPlaySound?.();

      // Auto-hide after duration (ring handles its own reset)
      if (autoHideDuration > 0) {
        timeoutRef.current = setTimeout(() => {
          onCelebrationEnd?.();
        }, autoHideDuration);
      }
    } else if (!isVisible && hasTriggeredRef.current) {
      // Reset trigger flag when celebration ends
      hasTriggeredRef.current = false;
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isVisible, autoHideDuration, onCelebrationStart, onCelebrationEnd, onPlaySound]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <AnimatePresence mode="wait">
      {isVisible && (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className={cn(
            'fixed inset-0 z-50 flex items-center justify-center',
            'pointer-events-none',
            className
          )}
        >
          {/* Background overlay with subtle blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/20 backdrop-blur-[2px]"
          />

          {/* Celebration content */}
          <div className="relative">
            {/* Particle burst */}
            <ParticleBurst isActive={isVisible} />

            {/* Glass card */}
            <motion.div
              variants={containerVariants}
              className={cn(
                'relative z-10',
                'glass-strong rounded-2xl',
                'border border-primary/30',
                'px-8 py-6',
                'shadow-[0_0_30px_rgba(168,85,247,0.3)]',
                // Inner glow
                'before:absolute before:inset-0 before:rounded-2xl',
                'before:bg-gradient-to-br before:from-primary/10 before:to-transparent',
                'before:pointer-events-none'
              )}
            >
              {/* Icon with spring animation */}
              <motion.div
                variants={iconVariants}
                className={cn(
                  'mx-auto mb-3 w-16 h-16 rounded-full',
                  'flex items-center justify-center',
                  'bg-primary/20 border border-primary/30',
                  'shadow-[0_0_20px_rgba(168,85,247,0.4)]'
                )}
              >
                <CelebrationIcon variant={iconVariant} />
              </motion.div>

              {/* Success message */}
              <motion.div variants={textVariants} className="text-center">
                <h3 className="text-xl font-semibold text-foreground">{message}</h3>
                {subtext && (
                  <p className="mt-1 text-sm text-muted-foreground">{subtext}</p>
                )}
              </motion.div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// =============================================================================
// HOOK FOR MANUAL TRIGGER
// =============================================================================

/**
 * Hook for manually triggering celebration with custom options.
 *
 * @example
 * ```tsx
 * function PuzzleSolver() {
 *   const { celebrate, isActive } = useCongratulationBurst();
 *
 *   const handleCorrectMove = () => {
 *     celebrate({ message: 'Brilliant!' });
 *   };
 *
 *   return (
 *     <>
 *       <Board onCorrectMove={handleCorrectMove} />
 *       {isActive && <CongratulationBurst />}
 *     </>
 *   );
 * }
 * ```
 */
export function useCongratulationBurst() {
  const { triggerCelebration, ringState } = useRingLesson();

  const celebrate = useCallback(
    async (_options?: { message?: string; subtext?: string }) => {
      // Trigger the ring celebration - the CongratulationBurst component
      // will automatically show based on ringState
      // Note: _options are reserved for future customization (e.g., sound selection)
      await triggerCelebration();
    },
    [triggerCelebration]
  );

  return {
    celebrate,
    isActive: ringState === 'celebration',
  };
}

export default CongratulationBurst;
