/**
 * Optimization engine types.
 */

export interface OptimizationResult {
  success: boolean;
  actions_applied: number;
  actions_failed: number;
  message: string;
  details: OptimizationDetail[];
}

export interface OptimizationDetail {
  action: string;
  key?: string;
  value?: string | number;
  status: 'applied' | 'failed' | 'skipped';
  error?: string;
}

export interface OptimizationHistoryEntry {
  action_id: string;
  game_id: string;
  game_name: string;
  action_type: 'graphics' | 'launch_options' | 'priority';
  setting_key: string;
  original_value: unknown;
  new_value: unknown;
  file_path: string | null;
  applied_at: number | null;
}

export interface OptimizedGame {
  game_id: string;
  action_count: number;
  last_optimized: number;
}

/** Arguments for recording a user's optimization choice */
export interface RecordChoiceArgs {
  gameId: string;
  gameName: string;
  settingCategory: string;
  settingKey?: string;
  originalValue?: unknown;
  newValue?: unknown;
  action: 'accepted' | 'reverted';
}

/** A detected pattern from analyzing user choices */
export interface DetectedPattern {
  patternType: 'preference' | 'aversion' | 'timing';
  settingCategory: string;
  settingKey: string;
  confidence: number;
  sampleCount: number;
  description: string;
  lastUpdated: number;
}

/** Statistics about recorded choices */
export interface ChoiceStats {
  totalChoices: number;
  accepted: number;
  reverted: number;
  modified: number;
  uniqueSettings: number;
  gamesTracked: number;
}
