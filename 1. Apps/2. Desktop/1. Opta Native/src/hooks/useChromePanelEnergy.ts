/**
 * useChromePanelEnergy - Hook for Chrome Panel Energy Management
 *
 * Connects individual panels to the energy system, enabling:
 * - Automatic energy state based on system telemetry
 * - Manual pulse triggers for data updates
 * - Per-panel energy state management
 * - Smooth energy transitions
 *
 * @see EnergyReactor.tsx - Global energy management
 * @see ChromeContext.tsx - Chrome state provider
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useChromeOptional } from '@/contexts/ChromeContext';
import { useTelemetry } from './useTelemetry';
import type { ChromeEnergyState } from '@/components/chrome/ChromeRegistry';
import type { SystemSnapshot } from '@/types/telemetry';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Energy calculation configuration
 */
export interface EnergyConfig {
  /** CPU threshold for active state (default: 30) */
  cpuActiveThreshold: number;
  /** CPU threshold for storm state (default: 80) */
  cpuStormThreshold: number;
  /** Memory threshold for active state (default: 60) */
  memoryActiveThreshold: number;
  /** Memory threshold for storm state (default: 90) */
  memoryStormThreshold: number;
  /** GPU threshold for active state (default: 30) */
  gpuActiveThreshold: number;
  /** GPU threshold for storm state (default: 80) */
  gpuStormThreshold: number;
  /** Duration of pulse state in ms (default: 300) */
  pulseDurationMs: number;
  /** Whether to auto-pulse on data updates (default: true) */
  autoPulseOnUpdate: boolean;
  /** Minimum change to trigger pulse (default: 5) */
  pulseThreshold: number;
}

const DEFAULT_CONFIG: EnergyConfig = {
  cpuActiveThreshold: 30,
  cpuStormThreshold: 80,
  memoryActiveThreshold: 60,
  memoryStormThreshold: 90,
  gpuActiveThreshold: 30,
  gpuStormThreshold: 80,
  pulseDurationMs: 300,
  autoPulseOnUpdate: true,
  pulseThreshold: 5,
};

/**
 * Energy metrics derived from telemetry
 */
export interface EnergyMetrics {
  /** Overall energy level (0-100) */
  level: number;
  /** CPU contribution (0-100) */
  cpuEnergy: number;
  /** Memory contribution (0-100) */
  memoryEnergy: number;
  /** GPU contribution (0-100) */
  gpuEnergy: number;
  /** Current energy state */
  state: ChromeEnergyState;
  /** Whether system is under high load */
  isHighLoad: boolean;
  /** Rate of change in energy level */
  deltaPerSecond: number;
}

/**
 * Return type for useChromePanelEnergy
 */
export interface UseChromePanelEnergyReturn {
  /** Current energy metrics */
  metrics: EnergyMetrics;
  /** Calculated energy state */
  energyState: ChromeEnergyState;
  /** Trigger a pulse animation */
  pulse: () => void;
  /** Trigger a storm animation (high intensity) */
  storm: (durationMs?: number) => void;
  /** Set manual energy state override */
  setManualState: (state: ChromeEnergyState | null) => void;
  /** Clear manual state and return to auto */
  clearManualState: () => void;
  /** Whether using manual override */
  isManualOverride: boolean;
  /** Raw telemetry data */
  telemetry: SystemSnapshot | null;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Calculate energy level from a percentage value
 */
function calculateEnergyFromPercent(
  value: number | null,
  activeThreshold: number,
  stormThreshold: number
): number {
  if (value === null) return 0;

  // Normalize to 0-100 range with emphasis on high values
  const normalized = Math.min(100, Math.max(0, value));

  // Apply curve to emphasize high values
  if (normalized >= stormThreshold) {
    return 80 + ((normalized - stormThreshold) / (100 - stormThreshold)) * 20;
  } else if (normalized >= activeThreshold) {
    return 30 + ((normalized - activeThreshold) / (stormThreshold - activeThreshold)) * 50;
  } else {
    return (normalized / activeThreshold) * 30;
  }
}

/**
 * Determine energy state from level
 */
function levelToState(level: number): ChromeEnergyState {
  if (level >= 80) return 'storm';
  if (level >= 50) return 'active';
  if (level >= 20) return 'active'; // Slight activity
  return 'dormant';
}

// =============================================================================
// HOOK
// =============================================================================

/**
 * Hook to manage chrome panel energy based on system telemetry.
 *
 * @param panelId - Optional panel ID for individual panel control
 * @param config - Energy calculation configuration
 *
 * @example
 * ```tsx
 * function MyPanel() {
 *   const { energyState, metrics, pulse } = useChromePanelEnergy('my-panel');
 *
 *   // Auto-updates based on system load
 *   // Call pulse() on data updates for visual feedback
 *
 *   return (
 *     <ChromePanel id="my-panel" energyState={energyState}>
 *       <div onClick={() => pulse()}>Energy: {metrics.level}%</div>
 *     </ChromePanel>
 *   );
 * }
 * ```
 */
export function useChromePanelEnergy(
  panelId?: string,
  config: Partial<EnergyConfig> = {}
): UseChromePanelEnergyReturn {
  const mergedConfig = useMemo(
    () => ({ ...DEFAULT_CONFIG, ...config }),
    [config]
  );

  const chromeContext = useChromeOptional();
  const { telemetry } = useTelemetry(1000); // 1s polling for energy

  // State
  const [manualState, setManualState] = useState<ChromeEnergyState | null>(null);
  const [isPulsing, setIsPulsing] = useState(false);
  const [isStorming, setIsStorming] = useState(false);
  const previousLevelRef = useRef<number>(0);
  const lastUpdateRef = useRef<number>(Date.now());
  const pulseTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const stormTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Calculate energy metrics from telemetry
  const metrics = useMemo((): EnergyMetrics => {
    if (!telemetry) {
      return {
        level: 0,
        cpuEnergy: 0,
        memoryEnergy: 0,
        gpuEnergy: 0,
        state: 'dormant',
        isHighLoad: false,
        deltaPerSecond: 0,
      };
    }

    const cpuEnergy = calculateEnergyFromPercent(
      telemetry.cpu.percent,
      mergedConfig.cpuActiveThreshold,
      mergedConfig.cpuStormThreshold
    );

    const memoryEnergy = calculateEnergyFromPercent(
      telemetry.memory.percent,
      mergedConfig.memoryActiveThreshold,
      mergedConfig.memoryStormThreshold
    );

    const gpuEnergy = calculateEnergyFromPercent(
      telemetry.gpu.utilization_percent,
      mergedConfig.gpuActiveThreshold,
      mergedConfig.gpuStormThreshold
    );

    // Combined level with weighted average (CPU most important)
    const level = Math.round(
      cpuEnergy * 0.5 + memoryEnergy * 0.25 + gpuEnergy * 0.25
    );

    // Calculate delta
    const now = Date.now();
    const timeDelta = (now - lastUpdateRef.current) / 1000;
    const levelDelta = level - previousLevelRef.current;
    const deltaPerSecond = timeDelta > 0 ? levelDelta / timeDelta : 0;

    // Update refs
    previousLevelRef.current = level;
    lastUpdateRef.current = now;

    const state = levelToState(level);
    const isHighLoad = level >= 70;

    return {
      level,
      cpuEnergy: Math.round(cpuEnergy),
      memoryEnergy: Math.round(memoryEnergy),
      gpuEnergy: Math.round(gpuEnergy),
      state,
      isHighLoad,
      deltaPerSecond: Math.round(deltaPerSecond * 10) / 10,
    };
  }, [telemetry, mergedConfig]);

  // Auto-pulse on significant changes
  useEffect(() => {
    if (!mergedConfig.autoPulseOnUpdate) return;
    if (!telemetry) return;

    const levelChange = Math.abs(metrics.level - previousLevelRef.current);
    if (levelChange >= mergedConfig.pulseThreshold && !isPulsing && !isStorming) {
      setIsPulsing(true);
      pulseTimeoutRef.current = setTimeout(() => {
        setIsPulsing(false);
      }, mergedConfig.pulseDurationMs);
    }
  }, [telemetry, metrics.level, mergedConfig, isPulsing, isStorming]);

  // Cleanup timeouts
  useEffect(() => {
    return () => {
      if (pulseTimeoutRef.current) clearTimeout(pulseTimeoutRef.current);
      if (stormTimeoutRef.current) clearTimeout(stormTimeoutRef.current);
    };
  }, []);

  // Determine final energy state
  const energyState = useMemo((): ChromeEnergyState => {
    // Manual override takes precedence
    if (manualState) return manualState;
    // Storm effect
    if (isStorming) return 'storm';
    // Pulse effect
    if (isPulsing) return 'pulse';
    // Auto state from metrics
    return metrics.state;
  }, [manualState, isStorming, isPulsing, metrics.state]);

  // Sync with chrome context
  useEffect(() => {
    if (!panelId || !chromeContext?.state.isEnabled) return;
    chromeContext.actions.setPanelEnergy(panelId, energyState);
  }, [panelId, chromeContext, energyState]);

  // Actions
  const pulse = useCallback(() => {
    if (pulseTimeoutRef.current) clearTimeout(pulseTimeoutRef.current);
    setIsPulsing(true);
    pulseTimeoutRef.current = setTimeout(() => {
      setIsPulsing(false);
    }, mergedConfig.pulseDurationMs);
  }, [mergedConfig.pulseDurationMs]);

  const storm = useCallback((durationMs: number = 1000) => {
    if (stormTimeoutRef.current) clearTimeout(stormTimeoutRef.current);
    setIsStorming(true);
    stormTimeoutRef.current = setTimeout(() => {
      setIsStorming(false);
    }, durationMs);
  }, []);

  const setManual = useCallback((state: ChromeEnergyState | null) => {
    setManualState(state);
  }, []);

  const clearManual = useCallback(() => {
    setManualState(null);
  }, []);

  return {
    metrics,
    energyState,
    pulse,
    storm,
    setManualState: setManual,
    clearManualState: clearManual,
    isManualOverride: manualState !== null,
    telemetry,
  };
}

/**
 * Hook for global energy management
 */
export function useGlobalEnergy(config: Partial<EnergyConfig> = {}) {
  const chromeContext = useChromeOptional();
  const { metrics, energyState, pulse, storm } = useChromePanelEnergy(undefined, config);

  // Sync global energy state
  useEffect(() => {
    if (!chromeContext?.state.isReady) return;
    chromeContext.actions.setGlobalEnergy(energyState);
  }, [chromeContext, energyState]);

  return {
    metrics,
    globalEnergyState: energyState,
    pulse,
    storm,
    setGlobalEnergy: chromeContext?.actions.setGlobalEnergy,
  };
}

export default useChromePanelEnergy;
