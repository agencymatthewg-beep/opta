/**
 * LessonOverlay - Ring-Synchronized Chess Hints Overlay
 *
 * Phase 55.3: Floating panel with current hint/explanation text that
 * syncs visibility with ring active state via useRingLesson hook.
 *
 * Features:
 * - Glass panel styling per design system
 * - Arrow pointing to relevant board square
 * - AnimatePresence for smooth entry/exit
 * - Ring state synchronized visibility
 *
 * @see DESIGN_SYSTEM.md - Part 4: Glass Depth System
 * @see src/contexts/RingLessonContext.tsx for ring integration
 */

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb, ChevronRight, ChevronLeft, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRingLesson } from '@/contexts/RingLessonContext';
import { transitions, smoothOut } from '@/lib/animations';

// =============================================================================
// TYPES
// =============================================================================

export interface LessonOverlayProps {
  /** Additional CSS classes */
  className?: string;
  /** Position relative to board */
  position?: 'top' | 'bottom' | 'left' | 'right';
  /** Target square for arrow (e.g., 'e4') */
  targetSquare?: string;
  /** Board element ref for positioning arrow */
  boardRef?: React.RefObject<HTMLElement>;
  /** Callback when user clicks next */
  onNext?: () => void;
  /** Callback when user clicks previous */
  onPrevious?: () => void;
  /** Callback when user closes overlay */
  onClose?: () => void;
}

// =============================================================================
// ANIMATION VARIANTS
// =============================================================================

const overlayVariants = {
  hidden: {
    opacity: 0,
    y: 12,
    scale: 0.95,
    filter: 'brightness(0.5) blur(4px)',
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: 'brightness(1) blur(0px)',
    transition: {
      duration: 0.4,
      ease: smoothOut,
    },
  },
  exit: {
    opacity: 0,
    y: -8,
    scale: 0.98,
    filter: 'brightness(0.7) blur(2px)',
    transition: {
      duration: 0.25,
      ease: smoothOut,
    },
  },
};

const arrowVariants = {
  hidden: { opacity: 0, scale: 0.5 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { delay: 0.2, ...transitions.spring },
  },
  exit: { opacity: 0, scale: 0.5, transition: { duration: 0.15 } },
};

const contentVariants = {
  hidden: { opacity: 0, x: -8 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { delay: 0.1, duration: 0.3, ease: smoothOut },
  },
};

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

interface HintArrowProps {
  direction: 'up' | 'down' | 'left' | 'right';
  className?: string;
}

/**
 * Animated arrow pointing to board square.
 */
function HintArrow({ direction, className }: HintArrowProps) {
  const rotation = useMemo(() => {
    switch (direction) {
      case 'up':
        return 'rotate-180';
      case 'down':
        return 'rotate-0';
      case 'left':
        return 'rotate-90';
      case 'right':
        return '-rotate-90';
    }
  }, [direction]);

  return (
    <motion.div
      variants={arrowVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className={cn('absolute', className)}
    >
      <motion.div
        animate={{ y: [0, 4, 0] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
        className={cn(
          'w-0 h-0',
          'border-l-[8px] border-l-transparent',
          'border-r-[8px] border-r-transparent',
          'border-t-[12px] border-t-primary',
          'drop-shadow-[0_0_8px_rgba(168,85,247,0.6)]',
          rotation
        )}
      />
    </motion.div>
  );
}

interface StepIndicatorProps {
  current: number;
  total: number;
}

/**
 * Step progress indicator.
 */
function StepIndicator({ current, total }: StepIndicatorProps) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'w-1.5 h-1.5 rounded-full transition-all duration-200',
            i === current
              ? 'bg-primary w-3 shadow-[0_0_6px_rgba(168,85,247,0.5)]'
              : i < current
                ? 'bg-primary/50'
                : 'bg-white/20'
          )}
        />
      ))}
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * LessonOverlay - Ring-synchronized hints overlay for chess tutoring.
 *
 * Displays current lesson step content with navigation controls.
 * Visibility syncs with ring active state - shows when teaching,
 * hides when dormant.
 *
 * @example
 * ```tsx
 * <LessonOverlay
 *   position="bottom"
 *   targetSquare="e4"
 *   onNext={handleNext}
 *   onPrevious={handlePrevious}
 * />
 * ```
 */
export function LessonOverlay({
  className,
  position = 'bottom',
  targetSquare,
  onNext,
  onPrevious,
  onClose,
}: LessonOverlayProps) {
  const {
    currentStep,
    currentStepIndex,
    currentLesson,
    ringState,
    isLessonActive,
    nextStep,
    previousStep,
    endLesson,
  } = useRingLesson();

  // Show overlay when ring is active/teaching and lesson is active
  const isVisible = isLessonActive && (ringState === 'active' || ringState === 'teaching');

  // Determine arrow direction based on position
  const arrowDirection = useMemo(() => {
    switch (position) {
      case 'top':
        return 'down';
      case 'bottom':
        return 'up';
      case 'left':
        return 'right';
      case 'right':
        return 'left';
    }
  }, [position]);

  // Get arrow position class
  const arrowPositionClass = useMemo(() => {
    switch (position) {
      case 'top':
        return 'bottom-0 left-1/2 -translate-x-1/2 translate-y-full';
      case 'bottom':
        return 'top-0 left-1/2 -translate-x-1/2 -translate-y-full';
      case 'left':
        return 'right-0 top-1/2 -translate-y-1/2 translate-x-full';
      case 'right':
        return 'left-0 top-1/2 -translate-y-1/2 -translate-x-full';
    }
  }, [position]);

  // Get position classes for overlay
  const positionClasses = useMemo(() => {
    switch (position) {
      case 'top':
        return 'bottom-full mb-4';
      case 'bottom':
        return 'top-full mt-4';
      case 'left':
        return 'right-full mr-4';
      case 'right':
        return 'left-full ml-4';
    }
  }, [position]);

  // Handle navigation
  const handleNext = () => {
    onNext?.();
    nextStep();
  };

  const handlePrevious = () => {
    onPrevious?.();
    previousStep();
  };

  const handleClose = () => {
    onClose?.();
    endLesson();
  };

  // Check navigation availability
  const canGoNext = currentLesson && currentStepIndex < currentLesson.steps.length - 1;
  const canGoPrevious = currentStepIndex > 0;
  const totalSteps = currentLesson?.steps.length ?? 0;

  return (
    <AnimatePresence mode="wait">
      {isVisible && currentStep && (
        <motion.div
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className={cn(
            'absolute z-20 w-80 max-w-[90vw]',
            positionClasses,
            className
          )}
        >
          {/* Glass panel */}
          <div
            className={cn(
              'relative rounded-xl overflow-hidden',
              // Glass styling per design system
              'glass-strong',
              'border border-white/[0.08]',
              // Inner specular highlight
              'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]',
              // Outer glow when teaching
              ringState === 'teaching' && [
                'shadow-[0_0_20px_rgba(168,85,247,0.3)]',
                'border-primary/30',
              ]
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.05]">
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    'p-1.5 rounded-lg',
                    ringState === 'teaching'
                      ? 'bg-primary/20 text-primary'
                      : 'bg-white/5 text-muted-foreground'
                  )}
                >
                  <Lightbulb className="w-4 h-4" strokeWidth={1.75} />
                </div>
                <span className="text-sm font-medium text-foreground">
                  {currentStep.title}
                </span>
              </div>
              <button
                onClick={handleClose}
                className={cn(
                  'p-1 rounded-md transition-colors duration-150',
                  'text-muted-foreground hover:text-foreground',
                  'hover:bg-white/5'
                )}
                aria-label="Close lesson"
              >
                <X className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>

            {/* Content */}
            <motion.div
              variants={contentVariants}
              initial="hidden"
              animate="visible"
              key={currentStep.id}
              className="px-4 py-3"
            >
              <p className="text-sm text-muted-foreground leading-relaxed">
                {currentStep.content}
              </p>

              {/* Hints (if available) */}
              {currentStep.hints && currentStep.hints.length > 0 && (
                <div className="mt-3 p-2 rounded-lg bg-primary/5 border border-primary/10">
                  <p className="text-xs text-primary/80">
                    <span className="font-medium">Hint:</span> {currentStep.hints[0]}
                  </p>
                </div>
              )}

              {/* Highlighted squares info */}
              {targetSquare && (
                <div className="mt-2 text-xs text-muted-foreground/70">
                  Focus on square: <span className="font-mono text-primary">{targetSquare}</span>
                </div>
              )}
            </motion.div>

            {/* Footer with navigation */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.05]">
              <StepIndicator current={currentStepIndex} total={totalSteps} />

              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrevious}
                  disabled={!canGoPrevious}
                  className={cn(
                    'p-1.5 rounded-md transition-all duration-150',
                    canGoPrevious
                      ? 'text-foreground hover:bg-white/10 hover:text-primary'
                      : 'text-muted-foreground/30 cursor-not-allowed'
                  )}
                  aria-label="Previous step"
                >
                  <ChevronLeft className="w-4 h-4" strokeWidth={1.75} />
                </button>
                <button
                  onClick={handleNext}
                  disabled={!canGoNext}
                  className={cn(
                    'p-1.5 rounded-md transition-all duration-150',
                    canGoNext
                      ? 'text-foreground hover:bg-white/10 hover:text-primary'
                      : 'text-muted-foreground/30 cursor-not-allowed'
                  )}
                  aria-label="Next step"
                >
                  <ChevronRight className="w-4 h-4" strokeWidth={1.75} />
                </button>
              </div>
            </div>
          </div>

          {/* Arrow pointing to target square */}
          {targetSquare && (
            <HintArrow direction={arrowDirection} className={arrowPositionClass} />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default LessonOverlay;
