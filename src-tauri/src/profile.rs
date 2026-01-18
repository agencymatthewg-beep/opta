use serde::{Deserialize, Serialize};
use std::process::Command;

/// Hardware signature for system fingerprinting.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HardwareSignature {
    pub cpu: String,
    pub gpu: Option<String>,
    pub ram_gb: f64,
    pub platform: String,
}

/// Learned optimization pattern from user behavior.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OptimizationPattern {
    pub pattern_type: String,
    pub setting_category: String,
    pub setting_key: String,
    pub confidence: f64,
    pub sample_count: u32,
    pub description: String,
    pub last_updated: f64,
}

/// User profile with preferences, hardware, and learned patterns.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserProfile {
    pub id: String,
    pub created_at: f64,
    pub updated_at: f64,
    pub user_mode: String,
    pub optimization_depth: String,
    pub communication_style: String,
    pub hardware_signature: HardwareSignature,
    pub patterns: Vec<OptimizationPattern>,
    pub total_optimizations: u32,
    pub total_games_optimized: u32,
    pub optimizations_accepted: u32,
    pub optimizations_reverted: u32,
}

/// Profile update payload.
#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileUpdate {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user_mode: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub optimization_depth: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub communication_style: Option<String>,
}

const LOAD_PROFILE_SCRIPT: &str = r#"
import sys
import json
sys.path.insert(0, 'mcp-server/src')
from opta_mcp.profile import get_or_create_profile

profile = get_or_create_profile()
print(json.dumps(profile))
"#;

const UPDATE_PROFILE_SCRIPT: &str = r#"
import sys
import json
sys.path.insert(0, 'mcp-server/src')
from opta_mcp.profile import update_profile

updates = json.loads(sys.argv[1])
profile = update_profile(updates)
print(json.dumps(profile))
"#;

const DELETE_PROFILE_SCRIPT: &str = r#"
import sys
import json
sys.path.insert(0, 'mcp-server/src')
from opta_mcp.profile import delete_profile

deleted = delete_profile()
print(json.dumps({"deleted": deleted}))
"#;

/// Load user profile, creating default if none exists.
#[tauri::command]
pub async fn load_user_profile() -> Result<UserProfile, String> {
    let output = Command::new("python3")
        .arg("-c")
        .arg(LOAD_PROFILE_SCRIPT)
        .current_dir(std::env::current_dir().map_err(|e| e.to_string())?)
        .output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Python script failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    serde_json::from_str(&stdout)
        .map_err(|e| format!("Failed to parse profile: {} - Output: {}", e, stdout))
}

/// Update user profile preferences.
#[tauri::command]
pub async fn update_user_profile(updates: serde_json::Value) -> Result<UserProfile, String> {
    let updates_json = serde_json::to_string(&updates)
        .map_err(|e| format!("Failed to serialize updates: {}", e))?;

    let output = Command::new("python3")
        .arg("-c")
        .arg(UPDATE_PROFILE_SCRIPT)
        .arg(&updates_json)
        .current_dir(std::env::current_dir().map_err(|e| e.to_string())?)
        .output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Python script failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    serde_json::from_str(&stdout)
        .map_err(|e| format!("Failed to parse profile: {} - Output: {}", e, stdout))
}

/// Delete user profile and all associated data.
#[tauri::command]
pub async fn delete_user_profile() -> Result<bool, String> {
    let output = Command::new("python3")
        .arg("-c")
        .arg(DELETE_PROFILE_SCRIPT)
        .current_dir(std::env::current_dir().map_err(|e| e.to_string())?)
        .output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Python script failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let result: serde_json::Value = serde_json::from_str(&stdout)
        .map_err(|e| format!("Failed to parse result: {} - Output: {}", e, stdout))?;

    Ok(result.get("deleted").and_then(|v| v.as_bool()).unwrap_or(false))
}
