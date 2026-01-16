//! Game detection module for Opta.
//!
//! This module provides Tauri commands to detect installed games across
//! major game launchers (Steam, Epic Games, GOG). Follows the same pattern
//! as conflicts.rs by invoking the Python MCP server.

use serde::{Deserialize, Serialize};
use std::process::Command;
use tauri::command;

/// Information about a detected game.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectedGame {
    /// Unique game identifier (e.g., "steam_730", "epic_Fortnite")
    pub id: String,
    /// Display name of the game
    pub name: String,
    /// Launcher that owns the game ("steam", "epic", "gog")
    pub launcher: String,
    /// Installation path on disk
    pub install_path: String,
    /// Size in bytes (if available)
    pub size_bytes: Option<u64>,
}

/// Information about a detected launcher.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LauncherInfo {
    /// Launcher identifier ("steam", "epic", "gog")
    pub id: String,
    /// Display name (e.g., "Steam", "Epic Games")
    pub name: String,
    /// Whether the launcher is installed
    pub installed: bool,
    /// Number of games detected from this launcher
    pub game_count: u32,
}

/// Result of game detection across all launchers.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameDetectionResult {
    /// Total number of games found
    pub total_games: u32,
    /// Information about each launcher
    pub launchers: Vec<LauncherInfo>,
    /// List of all detected games
    pub games: Vec<DetectedGame>,
}

/// Result of looking up a specific game.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameInfoResult {
    /// Whether the game was found
    pub found: bool,
    /// Game details (if found)
    pub game: Option<DetectedGame>,
    /// Error message (if not found)
    pub error: Option<String>,
}

/// Game optimization settings from community database or AI.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameOptimization {
    /// Game name
    pub name: String,
    /// Recommended settings (graphics, launch options, etc.)
    pub settings: serde_json::Value,
    /// Optimization tips
    pub tips: Vec<String>,
    /// Source of recommendations ("database" or "ai" or "generic")
    pub source: String,
    /// Confidence level ("high", "medium", "low")
    #[serde(default)]
    pub confidence: Option<String>,
}

/// Python script to detect all games.
///
/// This inline script invokes the games module from the installed
/// opta_mcp package and returns the detection result as JSON.
const DETECT_GAMES_SCRIPT: &str = r#"
import json
import sys

try:
    from opta_mcp.games import detect_all_games
    result = detect_all_games()
    print(json.dumps(result))
except Exception as e:
    # Return error-safe default response
    print(json.dumps({
        "total_games": 0,
        "launchers": [],
        "games": [],
        "error": str(e)
    }))
    sys.exit(0)
"#;

/// Python script to get info for a specific game.
const GET_GAME_INFO_SCRIPT: &str = r#"
import json
import sys

game_id = sys.argv[1] if len(sys.argv) > 1 else ""

try:
    from opta_mcp.games import get_game_info
    result = get_game_info(game_id)
    print(json.dumps(result))
except Exception as e:
    # Return error-safe default response
    print(json.dumps({
        "found": False,
        "game": null,
        "error": str(e)
    }))
    sys.exit(0)
"#;

/// Python script to get optimization settings for a game.
const GET_GAME_OPTIMIZATION_SCRIPT: &str = r#"
import json
import sys

game_id = sys.argv[1] if len(sys.argv) > 1 else ""

try:
    from opta_mcp.game_settings import get_game_settings, get_generic_optimization_tips
    result = get_game_settings(game_id)
    if result is None:
        # Return generic tips for unknown games
        result = {
            "name": "Unknown Game",
            "settings": {},
            "tips": get_generic_optimization_tips(),
            "source": "generic",
            "confidence": "low"
        }
    print(json.dumps(result))
except Exception as e:
    print(json.dumps({
        "name": "Error",
        "settings": {},
        "tips": [],
        "source": "error",
        "confidence": None,
        "error": str(e)
    }))
    sys.exit(0)
"#;

/// Detect all installed games across all supported launchers.
///
/// This command spawns Python to run the game detection function from opta_mcp.
/// Returns a summary with detected games and launcher information.
///
/// # Returns
///
/// A `GameDetectionResult` containing detected games and launcher info.
///
/// # Errors
///
/// Returns an error string if Python execution fails or JSON parsing fails.
#[command]
pub async fn detect_games() -> Result<GameDetectionResult, String> {
    // Try python3 first, fall back to python
    let python_cmd = if cfg!(target_os = "windows") {
        "python"
    } else {
        "python3"
    };

    let output = Command::new(python_cmd)
        .arg("-c")
        .arg(DETECT_GAMES_SCRIPT)
        .output()
        .map_err(|e| format!("Failed to spawn Python: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Python error: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);

    // Check if the response contains an error field
    if stdout.contains("\"error\"") {
        let error: serde_json::Value = serde_json::from_str(&stdout)
            .map_err(|e| format!("JSON parse error: {}", e))?;
        if let Some(err_msg) = error.get("error").and_then(|v| v.as_str()) {
            // Log the error but still return the partial result if possible
            eprintln!("Python game detection warning: {}", err_msg);
        }
    }

    let result: GameDetectionResult = serde_json::from_str(&stdout)
        .map_err(|e| format!("JSON parse error: {} (raw: {})", e, stdout))?;

    Ok(result)
}

/// Get detailed information for a specific game by ID.
///
/// # Arguments
///
/// * `game_id` - Game identifier (e.g., "steam_730", "epic_Fortnite")
///
/// # Returns
///
/// A `GameInfoResult` containing the game details if found.
///
/// # Errors
///
/// Returns an error string if Python execution fails or JSON parsing fails.
#[command]
pub async fn get_game_info(game_id: String) -> Result<GameInfoResult, String> {
    // Try python3 first, fall back to python
    let python_cmd = if cfg!(target_os = "windows") {
        "python"
    } else {
        "python3"
    };

    let output = Command::new(python_cmd)
        .arg("-c")
        .arg(GET_GAME_INFO_SCRIPT)
        .arg(&game_id)
        .output()
        .map_err(|e| format!("Failed to spawn Python: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Python error: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);

    let result: GameInfoResult = serde_json::from_str(&stdout)
        .map_err(|e| format!("JSON parse error: {} (raw: {})", e, stdout))?;

    Ok(result)
}

/// Get optimization settings for a specific game.
///
/// Retrieves community-verified optimization settings from the database,
/// or generic tips for unknown games.
///
/// # Arguments
///
/// * `game_id` - Game identifier (Steam app ID like "730" or prefixed like "steam_730")
///
/// # Returns
///
/// A `GameOptimization` containing settings and tips.
///
/// # Errors
///
/// Returns an error string if Python execution fails or JSON parsing fails.
#[command]
pub async fn get_game_optimization(game_id: String) -> Result<GameOptimization, String> {
    // Try python3 first, fall back to python
    let python_cmd = if cfg!(target_os = "windows") {
        "python"
    } else {
        "python3"
    };

    let output = Command::new(python_cmd)
        .arg("-c")
        .arg(GET_GAME_OPTIMIZATION_SCRIPT)
        .arg(&game_id)
        .output()
        .map_err(|e| format!("Failed to spawn Python: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Python error: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);

    let result: GameOptimization = serde_json::from_str(&stdout)
        .map_err(|e| format!("JSON parse error: {} (raw: {})", e, stdout))?;

    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detected_game_serialize() {
        let game = DetectedGame {
            id: "steam_730".to_string(),
            name: "Counter-Strike 2".to_string(),
            launcher: "steam".to_string(),
            install_path: "/path/to/game".to_string(),
            size_bytes: Some(25000000000),
        };

        let json = serde_json::to_string(&game).unwrap();
        assert!(json.contains("steam_730"));
        assert!(json.contains("Counter-Strike 2"));
        assert!(json.contains("steam"));
    }

    #[test]
    fn test_launcher_info_serialize() {
        let info = LauncherInfo {
            id: "steam".to_string(),
            name: "Steam".to_string(),
            installed: true,
            game_count: 42,
        };

        let json = serde_json::to_string(&info).unwrap();
        assert!(json.contains("steam"));
        assert!(json.contains("Steam"));
        assert!(json.contains("42"));
    }

    #[test]
    fn test_game_detection_result_deserialize() {
        let json = r#"{
            "total_games": 2,
            "launchers": [
                {
                    "id": "steam",
                    "name": "Steam",
                    "installed": true,
                    "game_count": 2
                }
            ],
            "games": [
                {
                    "id": "steam_730",
                    "name": "Counter-Strike 2",
                    "launcher": "steam",
                    "install_path": "/path/to/cs2",
                    "size_bytes": 25000000000
                },
                {
                    "id": "steam_570",
                    "name": "Dota 2",
                    "launcher": "steam",
                    "install_path": "/path/to/dota2",
                    "size_bytes": null
                }
            ]
        }"#;

        let result: GameDetectionResult = serde_json::from_str(json).unwrap();
        assert_eq!(result.total_games, 2);
        assert_eq!(result.launchers.len(), 1);
        assert_eq!(result.games.len(), 2);
        assert_eq!(result.games[0].id, "steam_730");
        assert!(result.games[0].size_bytes.is_some());
        assert!(result.games[1].size_bytes.is_none());
    }

    #[test]
    fn test_empty_result_deserialize() {
        let json = r#"{
            "total_games": 0,
            "launchers": [],
            "games": []
        }"#;

        let result: GameDetectionResult = serde_json::from_str(json).unwrap();
        assert_eq!(result.total_games, 0);
        assert!(result.launchers.is_empty());
        assert!(result.games.is_empty());
    }

    #[test]
    fn test_game_info_result_found() {
        let json = r#"{
            "found": true,
            "game": {
                "id": "steam_730",
                "name": "Counter-Strike 2",
                "launcher": "steam",
                "install_path": "/path/to/cs2",
                "size_bytes": 25000000000
            }
        }"#;

        let result: GameInfoResult = serde_json::from_str(json).unwrap();
        assert!(result.found);
        assert!(result.game.is_some());
        assert_eq!(result.game.unwrap().name, "Counter-Strike 2");
    }

    #[test]
    fn test_game_info_result_not_found() {
        let json = r#"{
            "found": false,
            "error": "Game not found: steam_999"
        }"#;

        let result: GameInfoResult = serde_json::from_str(json).unwrap();
        assert!(!result.found);
        assert!(result.game.is_none());
        assert!(result.error.is_some());
    }
}
