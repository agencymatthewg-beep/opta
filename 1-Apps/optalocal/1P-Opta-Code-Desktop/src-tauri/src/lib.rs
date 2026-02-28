// Tauri v2 library entry-point for Opta Code Desktop.
//
// Intentionally minimal — the app is a thin native shell around the Vite
// web frontend.  Add Tauri commands here if native OS access is needed
// in the future (file system, system tray, OS notifications, etc.).

mod connection_secrets;
mod setup_wizard;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            connection_secrets::set_connection_secret,
            connection_secrets::get_connection_secret,
            connection_secrets::delete_connection_secret,
            setup_wizard::check_first_run,
            setup_wizard::save_setup_config,
            setup_wizard::test_lmx_connection,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Opta Code application");
}
