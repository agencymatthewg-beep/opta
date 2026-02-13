/**
 * React hook for chess game state management.
 *
 * Wraps chess.js to provide game state, move validation, and history.
 * All chess rules (castling, en passant, promotion) handled by chess.js.
 *
 * IMPORTANT: chess.js is the single source of truth.
 * Never maintain separate piece tracking or state.
 */

import { useState, useCallback, useMemo } from 'react';
import { Chess, type Move } from 'chess.js';
import type { ChessMove, ChessGameResult } from '../types/chess';
import { STARTING_FEN } from '../types/chess';

/**
 * Options for useChessGame hook.
 */
export interface UseChessGameOptions {
  /** Initial position in FEN notation (default: starting position) */
  initialFen?: string;
  /** Which color the player is (default: 'white') */
  playerColor?: 'white' | 'black';
  /** Callback when game ends */
  onGameOver?: (result: ChessGameResult) => void;
  /** Callback when a move is made */
  onMove?: (move: ChessMove) => void;
}

/**
 * Return type for useChessGame hook.
 */
export interface UseChessGameReturn {
  // State
  /** Current board position in FEN notation */
  fen: string;
  /** Move history with full details */
  history: ChessMove[];
  /** Whether the game has ended */
  isGameOver: boolean;
  /** Result of the game (if over) */
  result: ChessGameResult;
  /** Whose turn it is ('w' for white, 'b' for black) */
  turn: 'w' | 'b';
  /** Whether the current position is check */
  isCheck: boolean;

  // Actions
  /** Make a move (returns the move if legal, null if illegal) */
  makeMove: (move: { from: string; to: string; promotion?: string }) => ChessMove | null;
  /** Undo the last move (returns true if successful) */
  undo: () => boolean;
  /** Reset to starting position */
  reset: () => void;
  /** Load a position from FEN (returns true if valid) */
  loadFen: (fen: string) => boolean;

  // Utilities
  /** Get legal move destinations for a piece on a square */
  getLegalMoves: (square: string) => string[];
  /** Check if a move from one square to another is legal */
  isLegalMove: (from: string, to: string) => boolean;
}

/**
 * Convert chess.js Move to our ChessMove type.
 * Chess.js uses slightly different types; we cast to our interface.
 */
function toChessMove(move: Move): ChessMove {
  return {
    from: move.from,
    to: move.to,
    san: move.san,
    piece: move.piece,
    color: move.color,
    // Cast captured and promotion - chess.js types include 'k' but kings can't be captured
    captured: move.captured as ChessMove['captured'],
    promotion: move.promotion as ChessMove['promotion'],
    flags: move.flags,
  };
}

/**
 * Determine the game result from chess.js game state.
 */
function getGameResult(game: Chess): ChessGameResult {
  if (!game.isGameOver()) return null;
  if (game.isCheckmate()) return 'checkmate';
  if (game.isStalemate()) return 'stalemate';
  if (game.isDraw()) return 'draw';
  return null;
}

/**
 * Hook for managing a chess game using chess.js.
 *
 * @param options - Configuration options
 * @returns Game state and control functions
 *
 * @example
 * ```tsx
 * const { fen, makeMove, isGameOver, result } = useChessGame({
 *   playerColor: 'white',
 *   onGameOver: (result) => console.log('Game over:', result),
 *   onMove: (move) => console.log('Move:', move.san),
 * });
 *
 * // Make a move
 * const move = makeMove({ from: 'e2', to: 'e4' });
 * if (move) {
 *   console.log('Legal move:', move.san);
 * }
 * ```
 */
export function useChessGame(options: UseChessGameOptions = {}): UseChessGameReturn {
  const {
    initialFen = STARTING_FEN,
    // playerColor is available for components that need to know which side the human plays
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    playerColor: _playerColor = 'white',
    onGameOver,
    onMove,
  } = options;

  // Create Chess instance with useMemo (not useState to avoid serialization issues)
  // chess.js handles all game logic - this is the single source of truth
  const game = useMemo(() => new Chess(initialFen), [initialFen]);

  // React state derived from chess.js
  const [fen, setFen] = useState(game.fen());
  const [history, setHistory] = useState<ChessMove[]>([]);

  /**
   * Sync React state with chess.js state.
   * Always call this after any game mutation.
   */
  const syncState = useCallback(() => {
    setFen(game.fen());
    setHistory(game.history({ verbose: true }).map(toChessMove));
  }, [game]);

  /**
   * Check game over conditions and trigger callback.
   */
  const checkGameOver = useCallback(() => {
    if (game.isGameOver()) {
      const result = getGameResult(game);
      onGameOver?.(result);
    }
  }, [game, onGameOver]);

  /**
   * Make a move on the board.
   * Returns the move if legal, null if illegal.
   */
  const makeMove = useCallback((move: { from: string; to: string; promotion?: string }): ChessMove | null => {
    try {
      // Default to queen promotion if not specified (most common)
      const result = game.move({
        from: move.from,
        to: move.to,
        promotion: move.promotion || 'q',
      });

      if (result) {
        const chessMove = toChessMove(result);
        syncState();
        onMove?.(chessMove);
        checkGameOver();
        return chessMove;
      }
    } catch {
      // Invalid move - chess.js throws on illegal moves
      return null;
    }
    return null;
  }, [game, syncState, onMove, checkGameOver]);

  /**
   * Undo the last move.
   * Returns true if successful, false if no moves to undo.
   */
  const undo = useCallback((): boolean => {
    const result = game.undo();
    if (result) {
      syncState();
      return true;
    }
    return false;
  }, [game, syncState]);

  /**
   * Reset the game to starting position.
   */
  const reset = useCallback(() => {
    game.reset();
    syncState();
  }, [game, syncState]);

  /**
   * Load a position from FEN notation.
   * Returns true if valid FEN, false otherwise.
   */
  const loadFen = useCallback((newFen: string): boolean => {
    try {
      game.load(newFen);
      syncState();
      return true;
    } catch {
      // Invalid FEN
      return false;
    }
  }, [game, syncState]);

  /**
   * Get legal move destinations for a piece on a given square.
   */
  const getLegalMoves = useCallback((square: string): string[] => {
    const moves = game.moves({ square: square as any, verbose: true });
    return moves.map((m) => m.to);
  }, [game]);

  /**
   * Check if a move from one square to another is legal.
   */
  const isLegalMove = useCallback((from: string, to: string): boolean => {
    const legalDestinations = getLegalMoves(from);
    return legalDestinations.includes(to);
  }, [getLegalMoves]);

  // Derived state from chess.js (computed on each render)
  const isGameOver = game.isGameOver();
  const result = getGameResult(game);
  const turn = game.turn();
  const isCheck = game.isCheck();

  return {
    // State
    fen,
    history,
    isGameOver,
    result,
    turn,
    isCheck,

    // Actions
    makeMove,
    undo,
    reset,
    loadFen,

    // Utilities
    getLegalMoves,
    isLegalMove,
  };
}

export default useChessGame;
