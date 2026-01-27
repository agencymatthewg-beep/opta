//! Opta Life Manager - Tauri Desktop Application
//!
//! Bundles a Next.js standalone server with Node.js runtime for a fully
//! portable macOS desktop application.

use directories::ProjectDirs;
use serde::{Deserialize, Serialize};
use std::fs;
use std::net::TcpListener;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::Manager;

/// Holds the Next.js server child process for lifecycle management.
struct ServerProcess(Mutex<Option<Child>>);

/// Holds the current server port for IPC.
struct ServerPort(Mutex<u16>);

/// Default port for the Next.js server.
const DEFAULT_PORT: u16 = 3000;

/// Maximum time to wait for server to become ready.
const SERVER_STARTUP_TIMEOUT: Duration = Duration::from_secs(15);

/// Interval between server readiness checks.
const HEALTH_CHECK_INTERVAL: Duration = Duration::from_millis(200);

/// API configuration that can be set at runtime.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ApiConfig {
    pub google_client_id: Option<String>,
    pub google_client_secret: Option<String>,
    pub todoist_api_token: Option<String>,
    pub gemini_api_key: Option<String>,
    pub auth_secret: Option<String>,
}

// Environment variables embedded at build time (fallbacks).
const AUTH_SECRET: Option<&str> = option_env!("AUTH_SECRET");
const GOOGLE_CLIENT_ID: Option<&str> = option_env!("GOOGLE_CLIENT_ID");
const GOOGLE_CLIENT_SECRET: Option<&str> = option_env!("GOOGLE_CLIENT_SECRET");
const TODOIST_API_TOKEN: Option<&str> = option_env!("TODOIST_API_TOKEN");
const GEMINI_API_KEY: Option<&str> = option_env!("GEMINI_API_KEY");

/// Get the config file path.
fn get_config_path() -> Option<PathBuf> {
    ProjectDirs::from("com", "opta", "life-manager").map(|dirs| dirs.config_dir().join("config.json"))
}

/// Load API config from disk.
fn load_config() -> ApiConfig {
    get_config_path()
        .and_then(|path| fs::read_to_string(&path).ok())
        .and_then(|content| serde_json::from_str(&content).ok())
        .unwrap_or_default()
}

/// Save API config to disk.
fn save_config(config: &ApiConfig) -> Result<(), String> {
    let path = get_config_path().ok_or("Could not determine config path")?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let content = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    fs::write(&path, content).map_err(|e| e.to_string())
}

/// Tauri command: Get current API config.
#[tauri::command]
fn get_api_config() -> ApiConfig {
    let mut config = load_config();
    // Fill in from build-time env vars if not set at runtime
    if config.auth_secret.is_none() {
        config.auth_secret = AUTH_SECRET.map(String::from);
    }
    if config.google_client_id.is_none() {
        config.google_client_id = GOOGLE_CLIENT_ID.map(String::from);
    }
    if config.google_client_secret.is_none() {
        config.google_client_secret = GOOGLE_CLIENT_SECRET.map(String::from);
    }
    if config.todoist_api_token.is_none() {
        config.todoist_api_token = TODOIST_API_TOKEN.map(String::from);
    }
    if config.gemini_api_key.is_none() {
        config.gemini_api_key = GEMINI_API_KEY.map(String::from);
    }
    config
}

/// Tauri command: Save API config.
#[tauri::command]
fn set_api_config(config: ApiConfig) -> Result<(), String> {
    save_config(&config)?;
    Ok(())
}

/// Tauri command: Check which API keys are configured.
#[tauri::command]
fn get_api_status() -> serde_json::Value {
    let config = get_api_config();
    serde_json::json!({
        "google_configured": config.google_client_id.is_some() && config.google_client_secret.is_some(),
        "todoist_configured": config.todoist_api_token.is_some(),
        "gemini_configured": config.gemini_api_key.is_some(),
        "auth_configured": config.auth_secret.is_some(),
    })
}

/// Tauri command: Restart the application.
#[tauri::command]
fn restart_app(app: tauri::AppHandle) {
    app.restart();
}

/// Find an available port, starting from the default.
/// Checks both 0.0.0.0 and 127.0.0.1 to ensure the port is truly free.
fn find_available_port(start_port: u16) -> Option<u16> {
    (start_port..start_port + 100).find(|&port| {
        // Check both interfaces since Next.js binds to 0.0.0.0
        TcpListener::bind(("0.0.0.0", port)).is_ok()
            && TcpListener::bind(("127.0.0.1", port)).is_ok()
    })
}

/// Check if the server is responding on the given port.
fn is_server_ready(port: u16) -> bool {
    std::net::TcpStream::connect_timeout(
        &format!("127.0.0.1:{}", port).parse().unwrap(),
        Duration::from_millis(100),
    )
    .is_ok()
}

/// Wait for the server to become ready, with timeout.
fn wait_for_server(port: u16) -> bool {
    let start = Instant::now();
    while start.elapsed() < SERVER_STARTUP_TIMEOUT {
        if is_server_ready(port) {
            return true;
        }
        std::thread::sleep(HEALTH_CHECK_INTERVAL);
    }
    false
}

/// Start the bundled Next.js server.
fn start_nextjs_server(resource_dir: PathBuf, port: u16) -> Result<Child, String> {
    // Paths to bundled resources (flattened structure)
    let node_path = resource_dir.join("resources/node");
    let server_path = resource_dir.join("resources/standalone/server.js");
    let cwd = resource_dir.join("resources/standalone");

    // Verify paths exist
    if !node_path.exists() {
        return Err(format!("Node.js binary not found at {:?}", node_path));
    }
    if !server_path.exists() {
        return Err(format!("Server not found at {:?}", server_path));
    }

    #[cfg(debug_assertions)]
    {
        println!("Node.js path: {:?}", node_path);
        println!("Server path: {:?}", server_path);
        println!("Working directory: {:?}", cwd);
        println!("Port: {}", port);
    }

    let mut cmd = Command::new(&node_path);
    cmd.arg(&server_path)
        .current_dir(&cwd)
        .env("PORT", port.to_string())
        .env("HOSTNAME", "127.0.0.1")
        // Auth.js requires these for localhost
        .env("AUTH_TRUST_HOST", "true")
        .env("AUTH_URL", format!("http://127.0.0.1:{}", port));

    // Configure stdio based on build type
    #[cfg(debug_assertions)]
    {
        cmd.stdout(Stdio::inherit()).stderr(Stdio::inherit());
    }
    #[cfg(not(debug_assertions))]
    {
        cmd.stdout(Stdio::null()).stderr(Stdio::null());
    }

    // Load config and apply environment variables
    let config = get_api_config();
    if let Some(v) = config.auth_secret {
        cmd.env("AUTH_SECRET", v);
    }
    if let Some(v) = config.google_client_id {
        cmd.env("GOOGLE_CLIENT_ID", v);
    }
    if let Some(v) = config.google_client_secret {
        cmd.env("GOOGLE_CLIENT_SECRET", v);
    }
    if let Some(v) = config.todoist_api_token {
        cmd.env("TODOIST_API_TOKEN", v);
    }
    if let Some(v) = config.gemini_api_key {
        cmd.env("GEMINI_API_KEY", v);
    }

    cmd.spawn().map_err(|e| format!("Failed to spawn server: {}", e))
}

/// Show an error dialog to the user.
fn show_error_dialog(window: &tauri::WebviewWindow, title: &str, message: &str) {
    let script = format!(
        r#"
        document.body.innerHTML = `
            <div style="
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%);
                color: white;
                font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;
                text-align: center;
                padding: 40px;
            ">
                <div style="
                    font-size: 48px;
                    margin-bottom: 24px;
                ">⚠️</div>
                <h1 style="
                    font-size: 24px;
                    font-weight: 300;
                    letter-spacing: 0.1em;
                    margin-bottom: 16px;
                ">{}</h1>
                <p style="
                    font-size: 14px;
                    opacity: 0.7;
                    max-width: 400px;
                    line-height: 1.6;
                ">{}</p>
                <button onclick="window.location.reload()" style="
                    margin-top: 32px;
                    padding: 12px 32px;
                    background: rgba(255,255,255,0.1);
                    border: 1px solid rgba(255,255,255,0.2);
                    border-radius: 8px;
                    color: white;
                    font-size: 14px;
                    cursor: pointer;
                ">Retry</button>
            </div>
        `;
        "#,
        title, message
    );
    let _ = window.eval(&script);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(ServerProcess(Mutex::new(None)))
        .manage(ServerPort(Mutex::new(DEFAULT_PORT)))
        .invoke_handler(tauri::generate_handler![
            get_api_config,
            set_api_config,
            get_api_status,
            restart_app,
        ])
        .setup(move |app| {
            // Find an available port
            let port = find_available_port(DEFAULT_PORT).unwrap_or(DEFAULT_PORT);

            // Store port for later access
            if let Some(state) = app.try_state::<ServerPort>() {
                if let Ok(mut guard) = state.0.lock() {
                    *guard = port;
                }
            }

            #[cfg(debug_assertions)]
            println!("Using port: {}", port);

            // Get resource directory path
            let resource_dir = app.path().resource_dir().map_err(|e| {
                format!("Failed to get resource directory: {}", e)
            })?;

            #[cfg(debug_assertions)]
            println!("Resource directory: {:?}", resource_dir);

            // Start the Next.js server
            match start_nextjs_server(resource_dir, port) {
                Ok(server) => {
                    if let Some(state) = app.try_state::<ServerProcess>() {
                        if let Ok(mut guard) = state.0.lock() {
                            *guard = Some(server);
                        }
                    }
                }
                Err(e) => {
                    eprintln!("Server start error: {}", e);
                    if let Some(window) = app.get_webview_window("main") {
                        show_error_dialog(
                            &window,
                            "Failed to Start",
                            &format!("Could not start the application server. {}", e),
                        );
                    }
                    return Ok(());
                }
            }

            // Wait for server readiness, then navigate
            let window = app.get_webview_window("main").ok_or("Main window not found")?;
            std::thread::spawn(move || {
                if wait_for_server(port) {
                    let url = format!("http://127.0.0.1:{}", port);

                    #[cfg(debug_assertions)]
                    println!("Server ready, navigating to: {}", url);

                    let _ = window.eval(&format!("window.location.href = '{}'", url));
                } else {
                    eprintln!("Server failed to become ready within timeout");
                    show_error_dialog(
                        &window,
                        "Server Timeout",
                        "The application server did not start in time. Please try again.",
                    );
                }
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                // Kill the Next.js server when the window is closed
                if let Some(state) = window.try_state::<ServerProcess>() {
                    if let Ok(mut guard) = state.0.lock() {
                        if let Some(mut child) = guard.take() {
                            #[cfg(debug_assertions)]
                            println!("Stopping Next.js server...");

                            let _ = child.kill();
                        }
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
