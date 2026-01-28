/**
 * Lichess API client for game import.
 *
 * Uses the public Lichess API:
 * - /api/games/user/{username} - Export games of a user
 *
 * Rate limits: Generous for public API, be respectful.
 *
 * @see https://lichess.org/api#tag/Games
 */

import { Chess } from 'chess.js';
import type {
  ArchivedGame,
  GamePlayer,
  GameResult,
  GameEndReason,
  ArchiveMove,
  TimeControl,
} from '../types/gameArchive';
import { categorizeTimeControl } from '../types/gameArchive';

const LICHESS_API_BASE = 'https://lichess.org/api';

/**
 * Lichess game from NDJSON export.
 */
interface LichessGame {
  id: string;
  rated: boolean;
  variant: string;
  speed: 'ultraBullet' | 'bullet' | 'blitz' | 'rapid' | 'classical' | 'correspondence';
  perf: string;
  createdAt: number;
  lastMoveAt: number;
  status: string;
  players: {
    white: {
      user?: { name: string; id: string };
      rating?: number;
      ratingDiff?: number;
      aiLevel?: number;
    };
    black: {
      user?: { name: string; id: string };
      rating?: number;
      ratingDiff?: number;
      aiLevel?: number;
    };
  };
  winner?: 'white' | 'black';
  moves?: string;
  pgn?: string;
  clock?: {
    initial: number;
    increment: number;
    totalTime: number;
  };
  opening?: {
    eco: string;
    name: string;
    ply: number;
  };
}

/**
 * Map Lichess status to end reason.
 */
function mapEndReason(status: string): GameEndReason {
  switch (status) {
    case 'mate':
      return 'checkmate';
    case 'resign':
      return 'resignation';
    case 'outoftime':
      return 'timeout';
    case 'stalemate':
      return 'stalemate';
    case 'draw':
      return 'agreement';
    case 'timeout':
      return 'timeout';
    case 'cheat':
    case 'noStart':
    case 'aborted':
      return 'abandoned';
    default:
      return 'unknown';
  }
}

/**
 * Parse Lichess moves string to ArchiveMove array.
 */
function parseLichessMoves(movesStr: string | undefined): ArchiveMove[] {
  if (!movesStr) return [];

  const moves: ArchiveMove[] = [];
  const chess = new Chess();

  // Lichess moves are space-separated SAN moves
  const moveTokens = movesStr.trim().split(/\s+/);

  let moveNumber = 1;
  for (const san of moveTokens) {
    if (!san) continue;

    try {
      const move = chess.move(san);
      if (move) {
        moves.push({
          san: move.san,
          uci: `${move.from}${move.to}${move.promotion || ''}`,
          fen: chess.fen(),
          moveNumber,
          color: move.color,
        });

        if (move.color === 'b') {
          moveNumber++;
        }
      }
    } catch {
      // Invalid move, skip
    }
  }

  return moves;
}

/**
 * Convert Lichess game to ArchivedGame.
 */
function convertGame(game: LichessGame, playerUsername: string): ArchivedGame | null {
  const isWhite =
    game.players.white.user?.name?.toLowerCase() === playerUsername.toLowerCase();

  const playerData = isWhite ? game.players.white : game.players.black;
  const opponentData = isWhite ? game.players.black : game.players.white;

  // Skip AI games or games without user info
  if (!playerData.user || !opponentData.user) {
    return null;
  }

  const playerColor = isWhite ? 'white' : 'black';

  const player: GamePlayer = {
    username: playerData.user.name,
    rating: playerData.rating,
    ratingChange: playerData.ratingDiff,
    color: playerColor,
  };

  const opponent: GamePlayer = {
    username: opponentData.user.name,
    rating: opponentData.rating,
    ratingChange: opponentData.ratingDiff,
    color: isWhite ? 'black' : 'white',
  };

  // Determine result
  let result: GameResult;
  if (!game.winner) {
    result = 'draw';
  } else if (game.winner === playerColor) {
    result = 'win';
  } else {
    result = 'loss';
  }

  const endReason = mapEndReason(game.status);

  // Time control
  const timeControl: TimeControl = game.clock
    ? {
        initial: game.clock.initial,
        increment: game.clock.increment,
        display: `${Math.floor(game.clock.initial / 60)}+${game.clock.increment}`,
      }
    : { initial: 0, increment: 0, display: '∞' };

  const category = categorizeTimeControl(timeControl);
  const moves = parseLichessMoves(game.moves);

  // Generate PGN if not provided
  const pgn =
    game.pgn ||
    moves.reduce((acc, move) => {
      if (move.color === 'w') {
        return acc + `${move.moveNumber}. ${move.san} `;
      } else {
        return acc + `${move.san} `;
      }
    }, '');

  return {
    id: game.id,
    source: 'lichess',
    sourceId: game.id,
    sourceUrl: `https://lichess.org/${game.id}`,
    player,
    opponent,
    result,
    endReason,
    timeControl,
    category,
    opening: game.opening?.name,
    eco: game.opening?.eco,
    moves,
    pgn,
    playedAt: new Date(game.createdAt).toISOString(),
    importedAt: new Date().toISOString(),
    isAnalyzed: false,
  };
}

/**
 * Parse NDJSON response.
 */
function parseNDJSON(text: string): LichessGame[] {
  return text
    .trim()
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => {
      try {
        return JSON.parse(line) as LichessGame;
      } catch {
        return null;
      }
    })
    .filter((g): g is LichessGame => g !== null);
}

/**
 * Fetch recent games for a Lichess user.
 *
 * @param username - Lichess username
 * @param limit - Maximum number of games to fetch (max 300 for API)
 * @returns Array of archived games
 */
export async function fetchLichessGames(
  username: string,
  limit: number = 50
): Promise<ArchivedGame[]> {
  try {
    const params = new URLSearchParams({
      max: String(Math.min(limit, 300)),
      moves: 'true',
      opening: 'true',
      rated: 'true',
      perfType:
        'ultraBullet,bullet,blitz,rapid,classical,correspondence',
    });

    const response = await fetch(
      `${LICHESS_API_BASE}/games/user/${username}?${params}`,
      {
        headers: {
          Accept: 'application/x-ndjson',
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`User "${username}" not found on Lichess`);
      }
      throw new Error(`Lichess API error: ${response.status}`);
    }

    const text = await response.text();
    const games = parseNDJSON(text);

    // Convert and filter valid games
    return games
      .map((g) => convertGame(g, username))
      .filter((g): g is ArchivedGame => g !== null && g.moves.length > 0);
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to fetch Lichess games');
  }
}

/**
 * Verify a Lichess username exists.
 *
 * @param username - Username to verify
 * @returns True if user exists
 */
export async function verifyLichessUser(username: string): Promise<boolean> {
  try {
    const response = await fetch(`${LICHESS_API_BASE}/user/${username}`, {
      headers: {
        Accept: 'application/json',
      },
    });

    return response.ok;
  } catch {
    return false;
  }
}
