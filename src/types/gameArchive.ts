/**
 * Game archive types for Opta Chess.
 *
 * Supports game import from:
 * - Chess.com API
 * - Lichess API
 * - PGN file upload
 *
 * Features:
 * - Unified game format for all sources
 * - Move-by-move review with annotations
 * - Local storage for game archives
 */

/**
 * Source platform for imported games.
 */
export type GameSource = 'chess.com' | 'lichess' | 'pgn';

/**
 * Game result from the player's perspective.
 */
export type GameResult = 'win' | 'loss' | 'draw';

/**
 * Detailed result type.
 */
export type GameEndReason =
  | 'checkmate'
  | 'resignation'
  | 'timeout'
  | 'stalemate'
  | 'insufficient'
  | 'repetition'
  | 'agreement'
  | '50move'
  | 'abandoned'
  | 'unknown';

/**
 * Time control format.
 */
export interface TimeControl {
  /** Initial time in seconds */
  initial: number;
  /** Increment per move in seconds */
  increment: number;
  /** Display name (e.g., "10+0", "3+2") */
  display: string;
}

/**
 * Time control category.
 */
export type TimeControlCategory = 'bullet' | 'blitz' | 'rapid' | 'classical' | 'correspondence';

/**
 * Player information.
 */
export interface GamePlayer {
  /** Username on the platform */
  username: string;
  /** Rating at game time */
  rating?: number;
  /** Rating change after game */
  ratingChange?: number;
  /** Color played */
  color: 'white' | 'black';
}

/**
 * A single move with optional analysis.
 */
export interface ArchiveMove {
  /** Move in SAN notation (e.g., "e4", "Nf3") */
  san: string;
  /** Move in UCI notation (e.g., "e2e4") */
  uci: string;
  /** FEN after this move */
  fen: string;
  /** Move number (1-indexed) */
  moveNumber: number;
  /** Which side made the move */
  color: 'w' | 'b';
  /** Time remaining after move (if available) */
  clock?: number;
  /** Engine evaluation (if analyzed) */
  evaluation?: number;
  /** Move classification */
  classification?: MoveClassification;
  /** Comment/annotation */
  comment?: string;
}

/**
 * Move quality classification.
 */
export type MoveClassification =
  | 'brilliant'
  | 'great'
  | 'best'
  | 'excellent'
  | 'good'
  | 'book'
  | 'inaccuracy'
  | 'mistake'
  | 'blunder'
  | 'missed_win';

/**
 * An imported chess game.
 */
export interface ArchivedGame {
  /** Unique identifier (platform ID or generated) */
  id: string;
  /** Source platform */
  source: GameSource;
  /** Platform-specific game ID */
  sourceId?: string;
  /** URL to view on original platform */
  sourceUrl?: string;
  /** Player info */
  player: GamePlayer;
  /** Opponent info */
  opponent: GamePlayer;
  /** Game result from player's perspective */
  result: GameResult;
  /** How the game ended */
  endReason: GameEndReason;
  /** Time control */
  timeControl: TimeControl;
  /** Time control category */
  category: TimeControlCategory;
  /** Opening name (if detected) */
  opening?: string;
  /** Opening ECO code */
  eco?: string;
  /** Moves with analysis */
  moves: ArchiveMove[];
  /** Full PGN text */
  pgn: string;
  /** Starting FEN (if not standard) */
  startFen?: string;
  /** When the game was played */
  playedAt: string;
  /** When the game was imported */
  importedAt: string;
  /** Whether game has been analyzed */
  isAnalyzed: boolean;
}

/**
 * Game archive state.
 */
export interface GameArchiveState {
  /** All imported games */
  games: ArchivedGame[];
  /** Last sync timestamp per platform */
  lastSync: Record<GameSource, number | null>;
  /** Import in progress */
  isImporting: boolean;
  /** Import error */
  error: string | null;
  /** Connected usernames per platform */
  connectedAccounts: Record<GameSource, string | null>;
}

/**
 * Game filter options.
 */
export interface GameFilter {
  /** Filter by result */
  result?: GameResult;
  /** Filter by time control category */
  category?: TimeControlCategory;
  /** Filter by source platform */
  source?: GameSource;
  /** Filter by opponent username (partial match) */
  opponent?: string;
  /** Filter by date range */
  dateFrom?: string;
  dateTo?: string;
  /** Filter by opening (partial match) */
  opening?: string;
}

/**
 * Game sort options.
 */
export interface GameSort {
  /** Sort field */
  field: 'playedAt' | 'rating' | 'opponent';
  /** Sort direction */
  direction: 'asc' | 'desc';
}

/**
 * Default game archive state.
 */
export const DEFAULT_GAME_ARCHIVE_STATE: GameArchiveState = {
  games: [],
  lastSync: {
    'chess.com': null,
    lichess: null,
    pgn: null,
  },
  isImporting: false,
  error: null,
  connectedAccounts: {
    'chess.com': null,
    lichess: null,
    pgn: null,
  },
};

/**
 * Parse time control string to TimeControl object.
 * Handles formats like "600", "600+5", "180+2".
 */
export function parseTimeControl(timeControl: string): TimeControl {
  const parts = timeControl.split('+');
  const initial = parseInt(parts[0], 10) || 0;
  const increment = parts[1] ? parseInt(parts[1], 10) : 0;

  const initialMinutes = Math.floor(initial / 60);
  const display = increment > 0 ? `${initialMinutes}+${increment}` : `${initialMinutes}`;

  return { initial, increment, display };
}

/**
 * Determine time control category from time control.
 */
export function categorizeTimeControl(tc: TimeControl): TimeControlCategory {
  // Estimated game duration = initial + 40 * increment (avg 40 moves)
  const estimatedSeconds = tc.initial + 40 * tc.increment;

  if (estimatedSeconds < 180) return 'bullet';
  if (estimatedSeconds < 600) return 'blitz';
  if (estimatedSeconds < 1800) return 'rapid';
  if (estimatedSeconds < 86400) return 'classical';
  return 'correspondence';
}

/**
 * Get display color for time control category.
 */
export function getCategoryColor(category: TimeControlCategory): string {
  switch (category) {
    case 'bullet':
      return 'text-warning';
    case 'blitz':
      return 'text-primary';
    case 'rapid':
      return 'text-success';
    case 'classical':
      return 'text-accent';
    case 'correspondence':
      return 'text-muted-foreground';
  }
}

/**
 * Get display icon name for time control category.
 */
export function getCategoryIcon(category: TimeControlCategory): string {
  switch (category) {
    case 'bullet':
      return 'Zap';
    case 'blitz':
      return 'Timer';
    case 'rapid':
      return 'Clock';
    case 'classical':
      return 'Hourglass';
    case 'correspondence':
      return 'Mail';
  }
}
