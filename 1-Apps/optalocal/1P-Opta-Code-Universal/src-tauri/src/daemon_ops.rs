use std::fs::{self, OpenOptions};
use std::io::{BufRead, BufReader, Write as IoWrite};
use std::path::PathBuf;
use std::thread::sleep;
use std::time::{Duration, Instant};

use serde::Serialize;
use serde_json::Value;

// ── Session persistence (Stream F) ──────────────────────────────────────────

fn user_home_dir() -> Result<PathBuf, String> {
    #[cfg(target_os = "windows")]
    {
        if let Ok(profile) = std::env::var("USERPROFILE") {
            return Ok(PathBuf::from(profile));
        }
    }
    std::env::var("HOME")
        .map(PathBuf::from)
        .map_err(|_| "HOME not set".to_string())
}

fn sessions_dir() -> Result<PathBuf, String> {
    Ok(crate::config_paths::opta_config_dir()?.join("sessions"))
}

#[tauri::command]
pub async fn append_session_event(session_id: String, event_json: String) -> Result<(), String> {
    let dir = sessions_dir()?.join(&session_id);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let file = dir.join("events.jsonl");
    let mut f = OpenOptions::new()
        .create(true)
        .append(true)
        .open(file)
        .map_err(|e| e.to_string())?;
    writeln!(f, "{}", event_json).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn load_session_events(session_id: String) -> Result<Vec<String>, String> {
    let file = sessions_dir()?.join(&session_id).join("events.jsonl");
    if !file.exists() {
        return Ok(vec![]);
    }
    let f = fs::File::open(file).map_err(|e| e.to_string())?;
    Ok(BufReader::new(f)
        .lines()
        .filter_map(|l| l.ok())
        .collect())
}

// ── Daemon lifecycle (Stream H) ─────────────────────────────────────────────

fn daemon_dir() -> Result<PathBuf, String> {
    Ok(crate::config_paths::opta_config_dir()?.join("daemon"))
}

fn daemon_state_path() -> Result<PathBuf, String> {
    Ok(daemon_dir()?.join("state.json"))
}

fn read_daemon_state() -> Result<Value, String> {
    let state_path = daemon_state_path()?;
    let raw = fs::read_to_string(state_path).map_err(|e| e.to_string())?;
    serde_json::from_str::<Value>(&raw).map_err(|e| format!("Failed to parse daemon state: {e}"))
}

fn read_daemon_state_with_retry(timeout: Duration) -> Result<Value, String> {
    let deadline = Instant::now() + timeout;
    let last_error = loop {
        match read_daemon_state() {
            Ok(state) => return Ok(state),
            Err(err) => {
                if Instant::now() >= deadline {
                    break err;
                }
                sleep(Duration::from_millis(120));
            }
        }
    };
    Err(format!(
        "Daemon state did not become ready within {} ms: {last_error}",
        timeout.as_millis()
    ))
}

fn daemon_token_from_state(state: &Value) -> Option<String> {
    state
        .get("token")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|token| !token.is_empty())
        .map(ToOwned::to_owned)
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DaemonConnectionMetadata {
    pub host: String,
    pub port: u16,
    pub pid: Option<u32>,
    pub started_at: Option<String>,
    pub daemon_id: Option<String>,
    pub logs_path: Option<String>,
}

fn daemon_metadata_from_state(state: &Value) -> Result<DaemonConnectionMetadata, String> {
    let host = state
        .get("host")
        .and_then(Value::as_str)
        .unwrap_or("127.0.0.1")
        .to_string();
    let port = state
        .get("port")
        .and_then(Value::as_u64)
        .and_then(|raw| u16::try_from(raw).ok())
        .ok_or_else(|| "Daemon state missing valid port".to_string())?;
    let pid = state
        .get("pid")
        .and_then(Value::as_u64)
        .and_then(|raw| u32::try_from(raw).ok());
    let started_at = state
        .get("startedAt")
        .and_then(Value::as_str)
        .map(ToOwned::to_owned);
    let daemon_id = state
        .get("daemonId")
        .and_then(Value::as_str)
        .map(ToOwned::to_owned);
    let logs_path = state
        .get("logsPath")
        .and_then(Value::as_str)
        .map(ToOwned::to_owned);

    Ok(DaemonConnectionMetadata {
        host,
        port,
        pid,
        started_at,
        daemon_id,
        logs_path,
    })
}

fn redacted_daemon_state_json(mut state: Value) -> Result<String, String> {
    if let Some(obj) = state.as_object_mut() {
        obj.remove("token");
    }
    serde_json::to_string(&state).map_err(|e| e.to_string())
}

fn run_opta_command(args: &[&str]) -> Result<std::process::Output, String> {
    std::process::Command::new("opta")
        .args(args)
        .output()
        .map_err(|e| format!("failed to execute `opta {}`: {e}", args.join(" ")))
}

fn format_command_failure(args: &[&str], output: &std::process::Output) -> String {
    let status = output.status.code().unwrap_or(-1);
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let mut message = format!("`opta {}` failed (exit={status})", args.join(" "));
    if !stderr.is_empty() {
        message.push_str(&format!(", stderr: {stderr}"));
    }
    if !stdout.is_empty() {
        message.push_str(&format!(", stdout: {stdout}"));
    }
    message
}

fn daemon_stop_not_running(output: &std::process::Output) -> bool {
    let combined = format!(
        "{}\n{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    combined.to_lowercase().contains("not running")
}

fn expand_home_prefix(path: &str) -> Result<PathBuf, String> {
    if path == "~" {
        return user_home_dir();
    }
    if let Some(trimmed) = path.strip_prefix("~/") {
        return Ok(user_home_dir()?.join(trimmed));
    }
    if let Some(trimmed) = path.strip_prefix("~\\") {
        return Ok(user_home_dir()?.join(trimmed));
    }
    Ok(PathBuf::from(path))
}

fn resolve_daemon_log_path() -> Result<PathBuf, String> {
    if let Ok(state) = read_daemon_state() {
        if let Ok(metadata) = daemon_metadata_from_state(&state) {
            if let Some(path) = metadata.logs_path {
                let trimmed = path.trim();
                if !trimmed.is_empty() {
                    return expand_home_prefix(trimmed);
                }
            }
        }
    }
    Ok(daemon_dir()?.join("daemon.log"))
}

#[tauri::command]
pub async fn bootstrap_daemon_connection(
    start_if_needed: Option<bool>,
) -> Result<DaemonConnectionMetadata, String> {
    if start_if_needed.unwrap_or(false) {
        let output = run_opta_command(&["daemon", "start"])?;
        if !output.status.success() {
            return Err(format_command_failure(&["daemon", "start"], &output));
        }
    }

    let state = if start_if_needed.unwrap_or(false) {
        read_daemon_state_with_retry(Duration::from_secs(5))?
    } else {
        read_daemon_state()?
    };
    let metadata = daemon_metadata_from_state(&state)?;
    if let Some(token) = daemon_token_from_state(&state) {
        crate::connection_secrets::set_connection_secret(metadata.host.clone(), metadata.port, token)?;
    }

    Ok(metadata)
}

#[tauri::command]
pub async fn daemon_action(action: String) -> Result<String, String> {
    match action.as_str() {
        "restart" => {
            let stop_output = run_opta_command(&["daemon", "stop"])?;
            if !stop_output.status.success() && !daemon_stop_not_running(&stop_output) {
                return Err(format_command_failure(&["daemon", "stop"], &stop_output));
            }

            let start_output = run_opta_command(&["daemon", "start"])?;
            if !start_output.status.success() {
                return Err(format_command_failure(&["daemon", "start"], &start_output));
            }
            Ok("restarted".to_string())
        }
        "stop" => {
            let output = run_opta_command(&["daemon", "stop"])?;
            if !output.status.success() && !daemon_stop_not_running(&output) {
                return Err(format_command_failure(&["daemon", "stop"], &output));
            }
            if daemon_stop_not_running(&output) {
                Ok("stopped (already not running)".to_string())
            } else {
                Ok("stopped".to_string())
            }
        }
        "status" => {
            let state = read_daemon_state()?;
            redacted_daemon_state_json(state)
        }
        _ => Err(format!("Unknown action: {}", action)),
    }
}

// ── Daemon logs viewer (Stream I) ───────────────────────────────────────────

#[tauri::command]
pub async fn read_daemon_logs(last_n: usize) -> Result<Vec<String>, String> {
    let log_path = resolve_daemon_log_path()?;
    if !log_path.exists() {
        return Ok(vec![]);
    }
    let f = fs::File::open(&log_path).map_err(|e| e.to_string())?;
    let lines: Vec<String> = BufReader::new(f)
        .lines()
        .filter_map(|l| l.ok())
        .collect();
    let start = lines.len().saturating_sub(last_n);
    Ok(lines[start..].to_vec())
}
