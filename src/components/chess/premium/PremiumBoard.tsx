/**
 * PremiumBoard - High-Quality Chess Board Visualization
 *
 * A premium chess board with:
 * - Multiple material themes (obsidian, wood, marble, glass)
 * - Enhanced lighting and reflection effects
 * - Piece shadows and highlights
 * - Smooth movement animations
 * - Stylized coordinates
 *
 * @see DESIGN_SYSTEM.md - Glass effects, Framer Motion
 */

import { useState, useCallback, useMemo, useRef } from 'react';
import { Chessboard, type ChessboardOptions } from 'react-chessboard';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Castle, Cross, Sword } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  type BoardTheme,
  type BoardThemeId,
  getBoardTheme,
} from '@/types/boardTheme';

// Smooth easing for transitions
const smoothOut: [number, number, number, number] = [0.22, 1, 0.36, 1];

export interface PremiumBoardProps {
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
  /** Board theme ID */
  themeId?: BoardThemeId;
  /** Custom theme override */
  theme?: BoardTheme;
  /** Whether to show coordinates */
  showCoordinates?: boolean;
  /** Whether to show the specular lighting effect */
  showLighting?: boolean;
  /** Board size in pixels (default auto-sizes to container) */
  size?: number;
}

// Promotion piece icons
const promotionPieces = [
  { piece: 'q', icon: Crown, label: 'Queen' },
  { piece: 'r', icon: Castle, label: 'Rook' },
  { piece: 'b', icon: Cross, label: 'Bishop' },
  { piece: 'n', icon: Sword, label: 'Knight' },
] as const;

/**
 * Coordinates component for premium board
 */
function BoardCoordinates({
  orientation,
  theme,
}: {
  orientation: 'white' | 'black';
  theme: BoardTheme;
}) {
  const files = orientation === 'white' ? 'abcdefgh'.split('') : 'hgfedcba'.split('');
  const ranks = orientation === 'white' ? '87654321'.split('') : '12345678'.split('');

  return (
    <>
      {/* File labels (a-h) at bottom */}
      <div className="absolute -bottom-5 left-0 right-0 flex justify-around px-1">
        {files.map((file) => (
          <span
            key={file}
            className="text-[10px] font-medium"
            style={{
              color: theme.colors.coordinateColor,
              backgroundColor: theme.colors.coordinateBg,
              padding: theme.colors.coordinateBg !== 'transparent' ? '0 2px' : 0,
              borderRadius: 2,
            }}
          >
            {file}
          </span>
        ))}
      </div>
      {/* Rank labels (1-8) on left */}
      <div className="absolute -left-4 top-0 bottom-0 flex flex-col justify-around py-1">
        {ranks.map((rank) => (
          <span
            key={rank}
            className="text-[10px] font-medium"
            style={{
              color: theme.colors.coordinateColor,
              backgroundColor: theme.colors.coordinateBg,
              padding: theme.colors.coordinateBg !== 'transparent' ? '0 2px' : 0,
              borderRadius: 2,
            }}
          >
            {rank}
          </span>
        ))}
      </div>
    </>
  );
}

/**
 * Specular lighting overlay for the board
 */
function SpecularLighting({
  theme,
}: {
  theme: BoardTheme;
}) {
  if (theme.lighting.specularIntensity === 0) return null;

  // Fixed position gradient based on theme angle
  const angle = theme.lighting.specularAngle;
  const x = 50 + Math.cos(angle * Math.PI / 180) * 30;
  const y = 30 + Math.sin(angle * Math.PI / 180) * 20;

  return (
    <motion.div
      className="absolute inset-0 pointer-events-none rounded-lg overflow-hidden"
      style={{
        background: `radial-gradient(
          circle at ${x}% ${y}%,
          rgba(255, 255, 255, ${theme.lighting.specularIntensity}) 0%,
          transparent 50%
        )`,
        opacity: theme.lighting.specularIntensity,
      }}
    />
  );
}

/**
 * Material overlay for wood/marble textures
 */
function MaterialOverlay({ theme }: { theme: BoardTheme }) {
  if (!theme.materialOverlay) return null;

  return (
    <div
      className="absolute inset-0 pointer-events-none rounded-lg"
      style={{ background: theme.materialOverlay }}
    />
  );
}

/**
 * Premium chess board component with theme support.
 */
export function PremiumBoard({
  fen,
  onMove,
  orientation = 'white',
  showLegalMoves = true,
  getLegalMoves,
  disabled = false,
  lastMove,
  themeId = 'obsidian',
  theme: customTheme,
  showCoordinates = true,
  showLighting = true,
  size,
}: PremiumBoardProps) {
  // Get theme (custom or by ID)
  const theme = customTheme ?? getBoardTheme(themeId);

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

  // Container ref for size calculations
  const containerRef = useRef<HTMLDivElement>(null);

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
        setPendingPromotion({ from, to });
        return false;
      }

      const success = onMove({ from, to, promotion });

      if (success) {
        setDropFeedback(to);
        setTimeout(() => setDropFeedback(null), 300);
      }

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

      if (selectedSquare && legalMoves.includes(square)) {
        handleMove(selectedSquare, square);
        return;
      }

      if (showLegalMoves && getLegalMoves) {
        const moves = getLegalMoves(square);
        if (moves.length > 0) {
          setSelectedSquare(square);
          setLegalMoves(moves);
          return;
        }
      }

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
      const isLight = isLightSquare(selectedSquare);
      styles[selectedSquare] = {
        backgroundColor: isLight
          ? theme.colors.lightSquareHover
          : theme.colors.darkSquareHover,
        boxShadow: 'inset 0 0 8px rgba(168, 85, 247, 0.4)',
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

    // Highlight last move
    if (lastMove) {
      const lastMoveHighlight = {
        backgroundColor: 'rgba(168, 85, 247, 0.15)',
      };
      styles[lastMove.from] = { ...styles[lastMove.from], ...lastMoveHighlight };
      styles[lastMove.to] = { ...styles[lastMove.to], ...lastMoveHighlight };
    }

    // Drop feedback animation target
    if (dropFeedback) {
      styles[dropFeedback] = {
        ...styles[dropFeedback],
        boxShadow: theme.pieces.hoverGlow,
      };
    }

    return styles;
  }, [selectedSquare, legalMoves, lastMove, dropFeedback, showLegalMoves, theme]);

  /**
   * Chessboard options for react-chessboard.
   */
  const chessboardOptions: ChessboardOptions = useMemo(
    () => ({
      position: fen,
      boardOrientation: orientation,
      squareStyles,
      boardStyle: {
        borderRadius: '8px',
        boxShadow: theme.lighting.outerShadow,
      },
      darkSquareStyle: {
        backgroundColor: theme.colors.darkSquare,
      },
      lightSquareStyle: {
        backgroundColor: theme.colors.lightSquare,
      },
      allowDragging: !disabled,
      showNotation: false, // We render our own coordinates
      animationDurationInMs: 200,
      onSquareClick: handleSquareClick,
      onPieceDrag: handlePieceDrag,
      onPieceDrop: handlePieceDrop,
    }),
    [fen, orientation, squareStyles, theme, disabled, handleSquareClick, handlePieceDrag, handlePieceDrop]
  );

  return (
    <div
      ref={containerRef}
      className="relative"
      style={size ? { width: size, height: size } : undefined}
    >
      {/* Board container with premium styling */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98, filter: 'brightness(0.5) blur(2px)' }}
        animate={{ opacity: 1, scale: 1, filter: 'brightness(1) blur(0px)' }}
        transition={{ duration: 0.5, ease: smoothOut }}
        className={cn(
          'relative rounded-xl overflow-hidden',
          // Glass effect for glass theme
          themeId === 'glass' && 'glass backdrop-blur-md',
          // Border
          'border',
          // Disabled state
          disabled && 'opacity-75 pointer-events-none'
        )}
        style={{
          borderColor: theme.colors.border,
          boxShadow: `${theme.lighting.innerShadow}, ${theme.lighting.outerShadow}`,
        }}
      >
        {/* Board padding with coordinates space */}
        <div className={cn('relative', showCoordinates ? 'p-4 pl-6 pb-6' : 'p-3')}>
          {/* Coordinates */}
          {showCoordinates && (
            <BoardCoordinates orientation={orientation} theme={theme} />
          )}

          {/* The chessboard */}
          <div className="relative">
            <Chessboard options={chessboardOptions} />

            {/* Specular lighting overlay */}
            {showLighting && theme.hasAnimatedEffects && (
              <SpecularLighting theme={theme} />
            )}

            {/* Material texture overlay */}
            <MaterialOverlay theme={theme} />

            {/* Reflection effect at bottom */}
            {theme.lighting.reflectionOpacity > 0 && (
              <div
                className="absolute inset-x-0 bottom-0 h-1/4 pointer-events-none rounded-b-lg"
                style={{
                  background: `linear-gradient(to top, rgba(255, 255, 255, ${theme.lighting.reflectionOpacity}), transparent)`,
                }}
              />
            )}
          </div>
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
                'glass-strong',
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

/**
 * Check if a square is a light square
 */
function isLightSquare(square: string): boolean {
  const file = square.charCodeAt(0) - 'a'.charCodeAt(0);
  const rank = parseInt(square[1]) - 1;
  return (file + rank) % 2 === 1;
}

export default PremiumBoard;
