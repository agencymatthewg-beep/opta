/**
 * PuzzleBoard - Chess puzzle training component.
 *
 * Features:
 * - Mini board optimized for widget display
 * - Move validation with visual feedback
 * - Progressive hint system
 * - Streak and rating display
 * - Solution reveal on failure
 *
 * @see DESIGN_SYSTEM.md - Glass system, Framer Motion, Lucide icons
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { Chessboard } from 'react-chessboard';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lightbulb,
  RotateCcw,
  SkipForward,
  Flame,
  Trophy,
  CheckCircle2,
  XCircle,
  Play,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePuzzle } from '@/hooks/usePuzzle';
import { useRingLesson } from '@/contexts/RingLessonContext';
import {
  ratingToDifficulty,
  getDifficultyColor,
  formatTheme,
} from '@/types/puzzle';

// Easing curve for smooth animations
const smoothOut: [number, number, number, number] = [0.22, 1, 0.36, 1];

export interface PuzzleBoardProps {
  /** Callback when navigate to full puzzle page */
  onOpenFullPuzzles?: () => void;
}

/**
 * PuzzleBoard component for the chess widget.
 */
export function PuzzleBoard({ onOpenFullPuzzles: _onOpenFullPuzzles }: PuzzleBoardProps) {
  const {
    currentAttempt,
    currentFen,
    stats,
    isLoading,
    error,
    hasDailyPuzzle: _hasDailyPuzzle,
    dailyPuzzleCompleted,
    startDailyPuzzle,
    makeMove,
    getHint,
    skipPuzzle,
    resetPuzzle,
    getLegalMoves,
    getPuzzleTurn,
  } = usePuzzle();

  // Ring lesson integration for tutoring celebration
  const { triggerCelebration, setRingActive, setRingTeaching, resetRing } = useRingLesson();

  // Local state for hint display
  const [currentHint, setCurrentHint] = useState<string | null>(null);
  const [hintSquare, setHintSquare] = useState<string | null>(null);

  // Track selected square for legal moves
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalMoves, setLegalMoves] = useState<string[]>([]);

  // Last move feedback
  const [lastMoveResult, setLastMoveResult] = useState<'correct' | 'incorrect' | null>(null);

  // Sync ring state with puzzle state
  useEffect(() => {
    if (!currentAttempt) {
      // No active puzzle - ring dormant
      resetRing();
    } else if (currentAttempt.status === 'correct' || currentAttempt.status === 'incorrect') {
      // Puzzle complete - ring celebration already triggered, will auto-reset
    }
  }, [currentAttempt, resetRing]);

  /**
   * Handle requesting a hint.
   * Sets ring to teaching mode while hint is displayed.
   */
  const handleHint = useCallback(() => {
    const hint = getHint();
    if (hint) {
      setCurrentHint(hint.text);
      setHintSquare(hint.highlightSquare || null);
      setRingTeaching(); // Activate teaching mode on ring

      // Clear hint after 5 seconds and return ring to active
      setTimeout(() => {
        setCurrentHint(null);
        setHintSquare(null);
        setRingActive();
      }, 5000);
    }
  }, [getHint, setRingTeaching, setRingActive]);

  /**
   * Handle starting a puzzle.
   * Activates the ring when puzzle begins.
   */
  const handleStartPuzzle = useCallback(async () => {
    setCurrentHint(null);
    setHintSquare(null);
    setLastMoveResult(null);
    setRingActive(); // Ring awakens for puzzle
    await startDailyPuzzle();
  }, [startDailyPuzzle, setRingActive]);

  /**
   * Handle square click.
   * Triggers ring celebration on correct move completion.
   */
  const handleSquareClick = useCallback(
    ({ square }: { piece: { pieceType: string } | null; square: string }) => {
      if (!currentAttempt || currentAttempt.status !== 'in_progress') return;

      // If clicking a legal move destination, make the move
      if (selectedSquare && legalMoves.includes(square)) {
        const success = makeMove(selectedSquare, square);
        setLastMoveResult(success ? 'correct' : 'incorrect');
        setSelectedSquare(null);
        setLegalMoves([]);

        // Trigger ring celebration on correct move
        if (success) {
          triggerCelebration();
        }

        // Clear feedback after animation
        setTimeout(() => setLastMoveResult(null), 1500);
        return;
      }

      // Select new square
      const moves = getLegalMoves(square);
      if (moves.length > 0) {
        setSelectedSquare(square);
        setLegalMoves(moves);
      } else {
        setSelectedSquare(null);
        setLegalMoves([]);
      }
    },
    [currentAttempt, selectedSquare, legalMoves, makeMove, getLegalMoves, triggerCelebration]
  );

  /**
   * Handle piece drop.
   * Triggers ring celebration on correct move completion.
   */
  const handlePieceDrop = useCallback(
    ({
      sourceSquare,
      targetSquare,
    }: {
      piece: { isSparePiece: boolean; position: string; pieceType: string };
      sourceSquare: string;
      targetSquare: string | null;
    }): boolean => {
      if (!currentAttempt || currentAttempt.status !== 'in_progress' || !targetSquare) {
        return false;
      }

      const success = makeMove(sourceSquare, targetSquare);
      setLastMoveResult(success ? 'correct' : 'incorrect');
      setSelectedSquare(null);
      setLegalMoves([]);

      // Trigger ring celebration on correct move
      if (success) {
        triggerCelebration();
      }

      // Clear feedback after animation
      setTimeout(() => setLastMoveResult(null), 1500);
      return success;
    },
    [currentAttempt, makeMove, triggerCelebration]
  );

  /**
   * Build square styles for highlights.
   */
  const squareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};

    // Highlight selected square
    if (selectedSquare) {
      styles[selectedSquare] = {
        backgroundColor: 'rgba(168, 85, 247, 0.4)',
        boxShadow: 'inset 0 0 8px rgba(168, 85, 247, 0.6)',
      };
    }

    // Highlight legal moves
    legalMoves.forEach((square) => {
      styles[square] = {
        background:
          'radial-gradient(circle at center, hsl(265, 90%, 65%) 20%, transparent 20%)',
      };
    });

    // Highlight hint square
    if (hintSquare) {
      styles[hintSquare] = {
        backgroundColor: 'rgba(251, 191, 36, 0.4)',
        boxShadow: 'inset 0 0 12px rgba(251, 191, 36, 0.6)',
      };
    }

    return styles;
  }, [selectedSquare, legalMoves, hintSquare]);

  // Determine board orientation based on puzzle turn
  const turn = getPuzzleTurn();
  const orientation = turn === 'b' ? 'black' : 'white';

  // Puzzle info
  const puzzle = currentAttempt?.puzzle;
  const difficulty = puzzle ? ratingToDifficulty(puzzle.rating) : null;
  const difficultyColor = difficulty ? getDifficultyColor(difficulty) : '';
  const hintsRemaining = puzzle ? 3 - (currentAttempt?.hintsUsed || 0) : 0;

  // Render idle state (no puzzle active)
  if (!currentAttempt) {
    return (
      <div className="flex flex-col items-center justify-center py-4 px-2">
        {/* Stats summary */}
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-warning" strokeWidth={1.75} />
            <span className="text-xs font-medium text-foreground">
              {stats.currentStreak}
            </span>
            <span className="text-[10px] text-muted-foreground">streak</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Trophy className="w-4 h-4 text-primary" strokeWidth={1.75} />
            <span className="text-xs font-medium text-foreground">
              {stats.rating}
            </span>
            <span className="text-[10px] text-muted-foreground">rating</span>
          </div>
        </div>

        {/* Start button */}
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={handleStartPuzzle}
          disabled={isLoading}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 rounded-lg',
            'bg-primary/20 hover:bg-primary/30',
            'border border-primary/40 hover:border-primary/60',
            'text-primary font-medium text-sm',
            'transition-colors',
            isLoading && 'opacity-50 pointer-events-none'
          )}
        >
          <Play className="w-4 h-4" strokeWidth={2} />
          {isLoading ? 'Loading...' : dailyPuzzleCompleted ? 'Practice More' : 'Daily Puzzle'}
        </motion.button>

        {/* Error message */}
        {error && (
          <p className="mt-3 text-xs text-danger/80 text-center">{error}</p>
        )}

        {/* Daily completion badge */}
        {dailyPuzzleCompleted && (
          <div className="mt-3 flex items-center gap-1.5 text-success">
            <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2} />
            <span className="text-[10px] font-medium">Daily completed!</span>
          </div>
        )}
      </div>
    );
  }

  // Render puzzle result
  if (currentAttempt.status === 'correct' || currentAttempt.status === 'incorrect') {
    const isSolved = currentAttempt.status === 'correct';

    return (
      <div className="flex flex-col items-center py-4 px-2">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3, ease: smoothOut }}
          className={cn(
            'flex items-center gap-2 mb-3',
            isSolved ? 'text-success' : 'text-danger'
          )}
        >
          {isSolved ? (
            <CheckCircle2 className="w-6 h-6" strokeWidth={2} />
          ) : (
            <XCircle className="w-6 h-6" strokeWidth={2} />
          )}
          <span className="text-sm font-semibold">
            {isSolved ? 'Correct!' : 'Incorrect'}
          </span>
        </motion.div>

        {/* Streak update */}
        <div className="flex items-center gap-1.5 mb-4">
          <Flame className="w-4 h-4 text-warning" strokeWidth={1.75} />
          <span className="text-xs font-medium text-foreground">
            {stats.currentStreak} streak
          </span>
        </div>

        {/* Continue button */}
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={handleStartPuzzle}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg',
            'bg-primary/20 hover:bg-primary/30',
            'border border-primary/40',
            'text-primary font-medium text-sm',
            'transition-colors'
          )}
        >
          <Play className="w-4 h-4" strokeWidth={2} />
          Next Puzzle
        </motion.button>
      </div>
    );
  }

  // Render active puzzle
  return (
    <div className="flex flex-col">
      {/* Puzzle info bar */}
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          {/* Difficulty badge */}
          {difficulty && (
            <span
              className={cn(
                'text-[10px] font-medium px-1.5 py-0.5 rounded',
                'bg-white/5 border border-white/10',
                difficultyColor
              )}
            >
              {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
            </span>
          )}
          {/* Rating */}
          <span className="text-[10px] text-muted-foreground">
            {puzzle?.rating}
          </span>
        </div>

        {/* Streak */}
        <div className="flex items-center gap-1">
          <Flame className="w-3.5 h-3.5 text-warning" strokeWidth={1.75} />
          <span className="text-xs font-medium text-foreground">
            {stats.currentStreak}
          </span>
        </div>
      </div>

      {/* Mini board */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: smoothOut }}
        className={cn(
          'relative rounded-lg overflow-hidden',
          'border border-white/[0.08]',
          // Move feedback glow
          lastMoveResult === 'correct' && 'ring-2 ring-success/50',
          lastMoveResult === 'incorrect' && 'ring-2 ring-danger/50'
        )}
      >
        <Chessboard
          options={{
            position: currentFen,
            boardOrientation: orientation,
            squareStyles,
            boardStyle: {
              borderRadius: '6px',
            },
            darkSquareStyle: {
              backgroundColor: 'hsl(270, 30%, 12%)',
            },
            lightSquareStyle: {
              backgroundColor: 'hsl(270, 20%, 18%)',
            },
            allowDragging: true,
            showNotation: false,
            animationDurationInMs: 150,
            onSquareClick: handleSquareClick,
            onPieceDrop: handlePieceDrop,
          }}
        />
      </motion.div>

      {/* Hint display */}
      <AnimatePresence>
        {currentHint && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className={cn(
              'mt-2 px-2 py-1.5 rounded-md',
              'bg-warning/10 border border-warning/30',
              'text-[11px] text-warning'
            )}
          >
            {currentHint}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls */}
      <div className="flex items-center justify-between mt-2 px-1">
        {/* Hint button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleHint}
          disabled={hintsRemaining <= 0}
          className={cn(
            'flex items-center gap-1 px-2 py-1 rounded-md',
            'text-muted-foreground/70 hover:text-warning',
            'hover:bg-warning/10 transition-colors',
            hintsRemaining <= 0 && 'opacity-40 pointer-events-none'
          )}
          title={`${hintsRemaining} hints remaining`}
        >
          <Lightbulb className="w-3.5 h-3.5" strokeWidth={1.75} />
          <span className="text-[10px]">{hintsRemaining}</span>
        </motion.button>

        {/* Theme tag (if available) */}
        {puzzle?.themes[0] && (
          <span className="text-[9px] text-muted-foreground/50 px-1.5 py-0.5 bg-white/5 rounded">
            {formatTheme(puzzle.themes[0])}
          </span>
        )}

        {/* Right controls */}
        <div className="flex items-center gap-1">
          {/* Reset */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={resetPuzzle}
            className={cn(
              'p-1 rounded-md',
              'text-muted-foreground/50 hover:text-muted-foreground',
              'hover:bg-white/5 transition-colors'
            )}
            title="Reset puzzle"
          >
            <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.75} />
          </motion.button>

          {/* Skip */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={skipPuzzle}
            className={cn(
              'p-1 rounded-md',
              'text-muted-foreground/50 hover:text-danger/80',
              'hover:bg-danger/10 transition-colors'
            )}
            title="Skip puzzle"
          >
            <SkipForward className="w-3.5 h-3.5" strokeWidth={1.75} />
          </motion.button>
        </div>
      </div>
    </div>
  );
}

export default PuzzleBoard;
