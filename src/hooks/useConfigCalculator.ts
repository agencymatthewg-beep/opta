/**
 * Phase 47: Configuration Calculator
 *
 * React hook exposing configuration calculation methods.
 */

import { useState, useCallback, useMemo } from 'react';
import {
  getConfigCalculator,
  getSynergyScorer,
  getOptimalConfigGenerator,
  getSettingsImpactAnalyzer,
  type SettingValue,
  type HardwareProfile,
  type OptimizationGoals,
  type ConstraintSolution,
  type SynergyScore,
  type OptimalConfig,
  type SettingImpactAnalysis,
  type BatchImpactAnalysis,
  type ConfigComparison,
  type SettingConstraint,
  type SettingRelationship,
} from '../lib/calculator';

/**
 * Default hardware profile for when none is provided.
 */
const DEFAULT_HARDWARE_PROFILE: HardwareProfile = {
  platform: typeof window !== 'undefined' && navigator.userAgent.includes('Mac') ? 'macos' : 'windows',
  gpu: 'Unknown GPU',
  vramGb: 8,
  cpu: 'Unknown CPU',
  ramGb: 16,
  onBattery: false,
  isAppleSilicon: false,
  targetFps: 60,
  resolution: '1920x1080',
  refreshRate: 60,
};

export interface UseConfigCalculatorResult {
  /** Calculate synergy score for a configuration */
  calculateSynergyScore: (settings: SettingValue[], profile?: HardwareProfile) => SynergyScore;
  /** Solve constraints for a configuration */
  solveConstraints: (settings: SettingValue[], profile?: HardwareProfile) => ConstraintSolution;
  /** Generate optimal configuration for a target profile */
  generateOptimalConfig: (
    profile?: HardwareProfile,
    target?: 'max_fps' | 'balanced' | 'quality' | 'battery' | 'competitive'
  ) => OptimalConfig;
  /** Generate all preset configurations */
  generateAllPresets: (profile?: HardwareProfile) => OptimalConfig[];
  /** Generate custom configuration based on goals */
  generateCustomConfig: (goals: OptimizationGoals, profile?: HardwareProfile) => OptimalConfig;
  /** Analyze impact of a setting change */
  analyzeSettingChange: (
    currentSettings: SettingValue[],
    setting: SettingValue,
    newValue: string | number | boolean,
    profile?: HardwareProfile
  ) => SettingImpactAnalysis;
  /** Analyze impact of multiple setting changes */
  analyzeBatchChanges: (
    currentSettings: SettingValue[],
    changes: Array<{ setting: SettingValue; newValue: string | number | boolean }>,
    profile?: HardwareProfile
  ) => BatchImpactAnalysis;
  /** Compare two configurations */
  compareConfigurations: (
    configA: SettingValue[],
    configB: SettingValue[],
    profile?: HardwareProfile
  ) => ConfigComparison;
  /** Check if a change would violate constraints */
  wouldViolateConstraints: (
    currentSettings: SettingValue[],
    change: SettingValue,
    profile?: HardwareProfile
  ) => { violates: boolean; violations: SettingConstraint[] };
  /** Find active synergies in a configuration */
  findActiveSynergies: (settings: SettingValue[], profile?: HardwareProfile) => SettingRelationship[];
  /** Find active conflicts in a configuration */
  findActiveConflicts: (settings: SettingValue[], profile?: HardwareProfile) => SettingRelationship[];
  /** Find potential synergies that could be enabled */
  findPotentialSynergies: (settings: SettingValue[]) => SettingRelationship[];
  /** Get all known synergies */
  getAllSynergies: () => SettingRelationship[];
  /** Get all known conflicts */
  getAllConflicts: () => SettingRelationship[];
  /** Set optimization goals */
  setGoals: (goals: OptimizationGoals) => void;
  /** Current optimization goals */
  goals: OptimizationGoals;
  /** Current hardware profile */
  hardwareProfile: HardwareProfile;
  /** Update hardware profile */
  setHardwareProfile: (profile: HardwareProfile) => void;
  /** Loading state */
  loading: boolean;
  /** Last error */
  error: string | null;
}

/**
 * Hook for configuration calculation operations.
 *
 * @param initialProfile - Optional initial hardware profile
 * @param initialGoals - Optional initial optimization goals
 */
export function useConfigCalculator(
  initialProfile?: HardwareProfile,
  initialGoals?: OptimizationGoals
): UseConfigCalculatorResult {
  const [hardwareProfile, setHardwareProfile] = useState<HardwareProfile>(
    initialProfile ?? DEFAULT_HARDWARE_PROFILE
  );
  const [goals, setGoalsState] = useState<OptimizationGoals>(
    initialGoals ?? {
      performance: 0.4,
      quality: 0.3,
      latency: 0.2,
      power: 0.1,
    }
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get service instances
  const calculator = useMemo(() => getConfigCalculator(), []);
  const scorer = useMemo(() => getSynergyScorer(), []);
  const generator = useMemo(() => getOptimalConfigGenerator(), []);
  const analyzer = useMemo(() => getSettingsImpactAnalyzer(), []);

  // Set goals on calculator when they change
  const setGoals = useCallback((newGoals: OptimizationGoals) => {
    setGoalsState(newGoals);
    calculator.setGoals(newGoals);
  }, [calculator]);

  // Calculate synergy score
  const calculateSynergyScore = useCallback(
    (settings: SettingValue[], profile?: HardwareProfile): SynergyScore => {
      try {
        return scorer.calculateScore(settings, profile ?? hardwareProfile);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return {
          totalScore: 0,
          breakdown: {},
          activeSynergies: [],
          activeConflicts: [],
          recommendations: [],
        };
      }
    },
    [scorer, hardwareProfile]
  );

  // Solve constraints
  const solveConstraints = useCallback(
    (settings: SettingValue[], profile?: HardwareProfile): ConstraintSolution => {
      setLoading(true);
      try {
        const result = calculator.solve(settings, profile ?? hardwareProfile);
        setError(null);
        return result;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return {
          feasible: false,
          settings,
          unsatisfiedConstraints: [],
          score: 0,
          explanation: ['Error during constraint solving'],
        };
      } finally {
        setLoading(false);
      }
    },
    [calculator, hardwareProfile]
  );

  // Generate optimal config
  const generateOptimalConfig = useCallback(
    (
      profile?: HardwareProfile,
      target: 'max_fps' | 'balanced' | 'quality' | 'battery' | 'competitive' = 'balanced'
    ): OptimalConfig => {
      setLoading(true);
      try {
        const result = generator.generate(profile ?? hardwareProfile, target);
        setError(null);
        return result;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [generator, hardwareProfile]
  );

  // Generate all presets
  const generateAllPresets = useCallback(
    (profile?: HardwareProfile): OptimalConfig[] => {
      setLoading(true);
      try {
        const result = generator.generateAllPresets(profile ?? hardwareProfile);
        setError(null);
        return result;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return [];
      } finally {
        setLoading(false);
      }
    },
    [generator, hardwareProfile]
  );

  // Generate custom config
  const generateCustomConfig = useCallback(
    (customGoals: OptimizationGoals, profile?: HardwareProfile): OptimalConfig => {
      setLoading(true);
      try {
        const result = generator.generateCustom(profile ?? hardwareProfile, customGoals);
        setError(null);
        return result;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [generator, hardwareProfile]
  );

  // Analyze setting change
  const analyzeSettingChange = useCallback(
    (
      currentSettings: SettingValue[],
      setting: SettingValue,
      newValue: string | number | boolean,
      profile?: HardwareProfile
    ): SettingImpactAnalysis => {
      try {
        return analyzer.analyzeChange(currentSettings, setting, newValue, profile ?? hardwareProfile);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return {
          setting,
          newValue,
          directImpact: {},
          enabledSynergies: [],
          disabledSynergies: [],
          newConflicts: [],
          resolvedConflicts: [],
          netImpact: {},
          recommendation: 'neutral',
          explanation: ['Error during analysis'],
        };
      }
    },
    [analyzer, hardwareProfile]
  );

  // Analyze batch changes
  const analyzeBatchChanges = useCallback(
    (
      currentSettings: SettingValue[],
      changes: Array<{ setting: SettingValue; newValue: string | number | boolean }>,
      profile?: HardwareProfile
    ): BatchImpactAnalysis => {
      try {
        return analyzer.analyzeBatch(currentSettings, changes, profile ?? hardwareProfile);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return {
          changes: [],
          combinedImpact: {},
          combinedSynergyScore: {
            totalScore: 0,
            breakdown: {},
            activeSynergies: [],
            activeConflicts: [],
            recommendations: [],
          },
          overallRecommendation: 'neutral',
          summary: ['Error during batch analysis'],
        };
      }
    },
    [analyzer, hardwareProfile]
  );

  // Compare configurations
  const compareConfigurations = useCallback(
    (
      configA: SettingValue[],
      configB: SettingValue[],
      profile?: HardwareProfile
    ): ConfigComparison => {
      try {
        return analyzer.compareConfigs(configA, configB, profile ?? hardwareProfile);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return {
          configA,
          configB,
          impactDifference: {},
          differences: [],
          betterFor: { performance: 'equal', quality: 'equal', latency: 'equal', power: 'equal' },
          summary: 'Error during comparison',
        };
      }
    },
    [analyzer, hardwareProfile]
  );

  // Check constraint violations
  const wouldViolateConstraints = useCallback(
    (
      currentSettings: SettingValue[],
      change: SettingValue,
      profile?: HardwareProfile
    ): { violates: boolean; violations: SettingConstraint[] } => {
      try {
        return calculator.wouldViolateConstraints(
          currentSettings,
          change,
          profile ?? hardwareProfile
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return { violates: false, violations: [] };
      }
    },
    [calculator, hardwareProfile]
  );

  // Find active synergies
  const findActiveSynergies = useCallback(
    (settings: SettingValue[], profile?: HardwareProfile): SettingRelationship[] => {
      return scorer.findActiveSynergies(settings, profile ?? hardwareProfile);
    },
    [scorer, hardwareProfile]
  );

  // Find active conflicts
  const findActiveConflicts = useCallback(
    (settings: SettingValue[], profile?: HardwareProfile): SettingRelationship[] => {
      return scorer.findActiveConflicts(settings, profile ?? hardwareProfile);
    },
    [scorer, hardwareProfile]
  );

  // Find potential synergies
  const findPotentialSynergies = useCallback(
    (settings: SettingValue[]): SettingRelationship[] => {
      return scorer.findPotentialSynergies(settings);
    },
    [scorer]
  );

  // Get all synergies
  const getAllSynergies = useCallback((): SettingRelationship[] => {
    return scorer.getAllSynergies();
  }, [scorer]);

  // Get all conflicts
  const getAllConflicts = useCallback((): SettingRelationship[] => {
    return scorer.getAllConflicts();
  }, [scorer]);

  return {
    calculateSynergyScore,
    solveConstraints,
    generateOptimalConfig,
    generateAllPresets,
    generateCustomConfig,
    analyzeSettingChange,
    analyzeBatchChanges,
    compareConfigurations,
    wouldViolateConstraints,
    findActiveSynergies,
    findActiveConflicts,
    findPotentialSynergies,
    getAllSynergies,
    getAllConflicts,
    setGoals,
    goals,
    hardwareProfile,
    setHardwareProfile,
    loading,
    error,
  };
}

export default useConfigCalculator;
