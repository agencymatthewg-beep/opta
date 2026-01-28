/**
 * Game detection types for Opta.
 *
 * These types match the Rust structs in src-tauri/src/games.rs
 * and the Python game functions in mcp-server/src/opta_mcp/games.py.
 */

/**
 * Information about a detected game.
 */
export interface DetectedGame {
  /** Unique game identifier (e.g., "steam_730", "epic_Fortnite") */
  id: string;
  /** Display name of the game */
  name: string;
  /** Launcher that owns the game ("steam", "epic", "gog") */
  launcher: string;
  /** Installation path on disk */
  install_path: string;
  /** Size in bytes (if available) */
  size_bytes: number | null;
}

/**
 * Information about a detected launcher.
 */
export interface LauncherInfo {
  /** Launcher identifier ("steam", "epic", "gog") */
  id: string;
  /** Display name (e.g., "Steam", "Epic Games") */
  name: string;
  /** Whether the launcher is installed */
  installed: boolean;
  /** Number of games detected from this launcher */
  game_count: number;
}

/**
 * Result of game detection across all launchers.
 */
export interface GameDetectionResult {
  /** Total number of games found */
  total_games: number;
  /** Information about each launcher */
  launchers: LauncherInfo[];
  /** List of all detected games */
  games: DetectedGame[];
}

/**
 * Result of looking up a specific game.
 */
export interface GameInfoResult {
  /** Whether the game was found */
  found: boolean;
  /** Game details (if found) */
  game?: DetectedGame;
  /** Error message (if not found) */
  error?: string;
}

/**
 * Game optimization settings from community database or AI.
 */
export interface GameOptimization {
  /** Game name */
  name: string;
  /** Recommended settings (graphics, launch options, etc.) */
  settings: Record<string, unknown>;
  /** Optimization tips */
  tips: string[];
  /** Source of recommendations ("database" or "ai" or "generic") */
  source: 'database' | 'ai' | 'generic';
  /** Confidence level ("high", "medium", "low") */
  confidence?: 'high' | 'medium' | 'low';
}
