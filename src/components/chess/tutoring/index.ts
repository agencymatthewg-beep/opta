/**
 * Chess Tutoring Components
 *
 * Phase 55: Opta Ring Tutoring - Components for ring-synchronized
 * chess lessons and tutorials.
 *
 * @see src/contexts/RingLessonContext.tsx for ring integration
 * @see src/lib/tutoringEngine.ts for lesson sequencing
 */

export { LessonOverlay } from './LessonOverlay';
export type { LessonOverlayProps } from './LessonOverlay';

export { CongratulationBurst, useCongratulationBurst } from './CongratulationBurst';
export type { CongratulationBurstProps } from './CongratulationBurst';

// Phase 55.5: Lesson-specific components
export { OpeningLesson, TacticLesson, EndgameLesson } from './lessons';
export type {
  OpeningLessonProps,
  TacticLessonProps,
  EndgameLessonProps,
} from './lessons';
