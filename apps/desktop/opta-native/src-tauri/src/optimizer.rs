use serde::{Deserialize, Serialize};
use std::time::Duration;
use tokio::process::Command;
use tokio::time::timeout;

/// Default timeout for Python subprocess calls (30 seconds).
const SUBPROCESS_TIMEOUT: Duration = Duration::from_secs(30);

/// Run a Python command with timeout protection.
async fn run_python_with_timeout(
    script: &str,
    args: &[&str],
) -> Result<String, String> {
    let python_cmd = if cfg!(target_os = "windows") {
        "python"
    } else {
        "python3"
    };

    let cwd = std::env::current_dir().map_err(|e| e.to_string())?;

    let mut cmd = Command::new(python_cmd);
    cmd.current_dir(&cwd).arg("-c").arg(script);
    for arg in args {
        cmd.arg(arg);
    }

    let output_future = cmd.output();

    match timeout(SUBPROCESS_TIMEOUT, output_future).await {
        Ok(Ok(output)) => {
            if !output.status.success() {
                let stderr = String::from_utf8_lossy(&output.stderr);
                return Err(format!("Python script failed: {}", stderr));
            }
            Ok(String::from_utf8_lossy(&output.stdout).to_string())
        }
        Ok(Err(e)) => Err(format!("Failed to execute Python: {}", e)),
        Err(_) => Err(format!(
            "Python subprocess timed out after {} seconds",
            SUBPROCESS_TIMEOUT.as_secs()
        )),
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OptimizationResult {
    pub success: bool,
    pub actions_applied: u32,
    pub actions_failed: u32,
    pub message: String,
    pub details: Vec<serde_json::Value>,
}

#[allow(dead_code)]
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
try:
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
except ImportError:
    print(json.dumps({"success": False, "actions_applied": 0, "actions_failed": 0, "message": "Optimization module not available", "details": []}))
except Exception as e:
    print(json.dumps({"success": False, "actions_applied": 0, "actions_failed": 0, "message": str(e), "details": []}))
"#;

const REVERT_OPTIMIZATION_SCRIPT: &str = r#"
import sys
import json
sys.path.insert(0, 'mcp-server/src')
try:
    from opta_mcp.optimizer import revert_game_optimization
    from dataclasses import asdict
    game_id = sys.argv[1]
    result = revert_game_optimization(game_id)
    print(json.dumps(asdict(result)))
except ImportError:
    print(json.dumps({"success": False, "actions_applied": 0, "actions_failed": 0, "message": "Optimization module not available", "details": []}))
except Exception as e:
    print(json.dumps({"success": False, "actions_applied": 0, "actions_failed": 0, "message": str(e), "details": []}))
"#;

const GET_HISTORY_SCRIPT: &str = r#"
import sys
import json
sys.path.insert(0, 'mcp-server/src')
try:
    from opta_mcp.optimizer import get_optimization_history, get_all_optimized_games
    game_id = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1] != "" else None
    if game_id:
        history = get_optimization_history(game_id)
    else:
        history = get_all_optimized_games()
    print(json.dumps(history))
except ImportError:
    print(json.dumps([]))
except Exception as e:
    print(json.dumps([]))
"#;

const RECORD_CHOICE_SCRIPT: &str = r#"
import sys
import json
sys.path.insert(0, 'mcp-server/src')
try:
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
except ImportError:
    print(json.dumps({"success": False}))
except Exception as e:
    print(json.dumps({"success": False, "error": str(e)}))
"#;

const GET_PATTERNS_SCRIPT: &str = r#"
import sys
import json
sys.path.insert(0, 'mcp-server/src')
try:
    from opta_mcp.patterns import get_user_patterns
    patterns = get_user_patterns()
    print(json.dumps(patterns))
except ImportError:
    print(json.dumps({}))
except Exception as e:
    print(json.dumps({}))
"#;

const GET_CHOICE_STATS_SCRIPT: &str = r#"
import sys
import json
sys.path.insert(0, 'mcp-server/src')
try:
    from opta_mcp.patterns import get_choice_stats
    stats = get_choice_stats()
    print(json.dumps(stats))
except ImportError:
    print(json.dumps({}))
except Exception as e:
    print(json.dumps({}))
"#;

const GET_RECOMMENDATIONS_SCRIPT: &str = r#"
import sys
import json
sys.path.insert(0, 'mcp-server/src')
try:
    from opta_mcp.patterns import get_recommendations_for_game
    args = json.loads(sys.argv[1])
    result = get_recommendations_for_game(args['gameId'], args['gameName'])
    print(json.dumps(result))
except ImportError:
    print(json.dumps({"recommendations": [], "patterns": {}}))
except Exception as e:
    print(json.dumps({"recommendations": [], "patterns": {}}))
"#;

#[tauri::command]
pub async fn apply_optimization(game_id: String) -> Result<OptimizationResult, String> {
    let stdout = run_python_with_timeout(APPLY_OPTIMIZATION_SCRIPT, &[&game_id]).await?;

    serde_json::from_str(&stdout)
        .map_err(|e| format!("Failed to parse result: {} - Output: {}", e, stdout))
}

#[tauri::command]
pub async fn revert_optimization(game_id: String) -> Result<OptimizationResult, String> {
    let stdout = run_python_with_timeout(REVERT_OPTIMIZATION_SCRIPT, &[&game_id]).await?;

    serde_json::from_str(&stdout)
        .map_err(|e| format!("Failed to parse result: {} - Output: {}", e, stdout))
}

#[tauri::command]
pub async fn get_optimization_history(game_id: Option<String>) -> Result<Vec<serde_json::Value>, String> {
    let game_id_str = game_id.unwrap_or_default();
    let stdout = run_python_with_timeout(GET_HISTORY_SCRIPT, &[&game_id_str]).await?;

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

    let stdout = run_python_with_timeout(RECORD_CHOICE_SCRIPT, &[&args_json]).await?;

    serde_json::from_str(&stdout)
        .map_err(|e| format!("Failed to parse result: {} - Output: {}", e, stdout))
}

#[tauri::command]
pub async fn get_user_patterns() -> Result<Vec<serde_json::Value>, String> {
    let stdout = run_python_with_timeout(GET_PATTERNS_SCRIPT, &[]).await?;

    serde_json::from_str(&stdout)
        .map_err(|e| format!("Failed to parse result: {} - Output: {}", e, stdout))
}

#[tauri::command]
pub async fn get_choice_stats() -> Result<serde_json::Value, String> {
    let stdout = run_python_with_timeout(GET_CHOICE_STATS_SCRIPT, &[]).await?;

    serde_json::from_str(&stdout)
        .map_err(|e| format!("Failed to parse result: {} - Output: {}", e, stdout))
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetRecommendationsArgs {
    pub game_id: String,
    pub game_name: String,
}

#[tauri::command]
pub async fn get_recommendations(args: GetRecommendationsArgs) -> Result<serde_json::Value, String> {
    let args_json = serde_json::to_string(&args)
        .map_err(|e| format!("Failed to serialize args: {}", e))?;

    let stdout = run_python_with_timeout(GET_RECOMMENDATIONS_SCRIPT, &[&args_json]).await?;

    serde_json::from_str(&stdout)
        .map_err(|e| format!("Failed to parse result: {} - Output: {}", e, stdout))
}
