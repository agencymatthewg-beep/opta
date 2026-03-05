use reqwest::Url;
use semver::Version;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{collections::HashSet, fs, path::PathBuf, process::Stdio, time::Duration};
use tauri_plugin_updater::UpdaterExt;
use thiserror::Error;
use tokio::{io::AsyncReadExt, process::Command, time::timeout};
use tauri::Emitter;
use tokio::io::AsyncBufReadExt;

const CLI_COMMAND_TIMEOUT_SECS: u64 = 20;
const CLI_DISCOVERY_TIMEOUT_SECS: u64 = 5;
const ACCOUNT_LOGIN_WAIT_TIMEOUT_SECS: u64 = 15 * 60;
const ACCOUNT_LOGIN_FLOW_TIMEOUT_SECS: u64 = 10 * 60;
const ZERO_TOUCH_COMMAND_TIMEOUT_SECS: u64 = 10 * 60;
const BRAIN_INSTALL_COMMAND_TIMEOUT_SECS: u64 = 60 * 60;
const ACCOUNT_LOGIN_RETURN_TO_URL: &str = "opta-init://auth/callback";
const MANAGER_VERSION: &str = env!("CARGO_PKG_VERSION");
const UPDATER_ENDPOINT_ENV_STABLE: &str = "OPTA_INIT_UPDATER_ENDPOINT_STABLE";
const UPDATER_ENDPOINT_ENV_BETA: &str = "OPTA_INIT_UPDATER_ENDPOINT_BETA";
const DEFAULT_UPDATER_ENDPOINT_STABLE: &str =
    "https://init.optalocal.com/desktop-updates/stable.json";
const DEFAULT_UPDATER_ENDPOINT_BETA: &str =
    "https://init.optalocal.com/desktop-updates/beta.json";

fn extended_path() -> String {
    let mut path = std::env::var("PATH").unwrap_or_else(|_| String::new());
    
    #[cfg(target_os = "windows")]
    let delimiter = ";";
    #[cfg(not(target_os = "windows"))]
    let delimiter = ":";

    // Common global node_modules locations for macOS/Linux
    #[cfg(not(target_os = "windows"))]
    let extras = ["/usr/local/bin", "/opt/homebrew/bin", "/opt/homebrew/sbin"];
    #[cfg(target_os = "windows")]
    let extras: [&str; 0] = [];

    for p in extras {
        if !path.contains(p) {
            path = format!("{}{}{}", p, delimiter, path);
        }
    }

    if let Some(home) = dirs::home_dir() {
        #[cfg(not(target_os = "windows"))]
        {
            let local_bin = home.join(".local").join("bin");
            if let Some(p) = local_bin.to_str() {
                if !path.contains(p) {
                    path = format!("{}{}{}", p, delimiter, path);
                }
            }
        }

        let opta_npm_prefix = home.join(".opta-init").join("npm-global");
        let opta_npm_bin = opta_npm_prefix.join("bin");
        for candidate in [opta_npm_bin, opta_npm_prefix] {
            if let Some(p) = candidate.to_str() {
                if !path.contains(p) {
                    path = format!("{}{}{}", p, delimiter, path);
                }
            }
        }

        // Handle Unix .npm-global
        #[cfg(not(target_os = "windows"))]
        let npm_global = home.join(".npm-global").join("bin");
        // Handle Windows npm global directory (usually AppData\Roaming\npm)
        #[cfg(target_os = "windows")]
        let npm_global = home.join("AppData").join("Roaming").join("npm");

        if let Some(p) = npm_global.to_str() {
            if !path.contains(p) {
                path = format!("{}{}{}", p, delimiter, path);
            }
        }
    }

    path
}

#[derive(Debug, Error)]
enum ManagerError {
    #[error("required CLI `{0}` was not found in PATH")]
    MissingCli(String),
    #[error("command wait failed: {detail}")]
    Wait { detail: String },
    #[error("command timed out after {0} seconds")]
    Timeout(u64),
    #[error("failed to run command `{command}`: {detail}")]
    Spawn { command: String, detail: String },
    #[error("command `{command}` failed (exit code: {code:?}): {stderr}")]
    CommandFailed {
        command: String,
        code: Option<i32>,
        stderr: String,
    },
    #[error("command `{command}` timed out after {seconds}s")]
    CommandTimedOut { command: String, seconds: u64 },
    #[error("network request failed: {0}")]
    Network(String),
    #[error("failed to open URL: {0}")]
    UrlOpen(String),
    #[error("{0}")]
    PolicyViolation(String),
    #[error("invalid URL: {0}")]
    InvalidUrl(String),
}

#[derive(Debug)]
struct CapturedOutput {
    command: String,
    exit_code: Option<i32>,
    success: bool,
    stdout: String,
    stderr: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct CommandOutcome {
    ok: bool,
    command: String,
    exit_code: Option<i32>,
    stdout: String,
    stderr: String,
    message: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ManagerUpdateStatus {
    current_version: String,
    channel: String,
    endpoint_used: String,
    available: bool,
    latest_version: Option<String>,
    release_notes: Option<String>,
    release_date: Option<String>,
    warnings: Vec<String>,
    error: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ManagerUpdateInstallOutcome {
    ok: bool,
    installed: bool,
    current_version: String,
    channel: String,
    endpoint_used: String,
    latest_version: Option<String>,
    release_notes: Option<String>,
    release_date: Option<String>,
    warnings: Vec<String>,
    message: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
struct AppCommands {
    install: Option<Vec<String>>,
    update: Option<Vec<String>>,
    launch: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ManifestApp {
    id: String,
    name: String,
    description: String,
    version: String,
    website: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    min_manager_version: Option<String>,
    commands: Option<AppCommands>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ManifestPayload {
    channel: String,
    updated_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    release_min_manager_version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    release_notes_url: Option<String>,
    apps: Vec<ManifestApp>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ReleaseControlManifest {
    channel: String,
    published_at: Option<String>,
    release: Option<ReleaseControlRelease>,
    components: Vec<ReleaseControlComponent>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ReleaseControlComponent {
    id: String,
    display_name: Option<String>,
    version: String,
    min_manager_version: Option<String>,
    artifacts: Option<ReleaseControlArtifacts>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ReleaseControlRelease {
    id: String,
    notes_url: Option<String>,
    min_manager_version: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
struct ReleaseControlArtifacts {
    macos: Option<Vec<ReleaseControlArtifact>>,
    windows: Option<Vec<ReleaseControlArtifact>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ReleaseControlArtifact {
    platform: String,
    arch: String,
    package_type: String,
    url: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ManifestResponse {
    manifest: ManifestPayload,
    source: String,
    warning: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct InstalledApp {
    id: String,
    name: String,
    path: String,
    version: Option<String>,
    source: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct DaemonStatus {
    running: bool,
    message: String,
    raw_output: String,
    checked_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct DaemonJob {
    id: String,
    cmd: String,
    pid: Option<u32>,
    status: String,
    uptime: Option<String>,
    exit_code: Option<i32>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CLIStatePayload {
    port: u16,
    token: String,
    host: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CLIDaemonStatusPayload {
    running: bool,
    state: Option<CLIStatePayload>,
}

fn current_timestamp() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};

    match SystemTime::now().duration_since(UNIX_EPOCH) {
        Ok(duration) => duration.as_secs().to_string(),
        Err(_) => "0".to_string(),
    }
}

fn command_preview(program: &str, args: &[String]) -> String {
    if args.is_empty() {
        program.to_string()
    } else {
        format!("{} {}", program, args.join(" "))
    }
}

async fn is_command_available(program: &str) -> bool {
    let status_result = timeout(
        Duration::from_secs(CLI_DISCOVERY_TIMEOUT_SECS),
        Command::new(program)
            .env("PATH", extended_path())
            .arg("--version")
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status(),
    )
    .await;

    matches!(status_result, Ok(Ok(status)) if status.success())
}

async fn run_command_capture(
    program: &str,
    args: &[String],
) -> Result<CapturedOutput, ManagerError> {
    run_command_capture_with_timeout(program, args, CLI_COMMAND_TIMEOUT_SECS).await
}

async fn run_command_capture_with_timeout(
    program: &str,
    args: &[String],
    timeout_secs: u64,
) -> Result<CapturedOutput, ManagerError> {
    let cmd_preview = command_preview(program, args);
    let mut child = Command::new(program)
        .env("PATH", extended_path())
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| ManagerError::Spawn {
            command: cmd_preview.clone(),
            detail: error.to_string(),
        })?;

    let stdout_reader = child.stdout.take().map(|mut stdout| {
        tokio::spawn(async move {
            let mut buf = Vec::new();
            let _ = stdout.read_to_end(&mut buf).await;
            buf
        })
    });

    let stderr_reader = child.stderr.take().map(|mut stderr| {
        tokio::spawn(async move {
            let mut buf = Vec::new();
            let _ = stderr.read_to_end(&mut buf).await;
            buf
        })
    });

    let status = match timeout(Duration::from_secs(timeout_secs), child.wait()).await {
        Ok(result) => result.map_err(|error| ManagerError::Spawn {
            command: cmd_preview.clone(),
            detail: error.to_string(),
        })?,
        Err(_) => {
            let _ = child.start_kill();
            let _ = child.wait().await;
            return Err(ManagerError::CommandTimedOut {
                command: cmd_preview,
                seconds: timeout_secs,
            });
        }
    };

    let stdout_bytes = match stdout_reader {
        Some(handle) => handle.await.unwrap_or_default(),
        None => Vec::new(),
    };

    let stderr_bytes = match stderr_reader {
        Some(handle) => handle.await.unwrap_or_default(),
        None => Vec::new(),
    };

    Ok(CapturedOutput {
        command: cmd_preview,
        exit_code: status.code(),
        success: status.success(),
        stdout: String::from_utf8_lossy(&stdout_bytes).trim().to_string(),
        stderr: String::from_utf8_lossy(&stderr_bytes).trim().to_string(),
    })
}

fn outcome_from_success(captured: CapturedOutput, action_message: &str) -> CommandOutcome {
    CommandOutcome {
        ok: true,
        command: captured.command,
        exit_code: captured.exit_code,
        stdout: captured.stdout,
        stderr: captured.stderr,
        message: action_message.to_string(),
    }
}

fn normalize_channel(channel: &str) -> String {
    if channel.eq_ignore_ascii_case("beta") {
        "beta".to_string()
    } else {
        "stable".to_string()
    }
}


#[derive(Clone, Serialize)]
struct ProgressPayload {
    app_id: String,
    line: String,
}

async fn run_command_stream(
    app: &tauri::AppHandle,
    app_id: &str,
    program: &str,
    args: &[String],
) -> Result<CapturedOutput, ManagerError> {
    let cmd_preview = command_preview(program, args);
    let mut child = Command::new(program)
        .env("PATH", extended_path())
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| ManagerError::Spawn {
            command: cmd_preview.clone(),
            detail: error.to_string(),
        })?;

    let app_handle = app.clone();
    let app_id_clone = app_id.to_string();
    
    let stdout_reader = child.stdout.take().map(|stdout| {
        tokio::spawn(async move {
            let mut reader = tokio::io::BufReader::new(stdout).lines();
            let mut full_output = String::new();
            while let Ok(Some(line)) = reader.next_line().await {
                let _ = app_handle.emit("cmd-progress", ProgressPayload {
                    app_id: app_id_clone.clone(),
                    line: line.clone(),
                });
                full_output.push_str(&line);
                full_output.push('\n');
            }
            full_output.into_bytes()
        })
    });

    let stderr_reader = child.stderr.take().map(|mut stderr| {
        tokio::spawn(async move {
            let mut buf = Vec::new();
            let _ = stderr.read_to_end(&mut buf).await;
            buf
        })
    });

    let status = match timeout(Duration::from_secs(CLI_COMMAND_TIMEOUT_SECS * 10), child.wait()).await {
        Ok(Ok(status)) => status,
        Ok(Err(e)) => return Err(ManagerError::Wait { detail: e.to_string() }),
        Err(_) => {
            let _ = child.kill().await;
            return Err(ManagerError::Timeout(CLI_COMMAND_TIMEOUT_SECS * 10));
        }
    };

    let mut stdout_bytes = Vec::new();
    if let Some(reader) = stdout_reader {
        if let Ok(bytes) = reader.await {
            stdout_bytes = bytes;
        }
    }

    let mut stderr_bytes = Vec::new();
    if let Some(reader) = stderr_reader {
        if let Ok(bytes) = reader.await {
            stderr_bytes = bytes;
        }
    }

    let captured = CapturedOutput {
        command: cmd_preview,
        success: status.success(),
        exit_code: status.code(),
        stdout: String::from_utf8_lossy(&stdout_bytes).into_owned(),
        stderr: String::from_utf8_lossy(&stderr_bytes).into_owned(),
    };

    Ok(captured)
}

fn emit_progress_line(
    app: &tauri::AppHandle,
    event: &str,
    step: &str,
    line: impl Into<String>,
    ok: Option<bool>,
) {
    let line = line.into();
    let payload = match ok {
        Some(ok) => serde_json::json!({ "step": step, "line": line, "ok": ok }),
        None => serde_json::json!({ "step": step, "line": line }),
    };
    let _ = app.emit(event, payload);
}

fn emit_captured_progress(
    app: &tauri::AppHandle,
    event: &str,
    step: &str,
    captured: &CapturedOutput,
) {
    for line in captured.stdout.lines() {
        let trimmed = line.trim();
        if !trimmed.is_empty() {
            emit_progress_line(app, event, step, trimmed.to_string(), None);
        }
    }
    for line in captured.stderr.lines() {
        let trimmed = line.trim();
        if !trimmed.is_empty() {
            emit_progress_line(app, event, step, format!("stderr: {}", trimmed), None);
        }
    }
}

fn command_error_message(captured: &CapturedOutput, fallback: &str) -> String {
    if !captured.stderr.trim().is_empty() {
        captured.stderr.trim().to_string()
    } else if !captured.stdout.trim().is_empty() {
        captured.stdout.trim().to_string()
    } else {
        fallback.to_string()
    }
}

fn push_step_result(
    steps: &mut Vec<Value>,
    name: &str,
    ok: bool,
    message: String,
    command: Option<String>,
    stdout: Option<String>,
    stderr: Option<String>,
) {
    let mut entry = serde_json::Map::new();
    entry.insert("name".to_string(), serde_json::json!(name));
    entry.insert("ok".to_string(), serde_json::json!(ok));
    entry.insert("message".to_string(), serde_json::json!(message));

    if let Some(command) = command {
        if !command.trim().is_empty() {
            entry.insert("command".to_string(), serde_json::json!(command));
        }
    }

    if let Some(stdout) = stdout {
        if !stdout.trim().is_empty() {
            entry.insert("stdout".to_string(), serde_json::json!(stdout));
        }
    }

    if let Some(stderr) = stderr {
        if !stderr.trim().is_empty() {
            entry.insert("stderr".to_string(), serde_json::json!(stderr));
        }
    }

    steps.push(Value::Object(entry));
}

async fn run_command_step(
    app: &tauri::AppHandle,
    event: &str,
    step: &str,
    program: &str,
    args: &[String],
    timeout_secs: u64,
) -> Result<CapturedOutput, String> {
    let preview = command_preview(program, args);
    emit_progress_line(
        app,
        event,
        step,
        format!("Running: {}", preview),
        None,
    );

    let captured = run_command_capture_with_timeout(program, args, timeout_secs)
        .await
        .map_err(|error| {
            let message = format!("Failed to run `{}`: {}", preview, error);
            emit_progress_line(app, event, step, message.clone(), Some(false));
            message
        })?;

    emit_captured_progress(app, event, step, &captured);
    Ok(captured)
}

fn default_tunnel_name(lmx_host: &str, lmx_port: u16) -> String {
    let raw = format!("opta-lmx-{}-{}", lmx_host, lmx_port);
    let mut normalized = raw
        .chars()
        .map(|char| {
            if char.is_ascii_alphanumeric() {
                char.to_ascii_lowercase()
            } else {
                '-'
            }
        })
        .collect::<String>();

    while normalized.contains("--") {
        normalized = normalized.replace("--", "-");
    }

    normalized = normalized.trim_matches('-').to_string();

    if normalized.is_empty() {
        normalized = format!("opta-lmx-{}", lmx_port);
    }

    normalized.chars().take(63).collect()
}

fn normalize_optional_channel(channel: Option<String>) -> String {
    normalize_channel(channel.as_deref().unwrap_or("stable"))
}

fn opta_cli_prefix_dir() -> Option<PathBuf> {
    let home = dirs::home_dir()?;
    Some(home.join(".opta-init").join("npm-global"))
}

fn prepend_args(prefix: &[String], args: &[String]) -> Vec<String> {
    let mut full = Vec::with_capacity(prefix.len() + args.len());
    full.extend(prefix.iter().cloned());
    full.extend(args.iter().cloned());
    full
}

async fn find_python_command() -> Option<String> {
    for candidate in ["python3", "python"] {
        if is_command_available(candidate).await {
            return Some(candidate.to_string());
        }
    }
    None
}

async fn resolve_opta_cli_package_spec(channel: &str) -> String {
    if let Ok(manifest) = fetch_release_manifest_for_channel(channel).await {
        if let Some(component) = manifest
            .components
            .iter()
            .find(|component| component.id == "opta-cli")
        {
            if let Some(url) = select_installer_url(component) {
                return url;
            }
        }
    }

    "https://init.optalocal.com/downloads/opta-cli/latest".to_string()
}

async fn ensure_npm_available_for_zero_touch(
    app: &tauri::AppHandle,
    event: &str,
    step: &str,
) -> Result<String, String> {
    if is_command_available("npm").await {
        return Ok("npm".to_string());
    }

    emit_progress_line(
        app,
        event,
        step,
        "npm is not available. Attempting to install Node.js runtime...",
        None,
    );

    let mut attempts: Vec<(String, Vec<String>)> = Vec::new();
    match std::env::consts::OS {
        "macos" => {
            if is_command_available("brew").await {
                attempts.push((
                    "brew".to_string(),
                    vec!["install".to_string(), "node".to_string()],
                ));
            }
        }
        "windows" => {
            if is_command_available("winget").await {
                attempts.push((
                    "winget".to_string(),
                    vec![
                        "install".to_string(),
                        "--id".to_string(),
                        "OpenJS.NodeJS.LTS".to_string(),
                        "-e".to_string(),
                        "--accept-package-agreements".to_string(),
                        "--accept-source-agreements".to_string(),
                    ],
                ));
            }
        }
        "linux" => {
            if is_command_available("sudo").await && is_command_available("apt-get").await {
                attempts.push((
                    "sudo".to_string(),
                    vec![
                        "-n".to_string(),
                        "apt-get".to_string(),
                        "install".to_string(),
                        "-y".to_string(),
                        "nodejs".to_string(),
                        "npm".to_string(),
                    ],
                ));
            }
            if is_command_available("apt-get").await {
                attempts.push((
                    "apt-get".to_string(),
                    vec![
                        "install".to_string(),
                        "-y".to_string(),
                        "nodejs".to_string(),
                        "npm".to_string(),
                    ],
                ));
            }
            if is_command_available("sudo").await && is_command_available("dnf").await {
                attempts.push((
                    "sudo".to_string(),
                    vec![
                        "-n".to_string(),
                        "dnf".to_string(),
                        "install".to_string(),
                        "-y".to_string(),
                        "nodejs".to_string(),
                        "npm".to_string(),
                    ],
                ));
            }
            if is_command_available("dnf").await {
                attempts.push((
                    "dnf".to_string(),
                    vec![
                        "install".to_string(),
                        "-y".to_string(),
                        "nodejs".to_string(),
                        "npm".to_string(),
                    ],
                ));
            }
            if is_command_available("sudo").await && is_command_available("pacman").await {
                attempts.push((
                    "sudo".to_string(),
                    vec![
                        "-n".to_string(),
                        "pacman".to_string(),
                        "-S".to_string(),
                        "--noconfirm".to_string(),
                        "nodejs".to_string(),
                        "npm".to_string(),
                    ],
                ));
            }
            if is_command_available("pacman").await {
                attempts.push((
                    "pacman".to_string(),
                    vec![
                        "-S".to_string(),
                        "--noconfirm".to_string(),
                        "nodejs".to_string(),
                        "npm".to_string(),
                    ],
                ));
            }
        }
        _ => {}
    }

    for (program, args) in attempts {
        let captured = match run_command_step(
            app,
            event,
            step,
            &program,
            &args,
            ZERO_TOUCH_COMMAND_TIMEOUT_SECS,
        )
        .await
        {
            Ok(result) => result,
            Err(_) => continue,
        };

        if captured.success && is_command_available("npm").await {
            emit_progress_line(
                app,
                event,
                step,
                "Node.js runtime installed successfully.",
                Some(true),
            );
            return Ok("npm".to_string());
        }
    }

    Err("Unable to install Node.js/npm automatically on this system.".to_string())
}

fn updater_endpoint_env_key(channel: &str) -> &'static str {
    match channel {
        "beta" => UPDATER_ENDPOINT_ENV_BETA,
        _ => UPDATER_ENDPOINT_ENV_STABLE,
    }
}

fn default_updater_endpoint(channel: &str) -> &'static str {
    match channel {
        "beta" => DEFAULT_UPDATER_ENDPOINT_BETA,
        _ => DEFAULT_UPDATER_ENDPOINT_STABLE,
    }
}

fn is_http_endpoint(value: &str) -> bool {
    let normalized = value.trim().to_ascii_lowercase();
    normalized.starts_with("https://") || normalized.starts_with("http://")
}

fn resolve_updater_endpoint(channel: &str) -> (String, Vec<String>) {
    let mut warnings = Vec::new();
    let env_key = updater_endpoint_env_key(channel);
    let fallback = default_updater_endpoint(channel).to_string();

    match std::env::var(env_key) {
        Ok(value) => {
            let trimmed = value.trim();
            if trimmed.is_empty() {
                warnings.push(format!(
                    "Environment variable `{}` is empty. Using fallback endpoint.",
                    env_key
                ));
                (fallback, warnings)
            } else if !is_http_endpoint(trimmed) {
                warnings.push(format!(
                    "Environment variable `{}` is invalid. Use an http/https URL. Using fallback endpoint.",
                    env_key
                ));
                (fallback, warnings)
            } else {
                (trimmed.to_string(), warnings)
            }
        }
        Err(_) => (fallback, warnings),
    }
}

fn default_manifest(channel: &str) -> ManifestPayload {
    ManifestPayload {
        channel: channel.to_string(),
        updated_at: Some(current_timestamp()),
        release_min_manager_version: None,
        release_notes_url: None,
        apps: vec![
            ManifestApp {
                id: "opta-cli".to_string(),
                name: "Opta CLI".to_string(),
                description:
                    "Command-line interface for install/update and workflow orchestration."
                        .to_string(),
                version: "fallback".to_string(),
                website: Some("https://init.optalocal.com/downloads/opta-cli/latest".to_string()),
                min_manager_version: None,
                commands: Some(AppCommands {
                    install: Some(vec![
                        "opta".to_string(),
                        "apps".to_string(),
                        "install".to_string(),
                        "opta-cli".to_string(),
                    ]),
                    update: Some(vec![
                        "opta".to_string(),
                        "apps".to_string(),
                        "update".to_string(),
                        "opta-cli".to_string(),
                    ]),
                    launch: Some(vec![
                        "opta".to_string(),
                        "apps".to_string(),
                        "launch".to_string(),
                        "opta-cli".to_string(),
                    ]),
                }),
            },
            ManifestApp {
                id: "opta-lmx".to_string(),
                name: "Opta LMX Runtime".to_string(),
                description: "Model exchange and artifact orchestration runtime.".to_string(),
                version: "fallback".to_string(),
                website: Some("https://lmx.optalocal.com".to_string()),
                min_manager_version: None,
                commands: Some(AppCommands {
                    install: Some(vec![
                        "opta".to_string(),
                        "apps".to_string(),
                        "install".to_string(),
                        "opta-lmx".to_string(),
                    ]),
                    update: Some(vec![
                        "opta".to_string(),
                        "apps".to_string(),
                        "update".to_string(),
                        "opta-lmx".to_string(),
                    ]),
                    launch: Some(vec![
                        "opta".to_string(),
                        "apps".to_string(),
                        "launch".to_string(),
                        "opta-lmx".to_string(),
                    ]),
                }),
            },
            ManifestApp {
                id: "opta-code-universal".to_string(),
                name: "Opta Code Universal".to_string(),
                description: "Desktop coding surface for Opta operator workflows.".to_string(),
                version: "fallback".to_string(),
                website: Some("https://init.optalocal.com/apps/opta-code".to_string()),
                min_manager_version: None,
                commands: Some(AppCommands {
                    install: Some(vec![
                        "opta".to_string(),
                        "apps".to_string(),
                        "install".to_string(),
                        "opta-code-universal".to_string(),
                    ]),
                    update: Some(vec![
                        "opta".to_string(),
                        "apps".to_string(),
                        "update".to_string(),
                        "opta-code-universal".to_string(),
                    ]),
                    launch: Some(vec![
                        "opta".to_string(),
                        "apps".to_string(),
                        "launch".to_string(),
                        "opta-code-universal".to_string(),
                    ]),
                }),
            },
            ManifestApp {
                id: "opta-daemon".to_string(),
                name: "Opta Daemon Service".to_string(),
                description: "Background daemon required for local runtime services.".to_string(),
                version: "fallback".to_string(),
                website: Some("https://docs.optalocal.com/daemon".to_string()),
                min_manager_version: None,
                commands: Some(AppCommands {
                    install: Some(vec![
                        "opta".to_string(),
                        "apps".to_string(),
                        "install".to_string(),
                        "opta-daemon".to_string(),
                    ]),
                    update: Some(vec![
                        "opta".to_string(),
                        "apps".to_string(),
                        "update".to_string(),
                        "opta-daemon".to_string(),
                    ]),
                    launch: Some(vec![
                        "opta".to_string(),
                        "apps".to_string(),
                        "launch".to_string(),
                        "opta-daemon".to_string(),
                    ]),
                }),
            },
        ],
    }
}

fn release_component_name(id: &str) -> String {
    match id {
        "opta-cli" => "Opta CLI".to_string(),
        "opta-lmx" => "Opta LMX Runtime".to_string(),
        "opta-code-universal" => "Opta Code Universal".to_string(),
        "opta-daemon" => "Opta Daemon Service".to_string(),
        _ => id.to_string(),
    }
}

fn release_component_description(id: &str) -> String {
    match id {
        "opta-cli" => {
            "Command-line interface for install/update and workflow orchestration.".to_string()
        }
        "opta-lmx" => "Model exchange and artifact orchestration runtime.".to_string(),
        "opta-code-universal" => "Desktop coding surface for Opta operator workflows.".to_string(),
        "opta-daemon" => "Background daemon required for local runtime services.".to_string(),
        _ => "Managed Opta component.".to_string(),
    }
}

fn release_component_website(id: &str) -> Option<String> {
    match id {
        "opta-cli" => Some("https://init.optalocal.com/downloads/opta-cli/latest".to_string()),
        "opta-lmx" => Some("https://lmx.optalocal.com".to_string()),
        "opta-code-universal" => Some("https://init.optalocal.com/apps/opta-code".to_string()),
        "opta-daemon" => Some("https://docs.optalocal.com/daemon".to_string()),
        _ => None,
    }
}

fn release_component_commands(id: &str) -> AppCommands {
    AppCommands {
        install: Some(vec![
            "opta".to_string(),
            "apps".to_string(),
            "install".to_string(),
            id.to_string(),
        ]),
        update: Some(vec![
            "opta".to_string(),
            "apps".to_string(),
            "update".to_string(),
            id.to_string(),
        ]),
        launch: Some(vec![
            "opta".to_string(),
            "apps".to_string(),
            "launch".to_string(),
            id.to_string(),
        ]),
    }
}

fn release_manifest_to_manager_manifest(
    mut release_manifest: ReleaseControlManifest,
    fallback_channel: &str,
) -> ManifestPayload {
    if release_manifest.channel.is_empty() {
        release_manifest.channel = fallback_channel.to_string();
    }

    let release_min_manager_version = release_manifest
        .release
        .as_ref()
        .and_then(|release| release.min_manager_version.clone());
    let release_notes_url = release_manifest
        .release
        .as_ref()
        .and_then(|release| release.notes_url.clone());

    let apps = release_manifest
        .components
        .into_iter()
        .map(|component| {
            let name = component
                .display_name
                .clone()
                .filter(|value| !value.trim().is_empty())
                .unwrap_or_else(|| release_component_name(&component.id));

            ManifestApp {
                id: component.id.clone(),
                name,
                description: release_component_description(&component.id),
                version: component.version,
                website: release_component_website(&component.id),
                min_manager_version: component.min_manager_version,
                commands: Some(release_component_commands(&component.id)),
            }
        })
        .collect();

    ManifestPayload {
        channel: release_manifest.channel,
        updated_at: release_manifest.published_at,
        release_min_manager_version,
        release_notes_url,
        apps,
    }
}

fn normalize_release_manifest(
    value: Value,
    fallback_channel: &str,
) -> Option<ReleaseControlManifest> {
    if let Ok(mut release_manifest) =
        serde_json::from_value::<ReleaseControlManifest>(value.clone())
    {
        if release_manifest.channel.is_empty() {
            release_manifest.channel = fallback_channel.to_string();
        }
        return Some(release_manifest);
    }

    if let Some(manifest_value) = value.get("manifest") {
        if let Ok(mut release_manifest) =
            serde_json::from_value::<ReleaseControlManifest>(manifest_value.clone())
        {
            if release_manifest.channel.is_empty() {
                release_manifest.channel = fallback_channel.to_string();
            }
            return Some(release_manifest);
        }
    }

    None
}

fn parse_manager_version() -> Result<Version, ManagerError> {
    Version::parse(MANAGER_VERSION).map_err(|error| {
        ManagerError::PolicyViolation(format!(
            "Manager version `{}` is not valid semver: {}",
            MANAGER_VERSION, error
        ))
    })
}

fn evaluate_manifest_policy(manifest: &ManifestPayload) -> Result<Option<String>, ManagerError> {
    let manager_version = parse_manager_version()?;
    let mut warnings: Vec<String> = Vec::new();

    if let Some(release_min) = manifest.release_min_manager_version.as_deref() {
        match Version::parse(release_min) {
            Ok(required_version) => {
                if manager_version < required_version {
                    let mut details = format!(
                        "Opta Init manager v{} is below required release minimum v{}. Update the desktop manager and retry.",
                        MANAGER_VERSION, required_version
                    );
                    if let Some(notes_url) = manifest.release_notes_url.as_deref() {
                        details.push_str(&format!(" Release notes: {}", notes_url));
                    }
                    return Err(ManagerError::PolicyViolation(details));
                }
            }
            Err(error) => warnings.push(format!(
                "Manifest release minimum manager version `{}` is invalid ({}).",
                release_min, error
            )),
        }
    }

    let mut blocked_components: Vec<String> = Vec::new();
    for app in &manifest.apps {
        let Some(component_min) = app.min_manager_version.as_deref() else {
            continue;
        };

        match Version::parse(component_min) {
            Ok(required_version) => {
                if manager_version < required_version {
                    blocked_components.push(format!(
                        "{} (`{}`) requires manager >= {}",
                        app.name, app.id, required_version
                    ));
                }
            }
            Err(error) => warnings.push(format!(
                "Component `{}` has invalid minManagerVersion `{}` ({}).",
                app.id, component_min, error
            )),
        }
    }

    if !blocked_components.is_empty() {
        warnings.push(format!(
            "Manager v{} is older than component requirements. Blocked components: {}. Update Opta Init to unlock these installs/updates.",
            MANAGER_VERSION,
            blocked_components.join("; ")
        ));
    }

    if warnings.is_empty() {
        Ok(None)
    } else {
        Ok(Some(warnings.join(" ")))
    }
}

async fn enforce_component_policy_if_available(
    channel: &str,
    app_id: &str,
) -> Result<(), ManagerError> {
    let release_manifest = match fetch_release_manifest_for_channel(channel).await {
        Ok(manifest) => manifest,
        Err(_) => return Ok(()),
    };

    let manifest = release_manifest_to_manager_manifest(release_manifest, channel);
    let manager_version = parse_manager_version()?;

    if let Some(release_min) = manifest.release_min_manager_version.as_deref() {
        let required_version = Version::parse(release_min).map_err(|error| {
            ManagerError::PolicyViolation(format!(
                "Release minimum manager version `{}` is invalid: {}",
                release_min, error
            ))
        })?;
        if manager_version < required_version {
            let mut details = format!(
                "Opta Init manager v{} is below required release minimum v{}. Update the desktop manager and retry.",
                MANAGER_VERSION, required_version
            );
            if let Some(notes_url) = manifest.release_notes_url.as_deref() {
                details.push_str(&format!(" Release notes: {}", notes_url));
            }
            return Err(ManagerError::PolicyViolation(details));
        }
    }

    if let Some(component) = manifest
        .apps
        .iter()
        .find(|component| component.id == app_id)
    {
        if let Some(component_min) = component.min_manager_version.as_deref() {
            let required_version = Version::parse(component_min).map_err(|error| {
                ManagerError::PolicyViolation(format!(
                    "Component `{}` minManagerVersion `{}` is invalid: {}",
                    component.id, component_min, error
                ))
            })?;
            if manager_version < required_version {
                return Err(ManagerError::PolicyViolation(format!(
                    "Component `{}` requires manager >= {} (current {}). Update Opta Init and retry.",
                    component.id, required_version, MANAGER_VERSION
                )));
            }
        }
    }

    Ok(())
}

fn normalize_manifest_payload(value: Value, fallback_channel: &str) -> Option<ManifestPayload> {
    if let Ok(mut manifest) = serde_json::from_value::<ManifestPayload>(value.clone()) {
        if manifest.channel.is_empty() {
            manifest.channel = fallback_channel.to_string();
        }
        return Some(manifest);
    }

    if let Some(manifest_value) = value.get("manifest") {
        if let Ok(mut manifest) = serde_json::from_value::<ManifestPayload>(manifest_value.clone())
        {
            if manifest.channel.is_empty() {
                manifest.channel = fallback_channel.to_string();
            }
            return Some(manifest);
        }
    }

    if let Ok(release_manifest) = serde_json::from_value::<ReleaseControlManifest>(value.clone()) {
        return Some(release_manifest_to_manager_manifest(
            release_manifest,
            fallback_channel,
        ));
    }

    if let Some(manifest_value) = value.get("manifest") {
        if let Ok(release_manifest) =
            serde_json::from_value::<ReleaseControlManifest>(manifest_value.clone())
        {
            return Some(release_manifest_to_manager_manifest(
                release_manifest,
                fallback_channel,
            ));
        }
    }

    None
}

fn manifest_url_for(channel: &str, custom: Option<String>) -> String {
    if let Some(url) = custom {
        let trimmed = url.trim();
        if !trimmed.is_empty() {
            return trimmed.to_string();
        }
    }

    if let Ok(base_url) = std::env::var("OPTA_INIT_MANIFEST_BASE_URL") {
        let base = base_url.trim().trim_end_matches('/');
        if !base.is_empty() {
            return match channel {
                "beta" => format!("{}/desktop/manifest-beta.json", base),
                _ => format!("{}/desktop/manifest-stable.json", base),
            };
        }
    }

    match channel {
        "beta" => "https://init.optalocal.com/desktop/manifest-beta.json".to_string(),
        _ => "https://init.optalocal.com/desktop/manifest-stable.json".to_string(),
    }
}

fn parse_http_url(url: &str) -> Result<Url, ManagerError> {
    let parsed_url =
        Url::parse(url.trim()).map_err(|error| ManagerError::InvalidUrl(error.to_string()))?;
    if parsed_url.scheme() != "http" && parsed_url.scheme() != "https" {
        return Err(ManagerError::InvalidUrl(
            "Only http/https URLs are allowed".to_string(),
        ));
    }
    Ok(parsed_url)
}

fn manager_http_client() -> Result<reqwest::Client, ManagerError> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|error| ManagerError::Network(error.to_string()))
}

async fn fetch_manifest_value(url: &str) -> Result<Value, ManagerError> {
    let parsed_url = parse_http_url(url)?;
    let client = manager_http_client()?;
    let response = client
        .get(parsed_url)
        .send()
        .await
        .map_err(|error| ManagerError::Network(error.to_string()))?;

    if !response.status().is_success() {
        return Err(ManagerError::Network(format!(
            "manifest request returned HTTP {}",
            response.status()
        )));
    }

    let body = response
        .text()
        .await
        .map_err(|error| ManagerError::Network(error.to_string()))?;
    serde_json::from_str::<Value>(&body)
        .map_err(|error| ManagerError::Network(format!("manifest JSON parse failed: {}", error)))
}

async fn fetch_release_manifest_for_channel(
    channel: &str,
) -> Result<ReleaseControlManifest, ManagerError> {
    let manifest_value = fetch_manifest_value(&manifest_url_for(channel, None)).await?;
    normalize_release_manifest(manifest_value, channel).ok_or_else(|| {
        ManagerError::Network("release manifest payload did not match expected schema".to_string())
    })
}

fn current_platform_key() -> Option<&'static str> {
    #[cfg(target_os = "macos")]
    {
        return Some("macos");
    }

    #[cfg(target_os = "windows")]
    {
        return Some("windows");
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        None
    }
}

fn current_arch_key() -> &'static str {
    match std::env::consts::ARCH {
        "x86_64" => "x64",
        "aarch64" => "arm64",
        other => other,
    }
}

fn select_installer_url(component: &ReleaseControlComponent) -> Option<String> {
    let platform_key = current_platform_key()?;
    let artifacts = component.artifacts.as_ref()?;
    let platform_artifacts = match platform_key {
        "macos" => artifacts.macos.as_ref(),
        "windows" => artifacts.windows.as_ref(),
        _ => None,
    }?;

    let arch_key = current_arch_key();
    let selected = platform_artifacts
        .iter()
        .find(|artifact| artifact.arch.eq_ignore_ascii_case(arch_key))
        .or_else(|| {
            platform_artifacts
                .iter()
                .find(|artifact| artifact.arch.eq_ignore_ascii_case("universal"))
        })
        .or_else(|| {
            platform_artifacts
                .iter()
                .find(|artifact| !artifact.url.trim().is_empty())
        })?;

    parse_http_url(selected.url.as_str()).ok()?;
    Some(selected.url.clone())
}

fn open_http_url(url: &str) -> Result<(), ManagerError> {
    let parsed = parse_http_url(url)?;
    webbrowser::open(parsed.as_str()).map_err(|error| ManagerError::UrlOpen(error.to_string()))?;
    Ok(())
}

async fn bootstrap_opta_cli_install(channel: &str) -> Result<CommandOutcome, ManagerError> {
    let release_manifest = match fetch_release_manifest_for_channel(channel).await {
        Ok(manifest) => manifest,
        Err(_) => {
            let fallback_url = "https://init.optalocal.com/downloads/opta-cli/latest";
            open_http_url(fallback_url)?;
            return Ok(CommandOutcome {
                ok: true,
                command: format!("open {}", fallback_url),
                exit_code: None,
                stdout: String::new(),
                stderr: String::new(),
                message: "Opta CLI is missing. Opened generic download page because release manifest was unavailable."
                    .to_string(),
            });
        }
    };
    let Some(component) = release_manifest
        .components
        .iter()
        .find(|component| component.id == "opta-cli")
    else {
        return Err(ManagerError::PolicyViolation(
            "Release manifest does not contain component `opta-cli`. Download Opta CLI manually from https://init.optalocal.com/downloads/opta-cli/latest.".to_string(),
        ));
    };

    let Some(installer_url) = select_installer_url(component) else {
        let platform_label = current_platform_key().unwrap_or(std::env::consts::OS);
        return Err(ManagerError::PolicyViolation(format!(
            "No installer artifact for `opta-cli` on platform `{}`. Download manually from https://init.optalocal.com/downloads/opta-cli/latest.",
            platform_label
        )));
    };

    open_http_url(installer_url.as_str())?;

    Ok(CommandOutcome {
        ok: true,
        command: format!("open {}", installer_url),
        exit_code: None,
        stdout: String::new(),
        stderr: String::new(),
        message: format!(
            "Opta CLI is missing. Opened installer URL: {}. Complete installation, then retry the install action.",
            installer_url
        ),
    })
}

#[tauri::command]
async fn fetch_manifest(
    channel: String,
    manifest_url: Option<String>,
) -> Result<ManifestResponse, String> {
    let normalized_channel = normalize_channel(&channel);
    let url = manifest_url_for(&normalized_channel, manifest_url);

    let parsed_url = parse_http_url(&url).map_err(|error| error.to_string())?;
    let client = manager_http_client().map_err(|error| error.to_string())?;

    let response = client.get(parsed_url).send().await;

    match response {
        Ok(resp) => {
            if !resp.status().is_success() {
                return Ok(ManifestResponse {
                    manifest: default_manifest(&normalized_channel),
                    source: "embedded-fallback".to_string(),
                    warning: Some(format!(
                        "Manifest request failed with HTTP {}. Using fallback manifest.",
                        resp.status()
                    )),
                });
            }

            let body = resp.text().await.unwrap_or_default();
            let value = serde_json::from_str::<Value>(&body).unwrap_or(Value::Null);
            if let Some(mut manifest) = normalize_manifest_payload(value, &normalized_channel) {
                manifest.channel = normalized_channel;
                let policy_warning =
                    evaluate_manifest_policy(&manifest).map_err(|error| error.to_string())?;
                Ok(ManifestResponse {
                    manifest,
                    source: url,
                    warning: policy_warning,
                })
            } else {
                Ok(ManifestResponse {
                    manifest: default_manifest(&normalized_channel),
                    source: "embedded-fallback".to_string(),
                    warning: Some(
                        "Manifest payload could not be parsed. Using fallback manifest."
                            .to_string(),
                    ),
                })
            }
        }
        Err(error) => Ok(ManifestResponse {
            manifest: default_manifest(&normalized_channel),
            source: "embedded-fallback".to_string(),
            warning: Some(format!(
                "Manifest fetch failed: {}. Using fallback manifest.",
                error
            )),
        }),
    }
}

fn app_id_from_name(name: &str) -> String {
    let mut normalized = String::with_capacity(name.len());
    let mut last_was_dash = false;

    for ch in name.chars() {
        let lower = ch.to_ascii_lowercase();
        if lower.is_ascii_alphanumeric() {
            normalized.push(lower);
            last_was_dash = false;
        } else if !last_was_dash {
            normalized.push('-');
            last_was_dash = true;
        }
    }

    let trimmed = normalized.trim_matches('-').to_string();
    if trimmed.is_empty() {
        "unknown-app".to_string()
    } else {
        trimmed
    }
}

fn collect_app_dirs(base_path: PathBuf, source: &str, out: &mut Vec<InstalledApp>) {
    let read_dir = match fs::read_dir(&base_path) {
        Ok(dir) => dir,
        Err(_) => return,
    };

    for entry in read_dir.flatten() {
        let path = entry.path();
        let file_name = entry.file_name();
        let file_name = file_name.to_string_lossy();

        #[cfg(target_os = "macos")]
        let is_candidate = path.extension().map(|ext| ext == "app").unwrap_or(false);

        #[cfg(target_os = "windows")]
        let is_candidate = path.is_dir();

        #[cfg(not(any(target_os = "macos", target_os = "windows")))]
        let is_candidate = false;

        if !is_candidate {
            continue;
        }

        let display_name = if file_name.ends_with(".app") {
            file_name.trim_end_matches(".app").to_string()
        } else {
            file_name.to_string()
        };

        out.push(InstalledApp {
            id: app_id_from_name(&display_name),
            name: display_name,
            path: path.to_string_lossy().to_string(),
            version: None,
            source: source.to_string(),
        });
    }
}

fn list_installed_from_filesystem() -> Vec<InstalledApp> {
    let mut apps = Vec::new();

    #[cfg(target_os = "macos")]
    {
        collect_app_dirs(
            PathBuf::from("/Applications"),
            "filesystem:/Applications",
            &mut apps,
        );
        if let Some(home) = dirs::home_dir() {
            collect_app_dirs(
                home.join("Applications"),
                "filesystem:~/Applications",
                &mut apps,
            );
        }
    }

    #[cfg(target_os = "windows")]
    {
        if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
            collect_app_dirs(
                PathBuf::from(local_app_data).join("Programs"),
                "filesystem:%LOCALAPPDATA%/Programs",
                &mut apps,
            );
        }

        if let Ok(program_files) = std::env::var("ProgramFiles") {
            collect_app_dirs(
                PathBuf::from(program_files),
                "filesystem:%ProgramFiles%",
                &mut apps,
            );
        }
    }

    apps
}

fn parse_cli_installed_apps(value: Value) -> Vec<InstalledApp> {
    let items = if value.is_array() {
        value.as_array().cloned().unwrap_or_default()
    } else if let Some(array) = value.get("apps").and_then(|entry| entry.as_array()) {
        array.clone()
    } else {
        Vec::new()
    };

    let mut parsed = Vec::new();
    for item in items {
        if let Some(obj) = item.as_object() {
            let id = obj
                .get("id")
                .and_then(Value::as_str)
                .or_else(|| obj.get("slug").and_then(Value::as_str))
                .unwrap_or("unknown-app")
                .to_string();
            let name = obj
                .get("name")
                .and_then(Value::as_str)
                .unwrap_or(&id)
                .to_string();
            let path = obj
                .get("path")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string();
            let version = obj
                .get("version")
                .and_then(Value::as_str)
                .map(ToString::to_string);

            parsed.push(InstalledApp {
                id,
                name,
                path,
                version,
                source: "opta-cli".to_string(),
            });
        }
    }

    parsed
}

async fn list_installed_from_cli() -> Vec<InstalledApp> {
    if !is_command_available("opta").await {
        return Vec::new();
    }

    let variants = vec![
        vec!["apps".to_string(), "list".to_string(), "--json".to_string()],
        vec!["app".to_string(), "list".to_string(), "--json".to_string()],
    ];

    for args in variants {
        if let Ok(result) = run_command_capture("opta", &args).await {
            if result.success {
                if let Ok(value) = serde_json::from_str::<Value>(&result.stdout) {
                    let parsed = parse_cli_installed_apps(value);
                    if !parsed.is_empty() {
                        return parsed;
                    }
                }
            }
        }
    }

    Vec::new()
}

#[tauri::command]
async fn list_installed_apps() -> Result<Vec<InstalledApp>, String> {
    let mut apps = list_installed_from_cli().await;
    apps.extend(list_installed_from_filesystem());

    let mut dedupe = HashSet::new();
    apps.retain(|app| {
        let key = format!("{}::{}", app.id, app.path);
        dedupe.insert(key)
    });

    apps.sort_by(|left, right| left.name.to_lowercase().cmp(&right.name.to_lowercase()));
    Ok(apps)
}

async fn execute_variants(
    program: &str,
    variants: &[Vec<String>],
    action_label: &str,
) -> Result<CommandOutcome, ManagerError> {
    if !is_command_available(program).await {
        return Err(ManagerError::MissingCli(program.to_string()));
    }

    let mut last_failure: Option<CapturedOutput> = None;

    for args in variants {
        let captured = run_command_capture(program, args).await?;
        if captured.success {
            return Ok(outcome_from_success(captured, action_label));
        }
        last_failure = Some(captured);
    }

    if let Some(failure) = last_failure {
        let stderr = if failure.stderr.is_empty() {
            failure.stdout
        } else {
            failure.stderr
        };

        Err(ManagerError::CommandFailed {
            command: failure.command,
            code: failure.exit_code,
            stderr,
        })
    } else {
        Err(ManagerError::CommandFailed {
            command: format!("{} <no-args>", program),
            code: None,
            stderr: "No command variants were provided.".to_string(),
        })
    }
}

#[tauri::command]
async fn install_app(app: tauri::AppHandle, app_id: String, channel: String) -> Result<CommandOutcome, String> {
    let normalized_channel = normalize_channel(&channel);
    if app_id.eq_ignore_ascii_case("opta-cli") && !is_command_available("opta").await {
        return bootstrap_opta_cli_install(&normalized_channel)
            .await
            .map_err(|error| format!("Install failed. {}", error));
    }
    enforce_component_policy_if_available(&normalized_channel, &app_id)
        .await
        .map_err(|error| format!("Install failed. {}", error))?;

    let variants = vec![
        vec![
            "apps".to_string(),
            "install".to_string(),
            app_id.clone(),
            "--channel".to_string(),
            normalized_channel.clone(),
        ],
        vec![
            "app".to_string(),
            "install".to_string(),
            app_id.clone(),
            "--channel".to_string(),
            normalized_channel,
        ],
    ];

    let mut last_failure = None;
    for args in variants {
        let captured = run_command_stream(&app, &app_id, "opta", &args).await.map_err(|e| e.to_string())?;
        if captured.success {
            return Ok(outcome_from_success(captured, "Install completed."));
        }
        last_failure = Some(captured);
    }
    
    Err(format!("Install failed: {:?}", last_failure.map(|f| if f.stderr.is_empty() { f.stdout } else { f.stderr })))
}

#[tauri::command]
async fn update_app(app: tauri::AppHandle, app_id: String, channel: String) -> Result<CommandOutcome, String> {
    let normalized_channel = normalize_channel(&channel);
    enforce_component_policy_if_available(&normalized_channel, &app_id)
        .await
        .map_err(|error| format!("Update failed. {}", error))?;

    let variants = vec![
        vec![
            "apps".to_string(),
            "update".to_string(),
            app_id.clone(),
            "--channel".to_string(),
            normalized_channel.clone(),
        ],
        vec![
            "app".to_string(),
            "update".to_string(),
            app_id.clone(),
            "--channel".to_string(),
            normalized_channel,
        ],
    ];

    let mut last_failure = None;
    for args in variants {
        let captured = run_command_stream(&app, &app_id, "opta", &args).await.map_err(|e| e.to_string())?;
        if captured.success {
            return Ok(outcome_from_success(captured, "Update completed."));
        }
        last_failure = Some(captured);
    }
    
    Err(format!("Update failed: {:?}", last_failure.map(|f| if f.stderr.is_empty() { f.stdout } else { f.stderr })))
}

#[tauri::command]
async fn uninstall_app(app: tauri::AppHandle, app_id: String) -> Result<CommandOutcome, String> {
    let variants = vec![
        vec!["apps".to_string(), "uninstall".to_string(), app_id.clone(), "--yes".to_string()],
        vec!["app".to_string(), "uninstall".to_string(), app_id.clone(), "--yes".to_string()],
        vec!["apps".to_string(), "remove".to_string(), app_id.clone(), "--yes".to_string()],
        vec!["app".to_string(), "remove".to_string(), app_id.clone(), "--yes".to_string()],
        vec!["apps".to_string(), "uninstall".to_string(), app_id.clone()],
        vec!["app".to_string(), "uninstall".to_string(), app_id.clone()],
        vec!["apps".to_string(), "remove".to_string(), app_id.clone()],
        vec!["app".to_string(), "remove".to_string(), app_id.clone()],
    ];

    let mut last_failure = None;
    for args in variants {
        let captured = run_command_stream(&app, &app_id, "opta", &args)
            .await
            .map_err(|e| e.to_string())?;
        if captured.success {
            return Ok(outcome_from_success(captured, "Delete completed."));
        }
        last_failure = Some(captured);
    }

    Err(format!(
        "Delete failed: {:?}",
        last_failure.map(|f| if f.stderr.is_empty() { f.stdout } else { f.stderr })
    ))
}

async fn os_level_launch(app_id: &str) -> Result<CommandOutcome, ManagerError> {
    #[cfg(target_os = "macos")]
    let app_name = match app_id {
        "opta-code-universal" => "Opta Code Desktop (Universal).app",
        "opta-lmx" => "Opta.app",         // Adjust if LMX has a different .app name locally
        "opta-cli" => "Opta Terminal.app",
        _ => app_id, 
    };

    #[cfg(target_os = "macos")]
    let variants = vec![vec!["-a".to_string(), app_name.to_string()]];

    #[cfg(target_os = "windows")]
    let variants = vec![vec![
        "/C".to_string(),
        "start".to_string(),
        "".to_string(),
        app_id.to_string(),
    ]];

    #[cfg(target_os = "linux")]
    let variants = vec![vec![app_id.to_string()]];

    #[cfg(target_os = "macos")]
    let program = "open";

    #[cfg(target_os = "windows")]
    let program = "cmd";

    #[cfg(target_os = "linux")]
    let program = "xdg-open";

    execute_variants(program, &variants, "Launch requested via OS launcher.").await
}

#[tauri::command]
async fn launch_app(app_id: String) -> Result<CommandOutcome, String> {
    let variants = vec![
        vec!["apps".to_string(), "launch".to_string(), app_id.clone()],
        vec!["app".to_string(), "launch".to_string(), app_id.clone()],
    ];

    match execute_variants("opta", &variants, "Launch requested.").await {
        Ok(outcome) => Ok(outcome),
        Err(opta_error) => match os_level_launch(&app_id).await {
            Ok(os_outcome) => Ok(os_outcome),
            Err(os_error) => Err(format!(
                "Launch failed. CLI error: {}. OS launcher error: {}",
                opta_error, os_error
            )),
        },
    }
}

fn parse_daemon_json(value: &Value) -> Option<DaemonStatus> {
    let running = value
        .get("running")
        .and_then(Value::as_bool)
        .or_else(|| {
            value
                .get("status")
                .and_then(Value::as_str)
                .map(|status| status.eq_ignore_ascii_case("running"))
        })
        .unwrap_or(false);

    let message = value
        .get("message")
        .and_then(Value::as_str)
        .or_else(|| value.get("status").and_then(Value::as_str))
        .unwrap_or(if running { "running" } else { "stopped" })
        .to_string();

    Some(DaemonStatus {
        running,
        message,
        raw_output: serde_json::to_string_pretty(value).unwrap_or_default(),
        checked_at: current_timestamp(),
    })
}

fn merge_output_streams(output: &CapturedOutput) -> String {
    if output.stderr.is_empty() {
        output.stdout.clone()
    } else if output.stdout.is_empty() {
        output.stderr.clone()
    } else {
        format!("{}\n{}", output.stdout, output.stderr)
    }
}

fn normalize_status_text(input: &str) -> String {
    input
        .to_ascii_lowercase()
        .chars()
        .map(|ch| if ch.is_ascii_alphanumeric() { ch } else { ' ' })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn contains_status_phrase(normalized: &str, phrase: &str) -> bool {
    let haystack = format!(" {} ", normalized);
    let needle = format!(" {} ", phrase);
    haystack.contains(&needle)
}

fn daemon_running_from_text(raw_output: &str, command_success: bool) -> bool {
    let normalized = normalize_status_text(raw_output);

    let negative_signals = [
        "not running",
        "not active",
        "not online",
        "stopped",
        "inactive",
        "offline",
        "unreachable",
        "failed",
        "error",
        "running false",
        "running 0",
        "status stopped",
    ];

    if negative_signals
        .iter()
        .any(|phrase| contains_status_phrase(&normalized, phrase))
    {
        return false;
    }

    if !command_success {
        return false;
    }

    let positive_signals = [
        "running true",
        "running 1",
        "status running",
        "daemon running",
        "online",
        "active",
        "running",
    ];

    positive_signals
        .iter()
        .any(|phrase| contains_status_phrase(&normalized, phrase))
}

#[tauri::command]
async fn daemon_status() -> Result<DaemonStatus, String> {
    if !is_command_available("opta").await {
        return Ok(DaemonStatus {
            running: false,
            message: "opta CLI not available".to_string(),
            raw_output: "Install Opta CLI and ensure it is in PATH.".to_string(),
            checked_at: current_timestamp(),
        });
    }

    let json_args = vec![
        "daemon".to_string(),
        "status".to_string(),
        "--json".to_string(),
    ];
    if let Ok(output) = run_command_capture("opta", &json_args).await {
        if output.success {
            if let Ok(value) = serde_json::from_str::<Value>(&output.stdout) {
                if let Some(status) = parse_daemon_json(&value) {
                    return Ok(status);
                }
            }
        }
    }

    let text_args = vec!["daemon".to_string(), "status".to_string()];
    let output = run_command_capture("opta", &text_args)
        .await
        .map_err(|error| error.to_string())?;

    let merged = merge_output_streams(&output);
    let running = daemon_running_from_text(&merged, output.success);

    Ok(DaemonStatus {
        running,
        message: if running {
            "running".to_string()
        } else {
            "stopped or unreachable".to_string()
        },
        raw_output: merged,
        checked_at: current_timestamp(),
    })
}

#[tauri::command]
async fn daemon_start() -> Result<CommandOutcome, String> {
    let variants = vec![vec!["daemon".to_string(), "start".to_string()]];
    execute_variants("opta", &variants, "Daemon start command executed.")
        .await
        .map_err(|error| format!("Daemon start failed. {}", error))
}

#[tauri::command]
async fn daemon_stop() -> Result<CommandOutcome, String> {
    let variants = vec![vec!["daemon".to_string(), "stop".to_string()]];
    execute_variants("opta", &variants, "Daemon stop command executed.")
        .await
        .map_err(|error| format!("Daemon stop failed. {}", error))
}

async fn fetch_daemon_connection() -> Result<(String, String), String> {
    if !is_command_available("opta").await {
        return Err("Opta CLI is not installed".to_string());
    }
    let args = vec!["daemon".to_string(), "status".to_string(), "--json".to_string()];
    let output = run_command_capture("opta", &args)
        .await
        .map_err(|e| format!("Failed to get daemon status: {}", e))?;
    
    if !output.success {
        return Err("Daemon is not running".to_string());
    }

    let payload: CLIDaemonStatusPayload = serde_json::from_str(&output.stdout)
        .map_err(|e| format!("Invalid daemon status json: {}", e))?;
    
    if !payload.running {
        return Err("Daemon is not running".to_string());
    }
    
    let state = payload.state.ok_or_else(|| "Daemon state missing".to_string())?;
    let endpoint = format!("http://{}:{}", state.host, state.port);
    Ok((endpoint, state.token))
}

#[tauri::command]
async fn fetch_daemon_jobs() -> Result<Vec<DaemonJob>, String> {
    let (endpoint, token) = match fetch_daemon_connection().await {
        Ok(res) => res,
        Err(_) => return Ok(vec![]),
    };

    let client = manager_http_client().map_err(|e| e.to_string())?;
    let url = format!("{}/v3/background", endpoint);
    let res = client.get(&url).header("Authorization", format!("Bearer {}", token)).send().await;

    if let Ok(response) = res {
        if response.status().is_success() {
            if let Ok(body) = response.text().await {
                // Try parsing the processes. The API returns {"processes": [...]}
                if let Ok(json) = serde_json::from_str::<Value>(&body) {
                    if let Some(processes) = json.get("processes").and_then(Value::as_array) {
                        let mut jobs = Vec::new();
                        for proc in processes {
                            let id = proc.get("processId").and_then(Value::as_str).unwrap_or("unknown").to_string();
                            let cmd = proc.get("command").and_then(Value::as_str).unwrap_or("unknown").to_string();
                            let mut args = vec![];
                            if let Some(arr) = proc.get("args").and_then(Value::as_array) {
                                for arg in arr {
                                    if let Some(s) = arg.as_str() { args.push(s.to_string()); }
                                }
                            }
                            let full_cmd = if args.is_empty() { cmd } else { format!("{} {}", cmd, args.join(" ")) };
                            let pid = proc.get("pid").and_then(|v| v.as_u64()).map(|p| p as u32);
                            let status = proc.get("status").and_then(Value::as_str).unwrap_or("stopped").to_string();
                            let exit_code = proc.get("exitCode").and_then(|v| v.as_i64()).map(|c| c as i32);
                            let uptime = None; // Uptime computation could be added if startedAt is provided

                            jobs.push(DaemonJob {
                                id,
                                cmd: full_cmd,
                                pid,
                                status,
                                uptime,
                                exit_code,
                            });
                        }
                        return Ok(jobs);
                    }
                }
            }
        }
    }
    
    Ok(vec![])
}

#[tauri::command]
async fn kill_daemon_job(job_id: String) -> Result<CommandOutcome, String> {
    let (endpoint, token) = fetch_daemon_connection().await?;
    let client = manager_http_client().map_err(|e| e.to_string())?;
    let url = format!("{}/v3/background/{}/kill", endpoint, job_id);
    
    let res = client.post(&url).header("Authorization", format!("Bearer {}", token)).send().await
        .map_err(|e| e.to_string())?;

    if res.status().is_success() {
        Ok(CommandOutcome {
            ok: true,
            command: format!("kill {}", job_id),
            exit_code: None,
            stdout: "Job killed".to_string(),
            stderr: String::new(),
            message: "Job killed successfully".to_string(),
        })
    } else {
        Err(format!("Failed to kill job: HTTP {}", res.status()))
    }
}

#[tauri::command]
async fn restart_daemon_job(job_id: String) -> Result<CommandOutcome, String> {
    // Restart is generally not supported as a native API unless we recreate it. For now, killing it and letting the user start a new one is standard. 
    // Opta CLI daemon doesn't have a /v3/background/:processId/restart.
    Err("API does not support native restart. Please kill the job and start anew.".to_string())
}

#[tauri::command]
async fn open_url(url: String) -> Result<(), String> {
    open_http_url(&url).map_err(|error| error.to_string())
}

#[tauri::command]
async fn check_manager_update(
    app: tauri::AppHandle,
    channel: Option<String>,
) -> ManagerUpdateStatus {
    let normalized_channel = normalize_optional_channel(channel);
    let (endpoint_used, mut warnings) = resolve_updater_endpoint(&normalized_channel);

    let mut status = ManagerUpdateStatus {
        current_version: MANAGER_VERSION.to_string(),
        channel: normalized_channel.clone(),
        endpoint_used: endpoint_used.clone(),
        available: false,
        latest_version: None,
        release_notes: None,
        release_date: None,
        warnings: Vec::new(),
        error: None,
    };

    let endpoint_url = match Url::parse(endpoint_used.as_str()) {
        Ok(endpoint) => endpoint,
        Err(error) => {
            warnings.push(format!("Updater endpoint parse failed: {}", error));
            status.warnings = warnings;
            status.error = Some(
                "Updater endpoint is invalid. Please contact support or set a valid override endpoint."
                    .to_string(),
            );
            return status;
        }
    };

    let updater_builder = app.updater_builder();

    let updater_builder = match updater_builder.endpoints(vec![endpoint_url]) {
        Ok(builder) => builder,
        Err(error) => {
            warnings.push(format!("Updater endpoint config failed: {}", error));
            status.warnings = warnings;
            status.error = Some(
                "Updater endpoint settings are not valid for this build. Please retry later."
                    .to_string(),
            );
            return status;
        }
    };

    let updater = match updater_builder.build() {
        Ok(updater) => updater,
        Err(error) => {
            warnings.push(format!("Updater build failed: {}", error));
            status.warnings = warnings;
            status.error = Some(
                "Could not prepare update check right now. Please retry in a moment.".to_string(),
            );
            return status;
        }
    };

    match updater.check().await {
        Ok(Some(update)) => {
            status.available = true;
            status.latest_version = Some(update.version.clone());
            status.release_notes = update.body.clone().filter(|value| !value.trim().is_empty());
            status.release_date = update.date.map(|value| value.to_string());
        }
        Ok(None) => {}
        Err(error) => {
            warnings.push(format!("Update check failed: {}", error));
            status.error = Some(
                "Could not check for manager updates right now. Please retry in a moment."
                    .to_string(),
            );
        }
    }

    status.warnings = warnings;
    status
}

#[tauri::command]
async fn install_manager_update(
    app: tauri::AppHandle,
    channel: Option<String>,
) -> ManagerUpdateInstallOutcome {
    let normalized_channel = normalize_optional_channel(channel);
    let (endpoint_used, mut warnings) = resolve_updater_endpoint(&normalized_channel);

    let mut outcome = ManagerUpdateInstallOutcome {
        ok: false,
        installed: false,
        current_version: MANAGER_VERSION.to_string(),
        channel: normalized_channel.clone(),
        endpoint_used: endpoint_used.clone(),
        latest_version: None,
        release_notes: None,
        release_date: None,
        warnings: Vec::new(),
        message: "Manager update was not installed.".to_string(),
    };

    let endpoint_url = match Url::parse(endpoint_used.as_str()) {
        Ok(endpoint) => endpoint,
        Err(error) => {
            warnings.push(format!("Updater endpoint parse failed: {}", error));
            outcome.message =
                "Updater endpoint is invalid. Please contact support or set a valid override endpoint."
                    .to_string();
            outcome.warnings = warnings;
            return outcome;
        }
    };

    let updater_builder = app.updater_builder();

    let updater_builder = match updater_builder.endpoints(vec![endpoint_url]) {
        Ok(builder) => builder,
        Err(error) => {
            warnings.push(format!("Updater endpoint config failed: {}", error));
            outcome.message =
                "Updater endpoint settings are not valid for this build. Please retry later."
                    .to_string();
            outcome.warnings = warnings;
            return outcome;
        }
    };

    let updater = match updater_builder.build() {
        Ok(updater) => updater,
        Err(error) => {
            warnings.push(format!("Updater build failed: {}", error));
            outcome.message =
                "Could not prepare manager update install right now. Please retry later."
                    .to_string();
            outcome.warnings = warnings;
            return outcome;
        }
    };

    let update = match updater.check().await {
        Ok(Some(update)) => update,
        Ok(None) => {
            outcome.ok = true;
            outcome.message = "Manager is already up to date.".to_string();
            outcome.warnings = warnings;
            return outcome;
        }
        Err(error) => {
            warnings.push(format!("Update check failed: {}", error));
            outcome.message =
                "Could not check for manager updates right now. Please retry in a moment."
                    .to_string();
            outcome.warnings = warnings;
            return outcome;
        }
    };

    outcome.latest_version = Some(update.version.clone());
    outcome.release_notes = update.body.clone().filter(|value| !value.trim().is_empty());
    outcome.release_date = update.date.map(|value| value.to_string());

    match update.download_and_install(|_, _| {}, || {}).await {
        Ok(()) => {
            outcome.ok = true;
            outcome.installed = true;
            outcome.message = format!(
                "Manager update to v{} installed. Restart Opta Init to apply the update.",
                outcome.latest_version.as_deref().unwrap_or("latest")
            );
        }
        Err(error) => {
            warnings.push(format!("Install failed: {}", error));
            outcome.message = "Manager update download/install failed. Please retry later or reinstall from init.optalocal.com.".to_string();
        }
    }

    outcome.warnings = warnings;
    outcome
}

#[tauri::command]
async fn verify_app(app_id: String) -> Result<CommandOutcome, String> {
    let variants = vec![
        vec!["apps".to_string(), "verify".to_string(), app_id.clone()],
        vec!["app".to_string(), "verify".to_string(), app_id.clone()],
    ];
    execute_variants("opta", &variants, "Verify completed.")
        .await
        .map_err(|error| format!("Verify failed: {}", error))
}

#[tauri::command]
async fn open_app_folder(app_id: String) -> Result<CommandOutcome, String> {
    let apps = list_installed_apps().await?;
    if let Some(app) = apps.into_iter().find(|a| a.id == app_id) {
        #[cfg(target_os = "macos")]
        {
            let output = tokio::process::Command::new("open")
                .arg(&app.path)
                .output()
                .await
                .map_err(|e| format!("Failed to open folder: {}", e))?;
            
            return Ok(CommandOutcome {
                ok: output.status.success(),
                command: format!("open {}", app.path),
                exit_code: output.status.code(),
                stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
                stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
                message: if output.status.success() { "Opened folder successfully".into() } else { "Failed to open folder".into() }
            });
        }
        
        #[cfg(target_os = "windows")]
        {
            let output = tokio::process::Command::new("explorer")
                .arg(&app.path)
                .output()
                .await
                .map_err(|e| format!("Failed to open folder: {}", e))?;
            
            return Ok(CommandOutcome {
                ok: output.status.success(),
                command: format!("explorer {}", app.path),
                exit_code: output.status.code(),
                stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
                stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
                message: if output.status.success() { "Opened folder successfully".into() } else { "Failed to open folder".into() }
            });
        }
        
        #[cfg(target_os = "linux")]
        {
            let output = tokio::process::Command::new("xdg-open")
                .arg(&app.path)
                .output()
                .await
                .map_err(|e| format!("Failed to open folder: {}", e))?;
            
            return Ok(CommandOutcome {
                ok: output.status.success(),
                command: format!("xdg-open {}", app.path),
                exit_code: output.status.code(),
                stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
                stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
                message: if output.status.success() { "Opened folder successfully".into() } else { "Failed to open folder".into() }
            });
        }
    }
    Err(format!("App {} not found or not installed", app_id))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct OptaEnvironmentConfig {
    profile: String,
    install_path: String,
    docs_path: String,
}

#[tauri::command]
async fn save_opta_config(config: OptaEnvironmentConfig) -> Result<(), String> {
    println!("Saving Opta Config: {:?}", config);
    // In a real implementation this would write to ~/.optalocal/config.json
    Ok(())
}

#[tauri::command]
async fn check_dependency_status(dependency: String) -> bool {
    match dependency.as_str() {
        "cli" => is_command_available("opta").await,
        "daemon" => {
            let args = vec!["daemon".to_string(), "status".to_string(), "--json".to_string()];
            let output = run_command_capture("opta", &args).await;
            output.is_ok()
        },
        "lmx" => {
            let apps = list_installed_apps().await.unwrap_or_default();
            apps.into_iter().any(|a| a.id == "opta-lmx")
        },
        "code" => {
            let apps = list_installed_apps().await.unwrap_or_default();
            apps.into_iter().any(|a| a.id == "opta-code-universal")
        },
        _ => false,
    }
}

#[tauri::command]
async fn install_dependency(app: tauri::AppHandle, dependency: String) -> Result<CommandOutcome, String> {
    match dependency.as_str() {
        "cli" => {
            let npm_program =
                ensure_npm_available_for_zero_touch(&app, "install-progress", "cli")
                    .await
                    .map_err(|e| format!("CLI install failed: {}", e))?;
            let cli_prefix = opta_cli_prefix_dir()
                .ok_or_else(|| "CLI install failed: unable to resolve install prefix.".to_string())?;
            fs::create_dir_all(&cli_prefix)
                .map_err(|e| format!("CLI install failed: {}", e))?;
            let package_spec = resolve_opta_cli_package_spec("stable").await;
            let npm_args = vec![
                "install".to_string(),
                "-g".to_string(),
                "--prefix".to_string(),
                cli_prefix.to_string_lossy().to_string(),
                package_spec,
            ];
            let captured = run_command_stream(
                &app, 
                "cli", 
                &npm_program,
                &npm_args
            ).await.map_err(|e| format!("CLI install failed: {}", e))?;
            
            if captured.success {
                Ok(outcome_from_success(captured, "CLI installed via npm."))
            } else {
                Err(format!("CLI install failed: {}", if captured.stderr.is_empty() { captured.stdout } else { captured.stderr }))
            }
        },
        "daemon" => {
            if !is_command_available("opta").await {
                return Err("Opta CLI not available".to_string());
            }
            let captured = run_command_stream(
                &app,
                "daemon",
                "opta",
                &["daemon".to_string(), "install".to_string()]
            ).await.map_err(|e| format!("Daemon install failed: {}", e))?;
            
            if captured.success {
                Ok(outcome_from_success(captured, "Daemon installed."))
            } else {
                Err(format!("Daemon install failed: {}", if captured.stderr.is_empty() { captured.stdout } else { captured.stderr }))
            }
        },
        "lmx" => {
            // Using the global install_app function which resolves channel to stable by default or pass explicitly
            match install_app(app, "opta-lmx".to_string(), "stable".to_string()).await {
                Ok(out) => Ok(out),
                Err(e) => Err(format!("LMX install failed: {:?}", e))
            }
        },
        "code" => {
            match install_app(app, "opta-code-universal".to_string(), "stable".to_string()).await {
                Ok(out) => Ok(out),
                Err(e) => Err(format!("Code install failed: {:?}", e))
            }
        },
        _ => Err(format!("Unknown dependency: {}", dependency)),
    }
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AccountUser {
    id: Option<String>,
    email: Option<String>,
    name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AccountStatusPayload {
    ok: bool,
    authenticated: bool,
    project: Option<String>,
    user: Option<AccountUser>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TauriUserProfile {
    email: Option<String>,
    name: Option<String>,
    avatar: Option<String>,
    active_role: Option<String>,
}

#[tauri::command]
async fn get_account_status() -> Result<Option<TauriUserProfile>, String> {
    let captured = run_command_capture("opta", &["account".to_string(), "status".to_string(), "--json".to_string()])
        .await
        .map_err(|e| e.to_string())?;

    if !captured.success {
        return Ok(None);
    }

    if let Ok(payload) = serde_json::from_str::<AccountStatusPayload>(&captured.stdout) {
        if payload.authenticated {
            if let Some(user) = payload.user {
                return Ok(Some(TauriUserProfile {
                    email: user.email,
                    name: user.name,
                    avatar: None,
                    active_role: Some("Developer".to_string()),
                }));
            } else {
                return Ok(Some(TauriUserProfile {
                    email: None,
                    name: None,
                    avatar: None,
                    active_role: Some("Developer".to_string()),
                }));
            }
        }
    }
    Ok(None)
}

#[tauri::command]
async fn trigger_login() -> Result<(), String> {
    let captured = run_command_capture_with_timeout(
        "opta",
        &[
            "account".to_string(),
            "login".to_string(),
            "--oauth".to_string(),
            "--timeout".to_string(),
            ACCOUNT_LOGIN_FLOW_TIMEOUT_SECS.to_string(),
            "--return-to".to_string(),
            ACCOUNT_LOGIN_RETURN_TO_URL.to_string(),
            "--json".to_string(),
        ],
        ACCOUNT_LOGIN_WAIT_TIMEOUT_SECS,
    )
        .await
        .map_err(|e| e.to_string())?;
    if !captured.success {
        let details = if captured.stderr.trim().is_empty() {
            captured.stdout.trim().to_string()
        } else {
            captured.stderr.trim().to_string()
        };
        if details.is_empty() {
            return Err("Login command failed. Run `opta account login --oauth` for details.".to_string());
        }
        return Err(format!("Login command failed: {}", details));
    }
    Ok(())
}

#[tauri::command]
async fn trigger_logout() -> Result<(), String> {
    let captured = run_command_capture(
        "opta",
        &["account".to_string(), "logout".to_string(), "--json".to_string()],
    )
        .await
        .map_err(|e| e.to_string())?;
    if !captured.success {
        let details = if captured.stderr.trim().is_empty() {
            captured.stdout.trim().to_string()
        } else {
            captured.stderr.trim().to_string()
        };
        if details.is_empty() {
            return Err("Logout command failed.".to_string());
        }
        return Err(format!("Logout command failed: {}", details));
    }
    Ok(())
}

// ─── Cloudflare Tunnel Commands ─────────────────────────────────────────────

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct CloudflaredInstallResult {
    ok: bool,
    message: Option<String>,
}

/// Install cloudflared via package manager (macOS/Windows) or direct binary download (Linux).
/// Emits "tunnel-install-progress" events with { line, ok? } during install.
#[tauri::command]
async fn install_cloudflared(app: tauri::AppHandle) -> Result<CloudflaredInstallResult, String> {
    if is_command_available("cloudflared").await {
        let _ = app.emit(
            "tunnel-install-progress",
            serde_json::json!({ "line": "cloudflared is already installed.", "ok": true }),
        );
        return Ok(CloudflaredInstallResult {
            ok: true,
            message: Some("Already installed.".to_string()),
        });
    }

    let os = std::env::consts::OS;

    if os == "linux" {
        let arch = match std::env::consts::ARCH {
            "x86_64" => "amd64",
            "aarch64" | "arm64" => "arm64",
            other => {
                let message = format!(
                    "Unsupported Linux architecture `{}` for automatic cloudflared install.",
                    other
                );
                let _ = app.emit(
                    "tunnel-install-progress",
                    serde_json::json!({ "line": message, "ok": false }),
                );
                return Ok(CloudflaredInstallResult {
                    ok: false,
                    message: Some("Manual cloudflared install required for this architecture.".to_string()),
                });
            }
        };

        let download_url = format!(
            "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-{}",
            arch
        );
        let home_dir = match dirs::home_dir() {
            Some(path) => path,
            None => {
                let message = "Failed to resolve home directory for cloudflared install.".to_string();
                let _ = app.emit(
                    "tunnel-install-progress",
                    serde_json::json!({ "line": message, "ok": false }),
                );
                return Ok(CloudflaredInstallResult {
                    ok: false,
                    message: Some(message),
                });
            }
        };
        let install_dir = home_dir.join(".local").join("bin");
        if let Err(error) = fs::create_dir_all(&install_dir) {
            let message = format!("Failed to create install directory: {}", error);
            let _ = app.emit(
                "tunnel-install-progress",
                serde_json::json!({ "line": message, "ok": false }),
            );
            return Ok(CloudflaredInstallResult {
                ok: false,
                message: Some(message),
            });
        }
        let destination = install_dir.join("cloudflared");

        let _ = app.emit(
            "tunnel-install-progress",
            serde_json::json!({ "line": format!("Downloading cloudflared from {}", download_url) }),
        );

        let client = match manager_http_client() {
            Ok(client) => client,
            Err(error) => {
                let message = format!("Unable to initialize downloader: {}", error);
                let _ = app.emit(
                    "tunnel-install-progress",
                    serde_json::json!({ "line": message, "ok": false }),
                );
                return Ok(CloudflaredInstallResult {
                    ok: false,
                    message: Some("cloudflared installation failed to start.".to_string()),
                });
            }
        };
        let response = match client.get(download_url).send().await {
            Ok(response) => response,
            Err(error) => {
                let message = format!("Download request failed: {}", error);
                let _ = app.emit(
                    "tunnel-install-progress",
                    serde_json::json!({ "line": message, "ok": false }),
                );
                return Ok(CloudflaredInstallResult {
                    ok: false,
                    message: Some(message),
                });
            }
        };
        if !response.status().is_success() {
            let message = format!(
                "Download failed with HTTP status {}.",
                response.status()
            );
            let _ = app.emit(
                "tunnel-install-progress",
                serde_json::json!({ "line": message, "ok": false }),
            );
            return Ok(CloudflaredInstallResult {
                ok: false,
                message: Some(message),
            });
        }

        let bytes = match response.bytes().await {
            Ok(bytes) => bytes,
            Err(error) => {
                let message = format!("Failed to read download payload: {}", error);
                let _ = app.emit(
                    "tunnel-install-progress",
                    serde_json::json!({ "line": message, "ok": false }),
                );
                return Ok(CloudflaredInstallResult {
                    ok: false,
                    message: Some(message),
                });
            }
        };

        if let Err(error) = fs::write(&destination, &bytes) {
            let message = format!("Failed to write cloudflared binary: {}", error);
            let _ = app.emit(
                "tunnel-install-progress",
                serde_json::json!({ "line": message, "ok": false }),
            );
            return Ok(CloudflaredInstallResult {
                ok: false,
                message: Some(message),
            });
        }

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            if let Ok(metadata) = fs::metadata(&destination) {
                let mut perms = metadata.permissions();
                perms.set_mode(0o755);
                let _ = fs::set_permissions(&destination, perms);
            }
        }

        let destination_str = destination.to_string_lossy().to_string();
        let verify = run_command_capture_with_timeout(
            &destination_str,
            &["--version".to_string()],
            30,
        )
        .await;
        match verify {
            Ok(captured) if captured.success => {
                let _ = app.emit(
                    "tunnel-install-progress",
                    serde_json::json!({
                        "line": format!("cloudflared installed at {}", destination_str),
                        "ok": true
                    }),
                );
                return Ok(CloudflaredInstallResult {
                    ok: true,
                    message: None,
                });
            }
            Ok(captured) => {
                let message = format!(
                    "Installed cloudflared binary but verification failed: {}",
                    command_error_message(&captured, "unknown verification error")
                );
                let _ = app.emit(
                    "tunnel-install-progress",
                    serde_json::json!({ "line": message, "ok": false }),
                );
                return Ok(CloudflaredInstallResult {
                    ok: false,
                    message: Some(message),
                });
            }
            Err(error) => {
                let message = format!(
                    "Installed cloudflared binary but verification command failed: {}",
                    error
                );
                let _ = app.emit(
                    "tunnel-install-progress",
                    serde_json::json!({ "line": message, "ok": false }),
                );
                return Ok(CloudflaredInstallResult {
                    ok: false,
                    message: Some(message),
                });
            }
        }
    }

    let (program, args, prereq_message) = match os {
        "macos" => (
            "brew",
            vec!["install".to_string(), "cloudflared".to_string()],
            "Homebrew is required (`brew install cloudflared`).",
        ),
        "windows" => (
            "winget",
            vec![
                "install".to_string(),
                "--id".to_string(),
                "Cloudflare.cloudflared".to_string(),
                "-e".to_string(),
                "--accept-package-agreements".to_string(),
                "--accept-source-agreements".to_string(),
            ],
            "winget is required to auto-install cloudflared on Windows.",
        ),
        _ => {
            let message =
                "Automatic cloudflared install is unavailable on this platform. Install cloudflared manually and retry."
                    .to_string();
            let _ = app.emit(
                "tunnel-install-progress",
                serde_json::json!({ "line": message, "ok": false }),
            );
            return Ok(CloudflaredInstallResult {
                ok: false,
                message: Some(
                    "Manual cloudflared install required on this platform.".to_string(),
                ),
            });
        }
    };

    if !is_command_available(program).await {
        let _ = app.emit(
            "tunnel-install-progress",
            serde_json::json!({ "line": prereq_message, "ok": false }),
        );
        return Ok(CloudflaredInstallResult {
            ok: false,
            message: Some(prereq_message.to_string()),
        });
    }

    let command_label = command_preview(program, &args);
    let _ = app.emit(
        "tunnel-install-progress",
        serde_json::json!({ "line": format!("Running: {}", command_label) }),
    );

    let captured =
        match run_command_capture_with_timeout(program, &args, ZERO_TOUCH_COMMAND_TIMEOUT_SECS).await
        {
            Ok(value) => value,
            Err(error) => {
                let message = format!(
                    "Failed to run `{}`: {}",
                    command_label,
                    error
                );
                let _ = app.emit(
                    "tunnel-install-progress",
                    serde_json::json!({ "line": message, "ok": false }),
                );
                return Ok(CloudflaredInstallResult {
                    ok: false,
                    message: Some("cloudflared installation failed to start.".to_string()),
                });
            }
        };

    if !captured.success || !is_command_available("cloudflared").await {
        let details = command_error_message(&captured, "Install command failed.");
        let message = format!("cloudflared install failed: {}", details);
        let _ = app.emit(
            "tunnel-install-progress",
            serde_json::json!({ "line": message, "ok": false }),
        );
        return Ok(CloudflaredInstallResult {
            ok: false,
            message: Some(message),
        });
    }

    let _ = app.emit(
        "tunnel-install-progress",
        serde_json::json!({ "line": "cloudflared installed successfully.", "ok": true }),
    );
    Ok(CloudflaredInstallResult {
        ok: true,
        message: None,
    })
}

/// Start `cloudflared tunnel login` (opens browser) and poll until cert.pem appears.
#[tauri::command]
async fn start_cloudflared_login() -> Result<(), String> {
    // Spawn cloudflared login — this opens the browser
    tokio::process::Command::new("cloudflared")
        .args(["tunnel", "login"])
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to start cloudflared login: {}", e))?;

    // Poll for cert.pem with a 5-minute timeout
    let cert_path = dirs::home_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("~"))
        .join(".cloudflared")
        .join("cert.pem");

    for _ in 0..300 {
        tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
        if cert_path.exists() {
            return Ok(());
        }
    }

    Err("Cloudflare login timed out after 5 minutes. Please try again.".to_string())
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct TunnelProvisionResult {
    ok: bool,
    url: String,
    message: Option<String>,
}

fn extract_tunnel_url_from_line(line: &str) -> Option<String> {
    line.split_whitespace().find_map(|token| {
        let cleaned = token.trim_matches(|ch: char| {
            ch == '"' || ch == '\'' || ch == ',' || ch == ')' || ch == '(' || ch == ';'
        });
        if cleaned.starts_with("https://")
            && (cleaned.contains("trycloudflare.com") || cleaned.contains(".cfargotunnel.com"))
        {
            Some(cleaned.to_string())
        } else {
            None
        }
    })
}

/// Create a cloudflared tunnel and write its config pointing to localhost:<lmx_port>.
/// Emits "tunnel-provision-progress" events during provisioning.
#[tauri::command]
async fn provision_cloudflared_tunnel(
    app: tauri::AppHandle,
    name: String,
    lmx_host: String,
    lmx_port: u16,
) -> Result<TunnelProvisionResult, String> {
    use tokio::io::BufReader;
    use tokio::sync::mpsc;
    use tokio::time::{Duration, Instant};

    let emit_step = |msg: &str, ok: Option<bool>| {
        let payload = match ok {
            Some(v) => serde_json::json!({ "line": msg, "ok": v }),
            None     => serde_json::json!({ "line": msg }),
        };
        let _ = app.emit("tunnel-provision-progress", payload);
    };

    let ingress_url = format!("http://{}:{}", lmx_host, lmx_port);
    emit_step(
        &format!(
            "Starting Opta Anywhere tunnel `{}` to {}...",
            name,
            ingress_url
        ),
        None,
    );

    let mut child = tokio::process::Command::new("cloudflared")
        .env("PATH", extended_path())
        .args(["tunnel", "--url", &ingress_url, "--no-autoupdate"])
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .kill_on_drop(false)
        .spawn()
        .map_err(|e| format!("Failed to start cloudflared tunnel: {}", e))?;

    let mut stdout = child.stdout.take();
    let mut stderr = child.stderr.take();
    let (line_tx, mut line_rx) = mpsc::unbounded_channel::<String>();

    if let Some(stdout_pipe) = stdout.take() {
        let tx = line_tx.clone();
        tokio::spawn(async move {
            let mut lines = BufReader::new(stdout_pipe).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let _ = tx.send(line);
            }
        });
    }

    if let Some(stderr_pipe) = stderr.take() {
        let tx = line_tx.clone();
        tokio::spawn(async move {
            let mut lines = BufReader::new(stderr_pipe).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let _ = tx.send(line);
            }
        });
    }

    drop(line_tx);

    let deadline = Instant::now() + Duration::from_secs(45);
    let mut discovered_url: Option<String> = None;

    while Instant::now() < deadline {
        let remaining = deadline.saturating_duration_since(Instant::now());
        if remaining.is_zero() {
            break;
        }

        match tokio::time::timeout(remaining, line_rx.recv()).await {
            Ok(Some(line)) => {
                emit_step(&line, None);
                if discovered_url.is_none() {
                    discovered_url = extract_tunnel_url_from_line(&line);
                }
                if discovered_url.is_some() {
                    break;
                }
            }
            Ok(None) => break,
            Err(_) => break,
        }
    }

    let tunnel_url = match discovered_url {
        Some(url) => url,
        None => {
            let _ = child.kill().await;
            let _ = child.wait().await;
            emit_step(
                "Failed to obtain tunnel URL from cloudflared logs. Please retry.",
                Some(false),
            );
            return Ok(TunnelProvisionResult {
                ok: false,
                url: String::new(),
                message: Some(
                    "cloudflared started but did not provide a public URL within timeout."
                        .to_string(),
                ),
            });
        }
    };

    let pid = child.id().unwrap_or_default();
    tokio::spawn(async move {
        let _ = child.wait().await;
    });

    emit_step(
        &format!("Tunnel URL: {} (process {})", tunnel_url, pid),
        Some(true),
    );

    Ok(TunnelProvisionResult {
        ok: true,
        url: tunnel_url,
        message: None,
    })
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct LmxConnectionEntry {
    id: String,
    label: String,
    host: String,
    port: u16,
    tunnel_url: Option<String>,
    last_connected_via: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct LmxConnectionsFile {
    entries: Vec<LmxConnectionEntry>,
}

/// Write or update the tunnel URL for an LMX entry in the shared connection store.
/// File: ~/.config/opta/lmx-connections.json
#[tauri::command]
async fn write_tunnel_to_address_book(
    lmx_host: String,
    lmx_port: u16,
    tunnel_url: String,
) -> Result<(), String> {
    let config_dir = dirs::home_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("~"))
        .join(".config")
        .join("opta");

    std::fs::create_dir_all(&config_dir)
        .map_err(|e| format!("Failed to create config dir: {}", e))?;

    let file_path = config_dir.join("lmx-connections.json");

    let mut store: LmxConnectionsFile = if file_path.exists() {
        let content = std::fs::read_to_string(&file_path)
            .map_err(|e| format!("Failed to read connections file: {}", e))?;
        serde_json::from_str(&content).unwrap_or(LmxConnectionsFile { entries: vec![] })
    } else {
        LmxConnectionsFile { entries: vec![] }
    };

    let entry_id = format!("{}:{}", lmx_host, lmx_port);

    if let Some(existing) = store.entries.iter_mut().find(|e| e.host == lmx_host && e.port == lmx_port) {
        existing.tunnel_url = Some(tunnel_url);
        existing.last_connected_via = Some("lan".to_string());
    } else {
        store.entries.push(LmxConnectionEntry {
            id: entry_id,
            label: format!("LMX @ {}:{}", lmx_host, lmx_port),
            host: lmx_host,
            port: lmx_port,
            tunnel_url: Some(tunnel_url),
            last_connected_via: Some("lan".to_string()),
        });
    }

    let json = serde_json::to_string_pretty(&store)
        .map_err(|e| format!("Failed to serialize connections: {}", e))?;
    std::fs::write(&file_path, json)
        .map_err(|e| format!("Failed to write connections file: {}", e))?;

    Ok(())
}

/// Return the stored LMX host/port from shared config (if set by the wizard).
#[tauri::command]
async fn get_lmx_connection() -> Result<serde_json::Value, String> {
    let file_path = dirs::home_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("~"))
        .join(".config")
        .join("opta")
        .join("lmx-connections.json");

    if !file_path.exists() {
        return Ok(serde_json::json!({}));
    }

    let content = std::fs::read_to_string(&file_path).map_err(|e| e.to_string())?;
    let store: LmxConnectionsFile = serde_json::from_str(&content).map_err(|e| e.to_string())?;

    if let Some(entry) = store.entries.first() {
        Ok(serde_json::json!({ "host": entry.host, "port": entry.port, "tunnelUrl": entry.tunnel_url }))
    } else {
        Ok(serde_json::json!({}))
    }
}

#[tauri::command]
async fn bootstrap_zero_touch_install(
    app: tauri::AppHandle,
    channel: Option<String>,
) -> Result<serde_json::Value, String> {
    let normalized_channel = normalize_optional_channel(channel);
    let mut steps: Vec<Value> = Vec::new();
    let mut opta_program = "opta".to_string();

    // Step A: Ensure Opta CLI
    let ensure_cli_step = "ensure-opta-cli";
    emit_progress_line(
        &app,
        "zero-touch-progress",
        ensure_cli_step,
        "Checking for Opta CLI...",
        None,
    );

    if is_command_available("opta").await {
        emit_progress_line(
            &app,
            "zero-touch-progress",
            ensure_cli_step,
            "Opta CLI is already available.",
            Some(true),
        );
        push_step_result(
            &mut steps,
            ensure_cli_step,
            true,
            "Opta CLI is available.".to_string(),
            None,
            None,
            None,
        );
    } else {
        let npm_program =
            match ensure_npm_available_for_zero_touch(&app, "zero-touch-progress", ensure_cli_step)
                .await
            {
                Ok(program) => program,
                Err(error) => {
                    let message = format!(
                        "Opta CLI is missing and automatic Node/npm setup failed. {}",
                        error
                    );
                    emit_progress_line(
                        &app,
                        "zero-touch-progress",
                        ensure_cli_step,
                        message.clone(),
                        Some(false),
                    );
                    push_step_result(
                        &mut steps,
                        ensure_cli_step,
                        false,
                        message.clone(),
                        None,
                        None,
                        Some(error),
                    );
                    return Ok(serde_json::json!({
                        "ok": false,
                        "steps": steps,
                        "message": message
                    }));
                }
            };

        let cli_prefix = match opta_cli_prefix_dir() {
            Some(path) => path,
            None => {
                let message =
                    "Unable to resolve user install prefix for Opta CLI.".to_string();
                emit_progress_line(
                    &app,
                    "zero-touch-progress",
                    ensure_cli_step,
                    message.clone(),
                    Some(false),
                );
                push_step_result(
                    &mut steps,
                    ensure_cli_step,
                    false,
                    message.clone(),
                    None,
                    None,
                    None,
                );
                return Ok(serde_json::json!({
                    "ok": false,
                    "steps": steps,
                    "message": message
                }));
            }
        };

        if let Err(error) = fs::create_dir_all(&cli_prefix) {
            let message = format!("Failed to prepare Opta CLI install prefix: {}", error);
            emit_progress_line(
                &app,
                "zero-touch-progress",
                ensure_cli_step,
                message.clone(),
                Some(false),
            );
            push_step_result(
                &mut steps,
                ensure_cli_step,
                false,
                message.clone(),
                None,
                None,
                Some(error.to_string()),
            );
            return Ok(serde_json::json!({
                "ok": false,
                "steps": steps,
                "message": message
            }));
        }

        let cli_prefix_str = cli_prefix.to_string_lossy().to_string();
        let package_spec = resolve_opta_cli_package_spec(&normalized_channel).await;
        let base_args = vec![
            "install".to_string(),
            "-g".to_string(),
            "--prefix".to_string(),
            cli_prefix_str.clone(),
        ];
        let npm_args = {
            let mut args = base_args.clone();
            args.push(package_spec.clone());
            args
        };

        let mut npm_captured = match run_command_step(
            &app,
            "zero-touch-progress",
            ensure_cli_step,
            &npm_program,
            &npm_args,
            ZERO_TOUCH_COMMAND_TIMEOUT_SECS,
        )
        .await
        {
            Ok(captured) => captured,
            Err(error) => {
                let message = format!(
                    "Opta CLI install failed to start using `{}`: {}",
                    npm_program, error
                );
                push_step_result(
                    &mut steps,
                    ensure_cli_step,
                    false,
                    message.clone(),
                    Some(command_preview(&npm_program, &npm_args)),
                    None,
                    Some(error),
                );
                return Ok(serde_json::json!({
                    "ok": false,
                    "steps": steps,
                    "message": message
                }));
            }
        };

        if !npm_captured.success && package_spec != "@opta/opta-cli" {
            emit_progress_line(
                &app,
                "zero-touch-progress",
                ensure_cli_step,
                "Primary CLI package source failed. Retrying with npm registry package...",
                None,
            );
            let fallback_args = {
                let mut args = base_args.clone();
                args.push("@opta/opta-cli".to_string());
                args
            };
            if let Ok(fallback_captured) = run_command_step(
                &app,
                "zero-touch-progress",
                ensure_cli_step,
                &npm_program,
                &fallback_args,
                ZERO_TOUCH_COMMAND_TIMEOUT_SECS,
            )
            .await
            {
                npm_captured = fallback_captured;
            }
        }

        if !npm_captured.success {
            let details = command_error_message(&npm_captured, "Install output was empty.");
            let message = format!("Failed to install Opta CLI automatically. Details: {}", details);
            emit_progress_line(
                &app,
                "zero-touch-progress",
                ensure_cli_step,
                message.clone(),
                Some(false),
            );
            push_step_result(
                &mut steps,
                ensure_cli_step,
                false,
                message.clone(),
                Some(npm_captured.command),
                Some(npm_captured.stdout),
                Some(npm_captured.stderr),
            );
            return Ok(serde_json::json!({
                "ok": false,
                "steps": steps,
                "message": message
            }));
        }

        if is_command_available("opta").await {
            opta_program = "opta".to_string();
        } else {
            let prefixed_opta = cli_prefix.join("bin").join("opta");
            if prefixed_opta.exists() {
                opta_program = prefixed_opta.to_string_lossy().to_string();
                emit_progress_line(
                    &app,
                    "zero-touch-progress",
                    ensure_cli_step,
                    format!("Resolved Opta CLI at {}.", opta_program),
                    None,
                );
            } else {
                let message = format!(
                    "Opta CLI install finished but `opta` is still unavailable in PATH. Expected binary under `{}`.",
                    cli_prefix_str
                );
                emit_progress_line(
                    &app,
                    "zero-touch-progress",
                    ensure_cli_step,
                    message.clone(),
                    Some(false),
                );
                push_step_result(
                    &mut steps,
                    ensure_cli_step,
                    false,
                    message.clone(),
                    Some(npm_captured.command),
                    Some(npm_captured.stdout),
                    Some(npm_captured.stderr),
                );
                return Ok(serde_json::json!({
                    "ok": false,
                    "steps": steps,
                    "message": message
                }));
            }
        }

        emit_progress_line(
            &app,
            "zero-touch-progress",
            ensure_cli_step,
            "Opta CLI installed successfully.",
            Some(true),
        );
        push_step_result(
            &mut steps,
            ensure_cli_step,
            true,
            "Opta CLI installed successfully.".to_string(),
            Some(npm_captured.command),
            Some(npm_captured.stdout),
            Some(npm_captured.stderr),
        );
    }

    // Step B1: Register daemon service
    let daemon_install_step = "daemon-install";
    let daemon_install_args = vec![
        "daemon".to_string(),
        "install".to_string(),
    ];
    let daemon_install = match run_command_step(
        &app,
        "zero-touch-progress",
        daemon_install_step,
        &opta_program,
        &daemon_install_args,
        ZERO_TOUCH_COMMAND_TIMEOUT_SECS,
    )
    .await
    {
        Ok(captured) => captured,
        Err(error) => {
            push_step_result(
                &mut steps,
                daemon_install_step,
                false,
                error.clone(),
                Some(command_preview(&opta_program, &daemon_install_args)),
                None,
                Some(error.clone()),
            );
            return Ok(serde_json::json!({
                "ok": false,
                "steps": steps,
                "message": "Failed to register Opta daemon service. Ensure the Opta CLI is installed and retry."
            }));
        }
    };
    if !daemon_install.success {
        let details = command_error_message(
            &daemon_install,
            "Daemon install command failed.",
        );
        let message = format!(
            "Failed to register daemon service via `{}`. {}",
            daemon_install.command, details
        );
        emit_progress_line(
            &app,
            "zero-touch-progress",
            daemon_install_step,
            message.clone(),
            Some(false),
        );
        push_step_result(
            &mut steps,
            daemon_install_step,
            false,
            message.clone(),
            Some(daemon_install.command),
            Some(daemon_install.stdout),
            Some(daemon_install.stderr),
        );
        return Ok(serde_json::json!({
            "ok": false,
            "steps": steps,
            "message": message
        }));
    }
    emit_progress_line(
        &app,
        "zero-touch-progress",
        daemon_install_step,
        "Daemon service registered.",
        Some(true),
    );
    push_step_result(
        &mut steps,
        daemon_install_step,
        true,
        "Daemon service registered.".to_string(),
        Some(daemon_install.command),
        Some(daemon_install.stdout),
        Some(daemon_install.stderr),
    );

    // Step B2: Start daemon service
    let daemon_start_step = "daemon-start";
    let daemon_start_args = vec![
        "daemon".to_string(),
        "start".to_string(),
    ];
    let daemon_start = match run_command_step(
        &app,
        "zero-touch-progress",
        daemon_start_step,
        &opta_program,
        &daemon_start_args,
        ZERO_TOUCH_COMMAND_TIMEOUT_SECS,
    )
    .await
    {
        Ok(captured) => captured,
        Err(error) => {
            push_step_result(
                &mut steps,
                daemon_start_step,
                false,
                error.clone(),
                Some(command_preview(&opta_program, &daemon_start_args)),
                None,
                Some(error.clone()),
            );
            return Ok(serde_json::json!({
                "ok": false,
                "steps": steps,
                "message": "Failed to start Opta daemon service. Verify system permissions and retry."
            }));
        }
    };
    if !daemon_start.success {
        let details = command_error_message(
            &daemon_start,
            "Daemon start command failed.",
        );
        let message = format!(
            "Failed to start daemon via `{}`. {}",
            daemon_start.command, details
        );
        emit_progress_line(
            &app,
            "zero-touch-progress",
            daemon_start_step,
            message.clone(),
            Some(false),
        );
        push_step_result(
            &mut steps,
            daemon_start_step,
            false,
            message.clone(),
            Some(daemon_start.command),
            Some(daemon_start.stdout),
            Some(daemon_start.stderr),
        );
        return Ok(serde_json::json!({
            "ok": false,
            "steps": steps,
            "message": message
        }));
    }
    emit_progress_line(
        &app,
        "zero-touch-progress",
        daemon_start_step,
        "Daemon service started.",
        Some(true),
    );
    push_step_result(
        &mut steps,
        daemon_start_step,
        true,
        "Daemon service started.".to_string(),
        Some(daemon_start.command),
        Some(daemon_start.stdout),
        Some(daemon_start.stderr),
    );

    // Step C: Install Opta Code Universal with fallback command
    let install_app_step = "install-opta-code-universal";
    let install_primary_args = vec![
        "apps".to_string(),
        "install".to_string(),
        "opta-code-universal".to_string(),
        "--channel".to_string(),
        normalized_channel.clone(),
    ];

    let install_primary = match run_command_step(
        &app,
        "zero-touch-progress",
        install_app_step,
        &opta_program,
        &install_primary_args,
        ZERO_TOUCH_COMMAND_TIMEOUT_SECS,
    )
    .await
    {
        Ok(captured) => captured,
        Err(error) => {
            push_step_result(
                &mut steps,
                install_app_step,
                false,
                error.clone(),
                Some(command_preview(&opta_program, &install_primary_args)),
                None,
                Some(error.clone()),
            );
            return Ok(serde_json::json!({
                "ok": false,
                "steps": steps,
                "message": "Failed to install Opta Code Universal. Ensure the Opta daemon is running and retry."
            }));
        }
    };

    if install_primary.success {
        emit_progress_line(
            &app,
            "zero-touch-progress",
            install_app_step,
            "Opta Code Universal installed.",
            Some(true),
        );
        push_step_result(
            &mut steps,
            install_app_step,
            true,
            format!("Installed Opta Code Universal on `{}` channel.", normalized_channel),
            Some(install_primary.command),
            Some(install_primary.stdout),
            Some(install_primary.stderr),
        );
    } else {
        emit_progress_line(
            &app,
            "zero-touch-progress",
            install_app_step,
            "Primary command failed. Retrying with fallback `opta app install`...",
            None,
        );
        let install_fallback_args = vec![
            "app".to_string(),
            "install".to_string(),
            "opta-code-universal".to_string(),
            "--channel".to_string(),
            normalized_channel.clone(),
        ];
        let install_fallback = match run_command_step(
            &app,
            "zero-touch-progress",
            install_app_step,
            &opta_program,
            &install_fallback_args,
            ZERO_TOUCH_COMMAND_TIMEOUT_SECS,
        )
        .await
        {
            Ok(captured) => captured,
            Err(error) => {
                let message = format!(
                    "Both install commands failed. Primary error: {}. Fallback error: {}",
                    command_error_message(&install_primary, "Primary install failed."),
                    error
                );
                emit_progress_line(
                    &app,
                    "zero-touch-progress",
                    install_app_step,
                    message.clone(),
                    Some(false),
                );
                push_step_result(
                    &mut steps,
                    install_app_step,
                    false,
                    message.clone(),
                    Some(command_preview(&opta_program, &install_fallback_args)),
                    None,
                    Some(error),
                );
                return Ok(serde_json::json!({
                    "ok": false,
                    "steps": steps,
                    "message": message
                }));
            }
        };

        if !install_fallback.success {
            let message = format!(
                "Failed to install Opta Code Universal with both command variants. Primary: {}. Fallback: {}",
                command_error_message(&install_primary, "Primary install failed."),
                command_error_message(&install_fallback, "Fallback install failed.")
            );
            emit_progress_line(
                &app,
                "zero-touch-progress",
                install_app_step,
                message.clone(),
                Some(false),
            );
            push_step_result(
                &mut steps,
                install_app_step,
                false,
                message.clone(),
                Some(install_fallback.command),
                Some(install_fallback.stdout),
                Some(install_fallback.stderr),
            );
            return Ok(serde_json::json!({
                "ok": false,
                "steps": steps,
                "message": message
            }));
        }

        emit_progress_line(
            &app,
            "zero-touch-progress",
            install_app_step,
            "Opta Code Universal installed with fallback command.",
            Some(true),
        );
        push_step_result(
            &mut steps,
            install_app_step,
            true,
            format!(
                "Installed Opta Code Universal via fallback command after primary failed: {}",
                command_error_message(&install_primary, "Primary install command failed.")
            ),
            Some(install_fallback.command),
            Some(install_fallback.stdout),
            Some(install_fallback.stderr),
        );
    }

    // Step D: Launch Opta Code with fallback command
    let launch_app_step = "launch-opta-code-universal";
    let launch_primary_args = vec![
        "apps".to_string(),
        "launch".to_string(),
        "opta-code-universal".to_string(),
    ];
    let launch_primary = match run_command_step(
        &app,
        "zero-touch-progress",
        launch_app_step,
        &opta_program,
        &launch_primary_args,
        ZERO_TOUCH_COMMAND_TIMEOUT_SECS,
    )
    .await
    {
        Ok(captured) => captured,
        Err(error) => {
            push_step_result(
                &mut steps,
                launch_app_step,
                false,
                error.clone(),
                Some(command_preview(&opta_program, &launch_primary_args)),
                None,
                Some(error.clone()),
            );
            return Ok(serde_json::json!({
                "ok": false,
                "steps": steps,
                "message": "Failed to launch Opta Code Universal. Ensure the app was installed correctly."
            }));
        }
    };

    if launch_primary.success {
        emit_progress_line(
            &app,
            "zero-touch-progress",
            launch_app_step,
            "Opta Code Universal launched.",
            Some(true),
        );
        push_step_result(
            &mut steps,
            launch_app_step,
            true,
            "Opta Code Universal launched.".to_string(),
            Some(launch_primary.command),
            Some(launch_primary.stdout),
            Some(launch_primary.stderr),
        );
    } else {
        emit_progress_line(
            &app,
            "zero-touch-progress",
            launch_app_step,
            "Primary launch command failed. Retrying with fallback `opta app launch`...",
            None,
        );
        let launch_fallback_args = vec![
            "app".to_string(),
            "launch".to_string(),
            "opta-code-universal".to_string(),
        ];
        let launch_fallback = match run_command_step(
            &app,
            "zero-touch-progress",
            launch_app_step,
            &opta_program,
            &launch_fallback_args,
            ZERO_TOUCH_COMMAND_TIMEOUT_SECS,
        )
        .await
        {
            Ok(captured) => captured,
            Err(error) => {
                let message = format!(
                    "Both launch commands failed. Primary error: {}. Fallback error: {}",
                    command_error_message(&launch_primary, "Primary launch failed."),
                    error
                );
                emit_progress_line(
                    &app,
                    "zero-touch-progress",
                    launch_app_step,
                    message.clone(),
                    Some(false),
                );
                push_step_result(
                    &mut steps,
                    launch_app_step,
                    false,
                    message.clone(),
                    Some(command_preview(&opta_program, &launch_fallback_args)),
                    None,
                    Some(error),
                );
                return Ok(serde_json::json!({
                    "ok": false,
                    "steps": steps,
                    "message": message
                }));
            }
        };

        if !launch_fallback.success {
            let message = format!(
                "Failed to launch Opta Code Universal with both command variants. Primary: {}. Fallback: {}",
                command_error_message(&launch_primary, "Primary launch failed."),
                command_error_message(&launch_fallback, "Fallback launch failed.")
            );
            emit_progress_line(
                &app,
                "zero-touch-progress",
                launch_app_step,
                message.clone(),
                Some(false),
            );
            push_step_result(
                &mut steps,
                launch_app_step,
                false,
                message.clone(),
                Some(launch_fallback.command),
                Some(launch_fallback.stdout),
                Some(launch_fallback.stderr),
            );
            return Ok(serde_json::json!({
                "ok": false,
                "steps": steps,
                "message": message
            }));
        }

        emit_progress_line(
            &app,
            "zero-touch-progress",
            launch_app_step,
            "Opta Code Universal launched with fallback command.",
            Some(true),
        );
        push_step_result(
            &mut steps,
            launch_app_step,
            true,
            format!(
                "Launched Opta Code Universal via fallback command after primary failed: {}",
                command_error_message(&launch_primary, "Primary launch command failed.")
            ),
            Some(launch_fallback.command),
            Some(launch_fallback.stdout),
            Some(launch_fallback.stderr),
        );
    }

    Ok(serde_json::json!({
        "ok": true,
        "steps": steps,
        "message": "Zero-touch install completed successfully."
    }))
}

#[tauri::command]
async fn enable_opta_anywhere(
    app: tauri::AppHandle,
    lmx_host: String,
    lmx_port: u16,
    tunnel_name: Option<String>,
) -> Result<serde_json::Value, String> {
    let ensure_cloudflared_step = "ensure-cloudflared";
    emit_progress_line(
        &app,
        "opta-anywhere-progress",
        ensure_cloudflared_step,
        "Ensuring cloudflared is installed...",
        None,
    );
    let install_result = match install_cloudflared(app.clone()).await {
        Ok(result) => result,
        Err(error) => {
            let message = format!("Failed to run cloudflared install: {}", error);
            emit_progress_line(
                &app,
                "opta-anywhere-progress",
                ensure_cloudflared_step,
                message.clone(),
                Some(false),
            );
            return Ok(serde_json::json!({
                "ok": false,
                "tunnelUrl": Value::Null,
                "message": message
            }));
        }
    };
    if !install_result.ok {
        let message = install_result
            .message
            .unwrap_or_else(|| "cloudflared installation failed. Retry install or install cloudflared manually, then try again.".to_string());
        emit_progress_line(
            &app,
            "opta-anywhere-progress",
            ensure_cloudflared_step,
            message.clone(),
            Some(false),
        );
        return Ok(serde_json::json!({
            "ok": false,
            "tunnelUrl": Value::Null,
            "message": message
        }));
    }
    emit_progress_line(
        &app,
        "opta-anywhere-progress",
        ensure_cloudflared_step,
        "cloudflared is ready.",
        Some(true),
    );

    let login_step = "cloudflared-login";
    let cert_path = dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("~"))
        .join(".cloudflared")
        .join("cert.pem");
    if cert_path.exists() {
        emit_progress_line(
            &app,
            "opta-anywhere-progress",
            login_step,
            "Cloudflare auth certificate already present.",
            Some(true),
        );
    } else {
        emit_progress_line(
            &app,
            "opta-anywhere-progress",
            login_step,
            "No Cloudflare certificate found. Starting login flow...",
            None,
        );
        if let Err(error) = start_cloudflared_login().await {
            let message = format!(
                "Cloudflare login was not completed. Re-run login and approve access in your browser. {}",
                error
            );
            emit_progress_line(
                &app,
                "opta-anywhere-progress",
                login_step,
                message.clone(),
                Some(false),
            );
            return Ok(serde_json::json!({
                "ok": false,
                "tunnelUrl": Value::Null,
                "message": message
            }));
        }
        emit_progress_line(
            &app,
            "opta-anywhere-progress",
            login_step,
            "Cloudflare login completed.",
            Some(true),
        );
    }

    let provision_step = "provision-tunnel";
    let name = tunnel_name
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| default_tunnel_name(&lmx_host, lmx_port));
    emit_progress_line(
        &app,
        "opta-anywhere-progress",
        provision_step,
        format!("Provisioning tunnel `{}`...", name),
        None,
    );
    let provision = match provision_cloudflared_tunnel(
        app.clone(),
        name,
        lmx_host.clone(),
        lmx_port,
    )
    .await
    {
        Ok(result) => result,
        Err(error) => {
            let message = format!("Failed to provision tunnel: {}", error);
            emit_progress_line(
                &app,
                "opta-anywhere-progress",
                provision_step,
                message.clone(),
                Some(false),
            );
            return Ok(serde_json::json!({
                "ok": false,
                "tunnelUrl": Value::Null,
                "message": message
            }));
        }
    };
    if !provision.ok || provision.url.trim().is_empty() {
        let message = provision
            .message
            .unwrap_or_else(|| "Cloudflare tunnel provisioning failed.".to_string());
        emit_progress_line(
            &app,
            "opta-anywhere-progress",
            provision_step,
            message.clone(),
            Some(false),
        );
        return Ok(serde_json::json!({
            "ok": false,
            "tunnelUrl": Value::Null,
            "message": message
        }));
    }
    emit_progress_line(
        &app,
        "opta-anywhere-progress",
        provision_step,
        format!("Tunnel provisioned: {}", provision.url),
        Some(true),
    );

    let write_step = "write-address-book";
    emit_progress_line(
        &app,
        "opta-anywhere-progress",
        write_step,
        "Saving tunnel URL to shared address book...",
        None,
    );
    if let Err(error) = write_tunnel_to_address_book(
        lmx_host,
        lmx_port,
        provision.url.clone(),
    )
    .await
    {
        let message = format!("Tunnel created but failed to save address-book entry: {}", error);
        emit_progress_line(
            &app,
            "opta-anywhere-progress",
            write_step,
            message.clone(),
            Some(false),
        );
        return Ok(serde_json::json!({
            "ok": false,
            "tunnelUrl": provision.url,
            "message": message
        }));
    }
    emit_progress_line(
        &app,
        "opta-anywhere-progress",
        write_step,
        "Address-book entry updated.",
        Some(true),
    );

    Ok(serde_json::json!({
        "ok": true,
        "tunnelUrl": provision.url,
        "message": "Opta Anywhere is enabled."
    }))
}

#[tauri::command]
fn detect_brain_eligibility() -> serde_json::Value {
    let platform = std::env::consts::OS.to_string();
    let arch = std::env::consts::ARCH.to_string();
    let eligible = platform == "macos" && matches!(arch.as_str(), "aarch64" | "arm64");
    let reason = if eligible {
        "Eligible for local AI brain install.".to_string()
    } else if platform != "macos" {
        format!(
            "Local AI brain currently supports macOS Apple Silicon only. Detected platform `{}`.",
            platform
        )
    } else {
        format!(
            "Local AI brain currently supports arm64/aarch64 only. Detected arch `{}`.",
            arch
        )
    };

    serde_json::json!({
        "eligible": eligible,
        "platform": platform,
        "arch": arch,
        "reason": reason
    })
}

#[tauri::command]
fn detect_opta_anywhere_support() -> serde_json::Value {
    let platform = std::env::consts::OS.to_string();
    let supported = matches!(platform.as_str(), "macos" | "windows" | "linux");
    let reason = if supported {
        "Opta Anywhere is supported on this platform.".to_string()
    } else {
        format!(
            "Opta Anywhere is currently unsupported on platform `{}`.",
            platform
        )
    };

    serde_json::json!({
        "supported": supported,
        "platform": platform,
        "reason": reason
    })
}

#[tauri::command]
async fn install_local_ai_brain(
    app: tauri::AppHandle,
    model_id: Option<String>,
) -> Result<serde_json::Value, String> {
    let resolved_model_id = model_id
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "mlx-community/Kimi-K2.5-3bit".to_string());

    let eligibility_step = "eligibility";
    emit_progress_line(
        &app,
        "brain-install-progress",
        eligibility_step,
        "Checking platform eligibility...",
        None,
    );
    let eligibility = detect_brain_eligibility();
    let eligible = eligibility
        .get("eligible")
        .and_then(|value| value.as_bool())
        .unwrap_or(false);
    let eligibility_reason = eligibility
        .get("reason")
        .and_then(|value| value.as_str())
        .unwrap_or("Unsupported platform.");

    if !eligible {
        emit_progress_line(
            &app,
            "brain-install-progress",
            eligibility_step,
            eligibility_reason.to_string(),
            Some(false),
        );
        return Ok(serde_json::json!({
            "ok": false,
            "modelId": resolved_model_id,
            "venvPath": Value::Null,
            "modelsPath": Value::Null,
            "message": eligibility_reason
        }));
    }
    emit_progress_line(
        &app,
        "brain-install-progress",
        eligibility_step,
        eligibility_reason.to_string(),
        Some(true),
    );

    let home_dir = match dirs::home_dir() {
        Some(path) => path,
        None => {
            let message = "Unable to resolve home directory.".to_string();
            emit_progress_line(
                &app,
                "brain-install-progress",
                "prepare-paths",
                message.clone(),
                Some(false),
            );
            return Ok(serde_json::json!({
                "ok": false,
                "modelId": resolved_model_id,
                "venvPath": Value::Null,
                "modelsPath": Value::Null,
                "message": message
            }));
        }
    };
    let opta_lmx_dir = home_dir.join(".opta-lmx");
    let venv_path = opta_lmx_dir.join(".venv");
    let models_path = opta_lmx_dir.join("models");
    if let Err(error) = fs::create_dir_all(&models_path) {
        let message = format!("Failed to prepare model directory: {}", error);
        emit_progress_line(
            &app,
            "brain-install-progress",
            "prepare-paths",
            message.clone(),
            Some(false),
        );
        return Ok(serde_json::json!({
            "ok": false,
            "modelId": resolved_model_id,
            "venvPath": venv_path.to_string_lossy().to_string(),
            "modelsPath": models_path.to_string_lossy().to_string(),
            "message": message
        }));
    }

    let venv_path_str = venv_path.to_string_lossy().to_string();
    let models_path_str = models_path.to_string_lossy().to_string();
    let venv_python = venv_path.join("bin").join("python");
    let venv_python_str = venv_python.to_string_lossy().to_string();

    let uv_program: String;
    let mut uv_prefix_args: Vec<String> = Vec::new();

    let ensure_uv_step = "ensure-uv";
    emit_progress_line(
        &app,
        "brain-install-progress",
        ensure_uv_step,
        "Ensuring `uv` is installed...",
        None,
    );
    if !is_command_available("uv").await {
        emit_progress_line(
            &app,
            "brain-install-progress",
            ensure_uv_step,
            "`uv` is missing. Attempting automatic install...",
            None,
        );

        if is_command_available("brew").await {
            let brew_args = vec!["install".to_string(), "uv".to_string()];
            let _ = run_command_step(
                &app,
                "brain-install-progress",
                ensure_uv_step,
                "brew",
                &brew_args,
                ZERO_TOUCH_COMMAND_TIMEOUT_SECS,
            )
            .await;
        }

        if !is_command_available("uv").await {
            let python_cmd = match find_python_command().await {
                Some(command) => command,
                None => {
                    let message = "Unable to install `uv` automatically. No Python runtime was found on this machine.".to_string();
                    emit_progress_line(
                        &app,
                        "brain-install-progress",
                        ensure_uv_step,
                        message.clone(),
                        Some(false),
                    );
                    return Ok(serde_json::json!({
                        "ok": false,
                        "modelId": resolved_model_id,
                        "venvPath": venv_path_str,
                        "modelsPath": models_path_str,
                        "message": message
                    }));
                }
            };

            let pip_args = vec![
                "-m".to_string(),
                "pip".to_string(),
                "install".to_string(),
                "--user".to_string(),
                "uv".to_string(),
            ];
            let pip_install = match run_command_step(
                &app,
                "brain-install-progress",
                ensure_uv_step,
                &python_cmd,
                &pip_args,
                ZERO_TOUCH_COMMAND_TIMEOUT_SECS,
            )
            .await
            {
                Ok(captured) => captured,
                Err(error) => {
                    let message = format!("Unable to install `uv` automatically: {}", error);
                    emit_progress_line(
                        &app,
                        "brain-install-progress",
                        ensure_uv_step,
                        message.clone(),
                        Some(false),
                    );
                    return Ok(serde_json::json!({
                        "ok": false,
                        "modelId": resolved_model_id,
                        "venvPath": venv_path_str,
                        "modelsPath": models_path_str,
                        "message": message
                    }));
                }
            };

            if pip_install.success && is_command_available("uv").await {
                uv_program = "uv".to_string();
            } else {
                let uv_check_args = vec![
                    "-m".to_string(),
                    "uv".to_string(),
                    "--version".to_string(),
                ];
                let uv_check = run_command_step(
                    &app,
                    "brain-install-progress",
                    ensure_uv_step,
                    &python_cmd,
                    &uv_check_args,
                    ZERO_TOUCH_COMMAND_TIMEOUT_SECS,
                )
                .await;

                match uv_check {
                    Ok(captured) if captured.success => {
                        uv_program = python_cmd;
                        uv_prefix_args = vec!["-m".to_string(), "uv".to_string()];
                    }
                    Ok(captured) => {
                        let message = format!(
                            "Unable to install `uv` automatically. {}",
                            command_error_message(&captured, "python -m uv check failed.")
                        );
                        emit_progress_line(
                            &app,
                            "brain-install-progress",
                            ensure_uv_step,
                            message.clone(),
                            Some(false),
                        );
                        return Ok(serde_json::json!({
                            "ok": false,
                            "modelId": resolved_model_id,
                            "venvPath": venv_path_str,
                            "modelsPath": models_path_str,
                            "message": message
                        }));
                    }
                    Err(error) => {
                        let message = format!("Unable to install `uv` automatically: {}", error);
                        emit_progress_line(
                            &app,
                            "brain-install-progress",
                            ensure_uv_step,
                            message.clone(),
                            Some(false),
                        );
                        return Ok(serde_json::json!({
                            "ok": false,
                            "modelId": resolved_model_id,
                            "venvPath": venv_path_str,
                            "modelsPath": models_path_str,
                            "message": message
                        }));
                    }
                }
            }
        } else {
            uv_program = "uv".to_string();
        }
    } else {
        uv_program = "uv".to_string();
    }
    emit_progress_line(
        &app,
        "brain-install-progress",
        ensure_uv_step,
        "`uv` is available.",
        Some(true),
    );

    let create_venv_step = "create-venv";
    let create_venv_args = prepend_args(
        &uv_prefix_args,
        &["venv".to_string(), venv_path_str.clone()],
    );
    let create_venv = match run_command_step(
        &app,
        "brain-install-progress",
        create_venv_step,
        &uv_program,
        &create_venv_args,
        ZERO_TOUCH_COMMAND_TIMEOUT_SECS,
    )
    .await
    {
        Ok(captured) => captured,
        Err(error) => {
            let message = format!(
                "Failed to create virtual environment at `{}`: {}",
                venv_path_str, error
            );
            emit_progress_line(
                &app,
                "brain-install-progress",
                create_venv_step,
                message.clone(),
                Some(false),
            );
            return Ok(serde_json::json!({
                "ok": false,
                "modelId": resolved_model_id,
                "venvPath": venv_path_str,
                "modelsPath": models_path_str,
                "message": message
            }));
        }
    };
    if !create_venv.success {
        let message = format!(
            "Failed to create virtual environment at `{}`: {}",
            venv_path_str,
            command_error_message(&create_venv, "uv venv failed.")
        );
        emit_progress_line(
            &app,
            "brain-install-progress",
            create_venv_step,
            message.clone(),
            Some(false),
        );
        return Ok(serde_json::json!({
            "ok": false,
            "modelId": resolved_model_id,
            "venvPath": venv_path_str,
            "modelsPath": models_path_str,
            "message": message
        }));
    }
    emit_progress_line(
        &app,
        "brain-install-progress",
        create_venv_step,
        "Virtual environment prepared.",
        Some(true),
    );

    let install_mlx_step = "install-mlx-lm";
    let install_mlx_args = prepend_args(
        &uv_prefix_args,
        &[
            "pip".to_string(),
            "install".to_string(),
            "--python".to_string(),
            venv_python_str.clone(),
            "mlx-lm".to_string(),
        ],
    );
    let install_mlx = match run_command_step(
        &app,
        "brain-install-progress",
        install_mlx_step,
        &uv_program,
        &install_mlx_args,
        BRAIN_INSTALL_COMMAND_TIMEOUT_SECS,
    )
    .await
    {
        Ok(captured) => captured,
        Err(error) => {
            let message = format!("Failed to install `mlx-lm`: {}", error);
            emit_progress_line(
                &app,
                "brain-install-progress",
                install_mlx_step,
                message.clone(),
                Some(false),
            );
            return Ok(serde_json::json!({
                "ok": false,
                "modelId": resolved_model_id,
                "venvPath": venv_path_str,
                "modelsPath": models_path_str,
                "message": message
            }));
        }
    };
    if !install_mlx.success {
        let message = format!(
            "Failed to install `mlx-lm`: {}",
            command_error_message(&install_mlx, "uv pip install mlx-lm failed.")
        );
        emit_progress_line(
            &app,
            "brain-install-progress",
            install_mlx_step,
            message.clone(),
            Some(false),
        );
        return Ok(serde_json::json!({
            "ok": false,
            "modelId": resolved_model_id,
            "venvPath": venv_path_str,
            "modelsPath": models_path_str,
            "message": message
        }));
    }
    emit_progress_line(
        &app,
        "brain-install-progress",
        install_mlx_step,
        "`mlx-lm` installed.",
        Some(true),
    );

    let download_step = "download-model";
    emit_progress_line(
        &app,
        "brain-install-progress",
        download_step,
        format!("Downloading model `{}`...", resolved_model_id),
        None,
    );

    if is_command_available("opta").await {
        let download_args = vec![
            "models".to_string(),
            "download".to_string(),
            resolved_model_id.clone(),
        ];
        let opta_download = match run_command_step(
            &app,
            "brain-install-progress",
            download_step,
            "opta",
            &download_args,
            BRAIN_INSTALL_COMMAND_TIMEOUT_SECS,
        )
        .await
        {
            Ok(captured) => captured,
            Err(error) => {
                let message = format!("Opta CLI model download failed to start: {}", error);
                emit_progress_line(
                    &app,
                    "brain-install-progress",
                    download_step,
                    message.clone(),
                    Some(false),
                );
                return Ok(serde_json::json!({
                    "ok": false,
                    "modelId": resolved_model_id,
                    "venvPath": venv_path_str,
                    "modelsPath": models_path_str,
                    "message": message
                }));
            }
        };
        if !opta_download.success {
            let message = format!(
                "Opta CLI model download failed: {}",
                command_error_message(&opta_download, "opta models download failed.")
            );
            emit_progress_line(
                &app,
                "brain-install-progress",
                download_step,
                message.clone(),
                Some(false),
            );
            return Ok(serde_json::json!({
                "ok": false,
                "modelId": resolved_model_id,
                "venvPath": venv_path_str,
                "modelsPath": models_path_str,
                "message": message
            }));
        }
    } else {
        emit_progress_line(
            &app,
            "brain-install-progress",
            download_step,
            "Opta CLI unavailable; using Hugging Face snapshot fallback.",
            None,
        );
        let install_hf_args = prepend_args(
            &uv_prefix_args,
            &[
                "pip".to_string(),
                "install".to_string(),
                "--python".to_string(),
                venv_python_str.clone(),
                "huggingface_hub".to_string(),
            ],
        );
        let install_hf = match run_command_step(
            &app,
            "brain-install-progress",
            download_step,
            &uv_program,
            &install_hf_args,
            BRAIN_INSTALL_COMMAND_TIMEOUT_SECS,
        )
        .await
        {
            Ok(captured) => captured,
            Err(error) => {
                let message = format!(
                    "Failed to install Hugging Face downloader dependency: {}",
                    error
                );
                emit_progress_line(
                    &app,
                    "brain-install-progress",
                    download_step,
                    message.clone(),
                    Some(false),
                );
                return Ok(serde_json::json!({
                    "ok": false,
                    "modelId": resolved_model_id,
                    "venvPath": venv_path_str,
                    "modelsPath": models_path_str,
                    "message": message
                }));
            }
        };
        if !install_hf.success {
            let message = format!(
                "Failed to install Hugging Face downloader dependency: {}",
                command_error_message(&install_hf, "uv pip install huggingface_hub failed.")
            );
            emit_progress_line(
                &app,
                "brain-install-progress",
                download_step,
                message.clone(),
                Some(false),
            );
            return Ok(serde_json::json!({
                "ok": false,
                "modelId": resolved_model_id,
                "venvPath": venv_path_str,
                "modelsPath": models_path_str,
                "message": message
            }));
        }

        let python_script = format!(
            "from huggingface_hub import snapshot_download; snapshot_download(repo_id={:?}, local_dir={:?})",
            resolved_model_id, models_path_str
        );
        let python_args = vec!["-c".to_string(), python_script];
        let hf_download = match run_command_step(
            &app,
            "brain-install-progress",
            download_step,
            &venv_python_str,
            &python_args,
            BRAIN_INSTALL_COMMAND_TIMEOUT_SECS,
        )
        .await
        {
            Ok(captured) => captured,
            Err(error) => {
                let message = format!("Hugging Face fallback model download failed to start: {}", error);
                emit_progress_line(
                    &app,
                    "brain-install-progress",
                    download_step,
                    message.clone(),
                    Some(false),
                );
                return Ok(serde_json::json!({
                    "ok": false,
                    "modelId": resolved_model_id,
                    "venvPath": venv_path_str,
                    "modelsPath": models_path_str,
                    "message": message
                }));
            }
        };
        if !hf_download.success {
            let message = format!(
                "Hugging Face fallback model download failed: {}",
                command_error_message(&hf_download, "snapshot_download failed.")
            );
            emit_progress_line(
                &app,
                "brain-install-progress",
                download_step,
                message.clone(),
                Some(false),
            );
            return Ok(serde_json::json!({
                "ok": false,
                "modelId": resolved_model_id,
                "venvPath": venv_path_str,
                "modelsPath": models_path_str,
                "message": message
            }));
        }
    }

    emit_progress_line(
        &app,
        "brain-install-progress",
        download_step,
        "Model download completed.",
        Some(true),
    );

    Ok(serde_json::json!({
        "ok": true,
        "modelId": resolved_model_id,
        "venvPath": venv_path_str,
        "modelsPath": models_path_str,
        "message": "Local AI brain installed successfully."
    }))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            fetch_manifest,
            list_installed_apps,
            install_app,
            update_app,
            uninstall_app,
            launch_app,
            verify_app,
            open_app_folder,
            daemon_status,
            daemon_start,
            daemon_stop,
            fetch_daemon_jobs,
            kill_daemon_job,
            restart_daemon_job,
            open_url,
            check_manager_update,
            install_manager_update,
            check_dependency_status,
            install_dependency,
            save_opta_config,
            get_account_status,
            trigger_login,
            trigger_logout,
            install_cloudflared,
            start_cloudflared_login,
            provision_cloudflared_tunnel,
            write_tunnel_to_address_book,
            get_lmx_connection,
            bootstrap_zero_touch_install,
            enable_opta_anywhere,
            detect_brain_eligibility,
            detect_opta_anywhere_support,
            install_local_ai_brain,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
