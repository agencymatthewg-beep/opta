/**
 * React hook for chess puzzle state management.
 *
 * Features:
 * - Lichess puzzle fetching and caching
 * - Puzzle attempt state management
 * - Streak tracking with localStorage persistence
 * - Rating adaptation based on solve success
 * - Progressive hint system
 *
 * Uses chess.js for move validation.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { Chess } from 'chess.js';
import type {
  Puzzle,
  PuzzleAttempt,
  PuzzleState,
  PuzzleStats,
  PuzzleCache,
  PuzzleHint,
} from '../types/puzzle';
import {
  DEFAULT_PUZZLE_STATS,
  DEFAULT_PUZZLE_CACHE,
  createInitialPuzzleState,
} from '../types/puzzle';
import {
  fetchDailyPuzzle,
  fetchPuzzleById,
  generateHints,
  calculateRatingChange,
} from '../lib/lichess';

// LocalStorage keys
const PUZZLE_STATS_KEY = 'opta_puzzle_stats';
const PUZZLE_CACHE_KEY = 'opta_puzzle_cache';

/**
 * Load stats from localStorage.
 */
function loadStats(): PuzzleStats {
  try {
    const saved = localStorage.getItem(PUZZLE_STATS_KEY);
    if (saved) {
      return { ...DEFAULT_PUZZLE_STATS, ...JSON.parse(saved) };
    }
  } catch {
    // Ignore parse errors
  }
  return DEFAULT_PUZZLE_STATS;
}

/**
 * Save stats to localStorage.
 */
function saveStats(stats: PuzzleStats): void {
  localStorage.setItem(PUZZLE_STATS_KEY, JSON.stringify(stats));
}

/**
 * Load cache from localStorage.
 */
function loadCache(): PuzzleCache {
  try {
    const saved = localStorage.getItem(PUZZLE_CACHE_KEY);
    if (saved) {
      return { ...DEFAULT_PUZZLE_CACHE, ...JSON.parse(saved) };
    }
  } catch {
    // Ignore parse errors
  }
  return DEFAULT_PUZZLE_CACHE;
}

/**
 * Save cache to localStorage.
 */
function saveCache(cache: PuzzleCache): void {
  localStorage.setItem(PUZZLE_CACHE_KEY, JSON.stringify(cache));
}

/**
 * Get today's date as ISO date string (YYYY-MM-DD).
 */
function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Options for usePuzzle hook.
 */
export interface UsePuzzleOptions {
  /** Auto-fetch daily puzzle on mount (default: true) */
  autoFetchDaily?: boolean;
  /** Callback when puzzle is solved */
  onSolved?: (puzzle: Puzzle, hintsUsed: number) => void;
  /** Callback when puzzle attempt fails */
  onFailed?: (puzzle: Puzzle) => void;
}

/**
 * Return type for usePuzzle hook.
 */
export interface UsePuzzleReturn {
  // State
  /** Current puzzle attempt (if active) */
  currentAttempt: PuzzleAttempt | null;
  /** Current FEN position (for rendering the board) */
  currentFen: string;
  /** User's puzzle statistics */
  stats: PuzzleStats;
  /** Whether a puzzle is loading */
  isLoading: boolean;
  /** Error message (if any) */
  error: string | null;
  /** Whether there's a daily puzzle available */
  hasDailyPuzzle: boolean;
  /** Whether the daily puzzle has been completed today */
  dailyPuzzleCompleted: boolean;

  // Actions
  /** Start the daily puzzle */
  startDailyPuzzle: () => Promise<boolean>;
  /** Start a specific puzzle by ID */
  startPuzzle: (puzzleId: string) => Promise<boolean>;
  /** Make a move in the current puzzle (returns true if correct) */
  makeMove: (from: string, to: string, promotion?: string) => boolean;
  /** Get a hint for the current position */
  getHint: () => PuzzleHint | null;
  /** Skip the current puzzle (counts as failed) */
  skipPuzzle: () => void;
  /** Reset the current puzzle attempt */
  resetPuzzle: () => void;

  // Utilities
  /** Get legal moves for a square in the current position */
  getLegalMoves: (square: string) => string[];
  /** Check whose turn it is in the puzzle ('w' or 'b') */
  getPuzzleTurn: () => 'w' | 'b';
}

/**
 * Hook for managing chess puzzles.
 *
 * @param options - Configuration options
 * @returns Puzzle state and control functions
 *
 * @example
 * ```tsx
 * const {
 *   currentAttempt,
 *   currentFen,
 *   stats,
 *   startDailyPuzzle,
 *   makeMove,
 *   getHint,
 * } = usePuzzle({
 *   onSolved: (puzzle) => console.log('Solved!', puzzle.id),
 * });
 *
 * // Start the daily puzzle
 * await startDailyPuzzle();
 *
 * // Make a move
 * const isCorrect = makeMove('e2', 'e4');
 * ```
 */
export function usePuzzle(options: UsePuzzleOptions = {}): UsePuzzleReturn {
  const { autoFetchDaily = true, onSolved, onFailed } = options;

  // State
  const [state, setState] = useState<PuzzleState>(() => ({
    ...createInitialPuzzleState(),
    stats: loadStats(),
    cache: loadCache(),
  }));

  // Chess.js instance for move validation
  const gameRef = useRef<Chess | null>(null);

  // Track if daily puzzle was fetched this session
  const dailyFetchedRef = useRef(false);

  /**
   * Update stats and persist to localStorage.
   */
  const updateStats = useCallback((updates: Partial<PuzzleStats>) => {
    setState((prev) => {
      const newStats = { ...prev.stats, ...updates };
      saveStats(newStats);
      return { ...prev, stats: newStats };
    });
  }, []);

  /**
   * Update cache and persist to localStorage.
   */
  const updateCache = useCallback((updates: Partial<PuzzleCache>) => {
    setState((prev) => {
      const newCache = { ...prev.cache, ...updates };
      saveCache(newCache);
      return { ...prev, cache: newCache };
    });
  }, []);

  /**
   * Fetch and cache the daily puzzle.
   */
  const fetchDaily = useCallback(async (): Promise<Puzzle | null> => {
    const today = getTodayDateString();

    // Check if we already have today's puzzle cached
    if (state.cache.dailyPuzzle && state.cache.dailyPuzzleDate === today) {
      return state.cache.dailyPuzzle;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const puzzle = await fetchDailyPuzzle();

      if (puzzle) {
        updateCache({
          dailyPuzzle: puzzle,
          dailyPuzzleDate: today,
          lastFetch: Date.now(),
        });
        setState((prev) => ({ ...prev, isLoading: false }));
        return puzzle;
      } else {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: 'Failed to fetch daily puzzle',
        }));
        return null;
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
      return null;
    }
  }, [state.cache.dailyPuzzle, state.cache.dailyPuzzleDate, updateCache]);

  /**
   * Start a puzzle attempt.
   */
  const startPuzzleAttempt = useCallback((puzzle: Puzzle): boolean => {
    if (!puzzle.fen || !puzzle.moves.length) {
      setState((prev) => ({
        ...prev,
        error: 'Invalid puzzle: missing FEN or moves',
      }));
      return false;
    }

    // Initialize chess.js with the puzzle position
    try {
      const game = new Chess(puzzle.fen);
      gameRef.current = game;

      // In puzzles, the first move is the opponent's last move (the setup).
      // The player needs to find the response.
      // However, Lichess puzzles start AFTER the opponent's move.
      // So currentMoveIndex 0 is the player's first move.

      const attempt: PuzzleAttempt = {
        puzzle,
        currentMoveIndex: 0,
        status: 'in_progress',
        hintsUsed: 0,
        timeSpentMs: 0,
        startedAt: Date.now(),
        playerMoves: [],
      };

      setState((prev) => ({
        ...prev,
        currentAttempt: attempt,
        error: null,
      }));

      return true;
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: 'Failed to load puzzle position',
      }));
      return false;
    }
  }, []);

  /**
   * Start the daily puzzle.
   */
  const startDailyPuzzle = useCallback(async (): Promise<boolean> => {
    const puzzle = await fetchDaily();
    if (puzzle) {
      return startPuzzleAttempt(puzzle);
    }
    return false;
  }, [fetchDaily, startPuzzleAttempt]);

  /**
   * Start a specific puzzle by ID.
   */
  const startPuzzle = useCallback(
    async (puzzleId: string): Promise<boolean> => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const puzzle = await fetchPuzzleById(puzzleId);

        if (puzzle) {
          setState((prev) => ({ ...prev, isLoading: false }));
          return startPuzzleAttempt(puzzle);
        } else {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            error: 'Puzzle not found',
          }));
          return false;
        }
      } catch (error) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }));
        return false;
      }
    },
    [startPuzzleAttempt]
  );

  /**
   * Complete the puzzle (success or failure).
   */
  const completePuzzle = useCallback(
    (solved: boolean, hintsUsed: number) => {
      const attempt = state.currentAttempt;
      if (!attempt) return;

      const puzzle = attempt.puzzle;
      const today = getTodayDateString();

      // Calculate rating change
      const { newRating, change: _ratingChange } = calculateRatingChange(
        state.stats.rating,
        puzzle.rating,
        solved,
        hintsUsed
      );

      // Update streak
      const newStreak = solved ? state.stats.currentStreak + 1 : 0;
      const bestStreak = Math.max(state.stats.bestStreak, newStreak);

      // Update daily count
      const dailyCount =
        state.stats.dailyCountDate === today
          ? state.stats.dailyPuzzlesCompleted + 1
          : 1;

      updateStats({
        totalAttempted: state.stats.totalAttempted + 1,
        totalSolved: state.stats.totalSolved + (solved ? 1 : 0),
        currentStreak: newStreak,
        bestStreak,
        rating: newRating,
        lastAttemptDate: new Date().toISOString(),
        dailyPuzzlesCompleted: dailyCount,
        dailyCountDate: today,
      });

      // Update attempt status
      setState((prev) => ({
        ...prev,
        currentAttempt: prev.currentAttempt
          ? {
              ...prev.currentAttempt,
              status: solved ? 'correct' : 'incorrect',
              timeSpentMs: Date.now() - attempt.startedAt,
            }
          : null,
      }));

      // Callbacks
      if (solved) {
        onSolved?.(puzzle, hintsUsed);
      } else {
        onFailed?.(puzzle);
      }
    },
    [state.currentAttempt, state.stats, updateStats, onSolved, onFailed]
  );

  /**
   * Make a move in the current puzzle.
   */
  const makeMove = useCallback(
    (from: string, to: string, promotion?: string): boolean => {
      const attempt = state.currentAttempt;
      const game = gameRef.current;

      if (!attempt || !game || attempt.status !== 'in_progress') {
        return false;
      }

      const expectedMove = attempt.puzzle.moves[attempt.currentMoveIndex];
      if (!expectedMove) {
        return false;
      }

      // Construct the UCI move string
      const uciMove = `${from}${to}${promotion || ''}`;

      // Check if the move matches the expected solution
      const isCorrect =
        uciMove === expectedMove ||
        uciMove === expectedMove.slice(0, 4); // Without promotion comparison

      if (isCorrect) {
        // Play the move on the board
        try {
          game.move({
            from,
            to,
            promotion: promotion || 'q',
          });
        } catch {
          return false;
        }

        const newMoveIndex = attempt.currentMoveIndex + 1;
        const newPlayerMoves = [...attempt.playerMoves, uciMove];

        // Check if puzzle is complete
        if (newMoveIndex >= attempt.puzzle.moves.length) {
          // Puzzle solved!
          setState((prev) => ({
            ...prev,
            currentAttempt: prev.currentAttempt
              ? {
                  ...prev.currentAttempt,
                  currentMoveIndex: newMoveIndex,
                  playerMoves: newPlayerMoves,
                }
              : null,
          }));
          completePuzzle(true, attempt.hintsUsed);
          return true;
        }

        // Play the opponent's response (next move in solution)
        const opponentMove = attempt.puzzle.moves[newMoveIndex];
        if (opponentMove) {
          try {
            game.move({
              from: opponentMove.slice(0, 2),
              to: opponentMove.slice(2, 4),
              promotion: opponentMove[4] || undefined,
            });
          } catch {
            // Opponent move failed - puzzle data issue
          }
        }

        // Update attempt state
        setState((prev) => ({
          ...prev,
          currentAttempt: prev.currentAttempt
            ? {
                ...prev.currentAttempt,
                currentMoveIndex: newMoveIndex + 1, // Skip opponent move
                playerMoves: newPlayerMoves,
              }
            : null,
        }));

        return true;
      } else {
        // Wrong move
        completePuzzle(false, attempt.hintsUsed);
        return false;
      }
    },
    [state.currentAttempt, completePuzzle]
  );

  /**
   * Get a hint for the current position.
   */
  const getHint = useCallback((): PuzzleHint | null => {
    const attempt = state.currentAttempt;
    if (!attempt || attempt.status !== 'in_progress') {
      return null;
    }

    const hints = generateHints(attempt.puzzle, attempt.currentMoveIndex);
    const nextHintLevel = attempt.hintsUsed + 1;

    if (nextHintLevel > hints.length) {
      return null; // No more hints
    }

    // Update hints used
    setState((prev) => ({
      ...prev,
      currentAttempt: prev.currentAttempt
        ? {
            ...prev.currentAttempt,
            hintsUsed: nextHintLevel,
          }
        : null,
    }));

    return hints[nextHintLevel - 1] || null;
  }, [state.currentAttempt]);

  /**
   * Skip the current puzzle.
   */
  const skipPuzzle = useCallback(() => {
    if (state.currentAttempt?.status === 'in_progress') {
      completePuzzle(false, state.currentAttempt.hintsUsed);
    }
  }, [state.currentAttempt, completePuzzle]);

  /**
   * Reset the current puzzle attempt.
   */
  const resetPuzzle = useCallback(() => {
    const attempt = state.currentAttempt;
    if (!attempt) return;

    // Re-initialize the position
    startPuzzleAttempt(attempt.puzzle);
  }, [state.currentAttempt, startPuzzleAttempt]);

  /**
   * Get legal moves for a square.
   */
  const getLegalMoves = useCallback((square: string): string[] => {
    const game = gameRef.current;
    if (!game) return [];

    try {
      const moves = game.moves({ square: square as any, verbose: true });
      return moves.map((m) => m.to);
    } catch {
      return [];
    }
  }, []);

  /**
   * Get whose turn it is.
   */
  const getPuzzleTurn = useCallback((): 'w' | 'b' => {
    const game = gameRef.current;
    return game?.turn() || 'w';
  }, []);

  // Auto-fetch daily puzzle on mount
  useEffect(() => {
    if (autoFetchDaily && !dailyFetchedRef.current) {
      dailyFetchedRef.current = true;
      fetchDaily();
    }
  }, [autoFetchDaily, fetchDaily]);

  // Computed values
  const currentFen = gameRef.current?.fen() || state.currentAttempt?.puzzle.fen || '';
  const today = getTodayDateString();
  const hasDailyPuzzle = Boolean(
    state.cache.dailyPuzzle && state.cache.dailyPuzzleDate === today
  );
  const dailyPuzzleCompleted = state.stats.dailyCountDate === today && state.stats.dailyPuzzlesCompleted > 0;

  return {
    // State
    currentAttempt: state.currentAttempt,
    currentFen,
    stats: state.stats,
    isLoading: state.isLoading,
    error: state.error,
    hasDailyPuzzle,
    dailyPuzzleCompleted,

    // Actions
    startDailyPuzzle,
    startPuzzle,
    makeMove,
    getHint,
    skipPuzzle,
    resetPuzzle,

    // Utilities
    getLegalMoves,
    getPuzzleTurn,
  };
}

export default usePuzzle;
