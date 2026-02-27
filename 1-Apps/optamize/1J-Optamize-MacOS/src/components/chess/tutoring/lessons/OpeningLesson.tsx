/**
 * OpeningLesson - Opening principles tutor with ring highlighting key squares
 *
 * Phase 55.5: Chess lesson component for teaching opening principles.
 * The Opta Ring highlights key squares and responds to the lesson state:
 * - dormant = waiting for user action
 * - active/teaching = demonstrating opening principles
 * - explosion = successful move played
 *
 * @see src/contexts/RingLessonContext.tsx for ring integration
 * @see src/lib/tutoringEngine.ts for lesson content
 * @see DESIGN_SYSTEM.md - Part 4: Glass Depth System
 */

import { useCallback, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, ChevronRight, Lightbulb, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRingLesson } from '@/contexts/RingLessonContext';
import { LessonOverlay } from '../LessonOverlay';
import { CongratulationBurst } from '../CongratulationBurst';
import { smoothOut } from '@/lib/animations';
import type { LessonPlan } from '@/types/tutoring';
import { getTutoringEngine, LESSON_LIBRARY } from '@/lib/tutoringEngine';

// =============================================================================
// TYPES
// =============================================================================

export interface OpeningLessonProps {
  /** Specific lesson ID to load (defaults to first opening lesson) */
  lessonId?: string;
  /** Additional CSS classes */
  className?: string;
  /** Callback when lesson completes */
  onComplete?: () => void;
  /** Callback when lesson is cancelled */
  onCancel?: () => void;
  /** Board component to render (receives position, highlightSquares, onMove) */
  renderBoard?: (props: BoardRenderProps) => React.ReactNode;
}

export interface BoardRenderProps {
  /** Current FEN position */
  fen: string;
  /** Squares to highlight */
  highlightSquares?: string[];
  /** Arrows to draw */
  arrows?: Array<{ from: string; to: string; color?: string }>;
  /** Callback when a move is made */
  onMove?: (from: string, to: string) => boolean;
  /** Whether user can interact with the board */
  interactive?: boolean;
}

// =============================================================================
// ANIMATION VARIANTS
// =============================================================================

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.4, ease: smoothOut },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.25, ease: smoothOut },
  },
};

const headerVariants = {
  hidden: { opacity: 0, y: -8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { delay: 0.1, duration: 0.3, ease: smoothOut },
  },
};

const boardVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { delay: 0.2, duration: 0.4, ease: smoothOut },
  },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get opening lessons from the library.
 */
function getOpeningLessons(): LessonPlan[] {
  return LESSON_LIBRARY.filter((l) => l.category === 'opening');
}

/**
 * Default board renderer (placeholder - requires chess board component integration).
 */
function DefaultBoard({ fen, highlightSquares, arrows }: BoardRenderProps) {
  return (
    <div className="relative w-full aspect-square glass rounded-xl border border-white/[0.08] flex items-center justify-center">
      <div className="text-center p-4">
        <p className="text-sm text-muted-foreground">Board Position</p>
        <p className="font-mono text-xs text-muted-foreground/70 mt-1 break-all">
          {fen.split(' ')[0]}
        </p>
        {highlightSquares && highlightSquares.length > 0 && (
          <p className="text-xs text-primary mt-2">
            Highlight: {highlightSquares.join(', ')}
          </p>
        )}
        {arrows && arrows.length > 0 && (
          <p className="text-xs text-success mt-1">
            Arrows: {arrows.map((a) => `${a.from}-${a.to}`).join(', ')}
          </p>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * OpeningLesson - Interactive chess opening tutor.
 *
 * Teaches opening principles with ring-synchronized visual feedback:
 * - Ring highlights key squares during explanations
 * - Ring intensifies during critical teaching moments
 * - Ring explodes on successful move completion
 *
 * @example
 * ```tsx
 * <OpeningLesson
 *   lessonId="opening-italian-game"
 *   onComplete={() => console.log('Lesson complete!')}
 *   renderBoard={(props) => <ChessBoard {...props} />}
 * />
 * ```
 */
export function OpeningLesson({
  lessonId,
  className,
  onComplete,
  onCancel,
  renderBoard = DefaultBoard,
}: OpeningLessonProps) {
  const {
    currentLesson,
    currentStep,
    currentStepIndex,
    ringState,
    isLessonActive,
    startLesson,
    nextStep,
    endLesson,
    setRingTeaching,
    setRingActive,
    triggerCelebration,
  } = useRingLesson();

  const [showOverlay, setShowOverlay] = useState(true);
  const engine = useMemo(() => getTutoringEngine(), []);

  // Get lesson to use
  const lesson = useMemo(() => {
    if (lessonId) {
      return engine.getLesson(lessonId);
    }
    const openings = getOpeningLessons();
    return openings[0] ?? null;
  }, [lessonId, engine]);

  // Start lesson if not already active
  const handleStart = useCallback(() => {
    if (lesson && !isLessonActive) {
      startLesson(lesson);
      setRingTeaching();
    }
  }, [lesson, isLessonActive, startLesson, setRingTeaching]);

  // Handle move on board
  const handleMove = useCallback(
    (from: string, to: string): boolean => {
      if (!currentStep || currentStep.type !== 'practice') {
        return false;
      }

      const move = `${from}${to}`;
      const isCorrect = currentStep.correctMoves?.includes(move) ?? false;
      const isAcceptable = currentStep.acceptableMoves?.includes(move) ?? false;

      if (isCorrect || isAcceptable) {
        // Trigger celebration and advance
        triggerCelebration().then(() => {
          engine.recordAttempt(true);

          // Check if lesson is complete
          if (currentLesson && currentStepIndex >= currentLesson.steps.length - 1) {
            onComplete?.();
          }
        });
        return true;
      } else {
        // Wrong move - record attempt, stay on step
        engine.recordAttempt(false);
        setRingActive();
        return false;
      }
    },
    [
      currentStep,
      currentLesson,
      currentStepIndex,
      triggerCelebration,
      engine,
      setRingActive,
      onComplete,
    ]
  );

  // Handle hint request
  const handleHint = useCallback(() => {
    const hint = engine.useHint();
    if (hint) {
      setRingTeaching();
    }
  }, [engine, setRingTeaching]);

  // Handle skip
  const handleSkip = useCallback(() => {
    engine.skipStep();
    setRingActive();
  }, [engine, setRingActive]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    endLesson();
    onCancel?.();
  }, [endLesson, onCancel]);

  // If no lesson available
  if (!lesson) {
    return (
      <div className={cn('p-4 text-center text-muted-foreground', className)}>
        <p>No opening lessons available.</p>
      </div>
    );
  }

  // If lesson not started
  if (!isLessonActive) {
    return (
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className={cn('p-4', className)}
      >
        <div className="glass rounded-xl border border-white/[0.08] p-6 max-w-md mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-primary/20">
              <BookOpen className="w-5 h-5 text-primary" strokeWidth={1.75} />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{lesson.title}</h3>
              <p className="text-xs text-muted-foreground">
                {lesson.estimatedMinutes} min | {lesson.difficulty}
              </p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground mb-6">{lesson.description}</p>

          <button
            onClick={handleStart}
            className={cn(
              'w-full py-3 px-4 rounded-lg',
              'bg-primary/20 hover:bg-primary/30',
              'border border-primary/30',
              'text-primary font-medium',
              'transition-colors duration-150',
              'flex items-center justify-center gap-2'
            )}
          >
            Start Lesson
            <ChevronRight className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>
      </motion.div>
    );
  }

  // Active lesson
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className={cn('flex flex-col gap-4', className)}
    >
      {/* Header */}
      <motion.div
        variants={headerVariants}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'p-1.5 rounded-lg transition-colors duration-200',
              ringState === 'teaching'
                ? 'bg-primary/20 text-primary'
                : 'bg-white/5 text-muted-foreground'
            )}
          >
            <BookOpen className="w-4 h-4" strokeWidth={1.75} />
          </div>
          <span className="text-sm font-medium text-foreground">
            {currentLesson?.title}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            Step {currentStepIndex + 1} / {currentLesson?.steps.length}
          </span>
          <button
            onClick={handleCancel}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Cancel lesson"
          >
            <RotateCcw className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>
      </motion.div>

      {/* Board */}
      <motion.div variants={boardVariants} className="relative">
        {renderBoard({
          fen: currentStep?.fen ?? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
          highlightSquares: currentStep?.highlightSquares,
          arrows: currentStep?.arrows,
          onMove: handleMove,
          interactive: currentStep?.type === 'practice' || currentStep?.type === 'challenge',
        })}

        {/* Lesson overlay */}
        <AnimatePresence>
          {showOverlay && (
            <LessonOverlay
              position="bottom"
              targetSquare={currentStep?.highlightSquares?.[0]}
              onNext={() => {
                nextStep();
                setRingActive();
              }}
              onClose={() => setShowOverlay(false)}
            />
          )}
        </AnimatePresence>
      </motion.div>

      {/* Action buttons for practice steps */}
      {currentStep?.type === 'practice' && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex items-center justify-center gap-3"
        >
          <button
            onClick={handleHint}
            className={cn(
              'px-4 py-2 rounded-lg text-sm',
              'bg-white/5 hover:bg-white/10',
              'border border-white/10',
              'text-muted-foreground hover:text-foreground',
              'transition-colors duration-150',
              'flex items-center gap-2'
            )}
          >
            <Lightbulb className="w-4 h-4" strokeWidth={1.75} />
            Hint
          </button>
          <button
            onClick={handleSkip}
            className={cn(
              'px-4 py-2 rounded-lg text-sm',
              'bg-white/5 hover:bg-white/10',
              'border border-white/10',
              'text-muted-foreground hover:text-foreground',
              'transition-colors duration-150'
            )}
          >
            Skip
          </button>
        </motion.div>
      )}

      {/* Celebration overlay */}
      <CongratulationBurst
        message="Great Move!"
        subtext="You found the key opening move"
        iconVariant="star"
      />
    </motion.div>
  );
}

export default OpeningLesson;
