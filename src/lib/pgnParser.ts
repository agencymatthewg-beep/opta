/**
 * PGN file parser for game import.
 *
 * Parses PGN files (single or multi-game) into ArchivedGame format.
 * Uses chess.js for move validation and position tracking.
 *
 * Supports:
 * - Standard PGN format
 * - Multiple games per file
 * - Clock annotations
 * - Comments and variations (stripped)
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

/**
 * PGN header tags.
 */
interface PGNHeaders {
  Event?: string;
  Site?: string;
  Date?: string;
  Round?: string;
  White?: string;
  Black?: string;
  Result?: string;
  WhiteElo?: string;
  BlackElo?: string;
  TimeControl?: string;
  ECO?: string;
  Opening?: string;
  FEN?: string;
  SetUp?: string;
  UTCDate?: string;
  UTCTime?: string;
  Link?: string;
  [key: string]: string | undefined;
}

/**
 * Parse PGN headers from header block.
 */
function parseHeaders(headerBlock: string): PGNHeaders {
  const headers: PGNHeaders = {};
  const headerRegex = /\[(\w+)\s+"([^"]*)"\]/g;
  let match;

  while ((match = headerRegex.exec(headerBlock)) !== null) {
    headers[match[1]] = match[2];
  }

  return headers;
}

/**
 * Parse result string to GameResult.
 */
function parseResult(result: string | undefined, playerColor: 'white' | 'black'): GameResult {
  if (!result || result === '*') {
    return 'draw'; // Unknown = assume draw
  }

  if (result === '1/2-1/2') {
    return 'draw';
  }

  const whiteWins = result === '1-0';
  const playerIsWhite = playerColor === 'white';

  if (whiteWins) {
    return playerIsWhite ? 'win' : 'loss';
  } else {
    return playerIsWhite ? 'loss' : 'win';
  }
}

/**
 * Parse time control string.
 * Formats: "600", "600+5", "300+3", "1/0" (correspondence), "-" (unknown)
 */
function parseTimeControlString(tc: string | undefined): TimeControl {
  if (!tc || tc === '-') {
    return { initial: 0, increment: 0, display: '∞' };
  }

  // Handle formats like "600+5" or "300"
  const plusMatch = tc.match(/^(\d+)\+(\d+)$/);
  if (plusMatch) {
    const initial = parseInt(plusMatch[1], 10);
    const increment = parseInt(plusMatch[2], 10);
    const minutes = Math.floor(initial / 60);
    return {
      initial,
      increment,
      display: `${minutes}+${increment}`,
    };
  }

  // Handle plain seconds "600"
  const plainMatch = tc.match(/^(\d+)$/);
  if (plainMatch) {
    const initial = parseInt(plainMatch[1], 10);
    const minutes = Math.floor(initial / 60);
    return {
      initial,
      increment: 0,
      display: `${minutes}`,
    };
  }

  // Handle correspondence "1/0" or similar
  return { initial: 0, increment: 0, display: tc };
}

/**
 * Extract and parse moves from PGN move text.
 */
function parseMoves(moveText: string, startFen?: string): ArchiveMove[] {
  const moves: ArchiveMove[] = [];

  try {
    const chess = new Chess(startFen);

    // Clean move text: remove comments, variations, and results
    const cleanedText = moveText
      .replace(/\{[^}]*\}/g, '') // Remove { comments }
      .replace(/\([^)]*\)/g, '') // Remove ( variations )
      .replace(/\$\d+/g, '') // Remove NAG annotations
      .replace(/1-0|0-1|1\/2-1\/2|\*/g, '') // Remove results
      .replace(/\d+\.{3}/g, '') // Remove "..." after move numbers
      .trim();

    // Split into tokens
    const tokens = cleanedText.split(/\s+/).filter((t) => t.length > 0);

    let moveNumber = 1;
    for (const token of tokens) {
      // Skip move numbers (1., 2., etc.)
      if (token.match(/^\d+\.?$/)) {
        const num = parseInt(token.replace('.', ''), 10);
        if (!isNaN(num)) moveNumber = num;
        continue;
      }

      // Check for clock annotation embedded in token
      const clockMatch = token.match(/\[%clk\s+(\d+:\d+:\d+(?:\.\d+)?)\]/);
      const sanMove = token.replace(/\[%clk[^\]]+\]/g, '').trim();

      if (!sanMove || sanMove.match(/^[\d.]+$/)) continue;

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
            const parts = clockMatch[1].split(':').map(parseFloat);
            archiveMove.clock = parts[0] * 3600 + parts[1] * 60 + parts[2];
          }

          moves.push(archiveMove);

          if (move.color === 'b') {
            moveNumber++;
          }
        }
      } catch {
        // Invalid move, skip
        console.warn('Invalid PGN move:', sanMove);
      }
    }
  } catch (error) {
    console.error('Failed to parse PGN moves:', error);
  }

  return moves;
}

/**
 * Infer end reason from game result and moves.
 */
function inferEndReason(
  result: string | undefined,
  moves: ArchiveMove[]
): GameEndReason {
  if (!result || result === '*') {
    return 'unknown';
  }

  if (result === '1/2-1/2') {
    // Check if last position is stalemate
    const lastFen = moves[moves.length - 1]?.fen;
    if (lastFen) {
      try {
        const chess = new Chess(lastFen);
        if (chess.isStalemate()) return 'stalemate';
        if (chess.isDraw()) return 'repetition'; // Could be 50move or repetition
      } catch {
        // Ignore
      }
    }
    return 'agreement';
  }

  // Check for checkmate
  const lastFen = moves[moves.length - 1]?.fen;
  if (lastFen) {
    try {
      const chess = new Chess(lastFen);
      if (chess.isCheckmate()) return 'checkmate';
    } catch {
      // Ignore
    }
  }

  // Default to resignation for decisive games
  return 'resignation';
}

/**
 * Parse a single PGN game string.
 *
 * @param pgnText - PGN text for a single game
 * @param playerUsername - Username to determine player perspective
 * @returns Archived game or null if invalid
 */
export function parseSinglePGN(
  pgnText: string,
  playerUsername?: string
): ArchivedGame | null {
  try {
    // Split into headers and moves
    const headerEndIndex = pgnText.lastIndexOf(']');
    if (headerEndIndex === -1) return null;

    const headerBlock = pgnText.slice(0, headerEndIndex + 1);
    const moveText = pgnText.slice(headerEndIndex + 1).trim();

    const headers = parseHeaders(headerBlock);

    // Determine player color
    const whiteUsername = headers.White || 'White';
    const blackUsername = headers.Black || 'Black';
    const isWhite = playerUsername
      ? whiteUsername.toLowerCase() === playerUsername.toLowerCase()
      : true; // Default to white perspective
    const playerColor = isWhite ? 'white' : 'black';

    // Parse start FEN if custom position
    const startFen =
      headers.SetUp === '1' && headers.FEN ? headers.FEN : undefined;

    // Parse moves
    const moves = parseMoves(moveText, startFen);
    if (moves.length === 0) return null;

    // Create player info
    const player: GamePlayer = {
      username: isWhite ? whiteUsername : blackUsername,
      rating: isWhite
        ? headers.WhiteElo
          ? parseInt(headers.WhiteElo, 10)
          : undefined
        : headers.BlackElo
          ? parseInt(headers.BlackElo, 10)
          : undefined,
      color: playerColor,
    };

    const opponent: GamePlayer = {
      username: isWhite ? blackUsername : whiteUsername,
      rating: isWhite
        ? headers.BlackElo
          ? parseInt(headers.BlackElo, 10)
          : undefined
        : headers.WhiteElo
          ? parseInt(headers.WhiteElo, 10)
          : undefined,
      color: isWhite ? 'black' : 'white',
    };

    const result = parseResult(headers.Result, playerColor);
    const endReason = inferEndReason(headers.Result, moves);
    const timeControl = parseTimeControlString(headers.TimeControl);
    const category = categorizeTimeControl(timeControl);

    // Parse date
    let playedAt: string;
    if (headers.UTCDate && headers.UTCTime) {
      playedAt = new Date(`${headers.UTCDate.replace(/\./g, '-')}T${headers.UTCTime}Z`).toISOString();
    } else if (headers.Date) {
      playedAt = new Date(headers.Date.replace(/\./g, '-')).toISOString();
    } else {
      playedAt = new Date().toISOString();
    }

    // Generate unique ID
    const id = `pgn_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    return {
      id,
      source: 'pgn',
      sourceUrl: headers.Link || headers.Site,
      player,
      opponent,
      result,
      endReason,
      timeControl,
      category,
      opening: headers.Opening,
      eco: headers.ECO,
      moves,
      pgn: pgnText,
      startFen,
      playedAt,
      importedAt: new Date().toISOString(),
      isAnalyzed: false,
    };
  } catch (error) {
    console.error('Failed to parse PGN:', error);
    return null;
  }
}

/**
 * Split multi-game PGN file into individual games.
 *
 * @param pgnFile - Full PGN file content
 * @returns Array of individual PGN strings
 */
export function splitPGNFile(pgnFile: string): string[] {
  const games: string[] = [];
  const lines = pgnFile.split('\n');

  let currentGame: string[] = [];
  let inMoveSection = false;

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Empty line after moves = end of game
    if (trimmedLine === '' && inMoveSection) {
      if (currentGame.length > 0) {
        games.push(currentGame.join('\n'));
        currentGame = [];
        inMoveSection = false;
      }
      continue;
    }

    // Start of new game (header line after empty)
    if (trimmedLine.startsWith('[') && !inMoveSection) {
      currentGame.push(line);
      continue;
    }

    // Move section
    if (!trimmedLine.startsWith('[') && trimmedLine.length > 0) {
      inMoveSection = true;
    }

    if (currentGame.length > 0 || trimmedLine.length > 0) {
      currentGame.push(line);
    }
  }

  // Don't forget the last game
  if (currentGame.length > 0) {
    games.push(currentGame.join('\n'));
  }

  return games.filter((g) => g.trim().length > 0);
}

/**
 * Parse a PGN file (single or multi-game).
 *
 * @param pgnContent - Full PGN file content
 * @param playerUsername - Username to determine player perspective
 * @returns Array of archived games
 */
export function parsePGNFile(
  pgnContent: string,
  playerUsername?: string
): ArchivedGame[] {
  const pgnStrings = splitPGNFile(pgnContent);

  return pgnStrings
    .map((pgn) => parseSinglePGN(pgn, playerUsername))
    .filter((g): g is ArchivedGame => g !== null);
}

/**
 * Validate PGN content.
 *
 * @param pgnContent - PGN string to validate
 * @returns True if valid PGN
 */
export function isValidPGN(pgnContent: string): boolean {
  // Must have at least one header tag
  if (!pgnContent.match(/\[\w+\s+"[^"]*"\]/)) {
    return false;
  }

  // Must have some move content
  const headerEndIndex = pgnContent.lastIndexOf(']');
  const moveContent = pgnContent.slice(headerEndIndex + 1).trim();

  // Check for any move-like content (move numbers or piece moves)
  return moveContent.length > 0 && !!moveContent.match(/[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8]/);
}
