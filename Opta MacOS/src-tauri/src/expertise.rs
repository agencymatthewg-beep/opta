use serde::{Deserialize, Serialize};
use std::process::Command;

/// Behavioral signals for expertise detection.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExpertiseSignals {
    pub uses_technical_features: i32,
    pub reads_documentation: i32,
    pub uses_shortcuts: i32,
    pub expands_technical_details: i32,
    pub uses_investigation_mode: i32,
    pub time_in_app: i32,
    pub sessions_count: i32,
    pub optimizations_applied: i32,
}

/// Record of an expertise level change.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExpertiseLevelChange {
    pub timestamp: i64,
    pub from: String,
    pub to: String,
    pub reason: String,
}

/// User expertise profile.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExpertiseProfile {
    pub current_level: String,
    pub confidence: i32,
    pub signals: ExpertiseSignals,
    pub history: Vec<ExpertiseLevelChange>,
    pub manual_override: Option<String>,
}

const DEFAULT_EXPERTISE_PROFILE: &str = r#"{"currentLevel": "intermediate", "confidence": 50, "signals": {"usesTechnicalFeatures": 0, "readsDocumentation": 0, "usesShortcuts": 0, "expandsTechnicalDetails": 0, "usesInvestigationMode": 0, "timeInApp": 0, "sessionsCount": 0, "optimizationsApplied": 0}, "history": [], "manualOverride": null}"#;

const GET_EXPERTISE_PROFILE_SCRIPT: &str = r#"
import sys
import json
sys.path.insert(0, 'mcp-server/src')
try:
    from opta_mcp.expertise import get_expertise_profile
    profile = get_expertise_profile()
    print(json.dumps(profile))
except ImportError:
    print('{"currentLevel": "intermediate", "confidence": 50, "signals": {"usesTechnicalFeatures": 0, "readsDocumentation": 0, "usesShortcuts": 0, "expandsTechnicalDetails": 0, "usesInvestigationMode": 0, "timeInApp": 0, "sessionsCount": 0, "optimizationsApplied": 0}, "history": [], "manualOverride": null}')
except Exception as e:
    print('{"currentLevel": "intermediate", "confidence": 50, "signals": {"usesTechnicalFeatures": 0, "readsDocumentation": 0, "usesShortcuts": 0, "expandsTechnicalDetails": 0, "usesInvestigationMode": 0, "timeInApp": 0, "sessionsCount": 0, "optimizationsApplied": 0}, "history": [], "manualOverride": null}')
"#;

const RECORD_SIGNAL_SCRIPT: &str = r#"
import sys
import json
sys.path.insert(0, 'mcp-server/src')
try:
    from opta_mcp.expertise import record_signal
    signal_name = sys.argv[1]
    value = int(sys.argv[2])
    profile = record_signal(signal_name, value)
    print(json.dumps(profile))
except ImportError:
    print('{"currentLevel": "intermediate", "confidence": 50, "signals": {"usesTechnicalFeatures": 0, "readsDocumentation": 0, "usesShortcuts": 0, "expandsTechnicalDetails": 0, "usesInvestigationMode": 0, "timeInApp": 0, "sessionsCount": 0, "optimizationsApplied": 0}, "history": [], "manualOverride": null}')
except Exception as e:
    print('{"currentLevel": "intermediate", "confidence": 50, "signals": {"usesTechnicalFeatures": 0, "readsDocumentation": 0, "usesShortcuts": 0, "expandsTechnicalDetails": 0, "usesInvestigationMode": 0, "timeInApp": 0, "sessionsCount": 0, "optimizationsApplied": 0}, "history": [], "manualOverride": null}')
"#;

const SET_OVERRIDE_SCRIPT: &str = r#"
import sys
import json
sys.path.insert(0, 'mcp-server/src')
try:
    from opta_mcp.expertise import set_manual_override
    level = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1] != 'null' else None
    profile = set_manual_override(level)
    print(json.dumps(profile))
except ImportError:
    print('{"currentLevel": "intermediate", "confidence": 50, "signals": {"usesTechnicalFeatures": 0, "readsDocumentation": 0, "usesShortcuts": 0, "expandsTechnicalDetails": 0, "usesInvestigationMode": 0, "timeInApp": 0, "sessionsCount": 0, "optimizationsApplied": 0}, "history": [], "manualOverride": null}')
except Exception as e:
    print('{"currentLevel": "intermediate", "confidence": 50, "signals": {"usesTechnicalFeatures": 0, "readsDocumentation": 0, "usesShortcuts": 0, "expandsTechnicalDetails": 0, "usesInvestigationMode": 0, "timeInApp": 0, "sessionsCount": 0, "optimizationsApplied": 0}, "history": [], "manualOverride": null}')
"#;

/// Get current expertise profile.
#[tauri::command]
pub async fn get_expertise_profile() -> Result<ExpertiseProfile, String> {
    let output = Command::new("python3")
        .arg("-c")
        .arg(GET_EXPERTISE_PROFILE_SCRIPT)
        .current_dir(std::env::current_dir().map_err(|e| e.to_string())?)
        .output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Python script failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    serde_json::from_str(&stdout)
        .map_err(|e| format!("Failed to parse expertise profile: {} - Output: {}", e, stdout))
}

/// Record a behavioral signal for expertise detection.
#[tauri::command]
pub async fn record_expertise_signal(signal_name: String, value: i32) -> Result<ExpertiseProfile, String> {
    let output = Command::new("python3")
        .arg("-c")
        .arg(RECORD_SIGNAL_SCRIPT)
        .arg(&signal_name)
        .arg(value.to_string())
        .current_dir(std::env::current_dir().map_err(|e| e.to_string())?)
        .output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Python script failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    serde_json::from_str(&stdout)
        .map_err(|e| format!("Failed to parse expertise profile: {} - Output: {}", e, stdout))
}

/// Set or clear manual expertise level override.
#[tauri::command]
pub async fn set_expertise_override(level: Option<String>) -> Result<ExpertiseProfile, String> {
    let level_arg = level.unwrap_or_else(|| "null".to_string());

    let output = Command::new("python3")
        .arg("-c")
        .arg(SET_OVERRIDE_SCRIPT)
        .arg(&level_arg)
        .current_dir(std::env::current_dir().map_err(|e| e.to_string())?)
        .output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Python script failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    serde_json::from_str(&stdout)
        .map_err(|e| format!("Failed to parse expertise profile: {} - Output: {}", e, stdout))
}
