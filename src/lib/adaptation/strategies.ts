/**
 * Phase 49: Real-Time Adaptation
 *
 * Pre-defined adaptation strategies for common scenarios.
 */

import type { AdaptationStrategy } from './types';

/**
 * Strategy for handling high GPU temperature (thermal throttling).
 */
export const THERMAL_THROTTLING_STRATEGY: AdaptationStrategy = {
  id: 'thermal-throttling',
  name: 'Thermal Management',
  description: 'Reduces performance to prevent thermal throttling when GPU temperature is high',
  scenario: 'thermal_throttling',
  severity: 'warning',
  triggerConditions: [
    {
      metric: 'gpu_temperature',
      operator: 'gte',
      value: 80,
      sustainedMs: 5000,
    },
  ],
  resolveConditions: [
    {
      metric: 'gpu_temperature',
      operator: 'lt',
      value: 70,
      sustainedMs: 10000,
    },
  ],
  actions: [
    {
      type: 'hardware_tuning',
      hardwareTuning: {
        thermalPolicy: 'quiet',
        gpuPerformance: 'medium',
      },
      reversible: true,
      priority: 10,
    },
    {
      type: 'notification',
      message: 'GPU running hot. Reducing performance to maintain stability.',
      reversible: false,
      priority: 5,
    },
  ],
  cooldownMs: 60000,
  requiresApproval: false,
  platforms: ['macos', 'windows', 'linux'],
  enabled: true,
};

/**
 * Critical thermal protection strategy.
 */
export const THERMAL_CRITICAL_STRATEGY: AdaptationStrategy = {
  id: 'thermal-critical',
  name: 'Critical Thermal Protection',
  description: 'Emergency thermal protection when GPU reaches critical temperature',
  scenario: 'thermal_throttling',
  severity: 'critical',
  triggerConditions: [
    {
      metric: 'gpu_temperature',
      operator: 'gte',
      value: 90,
      sustainedMs: 2000,
    },
  ],
  resolveConditions: [
    {
      metric: 'gpu_temperature',
      operator: 'lt',
      value: 75,
      sustainedMs: 15000,
    },
  ],
  actions: [
    {
      type: 'hardware_tuning',
      hardwareTuning: {
        thermalPolicy: 'quiet',
        gpuPerformance: 'low',
        processPriority: 'normal',
      },
      reversible: true,
      priority: 20,
    },
    {
      type: 'notification',
      message: 'Critical: GPU temperature extremely high. Performance significantly reduced.',
      reversible: false,
      priority: 15,
    },
  ],
  cooldownMs: 120000,
  requiresApproval: false,
  platforms: ['macos', 'windows', 'linux'],
  enabled: true,
};

/**
 * Strategy for handling system memory pressure.
 */
export const MEMORY_PRESSURE_STRATEGY: AdaptationStrategy = {
  id: 'memory-pressure',
  name: 'Memory Optimization',
  description: 'Optimizes memory usage when system RAM is running low',
  scenario: 'memory_pressure',
  severity: 'warning',
  triggerConditions: [
    {
      metric: 'memory_usage',
      operator: 'gte',
      value: 85,
      sustainedMs: 10000,
    },
  ],
  resolveConditions: [
    {
      metric: 'memory_usage',
      operator: 'lt',
      value: 70,
      sustainedMs: 10000,
    },
  ],
  actions: [
    {
      type: 'hardware_tuning',
      hardwareTuning: {
        memoryStrategy: 'aggressive',
      },
      reversible: true,
      priority: 10,
    },
    {
      type: 'notification',
      message: 'Memory pressure detected. Optimizing memory allocation.',
      reversible: false,
      priority: 5,
    },
  ],
  cooldownMs: 30000,
  requiresApproval: false,
  platforms: ['macos', 'windows', 'linux'],
  enabled: true,
};

/**
 * Strategy for critical memory pressure.
 */
export const MEMORY_CRITICAL_STRATEGY: AdaptationStrategy = {
  id: 'memory-critical',
  name: 'Critical Memory Management',
  description: 'Emergency memory management when system is critically low on RAM',
  scenario: 'memory_pressure',
  severity: 'critical',
  triggerConditions: [
    {
      metric: 'memory_usage',
      operator: 'gte',
      value: 95,
      sustainedMs: 5000,
    },
  ],
  resolveConditions: [
    {
      metric: 'memory_usage',
      operator: 'lt',
      value: 80,
      sustainedMs: 15000,
    },
  ],
  actions: [
    {
      type: 'hardware_tuning',
      hardwareTuning: {
        memoryStrategy: 'aggressive',
        disableAppThrottling: false,
      },
      reversible: true,
      priority: 20,
    },
    {
      type: 'notification',
      message: 'Critical: System memory nearly exhausted. Consider closing background applications.',
      reversible: false,
      priority: 15,
    },
  ],
  cooldownMs: 60000,
  requiresApproval: false,
  platforms: ['macos', 'windows', 'linux'],
  enabled: true,
};

/**
 * Strategy for VRAM pressure.
 */
export const VRAM_PRESSURE_STRATEGY: AdaptationStrategy = {
  id: 'vram-pressure',
  name: 'VRAM Optimization',
  description: 'Manages GPU memory when VRAM usage is high',
  scenario: 'memory_pressure',
  severity: 'warning',
  triggerConditions: [
    {
      metric: 'gpu_memory',
      operator: 'gte',
      value: 90,
      sustainedMs: 5000,
    },
  ],
  resolveConditions: [
    {
      metric: 'gpu_memory',
      operator: 'lt',
      value: 75,
      sustainedMs: 10000,
    },
  ],
  actions: [
    {
      type: 'setting_change',
      settingChanges: [
        { category: 'graphics', setting: 'texture_quality', value: 'medium' },
      ],
      reversible: true,
      priority: 10,
    },
    {
      type: 'notification',
      message: 'VRAM usage high. Consider reducing texture quality.',
      reversible: false,
      priority: 5,
    },
  ],
  cooldownMs: 60000,
  requiresApproval: true,
  platforms: ['macos', 'windows', 'linux'],
  enabled: true,
};

/**
 * Strategy for FPS drops.
 */
export const FPS_DROP_STRATEGY: AdaptationStrategy = {
  id: 'fps-drop',
  name: 'Performance Recovery',
  description: 'Boosts performance when FPS drops significantly below target',
  scenario: 'fps_drop',
  severity: 'info',
  triggerConditions: [
    {
      metric: 'gpu_usage',
      operator: 'gte',
      value: 99,
      sustainedMs: 10000,
    },
  ],
  resolveConditions: [
    {
      metric: 'gpu_usage',
      operator: 'lt',
      value: 90,
      sustainedMs: 10000,
    },
  ],
  actions: [
    {
      type: 'hardware_tuning',
      hardwareTuning: {
        gpuPerformance: 'high',
        processPriority: 'high',
      },
      reversible: true,
      priority: 8,
    },
    {
      type: 'notification',
      message: 'Performance optimization applied to improve frame rate.',
      reversible: false,
      priority: 3,
    },
  ],
  cooldownMs: 30000,
  requiresApproval: false,
  platforms: ['macos', 'windows', 'linux'],
  enabled: true,
};

/**
 * Strategy for CPU bottleneck detection.
 */
export const CPU_BOTTLENECK_STRATEGY: AdaptationStrategy = {
  id: 'cpu-bottleneck',
  name: 'CPU Bottleneck Mitigation',
  description: 'Optimizes CPU utilization when CPU is limiting performance',
  scenario: 'cpu_bottleneck',
  severity: 'info',
  triggerConditions: [
    {
      metric: 'cpu_usage',
      operator: 'gte',
      value: 95,
      sustainedMs: 10000,
    },
    {
      metric: 'gpu_usage',
      operator: 'lt',
      value: 70,
      sustainedMs: 10000,
    },
  ],
  resolveConditions: [
    {
      metric: 'cpu_usage',
      operator: 'lt',
      value: 85,
      sustainedMs: 10000,
    },
  ],
  actions: [
    {
      type: 'hardware_tuning',
      hardwareTuning: {
        processPriority: 'high',
        preferPerformanceCores: true,
        disableAppThrottling: true,
      },
      reversible: true,
      priority: 8,
    },
    {
      type: 'notification',
      message: 'CPU bottleneck detected. Prioritizing game process.',
      reversible: false,
      priority: 3,
    },
  ],
  cooldownMs: 60000,
  requiresApproval: false,
  platforms: ['macos', 'windows'],
  enabled: true,
};

/**
 * Strategy for power conservation (battery mode).
 */
export const POWER_CONSERVATION_STRATEGY: AdaptationStrategy = {
  id: 'power-conservation',
  name: 'Power Conservation',
  description: 'Reduces power consumption when running on battery',
  scenario: 'power_conservation',
  severity: 'info',
  triggerConditions: [
    // This is triggered by context, not telemetry
    // The engine checks for power source changes
    {
      metric: 'cpu_usage',
      operator: 'gte',
      value: 0, // Always true - triggered by context
      sustainedMs: 0,
    },
  ],
  resolveConditions: [
    {
      metric: 'cpu_usage',
      operator: 'gte',
      value: 0, // Resolved when back on AC
      sustainedMs: 0,
    },
  ],
  actions: [
    {
      type: 'hardware_tuning',
      hardwareTuning: {
        gpuPerformance: 'medium',
        thermalPolicy: 'balanced',
        processPriority: 'normal',
      },
      reversible: true,
      priority: 5,
    },
    {
      type: 'notification',
      message: 'Running on battery. Performance adjusted for power efficiency.',
      reversible: false,
      priority: 2,
    },
  ],
  cooldownMs: 5000,
  requiresApproval: false,
  platforms: ['macos', 'windows', 'linux'],
  enabled: true,
};

/**
 * All default strategies.
 */
export const DEFAULT_STRATEGIES: AdaptationStrategy[] = [
  THERMAL_THROTTLING_STRATEGY,
  THERMAL_CRITICAL_STRATEGY,
  MEMORY_PRESSURE_STRATEGY,
  MEMORY_CRITICAL_STRATEGY,
  VRAM_PRESSURE_STRATEGY,
  FPS_DROP_STRATEGY,
  CPU_BOTTLENECK_STRATEGY,
  POWER_CONSERVATION_STRATEGY,
];

/**
 * Get a strategy by ID.
 */
export function getStrategy(id: string): AdaptationStrategy | undefined {
  return DEFAULT_STRATEGIES.find(s => s.id === id);
}

/**
 * Get strategies for a specific scenario.
 */
export function getStrategiesForScenario(
  scenario: AdaptationStrategy['scenario']
): AdaptationStrategy[] {
  return DEFAULT_STRATEGIES.filter(s => s.scenario === scenario);
}

/**
 * Get strategies for a specific platform.
 */
export function getStrategiesForPlatform(
  platform: 'macos' | 'windows' | 'linux'
): AdaptationStrategy[] {
  return DEFAULT_STRATEGIES.filter(s => s.platforms.includes(platform));
}
