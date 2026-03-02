use std::fs::{self, OpenOptions};
use std::io::{BufRead, BufReader, Write as IoWrite};
use std::path::PathBuf;

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

fn config_root_dir() -> Result<PathBuf, String> {
    if let Ok(xdg) = std::env::var("XDG_CONFIG_HOME") {
        return Ok(PathBuf::from(xdg));
    }
    #[cfg(target_os = "windows")]
    {
        if let Ok(appdata) = std::env::var("APPDATA") {
            return Ok(PathBuf::from(appdata));
        }
    }
    Ok(user_home_dir()?.join(".config"))
}

fn opta_config_dir() -> Result<PathBuf, String> {
    Ok(config_root_dir()?.join("opta"))
}

fn sessions_dir() -> Result<PathBuf, String> {
    Ok(opta_config_dir()?.join("sessions"))
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
    Ok(opta_config_dir()?.join("daemon"))
}

fn daemon_state_path() -> Result<PathBuf, String> {
    Ok(daemon_dir()?.join("state.json"))
}

fn read_daemon_state() -> Result<Value, String> {
    let state_path = daemon_state_path()?;
    let raw = fs::read_to_string(state_path).map_err(|e| e.to_string())?;
    serde_json::from_str::<Value>(&raw).map_err(|e| format!("Failed to parse daemon state: {e}"))
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

#[tauri::command]
pub async fn bootstrap_daemon_connection(
    start_if_needed: Option<bool>,
) -> Result<DaemonConnectionMetadata, String> {
    use std::process::Command;

    if start_if_needed.unwrap_or(false) {
        Command::new("opta")
            .args(["daemon", "start"])
            .output()
            .map_err(|e| e.to_string())?;
    }

    let state = read_daemon_state()?;
    let metadata = daemon_metadata_from_state(&state)?;
    if let Some(token) = daemon_token_from_state(&state) {
        crate::connection_secrets::set_connection_secret(metadata.host.clone(), metadata.port, token)?;
    }

    Ok(metadata)
}

#[tauri::command]
pub async fn daemon_action(action: String) -> Result<String, String> {
    use std::process::Command;
    match action.as_str() {
        "restart" => {
            Command::new("opta")
                .args(["daemon", "stop"])
                .output()
                .ok();
            Command::new("opta")
                .args(["daemon", "start"])
                .output()
                .map(|_| "restarted".to_string())
                .map_err(|e| e.to_string())
        }
        "stop" => Command::new("opta")
            .args(["daemon", "stop"])
            .output()
            .map(|_| "stopped".to_string())
            .map_err(|e| e.to_string()),
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
    let log_path = daemon_dir()?.join("daemon.log");
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
