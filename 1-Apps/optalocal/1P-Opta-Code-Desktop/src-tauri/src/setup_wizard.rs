use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader, Read, Write as IoWrite};
use std::path::PathBuf;

#[derive(Debug, Deserialize)]
#[allow(dead_code)] // config_dir and shell received from JS wizard but not written to conf JSON
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

#[derive(Debug, Serialize)]
pub struct LmxProbeResult {
    pub reachable: bool,
    pub version: Option<String>,
    pub model_count: Option<u32>,
    pub status: Option<String>,
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

/// Probe LMX server by hitting GET /health over raw TCP (no extra deps).
/// Returns version, model count, and status from the JSON response.
#[tauri::command]
pub fn probe_lmx_server(host: String, port: u16) -> LmxProbeResult {
    use std::net::{SocketAddr, TcpStream};
    use std::str::FromStr;
    use std::time::Duration;

    let addr_str = format!("{}:{}", host, port);
    let addr = match SocketAddr::from_str(&addr_str) {
        Err(e) => {
            return LmxProbeResult {
                reachable: false,
                version: None,
                model_count: None,
                status: Some(format!("Invalid address: {}", e)),
            }
        }
        Ok(a) => a,
    };

    let mut stream = match TcpStream::connect_timeout(&addr, Duration::from_secs(3)) {
        Err(e) => {
            return LmxProbeResult {
                reachable: false,
                version: None,
                model_count: None,
                status: Some(format!("Unreachable: {}", e)),
            }
        }
        Ok(s) => s,
    };
    let _ = stream.set_read_timeout(Some(Duration::from_secs(3)));

    let request = format!(
        "GET /health HTTP/1.0\r\nHost: {}:{}\r\nAccept: application/json\r\nConnection: close\r\n\r\n",
        host, port
    );
    if stream.write_all(request.as_bytes()).is_err() {
        return LmxProbeResult {
            reachable: true,
            version: None,
            model_count: None,
            status: Some("HTTP write failed".into()),
        };
    }

    let mut reader = BufReader::new(stream);
    // Skip status line + headers
    loop {
        let mut line = String::new();
        match reader.read_line(&mut line) {
            Ok(0) | Err(_) => break,
            Ok(_) => {
                if line == "\r\n" {
                    break;
                }
            }
        }
    }

    let mut body = String::new();
    let _ = reader.read_to_string(&mut body);

    match serde_json::from_str::<serde_json::Value>(&body) {
        Ok(json) => {
            let version = json
                .get("version")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            let model_count = json
                .get("model_count")
                .or_else(|| json.get("models_count"))
                .or_else(|| json.get("loaded_models"))
                .and_then(|v| v.as_u64())
                .map(|n| n as u32);
            let status = json
                .get("status")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            LmxProbeResult {
                reachable: true,
                version,
                model_count,
                status,
            }
        }
        Err(_) => LmxProbeResult {
            reachable: true,
            version: None,
            model_count: None,
            status: None,
        },
    }
}

/// Return the current OS as a lowercase string: "macos", "windows", or "linux".
#[tauri::command]
pub fn get_platform() -> &'static str {
    #[cfg(target_os = "macos")]
    {
        "macos"
    }
    #[cfg(target_os = "windows")]
    {
        "windows"
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        "linux"
    }
}

/// Return the platform-appropriate Opta config *directory* for display.
#[tauri::command]
pub fn get_config_dir() -> Result<String, String> {
    get_opta_config_path().map(|p| {
        p.parent()
            .map(|d| d.to_string_lossy().into_owned())
            .unwrap_or_else(|| p.to_string_lossy().into_owned())
    })
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
