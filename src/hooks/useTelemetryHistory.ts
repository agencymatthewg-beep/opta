/**
 * React hook for maintaining telemetry history.
 *
 * Provides a sliding window of telemetry data points for charting purposes.
 * Uses a circular buffer for O(1) operations and efficient memory usage.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTelemetry } from './useTelemetry';

/**
 * A single telemetry data point for charting.
 */
export interface TelemetryDataPoint {
  /** Unix timestamp in milliseconds */
  timestamp: number;
  /** CPU usage percentage (0-100) */
  cpu: number;
  /** Memory usage percentage (0-100) */
  memory: number;
  /** GPU usage percentage (0-100), null if not available */
  gpu: number | null;
  /** Disk usage percentage (0-100) */
  disk: number;
}

/**
 * Options for the useTelemetryHistory hook.
 */
export interface UseTelemetryHistoryOptions {
  /** Maximum number of data points to keep (default: 300 = 5 minutes at 1/sec) */
  maxPoints?: number;
  /** Sampling interval in milliseconds (default: 1000ms) */
  sampleInterval?: number;
}

/**
 * Return type for useTelemetryHistory hook.
 */
export interface UseTelemetryHistoryResult {
  /** Array of telemetry data points, oldest to newest */
  history: TelemetryDataPoint[];
  /** Clear all history data */
  clearHistory: () => void;
  /** Whether initial data has been collected */
  hasData: boolean;
  /** Latest data point (convenience accessor) */
  latest: TelemetryDataPoint | null;
}

/**
 * Circular buffer implementation for efficient O(1) append operations.
 * Avoids array shift() which is O(n).
 */
class CircularBuffer<T> {
  private buffer: (T | null)[];
  private head: number = 0; // Next write position
  private count: number = 0;
  private capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.buffer = new Array(capacity).fill(null);
  }

  push(item: T): void {
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) {
      this.count++;
    }
  }

  toArray(): T[] {
    if (this.count === 0) return [];

    const result: T[] = [];
    // Start from oldest item
    const start = this.count === this.capacity
      ? this.head
      : 0;

    for (let i = 0; i < this.count; i++) {
      const index = (start + i) % this.capacity;
      const item = this.buffer[index];
      if (item !== null) {
        result.push(item);
      }
    }

    return result;
  }

  clear(): void {
    this.buffer = new Array(this.capacity).fill(null);
    this.head = 0;
    this.count = 0;
  }

  get length(): number {
    return this.count;
  }

  get latest(): T | null {
    if (this.count === 0) return null;
    const lastIndex = (this.head - 1 + this.capacity) % this.capacity;
    return this.buffer[lastIndex];
  }
}

/**
 * Hook to maintain a sliding window of telemetry history for charting.
 *
 * Subscribes to telemetry updates and samples at configurable intervals.
 * Uses a circular buffer for O(1) performance on append operations.
 *
 * @param options - Configuration options for history collection
 * @returns History array, clear function, and status flags
 *
 * @example
 * ```tsx
 * const { history, clearHistory, hasData } = useTelemetryHistory({
 *   maxPoints: 300, // 5 minutes at 1/sec
 *   sampleInterval: 1000, // 1 sample per second
 * });
 *
 * // Use history for ECharts
 * const chartData = history.map(point => ({
 *   time: point.timestamp,
 *   cpu: point.cpu,
 * }));
 * ```
 */
export function useTelemetryHistory(
  options: UseTelemetryHistoryOptions = {}
): UseTelemetryHistoryResult {
  const { maxPoints = 300, sampleInterval = 1000 } = options;

  // Use existing telemetry hook for data source
  const { telemetry } = useTelemetry(sampleInterval);

  // Circular buffer stored in ref to avoid re-renders on every sample
  const bufferRef = useRef(new CircularBuffer<TelemetryDataPoint>(maxPoints));

  // State for triggering re-renders when consumers need updated data
  const [history, setHistory] = useState<TelemetryDataPoint[]>([]);

  // Track last sample time to enforce interval
  const lastSampleTimeRef = useRef<number>(0);

  // Sample telemetry data when it updates
  useEffect(() => {
    if (!telemetry) return;

    const now = Date.now();

    // Check if enough time has passed since last sample
    if (now - lastSampleTimeRef.current < sampleInterval * 0.9) {
      return; // Skip this update, too soon
    }

    lastSampleTimeRef.current = now;

    // Extract the values we care about for charting
    const dataPoint: TelemetryDataPoint = {
      timestamp: now,
      cpu: telemetry.cpu.percent ?? 0,
      memory: telemetry.memory.percent ?? 0,
      gpu: telemetry.gpu.available ? (telemetry.gpu.utilization_percent ?? null) : null,
      disk: telemetry.disk.percent ?? 0,
    };

    // Add to circular buffer (O(1))
    bufferRef.current.push(dataPoint);

    // Trigger re-render with new history
    setHistory(bufferRef.current.toArray());
  }, [telemetry, sampleInterval]);

  // Clear history callback
  const clearHistory = useCallback(() => {
    bufferRef.current.clear();
    setHistory([]);
  }, []);

  return {
    history,
    clearHistory,
    hasData: history.length > 0,
    latest: bufferRef.current.latest,
  };
}

export default useTelemetryHistory;
