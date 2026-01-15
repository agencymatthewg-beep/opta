//! Process management module for Opta.
//!
//! This module provides Tauri commands to fetch process information from
//! the Python MCP server. Follows the same pattern as telemetry.rs.

use serde::{Deserialize, Serialize};
use std::process::Command;
use tauri::command;

/// Process information with resource usage and categorization.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessInfo {
    /// Process ID
    pub pid: u32,
    /// Process name
    pub name: String,
    /// CPU usage percentage (0-100)
    pub cpu_percent: f32,
    /// Memory usage percentage (0-100)
    pub memory_percent: f32,
    /// Process status (running, sleeping, etc.)
    pub status: String,
    /// Category: "system", "user", or "safe-to-kill"
    pub category: String,
    /// Username running the process (may be null)
    pub username: Option<String>,
}

/// Python script to get process list.
///
/// This inline script invokes the processes module from the installed
/// opta_mcp package and returns the process list as JSON.
const PYTHON_SCRIPT: &str = r#"
import json
import sys

try:
    from opta_mcp.processes import get_process_list
    processes = get_process_list()
    print(json.dumps(processes))
except Exception as e:
    # Return error as JSON
    print(json.dumps({"error": str(e)}))
    sys.exit(0)
"#;

/// Get list of running processes by invoking Python subprocess.
///
/// This command spawns Python to run the process listing function from opta_mcp.
/// Returns top 100 processes sorted by CPU usage with categorization.
///
/// # Returns
///
/// A `Vec<ProcessInfo>` containing process information.
///
/// # Errors
///
/// Returns an error string if Python execution fails or JSON parsing fails.
#[command]
pub async fn get_processes() -> Result<Vec<ProcessInfo>, String> {
    // Try python3 first, fall back to python
    let python_cmd = if cfg!(target_os = "windows") {
        "python"
    } else {
        "python3"
    };

    let output = Command::new(python_cmd)
        .arg("-c")
        .arg(PYTHON_SCRIPT)
        .output()
        .map_err(|e| format!("Failed to spawn Python: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Python error: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);

    // Check if the response is an error object
    if stdout.contains("\"error\"") {
        let error: serde_json::Value = serde_json::from_str(&stdout)
            .map_err(|e| format!("JSON parse error: {}", e))?;
        if let Some(err_msg) = error.get("error").and_then(|v| v.as_str()) {
            return Err(format!("Python error: {}", err_msg));
        }
    }

    let processes: Vec<ProcessInfo> = serde_json::from_str(&stdout)
        .map_err(|e| format!("JSON parse error: {} (raw: {})", e, stdout))?;

    Ok(processes)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_process_info_serialize() {
        let process = ProcessInfo {
            pid: 1234,
            name: "test_process".to_string(),
            cpu_percent: 5.5,
            memory_percent: 2.3,
            status: "running".to_string(),
            category: "user".to_string(),
            username: Some("testuser".to_string()),
        };

        let json = serde_json::to_string(&process).unwrap();
        assert!(json.contains("1234"));
        assert!(json.contains("test_process"));
        assert!(json.contains("user"));
    }

    #[test]
    fn test_process_info_deserialize() {
        let json = r#"{"pid": 5678, "name": "chrome", "cpu_percent": 10.5, "memory_percent": 3.2, "status": "sleeping", "category": "safe-to-kill", "username": null}"#;
        let process: ProcessInfo = serde_json::from_str(json).unwrap();
        assert_eq!(process.pid, 5678);
        assert_eq!(process.name, "chrome");
        assert_eq!(process.category, "safe-to-kill");
        assert!(process.username.is_none());
    }
}
