/**
 * TutoringEngine - Chess lesson sequencing and progress tracking.
 *
 * Phase 55.1: Opta Ring Tutoring System
 *
 * Provides:
 * - Lesson sequencing with step-by-step progression
 * - Progress tracking with persistence
 * - Lesson library for openings, tactics, and endgames
 * - Ring state integration for visual feedback
 *
 * Ring State Mapping:
 * - dormant = waiting for user
 * - active = teaching/practicing
 * - exploding = success celebration
 *
 * @see src/types/tutoring.ts for type definitions
 * @see src/contexts/OptaRingContext.tsx for ring control
 */

import type {
  LessonPlan,
  LessonProgress,
  StepProgress,
  TutoringStats,
  TutoringSession,
  LessonCategory,
  LessonDifficulty,
} from '@/types/tutoring';
import {
  createLessonProgress,
  calculateSuccessRate,
  DEFAULT_TUTORING_STATS,
  createInitialSession,
  TUTORING_RING_STATES,
} from '@/types/tutoring';
import type { RingState } from '@/components/OptaRing3D/types';

// =============================================================================
// STORAGE KEYS
// =============================================================================

const STORAGE_KEYS = {
  STATS: 'opta-tutoring-stats',
  PROGRESS: 'opta-tutoring-progress',
  SESSION: 'opta-tutoring-session',
} as const;

// =============================================================================
// LESSON LIBRARY
// =============================================================================

/**
 * Built-in lesson library organized by category.
 * Each lesson teaches a specific concept with progressive steps.
 */
export const LESSON_LIBRARY: LessonPlan[] = [
  // -------------------------------------------------------------------------
  // OPENING LESSONS
  // -------------------------------------------------------------------------
  {
    id: 'opening-italian-game',
    title: 'The Italian Game',
    description: 'Learn one of the oldest and most popular chess openings.',
    category: 'opening',
    difficulty: 'beginner',
    estimatedMinutes: 10,
    tags: ['e4', 'bishop', 'center control'],
    steps: [
      {
        id: 'italian-1',
        type: 'explanation',
        title: 'Introduction',
        content:
          'The Italian Game is a classic opening that begins with 1.e4 e5 2.Nf3 Nc6 3.Bc4. White develops pieces quickly while targeting the f7 square.',
        fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3',
        highlightSquares: ['c4', 'f7'],
      },
      {
        id: 'italian-2',
        type: 'demonstration',
        title: 'The Opening Moves',
        content:
          "Let's see the first three moves of the Italian Game. White controls the center and develops the bishop to an active square.",
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        arrows: [
          { from: 'e2', to: 'e4' },
          { from: 'g1', to: 'f3' },
          { from: 'f1', to: 'c4' },
        ],
      },
      {
        id: 'italian-3',
        type: 'practice',
        title: 'Play the Opening',
        content: "Now it's your turn! Play the first move of the Italian Game.",
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        correctMoves: ['e2e4'],
        hints: ["Control the center with your king's pawn."],
        points: 10,
      },
      {
        id: 'italian-4',
        type: 'practice',
        title: 'Develop the Knight',
        content: 'Black played e5. Develop your knight to attack the e5 pawn.',
        fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
        correctMoves: ['g1f3'],
        hints: ['The knight on f3 attacks the e5 pawn and prepares for castling.'],
        points: 10,
      },
      {
        id: 'italian-5',
        type: 'practice',
        title: 'The Italian Bishop',
        content: "Black defends with Nc6. Now place your bishop on the Italian square!",
        fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3',
        correctMoves: ['f1c4'],
        hints: ['The bishop on c4 targets the weak f7 square.'],
        points: 10,
      },
      {
        id: 'italian-6',
        type: 'quiz',
        title: 'Key Concept',
        content: 'Why is f7 considered a weak square for Black?',
        fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3',
        highlightSquares: ['f7'],
        points: 15,
      },
    ],
  },
  {
    id: 'opening-london-system',
    title: 'The London System',
    description: 'A solid and flexible opening system suitable for all levels.',
    category: 'opening',
    difficulty: 'beginner',
    estimatedMinutes: 12,
    tags: ['d4', 'solid', 'system'],
    steps: [
      {
        id: 'london-1',
        type: 'explanation',
        title: 'Introduction to the London',
        content:
          'The London System is a solid opening where White develops the dark-squared bishop to f4 before playing e3. It leads to a safe position with clear plans.',
        fen: 'rnbqkbnr/ppp1pppp/3p4/8/3P1B2/5N2/PPP1PPPP/RN1QKB1R w KQkq - 0 3',
        highlightSquares: ['f4', 'd4'],
      },
      {
        id: 'london-2',
        type: 'practice',
        title: 'First Move',
        content: 'Start the London System with the queen pawn.',
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        correctMoves: ['d2d4'],
        hints: ['Open with d4 to control the center.'],
        points: 10,
      },
      {
        id: 'london-3',
        type: 'practice',
        title: 'The London Bishop',
        content: 'Black plays d5. Develop your bishop to f4 - the signature London move!',
        fen: 'rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 2',
        correctMoves: ['c1f4'],
        hints: ['Bf4 develops the bishop outside the pawn chain.'],
        points: 10,
      },
      {
        id: 'london-4',
        type: 'practice',
        title: 'Knight Development',
        content: 'Black plays Nf6. Develop your knight to f3.',
        fen: 'rnbqkb1r/ppp1pppp/5n2/3p4/3P1B2/8/PPP1PPPP/RN1QKBNR w KQkq - 2 3',
        correctMoves: ['g1f3'],
        hints: ['Nf3 develops naturally and supports e5 later.'],
        points: 10,
      },
      {
        id: 'london-5',
        type: 'explanation',
        title: 'The London Pyramid',
        content:
          'After e3 and Bd3, White builds a solid pawn structure called the "London Pyramid". This setup is very hard to break down.',
        fen: 'r1bqkb1r/ppp1pppp/2n2n2/3p4/3P1B2/3BPN2/PPP2PPP/RN1QK2R w KQkq - 4 5',
        highlightSquares: ['d3', 'd4', 'e3', 'f4'],
        arrows: [
          { from: 'd3', to: 'h7', color: 'green' },
        ],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // TACTIC LESSONS
  // -------------------------------------------------------------------------
  {
    id: 'tactic-fork-knight',
    title: 'Knight Forks',
    description: 'Master the powerful knight fork - attacking two pieces at once.',
    category: 'tactic',
    difficulty: 'beginner',
    estimatedMinutes: 8,
    tags: ['fork', 'knight', 'double attack'],
    steps: [
      {
        id: 'fork-1',
        type: 'explanation',
        title: 'What is a Fork?',
        content:
          'A fork is when one piece attacks two or more enemy pieces at the same time. Knights are especially good at forks because they attack in an L-shape, which is hard to defend.',
        fen: '4k3/8/8/3N4/8/8/8/4K3 w - - 0 1',
        highlightSquares: ['d5', 'e7', 'c7', 'b6', 'b4', 'c3', 'e3', 'f4', 'f6'],
      },
      {
        id: 'fork-2',
        type: 'demonstration',
        title: 'Royal Fork',
        content:
          'The "royal fork" attacks both the king and queen. Watch how the knight on d5 can jump to fork!',
        fen: 'r1bqk2r/pppp1ppp/2n2n2/3Np3/2B5/8/PPPP1PPP/RNBQK2R w KQkq - 0 5',
        arrows: [{ from: 'd5', to: 'f6' }],
        highlightSquares: ['e8', 'd8'],
      },
      {
        id: 'fork-3',
        type: 'practice',
        title: 'Find the Fork!',
        content: 'White to move. Find the knight move that forks the king and queen!',
        fen: 'r1bqk2r/pppp1ppp/2n5/3Np3/2B5/8/PPPP1PPP/RNBQK2R w KQkq - 0 5',
        correctMoves: ['d5f6'],
        hints: ['The knight can attack both the king and queen from one square.'],
        points: 15,
      },
      {
        id: 'fork-4',
        type: 'practice',
        title: 'Family Fork',
        content: 'A "family fork" attacks king, queen, AND rook. Find it!',
        fen: 'r3k2r/ppp2ppp/8/3N4/8/8/PPP2PPP/R3K2R w KQkq - 0 1',
        correctMoves: ['d5c7'],
        hints: ['The knight on c7 attacks the king, queen AND the rook on a8!'],
        points: 20,
      },
      {
        id: 'fork-5',
        type: 'challenge',
        title: 'Fork Challenge',
        content: 'Find the winning fork in this position. Timed challenge!',
        fen: 'r1b1k2r/ppppqppp/2n5/4p3/2B1n3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 1',
        correctMoves: ['f3e5'],
        timeLimitSeconds: 30,
        points: 25,
      },
    ],
  },
  {
    id: 'tactic-pin',
    title: 'Pins and Skewers',
    description: 'Learn to use pins and skewers to win material.',
    category: 'tactic',
    difficulty: 'intermediate',
    estimatedMinutes: 10,
    tags: ['pin', 'skewer', 'bishop', 'rook'],
    steps: [
      {
        id: 'pin-1',
        type: 'explanation',
        title: 'What is a Pin?',
        content:
          'A pin is when a piece cannot move because it would expose a more valuable piece behind it. Bishops and rooks are great at creating pins.',
        fen: '4k3/8/8/8/8/b7/1N6/4K3 w - - 0 1',
        highlightSquares: ['a3', 'b2', 'e1'],
        arrows: [{ from: 'a3', to: 'e1', color: 'red' }],
      },
      {
        id: 'pin-2',
        type: 'practice',
        title: 'Create a Pin',
        content: 'Pin the knight to the king!',
        fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
        correctMoves: ['f1b5'],
        hints: ['The bishop on b5 pins the knight to the king.'],
        points: 15,
      },
      {
        id: 'pin-3',
        type: 'explanation',
        title: 'What is a Skewer?',
        content:
          'A skewer is the opposite of a pin - you attack a valuable piece, and when it moves, you capture something behind it.',
        fen: '4k3/8/8/8/8/8/4R3/4K3 w - - 0 1',
        arrows: [{ from: 'e2', to: 'e8', color: 'green' }],
      },
      {
        id: 'pin-4',
        type: 'practice',
        title: 'Skewer the Royals',
        content: 'Skewer the king and queen with a rook check!',
        fen: 'r3kb2/pppq1ppp/8/8/8/8/PPPQ1PPP/R3K2R w KQq - 0 1',
        correctMoves: ['a1a8'],
        hints: ['Check the king on the back rank, queen falls after Kf7.'],
        points: 20,
      },
    ],
  },

  // -------------------------------------------------------------------------
  // ENDGAME LESSONS
  // -------------------------------------------------------------------------
  {
    id: 'endgame-king-pawn',
    title: 'King and Pawn Endgames',
    description: 'Master the fundamental king and pawn endgame principles.',
    category: 'endgame',
    difficulty: 'beginner',
    estimatedMinutes: 15,
    tags: ['endgame', 'pawn', 'opposition'],
    steps: [
      {
        id: 'kp-1',
        type: 'explanation',
        title: 'The Opposition',
        content:
          'In king and pawn endgames, "opposition" is crucial. When kings face each other with one square between them, the player NOT to move has the opposition - a huge advantage!',
        fen: '4k3/8/4K3/8/8/8/4P3/8 w - - 0 1',
        highlightSquares: ['e6', 'e8'],
      },
      {
        id: 'kp-2',
        type: 'practice',
        title: 'Take the Opposition',
        content: 'Move your king to take the opposition!',
        fen: '4k3/8/8/4K3/8/8/4P3/8 w - - 0 1',
        correctMoves: ['e5e6'],
        hints: ['Move directly forward to face the black king.'],
        points: 10,
      },
      {
        id: 'kp-3',
        type: 'explanation',
        title: 'The Square of the Pawn',
        content:
          'To know if a king can catch a passed pawn, draw a diagonal from the pawn to its queening square. If the defending king can enter this "square", it can catch the pawn.',
        fen: '8/8/8/1k6/8/8/4P3/4K3 w - - 0 1',
        highlightSquares: ['e2', 'e8', 'h2', 'h8'],
      },
      {
        id: 'kp-4',
        type: 'practice',
        title: 'Escort the Pawn',
        content: 'Push the pawn and escort it to promotion!',
        fen: '8/8/3k4/8/8/4K3/4P3/8 w - - 0 1',
        correctMoves: ['e3e4'],
        acceptableMoves: ['e2e4'],
        hints: ['Advance the pawn while keeping your king active.'],
        points: 10,
      },
    ],
  },
  {
    id: 'endgame-rook',
    title: 'Basic Rook Endgames',
    description: 'Learn essential rook endgame techniques including the Lucena and Philidor.',
    category: 'endgame',
    difficulty: 'intermediate',
    estimatedMinutes: 20,
    tags: ['endgame', 'rook', 'lucena', 'philidor'],
    steps: [
      {
        id: 'rook-1',
        type: 'explanation',
        title: 'Rook Endgame Basics',
        content:
          'Rook endgames are the most common endgames. Key principles: activate your rook, cut off the enemy king, and know the Lucena and Philidor positions.',
        fen: '4k3/8/8/8/8/8/4P3/R3K3 w - - 0 1',
      },
      {
        id: 'rook-2',
        type: 'explanation',
        title: 'The Lucena Position',
        content:
          'The Lucena is a winning position. The defending king is cut off, and the attacking king shelters from checks by building a "bridge" with the rook.',
        fen: '1K1k4/1P6/8/8/8/8/5r2/4R3 w - - 0 1',
        highlightSquares: ['b7', 'd8'],
      },
      {
        id: 'rook-3',
        type: 'practice',
        title: 'Build the Bridge',
        content: 'Build the bridge! Move the rook to the fourth rank.',
        fen: '1K1k4/1P6/8/8/8/8/5r2/4R3 w - - 0 1',
        correctMoves: ['e1e4'],
        hints: ['The rook on the fourth rank shields the king from checks.'],
        points: 15,
      },
      {
        id: 'rook-4',
        type: 'explanation',
        title: 'The Philidor Position',
        content:
          'The Philidor is a drawing technique for the defender. Keep your rook on the third rank to prevent the enemy king from advancing, then switch to checking from behind.',
        fen: '4k3/8/8/4PK2/8/4r3/8/8 b - - 0 1',
        highlightSquares: ['e3'],
      },
    ],
  },

  // -------------------------------------------------------------------------
  // CHECKMATE LESSONS
  // -------------------------------------------------------------------------
  {
    id: 'checkmate-back-rank',
    title: 'Back Rank Checkmates',
    description: 'Master the devastating back rank checkmate pattern.',
    category: 'checkmate',
    difficulty: 'beginner',
    estimatedMinutes: 8,
    tags: ['checkmate', 'back rank', 'rook', 'queen'],
    steps: [
      {
        id: 'backrank-1',
        type: 'explanation',
        title: 'The Back Rank Weakness',
        content:
          'When pawns in front of a castled king block its escape, the back rank becomes vulnerable. A rook or queen can deliver checkmate!',
        fen: '6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1',
        highlightSquares: ['g8', 'f7', 'g7', 'h7'],
        arrows: [{ from: 'a1', to: 'a8', color: 'red' }],
      },
      {
        id: 'backrank-2',
        type: 'practice',
        title: 'Deliver Checkmate',
        content: 'Checkmate the king on the back rank!',
        fen: '6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1',
        correctMoves: ['a1a8'],
        hints: ['The rook on the a-file can reach the back rank.'],
        points: 10,
      },
      {
        id: 'backrank-3',
        type: 'practice',
        title: 'Set Up the Mate',
        content: 'The rook is blocked. Find a way to set up back rank mate!',
        fen: '3r2k1/5ppp/8/8/8/8/8/2R1K2R w - - 0 1',
        correctMoves: ['c1c8'],
        hints: ['Exchange rooks first to open the back rank.'],
        points: 15,
      },
      {
        id: 'backrank-4',
        type: 'explanation',
        title: 'Creating Luft',
        content:
          '"Luft" (German for air) means giving your king an escape square by pushing a pawn. This prevents back rank mates. h3 or g3 are common luft moves.',
        fen: '6k1/5ppp/8/8/8/7P/8/4K3 w - - 0 1',
        highlightSquares: ['h3', 'g2', 'h2'],
      },
    ],
  },
];

// =============================================================================
// TUTORING ENGINE CLASS
// =============================================================================

/**
 * TutoringEngine manages lesson sequencing and progress tracking.
 */
export class TutoringEngine {
  private stats: TutoringStats;
  private session: TutoringSession;
  private progressMap: Map<string, LessonProgress>;

  constructor() {
    this.stats = this.loadStats();
    this.session = createInitialSession();
    this.progressMap = this.loadProgressMap();
  }

  // ---------------------------------------------------------------------------
  // PERSISTENCE
  // ---------------------------------------------------------------------------

  private loadStats(): TutoringStats {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.STATS);
      if (stored) {
        return { ...DEFAULT_TUTORING_STATS, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn('Failed to load tutoring stats:', e);
    }
    return { ...DEFAULT_TUTORING_STATS };
  }

  private saveStats(): void {
    try {
      localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(this.stats));
    } catch (e) {
      console.warn('Failed to save tutoring stats:', e);
    }
  }

  private loadProgressMap(): Map<string, LessonProgress> {
    const map = new Map<string, LessonProgress>();
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.PROGRESS);
      if (stored) {
        const arr: LessonProgress[] = JSON.parse(stored);
        arr.forEach((p) => map.set(p.lessonId, p));
      }
    } catch (e) {
      console.warn('Failed to load lesson progress:', e);
    }
    return map;
  }

  private saveProgressMap(): void {
    try {
      const arr = Array.from(this.progressMap.values());
      localStorage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify(arr));
    } catch (e) {
      console.warn('Failed to save lesson progress:', e);
    }
  }

  // ---------------------------------------------------------------------------
  // LESSON ACCESS
  // ---------------------------------------------------------------------------

  /**
   * Get all available lessons.
   */
  getLessons(): LessonPlan[] {
    return LESSON_LIBRARY;
  }

  /**
   * Get lessons by category.
   */
  getLessonsByCategory(category: LessonCategory): LessonPlan[] {
    return LESSON_LIBRARY.filter((l) => l.category === category);
  }

  /**
   * Get lessons by difficulty.
   */
  getLessonsByDifficulty(difficulty: LessonDifficulty): LessonPlan[] {
    return LESSON_LIBRARY.filter((l) => l.difficulty === difficulty);
  }

  /**
   * Get a specific lesson by ID.
   */
  getLesson(lessonId: string): LessonPlan | null {
    return LESSON_LIBRARY.find((l) => l.id === lessonId) ?? null;
  }

  /**
   * Get progress for a lesson.
   */
  getLessonProgress(lessonId: string): LessonProgress | null {
    return this.progressMap.get(lessonId) ?? null;
  }

  // ---------------------------------------------------------------------------
  // SESSION MANAGEMENT
  // ---------------------------------------------------------------------------

  /**
   * Get current session state.
   */
  getSession(): TutoringSession {
    return { ...this.session };
  }

  /**
   * Start a lesson.
   */
  startLesson(lessonId: string): TutoringSession {
    const lesson = this.getLesson(lessonId);
    if (!lesson) {
      this.session.error = `Lesson not found: ${lessonId}`;
      return this.getSession();
    }

    // Check for existing progress
    let progress = this.progressMap.get(lessonId);
    if (!progress || progress.status === 'completed' || progress.status === 'abandoned') {
      progress = createLessonProgress(lesson);
    }

    progress.status = 'in_progress';
    progress.stepProgress[0].status = 'in_progress';

    this.progressMap.set(lessonId, progress);
    this.saveProgressMap();

    this.session = {
      currentLesson: lesson,
      progress,
      ringState: TUTORING_RING_STATES.teaching,
      isPaused: false,
      isLoading: false,
      error: null,
    };

    return this.getSession();
  }

  /**
   * End the current lesson.
   */
  endLesson(abandon: boolean = false): TutoringSession {
    if (!this.session.progress) {
      return this.getSession();
    }

    const progress = this.session.progress;
    progress.status = abandon ? 'abandoned' : 'completed';

    if (!abandon) {
      progress.completedAt = Date.now();
      progress.successRate = calculateSuccessRate(progress.stepProgress);
      this.updateStats(progress);
    }

    this.progressMap.set(progress.lessonId, progress);
    this.saveProgressMap();

    this.session = createInitialSession();
    return this.getSession();
  }

  /**
   * Pause/resume the current lesson.
   */
  togglePause(): TutoringSession {
    this.session.isPaused = !this.session.isPaused;
    this.session.ringState = this.session.isPaused
      ? TUTORING_RING_STATES.waiting
      : TUTORING_RING_STATES.teaching;
    return this.getSession();
  }

  // ---------------------------------------------------------------------------
  // STEP PROGRESSION
  // ---------------------------------------------------------------------------

  /**
   * Get the current step.
   */
  getCurrentStep() {
    if (!this.session.currentLesson || !this.session.progress) {
      return null;
    }
    const idx = this.session.progress.currentStepIndex;
    return this.session.currentLesson.steps[idx] ?? null;
  }

  /**
   * Get the current step progress.
   */
  getCurrentStepProgress(): StepProgress | null {
    if (!this.session.progress) return null;
    const idx = this.session.progress.currentStepIndex;
    return this.session.progress.stepProgress[idx] ?? null;
  }

  /**
   * Mark current step as complete and advance.
   * @returns The ring state to trigger (e.g., 'exploding' for success)
   */
  completeStep(points: number = 0): RingState {
    if (!this.session.progress || !this.session.currentLesson) {
      return 'dormant';
    }

    const progress = this.session.progress;
    const currentIdx = progress.currentStepIndex;
    const stepProgress = progress.stepProgress[currentIdx];

    stepProgress.status = 'completed';
    stepProgress.completedAt = Date.now();
    stepProgress.pointsEarned = points;
    progress.totalPoints += points;

    // Advance to next step
    const nextIdx = currentIdx + 1;
    if (nextIdx < this.session.currentLesson.steps.length) {
      progress.currentStepIndex = nextIdx;
      progress.stepProgress[nextIdx].status = 'in_progress';
      this.session.ringState = TUTORING_RING_STATES.success;
    } else {
      // Lesson complete!
      progress.status = 'completed';
      progress.completedAt = Date.now();
      progress.successRate = calculateSuccessRate(progress.stepProgress);
      this.updateStats(progress);
      this.session.ringState = TUTORING_RING_STATES.success;
    }

    this.progressMap.set(progress.lessonId, progress);
    this.saveProgressMap();

    return this.session.ringState;
  }

  /**
   * Record an attempt on a practice step.
   */
  recordAttempt(correct: boolean): void {
    const stepProgress = this.getCurrentStepProgress();
    if (!stepProgress) return;

    stepProgress.attempts += 1;

    if (correct) {
      const step = this.getCurrentStep();
      const points = step?.points ?? 10;
      this.completeStep(points);
    }
  }

  /**
   * Use a hint on the current step.
   */
  useHint(): string | null {
    if (!this.session.currentLesson || !this.session.progress) {
      return null;
    }

    const stepProgress = this.getCurrentStepProgress();
    const step = this.getCurrentStep();
    if (!stepProgress || !step?.hints) return null;

    const hintIdx = stepProgress.hintsUsed;
    if (hintIdx >= step.hints.length) {
      return step.hints[step.hints.length - 1];
    }

    stepProgress.hintsUsed += 1;
    return step.hints[hintIdx];
  }

  /**
   * Skip the current step.
   */
  skipStep(): void {
    const stepProgress = this.getCurrentStepProgress();
    if (!stepProgress) return;

    stepProgress.status = 'skipped';
    this.completeStep(0);
  }

  // ---------------------------------------------------------------------------
  // STATISTICS
  // ---------------------------------------------------------------------------

  /**
   * Get tutoring statistics.
   */
  getStats(): TutoringStats {
    return { ...this.stats };
  }

  /**
   * Update stats after completing a lesson.
   */
  private updateStats(progress: LessonProgress): void {
    const lesson = this.getLesson(progress.lessonId);
    if (!lesson) return;

    this.stats.lessonsCompleted += 1;
    this.stats.stepsCompleted += progress.stepProgress.filter(
      (sp) => sp.status === 'completed'
    ).length;
    this.stats.totalPoints += progress.totalPoints;
    this.stats.totalTimeSpentMs += progress.stepProgress.reduce(
      (sum, sp) => sum + sp.timeSpentMs,
      0
    );
    this.stats.byCategory[lesson.category] += 1;

    // Update success rate (rolling average)
    const prevRate = this.stats.overallSuccessRate;
    const n = this.stats.lessonsCompleted;
    this.stats.overallSuccessRate = (prevRate * (n - 1) + progress.successRate) / n;

    // Update streak
    const today = new Date().toISOString().split('T')[0];
    const lastDate = this.stats.lastLessonDate;

    if (lastDate === today) {
      // Same day, no streak change
    } else if (lastDate) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      if (lastDate === yesterday) {
        this.stats.currentStreak += 1;
      } else {
        this.stats.currentStreak = 1;
      }
    } else {
      this.stats.currentStreak = 1;
    }

    if (this.stats.currentStreak > this.stats.bestStreak) {
      this.stats.bestStreak = this.stats.currentStreak;
    }

    this.stats.lastLessonDate = today;
    this.saveStats();
  }

  /**
   * Reset all statistics (for testing/debugging).
   */
  resetStats(): void {
    this.stats = { ...DEFAULT_TUTORING_STATS };
    this.progressMap.clear();
    this.session = createInitialSession();
    localStorage.removeItem(STORAGE_KEYS.STATS);
    localStorage.removeItem(STORAGE_KEYS.PROGRESS);
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let instance: TutoringEngine | null = null;

/**
 * Get the TutoringEngine singleton instance.
 */
export function getTutoringEngine(): TutoringEngine {
  if (!instance) {
    instance = new TutoringEngine();
  }
  return instance;
}

/**
 * Reset the TutoringEngine singleton (for testing).
 */
export function resetTutoringEngine(): void {
  instance = null;
}
