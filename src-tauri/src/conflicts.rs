//! Conflict detection module for Opta.
//!
//! This module provides Tauri commands to detect competitor optimization tools
//! that may conflict with Opta's optimizations. Follows the same pattern as
//! processes.rs by invoking the Python MCP server.

use serde::{Deserialize, Serialize};
use std::process::Command;
use tauri::command;

/// Conflict severity level.
/// - "high": Significant conflict, likely to cause issues
/// - "medium": Partial conflict, may cause some issues
/// - "low": Minor conflict, minimal impact
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ConflictSeverity {
    High,
    Medium,
    Low,
}

/// Information about a detected competitor tool.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConflictInfo {
    /// Internal identifier (e.g., "geforce_experience")
    pub tool_id: String,
    /// Display name (e.g., "NVIDIA GeForce Experience")
    pub name: String,
    /// Brief description of the tool
    pub description: String,
    /// Conflict severity level
    pub severity: String,
    /// Actionable recommendation for the user
    pub recommendation: String,
    /// List of matching process names found
    pub detected_processes: Vec<String>,
}

/// Summary of conflict detection results.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConflictSummary {
    /// Total number of detected conflicts
    pub total_count: u32,
    /// Number of high severity conflicts
    pub high_count: u32,
    /// Number of medium severity conflicts
    pub medium_count: u32,
    /// Number of low severity conflicts
    pub low_count: u32,
    /// Full list of detected conflicts
    pub conflicts: Vec<ConflictInfo>,
}

/// Python script to detect conflicts.
///
/// This inline script invokes the conflicts module from the installed
/// opta_mcp package and returns the conflict summary as JSON.
const DETECT_CONFLICTS_SCRIPT: &str = r#"
import json
import sys

try:
    from opta_mcp.conflicts import get_conflict_summary
    result = get_conflict_summary()
    print(json.dumps(result))
except Exception as e:
    # Return error-safe default response
    print(json.dumps({
        "total_count": 0,
        "high_count": 0,
        "medium_count": 0,
        "low_count": 0,
        "conflicts": [],
        "error": str(e)
    }))
    sys.exit(0)
"#;

/// Detect competitor optimization tools by invoking Python subprocess.
///
/// This command spawns Python to run the conflict detection function from opta_mcp.
/// Returns a summary with detected conflicts and severity counts.
///
/// # Returns
///
/// A `ConflictSummary` containing detected conflicts and counts.
///
/// # Errors
///
/// Returns an error string if Python execution fails or JSON parsing fails.
#[command]
pub async fn detect_conflicts() -> Result<ConflictSummary, String> {
    // Try python3 first, fall back to python
    let python_cmd = if cfg!(target_os = "windows") {
        "python"
    } else {
        "python3"
    };

    let output = Command::new(python_cmd)
        .arg("-c")
        .arg(DETECT_CONFLICTS_SCRIPT)
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
            eprintln!("Python conflict detection warning: {}", err_msg);
        }
    }

    let result: ConflictSummary = serde_json::from_str(&stdout)
        .map_err(|e| format!("JSON parse error: {} (raw: {})", e, stdout))?;

    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_conflict_info_serialize() {
        let conflict = ConflictInfo {
            tool_id: "geforce_experience".to_string(),
            name: "NVIDIA GeForce Experience".to_string(),
            description: "NVIDIA's game optimization".to_string(),
            severity: "high".to_string(),
            recommendation: "Consider disabling auto-optimization".to_string(),
            detected_processes: vec!["nvcontainer".to_string()],
        };

        let json = serde_json::to_string(&conflict).unwrap();
        assert!(json.contains("geforce_experience"));
        assert!(json.contains("NVIDIA"));
        assert!(json.contains("nvcontainer"));
    }

    #[test]
    fn test_conflict_summary_deserialize() {
        let json = r#"{
            "total_count": 2,
            "high_count": 1,
            "medium_count": 1,
            "low_count": 0,
            "conflicts": [
                {
                    "tool_id": "geforce_experience",
                    "name": "NVIDIA GeForce Experience",
                    "description": "NVIDIA's game optimization",
                    "severity": "high",
                    "recommendation": "Consider disabling",
                    "detected_processes": ["nvcontainer"]
                }
            ]
        }"#;

        let summary: ConflictSummary = serde_json::from_str(json).unwrap();
        assert_eq!(summary.total_count, 2);
        assert_eq!(summary.high_count, 1);
        assert_eq!(summary.conflicts.len(), 1);
        assert_eq!(summary.conflicts[0].tool_id, "geforce_experience");
    }

    #[test]
    fn test_empty_summary_deserialize() {
        let json = r#"{
            "total_count": 0,
            "high_count": 0,
            "medium_count": 0,
            "low_count": 0,
            "conflicts": []
        }"#;

        let summary: ConflictSummary = serde_json::from_str(json).unwrap();
        assert_eq!(summary.total_count, 0);
        assert!(summary.conflicts.is_empty());
    }
}
