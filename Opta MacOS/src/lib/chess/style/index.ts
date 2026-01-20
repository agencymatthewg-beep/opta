/**
 * Chess play style analysis module.
 *
 * Provides tools for analyzing a player's chess style and
 * creating a personalized AI clone that mimics their play.
 */

// Types
export type {
  PlayStyleMetrics,
  PlayStyleAnalysis,
  PhaseMetrics,
  OpeningStats,
  FamousPlayerProfile,
  StyleArchetype,
  CloneAISettings,
  StyleScore,
} from './types';

export {
  DEFAULT_PLAY_STYLE,
  DEFAULT_CLONE_SETTINGS,
  getArchetype,
  calculateStyleSimilarity,
} from './types';

// Analysis
export { analyzePlayStyle } from './PlayStyleAnalyzer';

// AI
export { PersonalizedAI, type MoveCandidate } from './PersonalizedAI';

// Famous players
export {
  FAMOUS_PLAYERS,
  findMostSimilarPlayer,
  getTopSimilarPlayers,
  getPlayersByArchetype,
} from './famousPlayers';
