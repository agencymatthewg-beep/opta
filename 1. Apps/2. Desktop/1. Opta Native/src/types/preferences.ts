/**
 * User preferences types for Opta.
 *
 * These preferences control how Opta communicates with users,
 * separate from the adaptive expertise system.
 */

/**
 * Communication style preference.
 * - informative: Explains the "why" behind optimizations, educational
 * - concise: Just the facts, minimal explanation
 */
export type CommunicationStyle = 'informative' | 'concise';

/**
 * User preferences interface.
 * Persisted to localStorage for session continuity.
 */
export interface UserPreferences {
  /** How verbose Opta's explanations should be */
  communicationStyle: CommunicationStyle;
}

/**
 * Default preferences for new users.
 */
export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  communicationStyle: 'informative',
};
