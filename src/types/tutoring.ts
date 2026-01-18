/**
 * Chess tutoring types for Opta.
 *
 * Supports the Opta Ring Tutoring system with:
 * - Lesson sequencing (LessonStep, LessonPlan)
 * - Progress tracking (completed lessons, success rate)
 * - Ring state integration (dormant=waiting, active=teaching, explosion=success)
 *
 * @see src/lib/tutoringEngine.ts for implementation
 * @see src/components/OptaRing3D/types.ts for ring states
 */

import type { RingState } from '@/components/OptaRing3D/types';

/**
 * Lesson category for organization.
 */
export type LessonCategory = 'opening' | 'tactic' | 'endgame' | 'strategy' | 'checkmate';

/**
 * Lesson difficulty level.
 */
export type LessonDifficulty = 'beginner' | 'intermediate' | 'advanced' | 'expert';

/**
 * Type of instruction within a lesson step.
 */
export type StepType =
  | 'explanation'   // Text explanation with optional board position
  | 'demonstration' // Show a move or sequence
  | 'practice'      // Player must make correct move(s)
  | 'quiz'          // Multiple choice question
  | 'challenge';    // Timed or scored practice

/**
 * A single step within a lesson.
 */
export interface LessonStep {
  /** Unique step ID within the lesson */
  id: string;
  /** Type of instruction */
  type: StepType;
  /** Step title */
  title: string;
  /** Explanation text (markdown supported) */
  content: string;
  /** Board position in FEN (if applicable) */
  fen?: string;
  /** Correct move(s) in UCI notation (for practice/challenge) */
  correctMoves?: string[];
  /** Alternative acceptable moves (still correct but not optimal) */
  acceptableMoves?: string[];
  /** Hint text for when player is stuck */
  hints?: string[];
  /** Squares to highlight on the board */
  highlightSquares?: string[];
  /** Arrows to draw (from->to pairs) */
  arrows?: Array<{ from: string; to: string; color?: string }>;
  /** Time limit in seconds (for challenge type) */
  timeLimitSeconds?: number;
  /** Points awarded for completing this step */
  points?: number;
}

/**
 * A complete lesson plan with multiple steps.
 */
export interface LessonPlan {
  /** Unique lesson ID */
  id: string;
  /** Lesson title */
  title: string;
  /** Short description */
  description: string;
  /** Category for organization */
  category: LessonCategory;
  /** Difficulty level */
  difficulty: LessonDifficulty;
  /** Ordered list of steps */
  steps: LessonStep[];
  /** Estimated duration in minutes */
  estimatedMinutes: number;
  /** Prerequisites (lesson IDs) */
  prerequisites?: string[];
  /** Tags for filtering */
  tags?: string[];
  /** Author or source */
  author?: string;
}

/**
 * Progress through a single lesson step.
 */
export interface StepProgress {
  /** Step ID */
  stepId: string;
  /** Completion status */
  status: 'not_started' | 'in_progress' | 'completed' | 'skipped';
  /** Number of attempts (for practice steps) */
  attempts: number;
  /** Number of hints used */
  hintsUsed: number;
  /** Time spent in milliseconds */
  timeSpentMs: number;
  /** Points earned */
  pointsEarned: number;
  /** Timestamp of completion (if completed) */
  completedAt?: number;
}

/**
 * Progress through an entire lesson.
 */
export interface LessonProgress {
  /** Lesson ID */
  lessonId: string;
  /** Current step index (0-based) */
  currentStepIndex: number;
  /** Progress for each step */
  stepProgress: StepProgress[];
  /** Overall status */
  status: 'not_started' | 'in_progress' | 'completed' | 'abandoned';
  /** Timestamp when started */
  startedAt: number;
  /** Timestamp when completed (if completed) */
  completedAt?: number;
  /** Total points earned */
  totalPoints: number;
  /** Success rate (correct attempts / total attempts) */
  successRate: number;
}

/**
 * Overall tutoring statistics for a user.
 */
export interface TutoringStats {
  /** Total lessons completed */
  lessonsCompleted: number;
  /** Total steps completed */
  stepsCompleted: number;
  /** Total points earned */
  totalPoints: number;
  /** Overall success rate */
  overallSuccessRate: number;
  /** Time spent learning in milliseconds */
  totalTimeSpentMs: number;
  /** Lessons completed by category */
  byCategory: Record<LessonCategory, number>;
  /** Current streak (consecutive days with lesson completion) */
  currentStreak: number;
  /** Best streak ever achieved */
  bestStreak: number;
  /** Last lesson date (ISO string) */
  lastLessonDate: string | null;
}

/**
 * Ring state mapping for tutoring phases.
 * Maps tutoring actions to appropriate ring states.
 */
export const TUTORING_RING_STATES: Record<string, RingState> = {
  /** Waiting for user to start or continue */
  waiting: 'dormant',
  /** Actively teaching/showing content */
  teaching: 'active',
  /** User is practicing */
  practicing: 'active',
  /** Processing user input */
  thinking: 'processing',
  /** User completed step successfully */
  success: 'exploding',
  /** Recovering after celebration */
  cooldown: 'recovering',
} as const;

/**
 * Current tutoring session state.
 */
export interface TutoringSession {
  /** Current lesson (if active) */
  currentLesson: LessonPlan | null;
  /** Current lesson progress */
  progress: LessonProgress | null;
  /** Current ring state for tutoring */
  ringState: RingState;
  /** Whether the session is paused */
  isPaused: boolean;
  /** Whether the session is loading */
  isLoading: boolean;
  /** Error message (if any) */
  error: string | null;
}

/**
 * Default tutoring statistics.
 */
export const DEFAULT_TUTORING_STATS: TutoringStats = {
  lessonsCompleted: 0,
  stepsCompleted: 0,
  totalPoints: 0,
  overallSuccessRate: 0,
  totalTimeSpentMs: 0,
  byCategory: {
    opening: 0,
    tactic: 0,
    endgame: 0,
    strategy: 0,
    checkmate: 0,
  },
  currentStreak: 0,
  bestStreak: 0,
  lastLessonDate: null,
};

/**
 * Create initial step progress.
 */
export function createStepProgress(stepId: string): StepProgress {
  return {
    stepId,
    status: 'not_started',
    attempts: 0,
    hintsUsed: 0,
    timeSpentMs: 0,
    pointsEarned: 0,
  };
}

/**
 * Create initial lesson progress.
 */
export function createLessonProgress(lesson: LessonPlan): LessonProgress {
  return {
    lessonId: lesson.id,
    currentStepIndex: 0,
    stepProgress: lesson.steps.map((step) => createStepProgress(step.id)),
    status: 'not_started',
    startedAt: Date.now(),
    totalPoints: 0,
    successRate: 0,
  };
}

/**
 * Create initial tutoring session.
 */
export function createInitialSession(): TutoringSession {
  return {
    currentLesson: null,
    progress: null,
    ringState: 'dormant',
    isPaused: false,
    isLoading: false,
    error: null,
  };
}

/**
 * Calculate success rate from step progress.
 */
export function calculateSuccessRate(stepProgress: StepProgress[]): number {
  const practiceSteps = stepProgress.filter(
    (sp) => sp.status === 'completed' && sp.attempts > 0
  );
  if (practiceSteps.length === 0) return 1;

  const totalAttempts = practiceSteps.reduce((sum, sp) => sum + sp.attempts, 0);
  const successfulAttempts = practiceSteps.length; // Each completed step = 1 success
  return successfulAttempts / totalAttempts;
}

/**
 * Get difficulty color for display.
 */
export function getDifficultyColor(difficulty: LessonDifficulty): string {
  switch (difficulty) {
    case 'beginner':
      return 'text-success';
    case 'intermediate':
      return 'text-primary';
    case 'advanced':
      return 'text-warning';
    case 'expert':
      return 'text-danger';
  }
}

/**
 * Format category name for display.
 */
export function formatCategory(category: LessonCategory): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}
