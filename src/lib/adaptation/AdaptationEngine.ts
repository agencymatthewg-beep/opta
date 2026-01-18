/**
 * Phase 49: Real-Time Adaptation
 *
 * AdaptationEngine monitors system telemetry and dynamically adjusts
 * optimization settings based on real-time conditions.
 */

import { invoke } from '@tauri-apps/api/core';
import type { SystemSnapshot } from '../../types/telemetry';
import type { ProfileContext, HardwareTuning } from '../profiles/types';
import { getProfileEngine } from '../profiles/ProfileEngine';
import type {
  AdaptationState,
  AdaptationEngineConfig,
  AdaptationEvent,
  AdaptationResult,
  AdaptationStrategy,
  TelemetryThresholds,
  ThresholdCondition,
  TelemetryMetric,
  AdaptationAction,
} from './types';
import { DEFAULT_STRATEGIES } from './strategies';

/**
 * Generate a unique ID for adaptation events.
 */
function generateEventId(): string {
  return `adapt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Get the current platform.
 */
function getPlatform(): 'macos' | 'windows' | 'linux' {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('mac')) return 'macos';
  if (ua.includes('win')) return 'windows';
  return 'linux';
}

/**
 * AdaptationEngine - Core service for real-time optimization adaptation.
 *
 * Monitors system telemetry and applies adaptation strategies when
 * threshold conditions are met.
 */
export class AdaptationEngine {
  private config: AdaptationEngineConfig;
  private state: AdaptationState;
  private strategies: Map<string, AdaptationStrategy>;
  private pollingTimer: ReturnType<typeof setInterval> | null = null;
  private conditionTimers: Map<string, number> = new Map();
  private listeners: Set<(state: AdaptationState) => void> = new Set();
  private lastTelemetry: SystemSnapshot | null = null;
  private platform: 'macos' | 'windows' | 'linux';

  constructor(config?: Partial<AdaptationEngineConfig>) {
    this.platform = getPlatform();

    this.config = {
      enabled: true,
      pollingIntervalMs: 2000,
      maxHistorySize: 50,
      alwaysRequireApproval: false,
      ...config,
    };

    const thresholds: TelemetryThresholds = {
      thermal: {
        gpuWarn: 75,
        gpuCritical: 85,
        cpuSustainedHigh: 90,
        ...config?.thresholds?.thermal,
      },
      memory: {
        systemWarn: 80,
        systemCritical: 90,
        vramWarn: 85,
        vramCritical: 95,
        ...config?.thresholds?.memory,
      },
      performance: {
        fpsDropPercent: 20,
        frameTimeSpike: 50,
        gpuUtilizationLow: 50,
        ...config?.thresholds?.performance,
      },
    };

    this.state = {
      monitoring: false,
      activeAdaptations: [],
      history: [],
      pendingApproval: [],
      cooldowns: {},
      thresholds,
      lastTelemetryUpdate: 0,
    };

    // Initialize strategies
    this.strategies = new Map();
    for (const strategy of DEFAULT_STRATEGIES) {
      if (strategy.platforms.includes(this.platform)) {
        const enabled = config?.strategyOverrides?.[strategy.id] ?? strategy.enabled;
        this.strategies.set(strategy.id, { ...strategy, enabled });
      }
    }
  }

  /**
   * Get current adaptation state.
   */
  getState(): AdaptationState {
    return { ...this.state };
  }

  /**
   * Get all strategies.
   */
  getStrategies(): AdaptationStrategy[] {
    return Array.from(this.strategies.values());
  }

  /**
   * Enable or disable a strategy.
   */
  setStrategyEnabled(strategyId: string, enabled: boolean): void {
    const strategy = this.strategies.get(strategyId);
    if (strategy) {
      this.strategies.set(strategyId, { ...strategy, enabled });
    }
  }

  /**
   * Update thresholds.
   */
  setThresholds(thresholds: Partial<TelemetryThresholds>): void {
    this.state.thresholds = {
      ...this.state.thresholds,
      ...thresholds,
      thermal: { ...this.state.thresholds.thermal, ...thresholds.thermal },
      memory: { ...this.state.thresholds.memory, ...thresholds.memory },
      performance: { ...this.state.thresholds.performance, ...thresholds.performance },
    };
    this.notifyListeners();
  }

  /**
   * Subscribe to state changes.
   */
  subscribe(listener: (state: AdaptationState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Start monitoring telemetry.
   */
  start(): void {
    if (this.state.monitoring) return;

    this.state.monitoring = true;
    this.pollingTimer = setInterval(
      () => this.checkTelemetry(),
      this.config.pollingIntervalMs
    );
    this.notifyListeners();
  }

  /**
   * Stop monitoring telemetry.
   */
  stop(): void {
    if (!this.state.monitoring) return;

    this.state.monitoring = false;
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
    this.conditionTimers.clear();
    this.notifyListeners();
  }

  /**
   * Manually trigger a telemetry check.
   */
  async checkTelemetry(): Promise<void> {
    if (!this.config.enabled) return;

    try {
      const telemetry = await invoke<SystemSnapshot>('get_system_telemetry');
      this.lastTelemetry = telemetry;
      this.state.lastTelemetryUpdate = Date.now();

      // Check each enabled strategy
      for (const strategy of this.strategies.values()) {
        if (!strategy.enabled) continue;
        if (this.isOnCooldown(strategy.id)) continue;

        // Check if strategy is already active
        const isActive = this.state.activeAdaptations.some(
          a => a.strategyId === strategy.id
        );

        if (isActive) {
          // Check resolve conditions
          await this.checkResolveConditions(strategy, telemetry);
        } else {
          // Check trigger conditions
          await this.checkTriggerConditions(strategy, telemetry);
        }
      }

      this.notifyListeners();
    } catch (error) {
      console.warn('Failed to fetch telemetry for adaptation:', error);
    }
  }

  /**
   * Check if a strategy's trigger conditions are met.
   */
  private async checkTriggerConditions(
    strategy: AdaptationStrategy,
    telemetry: SystemSnapshot
  ): Promise<void> {
    const allConditionsMet = strategy.triggerConditions.every(condition =>
      this.evaluateCondition(condition, telemetry)
    );

    if (!allConditionsMet) {
      // Reset sustained timer if conditions not met
      this.conditionTimers.delete(`trigger-${strategy.id}`);
      return;
    }

    // Check sustained duration
    const maxSustainedMs = Math.max(
      ...strategy.triggerConditions.map(c => c.sustainedMs)
    );

    const timerKey = `trigger-${strategy.id}`;
    const timerStart = this.conditionTimers.get(timerKey);

    if (!timerStart) {
      this.conditionTimers.set(timerKey, Date.now());
      return;
    }

    const elapsed = Date.now() - timerStart;
    if (elapsed < maxSustainedMs) {
      return;
    }

    // Conditions sustained - trigger the adaptation
    this.conditionTimers.delete(timerKey);
    await this.triggerAdaptation(strategy, telemetry);
  }

  /**
   * Check if a strategy's resolve conditions are met.
   */
  private async checkResolveConditions(
    strategy: AdaptationStrategy,
    telemetry: SystemSnapshot
  ): Promise<void> {
    const allConditionsMet = strategy.resolveConditions.every(condition =>
      this.evaluateCondition(condition, telemetry)
    );

    if (!allConditionsMet) {
      // Reset sustained timer if conditions not met
      this.conditionTimers.delete(`resolve-${strategy.id}`);
      return;
    }

    // Check sustained duration
    const maxSustainedMs = Math.max(
      ...strategy.resolveConditions.map(c => c.sustainedMs)
    );

    const timerKey = `resolve-${strategy.id}`;
    const timerStart = this.conditionTimers.get(timerKey);

    if (!timerStart) {
      this.conditionTimers.set(timerKey, Date.now());
      return;
    }

    const elapsed = Date.now() - timerStart;
    if (elapsed < maxSustainedMs) {
      return;
    }

    // Conditions sustained - resolve the adaptation
    this.conditionTimers.delete(timerKey);
    await this.resolveAdaptation(strategy.id);
  }

  /**
   * Evaluate a single threshold condition against telemetry.
   */
  private evaluateCondition(
    condition: ThresholdCondition,
    telemetry: SystemSnapshot
  ): boolean {
    const metricValue = this.getMetricValue(condition.metric, telemetry);
    if (metricValue === null) return false;

    switch (condition.operator) {
      case 'gt':
        return metricValue > condition.value;
      case 'gte':
        return metricValue >= condition.value;
      case 'lt':
        return metricValue < condition.value;
      case 'lte':
        return metricValue <= condition.value;
      case 'eq':
        return metricValue === condition.value;
      default:
        return false;
    }
  }

  /**
   * Extract a metric value from telemetry.
   */
  private getMetricValue(
    metric: TelemetryMetric,
    telemetry: SystemSnapshot
  ): number | null {
    switch (metric) {
      case 'cpu_usage':
        return telemetry.cpu.percent;
      case 'memory_usage':
        return telemetry.memory.percent;
      case 'gpu_usage':
        return telemetry.gpu.utilization_percent;
      case 'gpu_temperature':
        return telemetry.gpu.temperature_c;
      case 'gpu_memory':
        return telemetry.gpu.memory_percent;
      case 'fps':
        // FPS is not in standard telemetry, would need game-specific integration
        return null;
      case 'frame_time':
        // Frame time is not in standard telemetry
        return null;
      default:
        return null;
    }
  }

  /**
   * Trigger an adaptation based on a strategy.
   */
  private async triggerAdaptation(
    strategy: AdaptationStrategy,
    telemetry: SystemSnapshot
  ): Promise<AdaptationResult> {
    const profileEngine = getProfileEngine();
    const currentProfile = profileEngine.getCurrentProfile();

    const context: ProfileContext = {
      powerSource: 'ac', // Would need actual detection
      memoryPressure: telemetry.memory.percent && telemetry.memory.percent > 90
        ? 'critical'
        : telemetry.memory.percent && telemetry.memory.percent > 80
          ? 'warn'
          : 'normal',
      thermalState: telemetry.gpu.temperature_c && telemetry.gpu.temperature_c > 85
        ? 'critical'
        : telemetry.gpu.temperature_c && telemetry.gpu.temperature_c > 75
          ? 'serious'
          : 'nominal',
      timeOfDay: new Date().getHours(),
      gameDetected: false,
    };

    const event: AdaptationEvent = {
      id: generateEventId(),
      strategyId: strategy.id,
      strategyName: strategy.name,
      scenario: strategy.scenario,
      severity: strategy.severity,
      triggeredConditions: strategy.triggerConditions,
      actionsTaken: strategy.actions,
      previousState: currentProfile ? {
        hardwareTuning: profileEngine.getEffectiveTuning() ?? undefined,
      } : undefined,
      context,
      triggeredAt: Date.now(),
      applied: false,
    };

    // Check if approval is required
    if (strategy.requiresApproval || this.config.alwaysRequireApproval) {
      this.state.pendingApproval.push(event);
      this.notifyListeners();
      return {
        success: true,
        event,
        expectedImpact: this.estimateImpact(strategy.actions),
      };
    }

    // Apply the adaptation
    return this.applyAdaptation(event, strategy.actions);
  }

  /**
   * Apply an adaptation's actions.
   */
  private async applyAdaptation(
    event: AdaptationEvent,
    actions: AdaptationAction[]
  ): Promise<AdaptationResult> {
    const profileEngine = getProfileEngine();
    const sortedActions = [...actions].sort((a, b) => b.priority - a.priority);

    try {
      for (const action of sortedActions) {
        if (action.type === 'hardware_tuning' && action.hardwareTuning) {
          const currentProfile = profileEngine.getCurrentProfile();
          if (currentProfile) {
            const mergedTuning: HardwareTuning = {
              ...currentProfile.hardwareTuning,
              ...action.hardwareTuning,
            };
            await profileEngine.activateProfile({
              ...currentProfile,
              hardwareTuning: mergedTuning,
            });
          }
        } else if (action.type === 'notification' && action.message) {
          // Notifications are handled by the UI via state
          console.info(`[Adaptation] ${action.message}`);
        }
        // setting_change actions would need game-specific integration
      }

      event.applied = true;
      this.state.activeAdaptations.push(event);
      this.state.cooldowns[event.strategyId] = Date.now() +
        (this.strategies.get(event.strategyId)?.cooldownMs ?? 60000);

      this.notifyListeners();

      return {
        success: true,
        event,
        expectedImpact: this.estimateImpact(actions),
      };
    } catch (error) {
      return {
        success: false,
        event,
        expectedImpact: {},
        error: String(error),
      };
    }
  }

  /**
   * Approve a pending adaptation.
   */
  async approveAdaptation(eventId: string): Promise<AdaptationResult | null> {
    const index = this.state.pendingApproval.findIndex(e => e.id === eventId);
    if (index < 0) return null;

    const event = this.state.pendingApproval[index];
    this.state.pendingApproval.splice(index, 1);

    const strategy = this.strategies.get(event.strategyId);
    if (!strategy) return null;

    return this.applyAdaptation(event, strategy.actions);
  }

  /**
   * Reject a pending adaptation.
   */
  rejectAdaptation(eventId: string): void {
    const index = this.state.pendingApproval.findIndex(e => e.id === eventId);
    if (index >= 0) {
      this.state.pendingApproval.splice(index, 1);
      this.notifyListeners();
    }
  }

  /**
   * Resolve an active adaptation (conditions no longer met).
   */
  private async resolveAdaptation(strategyId: string): Promise<void> {
    const index = this.state.activeAdaptations.findIndex(
      a => a.strategyId === strategyId
    );
    if (index < 0) return;

    const event = this.state.activeAdaptations[index];
    event.resolvedAt = Date.now();

    // Move to history
    this.state.activeAdaptations.splice(index, 1);
    this.state.history.unshift(event);

    // Trim history
    if (this.state.history.length > this.config.maxHistorySize) {
      this.state.history = this.state.history.slice(0, this.config.maxHistorySize);
    }

    // Restore previous state if available
    if (event.previousState?.hardwareTuning) {
      const profileEngine = getProfileEngine();
      const currentProfile = profileEngine.getCurrentProfile();
      if (currentProfile) {
        await profileEngine.activateProfile({
          ...currentProfile,
          hardwareTuning: event.previousState.hardwareTuning,
        });
      }
    }

    this.notifyListeners();
  }

  /**
   * Manually rollback an active adaptation.
   */
  async rollbackAdaptation(eventId: string): Promise<boolean> {
    const event = this.state.activeAdaptations.find(a => a.id === eventId);
    if (!event) return false;

    await this.resolveAdaptation(event.strategyId);
    return true;
  }

  /**
   * Check if a strategy is on cooldown.
   */
  private isOnCooldown(strategyId: string): boolean {
    const cooldownEnd = this.state.cooldowns[strategyId];
    if (!cooldownEnd) return false;
    return Date.now() < cooldownEnd;
  }

  /**
   * Estimate the impact of adaptation actions.
   */
  private estimateImpact(actions: AdaptationAction[]): {
    performance?: number;
    quality?: number;
    latency?: number;
    power?: number;
  } {
    // Simplified impact estimation
    let performanceImpact = 0;
    let powerImpact = 0;

    for (const action of actions) {
      if (action.type === 'hardware_tuning' && action.hardwareTuning) {
        const tuning = action.hardwareTuning;

        if (tuning.thermalPolicy === 'quiet') {
          performanceImpact -= 0.1;
          powerImpact += 0.2;
        } else if (tuning.thermalPolicy === 'performance') {
          performanceImpact += 0.1;
          powerImpact -= 0.2;
        }

        if (tuning.gpuPerformance === 'low') {
          performanceImpact -= 0.2;
          powerImpact += 0.3;
        } else if (tuning.gpuPerformance === 'high') {
          performanceImpact += 0.2;
          powerImpact -= 0.2;
        }

        if (tuning.processPriority === 'high') {
          performanceImpact += 0.1;
        }
      }
    }

    return {
      performance: performanceImpact,
      power: powerImpact,
    };
  }

  /**
   * Notify all listeners of state change.
   */
  private notifyListeners(): void {
    const state = this.getState();
    this.listeners.forEach(listener => listener(state));
  }

  /**
   * Get the last telemetry reading.
   */
  getLastTelemetry(): SystemSnapshot | null {
    return this.lastTelemetry;
  }
}

// Singleton instance
let engineInstance: AdaptationEngine | null = null;

/**
 * Get the AdaptationEngine singleton instance.
 */
export function getAdaptationEngine(
  config?: Partial<AdaptationEngineConfig>
): AdaptationEngine {
  if (!engineInstance) {
    engineInstance = new AdaptationEngine(config);
  }
  return engineInstance;
}

/**
 * Reset the adaptation engine (for testing).
 */
export function resetAdaptationEngine(): void {
  if (engineInstance) {
    engineInstance.stop();
    engineInstance = null;
  }
}
