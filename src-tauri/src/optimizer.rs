use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Serialize, Deserialize)]
pub struct OptimizationResult {
    pub success: bool,
    pub actions_applied: u32,
    pub actions_failed: u32,
    pub message: String,
    pub details: Vec<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OptimizationHistoryEntry {
    pub action_id: String,
    pub game_id: String,
    pub game_name: String,
    pub action_type: String,
    pub setting_key: String,
    pub original_value: serde_json::Value,
    pub new_value: serde_json::Value,
    pub file_path: Option<String>,
    pub applied_at: Option<f64>,
}

const APPLY_OPTIMIZATION_SCRIPT: &str = r#"
import sys
import json
sys.path.insert(0, 'mcp-server/src')
from opta_mcp.optimizer import apply_game_optimization
from opta_mcp.game_settings import get_game_settings, get_generic_optimization_tips
from dataclasses import asdict

game_id = sys.argv[1]
optimization = get_game_settings(game_id)
if not optimization:
    optimization = {
        "name": "Unknown Game",
        "settings": {},
        "tips": get_generic_optimization_tips(),
        "source": "generic"
    }
result = apply_game_optimization(game_id, optimization)
print(json.dumps(asdict(result)))
"#;

const REVERT_OPTIMIZATION_SCRIPT: &str = r#"
import sys
import json
sys.path.insert(0, 'mcp-server/src')
from opta_mcp.optimizer import revert_game_optimization
from dataclasses import asdict

game_id = sys.argv[1]
result = revert_game_optimization(game_id)
print(json.dumps(asdict(result)))
"#;

const GET_HISTORY_SCRIPT: &str = r#"
import sys
import json
sys.path.insert(0, 'mcp-server/src')
from opta_mcp.optimizer import get_optimization_history, get_all_optimized_games

game_id = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1] != "" else None
if game_id:
    history = get_optimization_history(game_id)
else:
    history = get_all_optimized_games()
print(json.dumps(history))
"#;

const RECORD_CHOICE_SCRIPT: &str = r#"
import sys
import json
sys.path.insert(0, 'mcp-server/src')
from opta_mcp.optimizer import record_optimization_choice

args = json.loads(sys.argv[1])
result = record_optimization_choice(
    game_id=args.get('gameId', ''),
    game_name=args.get('gameName', ''),
    setting_category=args.get('settingCategory', ''),
    setting_key=args.get('settingKey', ''),
    original_value=args.get('originalValue'),
    new_value=args.get('newValue'),
    action=args.get('action', 'accepted')
)
print(json.dumps(result))
"#;

const GET_PATTERNS_SCRIPT: &str = r#"
import sys
import json
sys.path.insert(0, 'mcp-server/src')
from opta_mcp.patterns import get_user_patterns

patterns = get_user_patterns()
print(json.dumps(patterns))
"#;

const GET_CHOICE_STATS_SCRIPT: &str = r#"
import sys
import json
sys.path.insert(0, 'mcp-server/src')
from opta_mcp.patterns import get_choice_stats

stats = get_choice_stats()
print(json.dumps(stats))
"#;

#[tauri::command]
pub async fn apply_optimization(game_id: String) -> Result<OptimizationResult, String> {
    let output = Command::new("python3")
        .arg("-c")
        .arg(APPLY_OPTIMIZATION_SCRIPT)
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
pub async fn revert_optimization(game_id: String) -> Result<OptimizationResult, String> {
    let output = Command::new("python3")
        .arg("-c")
        .arg(REVERT_OPTIMIZATION_SCRIPT)
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
pub async fn get_optimization_history(game_id: Option<String>) -> Result<Vec<serde_json::Value>, String> {
    let output = Command::new("python3")
        .arg("-c")
        .arg(GET_HISTORY_SCRIPT)
        .arg(game_id.unwrap_or_default())
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

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordChoiceArgs {
    pub game_id: String,
    pub game_name: String,
    pub setting_category: String,
    pub setting_key: Option<String>,
    pub original_value: Option<serde_json::Value>,
    pub new_value: Option<serde_json::Value>,
    pub action: String,
}

#[tauri::command]
pub async fn record_optimization_choice(args: RecordChoiceArgs) -> Result<serde_json::Value, String> {
    let args_json = serde_json::to_string(&args)
        .map_err(|e| format!("Failed to serialize args: {}", e))?;

    let output = Command::new("python3")
        .arg("-c")
        .arg(RECORD_CHOICE_SCRIPT)
        .arg(&args_json)
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
pub async fn get_user_patterns() -> Result<Vec<serde_json::Value>, String> {
    let output = Command::new("python3")
        .arg("-c")
        .arg(GET_PATTERNS_SCRIPT)
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
pub async fn get_choice_stats() -> Result<serde_json::Value, String> {
    let output = Command::new("python3")
        .arg("-c")
        .arg(GET_CHOICE_STATS_SCRIPT)
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
