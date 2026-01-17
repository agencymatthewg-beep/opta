/**
 * QualityManager - Dynamic Quality Scaling Based on FPS
 *
 * Monitors real-time FPS using requestAnimationFrame and dynamically
 * adjusts quality settings to maintain smooth 60fps performance.
 *
 * Quality Levels:
 * - Ultra: Full effects (high tier only)
 * - High: Most effects enabled
 * - Medium: Reduced particle count, simpler shadows
 * - Low: Minimal effects, optimized for performance
 *
 * Scaling Rules:
 * - If FPS < 50 for 2 seconds: reduce quality
 * - If FPS > 58 for 5 seconds: increase quality (if not at max for tier)
 *
 * @see DESIGN_SYSTEM.md - Performance Guidelines
 */

import type { HardwareTier } from './CapabilityDetector';

// =============================================================================
// TYPES
// =============================================================================

export type QualityLevel = 'ultra' | 'high' | 'medium' | 'low';

export interface QualitySettings {
  /** Current quality level */
  level: QualityLevel;
  /** Particle count for ambient effects */
  particleCount: number;
  /** Shadow quality (high/low/none) */
  shadowQuality: 'high' | 'low' | 'none';
  /** Post-processing effects enabled */
  postProcessing: {
    chromaticAberration: boolean;
    bloom: boolean;
    noise: boolean;
  };
  /** Ring geometry segments */
  ringSegments: number;
  /** Texture resolution multiplier (1 = full, 0.5 = half, etc.) */
  textureResolution: number;
  /** Animation complexity (affects spring physics calculations) */
  animationComplexity: 'full' | 'reduced' | 'minimal';
  /** Maximum device pixel ratio to use */
  maxDPR: number;
  /** Enable WebGL effects */
  webglEnabled: boolean;
  /** Frame budget for animations (ms) */
  frameBudget: number;
}

export interface QualityConfig {
  /** Target FPS */
  targetFPS: number;
  /** FPS threshold to trigger quality reduction */
  lowFPSThreshold: number;
  /** FPS threshold to consider for quality increase */
  highFPSThreshold: number;
  /** Duration of low FPS before reducing quality (ms) */
  lowFPSDuration: number;
  /** Duration of high FPS before increasing quality (ms) */
  highFPSDuration: number;
  /** Maximum quality level allowed for this hardware tier */
  maxQualityLevel: QualityLevel;
  /** Minimum quality level (floor) */
  minQualityLevel: QualityLevel;
}

export interface FPSMetrics {
  /** Current instantaneous FPS */
  current: number;
  /** Average FPS over last second */
  average: number;
  /** Minimum FPS in last second */
  min: number;
  /** Maximum FPS in last second */
  max: number;
  /** Frame time variance (stability indicator) */
  variance: number;
  /** Number of dropped frames in last second */
  droppedFrames: number;
}

export interface QualityState {
  /** Current quality settings */
  settings: QualitySettings;
  /** Current FPS metrics */
  fps: FPSMetrics;
  /** Whether auto-scaling is enabled */
  autoScaleEnabled: boolean;
  /** Time in low FPS state (ms) */
  lowFPSTime: number;
  /** Time in high FPS state (ms) */
  highFPSTime: number;
  /** Total quality changes this session */
  qualityChanges: number;
  /** Current hardware tier */
  tier: HardwareTier;
}

type QualityChangeCallback = (settings: QualitySettings, direction: 'up' | 'down') => void;

// =============================================================================
// QUALITY PRESETS
// =============================================================================

/**
 * Quality settings for each level
 */
const QUALITY_PRESETS: Record<QualityLevel, QualitySettings> = {
  ultra: {
    level: 'ultra',
    particleCount: 200,
    shadowQuality: 'high',
    postProcessing: {
      chromaticAberration: true,
      bloom: true,
      noise: true,
    },
    ringSegments: 128,
    textureResolution: 1,
    animationComplexity: 'full',
    maxDPR: 3,
    webglEnabled: true,
    frameBudget: 16.67, // 60fps
  },
  high: {
    level: 'high',
    particleCount: 100,
    shadowQuality: 'high',
    postProcessing: {
      chromaticAberration: true,
      bloom: true,
      noise: true,
    },
    ringSegments: 96,
    textureResolution: 1,
    animationComplexity: 'full',
    maxDPR: 2,
    webglEnabled: true,
    frameBudget: 16.67,
  },
  medium: {
    level: 'medium',
    particleCount: 50,
    shadowQuality: 'low',
    postProcessing: {
      chromaticAberration: false,
      bloom: true,
      noise: false,
    },
    ringSegments: 64,
    textureResolution: 0.75,
    animationComplexity: 'reduced',
    maxDPR: 1.5,
    webglEnabled: true,
    frameBudget: 16.67,
  },
  low: {
    level: 'low',
    particleCount: 20,
    shadowQuality: 'none',
    postProcessing: {
      chromaticAberration: false,
      bloom: false,
      noise: false,
    },
    ringSegments: 32,
    textureResolution: 0.5,
    animationComplexity: 'minimal',
    maxDPR: 1,
    webglEnabled: false, // Use CSS fallback
    frameBudget: 16.67,
  },
};

/**
 * Default config per hardware tier
 */
const TIER_CONFIGS: Record<HardwareTier, QualityConfig> = {
  high: {
    targetFPS: 60,
    lowFPSThreshold: 50,
    highFPSThreshold: 58,
    lowFPSDuration: 2000,
    highFPSDuration: 5000,
    maxQualityLevel: 'ultra',
    minQualityLevel: 'medium',
  },
  medium: {
    targetFPS: 60,
    lowFPSThreshold: 50,
    highFPSThreshold: 58,
    lowFPSDuration: 2000,
    highFPSDuration: 5000,
    maxQualityLevel: 'high',
    minQualityLevel: 'low',
  },
  low: {
    targetFPS: 60,
    lowFPSThreshold: 45,
    highFPSThreshold: 55,
    lowFPSDuration: 1500, // Faster response on low-end
    highFPSDuration: 8000, // Slower to increase
    maxQualityLevel: 'medium',
    minQualityLevel: 'low',
  },
  fallback: {
    targetFPS: 30, // Lower target for fallback
    lowFPSThreshold: 25,
    highFPSThreshold: 28,
    lowFPSDuration: 1000,
    highFPSDuration: 10000,
    maxQualityLevel: 'low',
    minQualityLevel: 'low',
  },
};

// =============================================================================
// QUALITY LEVEL UTILITIES
// =============================================================================

const QUALITY_ORDER: QualityLevel[] = ['low', 'medium', 'high', 'ultra'];

function getQualityIndex(level: QualityLevel): number {
  return QUALITY_ORDER.indexOf(level);
}

function getNextHigherQuality(current: QualityLevel, max: QualityLevel): QualityLevel | null {
  const currentIndex = getQualityIndex(current);
  const maxIndex = getQualityIndex(max);

  if (currentIndex >= maxIndex) {
    return null; // Already at max
  }

  return QUALITY_ORDER[currentIndex + 1];
}

function getNextLowerQuality(current: QualityLevel, min: QualityLevel): QualityLevel | null {
  const currentIndex = getQualityIndex(current);
  const minIndex = getQualityIndex(min);

  if (currentIndex <= minIndex) {
    return null; // Already at min
  }

  return QUALITY_ORDER[currentIndex - 1];
}

// =============================================================================
// QUALITY MANAGER CLASS
// =============================================================================

/**
 * Quality Manager - Monitors FPS and adjusts quality dynamically
 *
 * @example
 * ```tsx
 * const manager = new QualityManager('high');
 * manager.onQualityChange((settings, direction) => {
 *   console.log(`Quality ${direction}: ${settings.level}`);
 * });
 * manager.start();
 *
 * // Later
 * manager.stop();
 * ```
 */
export class QualityManager {
  private state: QualityState;
  private config: QualityConfig;
  private frameId: number | null = null;
  private lastFrameTime = 0;
  private frameTimes: number[] = [];
  private callbacks: QualityChangeCallback[] = [];
  private isRunning = false;

  constructor(tier: HardwareTier, customConfig?: Partial<QualityConfig>) {
    this.config = { ...TIER_CONFIGS[tier], ...customConfig };

    // Initialize state
    const initialLevel = this.config.maxQualityLevel;
    this.state = {
      settings: { ...QUALITY_PRESETS[initialLevel] },
      fps: {
        current: 60,
        average: 60,
        min: 60,
        max: 60,
        variance: 0,
        droppedFrames: 0,
      },
      autoScaleEnabled: true,
      lowFPSTime: 0,
      highFPSTime: 0,
      qualityChanges: 0,
      tier,
    };
  }

  // ---------------------------------------------------------------------------
  // PUBLIC API
  // ---------------------------------------------------------------------------

  /**
   * Start FPS monitoring and auto-scaling
   */
  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.lastFrameTime = performance.now();
    this.frameTimes = [];
    this.tick();
  }

  /**
   * Stop FPS monitoring
   */
  stop(): void {
    this.isRunning = false;
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
  }

  /**
   * Register callback for quality changes
   */
  onQualityChange(callback: QualityChangeCallback): () => void {
    this.callbacks.push(callback);
    return () => {
      this.callbacks = this.callbacks.filter((cb) => cb !== callback);
    };
  }

  /**
   * Get current quality settings
   */
  getSettings(): QualitySettings {
    return { ...this.state.settings };
  }

  /**
   * Get current FPS metrics
   */
  getFPS(): FPSMetrics {
    return { ...this.state.fps };
  }

  /**
   * Get full state
   */
  getState(): QualityState {
    return { ...this.state };
  }

  /**
   * Enable/disable auto-scaling
   */
  setAutoScale(enabled: boolean): void {
    this.state.autoScaleEnabled = enabled;
  }

  /**
   * Manually set quality level
   */
  setQualityLevel(level: QualityLevel): void {
    const maxIndex = getQualityIndex(this.config.maxQualityLevel);
    const minIndex = getQualityIndex(this.config.minQualityLevel);
    const requestedIndex = getQualityIndex(level);

    // Clamp to allowed range
    const clampedIndex = Math.max(minIndex, Math.min(maxIndex, requestedIndex));
    const clampedLevel = QUALITY_ORDER[clampedIndex];

    if (this.state.settings.level !== clampedLevel) {
      const direction = getQualityIndex(clampedLevel) > getQualityIndex(this.state.settings.level)
        ? 'up'
        : 'down';

      this.state.settings = { ...QUALITY_PRESETS[clampedLevel] };
      this.state.qualityChanges++;
      this.notifyCallbacks(direction);
    }
  }

  /**
   * Update hardware tier (reconfigures quality bounds)
   */
  updateTier(tier: HardwareTier): void {
    this.state.tier = tier;
    this.config = { ...TIER_CONFIGS[tier] };

    // Ensure current quality is within new bounds
    const currentIndex = getQualityIndex(this.state.settings.level);
    const maxIndex = getQualityIndex(this.config.maxQualityLevel);
    const minIndex = getQualityIndex(this.config.minQualityLevel);

    if (currentIndex > maxIndex) {
      this.setQualityLevel(this.config.maxQualityLevel);
    } else if (currentIndex < minIndex) {
      this.setQualityLevel(this.config.minQualityLevel);
    }
  }

  /**
   * Force quality reduction (e.g., when battery is low)
   */
  forceReduceQuality(): void {
    const lowerLevel = getNextLowerQuality(
      this.state.settings.level,
      this.config.minQualityLevel
    );
    if (lowerLevel) {
      this.setQualityLevel(lowerLevel);
    }
  }

  // ---------------------------------------------------------------------------
  // PRIVATE METHODS
  // ---------------------------------------------------------------------------

  private tick = (): void => {
    if (!this.isRunning) return;

    const now = performance.now();
    const delta = now - this.lastFrameTime;
    this.lastFrameTime = now;

    // Track frame time
    this.frameTimes.push(delta);

    // Keep only last second of frame times
    const oneSecondAgo = now - 1000;
    while (this.frameTimes.length > 0 && this.frameTimes[0] < oneSecondAgo) {
      this.frameTimes.shift();
    }

    // Calculate FPS metrics
    this.updateFPSMetrics(delta);

    // Auto-scale quality if enabled
    if (this.state.autoScaleEnabled) {
      this.evaluateQualityChange(delta);
    }

    // Schedule next frame
    this.frameId = requestAnimationFrame(this.tick);
  };

  private updateFPSMetrics(frameDelta: number): void {
    const currentFPS = 1000 / frameDelta;
    const frameTimes = this.frameTimes;

    if (frameTimes.length === 0) {
      return;
    }

    // Calculate average FPS
    const avgFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
    const averageFPS = 1000 / avgFrameTime;

    // Calculate min/max FPS
    const minFrameTime = Math.min(...frameTimes);
    const maxFrameTime = Math.max(...frameTimes);
    const maxFPS = 1000 / minFrameTime;
    const minFPS = 1000 / maxFrameTime;

    // Calculate variance (frame time stability)
    const variance = frameTimes.reduce(
      (sum, time) => sum + Math.pow(time - avgFrameTime, 2),
      0
    ) / frameTimes.length;

    // Count dropped frames (> 33ms = dropped 60fps frame)
    const droppedFrames = frameTimes.filter((t) => t > 33.33).length;

    this.state.fps = {
      current: Math.round(currentFPS),
      average: Math.round(averageFPS),
      min: Math.round(minFPS),
      max: Math.round(maxFPS),
      variance: Math.round(variance * 100) / 100,
      droppedFrames,
    };
  }

  private evaluateQualityChange(frameDelta: number): void {
    const { average } = this.state.fps;
    const { lowFPSThreshold, highFPSThreshold, lowFPSDuration, highFPSDuration } = this.config;

    // Track time in low/high FPS states
    if (average < lowFPSThreshold) {
      this.state.lowFPSTime += frameDelta;
      this.state.highFPSTime = 0;
    } else if (average >= highFPSThreshold) {
      this.state.highFPSTime += frameDelta;
      this.state.lowFPSTime = 0;
    } else {
      // In acceptable range - slowly decay timers
      this.state.lowFPSTime = Math.max(0, this.state.lowFPSTime - frameDelta * 0.5);
      this.state.highFPSTime = Math.max(0, this.state.highFPSTime - frameDelta * 0.5);
    }

    // Check for quality reduction
    if (this.state.lowFPSTime >= lowFPSDuration) {
      const lowerLevel = getNextLowerQuality(
        this.state.settings.level,
        this.config.minQualityLevel
      );

      if (lowerLevel) {
        this.state.settings = { ...QUALITY_PRESETS[lowerLevel] };
        this.state.qualityChanges++;
        this.state.lowFPSTime = 0;
        this.notifyCallbacks('down');

        // Log in development
        if (import.meta.env.DEV) {
          console.log(`[QualityManager] Reduced quality to ${lowerLevel} (avg FPS: ${average})`);
        }
      }
    }

    // Check for quality increase
    if (this.state.highFPSTime >= highFPSDuration) {
      const higherLevel = getNextHigherQuality(
        this.state.settings.level,
        this.config.maxQualityLevel
      );

      if (higherLevel) {
        this.state.settings = { ...QUALITY_PRESETS[higherLevel] };
        this.state.qualityChanges++;
        this.state.highFPSTime = 0;
        this.notifyCallbacks('up');

        // Log in development
        if (import.meta.env.DEV) {
          console.log(`[QualityManager] Increased quality to ${higherLevel} (avg FPS: ${average})`);
        }
      }
    }
  }

  private notifyCallbacks(direction: 'up' | 'down'): void {
    const settings = this.getSettings();
    this.callbacks.forEach((callback) => {
      try {
        callback(settings, direction);
      } catch (error) {
        console.error('[QualityManager] Callback error:', error);
      }
    });
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create a quality manager instance for the given hardware tier
 *
 * @param tier - Hardware tier from CapabilityDetector
 * @param config - Optional custom configuration overrides
 * @returns QualityManager instance
 *
 * @example
 * ```tsx
 * const manager = createQualityManager('high');
 * manager.start();
 * ```
 */
export function createQualityManager(
  tier: HardwareTier,
  config?: Partial<QualityConfig>
): QualityManager {
  return new QualityManager(tier, config);
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get quality settings for a specific level
 */
export function getQualityPreset(level: QualityLevel): QualitySettings {
  return { ...QUALITY_PRESETS[level] };
}

/**
 * Get initial quality level for a hardware tier
 */
export function getInitialQualityLevel(tier: HardwareTier): QualityLevel {
  return TIER_CONFIGS[tier].maxQualityLevel;
}

/**
 * Get tier-specific quality config
 */
export function getTierQualityConfig(tier: HardwareTier): QualityConfig {
  return { ...TIER_CONFIGS[tier] };
}

/**
 * Get quality level display name
 */
export function getQualityDisplayName(level: QualityLevel): string {
  switch (level) {
    case 'ultra':
      return 'Ultra';
    case 'high':
      return 'High';
    case 'medium':
      return 'Medium';
    case 'low':
      return 'Low';
  }
}

export default QualityManager;
