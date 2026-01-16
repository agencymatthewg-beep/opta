/**
 * Expertise types for adaptive user experience.
 *
 * The expertise system detects user behavior patterns and adjusts
 * explanation complexity accordingly:
 * - simple: Plain language, fewer options, safer defaults
 * - standard: Balanced explanations for regular users
 * - power: Full technical details for advanced users
 */

export type ExpertiseLevel = 'simple' | 'standard' | 'power';

/**
 * Behavioral signals used to detect expertise level.
 * Each signal is a 0-100 score indicating how often the user
 * exhibits that behavior.
 */
export interface ExpertiseSignals {
  /** How often user uses technical features (0-100) */
  usesTechnicalFeatures: number;
  /** How often user reads documentation (0-100) */
  readsDocumentation: number;
  /** How often user uses keyboard shortcuts (0-100) */
  usesShortcuts: number;
  /** How often user expands technical details sections (0-100) */
  expandsTechnicalDetails: number;
  /** How often user enables investigation mode (0-100) */
  usesInvestigationMode: number;
  /** Total time spent in app (minutes) */
  timeInApp: number;
  /** Number of app sessions */
  sessionsCount: number;
  /** Number of optimizations applied */
  optimizationsApplied: number;
}

/**
 * Record of an expertise level change.
 */
export interface ExpertiseLevelChange {
  /** Timestamp of the change (ms) */
  timestamp: number;
  /** Previous expertise level */
  from: ExpertiseLevel;
  /** New expertise level */
  to: ExpertiseLevel;
  /** Reason for the change */
  reason: string;
}

/**
 * Complete expertise profile for a user.
 */
export interface ExpertiseProfile {
  /** Current detected/overridden expertise level */
  currentLevel: ExpertiseLevel;
  /** Confidence in the detection (0-100) */
  confidence: number;
  /** Behavioral signals used for detection */
  signals: ExpertiseSignals;
  /** History of level changes */
  history: ExpertiseLevelChange[];
  /** Manual override if user set their level explicitly */
  manualOverride: ExpertiseLevel | null;
}

/**
 * Default signals for new users.
 */
export const DEFAULT_EXPERTISE_SIGNALS: ExpertiseSignals = {
  usesTechnicalFeatures: 0,
  readsDocumentation: 0,
  usesShortcuts: 0,
  expandsTechnicalDetails: 0,
  usesInvestigationMode: 0,
  timeInApp: 0,
  sessionsCount: 0,
  optimizationsApplied: 0,
};

/**
 * Default profile for new users.
 */
export const DEFAULT_EXPERTISE_PROFILE: ExpertiseProfile = {
  currentLevel: 'standard',
  confidence: 50,
  signals: DEFAULT_EXPERTISE_SIGNALS,
  history: [],
  manualOverride: null,
};
