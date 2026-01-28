/**
 * TacticLesson - Tactical patterns tutor with ring intensity matching threat level
 *
 * Phase 55.5: Chess lesson component for teaching tactical patterns like
 * pins, forks, and skewers. The Opta Ring intensity responds to threat level:
 * - dormant = waiting for user action
 * - active = normal tactical explanation
 * - teaching = high threat level (critical tactical moment)
 * - explosion = successful tactic found
 *
 * @see src/contexts/RingLessonContext.tsx for ring integration
 * @see src/lib/tutoringEngine.ts for lesson content
 * @see DESIGN_SYSTEM.md - Part 4: Glass Depth System
 */

import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Swords, ChevronRight, Lightbulb, RotateCcw, Timer } from 'lucide-react';
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

export interface TacticLessonProps {
  /** Specific lesson ID to load (defaults to first tactic lesson) */
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

const timerVariants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { type: 'spring' as const, stiffness: 400, damping: 20 },
  },
  warning: {
    scale: [1, 1.05, 1],
    transition: { duration: 0.3, repeat: Infinity },
  },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get tactic lessons from the library.
 */
function getTacticLessons(): LessonPlan[] {
  return LESSON_LIBRARY.filter((l) => l.category === 'tactic');
}

/**
 * Calculate threat level for a step (determines ring intensity).
 */
function calculateThreatLevel(step: LessonStep | null): number {
  if (!step) return 0;

  // Challenge steps have highest threat level
  if (step.type === 'challenge') return 1.0;

  // Practice steps with time limits are high threat
  if (step.type === 'practice' && step.timeLimitSeconds) return 0.9;

  // Standard practice is moderate threat
  if (step.type === 'practice') return 0.7;

  // Demonstrations show tactical patterns
  if (step.type === 'demonstration') return 0.5;

  // Explanations are calm
  return 0.3;
}

/**
 * Default board renderer (placeholder).
 */
function DefaultBoard({ fen, highlightSquares, arrows }: BoardRenderProps) {
  return (
    <div className="relative w-full aspect-square glass rounded-xl border border-white/[0.08] flex items-center justify-center">
      <div className="text-center p-4">
        <p className="text-sm text-muted-foreground">Tactic Position</p>
        <p className="font-mono text-xs text-muted-foreground/70 mt-1 break-all">
          {fen.split(' ')[0]}
        </p>
        {highlightSquares && highlightSquares.length > 0 && (
          <p className="text-xs text-primary mt-2">
            Targets: {highlightSquares.join(', ')}
          </p>
        )}
        {arrows && arrows.length > 0 && (
          <p className="text-xs text-warning mt-1">
            Attack: {arrows.map((a) => `${a.from}-${a.to}`).join(', ')}
          </p>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// TIMER COMPONENT
// =============================================================================

interface ChallengeTimerProps {
  seconds: number;
  onExpire: () => void;
  isActive: boolean;
}

function ChallengeTimer({ seconds, onExpire, isActive }: ChallengeTimerProps) {
  const [remaining, setRemaining] = useState(seconds);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isActive) {
      setRemaining(seconds);
      return;
    }

    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
          }
          onExpire();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isActive, seconds, onExpire]);

  const isWarning = remaining <= 10;
  const progress = (remaining / seconds) * 100;

  return (
    <motion.div
      variants={timerVariants}
      initial="hidden"
      animate={isWarning ? 'warning' : 'visible'}
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-lg',
        'glass-subtle border',
        isWarning
          ? 'border-warning/50 text-warning'
          : 'border-white/10 text-muted-foreground'
      )}
    >
      <Timer className="w-4 h-4" strokeWidth={1.75} />
      <span className="font-mono text-sm">{remaining}s</span>
      <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', isWarning ? 'bg-warning' : 'bg-primary')}
          initial={{ width: '100%' }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>
    </motion.div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * TacticLesson - Interactive tactical pattern tutor.
 *
 * Teaches tactical patterns (forks, pins, skewers) with ring-synchronized
 * visual feedback where ring intensity matches threat level:
 * - Low threat = dormant ring
 * - Medium threat = active ring
 * - High threat = teaching mode (intense glow)
 * - Success = explosion celebration
 *
 * @example
 * ```tsx
 * <TacticLesson
 *   lessonId="tactic-fork-knight"
 *   onComplete={() => console.log('Tactics mastered!')}
 *   renderBoard={(props) => <ChessBoard {...props} />}
 * />
 * ```
 */
export function TacticLesson({
  lessonId,
  className,
  onComplete,
  onCancel,
  renderBoard = DefaultBoard,
}: TacticLessonProps) {
  const {
    currentLesson,
    currentStep,
    currentStepIndex,
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
  const [isTimerActive, setIsTimerActive] = useState(false);
  const engine = useMemo(() => getTutoringEngine(), []);

  // Get lesson to use
  const lesson = useMemo(() => {
    if (lessonId) {
      return engine.getLesson(lessonId);
    }
    const tactics = getTacticLessons();
    return tactics[0] ?? null;
  }, [lessonId, engine]);

  // Calculate threat level and update ring accordingly
  const threatLevel = useMemo(() => calculateThreatLevel(currentStep), [currentStep]);

  // Update ring state based on threat level
  useEffect(() => {
    if (!isLessonActive) return;

    if (threatLevel >= 0.8) {
      setRingTeaching();
    } else if (threatLevel >= 0.4) {
      setRingActive();
    } else {
      // Keep current state for low threat
    }
  }, [threatLevel, isLessonActive, setRingTeaching, setRingActive]);

  // Start timer for challenge steps
  useEffect(() => {
    if (currentStep?.type === 'challenge' && currentStep.timeLimitSeconds) {
      setIsTimerActive(true);
    } else {
      setIsTimerActive(false);
    }
  }, [currentStep]);

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

      if (isCorrect) {
        setIsTimerActive(false);
        triggerCelebration().then(() => {
          engine.recordAttempt(true);

          if (currentLesson && currentStepIndex >= currentLesson.steps.length - 1) {
            onComplete?.();
          }
        });
        return true;
      } else {
        engine.recordAttempt(false);
        // Tactical failure - ring pulses as warning
        setRingTeaching();
        return false;
      }
    },
    [
      currentStep,
      currentLesson,
      currentStepIndex,
      triggerCelebration,
      engine,
      setRingTeaching,
      onComplete,
    ]
  );

  // Handle timer expiry
  const handleTimerExpire = useCallback(() => {
    engine.skipStep();
    resetRing();
  }, [engine, resetRing]);

  // Handle hint
  const handleHint = useCallback(() => {
    const hint = engine.useHint();
    if (hint) {
      setRingTeaching();
    }
  }, [engine, setRingTeaching]);

  // Handle skip
  const handleSkip = useCallback(() => {
    setIsTimerActive(false);
    engine.skipStep();
    setRingActive();
  }, [engine, setRingActive]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    setIsTimerActive(false);
    endLesson();
    onCancel?.();
  }, [endLesson, onCancel]);

  // No lesson available
  if (!lesson) {
    return (
      <div className={cn('p-4 text-center text-muted-foreground', className)}>
        <p>No tactical lessons available.</p>
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
            <div className="p-2 rounded-lg bg-warning/20">
              <Swords className="w-5 h-5 text-warning" strokeWidth={1.75} />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{lesson.title}</h3>
              <p className="text-xs text-muted-foreground">
                {lesson.estimatedMinutes} min | {lesson.difficulty}
              </p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground mb-4">{lesson.description}</p>

          {/* Tactic tags */}
          {lesson.tags && lesson.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-6">
              {lesson.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 text-xs rounded-full bg-warning/10 text-warning/80"
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
              'bg-warning/20 hover:bg-warning/30',
              'border border-warning/30',
              'text-warning font-medium',
              'transition-colors duration-150',
              'flex items-center justify-center gap-2'
            )}
          >
            Start Training
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
      {/* Header with threat indicator */}
      <motion.div
        variants={headerVariants}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'p-1.5 rounded-lg transition-colors duration-200',
              threatLevel >= 0.8
                ? 'bg-warning/30 text-warning shadow-[0_0_10px_rgba(234,179,8,0.3)]'
                : threatLevel >= 0.5
                  ? 'bg-warning/20 text-warning'
                  : 'bg-white/5 text-muted-foreground'
            )}
          >
            <Swords className="w-4 h-4" strokeWidth={1.75} />
          </div>
          <span className="text-sm font-medium text-foreground">
            {currentLesson?.title}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Timer for challenge steps */}
          {currentStep?.timeLimitSeconds && (
            <ChallengeTimer
              seconds={currentStep.timeLimitSeconds}
              onExpire={handleTimerExpire}
              isActive={isTimerActive}
            />
          )}

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

      {/* Board with threat-level glow */}
      <motion.div
        variants={boardVariants}
        className={cn(
          'relative rounded-xl transition-shadow duration-300',
          threatLevel >= 0.8 && 'shadow-[0_0_20px_rgba(234,179,8,0.2)]'
        )}
      >
        {renderBoard({
          fen: currentStep?.fen ?? '8/8/8/8/8/8/8/8 w - - 0 1',
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
        message="Tactical Strike!"
        subtext="You found the winning tactic"
        iconVariant="trophy"
      />
    </motion.div>
  );
}

export default TacticLesson;
