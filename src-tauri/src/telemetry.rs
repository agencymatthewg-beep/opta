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

/// Disk analysis node for treemap visualization.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiskAnalysisNode {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub category: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<DiskAnalysisNode>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
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

/// Python script to get disk analysis.
const PYTHON_DISK_ANALYSIS_SCRIPT: &str = r#"
import json
import sys

try:
    from opta_mcp.telemetry import get_disk_analysis
    path = sys.argv[1] if len(sys.argv) > 1 else "/"
    max_depth = int(sys.argv[2]) if len(sys.argv) > 2 else 2
    result = get_disk_analysis(path, max_depth)
    print(json.dumps(result))
except Exception as e:
    print(json.dumps({
        'name': 'Error',
        'path': path if 'path' in dir() else '/',
        'size': 0,
        'category': 'other',
        'children': [],
        'error': str(e)
    }))
    sys.exit(0)
"#;

/// Get disk analysis for treemap visualization.
///
/// Analyzes disk usage hierarchically for visualization as a treemap.
///
/// # Arguments
///
/// * `path` - Root path to analyze (default "/")
/// * `max_depth` - Maximum depth to traverse (default 2)
///
/// # Returns
///
/// A `DiskAnalysisNode` containing hierarchical disk usage data.
#[command]
pub async fn get_disk_analysis(path: Option<String>, max_depth: Option<u32>) -> Result<DiskAnalysisNode, String> {
    let path = path.unwrap_or_else(|| "/".to_string());
    let max_depth = max_depth.unwrap_or(2);

    let python_cmd = if cfg!(target_os = "windows") {
        "python"
    } else {
        "python3"
    };

    let output = Command::new(python_cmd)
        .arg("-c")
        .arg(PYTHON_DISK_ANALYSIS_SCRIPT)
        .arg(&path)
        .arg(max_depth.to_string())
        .output()
        .map_err(|e| format!("Failed to spawn Python: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Python error: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let node: DiskAnalysisNode =
        serde_json::from_str(&stdout).map_err(|e| format!("JSON parse error: {} (raw: {})", e, stdout))?;

    Ok(node)
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
