/**
 * Chess.com API client for game import.
 *
 * Uses the public Chess.com API:
 * - /pub/player/{username}/games/archives - List of monthly game archives
 * - /pub/player/{username}/games/{year}/{month} - Games for a specific month
 *
 * Rate limits: Be respectful, use appropriate delays between requests.
 *
 * @see https://www.chess.com/news/view/published-data-api
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
import { parseTimeControl, categorizeTimeControl } from '../types/gameArchive';

const CHESSCOM_API_BASE = 'https://api.chess.com/pub';

/**
 * Chess.com game response from API.
 */
interface ChessComGame {
  url: string;
  pgn: string;
  time_control: string;
  end_time: number;
  rated: boolean;
  accuracies?: {
    white: number;
    black: number;
  };
  tcn?: string;
  uuid: string;
  initial_setup?: string;
  fen?: string;
  time_class: 'bullet' | 'blitz' | 'rapid' | 'daily';
  rules: string;
  white: {
    rating: number;
    result: string;
    '@id': string;
    username: string;
    uuid: string;
  };
  black: {
    rating: number;
    result: string;
    '@id': string;
    username: string;
    uuid: string;
  };
}

/**
 * Archive list response.
 */
interface ArchivesResponse {
  archives: string[];
}

/**
 * Games response for a month.
 */
interface MonthGamesResponse {
  games: ChessComGame[];
}

/**
 * Map Chess.com result to our game result.
 */
function mapResult(chessComResult: string, isPlayer: boolean): GameResult {
  const winResults = ['win'];
  const drawResults = [
    'agreed',
    'repetition',
    'stalemate',
    'insufficient',
    '50move',
    'timevsinsufficient',
  ];

  if (winResults.includes(chessComResult)) {
    return isPlayer ? 'win' : 'loss';
  }
  if (drawResults.includes(chessComResult)) {
    return 'draw';
  }
  // Loss results: checkmated, timeout, resigned, abandoned
  return isPlayer ? 'loss' : 'win';
}

/**
 * Map Chess.com result to end reason.
 */
function mapEndReason(whiteResult: string, blackResult: string): GameEndReason {
  const results = [whiteResult, blackResult];

  if (results.includes('checkmated')) return 'checkmate';
  if (results.includes('resigned')) return 'resignation';
  if (results.includes('timeout')) return 'timeout';
  if (results.includes('stalemate')) return 'stalemate';
  if (results.includes('insufficient')) return 'insufficient';
  if (results.includes('repetition')) return 'repetition';
  if (results.includes('agreed')) return 'agreement';
  if (results.includes('50move')) return '50move';
  if (results.includes('abandoned')) return 'abandoned';

  return 'unknown';
}

/**
 * Extract opening from PGN headers.
 */
function extractOpening(pgn: string): { name?: string; eco?: string } {
  const ecoMatch = pgn.match(/\[ECO "([^"]+)"\]/);
  const openingMatch = pgn.match(/\[Opening "([^"]+)"\]/);

  return {
    eco: ecoMatch?.[1],
    name: openingMatch?.[1],
  };
}

/**
 * Parse PGN moves to ArchiveMove array.
 */
function parseMoves(pgn: string, startFen?: string): ArchiveMove[] {
  const moves: ArchiveMove[] = [];

  try {
    const chess = new Chess(startFen);

    // Extract moves from PGN (remove headers and comments)
    const moveText = pgn
      .replace(/\[.*?\]/g, '')
      .replace(/\{[^}]*\}/g, '')
      .replace(/\([^)]*\)/g, '')
      .replace(/\d+\.\.\./g, '')
      .replace(/1-0|0-1|1\/2-1\/2|\*/g, '')
      .trim();

    // Split into individual moves
    const moveTokens = moveText
      .split(/\s+/)
      .filter((t) => t && !t.match(/^\d+\.$/));

    let moveNumber = 1;
    for (const token of moveTokens) {
      // Skip move numbers
      if (token.match(/^\d+\.?$/)) {
        const num = parseInt(token.replace('.', ''), 10);
        if (!isNaN(num)) moveNumber = num;
        continue;
      }

      // Extract clock time if present
      const clockMatch = token.match(/\{?\[%clk (\d+:\d+:\d+(?:\.\d+)?)\]\}?/);
      const sanMove = token.replace(/\{?\[%clk[^\]]+\]\}?/g, '').trim();

      if (!sanMove) continue;

      try {
        const move = chess.move(sanMove);
        if (move) {
          const archiveMove: ArchiveMove = {
            san: move.san,
            uci: `${move.from}${move.to}${move.promotion || ''}`,
            fen: chess.fen(),
            moveNumber,
            color: move.color,
          };

          if (clockMatch) {
            const [hours, minutes, seconds] = clockMatch[1].split(':').map(parseFloat);
            archiveMove.clock = hours * 3600 + minutes * 60 + seconds;
          }

          moves.push(archiveMove);

          if (move.color === 'b') {
            moveNumber++;
          }
        }
      } catch {
        // Invalid move, skip
      }
    }
  } catch (error) {
    console.error('Failed to parse PGN moves:', error);
  }

  return moves;
}

/**
 * Convert Chess.com game to ArchivedGame.
 */
function convertGame(game: ChessComGame, playerUsername: string): ArchivedGame {
  const isWhite = game.white.username.toLowerCase() === playerUsername.toLowerCase();
  const playerData = isWhite ? game.white : game.black;
  const opponentData = isWhite ? game.black : game.white;

  const player: GamePlayer = {
    username: playerData.username,
    rating: playerData.rating,
    color: isWhite ? 'white' : 'black',
  };

  const opponent: GamePlayer = {
    username: opponentData.username,
    rating: opponentData.rating,
    color: isWhite ? 'black' : 'white',
  };

  const result = mapResult(playerData.result, true);
  const endReason = mapEndReason(game.white.result, game.black.result);
  const timeControl: TimeControl = parseTimeControl(game.time_control);
  const category = categorizeTimeControl(timeControl);
  const { name: opening, eco } = extractOpening(game.pgn);
  const moves = parseMoves(game.pgn, game.initial_setup);

  return {
    id: game.uuid,
    source: 'chess.com',
    sourceId: game.uuid,
    sourceUrl: game.url,
    player,
    opponent,
    result,
    endReason,
    timeControl,
    category,
    opening,
    eco,
    moves,
    pgn: game.pgn,
    startFen: game.initial_setup,
    playedAt: new Date(game.end_time * 1000).toISOString(),
    importedAt: new Date().toISOString(),
    isAnalyzed: false,
  };
}

/**
 * Fetch game archives list for a user.
 *
 * @param username - Chess.com username
 * @returns Array of archive URLs
 */
export async function fetchArchivesList(username: string): Promise<string[]> {
  try {
    const response = await fetch(`${CHESSCOM_API_BASE}/player/${username}/games/archives`, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`User "${username}" not found on Chess.com`);
      }
      throw new Error(`Chess.com API error: ${response.status}`);
    }

    const data: ArchivesResponse = await response.json();
    return data.archives || [];
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to fetch Chess.com archives');
  }
}

/**
 * Fetch games from a specific monthly archive.
 *
 * @param archiveUrl - Full archive URL from archives list
 * @param playerUsername - Username for result perspective
 * @returns Array of archived games
 */
export async function fetchMonthGames(
  archiveUrl: string,
  playerUsername: string
): Promise<ArchivedGame[]> {
  try {
    const response = await fetch(archiveUrl, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Chess.com API error: ${response.status}`);
    }

    const data: MonthGamesResponse = await response.json();

    // Convert and filter out non-standard games (variants, etc.)
    return (data.games || [])
      .filter((g) => g.rules === 'chess')
      .map((g) => convertGame(g, playerUsername));
  } catch (error) {
    console.error('Failed to fetch month games:', error);
    return [];
  }
}

/**
 * Fetch recent games for a user.
 *
 * @param username - Chess.com username
 * @param limit - Maximum number of games to fetch
 * @returns Array of archived games
 */
export async function fetchRecentGames(
  username: string,
  limit: number = 50
): Promise<ArchivedGame[]> {
  try {
    // Get archives list
    const archives = await fetchArchivesList(username);

    if (archives.length === 0) {
      return [];
    }

    // Fetch from most recent archives until we have enough games
    const games: ArchivedGame[] = [];

    // Start from most recent (last in array)
    for (let i = archives.length - 1; i >= 0 && games.length < limit; i--) {
      const monthGames = await fetchMonthGames(archives[i], username);
      games.push(...monthGames);

      // Small delay to be respectful to API
      if (i > 0 && games.length < limit) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    // Sort by date (most recent first) and limit
    return games
      .sort((a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime())
      .slice(0, limit);
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to fetch Chess.com games');
  }
}

/**
 * Verify a Chess.com username exists.
 *
 * @param username - Username to verify
 * @returns True if user exists
 */
export async function verifyUser(username: string): Promise<boolean> {
  try {
    const response = await fetch(`${CHESSCOM_API_BASE}/player/${username}`, {
      headers: {
        Accept: 'application/json',
      },
    });

    return response.ok;
  } catch {
    return false;
  }
}
