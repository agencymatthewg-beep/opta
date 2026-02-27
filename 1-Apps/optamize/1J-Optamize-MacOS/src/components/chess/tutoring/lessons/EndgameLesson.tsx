/**
 * EndgameLesson - Endgame techniques tutor with ring guiding piece placement
 *
 * Phase 55.5: Chess lesson component for teaching endgame techniques.
 * The Opta Ring guides piece placement by highlighting target squares:
 * - dormant = waiting for user action
 * - active = guiding piece placement with soft glow
 * - teaching = critical technique demonstration
 * - explosion = successful endgame technique executed
 *
 * @see src/contexts/RingLessonContext.tsx for ring integration
 * @see src/lib/tutoringEngine.ts for lesson content
 * @see DESIGN_SYSTEM.md - Part 4: Glass Depth System
 */

import { useCallback, useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, ChevronRight, Lightbulb, RotateCcw, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRingLesson } from '@/contexts/RingLessonContext';
import { LessonOverlay } from '../LessonOverlay';
import { CongratulationBurst } from '../CongratulationBurst';
import { smoothOut } from '@/lib/animations';
import type { LessonPlan, LessonStep } from '@/types/tutoring';
import { getTutoringEngine, LESSON_LIBRARY } from '@/lib/tutoringEngine';

// =============================================================================
// TYPES
// =============================================================================

export interface EndgameLessonProps {
  /** Specific lesson ID to load (defaults to first endgame lesson) */
  lessonId?: string;
  /** Additional CSS classes */
  className?: string;
  /** Callback when lesson completes */
  onComplete?: () => void;
  /** Callback when lesson is cancelled */
  onCancel?: () => void;
  /** Board component to render */
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
  /** Guide squares - where pieces should be placed (endgame-specific) */
  guideSquares?: string[];
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

const guideVariants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: [0.3, 0.6, 0.3],
    scale: [1, 1.05, 1],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut' as const,
    },
  },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get endgame lessons from the library.
 */
function getEndgameLessons(): LessonPlan[] {
  return LESSON_LIBRARY.filter((l) => l.category === 'endgame');
}

/**
 * Extract guide squares from step (where pieces should ideally be placed).
 * Endgame lessons often have specific squares where pieces should go.
 */
function extractGuideSquares(step: LessonStep | null): string[] {
  if (!step) return [];

  // Highlighted squares serve as guides in endgames
  const guides: string[] = [];

  // Add highlighted squares
  if (step.highlightSquares) {
    guides.push(...step.highlightSquares);
  }

  // Add arrow destinations as secondary guides
  if (step.arrows) {
    step.arrows.forEach((arrow) => {
      if (!guides.includes(arrow.to)) {
        guides.push(arrow.to);
      }
    });
  }

  return guides;
}

/**
 * Determine if step is about piece placement vs general concept.
 */
function isPlacementStep(step: LessonStep | null): boolean {
  if (!step) return false;
  return step.type === 'practice' || step.type === 'challenge';
}

/**
 * Default board renderer (placeholder).
 */
function DefaultBoard({ fen, highlightSquares, arrows, guideSquares }: BoardRenderProps) {
  return (
    <div className="relative w-full aspect-square glass rounded-xl border border-white/[0.08] flex items-center justify-center">
      <div className="text-center p-4">
        <p className="text-sm text-muted-foreground">Endgame Position</p>
        <p className="font-mono text-xs text-muted-foreground/70 mt-1 break-all">
          {fen.split(' ')[0]}
        </p>
        {guideSquares && guideSquares.length > 0 && (
          <div className="mt-2 flex items-center justify-center gap-1.5">
            <Target className="w-3 h-3 text-success" />
            <span className="text-xs text-success">
              Target: {guideSquares.join(', ')}
            </span>
          </div>
        )}
        {highlightSquares && highlightSquares.length > 0 && (
          <p className="text-xs text-primary mt-1">
            Key: {highlightSquares.join(', ')}
          </p>
        )}
        {arrows && arrows.length > 0 && (
          <p className="text-xs text-muted-foreground/70 mt-1">
            Path: {arrows.map((a) => `${a.from}-${a.to}`).join(', ')}
          </p>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// GUIDE INDICATOR
// =============================================================================

interface GuideIndicatorProps {
  squares: string[];
  className?: string;
}

/**
 * Visual indicator showing target squares for piece placement.
 */
function GuideIndicator({ squares, className }: GuideIndicatorProps) {
  if (squares.length === 0) return null;

  return (
    <motion.div
      variants={guideVariants}
      initial="hidden"
      animate="visible"
      className={cn(
        'absolute bottom-2 left-2 flex items-center gap-1.5',
        'px-2 py-1 rounded-md',
        'bg-success/10 border border-success/20',
        className
      )}
    >
      <Target className="w-3 h-3 text-success" strokeWidth={1.75} />
      <span className="text-xs text-success font-mono">
        {squares.slice(0, 3).join(', ')}
        {squares.length > 3 && '...'}
      </span>
    </motion.div>
  );
}

// =============================================================================
// PROGRESS INDICATOR
// =============================================================================

interface TechniqueProgressProps {
  step: LessonStep | null;
  lessonTitle: string;
}

/**
 * Shows progress through endgame technique.
 */
function TechniqueProgress({ step, lessonTitle }: TechniqueProgressProps) {
  // Extract technique name from step title or lesson
  const techniqueName = useMemo(() => {
    if (step?.title) {
      if (step.title.toLowerCase().includes('opposition')) return 'Opposition';
      if (step.title.toLowerCase().includes('lucena')) return 'Lucena';
      if (step.title.toLowerCase().includes('philidor')) return 'Philidor';
      if (step.title.toLowerCase().includes('bridge')) return 'Building the Bridge';
      if (step.title.toLowerCase().includes('square')) return 'Square Rule';
    }
    return lessonTitle;
  }, [step, lessonTitle]);

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="text-success">Technique:</span>
      <span className="font-medium text-foreground">{techniqueName}</span>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * EndgameLesson - Interactive endgame technique tutor.
 *
 * Teaches endgame techniques (opposition, Lucena, Philidor) with
 * ring-synchronized visual guidance:
 * - Ring highlights target squares for piece placement
 * - Ring intensity increases during critical positioning
 * - Ring guides user toward optimal piece placement
 * - Ring explodes on successful technique execution
 *
 * @example
 * ```tsx
 * <EndgameLesson
 *   lessonId="endgame-king-pawn"
 *   onComplete={() => console.log('Endgame mastered!')}
 *   renderBoard={(props) => <ChessBoard {...props} />}
 * />
 * ```
 */
export function EndgameLesson({
  lessonId,
  className,
  onComplete,
  onCancel,
  renderBoard = DefaultBoard,
}: EndgameLessonProps) {
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
    resetRing,
    triggerCelebration,
  } = useRingLesson();

  const [showOverlay, setShowOverlay] = useState(true);
  const engine = useMemo(() => getTutoringEngine(), []);

  // Get lesson to use
  const lesson = useMemo(() => {
    if (lessonId) {
      return engine.getLesson(lessonId);
    }
    const endgames = getEndgameLessons();
    return endgames[0] ?? null;
  }, [lessonId, engine]);

  // Extract guide squares for piece placement
  const guideSquares = useMemo(
    () => extractGuideSquares(currentStep),
    [currentStep]
  );

  // Update ring state based on step type
  useEffect(() => {
    if (!isLessonActive) return;

    if (isPlacementStep(currentStep)) {
      // Active guidance during placement
      setRingActive();
    } else if (currentStep?.type === 'demonstration') {
      // Teaching mode during demonstrations
      setRingTeaching();
    }
  }, [currentStep, isLessonActive, setRingActive, setRingTeaching]);

  // Start lesson
  const handleStart = useCallback(() => {
    if (lesson && !isLessonActive) {
      startLesson(lesson);
      setRingActive();
    }
  }, [lesson, isLessonActive, startLesson, setRingActive]);

  // Handle move on board
  const handleMove = useCallback(
    (from: string, to: string): boolean => {
      if (!currentStep || (currentStep.type !== 'practice' && currentStep.type !== 'challenge')) {
        return false;
      }

      const move = `${from}${to}`;
      const isCorrect = currentStep.correctMoves?.includes(move) ?? false;
      const isAcceptable = currentStep.acceptableMoves?.includes(move) ?? false;

      if (isCorrect || isAcceptable) {
        triggerCelebration().then(() => {
          engine.recordAttempt(true);

          if (currentLesson && currentStepIndex >= currentLesson.steps.length - 1) {
            onComplete?.();
          }
        });
        return true;
      } else {
        engine.recordAttempt(false);
        // Gently guide back - show the target squares
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

  // Handle hint
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
    resetRing();
    onCancel?.();
  }, [endLesson, resetRing, onCancel]);

  // No lesson available
  if (!lesson) {
    return (
      <div className={cn('p-4 text-center text-muted-foreground', className)}>
        <p>No endgame lessons available.</p>
      </div>
    );
  }

  // Lesson not started
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
            <div className="p-2 rounded-lg bg-success/20">
              <Crown className="w-5 h-5 text-success" strokeWidth={1.75} />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{lesson.title}</h3>
              <p className="text-xs text-muted-foreground">
                {lesson.estimatedMinutes} min | {lesson.difficulty}
              </p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground mb-4">{lesson.description}</p>

          {/* Endgame tags */}
          {lesson.tags && lesson.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-6">
              {lesson.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 text-xs rounded-full bg-success/10 text-success/80"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          <button
            onClick={handleStart}
            className={cn(
              'w-full py-3 px-4 rounded-lg',
              'bg-success/20 hover:bg-success/30',
              'border border-success/30',
              'text-success font-medium',
              'transition-colors duration-150',
              'flex items-center justify-center gap-2'
            )}
          >
            Start Endgame Study
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
                ? 'bg-success/30 text-success shadow-[0_0_10px_rgba(34,197,94,0.3)]'
                : 'bg-success/20 text-success'
            )}
          >
            <Crown className="w-4 h-4" strokeWidth={1.75} />
          </div>
          <span className="text-sm font-medium text-foreground">
            {currentLesson?.title}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Technique indicator */}
          <TechniqueProgress
            step={currentStep}
            lessonTitle={currentLesson?.title ?? ''}
          />

          <span className="text-xs text-muted-foreground">
            {currentStepIndex + 1} / {currentLesson?.steps.length}
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

      {/* Board with guide squares */}
      <motion.div variants={boardVariants} className="relative">
        {renderBoard({
          fen: currentStep?.fen ?? '8/8/8/8/8/8/8/8 w - - 0 1',
          highlightSquares: currentStep?.highlightSquares,
          arrows: currentStep?.arrows,
          onMove: handleMove,
          interactive: currentStep?.type === 'practice' || currentStep?.type === 'challenge',
          guideSquares: isPlacementStep(currentStep) ? guideSquares : undefined,
        })}

        {/* Guide indicator overlay */}
        {isPlacementStep(currentStep) && guideSquares.length > 0 && (
          <GuideIndicator squares={guideSquares} />
        )}

        {/* Lesson overlay */}
        <AnimatePresence>
          {showOverlay && (
            <LessonOverlay
              position="bottom"
              targetSquare={guideSquares[0]}
              onNext={() => {
                nextStep();
                setRingActive();
              }}
              onClose={() => setShowOverlay(false)}
            />
          )}
        </AnimatePresence>
      </motion.div>

      {/* Action buttons */}
      {(currentStep?.type === 'practice' || currentStep?.type === 'challenge') && (
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
        message="Perfect Technique!"
        subtext="You mastered this endgame pattern"
        iconVariant="sparkles"
      />
    </motion.div>
  );
}

export default EndgameLesson;
