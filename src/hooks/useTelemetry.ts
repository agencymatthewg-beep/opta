import { useState, useEffect, useCallback } from 'react';

// Type definitions matching the MCP server types from Plan 02-01
export interface CpuInfo {
  percent: number;
  cores: number;
  threads: number;
  frequency_mhz?: number;
  per_core?: number[];
}

export interface MemoryInfo {
  total_gb: number;
  used_gb: number;
  available_gb: number;
  percent: number;
}

export interface DiskInfo {
  total_gb: number;
  used_gb: number;
  free_gb: number;
  percent: number;
}

export interface GpuInfo {
  available: boolean;
  name?: string;
  load_percent?: number;
  memory_used_mb?: number;
  memory_total_mb?: number;
  temperature_c?: number;
}

export interface SystemSnapshot {
  cpu: CpuInfo;
  memory: MemoryInfo;
  disk: DiskInfo;
  gpu: GpuInfo;
  timestamp: string;
}

interface TelemetryState {
  telemetry: SystemSnapshot | null;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

// Mock data generator - simulates realistic system telemetry
// TODO: Replace with real MCP server calls when Plan 02-02 is complete
function generateMockTelemetry(): SystemSnapshot {
  // Add some realistic variance to simulate changing values
  const baseLoad = 30 + Math.random() * 40; // 30-70% base load
  const cpuJitter = (Math.random() - 0.5) * 10;
  const memJitter = (Math.random() - 0.5) * 5;

  return {
    cpu: {
      percent: Math.min(100, Math.max(0, baseLoad + cpuJitter)),
      cores: 8,
      threads: 16,
      frequency_mhz: 3200,
      per_core: Array.from({ length: 8 }, () =>
        Math.min(100, Math.max(0, baseLoad + (Math.random() - 0.5) * 20))
      ),
    },
    memory: {
      total_gb: 32,
      used_gb: 18.5 + memJitter,
      available_gb: 13.5 - memJitter,
      percent: Math.min(100, Math.max(0, 58 + memJitter * 2)),
    },
    disk: {
      total_gb: 500,
      used_gb: 287,
      free_gb: 213,
      percent: 57.4,
    },
    gpu: {
      available: true,
      name: 'NVIDIA GeForce RTX 3080',
      load_percent: Math.min(100, Math.max(0, baseLoad * 0.8 + (Math.random() - 0.5) * 15)),
      memory_used_mb: 4200,
      memory_total_mb: 10240,
      temperature_c: 55 + Math.floor(Math.random() * 15),
    },
    timestamp: new Date().toISOString(),
  };
}

export function useTelemetry(pollingIntervalMs: number = 2000): TelemetryState & {
  refetch: () => void;
} {
  const [state, setState] = useState<TelemetryState>({
    telemetry: null,
    loading: true,
    error: null,
    lastUpdated: null,
  });

  const fetchTelemetry = useCallback(async () => {
    try {
      // TODO: Replace with actual MCP server call when Plan 02-02 is complete
      // const response = await invoke('get_system_snapshot');

      // For now, use mock data with a small artificial delay
      await new Promise(resolve => setTimeout(resolve, 100));
      const data = generateMockTelemetry();

      setState({
        telemetry: data,
        loading: false,
        error: null,
        lastUpdated: new Date(),
      });
    } catch (err) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch telemetry',
      }));
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchTelemetry();
  }, [fetchTelemetry]);

  // Set up polling
  useEffect(() => {
    if (pollingIntervalMs <= 0) return;

    const intervalId = setInterval(fetchTelemetry, pollingIntervalMs);
    return () => clearInterval(intervalId);
  }, [pollingIntervalMs, fetchTelemetry]);

  return {
    ...state,
    refetch: fetchTelemetry,
  };
}
