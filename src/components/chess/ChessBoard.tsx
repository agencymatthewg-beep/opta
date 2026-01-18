/**
 * ChessBoard - Opta Glass Styled Chess Board
 *
 * Wraps react-chessboard with Opta's Obsidian design system.
 * Features:
 * - Glass container with obsidian styling
 * - Neon primary color for legal move hints
 * - Last move highlighting
 * - Framer Motion for piece drop feedback
 * - Pawn promotion dialog
 *
 * @see DESIGN_SYSTEM.md - Part 4: The Obsidian Glass Material System
 */

import { useState, useCallback, useMemo, useContext } from 'react';
import { Chessboard, type ChessboardOptions } from 'react-chessboard';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Castle, Cross, Sword } from 'lucide-react';
import { cn } from '@/lib/utils';
import ChessSettingsContext from '@/contexts/ChessSettingsContext';
import { ANIMATION_SPEED_MS } from '@/types/chess';

// Easing curve for smooth animations
const smoothOut: [number, number, number, number] = [0.22, 1, 0.36, 1];

export interface ChessBoardProps {
  /** Current board position in FEN notation */
  fen: string;
  /** Callback when a move is made. Returns true if move is legal. */
  onMove: (move: { from: string; to: string; promotion?: string }) => boolean;
  /** Board orientation ('white' pieces at bottom or 'black') */
  orientation?: 'white' | 'black';
  /** Whether to show legal move indicators */
  showLegalMoves?: boolean;
  /** Get legal move destinations for a square */
  getLegalMoves?: (square: string) => string[];
  /** Whether the board is disabled (e.g., AI is thinking) */
  disabled?: boolean;
  /** Last move made (for highlighting) */
  lastMove?: { from: string; to: string };
}

// Promotion piece icons using Lucide
const promotionPieces = [
  { piece: 'q', icon: Crown, label: 'Queen' },
  { piece: 'r', icon: Castle, label: 'Rook' },
  { piece: 'b', icon: Cross, label: 'Bishop' },
  { piece: 'n', icon: Sword, label: 'Knight' },
] as const;

/**
 * ChessBoard component with Opta glass styling.
 */
export function ChessBoard({
  fen,
  onMove,
  orientation = 'white',
  showLegalMoves: showLegalMovesProp,
  getLegalMoves,
  disabled = false,
  lastMove,
}: ChessBoardProps) {
  // Get settings from context (if available)
  const settingsContext = useContext(ChessSettingsContext);
  const contextSettings = settingsContext?.settings;

  // Merge props with context settings (props take precedence when explicitly set)
  const showLegalMoves = showLegalMovesProp ?? contextSettings?.display?.showLegalMoves ?? true;
  const showCoordinates = contextSettings?.display?.showCoordinates ?? true;
  const showLastMoveHighlight = contextSettings?.display?.showLastMove ?? true;
  const animationDurationMs = contextSettings?.animation?.moveAnimationSpeed
    ? ANIMATION_SPEED_MS[contextSettings.animation.moveAnimationSpeed]
    : 200;

  // Track selected square for legal move highlights
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalMoves, setLegalMoves] = useState<string[]>([]);

  // Track pending promotion move
  const [pendingPromotion, setPendingPromotion] = useState<{
    from: string;
    to: string;
  } | null>(null);

  // Animation state for piece drop feedback
  const [dropFeedback, setDropFeedback] = useState<string | null>(null);

  /**
   * Check if a move is a pawn promotion by examining the FEN.
   */
  const isPawnPromotion = useCallback(
    (from: string, to: string): boolean => {
      const board = fen.split(' ')[0];
      const ranks = board.split('/');
      const fromRank = 8 - parseInt(from[1]);
      const fromFile = from.charCodeAt(0) - 'a'.charCodeAt(0);

      let fileIndex = 0;
      let pieceAtFrom = '';

      for (const char of ranks[fromRank]) {
        if (/\d/.test(char)) {
          const emptySquares = parseInt(char);
          if (fromFile >= fileIndex && fromFile < fileIndex + emptySquares) {
            pieceAtFrom = '';
            break;
          }
          fileIndex += emptySquares;
        } else {
          if (fileIndex === fromFile) {
            pieceAtFrom = char;
            break;
          }
          fileIndex++;
        }
      }

      const isPawn = pieceAtFrom.toLowerCase() === 'p';
      const isPromotionRank =
        (to[1] === '8' && pieceAtFrom === 'P') || (to[1] === '1' && pieceAtFrom === 'p');

      return isPawn && isPromotionRank;
    },
    [fen]
  );

  /**
   * Handle move execution, checking for promotion.
   */
  const handleMove = useCallback(
    (from: string, to: string, promotion?: string): boolean => {
      if (isPawnPromotion(from, to) && !promotion) {
        // Show promotion dialog
        setPendingPromotion({ from, to });
        return false;
      }

      // Execute the move
      const success = onMove({ from, to, promotion });

      if (success) {
        // Show drop feedback animation
        setDropFeedback(to);
        setTimeout(() => setDropFeedback(null), 300);
      }

      // Clear selection
      setSelectedSquare(null);
      setLegalMoves([]);

      return success;
    },
    [isPawnPromotion, onMove]
  );

  /**
   * Handle promotion piece selection.
   */
  const handlePromotion = useCallback(
    (piece: string) => {
      if (pendingPromotion) {
        handleMove(pendingPromotion.from, pendingPromotion.to, piece);
        setPendingPromotion(null);
      }
    },
    [pendingPromotion, handleMove]
  );

  /**
   * Handle square click - show legal moves or make move.
   */
  const handleSquareClick = useCallback(
    ({ square }: { piece: { pieceType: string } | null; square: string }) => {
      if (disabled) return;

      // If clicking on a legal move destination, make the move
      if (selectedSquare && legalMoves.includes(square)) {
        handleMove(selectedSquare, square);
        return;
      }

      // Otherwise, select the new square and get legal moves
      if (showLegalMoves && getLegalMoves) {
        const moves = getLegalMoves(square);
        if (moves.length > 0) {
          setSelectedSquare(square);
          setLegalMoves(moves);
          return;
        }
      }

      // Clear selection
      setSelectedSquare(null);
      setLegalMoves([]);
    },
    [disabled, selectedSquare, legalMoves, showLegalMoves, getLegalMoves, handleMove]
  );

  /**
   * Handle piece drag start.
   */
  const handlePieceDrag = useCallback(
    ({ square }: { isSparePiece: boolean; piece: { pieceType: string }; square: string | null }) => {
      if (disabled || !square) return;

      if (showLegalMoves && getLegalMoves) {
        const moves = getLegalMoves(square);
        setSelectedSquare(square);
        setLegalMoves(moves);
      }
    },
    [disabled, showLegalMoves, getLegalMoves]
  );

  /**
   * Handle piece drop.
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
      if (disabled || !targetSquare) return false;

      return handleMove(sourceSquare, targetSquare);
    },
    [disabled, handleMove]
  );

  /**
   * Build custom square styles for highlights.
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

    // Highlight legal move destinations
    if (showLegalMoves) {
      legalMoves.forEach((square) => {
        styles[square] = {
          background:
            'radial-gradient(circle at center, hsl(265, 90%, 65%) 20%, transparent 20%)',
          boxShadow: '0 0 6px rgba(168, 85, 247, 0.3)',
        };
      });
    }

    // Highlight last move (respects settings)
    if (lastMove && showLastMoveHighlight) {
      const lastMoveHighlight = {
        backgroundColor: 'rgba(168, 85, 247, 0.2)',
      };
      styles[lastMove.from] = { ...styles[lastMove.from], ...lastMoveHighlight };
      styles[lastMove.to] = { ...styles[lastMove.to], ...lastMoveHighlight };
    }

    // Drop feedback animation target
    if (dropFeedback) {
      styles[dropFeedback] = {
        ...styles[dropFeedback],
        boxShadow: '0 0 20px rgba(168, 85, 247, 0.6)',
      };
    }

    return styles;
  }, [selectedSquare, legalMoves, lastMove, dropFeedback, showLegalMoves, showLastMoveHighlight]);

  /**
   * Chessboard options for react-chessboard v5.
   */
  const chessboardOptions: ChessboardOptions = useMemo(
    () => ({
      position: fen,
      boardOrientation: orientation,
      squareStyles,
      boardStyle: {
        borderRadius: '8px',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
      },
      darkSquareStyle: {
        backgroundColor: 'hsl(270, 30%, 12%)',
      },
      lightSquareStyle: {
        backgroundColor: 'hsl(270, 20%, 18%)',
      },
      allowDragging: !disabled,
      showNotation: showCoordinates,
      animationDurationInMs: animationDurationMs,
      onSquareClick: handleSquareClick,
      onPieceDrag: handlePieceDrag,
      onPieceDrop: handlePieceDrop,
    }),
    [fen, orientation, squareStyles, disabled, showCoordinates, animationDurationMs, handleSquareClick, handlePieceDrag, handlePieceDrop]
  );

  return (
    <div className="relative">
      {/* Board container with obsidian glass styling */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98, filter: 'brightness(0.5) blur(2px)' }}
        animate={{ opacity: 1, scale: 1, filter: 'brightness(1) blur(0px)' }}
        transition={{ duration: 0.5, ease: smoothOut }}
        className={cn(
          'relative rounded-xl overflow-hidden',
          // Obsidian glass container
          'glass',
          'border border-white/[0.08]',
          // Inner glow
          'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]',
          // Outer glow
          'shadow-[0_8px_32px_-8px_rgba(168,85,247,0.2)]',
          // Disabled state
          disabled && 'opacity-75 pointer-events-none'
        )}
      >
        {/* Board padding */}
        <div className="p-3">
          <Chessboard options={chessboardOptions} />
        </div>
      </motion.div>

      {/* Promotion dialog */}
      <AnimatePresence>
        {pendingPromotion && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 flex items-center justify-center z-10"
          >
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm rounded-xl"
              onClick={() => setPendingPromotion(null)}
            />

            {/* Promotion options */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.2, ease: smoothOut }}
              className={cn(
                'relative z-20 flex gap-2 p-4 rounded-xl',
                'glass-overlay',
                'border border-primary/30',
                'shadow-[0_0_30px_-5px_rgba(168,85,247,0.5)]'
              )}
            >
              {promotionPieces.map(({ piece, icon: Icon, label }) => (
                <motion.button
                  key={piece}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handlePromotion(piece)}
                  className={cn(
                    'p-3 rounded-lg',
                    'bg-primary/10 hover:bg-primary/20',
                    'border border-primary/30 hover:border-primary/50',
                    'transition-colors duration-200'
                  )}
                  title={label}
                >
                  <Icon
                    className="w-8 h-8 text-primary drop-shadow-[0_0_8px_rgba(168,85,247,0.6)]"
                    strokeWidth={1.5}
                  />
                </motion.button>
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default ChessBoard;
