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

fn normalize_optional_channel(channel: Option<String>) -> String {
    normalize_channel(channel.as_deref().unwrap_or("stable"))
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
            let captured = run_command_stream(
                &app, 
                "cli", 
                "npm", 
                &["install".to_string(), "-g".to_string(), "@opta/opta-cli".to_string()]
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
            trigger_logout
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
