use serde::{Deserialize, Serialize};
use std::process::Command;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::time::timeout;

/// Result of a game launch attempt
#[derive(Debug, Serialize, Deserialize)]
pub struct LaunchResult {
    pub success: bool,
    pub launched_at: Option<f64>,
    pub error: Option<String>,
    pub launch_url: String,
}

/// Status of whether a game is currently running
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameRunningStatus {
    pub running: bool,
    pub pid: Option<u32>,
    pub process_name: Option<String>,
    pub cpu_percent: Option<f32>,
    pub memory_mb: Option<f32>,
}

/// Generate the appropriate launch URL for a launcher
fn generate_launch_url(launcher: &str, game_id: &str) -> Result<String, String> {
    match launcher {
        "steam" => {
            // Extract numeric app ID from "steam_730" format
            let app_id = game_id
                .strip_prefix("steam_")
                .unwrap_or(game_id);
            Ok(format!("steam://run/{}", app_id))
        }
        "epic" => {
            // Extract app name from "epic_Fortnite" format
            let app_name = game_id
                .strip_prefix("epic_")
                .unwrap_or(game_id);
            Ok(format!(
                "com.epicgames.launcher://apps/{}?action=launch",
                app_name
            ))
        }
        "gog" => {
            // Extract game ID from "gog_123" format
            let gog_id = game_id
                .strip_prefix("gog_")
                .unwrap_or(game_id);
            Ok(format!("goggalaxy://openGameView/{}", gog_id))
        }
        _ => Err(format!("Unknown launcher: {}", launcher)),
    }
}

/// Get current Unix timestamp in seconds
fn current_timestamp() -> f64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs_f64()
}

/// Launch a game via its launcher's URL protocol
///
/// # Arguments
/// * `launcher` - Launcher identifier ("steam", "epic", "gog")
/// * `game_id` - Game identifier (e.g., "steam_730", "epic_Fortnite")
///
/// # Returns
/// * `LaunchResult` - Success status, timestamp, and any error message
#[tauri::command]
pub async fn launch_game(launcher: String, game_id: String) -> Result<LaunchResult, String> {
    // Generate the launch URL
    let launch_url = match generate_launch_url(&launcher, &game_id) {
        Ok(url) => url,
        Err(e) => {
            return Ok(LaunchResult {
                success: false,
                launched_at: None,
                error: Some(e),
                launch_url: String::new(),
            });
        }
    };

    // Open the URL using platform-specific method
    let result = open_url(&launch_url);

    match result {
        Ok(()) => Ok(LaunchResult {
            success: true,
            launched_at: Some(current_timestamp()),
            error: None,
            launch_url,
        }),
        Err(e) => Ok(LaunchResult {
            success: false,
            launched_at: None,
            error: Some(e),
            launch_url,
        }),
    }
}

/// Open a URL using the platform-specific method
/// Uses .status() instead of .spawn() to wait for the launcher to complete
/// and avoid creating zombie processes.
#[cfg(target_os = "macos")]
fn open_url(url: &str) -> Result<(), String> {
    let mut child = Command::new("open")
        .arg(url)
        .spawn()
        .map_err(|e| format!("Failed to open URL: {}", e))?;

    // Wait for the 'open' command to complete (it spawns the actual handler and exits quickly)
    // This prevents zombie processes while not blocking on the launched app
    std::thread::spawn(move || {
        let _ = child.wait();
    });

    Ok(())
}

#[cfg(target_os = "windows")]
fn open_url(url: &str) -> Result<(), String> {
    let mut child = Command::new("cmd")
        .args(["/C", "start", "", url])
        .spawn()
        .map_err(|e| format!("Failed to open URL: {}", e))?;

    // Wait for cmd to complete in background
    std::thread::spawn(move || {
        let _ = child.wait();
    });

    Ok(())
}

#[cfg(target_os = "linux")]
fn open_url(url: &str) -> Result<(), String> {
    let mut child = Command::new("xdg-open")
        .arg(url)
        .spawn()
        .map_err(|e| format!("Failed to open URL: {}", e))?;

    // Wait for xdg-open to complete in background
    std::thread::spawn(move || {
        let _ = child.wait();
    });

    Ok(())
}

/// Python script to check if any of the given process names are running.
const CHECK_PROCESS_SCRIPT: &str = r#"
import json
import sys
import psutil

def check_game_running(process_names):
    """Check if any of the given process names are running."""
    names_lower = [n.lower() for n in process_names]

    for proc in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_info']):
        try:
            info = proc.info
            proc_name = info.get('name', '')
            if proc_name and proc_name.lower() in names_lower:
                memory_info = info.get('memory_info')
                memory_mb = memory_info.rss / (1024 * 1024) if memory_info else None
                return {
                    'running': True,
                    'pid': info.get('pid'),
                    'processName': proc_name,
                    'cpuPercent': info.get('cpu_percent'),
                    'memoryMb': round(memory_mb, 1) if memory_mb else None,
                }
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            continue

    return {
        'running': False,
        'pid': None,
        'processName': None,
        'cpuPercent': None,
        'memoryMb': None,
    }

if __name__ == '__main__':
    process_names = json.loads(sys.argv[1])
    result = check_game_running(process_names)
    print(json.dumps(result))
"#;

/// Default timeout for Python subprocess calls (30 seconds).
const SUBPROCESS_TIMEOUT: Duration = Duration::from_secs(30);

/// Check if a game is currently running by looking for its process
///
/// # Arguments
/// * `process_names` - List of possible process names to check
///
/// # Returns
/// * `GameRunningStatus` - Whether game is running and basic metrics
#[tauri::command]
pub async fn check_game_running(process_names: Vec<String>) -> Result<GameRunningStatus, String> {
    if process_names.is_empty() {
        return Ok(GameRunningStatus {
            running: false,
            pid: None,
            process_name: None,
            cpu_percent: None,
            memory_mb: None,
        });
    }

    let python_cmd = if cfg!(target_os = "windows") {
        "python"
    } else {
        "python3"
    };

    // Serialize process names to JSON for Python
    let names_json = serde_json::to_string(&process_names)
        .map_err(|e| format!("Failed to serialize process names: {}", e))?;

    let mut cmd = tokio::process::Command::new(python_cmd);
    cmd.arg("-c")
        .arg(CHECK_PROCESS_SCRIPT)
        .arg(&names_json);

    let output_future = cmd.output();

    let output = match timeout(SUBPROCESS_TIMEOUT, output_future).await {
        Ok(Ok(output)) => output,
        Ok(Err(e)) => return Err(format!("Failed to spawn Python: {}", e)),
        Err(_) => return Err(format!(
            "Python subprocess timed out after {} seconds",
            SUBPROCESS_TIMEOUT.as_secs()
        )),
    };

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Python error: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let status: GameRunningStatus = serde_json::from_str(&stdout)
        .map_err(|e| format!("JSON parse error: {} (raw: {})", e, stdout))?;

    Ok(status)
}

/// Get the list of known process names for a game
///
/// # Arguments
/// * `game_id` - Game identifier
///
/// # Returns
/// * List of process names to look for
#[tauri::command]
pub fn get_game_process_names(game_id: String) -> Vec<String> {
    // Known process names for popular games
    match game_id.as_str() {
        // Steam games
        "steam_730" => vec!["cs2".to_string(), "cs2.exe".to_string()],
        "steam_570" => vec!["dota2".to_string(), "dota2.exe".to_string()],
        "steam_1245620" => vec!["eldenring.exe".to_string(), "start_protected_game.exe".to_string()],
        "steam_271590" => vec!["GTA5.exe".to_string()],
        "steam_1091500" => vec!["Cyberpunk2077.exe".to_string()],
        "steam_1172470" => vec!["r5apex.exe".to_string()], // Apex Legends
        "steam_578080" => vec!["TslGame.exe".to_string()], // PUBG
        "steam_1599340" => vec!["LOSTARK.exe".to_string()],
        "steam_252490" => vec!["RustClient.exe".to_string(), "rust".to_string()],
        "steam_892970" => vec!["valheim.exe".to_string(), "valheim".to_string()],

        // Epic games
        "epic_Fortnite" => vec!["FortniteClient-Win64-Shipping.exe".to_string()],

        // Default: try to extract name from ID
        _ => {
            // Extract game name from ID format (launcher_name)
            if let Some(name) = game_id.split('_').nth(1) {
                vec![
                    name.to_string(),
                    format!("{}.exe", name),
                    name.to_lowercase(),
                    format!("{}.exe", name.to_lowercase()),
                ]
            } else {
                vec![]
            }
        }
    }
}
