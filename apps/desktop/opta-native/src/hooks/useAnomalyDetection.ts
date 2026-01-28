/**
 * Hook for anomaly detection in system telemetry.
 *
 * Detects unusual patterns including CPU spikes, memory pressure,
 * GPU thermal issues, and sustained high usage.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';

export type AnomalyType =
  | 'cpu_spike'
  | 'memory_pressure'
  | 'gpu_thermal'
  | 'unusual_baseline'
  | 'rapid_change'
  | 'sustained_high';

export type AnomalySeverity = 'info' | 'warning' | 'critical';

export interface Anomaly {
  id: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  metric: string;
  timestamp: number;
  currentValue: number;
  expectedValue: number;
  deviation: number;
  message: string;
  suggestion: string;
  autoDismissSeconds: number | null;
}

export interface BaselineStats {
  cpu: {
    mean: number;
    std: number;
    min: number;
    max: number;
    samples: number;
  };
  memory: {
    mean: number;
    std: number;
    min: number;
    max: number;
    samples: number;
  };
  gpu: {
    mean: number;
    std: number;
    min: number;
    max: number;
    samples: number;
  };
  gpu_temp: {
    mean: number;
    std: number;
    min: number;
    max: number;
    samples: number;
  };
}

interface UseAnomalyDetectionOptions {
  /** Whether to auto-process telemetry (default true) */
  autoProcess?: boolean;
  /** Interval for processing in ms (default 1000) */
  processInterval?: number;
  /** Callback when new anomalies are detected */
  onAnomalyDetected?: (anomalies: Anomaly[]) => void;
}

export function useAnomalyDetection(options: UseAnomalyDetectionOptions = {}) {
  const {
    autoProcess = true,
    processInterval = 1000,
    onAnomalyDetected,
  } = options;

  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [baselineStats, setBaselineStats] = useState<BaselineStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onAnomalyDetectedRef = useRef(onAnomalyDetected);

  // Keep callback ref updated
  useEffect(() => {
    onAnomalyDetectedRef.current = onAnomalyDetected;
  }, [onAnomalyDetected]);

  /**
   * Process telemetry through anomaly detection
   */
  const processTelemetry = useCallback(async (
    cpuPercent: number,
    memoryPercent: number,
    gpuPercent?: number,
    gpuTemp?: number
  ): Promise<Anomaly[]> => {
    try {
      const result = await invoke<string>('call_mcp_tool', {
        tool: 'process_anomaly_detection',
        args: {
          cpu_percent: cpuPercent,
          memory_percent: memoryPercent,
          gpu_percent: gpuPercent,
          gpu_temp: gpuTemp,
        },
      });
      const newAnomalies = JSON.parse(result) as Anomaly[];

      if (newAnomalies.length > 0 && onAnomalyDetectedRef.current) {
        onAnomalyDetectedRef.current(newAnomalies);
      }

      return newAnomalies;
    } catch (err) {
      console.error('Failed to process anomaly detection:', err);
      return [];
    }
  }, []);

  /**
   * Get all active anomalies
   */
  const getActiveAnomalies = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await invoke<string>('call_mcp_tool', {
        tool: 'get_active_anomalies',
        args: {},
      });
      const activeAnomalies = JSON.parse(result) as Anomaly[];
      setAnomalies(activeAnomalies);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get anomalies';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Dismiss an anomaly
   */
  const dismissAnomaly = useCallback(async (anomalyId: string) => {
    try {
      await invoke('call_mcp_tool', {
        tool: 'dismiss_anomaly',
        args: { anomaly_id: anomalyId },
      });
      setAnomalies(prev => prev.filter(a => a.id !== anomalyId));
    } catch (err) {
      console.error('Failed to dismiss anomaly:', err);
    }
  }, []);

  /**
   * Get baseline statistics
   */
  const getBaselineStats = useCallback(async () => {
    try {
      const result = await invoke<string>('call_mcp_tool', {
        tool: 'get_baseline_stats',
        args: {},
      });
      const stats = JSON.parse(result) as BaselineStats;
      setBaselineStats(stats);
    } catch (err) {
      console.error('Failed to get baseline stats:', err);
    }
  }, []);

  /**
   * Start auto-processing telemetry
   */
  const startAutoProcess = useCallback(() => {
    if (intervalRef.current) return;

    const fetchAndProcess = async () => {
      try {
        // Get current telemetry
        const snapshotResult = await invoke<string>('call_mcp_tool', {
          tool: 'get_system_snapshot',
          args: {},
        });
        const snapshot = JSON.parse(snapshotResult);

        // Process through anomaly detection
        await processTelemetry(
          snapshot.cpu?.percent || 0,
          snapshot.memory?.percent || 0,
          snapshot.gpu?.utilization_percent,
          snapshot.gpu?.temperature_c
        );

        // Refresh active anomalies
        await getActiveAnomalies();
      } catch (err) {
        console.error('Auto-process failed:', err);
      }
    };

    // Start immediately
    fetchAndProcess();

    // Then continue at interval
    intervalRef.current = setInterval(fetchAndProcess, processInterval);
  }, [processTelemetry, getActiveAnomalies, processInterval]);

  /**
   * Stop auto-processing
   */
  const stopAutoProcess = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Auto-start if enabled
  useEffect(() => {
    if (autoProcess) {
      startAutoProcess();
    }
    return () => stopAutoProcess();
  }, [autoProcess, startAutoProcess, stopAutoProcess]);

  // Load baseline stats on mount
  useEffect(() => {
    getBaselineStats();
  }, [getBaselineStats]);

  /**
   * Get count of anomalies by severity
   */
  const anomalyCounts = {
    critical: anomalies.filter(a => a.severity === 'critical').length,
    warning: anomalies.filter(a => a.severity === 'warning').length,
    info: anomalies.filter(a => a.severity === 'info').length,
    total: anomalies.length,
  };

  /**
   * Check if there are any critical anomalies
   */
  const hasCritical = anomalyCounts.critical > 0;

  /**
   * Get severity color class
   */
  const getSeverityColor = (severity: AnomalySeverity): string => {
    switch (severity) {
      case 'critical':
        return 'text-danger';
      case 'warning':
        return 'text-warning';
      case 'info':
      default:
        return 'text-primary';
    }
  };

  /**
   * Get severity icon name (for Lucide)
   */
  const getSeverityIcon = (severity: AnomalySeverity): string => {
    switch (severity) {
      case 'critical':
        return 'AlertTriangle';
      case 'warning':
        return 'AlertCircle';
      case 'info':
      default:
        return 'Info';
    }
  };

  return {
    anomalies,
    baselineStats,
    loading,
    error,
    anomalyCounts,
    hasCritical,
    processTelemetry,
    getActiveAnomalies,
    dismissAnomaly,
    getBaselineStats,
    getSeverityColor,
    getSeverityIcon,
    startAutoProcess,
    stopAutoProcess,
  };
}
