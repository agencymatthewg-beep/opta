/**
 * Phase 47: Configuration Calculator
 *
 * SettingsImpactAnalyzer provides detailed analysis of setting changes
 * including direct impact, synergy effects, and overall recommendations.
 */

import type {
  SettingValue,
  SettingImpactAnalysis,
  BatchImpactAnalysis,
  ConfigComparison,
  HardwareProfile,
  ImpactMetrics,
  SettingRelationship,
} from './types';
import { getSynergyScorer } from './SynergyScorer';
// getConfigCalculator reserved for future constraint integration
// import { getConfigCalculator } from './ConfigCalculator';

/**
 * Setting impact estimates for common settings.
 */
const SETTING_IMPACTS: Record<string, Record<string, Partial<ImpactMetrics>>> = {
  graphics: {
    shadows: { performance: 15, quality: 20 },
    textures: { performance: 5, quality: 25, vram: -20 },
    effects: { performance: 20, quality: 15 },
    'post-processing': { performance: 10, quality: 10 },
    'motion-blur': { performance: 3, quality: 5, latency: -5 },
    'film-grain': { performance: 2, quality: 3 },
    'depth-of-field': { performance: 8, quality: 10 },
    'ambient-occlusion': { performance: 10, quality: 15 },
    'render-scale': { performance: 40, quality: 30 },
    sharpening: { performance: 2, quality: 10 },
    aa: { performance: 8, quality: 20 },
    'volumetric-fog': { performance: 15, quality: 12 },
    'volumetric-lighting': { performance: 12, quality: 15 },
    tessellation: { performance: 10, quality: 8 },
  },
  display: {
    vsync: { latency: 15, performance: -5 },
    'frame-cap': { latency: 10, power: 20 },
    'refresh-rate': { latency: 20 },
    'low-latency-mode': { latency: 25 },
  },
  upscaling: {
    dlss: { performance: 35, quality: -10 },
    fsr: { performance: 30, quality: -15 },
    metalfx: { performance: 25, quality: -12 },
  },
  rt: {
    reflections: { performance: -30, quality: 35 },
    shadows: { performance: -25, quality: 25 },
    'ambient-occlusion': { performance: -15, quality: 20 },
    'global-illumination': { performance: -40, quality: 45 },
  },
  power: {
    'low-power-mode': { power: 50, performance: -30 },
    'high-power-mode': { power: -30, performance: 20 },
  },
  performance: {
    'nvidia-reflex': { latency: 30 },
    'ray-reconstruction': { performance: 15, quality: 10 },
  },
  quality: {
    preset: { performance: 30, quality: 30 },
  },
};

/**
 * Value scaling for different setting levels.
 */
const VALUE_SCALES: Record<string, number> = {
  off: 0,
  low: 0.3,
  medium: 0.6,
  high: 0.85,
  ultra: 1.0,
  on: 1.0,
  performance: 0.8,
  balanced: 0.6,
  quality: 0.4,
  spatial: 0.5,
  temporal: 0.7,
  'on+boost': 1.0,
};

/**
 * SettingsImpactAnalyzer - Analyzes the impact of setting changes.
 *
 * Handles:
 * - Calculating direct impact of setting changes
 * - Finding affected synergies and conflicts
 * - Generating recommendations
 * - Comparing configurations
 */
export class SettingsImpactAnalyzer {
  private scorer = getSynergyScorer();
  // Calculator reserved for future constraint checking during impact analysis
  // private calculator = getConfigCalculator();

  /**
   * Analyze the impact of changing a single setting.
   */
  analyzeChange(
    currentSettings: SettingValue[],
    setting: SettingValue,
    newValue: string | number | boolean,
    hardwareProfile: HardwareProfile
  ): SettingImpactAnalysis {
    // Calculate direct impact
    const directImpact = this.calculateDirectImpact(setting, newValue);

    // Get current synergies and conflicts
    const currentScore = this.scorer.calculateScore(currentSettings, hardwareProfile);

    // Create new settings with the change
    const newSettings = currentSettings.map(s =>
      s.category === setting.category && s.setting === setting.setting
        ? { ...s, value: newValue }
        : s
    );
    if (!newSettings.find(s => s.category === setting.category && s.setting === setting.setting)) {
      newSettings.push({ ...setting, value: newValue });
    }

    // Get new synergies and conflicts
    const newScore = this.scorer.calculateScore(newSettings, hardwareProfile);

    // Find enabled/disabled synergies
    const enabledSynergies = newScore.activeSynergies.filter(
      s => !currentScore.activeSynergies.find(cs => cs.id === s.id)
    );
    const disabledSynergies = currentScore.activeSynergies.filter(
      s => !newScore.activeSynergies.find(ns => ns.id === s.id)
    );

    // Find new/resolved conflicts
    const newConflicts = newScore.activeConflicts.filter(
      c => !currentScore.activeConflicts.find(cc => cc.id === c.id)
    );
    const resolvedConflicts = currentScore.activeConflicts.filter(
      c => !newScore.activeConflicts.find(nc => nc.id === c.id)
    );

    // Calculate net impact
    const netImpact = this.calculateNetImpact(
      directImpact,
      enabledSynergies,
      disabledSynergies,
      newConflicts,
      resolvedConflicts
    );

    // Generate recommendation
    const recommendation = this.generateRecommendation(
      netImpact,
      newConflicts.length,
      enabledSynergies.length
    );

    // Generate explanation
    const explanation = this.generateExplanation(
      setting,
      newValue,
      directImpact,
      enabledSynergies,
      disabledSynergies,
      newConflicts,
      resolvedConflicts
    );

    return {
      setting,
      newValue,
      directImpact,
      enabledSynergies,
      disabledSynergies,
      newConflicts,
      resolvedConflicts,
      netImpact,
      recommendation,
      explanation,
    };
  }

  /**
   * Analyze the impact of multiple setting changes.
   */
  analyzeBatch(
    currentSettings: SettingValue[],
    changes: Array<{ setting: SettingValue; newValue: string | number | boolean }>,
    hardwareProfile: HardwareProfile
  ): BatchImpactAnalysis {
    // Analyze each change individually
    const analyses: SettingImpactAnalysis[] = [];
    let workingSettings = [...currentSettings];

    for (const change of changes) {
      const analysis = this.analyzeChange(
        workingSettings,
        change.setting,
        change.newValue,
        hardwareProfile
      );
      analyses.push(analysis);

      // Update working settings for next iteration
      workingSettings = workingSettings.map(s =>
        s.category === change.setting.category && s.setting === change.setting.setting
          ? { ...s, value: change.newValue }
          : s
      );
    }

    // Calculate combined impact
    const combinedImpact = this.combinedImpacts(analyses.map(a => a.netImpact));

    // Get combined synergy score
    const finalSettings = currentSettings.map(s => {
      const change = changes.find(c =>
        c.setting.category === s.category && c.setting.setting === s.setting
      );
      return change ? { ...s, value: change.newValue } : s;
    });
    const combinedSynergyScore = this.scorer.calculateScore(finalSettings, hardwareProfile);

    // Generate overall recommendation
    const totalConflicts = analyses.reduce((sum, a) => sum + a.newConflicts.length, 0);
    const totalSynergies = analyses.reduce((sum, a) => sum + a.enabledSynergies.length, 0);
    const overallRecommendation = this.generateRecommendation(
      combinedImpact,
      totalConflicts,
      totalSynergies
    );

    // Generate summary
    const summary = this.generateBatchSummary(analyses, combinedImpact);

    return {
      changes: analyses,
      combinedImpact,
      combinedSynergyScore,
      overallRecommendation,
      summary,
    };
  }

  /**
   * Compare two configurations.
   */
  compareConfigs(
    configA: SettingValue[],
    configB: SettingValue[],
    hardwareProfile: HardwareProfile
  ): ConfigComparison {
    // Find differences
    const differences: ConfigComparison['differences'] = [];

    // Check all settings in A
    for (const settingA of configA) {
      const settingB = configB.find(
        s => s.category === settingA.category && s.setting === settingA.setting
      );

      if (!settingB || settingA.value !== settingB.value) {
        const impact = this.calculateDirectImpact(
          settingA,
          settingB?.value ?? settingA.value
        );
        differences.push({
          category: settingA.category,
          setting: settingA.setting,
          valueA: settingA.value,
          valueB: settingB?.value ?? 'not set',
          impact,
        });
      }
    }

    // Check settings in B that aren't in A
    for (const settingB of configB) {
      const settingA = configA.find(
        s => s.category === settingB.category && s.setting === settingB.setting
      );

      if (!settingA) {
        const impact = this.calculateDirectImpact(settingB, settingB.value);
        differences.push({
          category: settingB.category,
          setting: settingB.setting,
          valueA: 'not set',
          valueB: settingB.value,
          impact,
        });
      }
    }

    // Calculate impact difference
    const scoreA = this.scorer.calculateScore(configA, hardwareProfile);
    const scoreB = this.scorer.calculateScore(configB, hardwareProfile);

    const impactDifference: ImpactMetrics = {
      performance: (scoreB.breakdown.performance ?? 0) - (scoreA.breakdown.performance ?? 0),
      quality: (scoreB.breakdown.quality ?? 0) - (scoreA.breakdown.quality ?? 0),
      latency: (scoreB.breakdown.latency ?? 0) - (scoreA.breakdown.latency ?? 0),
      power: (scoreB.breakdown.power ?? 0) - (scoreA.breakdown.power ?? 0),
      vram: (scoreB.breakdown.vram ?? 0) - (scoreA.breakdown.vram ?? 0),
    };

    // Determine which is better for each goal
    const betterFor: ConfigComparison['betterFor'] = {
      performance: impactDifference.performance! > 5 ? 'B' : impactDifference.performance! < -5 ? 'A' : 'equal',
      quality: impactDifference.quality! > 5 ? 'B' : impactDifference.quality! < -5 ? 'A' : 'equal',
      latency: impactDifference.latency! > 5 ? 'B' : impactDifference.latency! < -5 ? 'A' : 'equal',
      power: impactDifference.power! > 5 ? 'B' : impactDifference.power! < -5 ? 'A' : 'equal',
    };

    // Generate summary
    const aBetter = Object.values(betterFor).filter(v => v === 'A').length;
    const bBetter = Object.values(betterFor).filter(v => v === 'B').length;

    let summary: string;
    if (aBetter > bBetter) {
      summary = `Configuration A is better overall, winning in ${aBetter} categories`;
    } else if (bBetter > aBetter) {
      summary = `Configuration B is better overall, winning in ${bBetter} categories`;
    } else {
      summary = `Both configurations are roughly equivalent`;
    }

    return {
      configA,
      configB,
      impactDifference,
      differences,
      betterFor,
      summary,
    };
  }

  /**
   * Calculate direct impact of changing a setting.
   */
  private calculateDirectImpact(
    setting: SettingValue,
    newValue: string | number | boolean
  ): ImpactMetrics {
    const categoryImpacts = SETTING_IMPACTS[setting.category];
    if (!categoryImpacts) return {};

    const baseImpacts = categoryImpacts[setting.setting];
    if (!baseImpacts) return {};

    // Get scale factors for old and new values
    const oldScale = this.getValueScale(setting.value);
    const newScale = this.getValueScale(newValue);
    const scaleDiff = newScale - oldScale;

    // Apply scale difference to base impacts
    const impact: ImpactMetrics = {};
    for (const [key, value] of Object.entries(baseImpacts)) {
      (impact as Record<string, number>)[key] = Math.round(value * scaleDiff * 100) / 100;
    }

    return impact;
  }

  /**
   * Get scale factor for a setting value.
   */
  private getValueScale(value: string | number | boolean): number {
    if (typeof value === 'boolean') {
      return value ? 1.0 : 0.0;
    }
    if (typeof value === 'number') {
      return Math.min(1, value / 100);
    }
    return VALUE_SCALES[value.toLowerCase()] ?? 0.5;
  }

  /**
   * Calculate net impact including synergies and conflicts.
   */
  private calculateNetImpact(
    directImpact: ImpactMetrics,
    enabledSynergies: SettingRelationship[],
    disabledSynergies: SettingRelationship[],
    newConflicts: SettingRelationship[],
    resolvedConflicts: SettingRelationship[]
  ): ImpactMetrics {
    const net: ImpactMetrics = { ...directImpact };

    // Add enabled synergy impacts
    for (const synergy of enabledSynergies) {
      for (const [key, value] of Object.entries(synergy.impact)) {
        (net as Record<string, number>)[key] = ((net as Record<string, number>)[key] ?? 0) + (value ?? 0);
      }
    }

    // Subtract disabled synergy impacts
    for (const synergy of disabledSynergies) {
      for (const [key, value] of Object.entries(synergy.impact)) {
        (net as Record<string, number>)[key] = ((net as Record<string, number>)[key] ?? 0) - (value ?? 0);
      }
    }

    // Add conflict impacts (typically negative)
    for (const conflict of newConflicts) {
      for (const [key, value] of Object.entries(conflict.impact)) {
        (net as Record<string, number>)[key] = ((net as Record<string, number>)[key] ?? 0) + (value ?? 0);
      }
    }

    // Subtract resolved conflict impacts
    for (const conflict of resolvedConflicts) {
      for (const [key, value] of Object.entries(conflict.impact)) {
        (net as Record<string, number>)[key] = ((net as Record<string, number>)[key] ?? 0) - (value ?? 0);
      }
    }

    return net;
  }

  /**
   * Combine multiple impact metrics.
   */
  private combinedImpacts(impacts: ImpactMetrics[]): ImpactMetrics {
    const combined: ImpactMetrics = {
      performance: 0,
      quality: 0,
      latency: 0,
      power: 0,
      vram: 0,
    };

    for (const impact of impacts) {
      combined.performance! += impact.performance ?? 0;
      combined.quality! += impact.quality ?? 0;
      combined.latency! += impact.latency ?? 0;
      combined.power! += impact.power ?? 0;
      combined.vram! += impact.vram ?? 0;
    }

    return combined;
  }

  /**
   * Generate a recommendation based on impact.
   */
  private generateRecommendation(
    impact: ImpactMetrics,
    conflictCount: number,
    synergyCount: number
  ): 'recommended' | 'neutral' | 'not_recommended' {
    // Calculate overall score
    let score = 0;
    score += (impact.performance ?? 0) * 0.3;
    score += (impact.quality ?? 0) * 0.25;
    score += (impact.latency ?? 0) * 0.2;
    score += (impact.power ?? 0) * 0.1;
    score += (impact.vram ?? 0) * 0.1;

    // Adjust for synergies and conflicts
    score += synergyCount * 5;
    score -= conflictCount * 10;

    if (score > 10 && conflictCount === 0) return 'recommended';
    if (score < -10 || conflictCount > 1) return 'not_recommended';
    return 'neutral';
  }

  /**
   * Generate explanation for a setting change.
   */
  private generateExplanation(
    setting: SettingValue,
    newValue: string | number | boolean,
    directImpact: ImpactMetrics,
    enabledSynergies: SettingRelationship[],
    disabledSynergies: SettingRelationship[],
    newConflicts: SettingRelationship[],
    resolvedConflicts: SettingRelationship[]
  ): string[] {
    const explanation: string[] = [];

    // Direct impact
    const impactParts: string[] = [];
    if (directImpact.performance) {
      impactParts.push(`${directImpact.performance > 0 ? '+' : ''}${directImpact.performance}% performance`);
    }
    if (directImpact.quality) {
      impactParts.push(`${directImpact.quality > 0 ? '+' : ''}${directImpact.quality}% quality`);
    }
    if (directImpact.latency) {
      impactParts.push(`${directImpact.latency > 0 ? '+' : ''}${directImpact.latency}% latency improvement`);
    }

    if (impactParts.length > 0) {
      explanation.push(`Changing ${setting.setting} to ${newValue}: ${impactParts.join(', ')}`);
    }

    // Synergies
    if (enabledSynergies.length > 0) {
      explanation.push(`✅ Enables ${enabledSynergies.length} synergies:`);
      enabledSynergies.slice(0, 2).forEach(s => explanation.push(`  - ${s.description}`));
    }

    if (disabledSynergies.length > 0) {
      explanation.push(`⚠️ Disables ${disabledSynergies.length} synergies`);
    }

    // Conflicts
    if (newConflicts.length > 0) {
      explanation.push(`❌ Creates ${newConflicts.length} conflicts:`);
      newConflicts.slice(0, 2).forEach(c => explanation.push(`  - ${c.description}`));
    }

    if (resolvedConflicts.length > 0) {
      explanation.push(`✅ Resolves ${resolvedConflicts.length} conflicts`);
    }

    return explanation;
  }

  /**
   * Generate summary for batch analysis.
   */
  private generateBatchSummary(
    analyses: SettingImpactAnalysis[],
    combinedImpact: ImpactMetrics
  ): string[] {
    const summary: string[] = [];

    summary.push(`${analyses.length} setting changes analyzed`);

    // Performance summary
    if (combinedImpact.performance) {
      const direction = combinedImpact.performance > 0 ? 'increase' : 'decrease';
      summary.push(`Expected ${Math.abs(combinedImpact.performance)}% performance ${direction}`);
    }

    // Quality summary
    if (combinedImpact.quality) {
      const direction = combinedImpact.quality > 0 ? 'improvement' : 'reduction';
      summary.push(`Expected ${Math.abs(combinedImpact.quality)}% quality ${direction}`);
    }

    // Count recommendations
    const recommended = analyses.filter(a => a.recommendation === 'recommended').length;
    const notRecommended = analyses.filter(a => a.recommendation === 'not_recommended').length;

    if (recommended > 0) summary.push(`${recommended} changes are recommended`);
    if (notRecommended > 0) summary.push(`${notRecommended} changes are not recommended`);

    return summary;
  }
}

// Singleton instance
let analyzerInstance: SettingsImpactAnalyzer | null = null;

/**
 * Get the SettingsImpactAnalyzer singleton instance.
 */
export function getSettingsImpactAnalyzer(): SettingsImpactAnalyzer {
  if (!analyzerInstance) {
    analyzerInstance = new SettingsImpactAnalyzer();
  }
  return analyzerInstance;
}
