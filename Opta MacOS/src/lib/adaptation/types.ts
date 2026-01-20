/**
 * Phase 49: Real-Time Adaptation
 *
 * Types for Opta's real-time optimization system that monitors telemetry
 * and dynamically adjusts settings based on system conditions.
 */

import type { HardwareTuning, ProfileContext } from '../profiles/types';
import type { SettingValue, ImpactMetrics } from '../calculator/types';

/**
 * Telemetry metric categories for threshold monitoring.
 */
export type TelemetryMetric =
  | 'cpu_usage'
  | 'memory_usage'
  | 'gpu_usage'
  | 'gpu_temperature'
  | 'gpu_memory'
  | 'fps'
  | 'frame_time';

/**
 * Comparison operators for threshold conditions.
 */
export type ThresholdOperator = 'gt' | 'gte' | 'lt' | 'lte' | 'eq';

/**
 * A single threshold condition that can trigger adaptation.
 */
export interface ThresholdCondition {
  /** Metric to monitor */
  metric: TelemetryMetric;
  /** Comparison operator */
  operator: ThresholdOperator;
  /** Threshold value */
  value: number;
  /** Duration in ms the condition must persist before triggering */
  sustainedMs: number;
}

/**
 * Telemetry thresholds for different adaptation scenarios.
 */
export interface TelemetryThresholds {
  /** Thermal throttling thresholds */
  thermal: {
    /** GPU temperature warning threshold (Celsius) */
    gpuWarn: number;
    /** GPU temperature critical threshold (Celsius) */
    gpuCritical: number;
    /** CPU usage sustained high threshold (%) */
    cpuSustainedHigh: number;
  };
  /** Memory pressure thresholds */
  memory: {
    /** System memory usage warning (%) */
    systemWarn: number;
    /** System memory critical (%) */
    systemCritical: number;
    /** GPU memory usage warning (%) */
    vramWarn: number;
    /** GPU memory critical (%) */
    vramCritical: number;
  };
  /** Performance thresholds */
  performance: {
    /** FPS drop threshold (% below target) */
    fpsDropPercent: number;
    /** Frame time spike threshold (ms) */
    frameTimeSpike: number;
    /** GPU utilization low (may be CPU bottleneck) */
    gpuUtilizationLow: number;
  };
}

/**
 * Severity level for triggered adaptations.
 */
export type AdaptationSeverity = 'info' | 'warning' | 'critical';

/**
 * The type of adaptation scenario being addressed.
 */
export type AdaptationScenario =
  | 'thermal_throttling'
  | 'memory_pressure'
  | 'fps_drop'
  | 'gpu_bottleneck'
  | 'cpu_bottleneck'
  | 'power_conservation';

/**
 * A specific adaptation action to take.
 */
export interface AdaptationAction {
  /** Type of action */
  type: 'hardware_tuning' | 'setting_change' | 'notification';
  /** Hardware tuning changes (if type is hardware_tuning) */
  hardwareTuning?: Partial<HardwareTuning>;
  /** Setting value changes (if type is setting_change) */
  settingChanges?: SettingValue[];
  /** Notification message (if type is notification) */
  message?: string;
  /** Whether this action is reversible */
  reversible: boolean;
  /** Priority (higher = execute first) */
  priority: number;
}

/**
 * A complete adaptation strategy for handling a specific scenario.
 */
export interface AdaptationStrategy {
  /** Unique strategy identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description of what this strategy does */
  description: string;
  /** Scenario this strategy addresses */
  scenario: AdaptationScenario;
  /** Severity level */
  severity: AdaptationSeverity;
  /** Conditions that trigger this strategy (all must be met) */
  triggerConditions: ThresholdCondition[];
  /** Conditions that indicate the issue is resolved */
  resolveConditions: ThresholdCondition[];
  /** Actions to take when triggered */
  actions: AdaptationAction[];
  /** Cooldown period in ms before this strategy can trigger again */
  cooldownMs: number;
  /** Whether user approval is required before applying */
  requiresApproval: boolean;
  /** Platforms this strategy applies to */
  platforms: ('macos' | 'windows' | 'linux')[];
  /** Whether this strategy is enabled */
  enabled: boolean;
}

/**
 * Event emitted when an adaptation is triggered.
 */
export interface AdaptationEvent {
  /** Unique event ID */
  id: string;
  /** Strategy that was triggered */
  strategyId: string;
  /** Strategy name for display */
  strategyName: string;
  /** Scenario being addressed */
  scenario: AdaptationScenario;
  /** Severity level */
  severity: AdaptationSeverity;
  /** Trigger conditions that were met */
  triggeredConditions: ThresholdCondition[];
  /** Actions taken */
  actionsTaken: AdaptationAction[];
  /** Previous state for rollback */
  previousState?: {
    hardwareTuning?: HardwareTuning;
    settings?: SettingValue[];
  };
  /** Context at time of adaptation */
  context: ProfileContext;
  /** Timestamp when triggered */
  triggeredAt: number;
  /** Whether the adaptation was applied (false if pending approval) */
  applied: boolean;
  /** Timestamp when resolved (if resolved) */
  resolvedAt?: number;
}

/**
 * Current adaptation engine state.
 */
export interface AdaptationState {
  /** Whether the engine is actively monitoring */
  monitoring: boolean;
  /** Current active adaptations */
  activeAdaptations: AdaptationEvent[];
  /** Recent adaptation history */
  history: AdaptationEvent[];
  /** Pending adaptations awaiting approval */
  pendingApproval: AdaptationEvent[];
  /** Strategy cooldowns (strategyId -> cooldown end timestamp) */
  cooldowns: Record<string, number>;
  /** Current telemetry thresholds */
  thresholds: TelemetryThresholds;
  /** Last telemetry update timestamp */
  lastTelemetryUpdate: number;
}

/**
 * Configuration for the adaptation engine.
 */
export interface AdaptationEngineConfig {
  /** Whether to enable automatic adaptation */
  enabled: boolean;
  /** Telemetry polling interval in ms */
  pollingIntervalMs: number;
  /** Maximum history items to keep */
  maxHistorySize: number;
  /** Custom thresholds (uses defaults if not provided) */
  thresholds?: Partial<TelemetryThresholds>;
  /** Strategies to enable/disable by ID */
  strategyOverrides?: Record<string, boolean>;
  /** Global requirement for user approval */
  alwaysRequireApproval: boolean;
}

/**
 * Result of applying an adaptation.
 */
export interface AdaptationResult {
  /** Whether the adaptation was successfully applied */
  success: boolean;
  /** The adaptation event */
  event: AdaptationEvent;
  /** Expected impact of the adaptation */
  expectedImpact: ImpactMetrics;
  /** Error message if failed */
  error?: string;
}

/**
 * Default telemetry thresholds.
 */
export const DEFAULT_THRESHOLDS: TelemetryThresholds = {
  thermal: {
    gpuWarn: 75,
    gpuCritical: 85,
    cpuSustainedHigh: 90,
  },
  memory: {
    systemWarn: 80,
    systemCritical: 90,
    vramWarn: 85,
    vramCritical: 95,
  },
  performance: {
    fpsDropPercent: 20,
    frameTimeSpike: 50,
    gpuUtilizationLow: 50,
  },
};
