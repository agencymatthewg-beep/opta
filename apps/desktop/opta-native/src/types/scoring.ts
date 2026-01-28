/**
 * Optimization scoring types for gamification and sharing.
 * Version 2 introduces three-dimensional scoring with wow factors for viral sharing.
 */

// ============================================
// V1 TYPES (kept for backwards compatibility)
// ============================================

export interface ScoreBreakdown {
  total: number;              // 0-100 final score
  performance_score: number;  // 0-40
  depth_score: number;        // 0-20
  stability_score: number;    // 0-10
  base_score: number;         // 30 (constant)

  // Performance details
  cpu_contribution: number;
  memory_contribution: number;
  gpu_temp_contribution: number;

  // Depth details
  actions_count: number;
  action_types_used: string[];
  diversity_bonus: number;

  // Stability details
  actions_applied: number;
  actions_failed: number;
  success_rate: number;
}

export interface GameScore {
  game_id: string;
  game_name: string;
  score: number;
  breakdown: ScoreBreakdown;
  calculated_at: number;
  optimization_timestamp: number | null;
  benchmark_timestamp: number | null;
}

export interface ScoreHistoryEntry {
  score: number;
  calculated_at: number;
  performance_score: number;
  depth_score: number;
  stability_score: number;
}

export interface GlobalStats {
  total_games_optimized: number;
  average_score: number;
  highest_score: number;
  highest_score_game: string;
  last_updated: number;
}

export interface LeaderboardEntry extends GameScore {
  rank: number;
}

// ============================================
// V2 TYPES: Three-dimensional scoring with wow factors
// ============================================

/**
 * Performance dimension sub-scores.
 * Measures raw performance improvements.
 */
export interface PerformanceScores {
  /** FPS improvement potential (0-100) */
  fpsGain: number;
  /** Frame time consistency/no stutters (0-100) */
  stability: number;
  /** Load time improvements (0-100) */
  loadTimes: number;
  /** Weighted average of all sub-scores (0-100) */
  weighted: number;
}

/**
 * Experience dimension sub-scores.
 * Measures quality of gaming experience beyond raw FPS.
 */
export interface ExperienceScores {
  /** Visual quality preservation - higher = kept more quality (0-100) */
  visualQuality: number;
  /** Thermal efficiency - GPU temp reduction (0-100) */
  thermalEfficiency: number;
  /** System responsiveness - CPU/memory headroom (0-100) */
  responsiveness: number;
  /** Weighted average of all sub-scores (0-100) */
  weighted: number;
}

/**
 * Competitive dimension sub-scores.
 * Measures competitive gaming advantages.
 */
export interface CompetitiveScores {
  /** Input lag reduction from priority optimizations (0-100) */
  inputLag: number;
  /** Network latency improvements (0-100) - placeholder for future */
  networkLatency: number;
  /** Background interference reduction (0-100) */
  interference: number;
  /** Weighted average of all sub-scores (0-100) */
  weighted: number;
}

/**
 * Three-dimensional score breakdown.
 * Performance (40%), Experience (35%), Competitive (25%)
 */
export interface DimensionScores {
  performance: PerformanceScores;
  experience: ExperienceScores;
  competitive: CompetitiveScores;
}

/**
 * Money saved calculation - viral sharing hook.
 * Maps FPS gains to equivalent hardware upgrade costs.
 */
export interface MoneySaved {
  /** Dollar amount saved */
  amount: number;
  /** Equivalent hardware, e.g., "RTX 4060 upgrade" */
  equivalent: string;
  /** Explanation of calculation */
  explanation: string;
}

/**
 * Percentile ranking for viral sharing.
 * Shows user how they compare to others.
 */
export interface PercentileRank {
  /** Percentile among similar hardware tier (0-100) */
  similar: number;
  /** Percentile globally across all users (0-100) */
  global: number;
  /** Hardware tier name, e.g., "Midrange Gaming" */
  tier: string;
}

/**
 * Improvement summary for quick sharing.
 */
export interface ImprovementSummary {
  /** Total FPS gained across all games */
  totalFpsGained: number;
  /** Total number of optimizations applied */
  totalOptimizations: number;
  /** Biggest single gain, e.g., "Valorant: +23 FPS" */
  biggestGain: string;
}

/**
 * Wow factors for viral sharing.
 * Shareable metrics that make users want to share their scores.
 */
export interface WowFactors {
  moneySaved: MoneySaved;
  percentileRank: PercentileRank;
  improvementSummary: ImprovementSummary;
}

/**
 * Hardware tier classification for comparisons.
 */
export interface HardwareTier {
  /** Tier classification */
  tier: 'budget' | 'midrange' | 'highend' | 'enthusiast';
  /** Human-readable signature, e.g., "RTX 4070 + Ryzen 7" */
  signature: string;
  /** Price range for this tier, e.g., "$800-1200" */
  priceRange: string;
}

/**
 * Enhanced game score with three-dimensional scoring.
 * Version 2 of the scoring system.
 */
export interface EnhancedGameScore extends GameScore {
  /** Three-dimensional score breakdown */
  dimensions: DimensionScores;
  /** Viral sharing metrics */
  wowFactors: WowFactors;
  /** User's hardware classification */
  hardwareTier: HardwareTier;
  /** Schema version for backwards compatibility */
  version: 2;
}

/**
 * History entry for Opta Score tracking.
 */
export interface OptaScoreHistoryEntry {
  /** Score at this point in time */
  score: number;
  /** Timestamp when recorded (Unix ms) */
  timestamp: number;
  /** What triggered this score change, e.g., "game_optimized:valorant" */
  trigger: string;
}

/**
 * User's overall Opta Score across all games.
 * The main shareable metric for the app.
 */
export interface OptaScore {
  /** Overall composite score (0-100) */
  overall: number;
  /** Aggregated dimension scores across all games */
  dimensions: DimensionScores;
  /** Aggregated wow factors */
  wowFactors: WowFactors;
  /** User's hardware classification */
  hardwareTier: HardwareTier;
  /** Number of games with optimizations applied */
  gamesOptimized: number;
  /** Timestamp of last calculation (Unix ms) */
  lastCalculated: number;
  /** Score history for tracking progress */
  history: OptaScoreHistoryEntry[];
}
