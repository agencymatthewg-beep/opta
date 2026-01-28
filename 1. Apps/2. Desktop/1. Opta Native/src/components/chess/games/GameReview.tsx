/**
 * GameReview - Move-by-move game analysis component.
 *
 * Features:
 * - Interactive board with move navigation
 * - Move list with current position highlight
 * - Game metadata display
 * - Opening name and ECO code
 * - Result and end reason
 *
 * @see DESIGN_SYSTEM.md - Glass system, Framer Motion, Lucide icons
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  RotateCcw,
  ExternalLink,
  Trophy,
  XCircle,
  Minus,
  Zap,
  Timer,
  Clock,
  Hourglass,
  Mail,
  ArrowLeft,
} from 'lucide-react';
import { Chessboard } from 'react-chessboard';
import { cn } from '@/lib/utils';
import type {
  ArchivedGame,
  ArchiveMove,
  TimeControlCategory,
} from '@/types/gameArchive';
import { STARTING_FEN } from '@/types/chess';

// Easing curve for smooth animations
const smoothOut: [number, number, number, number] = [0.22, 1, 0.36, 1];

export interface GameReviewProps {
  /** The game to review */
  game: ArchivedGame;
  /** Callback to close/exit review */
  onClose?: () => void;
  /** Whether to show compact mode (for widget) */
  compact?: boolean;
}

/**
 * Get icon for time control category.
 */
function getCategoryIcon(category: TimeControlCategory) {
  switch (category) {
    case 'bullet':
      return Zap;
    case 'blitz':
      return Timer;
    case 'rapid':
      return Clock;
    case 'classical':
      return Hourglass;
    case 'correspondence':
      return Mail;
  }
}

/**
 * Format date for display.
 */
function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * MoveList component - displays moves in standard notation.
 */
function MoveList({
  moves,
  currentIndex,
  onSelectMove,
  maxHeight = '200px',
}: {
  moves: ArchiveMove[];
  currentIndex: number;
  onSelectMove: (index: number) => void;
  maxHeight?: string;
}) {
  // Group moves into pairs (white + black)
  const movePairs = useMemo(() => {
    const pairs: Array<{ number: number; white?: ArchiveMove; black?: ArchiveMove; whiteIndex: number; blackIndex: number }> = [];

    for (let i = 0; i < moves.length; i++) {
      const move = moves[i];
      if (move.color === 'w') {
        pairs.push({
          number: move.moveNumber,
          white: move,
          whiteIndex: i,
          blackIndex: -1,
        });
      } else {
        const lastPair = pairs[pairs.length - 1];
        if (lastPair && lastPair.number === move.moveNumber) {
          lastPair.black = move;
          lastPair.blackIndex = i;
        } else {
          pairs.push({
            number: move.moveNumber,
            black: move,
            whiteIndex: -1,
            blackIndex: i,
          });
        }
      }
    }

    return pairs;
  }, [moves]);

  return (
    <div
      className="overflow-y-auto font-mono text-xs"
      style={{ maxHeight }}
    >
      <div className="grid grid-cols-[auto_1fr_1fr] gap-x-2 gap-y-0.5">
        {movePairs.map((pair) => (
          <motion.div
            key={pair.number}
            className="contents"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: pair.number * 0.01 }}
          >
            {/* Move number */}
            <span className="text-muted-foreground/40 tabular-nums">
              {pair.number}.
            </span>

            {/* White move */}
            <button
              onClick={() => pair.whiteIndex >= 0 && onSelectMove(pair.whiteIndex)}
              disabled={pair.whiteIndex < 0}
              className={cn(
                'text-left px-1 py-0.5 rounded',
                'transition-colors',
                pair.whiteIndex === currentIndex
                  ? 'bg-primary/20 text-primary'
                  : 'text-foreground hover:bg-white/5',
                pair.whiteIndex < 0 && 'text-muted-foreground/30'
              )}
            >
              {pair.white?.san || '...'}
            </button>

            {/* Black move */}
            <button
              onClick={() => pair.blackIndex >= 0 && onSelectMove(pair.blackIndex)}
              disabled={pair.blackIndex < 0}
              className={cn(
                'text-left px-1 py-0.5 rounded',
                'transition-colors',
                pair.blackIndex === currentIndex
                  ? 'bg-primary/20 text-primary'
                  : 'text-foreground hover:bg-white/5',
                pair.blackIndex < 0 && 'opacity-0'
              )}
            >
              {pair.black?.san || ''}
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/**
 * Navigation controls for move traversal.
 */
function NavigationControls({
  onFirst,
  onPrev,
  onNext,
  onLast,
  canPrev,
  canNext,
  compact = false,
}: {
  onFirst: () => void;
  onPrev: () => void;
  onNext: () => void;
  onLast: () => void;
  canPrev: boolean;
  canNext: boolean;
  compact?: boolean;
}) {
  const buttonClass = cn(
    'p-2 rounded-lg transition-colors',
    'text-muted-foreground/60 hover:text-foreground',
    'hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none'
  );

  return (
    <div className={cn('flex items-center', compact ? 'gap-1' : 'gap-2')}>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onFirst}
        disabled={!canPrev}
        className={buttonClass}
        title="First move"
      >
        <ChevronsLeft className={cn(compact ? 'w-4 h-4' : 'w-5 h-5')} strokeWidth={1.75} />
      </motion.button>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onPrev}
        disabled={!canPrev}
        className={buttonClass}
        title="Previous move"
      >
        <ChevronLeft className={cn(compact ? 'w-4 h-4' : 'w-5 h-5')} strokeWidth={1.75} />
      </motion.button>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onNext}
        disabled={!canNext}
        className={buttonClass}
        title="Next move"
      >
        <ChevronRight className={cn(compact ? 'w-4 h-4' : 'w-5 h-5')} strokeWidth={1.75} />
      </motion.button>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onLast}
        disabled={!canNext}
        className={buttonClass}
        title="Last move"
      >
        <ChevronsRight className={cn(compact ? 'w-4 h-4' : 'w-5 h-5')} strokeWidth={1.75} />
      </motion.button>
    </div>
  );
}

/**
 * GameReview component.
 */
export function GameReview({ game, onClose, compact = false }: GameReviewProps) {
  // Current move index (-1 = starting position)
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setCurrentMoveIndex((prev) => Math.max(-1, prev - 1));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setCurrentMoveIndex((prev) =>
          Math.min(game.moves.length - 1, prev + 1)
        );
      } else if (e.key === 'Home') {
        e.preventDefault();
        setCurrentMoveIndex(-1);
      } else if (e.key === 'End') {
        e.preventDefault();
        setCurrentMoveIndex(game.moves.length - 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [game.moves.length]);

  // Get current FEN
  const currentFen = useMemo(() => {
    if (currentMoveIndex < 0) {
      return game.startFen || STARTING_FEN;
    }
    return game.moves[currentMoveIndex]?.fen || STARTING_FEN;
  }, [game, currentMoveIndex]);

  // Get last move for highlighting
  const lastMove = useMemo(() => {
    if (currentMoveIndex < 0) return undefined;
    const move = game.moves[currentMoveIndex];
    if (!move) return undefined;
    return {
      from: move.uci.slice(0, 2),
      to: move.uci.slice(2, 4),
    };
  }, [game.moves, currentMoveIndex]);

  // Navigation handlers
  const goToFirst = useCallback(() => setCurrentMoveIndex(-1), []);
  const goToPrev = useCallback(
    () => setCurrentMoveIndex((prev) => Math.max(-1, prev - 1)),
    []
  );
  const goToNext = useCallback(
    () =>
      setCurrentMoveIndex((prev) =>
        Math.min(game.moves.length - 1, prev + 1)
      ),
    [game.moves.length]
  );
  const goToLast = useCallback(
    () => setCurrentMoveIndex(game.moves.length - 1),
    [game.moves.length]
  );

  // Board orientation based on player color
  const orientation = game.player.color;

  // Result styling
  const resultConfig = {
    win: { icon: Trophy, color: 'text-success', label: 'Won' },
    loss: { icon: XCircle, color: 'text-danger', label: 'Lost' },
    draw: { icon: Minus, color: 'text-muted-foreground', label: 'Draw' },
  }[game.result];

  const ResultIcon = resultConfig.icon;
  const CategoryIcon = getCategoryIcon(game.category);

  // Custom square styles for last move highlight
  const squareStyles = useMemo(() => {
    if (!lastMove) return {};
    return {
      [lastMove.from]: {
        backgroundColor: 'rgba(168, 85, 247, 0.3)',
      },
      [lastMove.to]: {
        backgroundColor: 'rgba(168, 85, 247, 0.4)',
      },
    };
  }, [lastMove]);

  if (compact) {
    // Compact mode for widget
    return (
      <div className="flex flex-col h-full">
        {/* Mini header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <ResultIcon
              className={cn('w-4 h-4', resultConfig.color)}
              strokeWidth={1.75}
            />
            <span className="text-xs font-medium text-foreground">
              vs {game.opponent.username}
            </span>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded text-muted-foreground/50 hover:text-muted-foreground hover:bg-white/5"
            >
              <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
            </button>
          )}
        </div>

        {/* Mini board */}
        <div className="rounded-lg overflow-hidden border border-white/[0.08]">
          <Chessboard
            options={{
              position: currentFen,
              boardOrientation: orientation,
              squareStyles,
              boardStyle: { borderRadius: '6px' },
              darkSquareStyle: { backgroundColor: 'hsl(270, 30%, 12%)' },
              lightSquareStyle: { backgroundColor: 'hsl(270, 20%, 18%)' },
              allowDragging: false,
              showNotation: false,
              animationDurationInMs: 150,
            }}
          />
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-center mt-2">
          <NavigationControls
            onFirst={goToFirst}
            onPrev={goToPrev}
            onNext={goToNext}
            onLast={goToLast}
            canPrev={currentMoveIndex >= 0}
            canNext={currentMoveIndex < game.moves.length - 1}
            compact
          />
        </div>

        {/* Move counter */}
        <p className="text-center text-[10px] text-muted-foreground/50 mt-1">
          {currentMoveIndex < 0
            ? 'Starting position'
            : `Move ${currentMoveIndex + 1} of ${game.moves.length}`}
        </p>
      </div>
    );
  }

  // Full review mode
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: smoothOut }}
      className="flex flex-col lg:flex-row gap-6"
    >
      {/* Left: Board and navigation */}
      <div className="flex-1 flex flex-col">
        {/* Back button and game info */}
        <div className="flex items-center gap-4 mb-4">
          {onClose && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onClose}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg',
                'text-muted-foreground/70 hover:text-foreground',
                'hover:bg-white/5 transition-colors'
              )}
            >
              <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
              <span className="text-sm">Back</span>
            </motion.button>
          )}

          <div className="flex-1" />

          {/* Source link */}
          {game.sourceUrl && (
            <motion.a
              href={game.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ scale: 1.02 }}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs',
                'text-muted-foreground/60 hover:text-muted-foreground',
                'hover:bg-white/5 transition-colors'
              )}
            >
              <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.75} />
              View on {game.source}
            </motion.a>
          )}
        </div>

        {/* Board */}
        <div className="relative w-full max-w-[480px] aspect-square mx-auto">
          <div className="rounded-xl overflow-hidden border border-white/[0.08] shadow-lg">
            <Chessboard
              options={{
                position: currentFen,
                boardOrientation: orientation,
                squareStyles,
                boardStyle: { borderRadius: '8px' },
                darkSquareStyle: { backgroundColor: 'hsl(270, 30%, 12%)' },
                lightSquareStyle: { backgroundColor: 'hsl(270, 20%, 18%)' },
                allowDragging: false,
                showNotation: true,
                animationDurationInMs: 150,
              }}
            />
          </div>
        </div>

        {/* Navigation controls */}
        <div className="flex items-center justify-center mt-4 gap-4">
          <NavigationControls
            onFirst={goToFirst}
            onPrev={goToPrev}
            onNext={goToNext}
            onLast={goToLast}
            canPrev={currentMoveIndex >= 0}
            canNext={currentMoveIndex < game.moves.length - 1}
          />

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={goToFirst}
            className={cn(
              'p-2 rounded-lg transition-colors',
              'text-muted-foreground/60 hover:text-foreground',
              'hover:bg-white/5'
            )}
            title="Reset to start"
          >
            <RotateCcw className="w-5 h-5" strokeWidth={1.75} />
          </motion.button>
        </div>

        {/* Move counter */}
        <p className="text-center text-sm text-muted-foreground/60 mt-2">
          {currentMoveIndex < 0
            ? 'Starting position'
            : `Move ${currentMoveIndex + 1} of ${game.moves.length}`}
        </p>
      </div>

      {/* Right: Game info and move list */}
      <div className="lg:w-72 flex flex-col gap-4">
        {/* Game metadata */}
        <div
          className={cn(
            'p-4 rounded-xl',
            'glass',
            'border border-white/[0.06]'
          )}
        >
          {/* Result and players */}
          <div className="flex items-center gap-3 mb-4">
            <div
              className={cn(
                'flex items-center justify-center w-10 h-10 rounded-lg',
                game.result === 'win' && 'bg-success/15 border border-success/30',
                game.result === 'loss' && 'bg-danger/15 border border-danger/30',
                game.result === 'draw' && 'bg-muted/15 border border-muted/30'
              )}
            >
              <ResultIcon
                className={cn('w-5 h-5', resultConfig.color)}
                strokeWidth={1.75}
              />
            </div>
            <div>
              <div className="font-medium text-foreground">
                {resultConfig.label} vs {game.opponent.username}
              </div>
              <div className="text-xs text-muted-foreground/60">
                {game.opponent.rating && `${game.opponent.rating} · `}
                {formatDate(game.playedAt)}
              </div>
            </div>
          </div>

          {/* Time control and opening */}
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground/70">
              <CategoryIcon className="w-4 h-4" strokeWidth={1.75} />
              <span>
                {game.timeControl.display} · {game.category}
              </span>
            </div>

            {game.opening && (
              <div className="text-muted-foreground/70">
                <span className="text-muted-foreground/40">Opening: </span>
                {game.eco && (
                  <span className="text-primary/80">{game.eco} </span>
                )}
                {game.opening}
              </div>
            )}

            <div className="text-muted-foreground/50 text-xs">
              {game.moves.length} moves · {game.endReason}
            </div>
          </div>
        </div>

        {/* Move list */}
        <div
          className={cn(
            'flex-1 p-4 rounded-xl',
            'glass',
            'border border-white/[0.06]'
          )}
        >
          <h4 className="text-sm font-medium text-muted-foreground/70 mb-3">
            Moves
          </h4>
          <MoveList
            moves={game.moves}
            currentIndex={currentMoveIndex}
            onSelectMove={setCurrentMoveIndex}
            maxHeight="280px"
          />
        </div>
      </div>
    </motion.div>
  );
}

export default GameReview;
