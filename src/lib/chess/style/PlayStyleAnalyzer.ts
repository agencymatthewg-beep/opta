/**
 * PlayStyleAnalyzer - Analyzes user's chess games to create a style fingerprint.
 *
 * Examines game history to determine:
 * - Aggression level (pawn advances, piece exchanges, king safety)
 * - Positional vs tactical preference
 * - Opening repertoire and preparation depth
 * - Endgame skill and conversion rate
 * - Time pressure performance
 *
 * Uses heuristics rather than engine analysis for speed.
 */

import type { ArchivedGame, ArchiveMove, MoveClassification } from '@/types/gameArchive';
import type {
  PlayStyleAnalysis,
  PlayStyleMetrics,
  PhaseMetrics,
  OpeningStats,
} from './types';
import { DEFAULT_PLAY_STYLE } from './types';

/**
 * Minimum games needed for reliable analysis.
 */
const MIN_GAMES_MEDIUM_CONFIDENCE = 20;
const MIN_GAMES_HIGH_CONFIDENCE = 50;

/**
 * Move number boundaries for game phases.
 */
const OPENING_END = 15;
const MIDDLEGAME_END = 35;

/**
 * Classification scores for move quality.
 */
const CLASSIFICATION_SCORES: Record<MoveClassification, number> = {
  brilliant: 100,
  great: 95,
  best: 90,
  excellent: 85,
  good: 75,
  book: 80,
  inaccuracy: 50,
  mistake: 30,
  blunder: 10,
  missed_win: 20,
};

/**
 * Analyze a set of games to produce a play style fingerprint.
 */
export function analyzePlayStyle(games: ArchivedGame[]): PlayStyleAnalysis {
  if (games.length === 0) {
    return createEmptyAnalysis();
  }

  // Filter to analyzed games with moves
  const validGames = games.filter((g) => g.moves.length > 0);

  if (validGames.length === 0) {
    return createEmptyAnalysis();
  }

  // Calculate all metrics
  const metrics = calculateStyleMetrics(validGames);
  const phases = calculatePhaseMetrics(validGames);
  const topOpeningsWhite = calculateOpeningStats(validGames, 'white');
  const topOpeningsBlack = calculateOpeningStats(validGames, 'black');
  const overallAccuracy = calculateOverallAccuracy(validGames);

  // Determine confidence level
  const confidence =
    validGames.length >= MIN_GAMES_HIGH_CONFIDENCE
      ? 'high'
      : validGames.length >= MIN_GAMES_MEDIUM_CONFIDENCE
        ? 'medium'
        : 'low';

  return {
    metrics,
    phases,
    topOpeningsWhite,
    topOpeningsBlack,
    overallAccuracy,
    gamesAnalyzed: validGames.length,
    updatedAt: new Date().toISOString(),
    confidence,
  };
}

/**
 * Create an empty analysis for users with no games.
 */
function createEmptyAnalysis(): PlayStyleAnalysis {
  return {
    metrics: { ...DEFAULT_PLAY_STYLE },
    phases: {
      opening: { avgCPL: 0, bookDepth: 0, accuracy: 50 },
      middlegame: { avgCPL: 0, tacticalAccuracy: 50, pieceActivity: 50 },
      endgame: { avgCPL: 0, conversionRate: 50, drawResistance: 50 },
    },
    topOpeningsWhite: [],
    topOpeningsBlack: [],
    overallAccuracy: 50,
    gamesAnalyzed: 0,
    updatedAt: new Date().toISOString(),
    confidence: 'low',
  };
}

/**
 * Calculate the core style metrics from games.
 */
function calculateStyleMetrics(games: ArchivedGame[]): PlayStyleMetrics {
  const gameMetrics = games.map(analyzeGameStyle);

  return {
    aggression: average(gameMetrics.map((m) => m.aggression)),
    positional: average(gameMetrics.map((m) => m.positional)),
    tactical: average(gameMetrics.map((m) => m.tactical)),
    endgame: average(gameMetrics.map((m) => m.endgame)),
    openingPreparation: calculateOpeningPreparation(games),
    timePressure: calculateTimePressureScore(games),
  };
}

/**
 * Analyze style metrics for a single game.
 */
function analyzeGameStyle(game: ArchivedGame): PlayStyleMetrics {
  const playerColor = game.player.color === 'white' ? 'w' : 'b';
  const playerMoves = game.moves.filter((m) => m.color === playerColor);

  if (playerMoves.length === 0) {
    return { ...DEFAULT_PLAY_STYLE };
  }

  // Aggression: count pawn pushes, exchanges initiated, piece activity
  const aggression = calculateAggression(playerMoves, game);

  // Positional vs Tactical: based on move patterns and game length
  const { positional, tactical } = calculatePositionalTactical(playerMoves, game);

  // Endgame: how well they convert/defend endgames
  const endgame = calculateEndgameScore(playerMoves, game);

  return {
    aggression,
    positional,
    tactical,
    endgame,
    openingPreparation: 50, // Calculated separately
    timePressure: 50, // Calculated separately
  };
}

/**
 * Calculate aggression score for a game.
 * High = lots of pawn advances, exchanges, attacks on king
 */
function calculateAggression(moves: ArchiveMove[], game: ArchivedGame): number {
  let score = 50;

  // Check move patterns
  for (const move of moves) {
    const san = move.san;

    // Pawn pushes toward enemy (especially e4, d4, f4, g4, h4 as white or reversed for black)
    if (san.match(/^[a-h][4-6]/)) score += 1;

    // Captures increase aggression
    if (san.includes('x')) score += 2;

    // Checks are aggressive
    if (san.includes('+') || san.includes('#')) score += 3;

    // Piece sacrifices (inferred from SAN)
    if (san.includes('x') && !san.match(/^[pP]/)) score += 2;

    // Early queen development (detect from SAN starting with Q)
    if (san.startsWith('Q') && move.moveNumber <= 10) score += 2;
  }

  // Short games (decisive) suggest aggressive play
  if (game.moves.length < 40 && game.result === 'win' && game.endReason === 'checkmate') {
    score += 15;
  }

  // Adjust based on result - winning attackers get higher scores
  if (game.result === 'win') score += 5;
  if (game.result === 'loss' && game.endReason === 'checkmate') score += 3; // Died attacking

  return clamp(score, 0, 100);
}

/**
 * Calculate positional and tactical scores.
 */
function calculatePositionalTactical(
  moves: ArchiveMove[],
  game: ArchivedGame
): { positional: number; tactical: number } {
  let positional = 50;
  let tactical = 50;

  // Analyze move classifications if available
  const classifiedMoves = moves.filter((m) => m.classification);
  if (classifiedMoves.length > 0) {
    // Brilliant/great moves suggest tactical ability
    const brilliantCount = classifiedMoves.filter(
      (m) => m.classification === 'brilliant' || m.classification === 'great'
    ).length;
    tactical += brilliantCount * 5;

    // Blunders suggest tactical weakness
    const blunderCount = classifiedMoves.filter((m) => m.classification === 'blunder').length;
    tactical -= blunderCount * 10;
  }

  // Long games suggest positional play
  if (game.moves.length > 50) {
    positional += 10;
    tactical -= 5;
  }

  // Tactical games are usually shorter with lots of captures
  const captureRatio = moves.filter((m) => m.san.includes('x')).length / moves.length;
  if (captureRatio > 0.4) {
    tactical += 15;
    positional -= 10;
  }

  // Draws often result from positional play
  if (game.result === 'draw') {
    positional += 10;
  }

  return {
    positional: clamp(positional, 0, 100),
    tactical: clamp(tactical, 0, 100),
  };
}

/**
 * Calculate endgame skill score.
 */
function calculateEndgameScore(moves: ArchiveMove[], game: ArchivedGame): number {
  let score = 50;

  // Check if game reached endgame
  const endgameMoves = moves.filter((m) => m.moveNumber > MIDDLEGAME_END);
  if (endgameMoves.length === 0) return 50;

  // Won long games show endgame skill
  if (game.moves.length > 50 && game.result === 'win') {
    score += 15;
  }

  // Lost long games show endgame weakness
  if (game.moves.length > 50 && game.result === 'loss') {
    score -= 10;
  }

  // Converted winning positions
  if (game.endReason === 'checkmate' && game.result === 'win') {
    score += 10;
  }

  // Lost won positions (timeout in winning position)
  if (game.endReason === 'timeout' && game.result === 'loss') {
    score -= 15;
  }

  return clamp(score, 0, 100);
}

/**
 * Calculate opening preparation score across all games.
 */
function calculateOpeningPreparation(games: ArchivedGame[]): number {
  let score = 50;

  // Variety of openings played
  const uniqueECOs = new Set(games.map((g) => g.eco).filter(Boolean));
  if (uniqueECOs.size > 10) score += 10;
  if (uniqueECOs.size > 20) score += 10;

  // Games with named openings suggest theory knowledge
  const namedOpenings = games.filter((g) => g.opening).length;
  const namedRatio = namedOpenings / games.length;
  score += Math.round(namedRatio * 20);

  // Check book depth (moves that match opening theory)
  const avgBookDepth = average(
    games.map((g) => {
      const bookMoves = g.moves.filter((m) => m.classification === 'book').length;
      return bookMoves;
    })
  );
  score += Math.min(avgBookDepth * 2, 20);

  return clamp(score, 0, 100);
}

/**
 * Calculate time pressure performance score.
 */
function calculateTimePressureScore(games: ArchivedGame[]): number {
  let score = 50;

  // Filter to timed games (bullet/blitz)
  const fastGames = games.filter((g) => g.category === 'bullet' || g.category === 'blitz');
  if (fastGames.length === 0) return 50;

  // Win rate in fast games
  const fastWins = fastGames.filter((g) => g.result === 'win').length;
  const fastWinRate = fastWins / fastGames.length;
  score += Math.round((fastWinRate - 0.5) * 40);

  // Timeout losses indicate poor time management
  const timeouts = fastGames.filter((g) => g.endReason === 'timeout' && g.result === 'loss').length;
  const timeoutRate = timeouts / fastGames.length;
  score -= Math.round(timeoutRate * 30);

  // Compare fast vs slow game performance
  const slowGames = games.filter(
    (g) => g.category === 'rapid' || g.category === 'classical'
  );
  if (slowGames.length > 0) {
    const slowWins = slowGames.filter((g) => g.result === 'win').length;
    const slowWinRate = slowWins / slowGames.length;

    // If they do better in fast games, they thrive under pressure
    if (fastWinRate > slowWinRate) score += 10;
    if (fastWinRate < slowWinRate - 0.1) score -= 10;
  }

  return clamp(score, 0, 100);
}

/**
 * Calculate phase-specific performance metrics.
 */
function calculatePhaseMetrics(games: ArchivedGame[]): PhaseMetrics {
  const phaseData = games.map(analyzeGamePhases);

  return {
    opening: {
      avgCPL: average(phaseData.map((p) => p.opening.cpl)),
      bookDepth: average(phaseData.map((p) => p.opening.bookDepth)),
      accuracy: average(phaseData.map((p) => p.opening.accuracy)),
    },
    middlegame: {
      avgCPL: average(phaseData.map((p) => p.middlegame.cpl)),
      tacticalAccuracy: average(phaseData.map((p) => p.middlegame.tacticalAccuracy)),
      pieceActivity: average(phaseData.map((p) => p.middlegame.pieceActivity)),
    },
    endgame: {
      avgCPL: average(phaseData.map((p) => p.endgame.cpl)),
      conversionRate: average(phaseData.map((p) => p.endgame.conversionRate)),
      drawResistance: average(phaseData.map((p) => p.endgame.drawResistance)),
    },
  };
}

/**
 * Analyze phases of a single game.
 */
function analyzeGamePhases(game: ArchivedGame) {
  const playerColor = game.player.color === 'white' ? 'w' : 'b';
  const playerMoves = game.moves.filter((m) => m.color === playerColor);

  const openingMoves = playerMoves.filter((m) => m.moveNumber <= OPENING_END);
  const middlegameMoves = playerMoves.filter(
    (m) => m.moveNumber > OPENING_END && m.moveNumber <= MIDDLEGAME_END
  );
  const endgameMoves = playerMoves.filter((m) => m.moveNumber > MIDDLEGAME_END);

  return {
    opening: {
      cpl: calculateAvgCPL(openingMoves),
      bookDepth: openingMoves.filter((m) => m.classification === 'book').length,
      accuracy: calculateAccuracy(openingMoves),
    },
    middlegame: {
      cpl: calculateAvgCPL(middlegameMoves),
      tacticalAccuracy: calculateAccuracy(middlegameMoves),
      pieceActivity: 50, // Would need position analysis
    },
    endgame: {
      cpl: calculateAvgCPL(endgameMoves),
      conversionRate: game.result === 'win' ? 100 : game.result === 'draw' ? 50 : 0,
      drawResistance: game.result !== 'loss' ? 70 : 30,
    },
  };
}

/**
 * Calculate average centipawn loss for a set of moves.
 */
function calculateAvgCPL(moves: ArchiveMove[]): number {
  const movesWithEval = moves.filter((m) => m.evaluation !== undefined);
  if (movesWithEval.length === 0) return 0;

  // This is a simplified heuristic - real CPL requires engine analysis
  // Using classification as a proxy
  const classifiedMoves = moves.filter((m) => m.classification);
  if (classifiedMoves.length === 0) return 50;

  const avgScore = average(
    classifiedMoves.map((m) => CLASSIFICATION_SCORES[m.classification!] || 50)
  );

  // Convert accuracy-like score to CPL-like (lower is better)
  return Math.round(100 - avgScore);
}

/**
 * Calculate accuracy for a set of moves.
 */
function calculateAccuracy(moves: ArchiveMove[]): number {
  const classifiedMoves = moves.filter((m) => m.classification);
  if (classifiedMoves.length === 0) return 50;

  return average(
    classifiedMoves.map((m) => CLASSIFICATION_SCORES[m.classification!] || 50)
  );
}

/**
 * Calculate opening statistics.
 */
function calculateOpeningStats(
  games: ArchivedGame[],
  color: 'white' | 'black'
): OpeningStats[] {
  const colorGames = games.filter((g) => g.player.color === color);

  // Group by ECO code
  const ecoMap = new Map<string, ArchivedGame[]>();
  for (const game of colorGames) {
    if (!game.eco) continue;
    const existing = ecoMap.get(game.eco) || [];
    existing.push(game);
    ecoMap.set(game.eco, existing);
  }

  // Calculate stats for each opening
  const stats: OpeningStats[] = [];
  for (const [eco, ecoGames] of ecoMap) {
    const wins = ecoGames.filter((g) => g.result === 'win').length;
    stats.push({
      eco,
      name: ecoGames[0].opening || eco,
      games: ecoGames.length,
      winRate: Math.round((wins / ecoGames.length) * 100),
      avgCPL: 0, // Would need engine analysis
    });
  }

  // Sort by games played and return top 5
  return stats.sort((a, b) => b.games - a.games).slice(0, 5);
}

/**
 * Calculate overall accuracy across all games.
 */
function calculateOverallAccuracy(games: ArchivedGame[]): number {
  const allMoves = games.flatMap((g) => {
    const playerColor = g.player.color === 'white' ? 'w' : 'b';
    return g.moves.filter((m) => m.color === playerColor);
  });

  return calculateAccuracy(allMoves);
}

// Utility functions

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Re-export for convenience
export { DEFAULT_PLAY_STYLE };
