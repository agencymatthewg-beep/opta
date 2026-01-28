/**
 * Phase 47: Configuration Calculator
 *
 * Mathematical optimization engine for game settings.
 * Entry point for the calculator system.
 */

// Types
export type {
  SettingValue,
  ImpactMetrics,
  SettingRelationship,
  SettingConstraint,
  HardwareProfile,
  OptimizationGoals,
  ConstraintSolution,
  SynergyScore,
  OptimalConfig,
  SettingImpactAnalysis,
  BatchImpactAnalysis,
  ConfigComparison,
} from './types';

// ConfigCalculator - Constraint solver
export { ConfigCalculator, getConfigCalculator } from './ConfigCalculator';

// SynergyScorer - Interaction scoring
export { SynergyScorer, getSynergyScorer } from './SynergyScorer';

// OptimalConfigGenerator - Best config generation
export { OptimalConfigGenerator, getOptimalConfigGenerator } from './OptimalConfigGenerator';

// SettingsImpactAnalyzer - Impact analysis
export { SettingsImpactAnalyzer, getSettingsImpactAnalyzer } from './SettingsImpactAnalyzer';
