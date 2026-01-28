/**
 * Phase 49: Real-Time Adaptation
 *
 * Public exports for the adaptation system.
 */

// Types
export type {
  TelemetryMetric,
  ThresholdOperator,
  ThresholdCondition,
  TelemetryThresholds,
  AdaptationSeverity,
  AdaptationScenario,
  AdaptationAction,
  AdaptationStrategy,
  AdaptationEvent,
  AdaptationState,
  AdaptationEngineConfig,
  AdaptationResult,
} from './types';

export { DEFAULT_THRESHOLDS } from './types';

// Strategies
export {
  DEFAULT_STRATEGIES,
  THERMAL_THROTTLING_STRATEGY,
  THERMAL_CRITICAL_STRATEGY,
  MEMORY_PRESSURE_STRATEGY,
  MEMORY_CRITICAL_STRATEGY,
  VRAM_PRESSURE_STRATEGY,
  FPS_DROP_STRATEGY,
  CPU_BOTTLENECK_STRATEGY,
  POWER_CONSERVATION_STRATEGY,
  getStrategy,
  getStrategiesForScenario,
  getStrategiesForPlatform,
} from './strategies';

// Engine
export {
  AdaptationEngine,
  getAdaptationEngine,
  resetAdaptationEngine,
} from './AdaptationEngine';
