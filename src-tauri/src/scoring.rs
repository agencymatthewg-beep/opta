use serde::{Deserialize, Serialize};
use std::process::Command;

#[allow(dead_code)]
#[derive(Debug, Serialize, Deserialize)]
pub struct ScoreBreakdown {
    pub total: u32,
    pub performance_score: f64,
    pub depth_score: f64,
    pub stability_score: f64,
    pub base_score: u32,
    pub cpu_contribution: f64,
    pub memory_contribution: f64,
    pub gpu_temp_contribution: f64,
    pub actions_count: u32,
    pub action_types_used: Vec<String>,
    pub diversity_bonus: f64,
    pub actions_applied: u32,
    pub actions_failed: u32,
    pub success_rate: f64,
}

#[allow(dead_code)]
#[derive(Debug, Serialize, Deserialize)]
pub struct GameScore {
    pub game_id: String,
    pub game_name: String,
    pub score: u32,
    pub breakdown: ScoreBreakdown,
    pub calculated_at: f64,
    pub optimization_timestamp: Option<f64>,
    pub benchmark_timestamp: Option<f64>,
}

#[allow(dead_code)]
#[derive(Debug, Serialize, Deserialize)]
pub struct GlobalStats {
    pub total_games_optimized: u32,
    pub average_score: f64,
    pub highest_score: u32,
    pub highest_score_game: String,
    pub last_updated: f64,
}

const CALCULATE_SCORE_SCRIPT: &str = r#"
import sys
import json
sys.path.insert(0, 'mcp-server/src')
from opta_mcp.scoring import calculate_score

game_id = sys.argv[1]
game_name = sys.argv[2] if len(sys.argv) > 2 else "Unknown"
result = calculate_score(game_id, game_name)
print(json.dumps(result if result else {"error": "No optimization history found"}))
"#;

const GET_SCORE_SCRIPT: &str = r#"
import sys
import json
sys.path.insert(0, 'mcp-server/src')
from opta_mcp.scoring import get_score

game_id = sys.argv[1]
result = get_score(game_id)
print(json.dumps(result if result else {"error": "No score found"}))
"#;

const GET_LEADERBOARD_SCRIPT: &str = r#"
import sys
import json
sys.path.insert(0, 'mcp-server/src')
from opta_mcp.scoring import get_all_scores

result = get_all_scores()
print(json.dumps(result))
"#;

const GET_SCORE_HISTORY_SCRIPT: &str = r#"
import sys
import json
sys.path.insert(0, 'mcp-server/src')
from opta_mcp.scoring import get_score_history

game_id = sys.argv[1]
result = get_score_history(game_id)
print(json.dumps(result))
"#;

const GET_GLOBAL_STATS_SCRIPT: &str = r#"
import sys
import json
sys.path.insert(0, 'mcp-server/src')
from opta_mcp.scoring import get_global_stats

result = get_global_stats()
print(json.dumps(result))
"#;

#[tauri::command]
pub async fn calculate_score(game_id: String, game_name: Option<String>) -> Result<serde_json::Value, String> {
    let output = Command::new("python3")
        .arg("-c")
        .arg(CALCULATE_SCORE_SCRIPT)
        .arg(&game_id)
        .arg(game_name.unwrap_or_else(|| "Unknown".to_string()))
        .current_dir(std::env::current_dir().map_err(|e| e.to_string())?)
        .output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Python script failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    serde_json::from_str(&stdout)
        .map_err(|e| format!("Failed to parse result: {} - Output: {}", e, stdout))
}

#[tauri::command]
pub async fn get_score(game_id: String) -> Result<serde_json::Value, String> {
    let output = Command::new("python3")
        .arg("-c")
        .arg(GET_SCORE_SCRIPT)
        .arg(&game_id)
        .current_dir(std::env::current_dir().map_err(|e| e.to_string())?)
        .output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Python script failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    serde_json::from_str(&stdout)
        .map_err(|e| format!("Failed to parse result: {} - Output: {}", e, stdout))
}

#[tauri::command]
pub async fn get_leaderboard() -> Result<Vec<serde_json::Value>, String> {
    let output = Command::new("python3")
        .arg("-c")
        .arg(GET_LEADERBOARD_SCRIPT)
        .current_dir(std::env::current_dir().map_err(|e| e.to_string())?)
        .output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Python script failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    serde_json::from_str(&stdout)
        .map_err(|e| format!("Failed to parse result: {} - Output: {}", e, stdout))
}

#[tauri::command]
pub async fn get_score_history(game_id: String) -> Result<Vec<serde_json::Value>, String> {
    let output = Command::new("python3")
        .arg("-c")
        .arg(GET_SCORE_HISTORY_SCRIPT)
        .arg(&game_id)
        .current_dir(std::env::current_dir().map_err(|e| e.to_string())?)
        .output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Python script failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    serde_json::from_str(&stdout)
        .map_err(|e| format!("Failed to parse result: {} - Output: {}", e, stdout))
}

#[tauri::command]
pub async fn get_global_stats() -> Result<serde_json::Value, String> {
    let output = Command::new("python3")
        .arg("-c")
        .arg(GET_GLOBAL_STATS_SCRIPT)
        .current_dir(std::env::current_dir().map_err(|e| e.to_string())?)
        .output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Python script failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    serde_json::from_str(&stdout)
        .map_err(|e| format!("Failed to parse result: {} - Output: {}", e, stdout))
}

// ============================================
// V2 ENHANCED SCORING COMMANDS
// ============================================

const CALCULATE_ENHANCED_SCORE_SCRIPT: &str = r#"
import sys
import json
sys.path.insert(0, 'mcp-server/src')
from opta_mcp.scoring import calculate_enhanced_score

game_id = sys.argv[1]
game_name = sys.argv[2] if len(sys.argv) > 2 else "Unknown"
result = calculate_enhanced_score(game_id, game_name)
print(json.dumps(result if result else {"error": "No optimization history found"}))
"#;

const CALCULATE_OPTA_SCORE_SCRIPT: &str = r#"
import sys
import json
sys.path.insert(0, 'mcp-server/src')
from opta_mcp.scoring import calculate_opta_score

result = calculate_opta_score()
print(json.dumps(result if result else {"error": "No optimized games found"}))
"#;

const GET_HARDWARE_TIER_SCRIPT: &str = r#"
import sys
import json
sys.path.insert(0, 'mcp-server/src')
from opta_mcp.scoring import get_hardware_tier

result = get_hardware_tier()
print(json.dumps(result))
"#;

#[tauri::command]
pub async fn calculate_enhanced_score(game_id: String, game_name: Option<String>) -> Result<serde_json::Value, String> {
    let output = Command::new("python3")
        .arg("-c")
        .arg(CALCULATE_ENHANCED_SCORE_SCRIPT)
        .arg(&game_id)
        .arg(game_name.unwrap_or_else(|| "Unknown".to_string()))
        .current_dir(std::env::current_dir().map_err(|e| e.to_string())?)
        .output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Python script failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    serde_json::from_str(&stdout)
        .map_err(|e| format!("Failed to parse result: {} - Output: {}", e, stdout))
}

#[tauri::command]
pub async fn calculate_opta_score() -> Result<serde_json::Value, String> {
    let output = Command::new("python3")
        .arg("-c")
        .arg(CALCULATE_OPTA_SCORE_SCRIPT)
        .current_dir(std::env::current_dir().map_err(|e| e.to_string())?)
        .output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Python script failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    serde_json::from_str(&stdout)
        .map_err(|e| format!("Failed to parse result: {} - Output: {}", e, stdout))
}

#[tauri::command]
pub async fn get_hardware_tier() -> Result<serde_json::Value, String> {
    let output = Command::new("python3")
        .arg("-c")
        .arg(GET_HARDWARE_TIER_SCRIPT)
        .current_dir(std::env::current_dir().map_err(|e| e.to_string())?)
        .output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Python script failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    serde_json::from_str(&stdout)
        .map_err(|e| format!("Failed to parse result: {} - Output: {}", e, stdout))
}
