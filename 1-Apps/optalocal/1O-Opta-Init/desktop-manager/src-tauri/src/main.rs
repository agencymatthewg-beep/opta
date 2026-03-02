use reqwest::Url;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    collections::HashSet,
    fs,
    path::PathBuf,
    process::Stdio,
    time::Duration,
};
use thiserror::Error;
use tokio::process::Command;

#[derive(Debug, Error)]
enum ManagerError {
    #[error("required CLI `{0}` was not found in PATH")]
    MissingCli(String),
    #[error("failed to run command `{command}`: {detail}")]
    Spawn { command: String, detail: String },
    #[error("command `{command}` failed (exit code: {code:?}): {stderr}")]
    CommandFailed {
        command: String,
        code: Option<i32>,
        stderr: String,
    },
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
    commands: Option<AppCommands>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ManifestPayload {
    channel: String,
    updated_at: Option<String>,
    apps: Vec<ManifestApp>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ReleaseControlManifest {
    channel: String,
    published_at: Option<String>,
    components: Vec<ReleaseControlComponent>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ReleaseControlComponent {
    id: String,
    display_name: Option<String>,
    version: String,
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
    Command::new(program)
        .arg("--version")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .await
        .is_ok()
}

async fn run_command_capture(program: &str, args: &[String]) -> Result<CapturedOutput, ManagerError> {
    let cmd_preview = command_preview(program, args);
    let output = Command::new(program)
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await
        .map_err(|error| ManagerError::Spawn {
            command: cmd_preview.clone(),
            detail: error.to_string(),
        })?;

    Ok(CapturedOutput {
        command: cmd_preview,
        exit_code: output.status.code(),
        success: output.status.success(),
        stdout: String::from_utf8_lossy(&output.stdout).trim().to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).trim().to_string(),
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

fn default_manifest(channel: &str) -> ManifestPayload {
    ManifestPayload {
        channel: channel.to_string(),
        updated_at: Some(current_timestamp()),
        apps: vec![
            ManifestApp {
                id: "opta-code-desktop".to_string(),
                name: "Opta Code Desktop".to_string(),
                description: "Desktop runtime for local agent workflows.".to_string(),
                version: "0.1.0".to_string(),
                website: Some("https://init.optalocal.com/apps/opta-code-desktop".to_string()),
                commands: Some(AppCommands {
                    install: Some(vec!["opta".to_string(), "apps".to_string(), "install".to_string(), "opta-code-desktop".to_string()]),
                    update: Some(vec!["opta".to_string(), "apps".to_string(), "update".to_string(), "opta-code-desktop".to_string()]),
                    launch: Some(vec!["opta".to_string(), "apps".to_string(), "launch".to_string(), "opta-code-desktop".to_string()]),
                }),
            },
            ManifestApp {
                id: "opta-init".to_string(),
                name: "Opta Init".to_string(),
                description: "App bootstrapper and channel manager.".to_string(),
                version: "0.1.0".to_string(),
                website: Some("https://init.optalocal.com".to_string()),
                commands: Some(AppCommands {
                    install: Some(vec!["opta".to_string(), "apps".to_string(), "install".to_string(), "opta-init".to_string()]),
                    update: Some(vec!["opta".to_string(), "apps".to_string(), "update".to_string(), "opta-init".to_string()]),
                    launch: Some(vec!["opta".to_string(), "apps".to_string(), "launch".to_string(), "opta-init".to_string()]),
                }),
            },
            ManifestApp {
                id: "opta-lmx".to_string(),
                name: "Opta LMX".to_string(),
                description: "Model exchange and artifact orchestration tools.".to_string(),
                version: "0.1.0".to_string(),
                website: Some("https://lmx.optalocal.com".to_string()),
                commands: Some(AppCommands {
                    install: Some(vec!["opta".to_string(), "apps".to_string(), "install".to_string(), "opta-lmx".to_string()]),
                    update: Some(vec!["opta".to_string(), "apps".to_string(), "update".to_string(), "opta-lmx".to_string()]),
                    launch: Some(vec!["opta".to_string(), "apps".to_string(), "launch".to_string(), "opta-lmx".to_string()]),
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
        "opta-cli" => "Command-line interface for install/update and workflow orchestration.".to_string(),
        "opta-lmx" => "Model exchange and artifact orchestration runtime.".to_string(),
        "opta-code-universal" => "Desktop coding surface for Opta operator workflows.".to_string(),
        "opta-daemon" => "Background daemon required for local runtime services.".to_string(),
        _ => "Managed Opta component.".to_string(),
    }
}

fn release_component_website(id: &str) -> Option<String> {
    match id {
        "opta-cli" => Some("https://init.optalocal.com/downloads/cli".to_string()),
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
                commands: Some(release_component_commands(&component.id)),
            }
        })
        .collect();

    ManifestPayload {
        channel: release_manifest.channel,
        updated_at: release_manifest.published_at,
        apps,
    }
}

fn normalize_manifest_payload(value: Value, fallback_channel: &str) -> Option<ManifestPayload> {
    if let Ok(mut manifest) = serde_json::from_value::<ManifestPayload>(value.clone()) {
        if manifest.channel.is_empty() {
            manifest.channel = fallback_channel.to_string();
        }
        return Some(manifest);
    }

    if let Some(manifest_value) = value.get("manifest") {
        if let Ok(mut manifest) = serde_json::from_value::<ManifestPayload>(manifest_value.clone()) {
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

    match channel {
        "beta" => "https://init.optalocal.com/desktop/manifest-beta.json".to_string(),
        _ => "https://init.optalocal.com/desktop/manifest-stable.json".to_string(),
    }
}

#[tauri::command]
async fn fetch_manifest(channel: String, manifest_url: Option<String>) -> Result<ManifestResponse, String> {
    let normalized_channel = normalize_channel(&channel);
    let url = manifest_url_for(&normalized_channel, manifest_url);

    let parsed_url = Url::parse(&url).map_err(|error| ManagerError::InvalidUrl(error.to_string()).to_string())?;
    if parsed_url.scheme() != "http" && parsed_url.scheme() != "https" {
        return Err(ManagerError::InvalidUrl("Only http/https URLs are allowed".to_string()).to_string());
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|error| error.to_string())?;

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
                Ok(ManifestResponse {
                    manifest,
                    source: url,
                    warning: None,
                })
            } else {
                Ok(ManifestResponse {
                    manifest: default_manifest(&normalized_channel),
                    source: "embedded-fallback".to_string(),
                    warning: Some("Manifest payload could not be parsed. Using fallback manifest.".to_string()),
                })
            }
        }
        Err(error) => Ok(ManifestResponse {
            manifest: default_manifest(&normalized_channel),
            source: "embedded-fallback".to_string(),
            warning: Some(format!("Manifest fetch failed: {}. Using fallback manifest.", error)),
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
        collect_app_dirs(PathBuf::from("/Applications"), "filesystem:/Applications", &mut apps);
        if let Some(home) = dirs::home_dir() {
            collect_app_dirs(home.join("Applications"), "filesystem:~/Applications", &mut apps);
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
async fn install_app(app_id: String, channel: String) -> Result<CommandOutcome, String> {
    let normalized_channel = normalize_channel(&channel);
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
            app_id,
            "--channel".to_string(),
            normalized_channel,
        ],
    ];

    execute_variants("opta", &variants, "Install completed.")
        .await
        .map_err(|error| format!("Install failed. {}", error))
}

#[tauri::command]
async fn update_app(app_id: String, channel: String) -> Result<CommandOutcome, String> {
    let normalized_channel = normalize_channel(&channel);
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
            app_id,
            "--channel".to_string(),
            normalized_channel,
        ],
    ];

    execute_variants("opta", &variants, "Update completed.")
        .await
        .map_err(|error| format!("Update failed. {}", error))
}

async fn os_level_launch(app_id: &str) -> Result<CommandOutcome, ManagerError> {
    #[cfg(target_os = "macos")]
    let variants = vec![vec!["-a".to_string(), app_id.to_string()]];

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

    let json_args = vec!["daemon".to_string(), "status".to_string(), "--json".to_string()];
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

    let merged = if output.stderr.is_empty() {
        output.stdout.clone()
    } else if output.stdout.is_empty() {
        output.stderr.clone()
    } else {
        format!("{}\n{}", output.stdout, output.stderr)
    };

    let lower = merged.to_ascii_lowercase();
    let running = output.success
        && (lower.contains("running") || lower.contains("online") || lower.contains("active"));

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

#[tauri::command]
async fn open_url(url: String) -> Result<(), String> {
    let parsed = Url::parse(url.trim()).map_err(|error| ManagerError::InvalidUrl(error.to_string()).to_string())?;
    if parsed.scheme() != "http" && parsed.scheme() != "https" {
        return Err(ManagerError::InvalidUrl("Only http/https URLs are allowed".to_string()).to_string());
    }

    webbrowser::open(parsed.as_str()).map_err(|error| format!("Failed to open URL: {}", error))?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            fetch_manifest,
            list_installed_apps,
            install_app,
            update_app,
            launch_app,
            daemon_status,
            daemon_start,
            daemon_stop,
            open_url
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
