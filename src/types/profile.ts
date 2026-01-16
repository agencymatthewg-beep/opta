/**
 * User profile types for Opta's adaptive intelligence system.
 *
 * The profile stores user preferences, hardware signature, and learned optimization patterns
 * to enable personalized recommendations and adaptive behavior.
 */

/**
 * User mode determines the complexity of UI and recommendations shown.
 * - simple: Minimal options, one-click optimizations
 * - standard: Balanced complexity with explanations
 * - power: Full control, advanced options exposed
 */
export type UserMode = 'simple' | 'standard' | 'power';

/**
 * Optimization depth controls how thorough the analysis and changes are.
 * - efficient: Quick optimizations with minimal system impact
 * - thorough: Comprehensive analysis, balanced approach
 * - optimised: Maximum performance, more aggressive changes
 */
export type OptimizationDepth = 'efficient' | 'thorough' | 'optimised';

/**
 * Communication style for AI responses and explanations.
 * - informative: Detailed explanations with context and reasoning
 * - concise: Brief, action-focused responses
 */
export type CommunicationStyle = 'informative' | 'concise';

/**
 * Hardware identification for system fingerprinting.
 * Used to provide hardware-specific recommendations and track system changes.
 */
export interface HardwareSignature {
  /** CPU model/brand string */
  cpu: string;
  /** GPU model/brand string, null if not detected */
  gpu: string | null;
  /** Total RAM in gigabytes */
  ramGb: number;
  /** Operating system platform */
  platform: 'windows' | 'macos' | 'linux';
}

/**
 * Learned pattern from user's optimization history.
 * Captures preferences, aversions, and timing patterns to personalize future recommendations.
 */
export interface OptimizationPattern {
  /** Type of pattern observed */
  patternType: 'preference' | 'aversion' | 'timing';
  /** Category of setting this pattern applies to */
  settingCategory: 'graphics' | 'launch_options' | 'priority';
  /** Specific setting key within the category */
  settingKey: string;
  /** Confidence score from 0 to 1 based on sample consistency */
  confidence: number;
  /** Number of data points used to determine this pattern */
  sampleCount: number;
  /** Human-readable description, e.g., "You typically prefer higher FPS over visual quality" */
  description: string;
  /** Timestamp of last pattern update */
  lastUpdated: number;
}

/**
 * Main user profile containing preferences, hardware info, and learned patterns.
 * Persisted to ~/.opta/profiles/main_profile.json
 */
export interface UserProfile {
  /** Unique profile identifier */
  id: string;
  /** Profile creation timestamp (Unix ms) */
  createdAt: number;
  /** Last update timestamp (Unix ms) */
  updatedAt: number;

  // User preferences (from MUST_HAVE.md)
  /** UI complexity level */
  userMode: UserMode;
  /** Analysis thoroughness level */
  optimizationDepth: OptimizationDepth;
  /** AI response verbosity */
  communicationStyle: CommunicationStyle;

  // Hardware identification
  /** System hardware fingerprint */
  hardwareSignature: HardwareSignature;

  // Learned patterns (populated by pattern learning engine)
  /** Optimization patterns learned from user behavior */
  patterns: OptimizationPattern[];

  // Statistics
  /** Total number of optimizations applied */
  totalOptimizations: number;
  /** Number of unique games optimized */
  totalGamesOptimized: number;
  /** Number of optimizations user accepted */
  optimizationsAccepted: number;
  /** Number of optimizations user reverted */
  optimizationsReverted: number;
}

/**
 * Profile update payload for partial updates.
 * Only includes fields that can be changed by the user.
 */
export interface ProfileUpdate {
  /** Update UI complexity level */
  userMode?: UserMode;
  /** Update analysis thoroughness */
  optimizationDepth?: OptimizationDepth;
  /** Update AI response style */
  communicationStyle?: CommunicationStyle;
}

/**
 * Default profile values for new users.
 * Hardware signature and timestamps are set at creation time.
 */
export const DEFAULT_PROFILE: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt' | 'hardwareSignature'> = {
  userMode: 'standard',
  optimizationDepth: 'thorough',
  communicationStyle: 'informative',
  patterns: [],
  totalOptimizations: 0,
  totalGamesOptimized: 0,
  optimizationsAccepted: 0,
  optimizationsReverted: 0,
};
