/**
 * MiniChessBoard - Compact chess board for the widget.
 *
 * A smaller version of ChessBoard designed to fit in the widget:
 * - Compact 200-250px size
 * - Functional moves against Stockfish
 * - Minimal controls (new game, undo)
 * - Link to full Chess page
 *
 * Reuses useChessGame and useStockfish hooks.
 *
 * @see DESIGN_SYSTEM.md - Glass styling, Framer Motion
 */

import { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Chessboard, type ChessboardOptions } from 'react-chessboard';
import { RotateCcw, Plus, Maximize2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useChessGame } from '@/hooks/useChessGame';
import { useStockfish } from '@/hooks/useStockfish';
import { DIFFICULTY_TO_SKILL_LEVEL, DEFAULT_CHESS_SETTINGS, type ChessSettings } from '@/types/chess';

// LocalStorage keys (shared with Chess page)
const CHESS_SETTINGS_KEY = 'opta_chess_settings';
const CHESS_GAME_FEN_KEY = 'opta_chess_game_fen';

// Easing curve for smooth animations
const smoothOut: [number, number, number, number] = [0.22, 1, 0.36, 1];

export interface MiniChessBoardProps {
  /** Callback to navigate to full chess page */
  onOpenFullBoard?: () => void;
  /** Callback when turn changes (for parent status updates) */
  onTurnChange?: (isYourTurn: boolean) => void;
}

/**
 * Compact chess board component for the widget.
 */
export function MiniChessBoard({
  onOpenFullBoard,
  onTurnChange,
}: MiniChessBoardProps) {
  // Track last move for highlighting
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);

  // Load settings from localStorage (shared with Chess page)
  const [settings] = useState<ChessSettings>(() => {
    try {
      const saved = localStorage.getItem(CHESS_SETTINGS_KEY);
      if (saved) {
        return { ...DEFAULT_CHESS_SETTINGS, ...JSON.parse(saved) };
      }
    } catch {
      // Ignore parse errors
    }
    return DEFAULT_CHESS_SETTINGS;
  });

  // Initialize chess game
  const {
    fen,
    isGameOver,
    turn,
    makeMove,
    undo,
    reset,
    getLegalMoves,
    loadFen,
  } = useChessGame();

  // Initialize Stockfish AI
  const {
    isReady: aiReady,
    isThinking,
    getBestMove,
  } = useStockfish({
    skillLevel: DIFFICULTY_TO_SKILL_LEVEL[settings.aiConfig.difficulty],
    thinkTimeMs: settings.aiConfig.thinkTimeMs,
  });

  // Load saved game on mount
  useEffect(() => {
    const savedFen = localStorage.getItem(CHESS_GAME_FEN_KEY);
    if (savedFen && savedFen !== 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1') {
      loadFen(savedFen);
    }
  }, [loadFen]);

  // Auto-save game position
  useEffect(() => {
    if (settings.autoSave) {
      localStorage.setItem(CHESS_GAME_FEN_KEY, fen);
    }
  }, [fen, settings.autoSave]);

  // Notify parent of turn changes
  useEffect(() => {
    onTurnChange?.(turn === 'w' && !isThinking);
  }, [turn, isThinking, onTurnChange]);

  // Handle player move
  const handleMove = useCallback(
    (move: { from: string; to: string; promotion?: string }): boolean => {
      if (turn !== 'w' || isThinking) return false;

      const madeMove = makeMove(move);
      if (madeMove) {
        setLastMove({ from: move.from, to: move.to });
        return true;
      }
      return false;
    },
    [turn, isThinking, makeMove]
  );

  // Trigger AI move when it's AI's turn
  useEffect(() => {
    if (turn === 'b' && aiReady && !isGameOver && !isThinking) {
      const makeAIMove = async () => {
        const aiMoveStr = await getBestMove(fen);
        if (aiMoveStr) {
          const from = aiMoveStr.slice(0, 2);
          const to = aiMoveStr.slice(2, 4);
          const promotion = aiMoveStr.length > 4 ? aiMoveStr[4] : undefined;

          const madeMove = makeMove({ from, to, promotion });
          if (madeMove) {
            setLastMove({ from, to });
          }
        }
      };
      makeAIMove();
    }
  }, [turn, aiReady, isGameOver, isThinking, fen, getBestMove, makeMove]);

  // Handle new game
  const handleNewGame = useCallback(() => {
    reset();
    setLastMove(null);
    localStorage.removeItem(CHESS_GAME_FEN_KEY);
  }, [reset]);

  // Handle undo (undo both player and AI move)
  const handleUndo = useCallback(() => {
    undo();
    undo();
    setLastMove(null);
  }, [undo]);

  // Track selected square for legal moves
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalMoves, setLegalMoves] = useState<string[]>([]);

  // Handle square click
  const handleSquareClick = useCallback(
    ({ square }: { piece: { pieceType: string } | null; square: string }) => {
      if (turn !== 'w' || isThinking || isGameOver) return;

      // If clicking on a legal move destination, make the move
      if (selectedSquare && legalMoves.includes(square)) {
        handleMove({ from: selectedSquare, to: square });
        setSelectedSquare(null);
        setLegalMoves([]);
        return;
      }

      // Otherwise, select the new square and get legal moves
      const moves = getLegalMoves(square);
      if (moves.length > 0) {
        setSelectedSquare(square);
        setLegalMoves(moves);
        return;
      }

      // Clear selection
      setSelectedSquare(null);
      setLegalMoves([]);
    },
    [turn, isThinking, isGameOver, selectedSquare, legalMoves, getLegalMoves, handleMove]
  );

  // Handle piece drop
  const handlePieceDrop = useCallback(
    ({
      sourceSquare,
      targetSquare,
    }: {
      piece: { isSparePiece: boolean; position: string; pieceType: string };
      sourceSquare: string;
      targetSquare: string | null;
    }): boolean => {
      if (turn !== 'w' || isThinking || !targetSquare) return false;
      setSelectedSquare(null);
      setLegalMoves([]);
      return handleMove({ from: sourceSquare, to: targetSquare });
    },
    [turn, isThinking, handleMove]
  );

  // Build square styles
  const squareStyles: Record<string, React.CSSProperties> = {};

  // Highlight selected square
  if (selectedSquare) {
    squareStyles[selectedSquare] = {
      backgroundColor: 'rgba(168, 85, 247, 0.4)',
    };
  }

  // Highlight legal moves
  legalMoves.forEach((square) => {
    squareStyles[square] = {
      background: 'radial-gradient(circle at center, hsl(265, 90%, 65%) 20%, transparent 20%)',
    };
  });

  // Highlight last move
  if (lastMove) {
    const lastMoveHighlight = { backgroundColor: 'rgba(168, 85, 247, 0.2)' };
    squareStyles[lastMove.from] = { ...squareStyles[lastMove.from], ...lastMoveHighlight };
    squareStyles[lastMove.to] = { ...squareStyles[lastMove.to], ...lastMoveHighlight };
  }

  // Chessboard options
  const chessboardOptions: ChessboardOptions = {
    position: fen,
    boardOrientation: 'white',
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
    allowDragging: turn === 'w' && !isThinking && !isGameOver,
    showNotation: false,
    animationDurationInMs: 150,
    onSquareClick: handleSquareClick,
    onPieceDrop: handlePieceDrop,
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Board */}
      <div className="relative">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, ease: smoothOut }}
          className={cn(
            'rounded-lg overflow-hidden',
            'border border-white/[0.06]'
          )}
        >
          <Chessboard options={chessboardOptions} />
        </motion.div>

        {/* AI Thinking Overlay */}
        {isThinking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={cn(
              'absolute inset-0 flex items-center justify-center',
              'bg-black/30 rounded-lg'
            )}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            >
              <Loader2 className="w-6 h-6 text-primary" strokeWidth={2} />
            </motion.div>
          </motion.div>
        )}

        {/* Game Over Overlay */}
        {isGameOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={cn(
              'absolute inset-0 flex flex-col items-center justify-center gap-2',
              'bg-black/50 backdrop-blur-sm rounded-lg'
            )}
          >
            <span className="text-sm font-semibold text-foreground">Game Over</span>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleNewGame}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium',
                'bg-primary text-white',
                'hover:bg-primary/90'
              )}
            >
              New Game
            </motion.button>
          </motion.div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {/* New Game */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleNewGame}
            className={cn(
              'p-1.5 rounded-md',
              'hover:bg-white/5 text-muted-foreground/60 hover:text-muted-foreground',
              'transition-colors'
            )}
            title="New game"
          >
            <Plus className="w-4 h-4" strokeWidth={1.75} />
          </motion.button>

          {/* Undo */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleUndo}
            disabled={turn === 'b' || isThinking}
            className={cn(
              'p-1.5 rounded-md',
              'hover:bg-white/5 text-muted-foreground/60 hover:text-muted-foreground',
              'transition-colors',
              'disabled:opacity-40 disabled:cursor-not-allowed'
            )}
            title="Undo move"
          >
            <RotateCcw className="w-4 h-4" strokeWidth={1.75} />
          </motion.button>
        </div>

        {/* Open Full Board */}
        {onOpenFullBoard && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onOpenFullBoard}
            className={cn(
              'flex items-center gap-1.5 px-2 py-1 rounded-md',
              'text-xs text-muted-foreground/60 hover:text-muted-foreground',
              'hover:bg-white/5 transition-colors'
            )}
          >
            <Maximize2 className="w-3 h-3" strokeWidth={1.75} />
            Full board
          </motion.button>
        )}
      </div>

      {/* AI Status */}
      {!aiReady && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground/50">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          >
            <Loader2 className="w-3 h-3" strokeWidth={2} />
          </motion.div>
          Loading AI...
        </div>
      )}
    </div>
  );
}

export default MiniChessBoard;
