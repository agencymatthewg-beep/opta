// Tauri v2 library entry-point for Opta Code Desktop.
//
// Intentionally minimal — the app is a thin native shell around the Vite
// web frontend.  Add Tauri commands here if native OS access is needed
// in the future (file system, system tray, OS notifications, etc.).

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running Opta Code application");
}
