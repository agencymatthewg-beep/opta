/**
 * PersonalizedAI - Stockfish wrapper that mimics user's play style.
 *
 * Uses the style analysis to weight move selection:
 * - Aggressive players prefer attacking moves
 * - Positional players prefer slow strategic moves
 * - The AI blends Stockfish's best moves with style-weighted alternatives
 *
 * Works by:
 * 1. Getting top N moves from Stockfish
 * 2. Scoring each move based on style compatibility
 * 3. Selecting based on weighted random choice
 */

import type {
  PlayStyleMetrics,
  CloneAISettings,
  OpeningStats,
} from './types';
import { DEFAULT_PLAY_STYLE, DEFAULT_CLONE_SETTINGS } from './types';

/**
 * Move candidate from Stockfish analysis.
 */
export interface MoveCandidate {
  /** Move in UCI format (e.g., 'e2e4') */
  uci: string;
  /** Centipawn evaluation (positive = white winning) */
  score: number;
  /** Principal variation (best continuation) */
  pv?: string[];
}

/**
 * Move with style-adjusted score.
 */
interface ScoredMove extends MoveCandidate {
  /** Style compatibility score (0-100) */
  styleScore: number;
  /** Final weighted score for selection */
  finalScore: number;
}

/**
 * Style weights for move characteristics.
 */
interface StyleWeights {
  /** Bonus for attacking moves */
  attackWeight: number;
  /** Bonus for positional moves */
  positionalWeight: number;
  /** Bonus for tactical complications */
  tacticalWeight: number;
  /** Penalty for risky moves */
  riskPenalty: number;
}

/**
 * PersonalizedAI class - wraps Stockfish to produce style-mimicking moves.
 */
export class PersonalizedAI {
  private style: PlayStyleMetrics;
  private settings: CloneAISettings;
  private openingRepertoire: Map<string, string[]>; // FEN prefix -> preferred moves
  private weights: StyleWeights;

  constructor(
    style: PlayStyleMetrics = DEFAULT_PLAY_STYLE,
    settings: CloneAISettings = DEFAULT_CLONE_SETTINGS
  ) {
    this.style = style;
    this.settings = settings;
    this.openingRepertoire = new Map();
    this.weights = this.calculateWeights();
  }

  /**
   * Update the style profile.
   */
  setStyle(style: PlayStyleMetrics): void {
    this.style = style;
    this.weights = this.calculateWeights();
  }

  /**
   * Update the AI settings.
   */
  setSettings(settings: CloneAISettings): void {
    this.settings = settings;
    this.weights = this.calculateWeights();
  }

  /**
   * Load opening repertoire from analyzed games.
   */
  loadOpeningRepertoire(openings: OpeningStats[], color: 'white' | 'black'): void {
    // In a full implementation, this would map FEN positions to preferred moves
    // For now, we just store the ECO codes as preferences
    for (const opening of openings) {
      // Store the opening preference
      this.openingRepertoire.set(`${color}:${opening.eco}`, [opening.name]);
    }
  }

  /**
   * Select a move from candidates based on style weighting.
   *
   * @param candidates - Moves ranked by Stockfish (best first)
   * @param fen - Current position FEN
   * @param moveNumber - Current move number (for opening book)
   * @returns Selected move in UCI format
   */
  selectMove(
    candidates: MoveCandidate[],
    fen: string,
    moveNumber: number
  ): string {
    if (candidates.length === 0) {
      throw new Error('No candidate moves provided');
    }

    // If style intensity is 0, just return Stockfish's best move
    if (this.settings.styleIntensity === 0) {
      return candidates[0].uci;
    }

    // Score all candidates
    const scoredMoves = this.scoreCandidates(candidates, fen, moveNumber);

    // Select based on weighted probability
    return this.weightedSelect(scoredMoves);
  }

  /**
   * Score all candidate moves based on style compatibility.
   */
  private scoreCandidates(
    candidates: MoveCandidate[],
    fen: string,
    moveNumber: number
  ): ScoredMove[] {
    const isOpening = moveNumber <= 15;
    const isEndgame = this.isEndgamePosition(fen);

    return candidates.map((move, index) => {
      // Base score from Stockfish ranking (best move gets 100, decreases)
      const engineScore = 100 - index * 10;

      // Style compatibility score
      const styleScore = this.calculateMoveStyleScore(move, fen, isOpening, isEndgame);

      // Blend based on style intensity
      const blendFactor = this.settings.styleIntensity / 100;
      const finalScore =
        engineScore * (1 - blendFactor) +
        styleScore * blendFactor +
        (Math.random() * this.settings.humanization * 0.5);

      return {
        ...move,
        styleScore,
        finalScore,
      };
    });
  }

  /**
   * Calculate style compatibility score for a move.
   */
  private calculateMoveStyleScore(
    move: MoveCandidate,
    fen: string,
    isOpening: boolean,
    isEndgame: boolean
  ): number {
    let score = 50; // Neutral starting point

    const uci = move.uci;
    const isCapture = this.isCapture(uci, fen);
    const isCheck = move.pv?.[0]?.includes('+') || false;
    const isPawnPush = this.isPawnMove(uci);

    // Aggression adjustments
    if (this.style.aggression > 60) {
      if (isCapture) score += this.weights.attackWeight;
      if (isCheck) score += this.weights.attackWeight * 1.5;
      if (isPawnPush && this.isPawnAdvance(uci)) score += this.weights.attackWeight * 0.5;
    } else if (this.style.aggression < 40) {
      // Defensive players prefer quiet moves
      if (!isCapture && !isCheck) score += this.weights.positionalWeight;
    }

    // Tactical adjustments
    if (this.style.tactical > 60) {
      // Tactical players like complex positions
      if (isCapture) score += this.weights.tacticalWeight;
      // Sharp moves (creating tension)
      if (this.createsTension(uci, fen)) score += this.weights.tacticalWeight;
    }

    // Positional adjustments
    if (this.style.positional > 60) {
      // Positional players like improving pieces quietly
      if (!isCapture && this.isMinorPieceMove(uci)) {
        score += this.weights.positionalWeight;
      }
    }

    // Endgame adjustments
    if (isEndgame && this.style.endgame > 60) {
      // Good endgame players prefer technical moves
      if (this.isKingMove(uci)) score += 5;
      if (isPawnPush) score += 8;
    }

    // Opening book preference
    if (isOpening && this.settings.useOpeningRepertoire) {
      // Bonus for moves that match known repertoire
      // (simplified - would need ECO database in full implementation)
      score += 5;
    }

    // Humanization noise
    score += (Math.random() - 0.5) * this.settings.humanization * 0.3;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate style weights from metrics.
   */
  private calculateWeights(): StyleWeights {
    const intensity = this.settings.styleIntensity / 100;

    return {
      attackWeight: ((this.style.aggression - 50) / 50) * 20 * intensity,
      positionalWeight: ((this.style.positional - 50) / 50) * 15 * intensity,
      tacticalWeight: ((this.style.tactical - 50) / 50) * 18 * intensity,
      riskPenalty: (100 - this.style.tactical) / 50 * 10 * intensity,
    };
  }

  /**
   * Weighted random selection from scored moves.
   */
  private weightedSelect(moves: ScoredMove[]): string {
    // Sort by final score descending
    const sorted = [...moves].sort((a, b) => b.finalScore - a.finalScore);

    // Calculate selection probabilities using softmax-like distribution
    const temperature = 1.5; // Higher = more random
    const scores = sorted.map((m) => Math.exp(m.finalScore / temperature));
    const totalScore = scores.reduce((a, b) => a + b, 0);
    const probabilities = scores.map((s) => s / totalScore);

    // Random selection based on probabilities
    const rand = Math.random();
    let cumulative = 0;
    for (let i = 0; i < sorted.length; i++) {
      cumulative += probabilities[i];
      if (rand < cumulative) {
        return sorted[i].uci;
      }
    }

    // Fallback to best move
    return sorted[0].uci;
  }

  // Move classification helpers

  private isCapture(uci: string, fen: string): boolean {
    // Check if destination square is occupied
    const to = uci.slice(2, 4);
    const toFile = to.charCodeAt(0) - 'a'.charCodeAt(0);
    const toRank = parseInt(to[1]) - 1;

    // Parse FEN to check if square is occupied
    const board = fen.split(' ')[0];
    const ranks = board.split('/').reverse();
    const rank = ranks[toRank];

    let filePos = 0;
    for (const char of rank) {
      if (/\d/.test(char)) {
        filePos += parseInt(char);
      } else {
        if (filePos === toFile) {
          return true; // Square is occupied
        }
        filePos++;
      }
    }

    return false;
  }

  private isPawnMove(uci: string): boolean {
    // This is a heuristic - actual implementation would check piece type
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const fileDiff = Math.abs(from.charCodeAt(0) - to.charCodeAt(0));
    const rankDiff = Math.abs(parseInt(from[1]) - parseInt(to[1]));

    // Pawns move 1-2 squares forward or diagonally
    return rankDiff <= 2 && fileDiff <= 1;
  }

  private isPawnAdvance(uci: string): boolean {
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const fromRank = parseInt(from[1]);
    const toRank = parseInt(to[1]);

    // Pawn advancing toward enemy
    return toRank > fromRank || toRank < fromRank;
  }

  private isMinorPieceMove(uci: string): boolean {
    // Knight and bishop moves have specific patterns
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const fileDiff = Math.abs(from.charCodeAt(0) - to.charCodeAt(0));
    const rankDiff = Math.abs(parseInt(from[1]) - parseInt(to[1]));

    // Knight: L-shape
    const isKnight = (fileDiff === 2 && rankDiff === 1) || (fileDiff === 1 && rankDiff === 2);
    // Bishop: diagonal
    const isBishop = fileDiff === rankDiff && fileDiff > 0;

    return isKnight || isBishop;
  }

  private isKingMove(uci: string): boolean {
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const fileDiff = Math.abs(from.charCodeAt(0) - to.charCodeAt(0));
    const rankDiff = Math.abs(parseInt(from[1]) - parseInt(to[1]));

    return fileDiff <= 1 && rankDiff <= 1 && (fileDiff > 0 || rankDiff > 0);
  }

  private createsTension(uci: string, _fen: string): boolean {
    // Simplified: moves to central squares create tension
    const to = uci.slice(2, 4);
    const centralSquares = ['d4', 'd5', 'e4', 'e5', 'c4', 'c5', 'f4', 'f5'];
    return centralSquares.includes(to);
  }

  private isEndgamePosition(fen: string): boolean {
    // Count pieces - endgame if few pieces remain
    const board = fen.split(' ')[0];
    const pieces = board.replace(/[0-9\/]/g, '');
    // Endgame: typically less than 12 pieces (excluding kings and pawns)
    const majorMinor = pieces.replace(/[pkPK]/gi, '');
    return majorMinor.length <= 6;
  }
}

export default PersonalizedAI;
