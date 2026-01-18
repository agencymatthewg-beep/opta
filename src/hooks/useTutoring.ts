/**
 * useTutoring - React hook for chess tutoring lesson state management.
 *
 * Phase 55.6: Opta Ring Tutoring System
 *
 * Provides:
 * - Lesson progression via TutoringEngine
 * - Ring state synchronization via RingLessonContext
 * - Progress tracking with localStorage persistence
 * - Actions for lesson control (start, next, skip, complete)
 *
 * @see src/lib/tutoringEngine.ts for lesson sequencing
 * @see src/contexts/RingLessonContext.tsx for ring integration
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  getTutoringEngine,
  LESSON_LIBRARY,
} from '@/lib/tutoringEngine';
import { useRingLesson } from '@/contexts/RingLessonContext';
import type {
  LessonPlan,
  LessonProgress,
  LessonStep,
  TutoringStats,
  TutoringSession,
  LessonCategory,
  LessonDifficulty,
} from '@/types/tutoring';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Lesson progress state exposed by the hook.
 */
export interface LessonProgressState {
  /** Current lesson (if active) */
  currentLesson: LessonPlan | null;
  /** Current step in the lesson */
  currentStep: LessonStep | null;
  /** Current step index (0-based) */
  currentStepIndex: number;
  /** Total steps in current lesson */
  totalSteps: number;
  /** Total points earned in current lesson */
  score: number;
  /** Success rate for current lesson (0-1) */
  successRate: number;
  /** Whether a lesson is currently active */
  isLessonActive: boolean;
  /** Whether the current step is a practice/challenge step */
  isPracticeStep: boolean;
  /** Whether the lesson is paused */
  isPaused: boolean;
  /** Error message (if any) */
  error: string | null;
}

/**
 * Actions available from the hook.
 */
export interface TutoringActions {
  /** Start a lesson by ID */
  startLesson: (lessonId: string) => void;
  /** Advance to next step (for non-practice steps) */
  nextStep: () => void;
  /** Go back to previous step */
  previousStep: () => void;
  /** Complete the current step with points (for practice steps) */
  completeStep: (correct: boolean) => void;
  /** Skip the current step */
  skipStep: () => void;
  /** Use a hint for the current step */
  useHint: () => string | null;
  /** End/abandon the current lesson */
  endLesson: (abandon?: boolean) => void;
  /** Toggle pause state */
  togglePause: () => void;
  /** Refresh state from engine */
  refresh: () => void;
}

/**
 * Filtering options for lessons.
 */
export interface LessonFilters {
  category?: LessonCategory;
  difficulty?: LessonDifficulty;
  tags?: string[];
}

/**
 * Lesson listing utilities.
 */
export interface LessonListing {
  /** All available lessons */
  allLessons: LessonPlan[];
  /** Get lessons by category */
  getLessonsByCategory: (category: LessonCategory) => LessonPlan[];
  /** Get lessons by difficulty */
  getLessonsByDifficulty: (difficulty: LessonDifficulty) => LessonPlan[];
  /** Get filtered lessons */
  getFilteredLessons: (filters: LessonFilters) => LessonPlan[];
  /** Get progress for a specific lesson */
  getLessonProgress: (lessonId: string) => LessonProgress | null;
  /** Check if a lesson is completed */
  isLessonCompleted: (lessonId: string) => boolean;
}

/**
 * Complete return type for useTutoring hook.
 */
export interface UseTutoringReturn {
  /** Current lesson progress state */
  progress: LessonProgressState;
  /** Actions for lesson control */
  actions: TutoringActions;
  /** Lesson listing utilities */
  lessons: LessonListing;
  /** Overall tutoring statistics */
  stats: TutoringStats;
  /** Loading state */
  isLoading: boolean;
}

// =============================================================================
// HOOK IMPLEMENTATION
// =============================================================================

/**
 * Hook for chess tutoring lesson state management.
 *
 * Integrates with TutoringEngine for lesson progression and RingLessonContext
 * for ring state synchronization.
 *
 * @example
 * ```tsx
 * function ChessLesson() {
 *   const {
 *     progress,
 *     actions,
 *     lessons,
 *     stats,
 *   } = useTutoring();
 *
 *   const handleStart = () => {
 *     actions.startLesson('opening-italian-game');
 *   };
 *
 *   const handleCorrectMove = () => {
 *     actions.completeStep(true); // Triggers ring celebration
 *   };
 *
 *   return (
 *     <div>
 *       {progress.isLessonActive && (
 *         <LessonView
 *           step={progress.currentStep}
 *           onComplete={handleCorrectMove}
 *         />
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useTutoring(): UseTutoringReturn {
  // Get singleton engine instance
  const engine = useMemo(() => getTutoringEngine(), []);

  // Ring lesson context for state synchronization
  const ringLesson = useRingLesson();

  // Local state synced with engine
  const [session, setSession] = useState<TutoringSession>(() => engine.getSession());
  const [stats, setStats] = useState<TutoringStats>(() => engine.getStats());
  const [isLoading, setIsLoading] = useState(false);

  // Sync state from engine
  const syncState = useCallback(() => {
    setSession(engine.getSession());
    setStats(engine.getStats());
  }, [engine]);

  // Sync ring state when session changes
  useEffect(() => {
    if (session.currentLesson) {
      // Sync to ring context
      if (session.ringState === 'exploding') {
        ringLesson.triggerCelebration();
      } else if (session.ringState === 'active') {
        ringLesson.setRingActive();
      } else if (session.ringState === 'dormant') {
        ringLesson.resetRing();
      }
    }
  }, [session.ringState, session.currentLesson, ringLesson]);

  // ==========================================================================
  // PROGRESS STATE
  // ==========================================================================

  const progress: LessonProgressState = useMemo(() => {
    const currentStep = engine.getCurrentStep();
    const isPracticeStep = currentStep?.type === 'practice' || currentStep?.type === 'challenge';

    return {
      currentLesson: session.currentLesson,
      currentStep,
      currentStepIndex: session.progress?.currentStepIndex ?? 0,
      totalSteps: session.currentLesson?.steps.length ?? 0,
      score: session.progress?.totalPoints ?? 0,
      successRate: session.progress?.successRate ?? 0,
      isLessonActive: session.currentLesson !== null,
      isPracticeStep,
      isPaused: session.isPaused,
      error: session.error,
    };
  }, [session, engine]);

  // ==========================================================================
  // ACTIONS
  // ==========================================================================

  const startLesson = useCallback((lessonId: string) => {
    setIsLoading(true);
    try {
      engine.startLesson(lessonId);
      syncState();

      // Sync to ring context
      const lesson = engine.getLesson(lessonId);
      if (lesson) {
        ringLesson.startLesson(lesson);
      }
    } finally {
      setIsLoading(false);
    }
  }, [engine, syncState, ringLesson]);

  const nextStep = useCallback(() => {
    if (!progress.isPracticeStep) {
      // For non-practice steps, just advance
      engine.completeStep(0);
      syncState();
      ringLesson.nextStep();
    }
  }, [engine, syncState, progress.isPracticeStep, ringLesson]);

  const previousStep = useCallback(() => {
    ringLesson.previousStep();
    // Note: TutoringEngine doesn't support going back, but RingLessonContext does
    // This is a UI-only feature for reviewing previous explanations
  }, [ringLesson]);

  const completeStep = useCallback((correct: boolean) => {
    engine.recordAttempt(correct);
    syncState();

    if (correct) {
      // Ring celebration is triggered by session.ringState change
      // which is handled in useEffect above
    }
  }, [engine, syncState]);

  const skipStep = useCallback(() => {
    engine.skipStep();
    syncState();
    ringLesson.nextStep();
  }, [engine, syncState, ringLesson]);

  const useHint = useCallback((): string | null => {
    const hint = engine.useHint();
    ringLesson.setRingTeaching();
    return hint;
  }, [engine, ringLesson]);

  const endLesson = useCallback((abandon: boolean = false) => {
    engine.endLesson(abandon);
    syncState();
    ringLesson.endLesson();
  }, [engine, syncState, ringLesson]);

  const togglePause = useCallback(() => {
    engine.togglePause();
    syncState();
  }, [engine, syncState]);

  const refresh = useCallback(() => {
    syncState();
  }, [syncState]);

  const actions: TutoringActions = useMemo(() => ({
    startLesson,
    nextStep,
    previousStep,
    completeStep,
    skipStep,
    useHint,
    endLesson,
    togglePause,
    refresh,
  }), [
    startLesson,
    nextStep,
    previousStep,
    completeStep,
    skipStep,
    useHint,
    endLesson,
    togglePause,
    refresh,
  ]);

  // ==========================================================================
  // LESSON LISTING
  // ==========================================================================

  const getLessonsByCategory = useCallback((category: LessonCategory): LessonPlan[] => {
    return engine.getLessonsByCategory(category);
  }, [engine]);

  const getLessonsByDifficulty = useCallback((difficulty: LessonDifficulty): LessonPlan[] => {
    return engine.getLessonsByDifficulty(difficulty);
  }, [engine]);

  const getFilteredLessons = useCallback((filters: LessonFilters): LessonPlan[] => {
    let result = LESSON_LIBRARY;

    if (filters.category) {
      result = result.filter((l) => l.category === filters.category);
    }
    if (filters.difficulty) {
      result = result.filter((l) => l.difficulty === filters.difficulty);
    }
    if (filters.tags && filters.tags.length > 0) {
      result = result.filter((l) =>
        l.tags?.some((t) => filters.tags!.includes(t))
      );
    }

    return result;
  }, []);

  const getLessonProgress = useCallback((lessonId: string): LessonProgress | null => {
    return engine.getLessonProgress(lessonId);
  }, [engine]);

  const isLessonCompleted = useCallback((lessonId: string): boolean => {
    const progress = engine.getLessonProgress(lessonId);
    return progress?.status === 'completed';
  }, [engine]);

  const lessons: LessonListing = useMemo(() => ({
    allLessons: LESSON_LIBRARY,
    getLessonsByCategory,
    getLessonsByDifficulty,
    getFilteredLessons,
    getLessonProgress,
    isLessonCompleted,
  }), [
    getLessonsByCategory,
    getLessonsByDifficulty,
    getFilteredLessons,
    getLessonProgress,
    isLessonCompleted,
  ]);

  // ==========================================================================
  // RETURN
  // ==========================================================================

  return {
    progress,
    actions,
    lessons,
    stats,
    isLoading,
  };
}

// =============================================================================
// CONVENIENCE HOOKS
// =============================================================================

/**
 * Hook for just the current lesson progress (minimal re-renders).
 */
export function useLessonProgress(): LessonProgressState {
  const { progress } = useTutoring();
  return progress;
}

/**
 * Hook for just the tutoring actions.
 */
export function useTutoringActions(): TutoringActions {
  const { actions } = useTutoring();
  return actions;
}

/**
 * Hook for just the tutoring statistics.
 */
export function useTutoringStats(): TutoringStats {
  const { stats } = useTutoring();
  return stats;
}

/**
 * Hook for checking if a lesson is active.
 */
export function useIsLessonInProgress(): boolean {
  const { progress } = useTutoring();
  return progress.isLessonActive;
}

export default useTutoring;
