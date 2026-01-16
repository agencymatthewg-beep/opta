import { motion, AnimatePresence } from 'framer-motion';
import { useOptaRing } from '@/contexts/OptaRingContext';
import { OptaRing } from './OptaRing';
import {
  floatingRingVariants,
  RING_DISSOLVE_DURATION,
} from '@/lib/pageTransitions';

/**
 * FloatingRingOverlay - The Protagonist During Transitions
 *
 * A full-screen overlay that displays the OptaRing during page transitions.
 * The ring appears centered, ignites to 50% state, then dissolves as the
 * new page content fades in.
 *
 * Sequence:
 * 1. Overlay appears with ring at center (dormant)
 * 2. Ring ignites to active state (0% → 50%)
 * 3. Brief hold at 50% while new content prepares
 * 4. Ring dissolves with bloom effect
 * 5. Overlay fades out
 *
 * This creates a "warp" effect where the ring acts as a portal
 * between pages, making navigation feel like traveling through
 * the Living Artifact.
 *
 * @see DESIGN_SYSTEM.md - Part 7: The Opta Ring
 * @see pageTransitions.ts - Transition orchestration
 */

// Easing curve for smooth transitions
const smoothOut: [number, number, number, number] = [0.22, 1, 0.36, 1];

export function FloatingRingOverlay() {
  const { isTransitioning, state } = useOptaRing();

  return (
    <AnimatePresence>
      {isTransitioning && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: smoothOut }}
        >
          {/* Backdrop - Subtle darkening for focus */}
          <motion.div
            className="absolute inset-0 bg-[#05030a]/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
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
                scale: state === 'active' ? 1.5 : 1,
                opacity: state === 'active' ? 1 : 0.3,
              }}
              exit={{
                scale: 2,
                opacity: 0,
              }}
              transition={{
                duration: 0.6,
                ease: smoothOut,
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
                ease: smoothOut,
              }}
            >
              <OptaRing
                state={state}
                size="hero"
                breathe={false}
                position="centered"
              />
            </motion.div>

            {/* Radial Lines - Energy expansion effect */}
            {state === 'active' && (
              <motion.div
                className="absolute inset-0 flex items-center justify-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {[...Array(8)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute w-px h-32 bg-gradient-to-t from-primary/40 to-transparent origin-bottom"
                    style={{
                      transform: `rotate(${i * 45}deg) translateY(-80px)`,
                    }}
                    initial={{ scaleY: 0, opacity: 0 }}
                    animate={{ scaleY: 1, opacity: 1 }}
                    exit={{ scaleY: 0, opacity: 0 }}
                    transition={{
                      delay: i * 0.02,
                      duration: 0.4,
                      ease: smoothOut,
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
            animate={{ opacity: state === 'active' ? 1 : 0.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default FloatingRingOverlay;
