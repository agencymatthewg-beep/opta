import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from 'react';
import {
  type LessonPlan,
  type LessonStep,
  type RingLessonState,
  type RingLessonContextValue,
  RING_LESSON_ENERGY,
  DEFAULT_RING_LESSON_CONTEXT,
} from '@/types/tutoring';
import { useOptaRingOptional } from './OptaRingContext';

/**
 * RingLessonContext - Links Opta Ring animations to chess tutoring moments
 *
 * Phase 55.2: Ring Lesson State Context
 *
 * This context bridges the chess tutoring system with the Opta Ring,
 * synchronizing ring state with lesson progress:
 *
 * | Lesson State    | Ring State  | Energy | Visual Effect           |
 * |-----------------|-------------|--------|-------------------------|
 * | Waiting/Idle    | dormant     | 0.1    | Slow spin, dim glow     |
 * | Showing hint    | active      | 0.5    | Engaged, brighter       |
 * | Teaching moment | teaching    | 0.8    | High energy, attention  |
 * | Success!        | celebration | 1.0    | Explosion effect        |
 *
 * @see src/types/tutoring.ts for type definitions
 * @see src/contexts/OptaRingContext.tsx for ring state machine
 */

const RingLessonContext = createContext<RingLessonContextValue>(
  DEFAULT_RING_LESSON_CONTEXT
);

/** Celebration duration in milliseconds */
const CELEBRATION_DURATION = 1200;

/** Recovery duration after celebration */
const RECOVERY_DURATION = 500;

/** Internal state shape */
interface InternalState {
  currentLesson: LessonPlan | null;
  currentStepIndex: number;
  ringState: RingLessonState;
}

const DEFAULT_INTERNAL_STATE: InternalState = {
  currentLesson: null,
  currentStepIndex: 0,
  ringState: 'dormant',
};

/**
 * Provider component for RingLessonContext
 *
 * Wrap chess components with this provider to enable ring-synchronized
 * teaching moments. Integrates with OptaRingContext when available.
 *
 * @example
 * ```tsx
 * <RingLessonProvider>
 *   <ChessLesson />
 *   <PuzzleBoard />
 * </RingLessonProvider>
 * ```
 */
export function RingLessonProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<InternalState>(DEFAULT_INTERNAL_STATE);
  const celebrationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Optional integration with OptaRingContext
  const optaRing = useOptaRingOptional();

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (celebrationTimeoutRef.current) {
        clearTimeout(celebrationTimeoutRef.current);
      }
    };
  }, []);

  // Derive current step from state
  const currentStep = useMemo<LessonStep | null>(() => {
    if (!state.currentLesson) return null;
    return state.currentLesson.steps[state.currentStepIndex] ?? null;
  }, [state.currentLesson, state.currentStepIndex]);

  // Derive energy level from ring state
  const energyLevel = useMemo(
    () => RING_LESSON_ENERGY[state.ringState],
    [state.ringState]
  );

  // Sync with OptaRingContext when available
  const syncOptaRing = useCallback(
    (ringState: RingLessonState) => {
      if (!optaRing) return;

      switch (ringState) {
        case 'dormant':
          // Let OptaRing handle its own dormant state
          if (optaRing.state !== 'dormant') {
            optaRing.sleep();
          }
          break;
        case 'active':
        case 'teaching':
          // Ignite the ring if dormant
          if (optaRing.state === 'dormant') {
            optaRing.ignite();
          }
          break;
        case 'celebration':
          // Trigger explosion effect
          if (optaRing.state === 'active' || optaRing.state === 'processing') {
            optaRing.triggerExplosion();
          } else if (optaRing.state === 'dormant') {
            // Need to ignite first, then explode
            optaRing.ignite().then(() => {
              optaRing.triggerExplosion();
            });
          }
          break;
      }
    },
    [optaRing]
  );

  // Set ring to teaching mode
  const setRingTeaching = useCallback(() => {
    setState((prev) => ({ ...prev, ringState: 'teaching' }));
    syncOptaRing('teaching');
  }, [syncOptaRing]);

  // Set ring to active mode
  const setRingActive = useCallback(() => {
    setState((prev) => ({ ...prev, ringState: 'active' }));
    syncOptaRing('active');
  }, [syncOptaRing]);

  // Reset ring to dormant
  const resetRing = useCallback(() => {
    setState((prev) => ({ ...prev, ringState: 'dormant' }));
    syncOptaRing('dormant');
  }, [syncOptaRing]);

  // Trigger celebration explosion
  const triggerCelebration = useCallback(async () => {
    // Clear any existing timeout
    if (celebrationTimeoutRef.current) {
      clearTimeout(celebrationTimeoutRef.current);
    }

    // Set celebration state
    setState((prev) => ({ ...prev, ringState: 'celebration' }));
    syncOptaRing('celebration');

    // Return to active after celebration
    return new Promise<void>((resolve) => {
      celebrationTimeoutRef.current = setTimeout(() => {
        setState((prev) => ({ ...prev, ringState: 'active' }));
        // Don't sync here - OptaRing handles recovery automatically
        resolve();
      }, CELEBRATION_DURATION + RECOVERY_DURATION);
    });
  }, [syncOptaRing]);

  // Start a lesson
  const startLesson = useCallback(
    (lesson: LessonPlan) => {
      setState({
        currentLesson: lesson,
        currentStepIndex: 0,
        ringState: 'active',
      });
      syncOptaRing('active');
    },
    [syncOptaRing]
  );

  // Advance to next step
  const nextStep = useCallback(() => {
    setState((prev) => {
      if (!prev.currentLesson) return prev;
      const nextIndex = prev.currentStepIndex + 1;
      if (nextIndex >= prev.currentLesson.steps.length) {
        // Lesson complete
        return prev;
      }
      return { ...prev, currentStepIndex: nextIndex };
    });
  }, []);

  // Go to previous step
  const previousStep = useCallback(() => {
    setState((prev) => {
      if (!prev.currentLesson || prev.currentStepIndex === 0) return prev;
      return { ...prev, currentStepIndex: prev.currentStepIndex - 1 };
    });
  }, []);

  // End the current lesson
  const endLesson = useCallback(() => {
    setState({
      currentLesson: null,
      currentStepIndex: 0,
      ringState: 'dormant',
    });
    syncOptaRing('dormant');
  }, [syncOptaRing]);

  // Build context value
  const value: RingLessonContextValue = useMemo(
    () => ({
      currentLesson: state.currentLesson,
      currentStep,
      currentStepIndex: state.currentStepIndex,
      ringState: state.ringState,
      energyLevel,
      isLessonActive: state.currentLesson !== null,
      setRingTeaching,
      setRingActive,
      triggerCelebration,
      resetRing,
      startLesson,
      nextStep,
      previousStep,
      endLesson,
    }),
    [
      state.currentLesson,
      state.currentStepIndex,
      state.ringState,
      currentStep,
      energyLevel,
      setRingTeaching,
      setRingActive,
      triggerCelebration,
      resetRing,
      startLesson,
      nextStep,
      previousStep,
      endLesson,
    ]
  );

  return (
    <RingLessonContext.Provider value={value}>
      {children}
    </RingLessonContext.Provider>
  );
}

/**
 * Hook to access RingLessonContext
 *
 * Provides access to lesson state and ring control functions:
 * - `currentLesson` / `currentStep` - Current lesson progress
 * - `ringState` / `energyLevel` - Ring visual state
 * - `setRingTeaching()` - Activate teaching mode (high energy)
 * - `setRingActive()` - Set to active mode (normal energy)
 * - `triggerCelebration()` - Trigger explosion for success
 * - `resetRing()` - Return to dormant state
 *
 * @example
 * ```tsx
 * function PuzzleSolver() {
 *   const { triggerCelebration, setRingTeaching } = useRingLesson();
 *
 *   const handleCorrectMove = async () => {
 *     await triggerCelebration();
 *   };
 *
 *   const showHint = () => {
 *     setRingTeaching();
 *   };
 * }
 * ```
 */
export function useRingLesson(): RingLessonContextValue {
  return useContext(RingLessonContext);
}

/**
 * Hook to access just the ring state (for performance-sensitive renders)
 */
export function useRingLessonState(): RingLessonState {
  const { ringState } = useRingLesson();
  return ringState;
}

/**
 * Hook to access just the energy level
 */
export function useRingLessonEnergy(): number {
  const { energyLevel } = useRingLesson();
  return energyLevel;
}

/**
 * Hook to check if a lesson is active
 */
export function useIsLessonActive(): boolean {
  const { isLessonActive } = useRingLesson();
  return isLessonActive;
}

export default RingLessonContext;
