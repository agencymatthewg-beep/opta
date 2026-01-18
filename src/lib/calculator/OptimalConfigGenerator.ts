/**
 * Phase 47: Configuration Calculator
 *
 * OptimalConfigGenerator produces best configurations for different
 * hardware profiles and optimization targets.
 */

import type {
  SettingValue,
  HardwareProfile,
  OptimalConfig,
  OptimizationGoals,
  ImpactMetrics,
} from './types';
import { getConfigCalculator } from './ConfigCalculator';
import { getSynergyScorer } from './SynergyScorer';

/**
 * Preset configuration template.
 */
interface PresetTemplate {
  name: string;
  description: string;
  targetProfile: 'max_fps' | 'balanced' | 'quality' | 'battery' | 'competitive';
  goals: OptimizationGoals;
  baseSettings: SettingValue[];
  platformOverrides?: Record<string, SettingValue[]>;
}

/**
 * OptimalConfigGenerator - Produces best configurations for hardware profiles.
 *
 * Handles:
 * - Generating preset configurations (max_fps, balanced, quality, battery, competitive)
 * - Platform-specific optimizations
 * - Hardware capability matching
 * - Combining multiple optimization sources
 */
export class OptimalConfigGenerator {
  private presets: PresetTemplate[] = [];

  constructor() {
    this.initializePresets();
  }

  /**
   * Initialize preset configuration templates.
   */
  private initializePresets(): void {
    this.presets = [
      // Max FPS Preset
      {
        name: 'Maximum Performance',
        description: 'Prioritize frame rate above all else',
        targetProfile: 'max_fps',
        goals: { performance: 0.7, quality: 0.1, latency: 0.15, power: 0.05 },
        baseSettings: [
          { category: 'quality', setting: 'preset', value: 'low' },
          { category: 'graphics', setting: 'shadows', value: 'low' },
          { category: 'graphics', setting: 'textures', value: 'medium' },
          { category: 'graphics', setting: 'effects', value: 'low' },
          { category: 'graphics', setting: 'post-processing', value: 'off' },
          { category: 'graphics', setting: 'motion-blur', value: 'off' },
          { category: 'graphics', setting: 'film-grain', value: 'off' },
          { category: 'graphics', setting: 'depth-of-field', value: 'off' },
          { category: 'graphics', setting: 'render-scale', value: '75' },
          { category: 'display', setting: 'vsync', value: 'off' },
        ],
        platformOverrides: {
          windows: [
            { category: 'upscaling', setting: 'dlss', value: 'performance' },
            { category: 'performance', setting: 'nvidia-reflex', value: 'on+boost' },
          ],
          macos: [
            { category: 'upscaling', setting: 'metalfx', value: 'performance' },
            { category: 'power', setting: 'high-power-mode', value: 'on' },
          ],
        },
      },

      // Balanced Preset
      {
        name: 'Balanced',
        description: 'Good mix of visual quality and performance',
        targetProfile: 'balanced',
        goals: { performance: 0.4, quality: 0.35, latency: 0.15, power: 0.1 },
        baseSettings: [
          { category: 'quality', setting: 'preset', value: 'medium' },
          { category: 'graphics', setting: 'shadows', value: 'medium' },
          { category: 'graphics', setting: 'textures', value: 'high' },
          { category: 'graphics', setting: 'effects', value: 'medium' },
          { category: 'graphics', setting: 'post-processing', value: 'medium' },
          { category: 'graphics', setting: 'motion-blur', value: 'off' },
          { category: 'graphics', setting: 'aa', value: 'taa' },
          { category: 'graphics', setting: 'sharpening', value: '50' },
          { category: 'display', setting: 'vsync', value: 'off' },
          { category: 'display', setting: 'frame-cap', value: '120' },
        ],
        platformOverrides: {
          windows: [
            { category: 'upscaling', setting: 'dlss', value: 'balanced' },
          ],
          macos: [
            { category: 'upscaling', setting: 'metalfx', value: 'temporal' },
          ],
        },
      },

      // Quality Preset
      {
        name: 'Maximum Quality',
        description: 'Best visual fidelity with acceptable performance',
        targetProfile: 'quality',
        goals: { performance: 0.2, quality: 0.6, latency: 0.1, power: 0.1 },
        baseSettings: [
          { category: 'quality', setting: 'preset', value: 'high' },
          { category: 'graphics', setting: 'shadows', value: 'high' },
          { category: 'graphics', setting: 'textures', value: 'high' },
          { category: 'graphics', setting: 'effects', value: 'high' },
          { category: 'graphics', setting: 'post-processing', value: 'high' },
          { category: 'graphics', setting: 'aa', value: 'taa' },
          { category: 'graphics', setting: 'sharpening', value: '30' },
          { category: 'graphics', setting: 'ambient-occlusion', value: 'hbao' },
          { category: 'display', setting: 'vsync', value: 'off' },
          { category: 'display', setting: 'frame-cap', value: '60' },
        ],
        platformOverrides: {
          windows: [
            { category: 'upscaling', setting: 'dlss', value: 'quality' },
            { category: 'rt', setting: 'reflections', value: 'on' },
          ],
          macos: [
            { category: 'upscaling', setting: 'metalfx', value: 'temporal' },
          ],
        },
      },

      // Battery Preset
      {
        name: 'Battery Saver',
        description: 'Extended battery life for portable gaming',
        targetProfile: 'battery',
        goals: { performance: 0.2, quality: 0.2, latency: 0.1, power: 0.5 },
        baseSettings: [
          { category: 'quality', setting: 'preset', value: 'low' },
          { category: 'graphics', setting: 'shadows', value: 'low' },
          { category: 'graphics', setting: 'textures', value: 'medium' },
          { category: 'graphics', setting: 'effects', value: 'low' },
          { category: 'graphics', setting: 'render-scale', value: '75' },
          { category: 'display', setting: 'frame-cap', value: '30' },
          { category: 'display', setting: 'vsync', value: 'on' },
        ],
        platformOverrides: {
          macos: [
            { category: 'power', setting: 'low-power-mode', value: 'on' },
            { category: 'display', setting: 'refresh-rate', value: '60' },
            { category: 'upscaling', setting: 'metalfx', value: 'spatial' },
          ],
          windows: [
            { category: 'power', setting: 'power-plan', value: 'power-saver' },
          ],
        },
      },

      // Competitive Preset
      {
        name: 'Competitive',
        description: 'Minimum input latency for competitive gaming',
        targetProfile: 'competitive',
        goals: { performance: 0.4, quality: 0.05, latency: 0.5, power: 0.05 },
        baseSettings: [
          { category: 'quality', setting: 'preset', value: 'low' },
          { category: 'graphics', setting: 'shadows', value: 'off' },
          { category: 'graphics', setting: 'textures', value: 'low' },
          { category: 'graphics', setting: 'effects', value: 'low' },
          { category: 'graphics', setting: 'post-processing', value: 'off' },
          { category: 'graphics', setting: 'motion-blur', value: 'off' },
          { category: 'graphics', setting: 'film-grain', value: 'off' },
          { category: 'graphics', setting: 'depth-of-field', value: 'off' },
          { category: 'graphics', setting: 'chromatic-aberration', value: 'off' },
          { category: 'graphics', setting: 'render-scale', value: '75' },
          { category: 'display', setting: 'vsync', value: 'off' },
          { category: 'display', setting: 'low-latency-mode', value: 'ultra' },
        ],
        platformOverrides: {
          windows: [
            { category: 'performance', setting: 'nvidia-reflex', value: 'on+boost' },
            { category: 'display', setting: 'refresh-rate', value: '240' },
          ],
        },
      },
    ];
  }

  /**
   * Generate an optimal configuration for a hardware profile.
   */
  generate(
    hardwareProfile: HardwareProfile,
    targetProfile: 'max_fps' | 'balanced' | 'quality' | 'battery' | 'competitive' = 'balanced'
  ): OptimalConfig {
    const preset = this.presets.find(p => p.targetProfile === targetProfile);
    if (!preset) {
      throw new Error(`Unknown target profile: ${targetProfile}`);
    }

    // Start with base settings
    let settings = [...preset.baseSettings];

    // Apply platform-specific overrides
    if (preset.platformOverrides?.[hardwareProfile.platform]) {
      const overrides = preset.platformOverrides[hardwareProfile.platform];
      for (const override of overrides) {
        // Replace if exists, otherwise add
        const index = settings.findIndex(
          s => s.category === override.category && s.setting === override.setting
        );
        if (index >= 0) {
          settings[index] = override;
        } else {
          settings.push(override);
        }
      }
    }

    // Apply hardware-specific adjustments
    settings = this.applyHardwareAdjustments(settings, hardwareProfile, preset.goals);

    // Validate through constraint solver
    const calculator = getConfigCalculator();
    calculator.setGoals(preset.goals);
    const solution = calculator.solve(settings, hardwareProfile);

    // Calculate synergy score
    const scorer = getSynergyScorer();
    const synergyScore = scorer.calculateScore(solution.settings, hardwareProfile);

    // Calculate expected impact
    const expectedImpact = this.calculateExpectedImpact(solution.settings, hardwareProfile);

    // Generate trade-offs description
    const tradeoffs = this.identifyTradeoffs(preset.goals);

    return {
      id: `${targetProfile}-${hardwareProfile.platform}-${Date.now()}`,
      name: preset.name,
      description: preset.description,
      settings: solution.settings,
      expectedImpact,
      synergyScore,
      targetProfile,
      confidence: solution.feasible ? 0.85 : 0.6,
      tradeoffs,
    };
  }

  /**
   * Apply hardware-specific adjustments to settings.
   */
  private applyHardwareAdjustments(
    settings: SettingValue[],
    profile: HardwareProfile,
    goals: OptimizationGoals
  ): SettingValue[] {
    const adjusted = [...settings];

    // Adjust textures based on VRAM
    if (profile.vramGb < 4) {
      this.setSetting(adjusted, 'graphics', 'textures', 'low');
    } else if (profile.vramGb < 8) {
      this.setSetting(adjusted, 'graphics', 'textures', 'medium');
    } else if (profile.vramGb >= 12 && goals.quality > 0.3) {
      this.setSetting(adjusted, 'graphics', 'textures', 'ultra');
    }

    // Adjust frame cap based on refresh rate
    if (profile.refreshRate >= 144 && goals.latency > 0.3) {
      this.setSetting(adjusted, 'display', 'frame-cap', profile.refreshRate.toString());
    }

    // Adjust render scale based on resolution
    if (profile.resolution.includes('4k') || profile.resolution.includes('3840')) {
      // 4K needs upscaling for most hardware
      const currentScale = this.getSetting(adjusted, 'graphics', 'render-scale');
      if (!currentScale || Number(currentScale) > 75) {
        this.setSetting(adjusted, 'graphics', 'render-scale', '75');
      }
    }

    // Battery mode adjustments
    if (profile.onBattery) {
      this.setSetting(adjusted, 'display', 'frame-cap', '30');
      if (profile.isAppleSilicon) {
        this.setSetting(adjusted, 'power', 'low-power-mode', 'on');
      }
    }

    // Apple Silicon specific
    if (profile.isAppleSilicon && profile.chipModel) {
      // M3+ gets better MetalFX support
      if (profile.chipModel.includes('M3') || profile.chipModel.includes('M4')) {
        if (goals.quality > 0.3) {
          this.setSetting(adjusted, 'upscaling', 'metalfx', 'temporal');
        }
      }
    }

    return adjusted;
  }

  /**
   * Calculate expected impact of a configuration.
   */
  private calculateExpectedImpact(
    settings: SettingValue[],
    hardwareProfile: HardwareProfile
  ): ImpactMetrics {
    const scorer = getSynergyScorer();
    const score = scorer.calculateScore(settings, hardwareProfile);

    // Estimate base impacts from settings
    const baseImpact: ImpactMetrics = {
      performance: 0,
      quality: 0,
      latency: 0,
      power: 0,
      vram: 0,
    };

    // Estimate from quality preset
    const preset = this.getSetting(settings, 'quality', 'preset');
    if (preset) {
      switch (preset) {
        case 'low':
          baseImpact.performance = 60;
          baseImpact.quality = -40;
          break;
        case 'medium':
          baseImpact.performance = 30;
          baseImpact.quality = -10;
          break;
        case 'high':
          baseImpact.performance = -10;
          baseImpact.quality = 30;
          break;
        case 'ultra':
          baseImpact.performance = -30;
          baseImpact.quality = 50;
          break;
      }
    }

    // Estimate from frame cap
    const frameCap = this.getSetting(settings, 'display', 'frame-cap');
    if (frameCap) {
      const cap = Number(frameCap);
      if (cap <= 30) baseImpact.power = (baseImpact.power ?? 0) + 50;
      else if (cap <= 60) baseImpact.power = (baseImpact.power ?? 0) + 20;
    }

    // Combine with synergy impacts
    return {
      performance: (baseImpact.performance ?? 0) + (score.breakdown.performance ?? 0),
      quality: (baseImpact.quality ?? 0) + (score.breakdown.quality ?? 0),
      latency: (baseImpact.latency ?? 0) + (score.breakdown.latency ?? 0),
      power: (baseImpact.power ?? 0) + (score.breakdown.power ?? 0),
      vram: (baseImpact.vram ?? 0) + (score.breakdown.vram ?? 0),
    };
  }

  /**
   * Identify trade-offs based on optimization goals.
   */
  private identifyTradeoffs(goals: OptimizationGoals): string[] {
    const tradeoffs: string[] = [];

    if (goals.performance > 0.5) {
      tradeoffs.push('Visual quality reduced for higher frame rates');
    }
    if (goals.quality > 0.5) {
      tradeoffs.push('Frame rate may be lower to preserve visual fidelity');
    }
    if (goals.latency > 0.3) {
      tradeoffs.push('Some visual features disabled to minimize input delay');
    }
    if (goals.power > 0.3) {
      tradeoffs.push('Performance limited to extend battery life');
    }

    return tradeoffs;
  }

  /**
   * Generate all preset configurations for a hardware profile.
   */
  generateAllPresets(hardwareProfile: HardwareProfile): OptimalConfig[] {
    const profiles: Array<'max_fps' | 'balanced' | 'quality' | 'battery' | 'competitive'> = [
      'max_fps',
      'balanced',
      'quality',
      'battery',
      'competitive',
    ];

    return profiles.map(profile => this.generate(hardwareProfile, profile));
  }

  /**
   * Generate a custom configuration based on specific goals.
   */
  generateCustom(
    hardwareProfile: HardwareProfile,
    goals: OptimizationGoals
  ): OptimalConfig {
    // Find the closest preset as a starting point
    let closestPreset = this.presets[0];
    let minDistance = Infinity;

    for (const preset of this.presets) {
      const distance =
        Math.abs(preset.goals.performance - goals.performance) +
        Math.abs(preset.goals.quality - goals.quality) +
        Math.abs(preset.goals.latency - goals.latency) +
        Math.abs(preset.goals.power - goals.power);

      if (distance < minDistance) {
        minDistance = distance;
        closestPreset = preset;
      }
    }

    // Generate from closest preset
    let settings = [...closestPreset.baseSettings];

    // Apply platform overrides
    if (closestPreset.platformOverrides?.[hardwareProfile.platform]) {
      settings = [...settings, ...closestPreset.platformOverrides[hardwareProfile.platform]];
    }

    // Apply custom adjustments
    settings = this.applyHardwareAdjustments(settings, hardwareProfile, goals);

    // Validate
    const calculator = getConfigCalculator();
    calculator.setGoals(goals);
    const solution = calculator.solve(settings, hardwareProfile);

    // Calculate scores
    const scorer = getSynergyScorer();
    const synergyScore = scorer.calculateScore(solution.settings, hardwareProfile);
    const expectedImpact = this.calculateExpectedImpact(solution.settings, hardwareProfile);
    const tradeoffs = this.identifyTradeoffs(goals);

    return {
      id: `custom-${hardwareProfile.platform}-${Date.now()}`,
      name: 'Custom Configuration',
      description: 'Configuration optimized for your specific goals',
      settings: solution.settings,
      expectedImpact,
      synergyScore,
      targetProfile: 'balanced', // Custom maps to balanced
      confidence: solution.feasible ? 0.8 : 0.5,
      tradeoffs,
    };
  }

  /**
   * Helper to set a setting value.
   */
  private setSetting(
    settings: SettingValue[],
    category: string,
    setting: string,
    value: string | number | boolean
  ): void {
    const index = settings.findIndex(s => s.category === category && s.setting === setting);
    if (index >= 0) {
      settings[index] = { ...settings[index], value };
    } else {
      settings.push({ category, setting, value });
    }
  }

  /**
   * Helper to get a setting value.
   */
  private getSetting(
    settings: SettingValue[],
    category: string,
    setting: string
  ): string | number | boolean | undefined {
    return settings.find(s => s.category === category && s.setting === setting)?.value;
  }
}

// Singleton instance
let generatorInstance: OptimalConfigGenerator | null = null;

/**
 * Get the OptimalConfigGenerator singleton instance.
 */
export function getOptimalConfigGenerator(): OptimalConfigGenerator {
  if (!generatorInstance) {
    generatorInstance = new OptimalConfigGenerator();
  }
  return generatorInstance;
}
