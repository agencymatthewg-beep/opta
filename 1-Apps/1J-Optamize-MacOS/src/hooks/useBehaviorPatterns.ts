/**
 * Hook for behavior pattern detection and activity prediction.
 *
 * Learns user activity patterns (gaming, productivity, idle)
 * and provides predictions for future behavior.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';

export type ActivityType =
  | 'gaming'
  | 'productivity'
  | 'media'
  | 'idle'
  | 'sleep'
  | 'unknown';

export interface CurrentActivity {
  type: ActivityType;
  startTime: number;
  endTime: number;
  avgCpu: number;
  avgMemory: number;
  avgGpu: number | null;
  confidence: number;
  durationMinutes: number;
}

export interface DailyPattern {
  hour: number;
  dominantActivity: ActivityType;
  confidence: number;
  avgCpu: number;
  avgMemory: number;
  sampleCount: number;
}

export interface WeeklyPattern {
  day: number;
  dayName: string;
  activeHours: number[];
  gamingHours: number[];
  workHours: number[];
  avgDailyScreenTime: number;
}

export interface ActivityPrediction {
  hour: number;
  day: number;
  predictedActivity: ActivityType;
  confidence: number;
  expectedCpu: number;
  expectedMemory: number;
}

export interface PredictionResult {
  predictions: ActivityPrediction[];
  basedOnSamples: number;
}

interface UseBehaviorPatternsOptions {
  /** Whether to auto-record activity (default true) */
  autoRecord?: boolean;
  /** Interval for recording in ms (default 5000) */
  recordInterval?: number;
}

export function useBehaviorPatterns(options: UseBehaviorPatternsOptions = {}) {
  const {
    autoRecord = true,
    recordInterval = 5000, // 5 seconds
  } = options;

  const [currentActivity, setCurrentActivity] = useState<CurrentActivity | null>(null);
  const [dailyPatterns, setDailyPatterns] = useState<DailyPattern[]>([]);
  const [weeklyPatterns, setWeeklyPatterns] = useState<WeeklyPattern[]>([]);
  const [predictions, setPredictions] = useState<PredictionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /**
   * Record an activity sample
   */
  const recordSample = useCallback(async (
    cpuPercent: number,
    memoryPercent: number,
    gpuPercent?: number
  ) => {
    try {
      const result = await invoke<string>('call_mcp_tool', {
        tool: 'record_activity_sample',
        args: {
          cpu_percent: cpuPercent,
          memory_percent: memoryPercent,
          gpu_percent: gpuPercent,
        },
      });
      const parsed = JSON.parse(result);

      // If activity changed, we get the completed window
      if (parsed.activityChange) {
        console.log('Activity changed:', parsed.activityChange);
      }
    } catch (err) {
      console.error('Failed to record activity sample:', err);
    }
  }, []);

  /**
   * Get current activity
   */
  const getCurrentActivity = useCallback(async () => {
    try {
      const result = await invoke<string>('call_mcp_tool', {
        tool: 'get_current_activity',
        args: {},
      });
      const activity = JSON.parse(result);
      if (activity.type !== 'unknown') {
        setCurrentActivity(activity as CurrentActivity);
      }
    } catch (err) {
      console.error('Failed to get current activity:', err);
    }
  }, []);

  /**
   * Get daily patterns
   */
  const getDailyPatterns = useCallback(async () => {
    try {
      const result = await invoke<string>('call_mcp_tool', {
        tool: 'get_daily_patterns',
        args: {},
      });
      const patterns = JSON.parse(result) as DailyPattern[];
      setDailyPatterns(patterns);
    } catch (err) {
      console.error('Failed to get daily patterns:', err);
    }
  }, []);

  /**
   * Get weekly patterns
   */
  const getWeeklyPatterns = useCallback(async () => {
    try {
      const result = await invoke<string>('call_mcp_tool', {
        tool: 'get_weekly_patterns',
        args: {},
      });
      const patterns = JSON.parse(result) as WeeklyPattern[];
      setWeeklyPatterns(patterns);
    } catch (err) {
      console.error('Failed to get weekly patterns:', err);
    }
  }, []);

  /**
   * Get activity predictions
   */
  const getPredictions = useCallback(async (hoursAhead: number = 6) => {
    setLoading(true);
    setError(null);

    try {
      const result = await invoke<string>('call_mcp_tool', {
        tool: 'predict_activity',
        args: { hours_ahead: hoursAhead },
      });
      const predictionResult = JSON.parse(result) as PredictionResult;
      setPredictions(predictionResult);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get predictions';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Refresh all patterns
   */
  const refreshPatterns = useCallback(async () => {
    await Promise.all([
      getCurrentActivity(),
      getDailyPatterns(),
      getWeeklyPatterns(),
      getPredictions(6),
    ]);
  }, [getCurrentActivity, getDailyPatterns, getWeeklyPatterns, getPredictions]);

  /**
   * Start auto-recording activity
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

        // Record activity sample
        await recordSample(
          snapshot.cpu?.percent || 0,
          snapshot.memory?.percent || 0,
          snapshot.gpu?.utilization_percent
        );

        // Update current activity
        await getCurrentActivity();
      } catch (err) {
        console.error('Auto-record failed:', err);
      }
    };

    // Start immediately
    fetchAndRecord();

    // Then continue at interval
    intervalRef.current = setInterval(fetchAndRecord, recordInterval);
  }, [recordSample, getCurrentActivity, recordInterval]);

  /**
   * Stop auto-recording
   */
  const stopAutoRecord = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Auto-start if enabled
  useEffect(() => {
    if (autoRecord) {
      startAutoRecord();
    }
    return () => stopAutoRecord();
  }, [autoRecord, startAutoRecord, stopAutoRecord]);

  // Load patterns on mount
  useEffect(() => {
    refreshPatterns();
  }, [refreshPatterns]);

  /**
   * Get activity color class
   */
  const getActivityColor = (activity: ActivityType): string => {
    switch (activity) {
      case 'gaming':
        return 'text-success';
      case 'productivity':
        return 'text-primary';
      case 'media':
        return 'text-warning';
      case 'idle':
        return 'text-muted-foreground';
      case 'sleep':
        return 'text-muted';
      case 'unknown':
      default:
        return 'text-foreground';
    }
  };

  /**
   * Get activity icon name (for Lucide)
   */
  const getActivityIcon = (activity: ActivityType): string => {
    switch (activity) {
      case 'gaming':
        return 'Gamepad2';
      case 'productivity':
        return 'Briefcase';
      case 'media':
        return 'Film';
      case 'idle':
        return 'Moon';
      case 'sleep':
        return 'Bed';
      case 'unknown':
      default:
        return 'HelpCircle';
    }
  };

  /**
   * Get activity description
   */
  const getActivityDescription = (activity: ActivityType): string => {
    switch (activity) {
      case 'gaming':
        return 'High GPU/CPU activity detected';
      case 'productivity':
        return 'Moderate, steady usage';
      case 'media':
        return 'Media playback detected';
      case 'idle':
        return 'System is idle';
      case 'sleep':
        return 'System appears to be sleeping';
      case 'unknown':
      default:
        return 'Activity uncertain';
    }
  };

  /**
   * Check if we have enough data for reliable patterns
   */
  const hasEnoughData = dailyPatterns.some(p => p.sampleCount >= 10);

  /**
   * Get today's predicted gaming hours
   */
  const todayGamingHours = (() => {
    const today = new Date().getDay();
    const todayPattern = weeklyPatterns.find(p => p.day === (today === 0 ? 6 : today - 1));
    return todayPattern?.gamingHours || [];
  })();

  /**
   * Get total screen time for the week
   */
  const totalWeeklyScreenTime = weeklyPatterns.reduce(
    (sum, p) => sum + p.avgDailyScreenTime,
    0
  );

  return {
    currentActivity,
    dailyPatterns,
    weeklyPatterns,
    predictions,
    loading,
    error,
    hasEnoughData,
    todayGamingHours,
    totalWeeklyScreenTime,
    recordSample,
    getCurrentActivity,
    getDailyPatterns,
    getWeeklyPatterns,
    getPredictions,
    refreshPatterns,
    getActivityColor,
    getActivityIcon,
    getActivityDescription,
    startAutoRecord,
    stopAutoRecord,
  };
}
