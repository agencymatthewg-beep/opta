use std::fs::{self, OpenOptions};
use std::io::{BufRead, BufReader, Write as IoWrite};
use std::path::PathBuf;

// ── Session persistence (Stream F) ──────────────────────────────────────────

fn sessions_dir() -> Result<PathBuf, String> {
    let home = std::env::var("HOME").map_err(|_| "HOME not set".to_string())?;
    Ok(PathBuf::from(home).join(".opta").join("sessions"))
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
    let home = std::env::var("HOME").map_err(|_| "HOME not set".to_string())?;
    // The CLI always uses ~/.config/opta/daemon on every platform.
    let xdg = std::env::var("XDG_CONFIG_HOME").unwrap_or_else(|_| format!("{}/.config", home));
    Ok(PathBuf::from(xdg).join("opta").join("daemon"))
}

fn daemon_state_path() -> Result<PathBuf, String> {
    Ok(daemon_dir()?.join("state.json"))
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
            let state_path = daemon_state_path()?;
            fs::read_to_string(state_path).map_err(|e| e.to_string())
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
