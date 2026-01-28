/**
 * Conflict detection types for Opta.
 *
 * These types match the Rust structs in src-tauri/src/conflicts.rs
 * and the Python conflict functions in mcp-server/src/opta_mcp/conflicts.py.
 */

/**
 * Conflict severity level.
 * - "high": Significant conflict, likely to cause issues
 * - "medium": Partial conflict, may cause some issues
 * - "low": Minor conflict, minimal impact
 */
export type ConflictSeverity = "high" | "medium" | "low";

/**
 * Information about a detected competitor tool.
 */
export interface ConflictInfo {
  /** Internal identifier (e.g., "geforce_experience") */
  tool_id: string;
  /** Display name (e.g., "NVIDIA GeForce Experience") */
  name: string;
  /** Brief description of the tool */
  description: string;
  /** Conflict severity level */
  severity: ConflictSeverity;
  /** Actionable recommendation for the user */
  recommendation: string;
  /** List of matching process names found */
  detected_processes: string[];
}

/**
 * Summary of conflict detection results.
 */
export interface ConflictSummary {
  /** Total number of detected conflicts */
  total_count: number;
  /** Number of high severity conflicts */
  high_count: number;
  /** Number of medium severity conflicts */
  medium_count: number;
  /** Number of low severity conflicts */
  low_count: number;
  /** Full list of detected conflicts */
  conflicts: ConflictInfo[];
}
