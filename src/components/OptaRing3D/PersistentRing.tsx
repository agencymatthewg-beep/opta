/**
 * PersistentRing - Phase 29: App-Wide Persistent Ring
 *
 * A fixed-position wrapper for OptaRing3D that persists across all page
 * navigations. The ring is the brand protagonist - always visible but
 * never intrusive.
 *
 * Features:
 * - Fixed bottom-right corner position (FAB-style)
 * - Z-index layering (z-40: above content, below modals)
 * - Page transition pulse animation
 * - Context-aware sizing (ambient/hero/mini)
 * - Pointer-events passthrough when not interactive
 *
 * @see DESIGN_SYSTEM.md - Part 9: The Opta Ring
 * @see Phase 29 specification
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { OptaRing3D } from './OptaRing3D';
import { useOptaRingOptional } from '@/contexts/OptaRingContext';
import { useRingSize, type RingSizeMode } from '@/hooks/useRingSize';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { cn } from '@/lib/utils';
import { transitions } from '@/lib/animations';

// =============================================================================
// TYPES
// =============================================================================

export interface PersistentRingProps {
  /** Current page/route for context-aware sizing */
  currentPage?: string;
  /** Override size mode */
  sizeMode?: RingSizeMode;
  /** Callback when ring is clicked */
  onClick?: () => void;
  /** Whether the ring should be interactive */
  interactive?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Position offset from edge in pixels */
  edgeOffset?: number;
  /** Custom z-index (default: 40) */
  zIndex?: number;
}

// =============================================================================
// Z-INDEX LAYER CONSTANTS
// =============================================================================

/**
 * Z-Layer Strategy for Persistent Ring
 *
 * Layer 0-10: Page content
 * Layer 30: Navigation elements
 * Layer 40: Persistent Ring (this component)
 * Layer 50: Modals, drawers, dialogs
 * Layer 60: Tooltips, popovers
 * Layer 70: Toasts, notifications
 */
export const Z_LAYER_RING = 40;
export const Z_LAYER_CONTENT = 0;
export const Z_LAYER_NAVIGATION = 30;
export const Z_LAYER_MODALS = 50;

// =============================================================================
// ANIMATION VARIANTS
// =============================================================================

/** Container entrance/exit animation */
const containerVariants = {
  initial: {
    opacity: 0,
    scale: 0.8,
  },
  animate: {
    opacity: 1,
    scale: 1,
    transition: transitions.springGentle,
  },
  exit: {
    opacity: 0,
    scale: 0.9,
    transition: { duration: 0.2 },
  },
};

/** Page transition pulse animation */
const pulseVariants: Variants = {
  idle: {
    scale: 1,
  },
  pulse: {
    scale: [1, 1.05, 1],
    transition: {
      duration: 0.4,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  },
};

/** Size transition animation */
const sizeTransition = {
  type: 'spring' as const,
  stiffness: 300,
  damping: 25,
};

// =============================================================================
// POSITION STYLES
// =============================================================================

const getPositionStyles = (
  mode: RingSizeMode,
  offset: number,
  centered: boolean
): React.CSSProperties => {
  if (centered || mode === 'hero') {
    return {
      position: 'fixed',
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
    };
  }

  // Default: bottom-right corner (FAB position)
  return {
    position: 'fixed',
    right: offset,
    bottom: offset,
  };
};

// =============================================================================
// COMPONENT
// =============================================================================

export function PersistentRing({
  currentPage,
  sizeMode,
  onClick,
  interactive = true,
  className,
  edgeOffset = 24,
  zIndex = Z_LAYER_RING,
}: PersistentRingProps) {
  // Hooks
  const prefersReducedMotion = useReducedMotion();
  const ringContext = useOptaRingOptional();
  const prevPageRef = useRef<string | undefined>(currentPage);

  // Size management
  const {
    mode,
    config,
    isHovered,
    setHovered,
  } = useRingSize({
    currentPage,
    overrideMode: sizeMode,
    enableHoverScale: interactive,
  });

  // Local state
  const [energyLevel, setEnergyLevel] = useState(0);
  const [isPulsing, setIsPulsing] = useState(false);

  /**
   * Handle page transition pulse
   * Ring pulses subtly when navigating between pages
   */
  useEffect(() => {
    // Skip if same page or first render
    if (prevPageRef.current === currentPage || !prevPageRef.current) {
      prevPageRef.current = currentPage;
      return;
    }

    prevPageRef.current = currentPage;

    // Trigger pulse animation
    if (!prefersReducedMotion) {
      setIsPulsing(true);

      // Briefly increase energy during transition
      setEnergyLevel(0.3);

      // Return to normal after animation
      const timer = setTimeout(() => {
        setIsPulsing(false);
        setEnergyLevel(0);
      }, 400);

      return () => clearTimeout(timer);
    }
  }, [currentPage, prefersReducedMotion]);

  /**
   * Sync with global ring context
   */
  useEffect(() => {
    if (ringContext) {
      // Update energy from context state
      const contextEnergy =
        ringContext.state === 'active' ? 0.5 :
        ringContext.state === 'processing' ? 0.3 : 0;
      setEnergyLevel(contextEnergy);
    }
  }, [ringContext?.state]);

  /**
   * Handle click with context integration
   */
  const handleClick = useCallback(() => {
    if (!interactive) return;

    // Trigger flash effect via context if available
    if (ringContext) {
      ringContext.flash();
    }

    // Call custom handler
    onClick?.();
  }, [interactive, onClick, ringContext]);

  /**
   * Handle hover state
   */
  const handleMouseEnter = useCallback(() => {
    setHovered(true);
    if (!prefersReducedMotion) {
      setEnergyLevel((prev) => Math.min(prev + 0.15, 0.5));
    }
  }, [setHovered, prefersReducedMotion]);

  const handleMouseLeave = useCallback(() => {
    setHovered(false);
    if (!prefersReducedMotion && !ringContext?.state) {
      setEnergyLevel(0);
    }
  }, [setHovered, prefersReducedMotion, ringContext?.state]);

  // Determine ring state from context or local
  const ringState = ringContext?.state ?? 'dormant';

  // Position styles
  const positionStyles = getPositionStyles(mode, edgeOffset, config.centered);

  return (
    <AnimatePresence>
      <motion.div
        className={cn(
          'select-none',
          interactive && 'cursor-pointer',
          !interactive && 'pointer-events-none',
          className
        )}
        style={{
          ...positionStyles,
          zIndex,
        }}
        variants={containerVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        role={interactive ? 'button' : 'presentation'}
        aria-label={interactive ? 'Opta Ring - Click to interact' : 'Opta Ring'}
        tabIndex={interactive ? 0 : -1}
        onKeyDown={(e) => {
          if (interactive && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            handleClick();
          }
        }}
      >
        {/* Pulse animation wrapper */}
        <motion.div
          variants={pulseVariants}
          animate={isPulsing ? 'pulse' : 'idle'}
        >
          {/* Size animation wrapper */}
          <motion.div
            animate={{
              width: config.size,
              height: config.size,
            }}
            transition={sizeTransition}
            className="relative"
          >
            {/* The 3D Ring */}
            <OptaRing3D
              state={ringState}
              size={config.ringSize}
              energyLevel={energyLevel}
              className="w-full h-full"
            />

            {/* Hover glow effect */}
            <AnimatePresence>
              {isHovered && (
                <motion.div
                  className="absolute inset-0 rounded-full pointer-events-none"
                  initial={{ opacity: 0 }}
                  animate={{
                    opacity: 0.3,
                    boxShadow: '0 0 30px 10px rgba(168, 85, 247, 0.4)',
                  }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                />
              )}
            </AnimatePresence>

            {/* Page transition glow burst */}
            <AnimatePresence>
              {isPulsing && (
                <motion.div
                  className="absolute inset-0 rounded-full pointer-events-none"
                  initial={{ opacity: 0, scale: 1 }}
                  animate={{
                    opacity: [0, 0.5, 0],
                    scale: [1, 1.3, 1.5],
                  }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                  style={{
                    boxShadow: '0 0 40px 20px rgba(168, 85, 247, 0.5)',
                  }}
                />
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default PersistentRing;
