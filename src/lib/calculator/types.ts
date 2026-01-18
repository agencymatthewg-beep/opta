/**
 * Phase 47: Configuration Calculator
 *
 * Types for Opta's mathematical optimization engine that calculates
 * optimal settings configurations based on constraints and synergies.
 */

/**
 * A single game setting with its current value.
 */
export interface SettingValue {
  /** Category of the setting (e.g., "graphics", "display", "upscaling") */
  category: string;
  /** Setting identifier (e.g., "shadows", "dlss", "frame-cap") */
  setting: string;
  /** Current value */
  value: string | number | boolean;
}

/**
 * Impact dimensions for a setting or configuration.
 */
export interface ImpactMetrics {
  /** Performance impact (positive = better FPS) */
  performance?: number;
  /** Visual quality impact (positive = better quality) */
  quality?: number;
  /** Input latency impact (positive = lower latency) */
  latency?: number;
  /** Power consumption impact (positive = less power) */
  power?: number;
  /** VRAM usage impact (positive = less VRAM) */
  vram?: number;
}

/**
 * A synergy or conflict relationship between settings.
 */
export interface SettingRelationship {
  /** Unique identifier */
  id: string;
  /** Type of relationship */
  type: 'synergy' | 'conflict';
  /** Direction of the relationship */
  direction: 'enhances' | 'excludes' | 'degrades';
  /** Settings involved in this relationship */
  settings: SettingValue[];
  /** Human-readable description of the relationship */
  description: string;
  /** Impact of this relationship */
  impact: ImpactMetrics;
  /** Confidence in this relationship (0-1) */
  confidence: number;
  /** Platforms this applies to */
  platforms: string[];
  /** Hardware requirements (if any) */
  hardware?: string[];
  /** Tags for categorization */
  tags: string[];
  /** Recommendations for users */
  recommendations: string[];
}

/**
 * Constraint defining limits on settings.
 */
export interface SettingConstraint {
  /** Category of the constrained setting */
  category: string;
  /** Setting being constrained */
  setting: string;
  /** Constraint type */
  constraintType: 'required' | 'forbidden' | 'range' | 'depends_on';
  /** Required/forbidden value or range */
  value?: string | number | boolean;
  /** Min value for range constraints */
  minValue?: number;
  /** Max value for range constraints */
  maxValue?: number;
  /** Dependency setting (for depends_on constraints) */
  dependsOn?: SettingValue;
  /** Reason for this constraint */
  reason: string;
  /** Weight/priority of this constraint (higher = more important) */
  weight: number;
}

/**
 * Hardware profile for optimization targeting.
 */
export interface HardwareProfile {
  /** Platform (macos, windows, linux) */
  platform: string;
  /** GPU model or family */
  gpu: string;
  /** VRAM in GB */
  vramGb: number;
  /** CPU model or family */
  cpu: string;
  /** RAM in GB */
  ramGb: number;
  /** Whether running on battery */
  onBattery: boolean;
  /** Whether this is Apple Silicon */
  isAppleSilicon: boolean;
  /** Specific chip (e.g., "M3 Pro") */
  chipModel?: string;
  /** Target frame rate */
  targetFps: number;
  /** Display resolution */
  resolution: string;
  /** Display refresh rate */
  refreshRate: number;
}

/**
 * Optimization goal priority weights.
 */
export interface OptimizationGoals {
  /** Weight for performance optimization (0-1) */
  performance: number;
  /** Weight for visual quality (0-1) */
  quality: number;
  /** Weight for input latency (0-1) */
  latency: number;
  /** Weight for power efficiency (0-1) */
  power: number;
}

/**
 * Result of constraint solving.
 */
export interface ConstraintSolution {
  /** Whether a valid solution was found */
  feasible: boolean;
  /** The resolved settings configuration */
  settings: SettingValue[];
  /** Constraints that could not be satisfied */
  unsatisfiedConstraints: SettingConstraint[];
  /** Score of this solution (higher = better) */
  score: number;
  /** Explanation of the solution */
  explanation: string[];
}

/**
 * Synergy score result.
 */
export interface SynergyScore {
  /** Overall synergy score (positive = synergies dominate, negative = conflicts dominate) */
  totalScore: number;
  /** Detailed breakdown by impact dimension */
  breakdown: ImpactMetrics;
  /** Active synergies in this configuration */
  activeSynergies: SettingRelationship[];
  /** Active conflicts in this configuration */
  activeConflicts: SettingRelationship[];
  /** Recommendations for improvement */
  recommendations: string[];
}

/**
 * Optimal configuration result.
 */
export interface OptimalConfig {
  /** Generated configuration ID */
  id: string;
  /** Configuration name */
  name: string;
  /** Description of this configuration */
  description: string;
  /** The settings in this configuration */
  settings: SettingValue[];
  /** Expected impact metrics */
  expectedImpact: ImpactMetrics;
  /** Synergy score */
  synergyScore: SynergyScore;
  /** Target profile this was optimized for */
  targetProfile: 'max_fps' | 'balanced' | 'quality' | 'battery' | 'competitive';
  /** Confidence in this configuration (0-1) */
  confidence: number;
  /** Trade-offs made in this configuration */
  tradeoffs: string[];
}

/**
 * Impact analysis for a setting change.
 */
export interface SettingImpactAnalysis {
  /** The setting being changed */
  setting: SettingValue;
  /** New proposed value */
  newValue: string | number | boolean;
  /** Direct impact of this change */
  directImpact: ImpactMetrics;
  /** Synergies that would be enabled/enhanced */
  enabledSynergies: SettingRelationship[];
  /** Synergies that would be disabled/weakened */
  disabledSynergies: SettingRelationship[];
  /** Conflicts that would be introduced */
  newConflicts: SettingRelationship[];
  /** Conflicts that would be resolved */
  resolvedConflicts: SettingRelationship[];
  /** Net impact including synergies/conflicts */
  netImpact: ImpactMetrics;
  /** Overall recommendation */
  recommendation: 'recommended' | 'neutral' | 'not_recommended';
  /** Explanation of the analysis */
  explanation: string[];
}

/**
 * Batch analysis for multiple setting changes.
 */
export interface BatchImpactAnalysis {
  /** Individual analyses for each change */
  changes: SettingImpactAnalysis[];
  /** Combined net impact */
  combinedImpact: ImpactMetrics;
  /** Combined synergy score */
  combinedSynergyScore: SynergyScore;
  /** Whether the batch is overall recommended */
  overallRecommendation: 'recommended' | 'neutral' | 'not_recommended';
  /** Summary explanation */
  summary: string[];
}

/**
 * Configuration comparison result.
 */
export interface ConfigComparison {
  /** First configuration */
  configA: SettingValue[];
  /** Second configuration */
  configB: SettingValue[];
  /** Impact difference (B - A) */
  impactDifference: ImpactMetrics;
  /** Settings that differ */
  differences: Array<{
    category: string;
    setting: string;
    valueA: string | number | boolean;
    valueB: string | number | boolean;
    impact: ImpactMetrics;
  }>;
  /** Which config is better for each goal */
  betterFor: {
    performance: 'A' | 'B' | 'equal';
    quality: 'A' | 'B' | 'equal';
    latency: 'A' | 'B' | 'equal';
    power: 'A' | 'B' | 'equal';
  };
  /** Summary */
  summary: string;
}
