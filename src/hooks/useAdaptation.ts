/**
 * Phase 49: Real-Time Adaptation
 *
 * React hook for integrating with the AdaptationEngine.
 * Provides real-time adaptation state and controls.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getAdaptationEngine,
  type AdaptationState,
  type AdaptationEngineConfig,
  type AdaptationStrategy,
  type AdaptationEvent,
  type AdaptationResult,
  type TelemetryThresholds,
} from '../lib/adaptation';

/**
 * Return type for useAdaptation hook.
 */
export interface UseAdaptationResult {
  /** Current adaptation state */
  state: AdaptationState;
  /** All registered strategies */
  strategies: AdaptationStrategy[];
  /** Whether monitoring is active */
  isMonitoring: boolean;
  /** Active adaptations that have been applied */
  activeAdaptations: AdaptationEvent[];
  /** Pending adaptations awaiting approval */
  pendingApproval: AdaptationEvent[];
  /** Recent adaptation history */
  history: AdaptationEvent[];
  /** Start monitoring */
  start: () => void;
  /** Stop monitoring */
  stop: () => void;
  /** Toggle monitoring */
  toggle: () => void;
  /** Enable or disable a strategy */
  setStrategyEnabled: (strategyId: string, enabled: boolean) => void;
  /** Update telemetry thresholds */
  setThresholds: (thresholds: Partial<TelemetryThresholds>) => void;
  /** Approve a pending adaptation */
  approveAdaptation: (eventId: string) => Promise<AdaptationResult | null>;
  /** Reject a pending adaptation */
  rejectAdaptation: (eventId: string) => void;
  /** Manually rollback an active adaptation */
  rollbackAdaptation: (eventId: string) => Promise<boolean>;
  /** Force a telemetry check */
  forceCheck: () => Promise<void>;
}

/**
 * Hook to integrate with the AdaptationEngine for real-time optimization.
 *
 * @param config - Optional configuration for the adaptation engine
 * @param autoStart - Whether to automatically start monitoring (default: false)
 * @returns Adaptation state and control functions
 *
 * @example
 * ```tsx
 * const {
 *   state,
 *   isMonitoring,
 *   activeAdaptations,
 *   pendingApproval,
 *   start,
 *   stop,
 *   approveAdaptation
 * } = useAdaptation({ autoStart: true });
 *
 * // Display active adaptations
 * {activeAdaptations.map(adaptation => (
 *   <Alert key={adaptation.id} severity={adaptation.severity}>
 *     {adaptation.strategyName}
 *   </Alert>
 * ))}
 *
 * // Handle pending approvals
 * {pendingApproval.map(pending => (
 *   <ApprovalCard
 *     key={pending.id}
 *     onApprove={() => approveAdaptation(pending.id)}
 *     onReject={() => rejectAdaptation(pending.id)}
 *   />
 * ))}
 * ```
 */
export function useAdaptation(
  config?: Partial<AdaptationEngineConfig>,
  autoStart: boolean = false
): UseAdaptationResult {
  const engine = useMemo(() => getAdaptationEngine(config), []);

  const [state, setState] = useState<AdaptationState>(engine.getState());
  const [strategies, setStrategies] = useState<AdaptationStrategy[]>(
    engine.getStrategies()
  );

  // Subscribe to state changes
  useEffect(() => {
    const unsubscribe = engine.subscribe(newState => {
      setState(newState);
    });

    // Auto-start if configured
    if (autoStart && !state.monitoring) {
      engine.start();
    }

    return () => {
      unsubscribe();
    };
  }, [engine, autoStart]);

  // Derived state
  const isMonitoring = state.monitoring;
  const activeAdaptations = state.activeAdaptations;
  const pendingApproval = state.pendingApproval;
  const history = state.history;

  // Control functions
  const start = useCallback(() => {
    engine.start();
  }, [engine]);

  const stop = useCallback(() => {
    engine.stop();
  }, [engine]);

  const toggle = useCallback(() => {
    if (state.monitoring) {
      engine.stop();
    } else {
      engine.start();
    }
  }, [engine, state.monitoring]);

  const setStrategyEnabled = useCallback(
    (strategyId: string, enabled: boolean) => {
      engine.setStrategyEnabled(strategyId, enabled);
      setStrategies(engine.getStrategies());
    },
    [engine]
  );

  const setThresholds = useCallback(
    (thresholds: Partial<TelemetryThresholds>) => {
      engine.setThresholds(thresholds);
    },
    [engine]
  );

  const approveAdaptation = useCallback(
    (eventId: string) => engine.approveAdaptation(eventId),
    [engine]
  );

  const rejectAdaptation = useCallback(
    (eventId: string) => engine.rejectAdaptation(eventId),
    [engine]
  );

  const rollbackAdaptation = useCallback(
    (eventId: string) => engine.rollbackAdaptation(eventId),
    [engine]
  );

  const forceCheck = useCallback(() => engine.checkTelemetry(), [engine]);

  return {
    state,
    strategies,
    isMonitoring,
    activeAdaptations,
    pendingApproval,
    history,
    start,
    stop,
    toggle,
    setStrategyEnabled,
    setThresholds,
    approveAdaptation,
    rejectAdaptation,
    rollbackAdaptation,
    forceCheck,
  };
}

export default useAdaptation;
