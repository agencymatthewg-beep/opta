use tauri_plugin_dialog::DialogExt;

/// Open a native OS folder picker dialog.
/// Returns the chosen path as a string, or None if the user cancelled.
#[tauri::command]
pub fn pick_folder(app: tauri::AppHandle) -> Option<String> {
    app.dialog()
        .file()
        .blocking_pick_folder()
        .and_then(|fp| fp.into_path().ok())
        .map(|p| p.to_string_lossy().into_owned())
}
