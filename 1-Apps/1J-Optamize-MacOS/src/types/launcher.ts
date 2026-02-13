/**
 * Launcher types for Launch via Opta feature.
 *
 * These types support game launching, session tracking, and post-game summaries.
 */

/**
 * Configuration for pre-launch actions.
 */
export interface LaunchConfig {
  /** Apply pending optimizations before launch */
  applyOptimizations: boolean;
  /** Run Stealth Mode to free resources */
  runStealthMode: boolean;
  /** Track session metrics during gameplay */
  trackSession: boolean;
}

/**
 * Result of a game launch attempt.
 */
export interface LaunchResult {
  /** Whether the launch was successful */
  success: boolean;
  /** Timestamp when the game was launched */
  launchedAt: number | null;
  /** Error message if launch failed */
  error: string | null;
  /** The URL protocol used to launch */
  launchUrl: string;
}

/**
 * Status of whether a game is currently running.
 */
export interface GameRunningStatus {
  /** Whether the game is running */
  running: boolean;
  /** Process ID if running */
  pid: number | null;
  /** Name of the running process */
  processName: string | null;
  /** Current CPU usage percentage */
  cpuPercent: number | null;
  /** Current memory usage in MB */
  memoryMb: number | null;
}

/**
 * Real-time telemetry sample during a game session.
 */
export interface SessionTelemetry {
  /** Timestamp of this sample */
  timestamp: number;
  /** Current CPU usage percentage */
  cpuPercent: number | null;
  /** Current GPU usage percentage (if available) */
  gpuPercent: number | null;
  /** Current memory usage in MB */
  memoryMb: number | null;
  /** Current FPS (if available) */
  fps: number | null;
}

/**
 * Summary of a completed game session.
 */
export interface SessionSummary {
  /** Session identifier */
  sessionId: string;
  /** Game identifier */
  gameId: string;
  /** Game display name */
  gameName: string;
  /** Session start timestamp */
  startedAt: number;
  /** Session end timestamp */
  endedAt: number;
  /** Total duration in milliseconds */
  durationMs: number;
  /** Average CPU usage percentage */
  averageCpuPercent: number;
  /** Peak CPU usage percentage */
  peakCpuPercent: number;
  /** Average GPU usage percentage (if available) */
  averageGpuPercent: number | null;
  /** Peak GPU usage percentage (if available) */
  peakGpuPercent: number | null;
  /** Average memory usage in MB */
  averageMemoryMb: number;
  /** Peak memory usage in MB */
  peakMemoryMb: number;
  /** Memory saved by Stealth Mode in MB (if used) */
  stealthModeSavingsMb: number;
  /** Number of optimizations that were applied */
  optimizationsApplied: number;
}

/**
 * Active game session state.
 */
export interface GameSession {
  /** Session identifier */
  id: string;
  /** Game identifier */
  gameId: string;
  /** Game display name */
  gameName: string;
  /** Launcher that owns the game */
  launcher: string;
  /** Session start timestamp */
  startedAt: number;
  /** Pre-launch configuration used */
  config: LaunchConfig;
  /** Current session status */
  status: 'launching' | 'running' | 'ended' | 'error';
  /** Current telemetry (if tracking) */
  telemetry: SessionTelemetry | null;
  /** Final summary (after session ends) */
  summary: SessionSummary | null;
  /** Error message if status is 'error' */
  error: string | null;
}

/**
 * Pre-launch information for the confirmation modal.
 */
export interface PreLaunchInfo {
  /** Number of pending optimizations */
  pendingOptimizations: number;
  /** Estimated memory savings from Stealth Mode in MB */
  estimatedMemorySavingsMb: number;
  /** Number of safe-to-kill processes */
  safeToKillCount: number;
}
