/// Opta Workspace integration for Code Desktop.
///
/// Reads the two-tier workspace filesystem created by the Init wizard,
/// resolving the workspace root from opta-init-config.json (same source
/// as CLI's getWorkspaceRoot()).  Falls back to ~/Documents/Opta Workspace.
use crate::config_paths::opta_config_dir;
use serde::Serialize;
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize)]
pub struct WorkspaceProject {
    pub name: String,
    pub path: String,
    pub has_goal: bool,
    pub has_index: bool,
}

/// List projects in ~/Documents/Opta Workspace/Projects/.
///
/// Returns an empty vec (not an error) if the Projects directory does not
/// yet exist — this happens before the Init wizard creates the workspace.
#[tauri::command]
pub async fn get_workspace_projects() -> Result<Vec<WorkspaceProject>, String> {
    let workspace_root = resolve_workspace_root()?;
    let projects_dir = workspace_root.join("Projects");

    if !projects_dir.exists() {
        return Ok(vec![]);
    }

    let mut projects = vec![];

    let entries = fs::read_dir(&projects_dir)
        .map_err(|e| format!("Failed to read Projects directory: {e}"))?;

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();
        // Skip hidden dirs (e.g. .DS_Store directories)
        if name.starts_with('.') {
            continue;
        }
        let has_goal = path.join("GOAL.md").exists();
        let has_index = path.join("INDEX.md").exists();
        projects.push(WorkspaceProject {
            name,
            path: path.to_string_lossy().to_string(),
            has_goal,
            has_index,
        });
    }

    // Stable alphabetical order
    projects.sort_by(|a, b| a.name.cmp(&b.name));

    Ok(projects)
}

/// Resolve the workspace root, mirroring getWorkspaceRoot() in the CLI.
///
/// 1. Read workspacePath from ~/.config/opta/opta-init-config.json
/// 2. Fall back to ~/Documents/Opta Workspace
fn resolve_workspace_root() -> Result<PathBuf, String> {
    let config_dir = opta_config_dir()?;
    let config_file = config_dir.join("opta-init-config.json");

    if config_file.exists() {
        if let Ok(raw) = fs::read_to_string(&config_file) {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&raw) {
                if let Some(path) = json.get("workspacePath").and_then(|v| v.as_str()) {
                    let trimmed = path.trim();
                    if !trimmed.is_empty() {
                        return Ok(PathBuf::from(trimmed));
                    }
                }
            }
        }
    }

    // Default: ~/Documents/Opta Workspace
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map_err(|_| "Cannot determine home directory".to_string())?;
    Ok(PathBuf::from(home).join("Documents").join("Opta Workspace"))
}
