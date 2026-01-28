use std::process::Command;

const CHECK_BADGES_SCRIPT: &str = r#"
import sys
import json
sys.path.insert(0, 'mcp-server/src')
try:
    from opta_mcp.badges import check_badges
    result = check_badges()
    print(json.dumps(result))
except ImportError:
    # Return empty badges when module not available
    print(json.dumps({"badges": [], "new_badges": []}))
except Exception as e:
    print(json.dumps({"badges": [], "new_badges": [], "error": str(e)}))
"#;

const MARK_BADGE_SEEN_SCRIPT: &str = r#"
import sys
import json
sys.path.insert(0, 'mcp-server/src')
try:
    from opta_mcp.badges import mark_badge_seen
    badge_id = sys.argv[1]
    result = mark_badge_seen(badge_id)
    print(json.dumps(result))
except ImportError:
    print(json.dumps({"success": False}))
except Exception as e:
    print(json.dumps({"success": False, "error": str(e)}))
"#;

#[tauri::command]
pub async fn check_badges() -> Result<serde_json::Value, String> {
    let output = Command::new("python3")
        .arg("-c")
        .arg(CHECK_BADGES_SCRIPT)
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
pub async fn mark_badge_seen(badge_id: String) -> Result<serde_json::Value, String> {
    let output = Command::new("python3")
        .arg("-c")
        .arg(MARK_BADGE_SEEN_SCRIPT)
        .arg(&badge_id)
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
