/**
 * Lichess API client for puzzle fetching.
 *
 * Uses the public Lichess API:
 * - /api/puzzle/daily - Get daily puzzle
 * - /api/puzzle/{id} - Get puzzle by ID
 *
 * Rate limits: 1 request per second for anonymous, generous limits for authenticated.
 * We use anonymous access as puzzles are public and infrequent.
 *
 * @see https://lichess.org/api#tag/Puzzles
 */

import type { Puzzle, PuzzleTheme } from '../types/puzzle';

const LICHESS_API_BASE = 'https://lichess.org/api';

/**
 * Raw puzzle response from Lichess API.
 */
interface LichessPuzzleResponse {
  game: {
    id: string;
    perf: {
      key: string;
      name: string;
    };
    rated: boolean;
    players: Array<{
      userId: string;
      name: string;
      color: 'white' | 'black';
      rating: number;
    }>;
    pgn: string;
    clock: string;
  };
  puzzle: {
    id: string;
    rating: number;
    plays: number;
    initialPly: number;
    solution: string[];
    themes: string[];
  };
}

/**
 * Parse Lichess puzzle response to our Puzzle type.
 */
function parsePuzzleResponse(data: LichessPuzzleResponse): Puzzle {
  // The puzzle position is after the opponent's move (the setup)
  // We need to extract FEN from the game. Lichess provides the PGN,
  // but the puzzle API includes initialPly which indicates where the puzzle starts.
  // For simplicity, we'll use the puzzle endpoint which includes the FEN.

  // Note: The daily puzzle endpoint returns a slightly different format
  // where we need to parse the position. For the initial implementation,
  // we'll store the game ID and construct the puzzle URL.

  const themes = data.puzzle.themes.filter((t): t is PuzzleTheme =>
    isValidTheme(t)
  );

  return {
    id: data.puzzle.id,
    fen: '', // Will be set by the puzzle fetch endpoint
    moves: data.puzzle.solution,
    rating: data.puzzle.rating,
    ratingDeviation: 75, // Lichess doesn't expose this for individual puzzles
    plays: data.puzzle.plays,
    themes,
    url: `https://lichess.org/training/${data.puzzle.id}`,
    gameId: data.game.id,
  };
}

/**
 * Check if a theme string is a valid PuzzleTheme.
 */
function isValidTheme(theme: string): theme is PuzzleTheme {
  const validThemes: PuzzleTheme[] = [
    'mateIn1',
    'mateIn2',
    'mateIn3',
    'fork',
    'pin',
    'skewer',
    'discoveredAttack',
    'doubleCheck',
    'sacrifice',
    'deflection',
    'clearance',
    'interference',
    'zugzwang',
    'promotion',
    'underPromotion',
    'castling',
    'enPassant',
    'capturingDefender',
    'trappedPiece',
    'backRankMate',
    'smotheredMate',
    'anastasiasMate',
    'arabianMate',
    'bodensMate',
    'dovetailMate',
    'hookMate',
    'other',
  ];
  return validThemes.includes(theme as PuzzleTheme);
}

/**
 * Fetch the daily puzzle from Lichess.
 *
 * @returns The daily puzzle or null if fetch fails
 */
export async function fetchDailyPuzzle(): Promise<Puzzle | null> {
  try {
    const response = await fetch(`${LICHESS_API_BASE}/puzzle/daily`, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Lichess API error:', response.status, response.statusText);
      return null;
    }

    const data: LichessPuzzleResponse = await response.json();

    // Parse the puzzle
    const puzzle = parsePuzzleResponse(data);

    // For the daily puzzle, we need to get the FEN.
    // The API returns the game PGN, but we need to play through to the puzzle position.
    // Alternative: Fetch the puzzle by ID which includes the FEN directly.
    const fullPuzzle = await fetchPuzzleById(puzzle.id);
    if (fullPuzzle) {
      return fullPuzzle;
    }

    return puzzle;
  } catch (error) {
    console.error('Failed to fetch daily puzzle:', error);
    return null;
  }
}

/**
 * Fetch a specific puzzle by ID.
 *
 * @param id - Lichess puzzle ID
 * @returns The puzzle or null if fetch fails
 */
export async function fetchPuzzleById(id: string): Promise<Puzzle | null> {
  try {
    // The puzzle/:id endpoint returns more detailed info including FEN
    const response = await fetch(`${LICHESS_API_BASE}/puzzle/${id}`, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Lichess puzzle fetch error:', response.status);
      return null;
    }

    const data = await response.json();

    // The puzzle/:id endpoint has a slightly different structure
    // It includes the FEN directly in the response
    const themes = (data.puzzle?.themes || []).filter((t: string): t is PuzzleTheme =>
      isValidTheme(t)
    );

    return {
      id: data.puzzle?.id || id,
      fen: data.puzzle?.initialPly
        ? extractFenFromPgn(data.game?.pgn, data.puzzle?.initialPly)
        : data.game?.fen || '',
      moves: data.puzzle?.solution || [],
      rating: data.puzzle?.rating || 1500,
      ratingDeviation: 75,
      plays: data.puzzle?.plays || 0,
      themes,
      url: `https://lichess.org/training/${id}`,
      gameId: data.game?.id,
    };
  } catch (error) {
    console.error('Failed to fetch puzzle by ID:', error);
    return null;
  }
}

/**
 * Fetch random puzzles for the queue.
 * Uses the Lichess puzzle activity stream (limited functionality without auth).
 *
 * For now, we'll use a curated list of popular puzzle themes.
 *
 * @param count - Number of puzzles to fetch
 * @param minRating - Minimum puzzle rating
 * @param maxRating - Maximum puzzle rating
 * @returns Array of puzzles
 */
export async function fetchRandomPuzzles(
  count: number = 5,
  minRating: number = 1000,
  maxRating: number = 2000
): Promise<Puzzle[]> {
  // Lichess doesn't have a public "random puzzles" endpoint without authentication.
  // For the MVP, we'll fetch the daily puzzle and cache it.
  // Future: Implement OAuth for access to puzzle activity stream.

  const puzzles: Puzzle[] = [];

  // Try to get the daily puzzle first
  const daily = await fetchDailyPuzzle();
  if (daily && daily.rating >= minRating && daily.rating <= maxRating) {
    puzzles.push(daily);
  }

  // For now, return what we have. Future implementation can use:
  // - OAuth-authenticated puzzle activity stream
  // - Local puzzle database
  // - Pre-curated puzzle sets bundled with the app

  return puzzles.slice(0, count);
}

/**
 * Extract FEN from PGN at a specific ply.
 * This is a simplified implementation - chess.js could be used for full accuracy.
 *
 * @param pgn - Game PGN
 * @param initialPly - Move number where puzzle starts
 * @returns FEN string or empty string on failure
 */
function extractFenFromPgn(pgn: string | undefined, initialPly: number): string {
  // For now, return empty - the caller should use fetchPuzzleById
  // which gets the FEN directly. This is a fallback.
  if (!pgn || !initialPly) return '';

  // TODO: Use chess.js to parse PGN and get position at initialPly
  // For MVP, the API response should include the FEN directly

  return '';
}

/**
 * Generate progressive hints for a puzzle.
 *
 * @param puzzle - The puzzle
 * @param currentMoveIndex - Which move the player is on (0-indexed)
 * @returns Array of hints (level 1-3)
 */
export function generateHints(
  puzzle: Puzzle,
  currentMoveIndex: number
): Array<{ level: number; text: string; highlightSquare?: string }> {
  const correctMove = puzzle.moves[currentMoveIndex];
  if (!correctMove) return [];

  const from = correctMove.slice(0, 2);
  const to = correctMove.slice(2, 4);

  return [
    {
      level: 1,
      text: 'Look for a forcing move.',
    },
    {
      level: 2,
      text: `Consider moving a piece from the ${getSquareDescription(from)} area.`,
      highlightSquare: from,
    },
    {
      level: 3,
      text: `The move involves ${from} to ${to}.`,
      highlightSquare: to,
    },
  ];
}

/**
 * Get a human-readable description of a square.
 */
function getSquareDescription(square: string): string {
  const file = square[0];
  const rank = square[1];

  // Describe the area of the board
  const fileZone =
    file <= 'c' ? 'queenside' : file >= 'f' ? 'kingside' : 'center';
  const rankZone =
    rank <= '2'
      ? "white's back rank"
      : rank >= '7'
        ? "black's back rank"
        : 'middle';

  return `${fileZone} ${rankZone}`;
}

/**
 * Calculate rating change after a puzzle attempt.
 * Simplified Elo-like calculation.
 *
 * @param playerRating - Current player rating
 * @param puzzleRating - Puzzle difficulty rating
 * @param solved - Whether the puzzle was solved correctly
 * @param hintsUsed - Number of hints used (reduces rating gain)
 * @returns New rating and change amount
 */
export function calculateRatingChange(
  playerRating: number,
  puzzleRating: number,
  solved: boolean,
  hintsUsed: number = 0
): { newRating: number; change: number } {
  // K-factor (how much ratings can change per puzzle)
  const K = 32;

  // Expected score based on rating difference
  const expectedScore =
    1 / (1 + Math.pow(10, (puzzleRating - playerRating) / 400));

  // Actual score (1 for win, 0 for loss)
  // Reduce score based on hints used
  const hintPenalty = hintsUsed * 0.2; // 20% penalty per hint
  const actualScore = solved ? Math.max(0.2, 1 - hintPenalty) : 0;

  // Rating change
  const change = Math.round(K * (actualScore - expectedScore));
  const newRating = Math.max(100, playerRating + change); // Minimum rating of 100

  return { newRating, change };
}
