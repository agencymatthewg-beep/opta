//! Process management module for Opta.
//!
//! This module provides Tauri commands to fetch process information from
//! the Python MCP server. Follows the same pattern as telemetry.rs.

use serde::{Deserialize, Serialize};
use std::time::Duration;
use tauri::command;
use tokio::process::Command;
use tokio::time::timeout;

/// Default timeout for Python subprocess calls (30 seconds).
const SUBPROCESS_TIMEOUT: Duration = Duration::from_secs(30);

/// Run a Python command with timeout protection.
/// Returns (stdout, stderr) on success, or error message on failure/timeout.
async fn run_python_with_timeout(
    python_cmd: &str,
    script: &str,
    args: &[&str],
) -> Result<String, String> {
    let mut cmd = Command::new(python_cmd);
    cmd.arg("-c").arg(script);
    for arg in args {
        cmd.arg(arg);
    }

    // Add PYTHONPATH for opta_mcp module
    let pythonpath = std::env::current_dir()
        .map(|p| p.join("../mcp-server/src").to_string_lossy().to_string())
        .unwrap_or_else(|_| "./mcp-server/src".to_string());
    cmd.env("PYTHONPATH", &pythonpath);

    let output_future = cmd.output();

    match timeout(SUBPROCESS_TIMEOUT, output_future).await {
        Ok(Ok(output)) => {
            if !output.status.success() {
                let stderr = String::from_utf8_lossy(&output.stderr);
                return Err(format!("Python error: {}", stderr));
            }
            Ok(String::from_utf8_lossy(&output.stdout).to_string())
        }
        Ok(Err(e)) => Err(format!("Failed to spawn Python: {}", e)),
        Err(_) => Err(format!(
            "Python subprocess timed out after {} seconds",
            SUBPROCESS_TIMEOUT.as_secs()
        )),
    }
}

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

/// Result of terminating a single process.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminateResult {
    /// Whether termination was successful
    pub success: bool,
    /// Process ID
    pub pid: u32,
    /// Process name (if available)
    pub name: Option<String>,
    /// Error message (if failed)
    pub error: Option<String>,
    /// Memory freed in MB (estimated)
    #[serde(default)]
    pub memory_mb: Option<f32>,
}

/// Result of Stealth Mode execution.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StealthModeResult {
    /// Successfully terminated processes
    pub terminated: Vec<TerminateResult>,
    /// Failed termination attempts
    pub failed: Vec<TerminateResult>,
    /// Estimated memory freed in MB
    pub freed_memory_mb: f32,
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
    let python_cmd = if cfg!(target_os = "windows") {
        "python"
    } else {
        "python3"
    };

    let stdout = run_python_with_timeout(python_cmd, PYTHON_SCRIPT, &[]).await?;

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

/// Python script to terminate a process by PID.
const TERMINATE_PYTHON_SCRIPT: &str = r#"
import json
import sys

try:
    from opta_mcp.processes import terminate_process
    pid = int(sys.argv[1])
    result = terminate_process(pid)
    print(json.dumps(result))
except Exception as e:
    print(json.dumps({"success": False, "pid": 0, "error": str(e)}))
    sys.exit(0)
"#;

/// Terminate a process by PID.
///
/// Invokes Python terminate_process function which uses graceful
/// termination first, then force kill if needed.
///
/// # Arguments
///
/// * `pid` - Process ID to terminate
///
/// # Returns
///
/// A `TerminateResult` indicating success or failure.
#[command]
pub async fn terminate_process(pid: u32) -> Result<TerminateResult, String> {
    let python_cmd = if cfg!(target_os = "windows") {
        "python"
    } else {
        "python3"
    };

    let pid_str = pid.to_string();
    let stdout =
        run_python_with_timeout(python_cmd, TERMINATE_PYTHON_SCRIPT, &[&pid_str]).await?;

    let result: TerminateResult = serde_json::from_str(&stdout)
        .map_err(|e| format!("JSON parse error: {} (raw: {})", e, stdout))?;

    Ok(result)
}

/// Python script to execute Stealth Mode.
const STEALTH_MODE_PYTHON_SCRIPT: &str = r#"
import json
import sys

try:
    from opta_mcp.processes import stealth_mode
    result = stealth_mode()
    print(json.dumps(result))
except Exception as e:
    print(json.dumps({"terminated": [], "failed": [], "freed_memory_mb": 0, "error": str(e)}))
    sys.exit(0)
"#;

/// Execute Stealth Mode - terminate all safe-to-kill processes.
///
/// Invokes Python stealth_mode function which only terminates
/// processes categorized as "safe-to-kill", never system or user processes.
///
/// # Returns
///
/// A `StealthModeResult` with terminated/failed lists and freed memory.
#[command]
pub async fn stealth_mode() -> Result<StealthModeResult, String> {
    let python_cmd = if cfg!(target_os = "windows") {
        "python"
    } else {
        "python3"
    };

    let stdout = run_python_with_timeout(python_cmd, STEALTH_MODE_PYTHON_SCRIPT, &[]).await?;

    let result: StealthModeResult = serde_json::from_str(&stdout)
        .map_err(|e| format!("JSON parse error: {} (raw: {})", e, stdout))?;

    Ok(result)
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
