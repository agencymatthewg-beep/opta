/**
 * Play style analysis types for Opta Chess AI Clone.
 *
 * Defines the style dimensions used to fingerprint a player's
 * chess personality based on their game history.
 *
 * Style Dimensions:
 * - Aggression: Tendency to attack vs defend
 * - Positional: Strategic play vs tactical
 * - Tactical: Combination/sacrifice tendency
 * - Endgame: Comfort in simplified positions
 * - Opening: Repertoire breadth and theory depth
 * - Time: Clock management style
 */

/**
 * Normalized score from 0-100 for each style dimension.
 */
export type StyleScore = number;

/**
 * Core play style metrics derived from game analysis.
 */
export interface PlayStyleMetrics {
  /** Tendency to initiate attacks and play aggressively (0=defensive, 100=aggressive) */
  aggression: StyleScore;
  /** Preference for strategic positional play vs tactics (0=tactical, 100=positional) */
  positional: StyleScore;
  /** Comfort with tactical complications and sacrifices (0=avoids, 100=seeks) */
  tactical: StyleScore;
  /** Strength and preference for endgame play (0=weak, 100=strong) */
  endgame: StyleScore;
  /** Opening preparation depth and repertoire breadth (0=narrow/shallow, 100=wide/deep) */
  openingPreparation: StyleScore;
  /** Time pressure performance (0=struggles, 100=thrives) */
  timePressure: StyleScore;
}

/**
 * Opening repertoire analysis.
 */
export interface OpeningStats {
  /** ECO code */
  eco: string;
  /** Opening name */
  name: string;
  /** Number of times played */
  games: number;
  /** Win rate (0-100) */
  winRate: number;
  /** Average centipawn loss in the opening phase */
  avgCPL: number;
}

/**
 * Phase-specific metrics from game analysis.
 */
export interface PhaseMetrics {
  /** Moves 1-15: opening phase */
  opening: {
    avgCPL: number;
    bookDepth: number;
    accuracy: number;
  };
  /** Moves 16-35: middlegame phase */
  middlegame: {
    avgCPL: number;
    tacticalAccuracy: number;
    pieceActivity: number;
  };
  /** Moves 36+: endgame phase */
  endgame: {
    avgCPL: number;
    conversionRate: number;
    drawResistance: number;
  };
}

/**
 * Full play style analysis result.
 */
export interface PlayStyleAnalysis {
  /** Primary style metrics */
  metrics: PlayStyleMetrics;
  /** Phase-specific performance */
  phases: PhaseMetrics;
  /** Top 5 most played openings as white */
  topOpeningsWhite: OpeningStats[];
  /** Top 5 most played openings as black */
  topOpeningsBlack: OpeningStats[];
  /** Overall accuracy percentage */
  overallAccuracy: number;
  /** Games analyzed for this profile */
  gamesAnalyzed: number;
  /** Last update timestamp */
  updatedAt: string;
  /** Confidence in the analysis (based on game count) */
  confidence: 'low' | 'medium' | 'high';
}

/**
 * Famous player style profiles for comparison.
 */
export interface FamousPlayerProfile {
  /** Player name */
  name: string;
  /** Peak rating */
  peakRating: number;
  /** Era played */
  era: string;
  /** Short description */
  description: string;
  /** Style metrics */
  metrics: PlayStyleMetrics;
  /** Signature openings */
  signatureOpenings: string[];
  /** Play style archetype */
  archetype: StyleArchetype;
}

/**
 * Style archetypes derived from metric patterns.
 */
export type StyleArchetype =
  | 'attacker'      // High aggression, high tactical
  | 'defender'      // Low aggression, high positional
  | 'tactician'     // High tactical, moderate aggression
  | 'positional'    // High positional, low tactical
  | 'universal'     // Balanced across all dimensions
  | 'endgame-artist'// High endgame, patient play
  | 'theoretician'  // High opening prep, theoretical
  | 'practical';    // High time pressure, pragmatic

/**
 * Settings for the personalized AI clone.
 */
export interface CloneAISettings {
  /** Whether the clone is enabled */
  enabled: boolean;
  /** Base skill level (0-20) */
  baseSkillLevel: number;
  /** How closely to mimic the user's style (0=stockfish, 100=pure clone) */
  styleIntensity: number;
  /** Add randomness to make play less predictable */
  humanization: number;
  /** Prefer user's actual opening repertoire */
  useOpeningRepertoire: boolean;
  /** Match time pressure behavior */
  mimicTimeManagement: boolean;
}

/**
 * Default clone AI settings.
 */
export const DEFAULT_CLONE_SETTINGS: CloneAISettings = {
  enabled: false,
  baseSkillLevel: 10,
  styleIntensity: 70,
  humanization: 30,
  useOpeningRepertoire: true,
  mimicTimeManagement: true,
};

/**
 * Default play style (average player).
 */
export const DEFAULT_PLAY_STYLE: PlayStyleMetrics = {
  aggression: 50,
  positional: 50,
  tactical: 50,
  endgame: 50,
  openingPreparation: 50,
  timePressure: 50,
};

/**
 * Determine archetype from style metrics.
 */
export function getArchetype(metrics: PlayStyleMetrics): StyleArchetype {
  const { aggression, positional, tactical, endgame, openingPreparation, timePressure } = metrics;

  // Check for extremes first
  if (aggression >= 75 && tactical >= 70) return 'attacker';
  if (positional >= 75 && aggression <= 40) return 'defender';
  if (tactical >= 75 && aggression < 70) return 'tactician';
  if (positional >= 70 && tactical <= 40) return 'positional';
  if (endgame >= 75) return 'endgame-artist';
  if (openingPreparation >= 75) return 'theoretician';
  if (timePressure >= 75) return 'practical';

  // Check for balanced
  const values = [aggression, positional, tactical, endgame];
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / values.length;

  if (variance < 150) return 'universal';

  // Default based on strongest trait
  const traits = { aggression, positional, tactical, endgame };
  const strongest = Object.entries(traits).reduce((a, b) => (a[1] > b[1] ? a : b));

  switch (strongest[0]) {
    case 'aggression': return 'attacker';
    case 'positional': return 'positional';
    case 'tactical': return 'tactician';
    case 'endgame': return 'endgame-artist';
    default: return 'universal';
  }
}

/**
 * Calculate similarity between two style profiles (0-100).
 */
export function calculateStyleSimilarity(a: PlayStyleMetrics, b: PlayStyleMetrics): number {
  const dimensions: (keyof PlayStyleMetrics)[] = [
    'aggression',
    'positional',
    'tactical',
    'endgame',
    'openingPreparation',
    'timePressure',
  ];

  // Euclidean distance in 6D space, normalized to 0-100
  const sumSquaredDiff = dimensions.reduce((sum, dim) => {
    const diff = a[dim] - b[dim];
    return sum + diff * diff;
  }, 0);

  // Max possible distance is sqrt(6 * 100^2) = ~245
  const distance = Math.sqrt(sumSquaredDiff);
  const maxDistance = Math.sqrt(6 * 100 * 100);

  return Math.round(100 * (1 - distance / maxDistance));
}
