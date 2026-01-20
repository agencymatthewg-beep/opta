/**
 * Benchmarking types.
 */

export interface BenchmarkSession {
  benchmark_id: string;
  game_id: string;
  phase: 'before' | 'after';
  started_at: number;
  status: 'running' | 'completed' | 'failed';
}

export interface BenchmarkMetrics {
  cpu_avg: number;
  cpu_max: number;
  memory_avg: number;
  memory_max: number;
  gpu_avg: number | null;
  gpu_max: number | null;
  gpu_temp_avg: number | null;
  sample_count: number;
  duration_seconds: number;
}

export interface BenchmarkImprovement {
  cpu_reduction?: number;
  cpu_reduction_percent?: number;
  memory_reduction?: number;
  memory_reduction_percent?: number;
  gpu_temp_reduction?: number;
}

export interface BenchmarkComparison {
  game_id: string;
  game_name: string;
  before: BenchmarkMetrics | null;
  after: BenchmarkMetrics | null;
  improvement: BenchmarkImprovement | null;
  before_timestamp: number | null;
  after_timestamp: number | null;
}
