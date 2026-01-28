/**
 * Process management types for Opta.
 *
 * These types match the Rust structs in src-tauri/src/processes.rs
 * and the Python process functions in mcp-server/src/opta_mcp/processes.py.
 */

/**
 * Process category for Stealth Mode classification.
 * - "system": Critical system processes that should never be killed
 * - "user": User applications
 * - "safe-to-kill": Bloatware and non-essential processes
 */
export type ProcessCategory = "system" | "user" | "safe-to-kill";

/**
 * Process information with resource usage and categorization.
 */
export interface ProcessInfo {
  /** Process ID */
  pid: number;
  /** Process name */
  name: string;
  /** CPU usage percentage (0-100) */
  cpu_percent: number;
  /** Memory usage percentage (0-100) */
  memory_percent: number;
  /** Process status (running, sleeping, etc.) */
  status: string;
  /** Category: "system", "user", or "safe-to-kill" */
  category: ProcessCategory;
  /** Username running the process (may be null) */
  username: string | null;
}

/**
 * Result of terminating a single process.
 */
export interface TerminateResult {
  /** Whether termination was successful */
  success: boolean;
  /** Process ID */
  pid: number;
  /** Process name (if available) */
  name?: string;
  /** Error message (if failed) */
  error?: string;
  /** Memory freed in MB (estimated) */
  memory_mb?: number;
}

/**
 * Result of Stealth Mode execution.
 */
export interface StealthModeResult {
  /** Successfully terminated processes */
  terminated: TerminateResult[];
  /** Failed termination attempts */
  failed: TerminateResult[];
  /** Estimated memory freed in MB */
  freed_memory_mb: number;
}
