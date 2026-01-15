//! Hardware telemetry module for Opta.
//!
//! This module provides Tauri commands to fetch hardware telemetry from
//! the Python MCP server. For MVP, it uses a subprocess call to directly
//! invoke Python code, which is simpler than full MCP stdio transport.
//!
//! NOTE: Phase 10 can optimize this to use persistent MCP connection.

use serde::{Deserialize, Serialize};
use std::process::Command;
use tauri::command;

/// CPU telemetry information.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CpuInfo {
    pub percent: Option<f64>,
    pub cores: Option<u32>,
    pub threads: Option<u32>,
    pub frequency_mhz: Option<f64>,
    pub per_core_percent: Option<Vec<f64>>,
}

/// Memory (RAM) telemetry information.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryInfo {
    pub total_gb: Option<f64>,
    pub used_gb: Option<f64>,
    pub available_gb: Option<f64>,
    pub percent: Option<f64>,
}

/// Disk telemetry information.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiskInfo {
    pub total_gb: Option<f64>,
    pub used_gb: Option<f64>,
    pub free_gb: Option<f64>,
    pub percent: Option<f64>,
}

/// GPU telemetry information.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GpuInfo {
    pub available: bool,
    pub name: Option<String>,
    pub memory_total_gb: Option<f64>,
    pub memory_used_gb: Option<f64>,
    pub memory_percent: Option<f64>,
    pub temperature_c: Option<f64>,
    pub utilization_percent: Option<f64>,
}

/// Complete system telemetry snapshot.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemSnapshot {
    pub cpu: CpuInfo,
    pub memory: MemoryInfo,
    pub disk: DiskInfo,
    pub gpu: GpuInfo,
    pub timestamp: String,
}

/// Python script to get system snapshot.
///
/// This inline script avoids path resolution issues and directly imports
/// the telemetry functions from the installed opta_mcp package.
const PYTHON_SCRIPT: &str = r#"
import json
import sys
from datetime import datetime

try:
    from opta_mcp.telemetry import get_system_snapshot
    snapshot = get_system_snapshot()
    snapshot['timestamp'] = datetime.utcnow().isoformat() + 'Z'
    print(json.dumps(snapshot))
except Exception as e:
    # Return error as JSON for better error handling
    print(json.dumps({
        'error': str(e),
        'cpu': {'percent': None, 'cores': None, 'threads': None, 'frequency_mhz': None, 'per_core_percent': None},
        'memory': {'total_gb': None, 'used_gb': None, 'available_gb': None, 'percent': None},
        'disk': {'total_gb': None, 'used_gb': None, 'free_gb': None, 'percent': None},
        'gpu': {'available': False, 'name': None, 'memory_total_gb': None, 'memory_used_gb': None, 'memory_percent': None, 'temperature_c': None, 'utilization_percent': None},
        'timestamp': datetime.utcnow().isoformat() + 'Z'
    }))
    sys.exit(0)  # Exit cleanly so Tauri doesn't see error
"#;

/// Get system telemetry by invoking Python subprocess.
///
/// This command spawns Python to run the telemetry functions from opta_mcp.
/// For MVP, this uses a subprocess per-request which is simpler than maintaining
/// a persistent MCP connection. Can be optimized in Phase 10.
///
/// # Returns
///
/// A `SystemSnapshot` containing CPU, memory, disk, and GPU telemetry.
///
/// # Errors
///
/// Returns an error string if Python execution fails or JSON parsing fails.
#[command]
pub async fn get_system_telemetry() -> Result<SystemSnapshot, String> {
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
    let snapshot: SystemSnapshot =
        serde_json::from_str(&stdout).map_err(|e| format!("JSON parse error: {} (raw: {})", e, stdout))?;

    Ok(snapshot)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_structs_serialize() {
        let cpu = CpuInfo {
            percent: Some(45.5),
            cores: Some(8),
            threads: Some(16),
            frequency_mhz: Some(3200.0),
            per_core_percent: Some(vec![40.0, 50.0, 45.0, 48.0]),
        };

        let json = serde_json::to_string(&cpu).unwrap();
        assert!(json.contains("45.5"));
        assert!(json.contains("16"));
    }

    #[test]
    fn test_structs_deserialize() {
        let json = r#"{"percent": 50.0, "cores": 4, "threads": 8, "frequency_mhz": null, "per_core_percent": [25.0, 75.0]}"#;
        let cpu: CpuInfo = serde_json::from_str(json).unwrap();
        assert_eq!(cpu.percent, Some(50.0));
        assert_eq!(cpu.cores, Some(4));
        assert!(cpu.frequency_mhz.is_none());
    }
}
