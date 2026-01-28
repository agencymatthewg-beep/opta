/**
 * usePerformanceMonitor - Hook for monitoring performance after optimization.
 *
 * Tracks performance metrics (FPS, CPU, GPU usage) to detect degradation
 * after optimizations are applied. Alerts user if performance drops significantly.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTelemetry } from './useTelemetry';

/**
 * Performance metrics snapshot.
 */
export interface PerformanceMetrics {
  /** Frames per second (estimated from GPU utilization) */
  fps: number;
  /** CPU usage percentage */
  cpuPercent: number;
  /** GPU utilization percentage */
  gpuPercent: number;
  /** GPU temperature in Celsius */
  gpuTempC: number | null;
  /** Memory usage percentage */
  memoryPercent: number;
  /** Timestamp of measurement */
  timestamp: number;
}

/**
 * Degradation thresholds for alerting.
 */
export interface DegradationThresholds {
  /** FPS drop percentage to trigger alert (default: 20%) */
  fpsDropPercent: number;
  /** Temperature increase in C to trigger alert (default: 10) */
  tempIncreaseCelsius: number;
  /** Minimum samples before detection starts (default: 3) */
  minSamples: number;
}

const DEFAULT_THRESHOLDS: DegradationThresholds = {
  fpsDropPercent: 20,
  tempIncreaseCelsius: 10,
  minSamples: 3,
};

/**
 * Hook for monitoring performance degradation after optimization.
 *
 * @param pollingIntervalMs - How often to check performance (default: 5000ms)
 * @param thresholds - Degradation thresholds
 */
export function usePerformanceMonitor(
  pollingIntervalMs: number = 5000,
  thresholds: Partial<DegradationThresholds> = {}
) {
  const mergedThresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };

  const [baseline, setBaseline] = useState<PerformanceMetrics | null>(null);
  const [current, setCurrent] = useState<PerformanceMetrics | null>(null);
  const [samples, setSamples] = useState<PerformanceMetrics[]>([]);
  const [degradationDetected, setDegradationDetected] = useState(false);
  const [isMonitoring, setIsMonitoring] = useState(false);

  const { telemetry } = useTelemetry(isMonitoring ? pollingIntervalMs : 0);
  const mountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /**
   * Convert telemetry to performance metrics.
   * Estimates FPS based on GPU utilization as a proxy.
   */
  const telemetryToMetrics = useCallback((): PerformanceMetrics | null => {
    if (!telemetry) return null;

    // Estimate FPS: When GPU is at 100%, assume target of 60 FPS
    // Lower GPU usage typically means higher FPS potential
    // This is a rough estimate; real FPS would need game integration
    const gpuUtil = telemetry.gpu.utilization_percent ?? 0;
    const estimatedFps = gpuUtil > 0 ? Math.min(144, Math.round(60 * (100 / gpuUtil))) : 60;

    return {
      fps: estimatedFps,
      cpuPercent: telemetry.cpu.percent ?? 0,
      gpuPercent: gpuUtil,
      gpuTempC: telemetry.gpu.temperature_c,
      memoryPercent: telemetry.memory.percent ?? 0,
      timestamp: Date.now(),
    };
  }, [telemetry]);

  /**
   * Start monitoring with current metrics as baseline.
   */
  const startMonitoring = useCallback(
    (baselineMetrics?: PerformanceMetrics) => {
      if (baselineMetrics) {
        setBaseline(baselineMetrics);
      } else {
        // Use current telemetry as baseline
        const metrics = telemetryToMetrics();
        if (metrics) {
          setBaseline(metrics);
        }
      }

      setSamples([]);
      setDegradationDetected(false);
      setIsMonitoring(true);
    },
    [telemetryToMetrics]
  );

  /**
   * Stop monitoring.
   */
  const stopMonitoring = useCallback(() => {
    setIsMonitoring(false);
    setDegradationDetected(false);
  }, []);

  /**
   * Reset degradation detection without stopping monitoring.
   */
  const clearDegradation = useCallback(() => {
    setDegradationDetected(false);
  }, []);

  /**
   * Update current metrics and check for degradation.
   */
  useEffect(() => {
    if (!isMonitoring || !baseline) return;

    const metrics = telemetryToMetrics();
    if (!metrics || !mountedRef.current) return;

    setCurrent(metrics);
    setSamples((prev) => [...prev.slice(-9), metrics]); // Keep last 10 samples

    // Need minimum samples before detecting
    if (samples.length < mergedThresholds.minSamples) return;

    // Calculate average FPS from samples
    const avgFps =
      samples.reduce((sum, s) => sum + s.fps, 0) / samples.length;

    // Check for FPS degradation (>threshold% worse)
    const fpsDropPercent = ((baseline.fps - avgFps) / baseline.fps) * 100;
    if (fpsDropPercent >= mergedThresholds.fpsDropPercent) {
      setDegradationDetected(true);
    }

    // Check for temperature increase
    if (
      baseline.gpuTempC !== null &&
      metrics.gpuTempC !== null &&
      metrics.gpuTempC - baseline.gpuTempC >= mergedThresholds.tempIncreaseCelsius
    ) {
      setDegradationDetected(true);
    }
  }, [
    telemetry,
    isMonitoring,
    baseline,
    telemetryToMetrics,
    samples,
    mergedThresholds,
  ]);

  /**
   * Calculate the drop percentage between baseline and current.
   */
  const getDropPercentage = useCallback((): number | null => {
    if (!baseline || !current) return null;
    return Math.round(((baseline.fps - current.fps) / baseline.fps) * 100);
  }, [baseline, current]);

  /**
   * Get performance comparison summary.
   */
  const getComparison = useCallback(() => {
    if (!baseline || !current) return null;

    const fpsChange = current.fps - baseline.fps;
    const tempChange =
      current.gpuTempC !== null && baseline.gpuTempC !== null
        ? current.gpuTempC - baseline.gpuTempC
        : null;
    const cpuChange = current.cpuPercent - baseline.cpuPercent;

    return {
      fpsChange,
      fpsChangePercent: Math.round((fpsChange / baseline.fps) * 100),
      tempChange,
      cpuChange,
      isImproved: fpsChange > 0 || (tempChange !== null && tempChange < 0),
      isDegraded: fpsChange < 0 || (tempChange !== null && tempChange > 0),
    };
  }, [baseline, current]);

  return {
    /** Baseline performance metrics */
    baseline,
    /** Current performance metrics */
    current,
    /** Historical samples */
    samples,
    /** Whether degradation was detected */
    degradationDetected,
    /** Whether monitoring is active */
    isMonitoring,
    /** Start monitoring with optional baseline */
    startMonitoring,
    /** Stop monitoring */
    stopMonitoring,
    /** Clear degradation flag without stopping */
    clearDegradation,
    /** Get drop percentage */
    getDropPercentage,
    /** Get comparison summary */
    getComparison,
  };
}

export default usePerformanceMonitor;
