/**
 * Chess Lesson Components
 *
 * Phase 55.5: Lesson-specific components for Opta Ring Tutoring.
 * Each lesson type has ring integration that matches its teaching style:
 *
 * - OpeningLesson: Ring highlights key squares for opening principles
 * - TacticLesson: Ring intensity matches threat level (pins, forks, skewers)
 * - EndgameLesson: Ring guides piece placement toward optimal positions
 *
 * @see src/contexts/RingLessonContext.tsx for ring integration
 * @see src/lib/tutoringEngine.ts for lesson content
 */

export { OpeningLesson } from './OpeningLesson';
export type { OpeningLessonProps, BoardRenderProps as OpeningBoardRenderProps } from './OpeningLesson';

export { TacticLesson } from './TacticLesson';
export type { TacticLessonProps, BoardRenderProps as TacticBoardRenderProps } from './TacticLesson';

export { EndgameLesson } from './EndgameLesson';
export type { EndgameLessonProps, BoardRenderProps as EndgameBoardRenderProps } from './EndgameLesson';
