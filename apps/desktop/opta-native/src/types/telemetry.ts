/**
 * Hardware telemetry types for Opta.
 *
 * These types match the Rust structs in src-tauri/src/telemetry.rs
 * and the Python telemetry functions in mcp-server/src/opta_mcp/telemetry.py.
 */

/**
 * CPU telemetry information.
 */
export interface CpuInfo {
  /** Current CPU usage percentage (0-100) */
  percent: number | null;
  /** Number of physical CPU cores */
  cores: number | null;
  /** Number of logical processors (threads) */
  threads: number | null;
  /** Current CPU frequency in MHz */
  frequency_mhz: number | null;
  /** Per-core CPU usage percentages */
  per_core_percent: number[] | null;
}

/**
 * Memory (RAM) telemetry information.
 */
export interface MemoryInfo {
  /** Total system RAM in GB */
  total_gb: number | null;
  /** Used RAM in GB */
  used_gb: number | null;
  /** Available RAM in GB */
  available_gb: number | null;
  /** RAM usage percentage (0-100) */
  percent: number | null;
}

/**
 * Disk telemetry information (primary disk).
 */
export interface DiskInfo {
  /** Total disk space in GB */
  total_gb: number | null;
  /** Used disk space in GB */
  used_gb: number | null;
  /** Free disk space in GB */
  free_gb: number | null;
  /** Disk usage percentage (0-100) */
  percent: number | null;
}

/**
 * GPU telemetry information.
 */
export interface GpuInfo {
  /** Whether a GPU was detected */
  available: boolean;
  /** GPU name/model */
  name: string | null;
  /** Total VRAM in GB */
  memory_total_gb: number | null;
  /** Used VRAM in GB */
  memory_used_gb: number | null;
  /** VRAM usage percentage (0-100) */
  memory_percent: number | null;
  /** GPU temperature in Celsius */
  temperature_c: number | null;
  /** GPU compute utilization percentage (0-100) */
  utilization_percent: number | null;
}

/**
 * Complete system telemetry snapshot.
 */
export interface SystemSnapshot {
  /** CPU telemetry */
  cpu: CpuInfo;
  /** Memory telemetry */
  memory: MemoryInfo;
  /** Disk telemetry */
  disk: DiskInfo;
  /** GPU telemetry */
  gpu: GpuInfo;
  /** ISO timestamp of when snapshot was taken */
  timestamp: string;
}
