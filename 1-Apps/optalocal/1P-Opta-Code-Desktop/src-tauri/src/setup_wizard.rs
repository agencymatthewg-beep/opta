use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Deserialize)]
pub struct SetupConfig {
    pub provider: String,       // "lmx" | "anthropic"
    pub lmx_host: String,       // e.g. "192.168.188.11"
    pub lmx_port: u16,          // e.g. 1234
    pub anthropic_key: String,  // only if provider == "anthropic"
    pub config_dir: String,     // e.g. "~/.config/opta"
    pub autonomy_level: u8,     // 1=supervised, 2=balanced, 3=autonomous
    pub shell: String,          // "auto" | "bash" | "zsh" | "powershell"
    pub tui_default: bool,
}

#[derive(Debug, Serialize)]
pub struct ConnectionTestResult {
    pub ok: bool,
    pub message: String,
}

/// Check if the CLI config file already exists (first-run detection).
#[tauri::command]
pub fn check_first_run() -> bool {
    get_opta_config_path()
        .map(|p| !p.exists())
        .unwrap_or(true)
}

/// Save setup wizard data to CLI config location.
#[tauri::command]
pub fn save_setup_config(config: SetupConfig) -> Result<(), String> {
    let config_path = get_opta_config_path().map_err(|e| e.to_string())?;

    if let Some(parent) = config_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    // Build conf-format JSON matching what the CLI's `conf` package writes.
    let autonomy_level = match config.autonomy_level {
        1 => 1,
        3 => 3,
        _ => 2,
    };

    let json_value = serde_json::json!({
        "provider": {
            "active": config.provider,
            "anthropic": {
                "apiKey": config.anthropic_key
            }
        },
        "connection": {
            "host": config.lmx_host,
            "port": config.lmx_port
        },
        "autonomy": {
            "level": autonomy_level
        },
        "tui": {
            "default": config.tui_default
        }
    });

    std::fs::write(
        &config_path,
        serde_json::to_string_pretty(&json_value).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// Test TCP connectivity to LMX host:port (3s timeout, no extra deps needed).
#[tauri::command]
pub fn test_lmx_connection(host: String, port: u16) -> ConnectionTestResult {
    use std::net::{SocketAddr, TcpStream};
    use std::str::FromStr;
    use std::time::Duration;

    let addr_str = format!("{}:{}", host, port);
    match SocketAddr::from_str(&addr_str) {
        Err(e) => ConnectionTestResult {
            ok: false,
            message: format!("Invalid address: {}", e),
        },
        Ok(addr) => match TcpStream::connect_timeout(&addr, Duration::from_secs(3)) {
            Ok(_) => ConnectionTestResult {
                ok: true,
                message: format!("Connected to {}:{}", host, port),
            },
            Err(e) => ConnectionTestResult {
                ok: false,
                message: format!("Connection failed: {}", e),
            },
        },
    }
}

fn get_opta_config_path() -> Result<PathBuf, String> {
    #[cfg(target_os = "macos")]
    {
        let home = std::env::var("HOME").map_err(|_| "HOME not set".to_string())?;
        Ok(PathBuf::from(home)
            .join("Library")
            .join("Preferences")
            .join("opta")
            .join("config.json"))
    }
    #[cfg(target_os = "windows")]
    {
        let appdata = std::env::var("APPDATA").map_err(|_| "APPDATA not set".to_string())?;
        Ok(PathBuf::from(appdata)
            .join("opta")
            .join("Config")
            .join("config.json"))
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let home = std::env::var("HOME").map_err(|_| "HOME not set".to_string())?;
        let xdg = std::env::var("XDG_CONFIG_HOME")
            .unwrap_or_else(|_| format!("{}/.config", home));
        Ok(PathBuf::from(xdg).join("opta").join("config.json"))
    }
}
