/**
 * Chess feature types for Opta.
 *
 * These types support the chess integration with three modes:
 * Casual Play, Puzzles, and Analysis.
 *
 * Libraries used:
 * - chess.js: Game logic, move validation, FEN/PGN parsing
 * - react-chessboard: React board component with drag-and-drop
 * - stockfish: AI opponent via WebAssembly
 */

import type { BoardThemeId } from './boardTheme';

/**
 * Available chess game modes.
 * - casual: Relaxed games against AI, no time pressure
 * - puzzle: Tactical challenges from puzzle database
 * - analysis: Deep position analysis with engine evaluation
 */
export type ChessMode = 'casual' | 'puzzle' | 'analysis';

/**
 * Friendly AI difficulty names for user display.
 * Maps to Stockfish Skill Level internally.
 */
export type AIDifficulty = 'beginner' | 'casual' | 'intermediate' | 'advanced' | 'maximum';

/**
 * Mapping from friendly difficulty names to Stockfish Skill Level (0-20).
 * Based on research calibration:
 * - beginner (0-3): plays obvious blunders
 * - casual (4-8): club player level
 * - intermediate (9-13): strong amateur
 * - advanced (14-17): expert
 * - maximum (18-20): near-perfect play
 */
export const DIFFICULTY_TO_SKILL_LEVEL: Record<AIDifficulty, number> = {
  beginner: 2,
  casual: 6,
  intermediate: 11,
  advanced: 15,
  maximum: 20,
} as const;

/**
 * Configuration for the Stockfish AI opponent.
 */
export interface AIConfig {
  /** User-facing difficulty level */
  difficulty: AIDifficulty;
  /** Stockfish Skill Level (0-20), derived from difficulty */
  skillLevel: number;
  /** AI thinking time in milliseconds */
  thinkTimeMs: number;
}

/**
 * A chess move with full details.
 * Matches the chess.js Move type structure.
 */
export interface ChessMove {
  /** Source square (e.g., 'e2') */
  from: string;
  /** Target square (e.g., 'e4') */
  to: string;
  /** Standard Algebraic Notation (e.g., 'e4', 'Nf3', 'O-O') */
  san: string;
  /** Piece type that moved */
  piece: 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
  /** Color of the piece */
  color: 'w' | 'b';
  /** Piece type captured (if any) */
  captured?: 'p' | 'n' | 'b' | 'r' | 'q';
  /** Piece type promoted to (if pawn promotion) */
  promotion?: 'n' | 'b' | 'r' | 'q';
  /** Move flags (n=normal, b=pawn push, e=en passant, c=capture, p=promotion, k=kingside castle, q=queenside castle) */
  flags?: string;
}

/**
 * Game result type.
 */
export type ChessGameResult = 'checkmate' | 'stalemate' | 'draw' | 'resignation' | null;

/**
 * Current state of a chess game.
 */
export interface ChessGameState {
  /** Current board position in FEN notation */
  fen: string;
  /** Move history with full move details */
  history: ChessMove[];
  /** Whether the game has ended */
  isGameOver: boolean;
  /** Result of the game (if over) */
  result: ChessGameResult;
  /** Color the player is playing as */
  playerColor: 'white' | 'black';
  /** Whose turn it is ('w' for white, 'b' for black) */
  turn: 'w' | 'b';
}

/**
 * Chess sound settings for granular control
 */
export interface ChessSoundSettings {
  /** Enable all chess sounds */
  enabled: boolean;
  /** Move sound (piece placement) */
  moveSound: boolean;
  /** Capture sound (piece taken) */
  captureSound: boolean;
  /** Check sound (king in check) */
  checkSound: boolean;
  /** Game over sound (checkmate/stalemate/draw) */
  gameOverSound: boolean;
  /** Volume level (0-1) */
  volume: number;
}

/**
 * User settings for the chess feature.
 */
export interface ChessSettings {
  /** Current game mode */
  mode: ChessMode;
  /** AI opponent configuration */
  aiConfig: AIConfig;
  /** Whether to show move hints */
  showHints: boolean;
  /** Whether to show move history panel */
  showMoveHistory: boolean;
  /** Board orientation from player's perspective */
  boardOrientation: 'white' | 'black';
  /** Whether to auto-save games */
  autoSave: boolean;
  /** Board theme ID (obsidian, wood, marble, glass) */
  boardTheme: BoardThemeId;
  /** Whether to show board coordinates */
  showCoordinates: boolean;
  /** Whether to show board lighting effects */
  showLighting: boolean;
  /** Sound settings */
  sound: ChessSoundSettings;
}

/**
 * Default AI configuration for new games.
 */
export const DEFAULT_AI_CONFIG: AIConfig = {
  difficulty: 'casual',
  skillLevel: DIFFICULTY_TO_SKILL_LEVEL.casual,
  thinkTimeMs: 1000,
} as const;

/**
 * Default chess sound settings
 */
export const DEFAULT_CHESS_SOUND_SETTINGS: ChessSoundSettings = {
  enabled: true,
  moveSound: true,
  captureSound: true,
  checkSound: true,
  gameOverSound: true,
  volume: 0.6,
};

/**
 * Default chess settings for new users.
 */
export const DEFAULT_CHESS_SETTINGS: ChessSettings = {
  mode: 'casual',
  aiConfig: DEFAULT_AI_CONFIG,
  showHints: false,
  showMoveHistory: true,
  boardOrientation: 'white',
  autoSave: true,
  boardTheme: 'obsidian',
  showCoordinates: true,
  showLighting: true,
  sound: DEFAULT_CHESS_SOUND_SETTINGS,
};

/**
 * Starting FEN for a standard chess game.
 */
export const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/**
 * Create an initial game state.
 */
export function createInitialGameState(playerColor: 'white' | 'black' = 'white'): ChessGameState {
  return {
    fen: STARTING_FEN,
    history: [],
    isGameOver: false,
    result: null,
    playerColor,
    turn: 'w',
  };
}

/**
 * Create AI config from difficulty level.
 */
export function createAIConfig(
  difficulty: AIDifficulty,
  thinkTimeMs: number = 1000
): AIConfig {
  return {
    difficulty,
    skillLevel: DIFFICULTY_TO_SKILL_LEVEL[difficulty],
    thinkTimeMs,
  };
}
