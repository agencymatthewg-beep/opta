use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Serialize, Deserialize)]
pub struct BenchmarkSession {
    pub benchmark_id: String,
    pub game_id: String,
    pub phase: String,
    pub started_at: f64,
    pub status: String,
}

#[allow(dead_code)]
#[derive(Debug, Serialize, Deserialize)]
pub struct BenchmarkMetrics {
    pub cpu_avg: f64,
    pub cpu_max: f64,
    pub memory_avg: f64,
    pub memory_max: f64,
    pub gpu_avg: Option<f64>,
    pub gpu_max: Option<f64>,
    pub gpu_temp_avg: Option<f64>,
    pub sample_count: u32,
    pub duration_seconds: f64,
}

const START_BENCHMARK_SCRIPT: &str = r#"
import sys
import json
sys.path.insert(0, 'mcp-server/src')
from opta_mcp.benchmark import start_benchmark

game_id = sys.argv[1]
game_name = sys.argv[2]
phase = sys.argv[3]
result = start_benchmark(game_id, game_name, phase)
print(json.dumps(result))
"#;

const CAPTURE_SAMPLE_SCRIPT: &str = r#"
import sys
import json
sys.path.insert(0, 'mcp-server/src')
from opta_mcp.benchmark import capture_sample

benchmark_id = sys.argv[1]
result = capture_sample(benchmark_id)
print(json.dumps(result or {"error": "Not found"}))
"#;

const END_BENCHMARK_SCRIPT: &str = r#"
import sys
import json
sys.path.insert(0, 'mcp-server/src')
from opta_mcp.benchmark import end_benchmark

benchmark_id = sys.argv[1]
metrics = end_benchmark(benchmark_id)
print(json.dumps(metrics or {"error": "Failed"}))
"#;

const GET_RESULTS_SCRIPT: &str = r#"
import sys
import json
sys.path.insert(0, 'mcp-server/src')
from opta_mcp.benchmark import get_benchmark_pair, get_all_benchmarks

game_id = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1] != "" else None
if game_id:
    result = get_benchmark_pair(game_id)
else:
    result = get_all_benchmarks()
print(json.dumps(result or []))
"#;

#[tauri::command]
pub async fn start_benchmark(
    game_id: String,
    game_name: String,
    phase: String,
) -> Result<BenchmarkSession, String> {
    let output = Command::new("python3")
        .arg("-c")
        .arg(START_BENCHMARK_SCRIPT)
        .arg(&game_id)
        .arg(&game_name)
        .arg(&phase)
        .current_dir(std::env::current_dir().map_err(|e| e.to_string())?)
        .output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Python script failed: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    serde_json::from_str(&stdout)
        .map_err(|e| format!("Failed to parse result: {}", e))
}

#[tauri::command]
pub async fn capture_benchmark_sample(benchmark_id: String) -> Result<serde_json::Value, String> {
    let output = Command::new("python3")
        .arg("-c")
        .arg(CAPTURE_SAMPLE_SCRIPT)
        .arg(&benchmark_id)
        .current_dir(std::env::current_dir().map_err(|e| e.to_string())?)
        .output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    serde_json::from_str(&stdout)
        .map_err(|e| format!("Failed to parse result: {}", e))
}

#[tauri::command]
pub async fn end_benchmark(benchmark_id: String) -> Result<serde_json::Value, String> {
    let output = Command::new("python3")
        .arg("-c")
        .arg(END_BENCHMARK_SCRIPT)
        .arg(&benchmark_id)
        .current_dir(std::env::current_dir().map_err(|e| e.to_string())?)
        .output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    serde_json::from_str(&stdout)
        .map_err(|e| format!("Failed to parse result: {}", e))
}

#[tauri::command]
pub async fn get_benchmark_results(game_id: Option<String>) -> Result<serde_json::Value, String> {
    let output = Command::new("python3")
        .arg("-c")
        .arg(GET_RESULTS_SCRIPT)
        .arg(game_id.unwrap_or_default())
        .current_dir(std::env::current_dir().map_err(|e| e.to_string())?)
        .output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    serde_json::from_str(&stdout)
        .map_err(|e| format!("Failed to parse result: {}", e))
}
