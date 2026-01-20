/**
 * Hook for time series forecasting of telemetry metrics.
 *
 * Provides predictions for CPU, memory, and GPU usage using
 * exponential smoothing and trend analysis from the backend.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';

export interface ForecastPrediction {
  timestamp: number;
  value: number;
  confidence_lower: number;
  confidence_upper: number;
}

export interface ForecastResult {
  metric: 'cpu' | 'memory' | 'gpu';
  currentValue: number;
  predictions: ForecastPrediction[];
  trend: 'increasing' | 'decreasing' | 'stable';
  trendStrength: number;
  estimatedTimeToCritical: number | null;
  confidence: number;
}

export interface AllForecasts {
  cpu: ForecastResult | null;
  memory: ForecastResult | null;
  gpu: ForecastResult | null;
}

interface UseForecastOptions {
  /** How far ahead to forecast in seconds (default 60) */
  horizonSeconds?: number;
  /** Whether to auto-record telemetry (default true) */
  autoRecord?: boolean;
  /** Interval for recording telemetry in ms (default 1000) */
  recordInterval?: number;
}

export function useForecast(options: UseForecastOptions = {}) {
  const {
    horizonSeconds = 60,
    autoRecord = true,
    recordInterval = 1000,
  } = options;

  const [forecasts, setForecasts] = useState<AllForecasts>({
    cpu: null,
    memory: null,
    gpu: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataPoints, setDataPoints] = useState(0);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /**
   * Record telemetry data for forecasting
   */
  const recordTelemetry = useCallback(async (
    cpuPercent: number,
    memoryPercent: number,
    gpuPercent?: number
  ) => {
    try {
      await invoke('call_mcp_tool', {
        tool: 'record_telemetry_for_forecast',
        args: {
          cpu_percent: cpuPercent,
          memory_percent: memoryPercent,
          gpu_percent: gpuPercent,
        },
      });
      setDataPoints(prev => prev + 1);
    } catch (err) {
      console.error('Failed to record telemetry:', err);
    }
  }, []);

  /**
   * Get forecast for a specific metric
   */
  const getForecast = useCallback(async (
    metric: 'cpu' | 'memory' | 'gpu'
  ): Promise<ForecastResult | null> => {
    try {
      const result = await invoke<string>('call_mcp_tool', {
        tool: 'get_forecast',
        args: {
          metric,
          horizon_seconds: horizonSeconds,
        },
      });
      const parsed = JSON.parse(result);
      if (parsed.error) {
        return null;
      }
      return parsed as ForecastResult;
    } catch (err) {
      console.error(`Failed to get ${metric} forecast:`, err);
      return null;
    }
  }, [horizonSeconds]);

  /**
   * Get all forecasts at once
   */
  const getAllForecasts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await invoke<string>('call_mcp_tool', {
        tool: 'get_all_forecasts',
        args: { horizon_seconds: horizonSeconds },
      });
      const parsed = JSON.parse(result);
      setForecasts(parsed as AllForecasts);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get forecasts';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [horizonSeconds]);

  /**
   * Start auto-recording telemetry and updating forecasts
   */
  const startAutoRecord = useCallback(() => {
    if (intervalRef.current) return;

    const fetchAndRecord = async () => {
      try {
        // Get current telemetry
        const snapshotResult = await invoke<string>('call_mcp_tool', {
          tool: 'get_system_snapshot',
          args: {},
        });
        const snapshot = JSON.parse(snapshotResult);

        // Record for forecasting
        await recordTelemetry(
          snapshot.cpu?.percent || 0,
          snapshot.memory?.percent || 0,
          snapshot.gpu?.utilization_percent
        );

        // Update forecasts every 5 seconds
        if (dataPoints % 5 === 0) {
          await getAllForecasts();
        }
      } catch (err) {
        console.error('Auto-record failed:', err);
      }
    };

    // Start immediately
    fetchAndRecord();

    // Then continue at interval
    intervalRef.current = setInterval(fetchAndRecord, recordInterval);
  }, [recordTelemetry, getAllForecasts, recordInterval, dataPoints]);

  /**
   * Stop auto-recording
   */
  const stopAutoRecord = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Auto-start recording if enabled
  useEffect(() => {
    if (autoRecord) {
      startAutoRecord();
    }
    return () => stopAutoRecord();
  }, [autoRecord, startAutoRecord, stopAutoRecord]);

  /**
   * Check if we have enough data for reliable forecasts
   */
  const hasEnoughData = dataPoints >= 10;

  /**
   * Get trend description for display
   */
  const getTrendDescription = (forecast: ForecastResult | null): string => {
    if (!forecast) return 'No data';

    const { trend, trendStrength, estimatedTimeToCritical } = forecast;

    if (estimatedTimeToCritical !== null && estimatedTimeToCritical < 300) {
      const minutes = Math.round(estimatedTimeToCritical / 60);
      return `Critical in ~${minutes} min`;
    }

    if (trend === 'stable') return 'Stable';
    if (trend === 'increasing') {
      return trendStrength > 0.5 ? 'Rising fast' : 'Rising';
    }
    if (trend === 'decreasing') {
      return trendStrength > 0.5 ? 'Falling fast' : 'Falling';
    }

    return 'Unknown';
  };

  return {
    forecasts,
    loading,
    error,
    dataPoints,
    hasEnoughData,
    recordTelemetry,
    getForecast,
    getAllForecasts,
    getTrendDescription,
    startAutoRecord,
    stopAutoRecord,
  };
}
