/**
 * Phase 47: Configuration Calculator
 *
 * SynergyScorer calculates positive and negative interaction scores
 * between game settings based on the knowledge graph data.
 */

import type {
  SettingValue,
  SettingRelationship,
  SynergyScore,
  ImpactMetrics,
  HardwareProfile,
} from './types';

/**
 * Raw synergy/conflict data from knowledge graph.
 */
interface RawRelationshipData {
  id: string;
  type: 'synergy' | 'conflict';
  direction: string;
  settings: Array<{ category: string; setting: string; value: string }>;
  relationship: string;
  impact?: Record<string, { value: number; min?: number; max?: number; unit?: string }>;
  confidence: string;
  platforms: string[];
  hardware?: string[];
  tags: string[];
  recommendations?: string[];
}

/**
 * SynergyScorer - Calculates interaction scores between settings.
 *
 * Handles:
 * - Finding active synergies in a configuration
 * - Finding active conflicts in a configuration
 * - Calculating net impact of all interactions
 * - Platform and hardware filtering
 */
export class SynergyScorer {
  private synergies: SettingRelationship[] = [];
  private conflicts: SettingRelationship[] = [];

  constructor() {
    // Initialize with embedded knowledge data
    this.loadKnowledgeData();
  }

  /**
   * Load synergy and conflict data from embedded knowledge.
   */
  private loadKnowledgeData(): void {
    // Synergies from optimal-combinations.json (embedded at build time)
    const rawSynergies: RawRelationshipData[] = [
      {
        id: 'max-fps-dlss-performance-low-res',
        type: 'synergy',
        direction: 'enhances',
        settings: [
          { category: 'upscaling', setting: 'dlss', value: 'performance' },
          { category: 'graphics', setting: 'render-scale', value: '50' },
        ],
        relationship: 'DLSS Performance mode compounds with lower internal resolution for maximum FPS gains',
        impact: { performance: { value: 80, min: 60, max: 100 }, quality: { value: -30, min: -40, max: -20 } },
        confidence: 'high',
        platforms: ['windows'],
        tags: ['max-fps', 'dlss', 'upscaling', 'competitive'],
        recommendations: ['Enable DLSS Performance for maximum frame rate', 'Pair with 50% render scale for 4x pixel count reduction'],
      },
      {
        id: 'max-fps-fsr-quality-reduced-shadows',
        type: 'synergy',
        direction: 'enhances',
        settings: [
          { category: 'upscaling', setting: 'fsr', value: 'quality' },
          { category: 'graphics', setting: 'shadows', value: 'low' },
        ],
        relationship: 'FSR Quality with reduced shadows provides balanced visual-performance trade-off',
        impact: { performance: { value: 45, min: 35, max: 55 }, quality: { value: -15, min: -25, max: -10 } },
        confidence: 'high',
        platforms: ['windows', 'macos', 'linux'],
        tags: ['balanced', 'fsr', 'shadows', 'performance'],
        recommendations: ['FSR Quality maintains good visual fidelity', 'Shadows at Low have minimal visual impact in most scenes'],
      },
      {
        id: 'max-fps-apple-silicon-e-cores',
        type: 'synergy',
        direction: 'enhances',
        settings: [
          { category: 'performance', setting: 'background-processes', value: 'e-cores' },
          { category: 'performance', setting: 'game-priority', value: 'p-cores' },
        ],
        relationship: 'Routing background tasks to E-cores frees P-cores for game compute',
        impact: { performance: { value: 15, min: 10, max: 25 } },
        confidence: 'medium',
        platforms: ['macos'],
        hardware: ['M1', 'M1 Pro', 'M1 Max', 'M2', 'M2 Pro', 'M2 Max', 'M3', 'M3 Pro', 'M3 Max', 'M4', 'M4 Pro', 'M4 Max'],
        tags: ['apple-silicon', 'cpu-scheduling', 'e-cores', 'p-cores'],
        recommendations: ['Use QoS hints to route background work to efficiency cores', 'Ensure game threads have user-interactive priority'],
      },
      {
        id: 'visual-quality-taa-sharpening',
        type: 'synergy',
        direction: 'enhances',
        settings: [
          { category: 'graphics', setting: 'aa', value: 'taa' },
          { category: 'graphics', setting: 'sharpening', value: '50' },
        ],
        relationship: 'TAA smoothing paired with sharpening filter produces cleaner image than either alone',
        impact: { quality: { value: 25, min: 15, max: 35 }, performance: { value: -5, min: -10, max: 0 } },
        confidence: 'high',
        platforms: ['all'],
        tags: ['visual-quality', 'taa', 'sharpening', 'anti-aliasing'],
        recommendations: ['TAA reduces shimmer and aliasing', '50% sharpening compensates for TAA blur without artifacts'],
      },
      {
        id: 'battery-low-power-30fps-cap',
        type: 'synergy',
        direction: 'enhances',
        settings: [
          { category: 'power', setting: 'low-power-mode', value: 'on' },
          { category: 'display', setting: 'frame-cap', value: '30' },
        ],
        relationship: 'Low Power Mode with 30fps cap provides up to 3x battery life on Apple Silicon',
        impact: { power: { value: 70, min: 60, max: 80 }, performance: { value: -50 } },
        confidence: 'high',
        platforms: ['macos'],
        hardware: ['M1', 'M2', 'M3', 'M4', 'M1 Pro', 'M2 Pro', 'M3 Pro', 'M4 Pro'],
        tags: ['battery-life', 'low-power', 'frame-cap', 'apple-silicon'],
        recommendations: ['Enable Low Power Mode in System Settings', 'Cap to 30fps for longest battery life'],
      },
      {
        id: 'balanced-dlss-balanced-medium-shadows',
        type: 'synergy',
        direction: 'enhances',
        settings: [
          { category: 'upscaling', setting: 'dlss', value: 'balanced' },
          { category: 'graphics', setting: 'shadows', value: 'medium' },
        ],
        relationship: 'DLSS Balanced with medium shadows provides excellent value for visual fidelity per frame',
        impact: { performance: { value: 40, min: 30, max: 50 }, quality: { value: -10, min: -15, max: -5 } },
        confidence: 'high',
        platforms: ['windows'],
        tags: ['balanced', 'dlss', 'shadows', 'value'],
        recommendations: ['DLSS Balanced is the sweet spot for most users', 'Medium shadows are nearly indistinguishable from High in gameplay'],
      },
      {
        id: 'metalfx-temporal-medium-settings',
        type: 'synergy',
        direction: 'enhances',
        settings: [
          { category: 'upscaling', setting: 'metalfx', value: 'temporal' },
          { category: 'quality', setting: 'preset', value: 'medium' },
        ],
        relationship: 'MetalFX Temporal with medium preset provides optimal balance on Apple Silicon',
        impact: { performance: { value: 35, min: 25, max: 45 }, quality: { value: -12, min: -20, max: -8 } },
        confidence: 'high',
        platforms: ['macos'],
        hardware: ['M3', 'M3 Pro', 'M3 Max', 'M4', 'M4 Pro', 'M4 Max'],
        tags: ['apple-silicon', 'metalfx', 'balanced', 'temporal'],
        recommendations: ['MetalFX Temporal provides best quality/performance ratio', 'Medium preset leaves GPU headroom for upscaling'],
      },
      {
        id: 'competitive-low-everything-high-refresh',
        type: 'synergy',
        direction: 'enhances',
        settings: [
          { category: 'quality', setting: 'preset', value: 'low' },
          { category: 'display', setting: 'refresh-rate', value: '240' },
        ],
        relationship: 'Low settings with high refresh rate minimizes input lag for competitive advantage',
        impact: { latency: { value: 60, min: 50, max: 70 }, quality: { value: -50, min: -60, max: -40 } },
        confidence: 'high',
        platforms: ['all'],
        tags: ['competitive', 'low-settings', 'high-refresh', 'input-lag'],
        recommendations: ['Competitive players prioritize frame rate over visuals', '240Hz provides ~4ms frame delivery vs ~16ms at 60Hz'],
      },
      {
        id: 'rt-dlss-ray-reconstruction',
        type: 'synergy',
        direction: 'enhances',
        settings: [
          { category: 'rt', setting: 'reflections', value: 'on' },
          { category: 'upscaling', setting: 'dlss', value: 'quality' },
          { category: 'performance', setting: 'ray-reconstruction', value: 'on' },
        ],
        relationship: 'DLSS Ray Reconstruction enhances RT quality while reducing denoiser cost',
        impact: { quality: { value: 25, min: 20, max: 30 }, performance: { value: 15, min: 10, max: 20 } },
        confidence: 'high',
        platforms: ['windows'],
        tags: ['ray-tracing', 'dlss', 'ray-reconstruction', 'quality'],
        recommendations: ['Ray Reconstruction replaces traditional denoiser', 'Best quality when combined with DLSS Quality mode'],
      },
    ];

    // Conflicts from general-graphics.json (embedded)
    const rawConflicts: RawRelationshipData[] = [
      {
        id: 'rt-shadows-rasterized-shadows-conflict',
        type: 'conflict',
        direction: 'excludes',
        settings: [
          { category: 'rt', setting: 'shadows', value: 'on' },
          { category: 'graphics', setting: 'shadow-type', value: 'shadow-maps' },
        ],
        relationship: 'Ray-traced shadows and traditional shadow maps are alternative rendering techniques',
        impact: { performance: { value: 20, min: 10, max: 35 }, quality: { value: -15, min: -5, max: -25 } },
        confidence: 'high',
        platforms: ['all'],
        tags: ['shadows', 'ray-tracing', 'shadow-maps', 'technique-choice'],
        recommendations: ['RT shadows provide accurate soft shadows but at significant cost', 'Shadow maps are more efficient for most gaming scenarios'],
      },
      {
        id: 'rt-reflections-ssr-conflict',
        type: 'conflict',
        direction: 'excludes',
        settings: [
          { category: 'rt', setting: 'reflections', value: 'on' },
          { category: 'graphics', setting: 'reflections', value: 'ssr' },
        ],
        relationship: 'Ray-traced reflections and Screen Space Reflections are mutually exclusive reflection techniques',
        impact: { performance: { value: -15, min: -10, max: -25 } },
        confidence: 'high',
        platforms: ['all'],
        tags: ['reflections', 'ray-tracing', 'ssr', 'technique-choice'],
        recommendations: ['RT reflections are superior quality but expensive', 'SSR is efficient but limited to on-screen information'],
      },
      {
        id: 'rtao-ssao-conflict',
        type: 'conflict',
        direction: 'excludes',
        settings: [
          { category: 'rt', setting: 'ambient-occlusion', value: 'rtao' },
          { category: 'graphics', setting: 'ambient-occlusion', value: 'ssao' },
        ],
        relationship: 'RTAO and SSAO are different ambient occlusion implementations - only one should be active',
        impact: { performance: { value: -10, min: -5, max: -15 }, quality: { value: -20, min: -10, max: -30 } },
        confidence: 'high',
        platforms: ['all'],
        tags: ['ambient-occlusion', 'rtao', 'ssao', 'doubled-effect'],
        recommendations: ['Choose RTAO for physically accurate occlusion', 'SSAO/HBAO+ for better performance'],
      },
      {
        id: 'motion-blur-high-refresh-conflict',
        type: 'conflict',
        direction: 'excludes',
        settings: [
          { category: 'graphics', setting: 'motion-blur', value: 'on' },
          { category: 'display', setting: 'refresh-rate', value: '120' },
        ],
        relationship: 'Motion blur simulates persistence at low framerates - at 120Hz+ the display handles motion naturally',
        impact: { quality: { value: 10, min: 5, max: 15 }, performance: { value: 5, min: 2, max: 8 } },
        confidence: 'high',
        platforms: ['all'],
        tags: ['motion-blur', 'refresh-rate', 'high-hz', 'redundant'],
        recommendations: ['Disable motion blur at 120Hz and above', 'Motion blur most useful at 30-60 FPS'],
      },
      {
        id: 'multiple-sharpening-conflict',
        type: 'conflict',
        direction: 'excludes',
        settings: [
          { category: 'graphics', setting: 'sharpening', value: 'cas' },
          { category: 'graphics', setting: 'sharpening-secondary', value: 'nis' },
        ],
        relationship: 'Stacking multiple sharpening filters creates over-sharpened artifacts with halos around edges',
        impact: { quality: { value: -25, min: -15, max: -40 } },
        confidence: 'high',
        platforms: ['all'],
        tags: ['sharpening', 'cas', 'nis', 'post-processing', 'artifacts'],
        recommendations: ['Use only one sharpening solution', 'AMD CAS or NVIDIA Image Scaling sharpening, not both'],
      },
      {
        id: 'film-grain-noise-reduction-conflict',
        type: 'conflict',
        direction: 'excludes',
        settings: [
          { category: 'graphics', setting: 'film-grain', value: 'on' },
          { category: 'graphics', setting: 'noise-reduction', value: 'on' },
        ],
        relationship: 'Film grain adds noise for cinematic effect while noise reduction removes it',
        impact: { performance: { value: -5, min: -3, max: -10 } },
        confidence: 'high',
        platforms: ['all'],
        tags: ['film-grain', 'noise-reduction', 'post-processing', 'contradictory'],
        recommendations: ['Disable noise reduction if film grain is desired', 'Film grain typically disabled for competitive games'],
      },
      {
        id: 'volumetric-fog-volumetric-lighting-stack-conflict',
        type: 'conflict',
        direction: 'excludes',
        settings: [
          { category: 'graphics', setting: 'volumetric-fog', value: 'ultra' },
          { category: 'graphics', setting: 'volumetric-lighting', value: 'ultra' },
        ],
        relationship: 'Volumetric fog and volumetric lighting both perform expensive ray marching',
        impact: { performance: { value: -30, min: -20, max: -45 } },
        confidence: 'high',
        platforms: ['all'],
        tags: ['volumetric', 'fog', 'lighting', 'ray-marching', 'performance'],
        recommendations: ['Set one to High and other to Ultra if both desired', 'Volumetric lighting often more impactful than fog'],
      },
    ];

    // Convert raw data to typed relationships
    this.synergies = rawSynergies.map(r => this.convertRawRelationship(r));
    this.conflicts = rawConflicts.map(r => this.convertRawRelationship(r));
  }

  /**
   * Convert raw relationship data to typed SettingRelationship.
   */
  private convertRawRelationship(raw: RawRelationshipData): SettingRelationship {
    const impact: ImpactMetrics = {};
    if (raw.impact) {
      if (raw.impact.performance) impact.performance = raw.impact.performance.value;
      if (raw.impact.quality) impact.quality = raw.impact.quality.value;
      if (raw.impact.latency) impact.latency = raw.impact.latency.value;
      if (raw.impact.power) impact.power = raw.impact.power.value;
      if (raw.impact.vram) impact.vram = raw.impact.vram.value;
    }

    return {
      id: raw.id,
      type: raw.type,
      direction: raw.direction as 'enhances' | 'excludes' | 'degrades',
      settings: raw.settings.map(s => ({ ...s, value: s.value })),
      description: raw.relationship,
      impact,
      confidence: raw.confidence === 'high' ? 1.0 : raw.confidence === 'medium' ? 0.7 : 0.4,
      platforms: raw.platforms,
      hardware: raw.hardware,
      tags: raw.tags,
      recommendations: raw.recommendations ?? [],
    };
  }

  /**
   * Calculate the complete synergy score for a configuration.
   */
  calculateScore(
    settings: SettingValue[],
    hardwareProfile?: HardwareProfile
  ): SynergyScore {
    const activeSynergies = this.findActiveSynergies(settings, hardwareProfile);
    const activeConflicts = this.findActiveConflicts(settings, hardwareProfile);

    // Calculate breakdown by impact dimension
    const breakdown = this.calculateImpactBreakdown(activeSynergies, activeConflicts);

    // Calculate total score (weighted sum of impacts)
    const totalScore = this.calculateTotalScore(breakdown, activeSynergies, activeConflicts);

    // Generate recommendations
    const recommendations = this.generateRecommendations(settings, activeSynergies, activeConflicts);

    return {
      totalScore,
      breakdown,
      activeSynergies,
      activeConflicts,
      recommendations,
    };
  }

  /**
   * Find all active synergies in a configuration.
   */
  findActiveSynergies(
    settings: SettingValue[],
    hardwareProfile?: HardwareProfile
  ): SettingRelationship[] {
    return this.synergies.filter(synergy =>
      this.isRelationshipActive(synergy, settings, hardwareProfile)
    );
  }

  /**
   * Find all active conflicts in a configuration.
   */
  findActiveConflicts(
    settings: SettingValue[],
    hardwareProfile?: HardwareProfile
  ): SettingRelationship[] {
    return this.conflicts.filter(conflict =>
      this.isRelationshipActive(conflict, settings, hardwareProfile)
    );
  }

  /**
   * Check if a relationship is active given the current settings.
   */
  private isRelationshipActive(
    relationship: SettingRelationship,
    settings: SettingValue[],
    hardwareProfile?: HardwareProfile
  ): boolean {
    // Check platform compatibility
    if (!this.isPlatformCompatible(relationship, hardwareProfile)) {
      return false;
    }

    // Check hardware compatibility
    if (!this.isHardwareCompatible(relationship, hardwareProfile)) {
      return false;
    }

    // Check if all settings in the relationship are present with matching values
    return relationship.settings.every(requiredSetting => {
      const currentSetting = settings.find(
        s => s.category === requiredSetting.category && s.setting === requiredSetting.setting
      );

      if (!currentSetting) return false;

      // Flexible value matching (handle string/number conversion)
      const currentValue = String(currentSetting.value).toLowerCase();
      const requiredValue = String(requiredSetting.value).toLowerCase();

      return currentValue === requiredValue;
    });
  }

  /**
   * Check if a relationship is compatible with the current platform.
   */
  private isPlatformCompatible(
    relationship: SettingRelationship,
    hardwareProfile?: HardwareProfile
  ): boolean {
    if (!hardwareProfile) return true;
    if (relationship.platforms.includes('all')) return true;
    return relationship.platforms.includes(hardwareProfile.platform);
  }

  /**
   * Check if a relationship is compatible with the current hardware.
   */
  private isHardwareCompatible(
    relationship: SettingRelationship,
    hardwareProfile?: HardwareProfile
  ): boolean {
    if (!hardwareProfile || !relationship.hardware) return true;
    if (!hardwareProfile.chipModel) return true;
    return relationship.hardware.includes(hardwareProfile.chipModel);
  }

  /**
   * Calculate the impact breakdown from active synergies and conflicts.
   */
  private calculateImpactBreakdown(
    synergies: SettingRelationship[],
    conflicts: SettingRelationship[]
  ): ImpactMetrics {
    const breakdown: ImpactMetrics = {
      performance: 0,
      quality: 0,
      latency: 0,
      power: 0,
      vram: 0,
    };

    // Add synergy impacts (positive)
    for (const synergy of synergies) {
      const weight = synergy.confidence;
      if (synergy.impact.performance) breakdown.performance! += synergy.impact.performance * weight;
      if (synergy.impact.quality) breakdown.quality! += synergy.impact.quality * weight;
      if (synergy.impact.latency) breakdown.latency! += synergy.impact.latency * weight;
      if (synergy.impact.power) breakdown.power! += synergy.impact.power * weight;
      if (synergy.impact.vram) breakdown.vram! += synergy.impact.vram * weight;
    }

    // Add conflict impacts (typically negative)
    for (const conflict of conflicts) {
      const weight = conflict.confidence;
      if (conflict.impact.performance) breakdown.performance! += conflict.impact.performance * weight;
      if (conflict.impact.quality) breakdown.quality! += conflict.impact.quality * weight;
      if (conflict.impact.latency) breakdown.latency! += conflict.impact.latency * weight;
      if (conflict.impact.power) breakdown.power! += conflict.impact.power * weight;
      if (conflict.impact.vram) breakdown.vram! += conflict.impact.vram * weight;
    }

    return breakdown;
  }

  /**
   * Calculate the total synergy score.
   */
  private calculateTotalScore(
    breakdown: ImpactMetrics,
    synergies: SettingRelationship[],
    conflicts: SettingRelationship[]
  ): number {
    // Weighted combination of all impacts
    const weights = {
      performance: 0.35,
      quality: 0.25,
      latency: 0.20,
      power: 0.10,
      vram: 0.10,
    };

    let score = 0;
    score += (breakdown.performance ?? 0) * weights.performance;
    score += (breakdown.quality ?? 0) * weights.quality;
    score += (breakdown.latency ?? 0) * weights.latency;
    score += (breakdown.power ?? 0) * weights.power;
    score += (breakdown.vram ?? 0) * weights.vram;

    // Bonus for synergies, penalty for conflicts
    score += synergies.length * 5;
    score -= conflicts.length * 10;

    return Math.round(score * 100) / 100;
  }

  /**
   * Generate recommendations based on active relationships.
   */
  private generateRecommendations(
    settings: SettingValue[],
    activeSynergies: SettingRelationship[],
    conflicts: SettingRelationship[]
  ): string[] {
    const recommendations: string[] = [];

    // Add info about active synergies
    if (activeSynergies.length > 0) {
      recommendations.push(`✅ ${activeSynergies.length} active synergies boosting your configuration`);
    }

    // Add recommendations for conflicts
    for (const conflict of conflicts) {
      recommendations.push(
        `⚠️ Conflict: ${conflict.description}`,
        ...conflict.recommendations.map(r => `  → ${r}`)
      );
    }

    // Add recommendations for potential synergies not yet enabled
    const potentialSynergies = this.findPotentialSynergies(settings);
    for (const potential of potentialSynergies.slice(0, 3)) {
      recommendations.push(
        `💡 Potential: ${potential.description}`,
        ...potential.recommendations.slice(0, 1).map(r => `  → ${r}`)
      );
    }

    return recommendations;
  }

  /**
   * Find synergies that could be enabled with minor setting changes.
   */
  findPotentialSynergies(settings: SettingValue[]): SettingRelationship[] {
    return this.synergies.filter(synergy => {
      // Count how many settings match
      const matchCount = synergy.settings.filter(requiredSetting => {
        const current = settings.find(
          s => s.category === requiredSetting.category && s.setting === requiredSetting.setting
        );
        return current && String(current.value).toLowerCase() === String(requiredSetting.value).toLowerCase();
      }).length;

      // Return if most (but not all) settings match
      return matchCount > 0 && matchCount < synergy.settings.length;
    });
  }

  /**
   * Get all known synergies.
   */
  getAllSynergies(): SettingRelationship[] {
    return [...this.synergies];
  }

  /**
   * Get all known conflicts.
   */
  getAllConflicts(): SettingRelationship[] {
    return [...this.conflicts];
  }
}

// Singleton instance
let scorerInstance: SynergyScorer | null = null;

/**
 * Get the SynergyScorer singleton instance.
 */
export function getSynergyScorer(): SynergyScorer {
  if (!scorerInstance) {
    scorerInstance = new SynergyScorer();
  }
  return scorerInstance;
}
