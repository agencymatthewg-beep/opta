/**
 * Phase 47: Configuration Calculator
 *
 * ConfigCalculator provides a constraint solver for finding valid
 * settings configurations that satisfy all requirements.
 */

import type {
  SettingValue,
  SettingConstraint,
  ConstraintSolution,
  HardwareProfile,
  OptimizationGoals,
  ImpactMetrics,
} from './types';
import { getSynergyScorer } from './SynergyScorer';

// SolverState interface reserved for future advanced constraint solving

/**
 * ConfigCalculator - Constraint solver for settings optimization.
 *
 * Handles:
 * - Solving constraint systems to find valid configurations
 * - Scoring configurations based on optimization goals
 * - Finding the best configuration among feasible solutions
 * - Handling hardware-specific constraints
 */
export class ConfigCalculator {
  private constraints: SettingConstraint[] = [];
  private goals: OptimizationGoals = {
    performance: 0.4,
    quality: 0.3,
    latency: 0.2,
    power: 0.1,
  };

  constructor() {
    this.initializeDefaultConstraints();
  }

  /**
   * Initialize default platform-agnostic constraints.
   */
  private initializeDefaultConstraints(): void {
    this.constraints = [
      // V-Sync and frame cap constraint
      {
        category: 'display',
        setting: 'frame-cap',
        constraintType: 'depends_on',
        dependsOn: { category: 'display', setting: 'vsync', value: 'off' },
        reason: 'Frame cap is most effective when V-Sync is disabled',
        weight: 0.5,
      },
      // Ray tracing requires capable GPU
      {
        category: 'rt',
        setting: 'enabled',
        constraintType: 'depends_on',
        dependsOn: { category: 'hardware', setting: 'rt-capable', value: 'true' },
        reason: 'Ray tracing requires hardware RT support',
        weight: 1.0,
      },
      // DLSS requires NVIDIA GPU
      {
        category: 'upscaling',
        setting: 'dlss',
        constraintType: 'depends_on',
        dependsOn: { category: 'hardware', setting: 'vendor', value: 'nvidia' },
        reason: 'DLSS requires NVIDIA RTX GPU',
        weight: 1.0,
      },
      // MetalFX requires Apple Silicon
      {
        category: 'upscaling',
        setting: 'metalfx',
        constraintType: 'depends_on',
        dependsOn: { category: 'hardware', setting: 'apple-silicon', value: 'true' },
        reason: 'MetalFX requires Apple Silicon',
        weight: 1.0,
      },
      // High textures require sufficient VRAM
      {
        category: 'graphics',
        setting: 'textures',
        constraintType: 'depends_on',
        dependsOn: { category: 'hardware', setting: 'vram-gb', value: '8' },
        reason: 'High/Ultra textures require 8GB+ VRAM',
        weight: 0.8,
      },
    ];
  }

  /**
   * Set optimization goals.
   */
  setGoals(goals: OptimizationGoals): void {
    this.goals = goals;
  }

  /**
   * Add a constraint.
   */
  addConstraint(constraint: SettingConstraint): void {
    this.constraints.push(constraint);
  }

  /**
   * Remove a constraint by category and setting.
   */
  removeConstraint(category: string, setting: string): boolean {
    const index = this.constraints.findIndex(
      c => c.category === category && c.setting === setting
    );
    if (index >= 0) {
      this.constraints.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get all current constraints.
   */
  getConstraints(): SettingConstraint[] {
    return [...this.constraints];
  }

  /**
   * Solve constraints to find the best valid configuration.
   */
  solve(
    baseSettings: SettingValue[],
    hardwareProfile: HardwareProfile
  ): ConstraintSolution {
    // Generate hardware-derived settings for constraint checking
    const hardwareSettings = this.deriveHardwareSettings(hardwareProfile);
    const allSettings = [...baseSettings, ...hardwareSettings];

    // Check each constraint
    const { satisfied, unsatisfied } = this.evaluateConstraints(allSettings);

    // If all constraints are satisfied, we have a solution
    if (unsatisfied.length === 0) {
      const score = this.scoreConfiguration(baseSettings, hardwareProfile);
      return {
        feasible: true,
        settings: baseSettings,
        unsatisfiedConstraints: [],
        score,
        explanation: ['All constraints satisfied'],
      };
    }

    // Try to fix unsatisfied constraints
    const fixedSettings = this.tryFixConstraints(baseSettings, unsatisfied, hardwareProfile);
    const { unsatisfied: stillUnsatisfied } = this.evaluateConstraints([
      ...fixedSettings,
      ...hardwareSettings,
    ]);

    const score = this.scoreConfiguration(fixedSettings, hardwareProfile);
    const feasible = stillUnsatisfied.filter(c => c.weight >= 1.0).length === 0;

    return {
      feasible,
      settings: fixedSettings,
      unsatisfiedConstraints: stillUnsatisfied,
      score,
      explanation: this.generateExplanation(satisfied, stillUnsatisfied, fixedSettings),
    };
  }

  /**
   * Derive hardware settings for constraint checking.
   */
  private deriveHardwareSettings(profile: HardwareProfile): SettingValue[] {
    const settings: SettingValue[] = [];

    // Platform
    settings.push({ category: 'hardware', setting: 'platform', value: profile.platform });

    // GPU vendor detection
    const gpuLower = profile.gpu.toLowerCase();
    let vendor = 'unknown';
    if (gpuLower.includes('nvidia') || gpuLower.includes('rtx') || gpuLower.includes('gtx')) {
      vendor = 'nvidia';
    } else if (gpuLower.includes('amd') || gpuLower.includes('radeon')) {
      vendor = 'amd';
    } else if (gpuLower.includes('intel') || gpuLower.includes('arc') || gpuLower.includes('iris')) {
      vendor = 'intel';
    } else if (profile.isAppleSilicon) {
      vendor = 'apple';
    }
    settings.push({ category: 'hardware', setting: 'vendor', value: vendor });

    // VRAM
    settings.push({ category: 'hardware', setting: 'vram-gb', value: profile.vramGb.toString() });

    // Apple Silicon
    settings.push({
      category: 'hardware',
      setting: 'apple-silicon',
      value: profile.isAppleSilicon ? 'true' : 'false',
    });

    // RT capability
    const rtCapable = vendor === 'nvidia' ||
      (vendor === 'amd' && profile.vramGb >= 8) ||
      (profile.isAppleSilicon && profile.chipModel?.includes('Pro'));
    settings.push({
      category: 'hardware',
      setting: 'rt-capable',
      value: rtCapable ? 'true' : 'false',
    });

    // Battery status
    settings.push({
      category: 'hardware',
      setting: 'on-battery',
      value: profile.onBattery ? 'true' : 'false',
    });

    return settings;
  }

  /**
   * Evaluate all constraints against current settings.
   */
  private evaluateConstraints(
    settings: SettingValue[]
  ): { satisfied: SettingConstraint[]; unsatisfied: SettingConstraint[] } {
    const satisfied: SettingConstraint[] = [];
    const unsatisfied: SettingConstraint[] = [];

    for (const constraint of this.constraints) {
      if (this.isConstraintSatisfied(constraint, settings)) {
        satisfied.push(constraint);
      } else {
        unsatisfied.push(constraint);
      }
    }

    return { satisfied, unsatisfied };
  }

  /**
   * Check if a single constraint is satisfied.
   */
  private isConstraintSatisfied(
    constraint: SettingConstraint,
    settings: SettingValue[]
  ): boolean {
    const currentSetting = settings.find(
      s => s.category === constraint.category && s.setting === constraint.setting
    );

    switch (constraint.constraintType) {
      case 'required':
        return currentSetting?.value === constraint.value;

      case 'forbidden':
        return currentSetting?.value !== constraint.value;

      case 'range':
        if (!currentSetting || typeof currentSetting.value !== 'number') return true;
        const num = currentSetting.value;
        const minOk = constraint.minValue === undefined || num >= constraint.minValue;
        const maxOk = constraint.maxValue === undefined || num <= constraint.maxValue;
        return minOk && maxOk;

      case 'depends_on':
        if (!constraint.dependsOn) return true;
        // If the constrained setting is not present, constraint is satisfied
        if (!currentSetting) return true;
        // Check if the dependency is met
        const dependencySetting = settings.find(
          s => s.category === constraint.dependsOn!.category &&
               s.setting === constraint.dependsOn!.setting
        );
        if (!dependencySetting) return false;
        // For numeric dependencies, check if current value meets or exceeds
        if (typeof constraint.dependsOn.value === 'string' &&
            !isNaN(Number(constraint.dependsOn.value))) {
          return Number(dependencySetting.value) >= Number(constraint.dependsOn.value);
        }
        return String(dependencySetting.value).toLowerCase() ===
               String(constraint.dependsOn.value).toLowerCase();

      default:
        return true;
    }
  }

  /**
   * Try to fix unsatisfied constraints by adjusting settings.
   */
  private tryFixConstraints(
    settings: SettingValue[],
    unsatisfied: SettingConstraint[],
    _hardwareProfile: HardwareProfile
  ): SettingValue[] {
    const fixed = [...settings];

    for (const constraint of unsatisfied) {
      // Only try to fix soft constraints (weight < 1.0)
      if (constraint.weight >= 1.0) continue;

      const settingIndex = fixed.findIndex(
        s => s.category === constraint.category && s.setting === constraint.setting
      );

      if (constraint.constraintType === 'depends_on' && constraint.dependsOn) {
        // If dependency is not met, try to enable it or disable the dependent feature
        const depIndex = fixed.findIndex(
          s => s.category === constraint.dependsOn!.category &&
               s.setting === constraint.dependsOn!.setting
        );

        if (depIndex >= 0) {
          // Try setting the dependency to the required value
          fixed[depIndex] = {
            ...fixed[depIndex],
            value: constraint.dependsOn.value,
          };
        }
      } else if (constraint.constraintType === 'required' && constraint.value !== undefined) {
        if (settingIndex >= 0) {
          fixed[settingIndex] = { ...fixed[settingIndex], value: constraint.value };
        } else {
          fixed.push({
            category: constraint.category,
            setting: constraint.setting,
            value: constraint.value,
          });
        }
      } else if (constraint.constraintType === 'forbidden' && constraint.value !== undefined) {
        if (settingIndex >= 0 && fixed[settingIndex].value === constraint.value) {
          // Remove or disable the forbidden setting
          fixed.splice(settingIndex, 1);
        }
      }
    }

    return fixed;
  }

  /**
   * Score a configuration based on optimization goals.
   */
  private scoreConfiguration(
    settings: SettingValue[],
    hardwareProfile: HardwareProfile
  ): number {
    const scorer = getSynergyScorer();
    const synergyScore = scorer.calculateScore(settings, hardwareProfile);

    // Base score from synergy analysis
    let score = synergyScore.totalScore;

    // Weight by optimization goals
    const breakdown = synergyScore.breakdown;
    score += (breakdown.performance ?? 0) * this.goals.performance;
    score += (breakdown.quality ?? 0) * this.goals.quality;
    score += (breakdown.latency ?? 0) * this.goals.latency;
    score += (breakdown.power ?? 0) * this.goals.power;

    return Math.round(score * 100) / 100;
  }

  /**
   * Generate explanation for the solution.
   */
  private generateExplanation(
    satisfied: SettingConstraint[],
    unsatisfied: SettingConstraint[],
    _settings: SettingValue[]
  ): string[] {
    const explanation: string[] = [];

    explanation.push(`${satisfied.length} constraints satisfied`);

    if (unsatisfied.length > 0) {
      explanation.push(`${unsatisfied.length} constraints could not be satisfied:`);
      for (const constraint of unsatisfied.slice(0, 3)) {
        explanation.push(`  - ${constraint.reason}`);
      }
    }

    return explanation;
  }

  /**
   * Find the optimal configuration from a set of candidates.
   */
  findOptimal(
    candidates: SettingValue[][],
    hardwareProfile: HardwareProfile
  ): { settings: SettingValue[]; score: number } | null {
    let best: { settings: SettingValue[]; score: number } | null = null;

    for (const candidate of candidates) {
      const solution = this.solve(candidate, hardwareProfile);
      if (solution.feasible) {
        if (!best || solution.score > best.score) {
          best = { settings: solution.settings, score: solution.score };
        }
      }
    }

    return best;
  }

  /**
   * Check if a specific setting change would violate any constraints.
   */
  wouldViolateConstraints(
    currentSettings: SettingValue[],
    change: SettingValue,
    hardwareProfile: HardwareProfile
  ): { violates: boolean; violations: SettingConstraint[] } {
    const newSettings = currentSettings.map(s =>
      s.category === change.category && s.setting === change.setting
        ? change
        : s
    );

    // Add the setting if it doesn't exist
    if (!newSettings.find(s => s.category === change.category && s.setting === change.setting)) {
      newSettings.push(change);
    }

    const hardwareSettings = this.deriveHardwareSettings(hardwareProfile);
    const { unsatisfied } = this.evaluateConstraints([...newSettings, ...hardwareSettings]);

    return {
      violates: unsatisfied.some(c => c.weight >= 1.0),
      violations: unsatisfied,
    };
  }

  /**
   * Get estimated impact of a configuration.
   */
  estimateImpact(settings: SettingValue[], hardwareProfile: HardwareProfile): ImpactMetrics {
    const scorer = getSynergyScorer();
    const score = scorer.calculateScore(settings, hardwareProfile);
    return score.breakdown;
  }
}

// Singleton instance
let calculatorInstance: ConfigCalculator | null = null;

/**
 * Get the ConfigCalculator singleton instance.
 */
export function getConfigCalculator(): ConfigCalculator {
  if (!calculatorInstance) {
    calculatorInstance = new ConfigCalculator();
  }
  return calculatorInstance;
}
