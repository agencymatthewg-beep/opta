/**
 * Chess puzzle types for Opta.
 *
 * Supports Lichess puzzle integration with:
 * - Daily puzzle fetching
 * - Puzzle caching and state
 * - Streak tracking
 * - Rating adaptation
 * - Progressive hints
 */

/**
 * Puzzle difficulty based on rating.
 */
export type PuzzleDifficulty = 'easy' | 'medium' | 'hard' | 'expert';

/**
 * Puzzle theme from Lichess taxonomy.
 */
export type PuzzleTheme =
  | 'mateIn1'
  | 'mateIn2'
  | 'mateIn3'
  | 'fork'
  | 'pin'
  | 'skewer'
  | 'discoveredAttack'
  | 'doubleCheck'
  | 'sacrifice'
  | 'deflection'
  | 'clearance'
  | 'interference'
  | 'zugzwang'
  | 'promotion'
  | 'underPromotion'
  | 'castling'
  | 'enPassant'
  | 'capturingDefender'
  | 'trappedPiece'
  | 'backRankMate'
  | 'smotheredMate'
  | 'anastasiasMate'
  | 'arabianMate'
  | 'bodensMate'
  | 'dovetailMate'
  | 'hookMate'
  | 'other';

/**
 * A chess puzzle from Lichess.
 */
export interface Puzzle {
  /** Unique puzzle ID from Lichess */
  id: string;
  /** Initial position in FEN */
  fen: string;
  /** Solution moves in UCI notation (e.g., ['e2e4', 'd7d5', 'e4d5']) */
  moves: string[];
  /** Puzzle rating (difficulty) */
  rating: number;
  /** Rating deviation (confidence) */
  ratingDeviation: number;
  /** How many times the puzzle has been played */
  plays: number;
  /** Tactical themes present in the puzzle */
  themes: PuzzleTheme[];
  /** URL to view the puzzle on Lichess */
  url: string;
  /** Source game ID (if from a real game) */
  gameId?: string;
}

/**
 * State of a puzzle attempt.
 */
export type PuzzleAttemptStatus =
  | 'not_started'
  | 'in_progress'
  | 'correct'
  | 'incorrect';

/**
 * A single puzzle attempt.
 */
export interface PuzzleAttempt {
  /** Puzzle being attempted */
  puzzle: Puzzle;
  /** Current move index (0 = first player move) */
  currentMoveIndex: number;
  /** Status of the attempt */
  status: PuzzleAttemptStatus;
  /** Hints revealed (0 = none) */
  hintsUsed: number;
  /** Time spent in milliseconds */
  timeSpentMs: number;
  /** Timestamp when started */
  startedAt: number;
  /** Moves made by the player (UCI notation) */
  playerMoves: string[];
}

/**
 * Puzzle statistics for a user.
 */
export interface PuzzleStats {
  /** Total puzzles attempted */
  totalAttempted: number;
  /** Total puzzles solved correctly */
  totalSolved: number;
  /** Current streak (consecutive correct) */
  currentStreak: number;
  /** Best streak ever achieved */
  bestStreak: number;
  /** Estimated puzzle rating */
  rating: number;
  /** Last puzzle attempt date (ISO string) */
  lastAttemptDate: string | null;
  /** Daily puzzles completed today */
  dailyPuzzlesCompleted: number;
  /** Date of daily count (ISO date string, e.g., '2024-01-15') */
  dailyCountDate: string | null;
}

/**
 * Cached puzzle data.
 */
export interface PuzzleCache {
  /** Daily puzzle (refreshed daily) */
  dailyPuzzle: Puzzle | null;
  /** Date when daily puzzle was fetched (ISO date string) */
  dailyPuzzleDate: string | null;
  /** Queue of pre-fetched puzzles for continuous play */
  puzzleQueue: Puzzle[];
  /** Last fetch timestamp */
  lastFetch: number;
}

/**
 * Full puzzle state for the hook.
 */
export interface PuzzleState {
  /** Current puzzle attempt (if active) */
  currentAttempt: PuzzleAttempt | null;
  /** User's puzzle statistics */
  stats: PuzzleStats;
  /** Cached puzzles */
  cache: PuzzleCache;
  /** Loading state */
  isLoading: boolean;
  /** Error message (if any) */
  error: string | null;
}

/**
 * Hint information for progressive reveal.
 */
export interface PuzzleHint {
  /** Hint level (1-3) */
  level: number;
  /** Hint text */
  text: string;
  /** Square to highlight (if applicable) */
  highlightSquare?: string;
}

/**
 * Map puzzle rating to difficulty level.
 */
export function ratingToDifficulty(rating: number): PuzzleDifficulty {
  if (rating < 1200) return 'easy';
  if (rating < 1600) return 'medium';
  if (rating < 2000) return 'hard';
  return 'expert';
}

/**
 * Get difficulty color for display.
 */
export function getDifficultyColor(difficulty: PuzzleDifficulty): string {
  switch (difficulty) {
    case 'easy':
      return 'text-success';
    case 'medium':
      return 'text-primary';
    case 'hard':
      return 'text-warning';
    case 'expert':
      return 'text-danger';
  }
}

/**
 * Format theme name for display.
 */
export function formatTheme(theme: PuzzleTheme): string {
  // Convert camelCase to Title Case with spaces
  return theme
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .replace(/In (\d)/, 'in $1'); // "Mate In 2" -> "Mate in 2"
}

/**
 * Default puzzle statistics.
 */
export const DEFAULT_PUZZLE_STATS: PuzzleStats = {
  totalAttempted: 0,
  totalSolved: 0,
  currentStreak: 0,
  bestStreak: 0,
  rating: 1200, // Starting rating
  lastAttemptDate: null,
  dailyPuzzlesCompleted: 0,
  dailyCountDate: null,
};

/**
 * Default puzzle cache.
 */
export const DEFAULT_PUZZLE_CACHE: PuzzleCache = {
  dailyPuzzle: null,
  dailyPuzzleDate: null,
  puzzleQueue: [],
  lastFetch: 0,
};

/**
 * Create initial puzzle state.
 */
export function createInitialPuzzleState(): PuzzleState {
  return {
    currentAttempt: null,
    stats: DEFAULT_PUZZLE_STATS,
    cache: DEFAULT_PUZZLE_CACHE,
    isLoading: false,
    error: null,
  };
}
