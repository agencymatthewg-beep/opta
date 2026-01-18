import { motion, AnimatePresence } from 'framer-motion';
import { useOptaRing } from '@/contexts/OptaRingContext';
import { OptaRing, type RingState as OptaRing2DState } from './OptaRing';
import { type RingState } from '@/components/OptaRing3D/types';
import {
  floatingRingVariants,
  RING_DISSOLVE_DURATION,
} from '@/lib/pageTransitions';

/**
 * FloatingRingOverlay - The Protagonist During Page Transitions
 *
 * A full-screen overlay that displays the OptaRing during navigation transitions.
 * The ring appears centered, ignites to 50% state, then dissolves as the new
 * page content fades in.
 *
 * ## Transition Sequence
 * 1. Overlay appears with ring at center (dormant state)
 * 2. Ring ignites to active state (0% -> 50% brightness)
 * 3. Brief hold at 50% while new content prepares
 * 4. Ring dissolves with bloom effect and scale expansion
 * 5. Overlay fades out, revealing new page
 *
 * ## Visual Effects
 * - **Backdrop**: Subtle darkening (40% opacity) for focus
 * - **Ambient Glow**: Radial gradient that expands during active state
 * - **Radial Lines**: 8 energy lines radiating outward when active
 * - **Vignette**: Edge glow that intensifies during transition
 *
 * This creates a "warp" effect where the ring acts as a portal
 * between pages, making navigation feel like traveling through
 * the Living Artifact.
 *
 * @see DESIGN_SYSTEM.md - Part 7: The Opta Ring
 * @see pageTransitions.ts - Transition orchestration
 */

// =============================================================================
// CONSTANTS
// =============================================================================

/** Easing curve for smooth deceleration (ease-out-expo approximation) */
const SMOOTH_OUT_EASING: [number, number, number, number] = [0.22, 1, 0.36, 1];

/** Number of radial energy lines in the active state effect */
const RADIAL_LINE_COUNT = 8;

/** Rotation angle between radial lines in degrees */
const RADIAL_LINE_ANGLE_DEG = 45;

/** Stagger delay between radial line animations in seconds */
const RADIAL_LINE_STAGGER_S = 0.02;

/** Backdrop opacity for focus effect */
const BACKDROP_OPACITY = 0.4;

/** Active state glow scale multiplier */
const ACTIVE_GLOW_SCALE = 1.5;

/** Exit glow scale multiplier */
const EXIT_GLOW_SCALE = 2;

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Maps extended 3D ring state to 2D ring state.
 * Reduces 7 states to 3 visual representations for the PNG-based OptaRing.
 *
 * @param state - The current 3D RingState
 * @returns The mapped 2D OptaRing state
 */
function mapTo2DState(state: RingState): OptaRing2DState {
  switch (state) {
    case 'dormant':
    case 'sleeping':
      return 'dormant';
    case 'processing':
      return 'processing';
    default:
      // waking, active, exploding, recovering all map to active
      return 'active';
  }
}

// =============================================================================
// COMPONENT
// =============================================================================

export function FloatingRingOverlay(): React.ReactNode {
  const { isTransitioning, state } = useOptaRing();

  // Determine if ring is in active state for conditional effects
  const isActiveState = state === 'active';

  return (
    <AnimatePresence>
      {isTransitioning && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: SMOOTH_OUT_EASING }}
        >
          {/* Backdrop - Subtle darkening for focus */}
          <motion.div
            className="absolute inset-0 bg-background/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: BACKDROP_OPACITY }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          />

          {/* Ring Container - Centered with dissolve animation */}
          <motion.div
            className="relative"
            variants={floatingRingVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {/* Ambient Glow - Expands during active state */}
            <motion.div
              className="absolute inset-0 rounded-full blur-3xl"
              style={{
                background:
                  'radial-gradient(circle, rgba(168, 85, 247, 0.3) 0%, transparent 70%)',
              }}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{
                scale: isActiveState ? ACTIVE_GLOW_SCALE : 1,
                opacity: isActiveState ? 1 : 0.3,
              }}
              exit={{
                scale: EXIT_GLOW_SCALE,
                opacity: 0,
              }}
              transition={{
                duration: 0.6,
                ease: SMOOTH_OUT_EASING,
              }}
            />

            {/* The Ring - Hero size during transitions */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{
                scale: 1.2,
                opacity: 0,
                filter: 'brightness(2) blur(20px)',
              }}
              transition={{
                duration: RING_DISSOLVE_DURATION / 1000,
                ease: SMOOTH_OUT_EASING,
              }}
            >
              <OptaRing
                state={mapTo2DState(state)}
                size="hero"
                breathe={false}
                position="centered"
              />
            </motion.div>

            {/* Radial Lines - Energy expansion effect during active state */}
            {isActiveState && (
              <motion.div
                className="absolute inset-0 flex items-center justify-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {Array.from({ length: RADIAL_LINE_COUNT }, (_, index) => (
                  <motion.div
                    key={index}
                    className="absolute w-px h-32 bg-gradient-to-t from-primary/40 to-transparent origin-bottom"
                    style={{
                      transform: `rotate(${index * RADIAL_LINE_ANGLE_DEG}deg) translateY(-80px)`,
                    }}
                    initial={{ scaleY: 0, opacity: 0 }}
                    animate={{ scaleY: 1, opacity: 1 }}
                    exit={{ scaleY: 0, opacity: 0 }}
                    transition={{
                      delay: index * RADIAL_LINE_STAGGER_S,
                      duration: 0.4,
                      ease: SMOOTH_OUT_EASING,
                    }}
                  />
                ))}
              </motion.div>
            )}
          </motion.div>

          {/* Screen Edge Glow - Vignette intensifies during transition */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'radial-gradient(ellipse at 50% 50%, transparent 30%, rgba(168, 85, 247, 0.15) 100%)',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: isActiveState ? 1 : 0.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default FloatingRingOverlay;
