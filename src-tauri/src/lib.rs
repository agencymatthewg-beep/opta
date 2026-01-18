mod badges;
mod benchmark;
mod claude;
mod conflicts;
mod expertise;
mod games;
pub mod ipc;
mod launcher;
mod llm;
mod optimizer;
pub mod platform;
mod processes;
mod profile;
mod scoring;
mod telemetry;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize platform-specific features at startup
    let _platform_context = platform::initialize();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_os::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            telemetry::get_system_telemetry,
            telemetry::get_disk_analysis,
            processes::get_processes,
            processes::terminate_process,
            processes::stealth_mode,
            conflicts::detect_conflicts,
            games::detect_games,
            games::get_game_info,
            games::get_game_optimization,
            llm::llm_status,
            llm::llm_chat,
            llm::smart_chat,
            claude::claude_status,
            claude::claude_chat,
            platform::get_platform_context,
            optimizer::apply_optimization,
            optimizer::revert_optimization,
            optimizer::get_optimization_history,
            optimizer::record_optimization_choice,
            optimizer::get_user_patterns,
            optimizer::get_choice_stats,
            optimizer::get_recommendations,
            benchmark::start_benchmark,
            benchmark::capture_benchmark_sample,
            benchmark::end_benchmark,
            benchmark::get_benchmark_results,
            scoring::calculate_score,
            scoring::get_score,
            scoring::get_leaderboard,
            scoring::get_score_history,
            scoring::get_global_stats,
            // V2 Enhanced Scoring
            scoring::calculate_enhanced_score,
            scoring::calculate_opta_score,
            scoring::get_hardware_tier,
            profile::load_user_profile,
            profile::update_user_profile,
            profile::delete_user_profile,
            // Badges
            badges::check_badges,
            badges::mark_badge_seen,
            // Launcher
            launcher::launch_game,
            launcher::check_game_running,
            launcher::get_game_process_names,
            // Expertise Detection
            expertise::get_expertise_profile,
            expertise::record_expertise_signal,
            expertise::set_expertise_override,
            // Phase 44: macOS Optimization Core
            #[cfg(target_os = "macos")]
            platform::macos::macos_get_optimization_status,
            #[cfg(target_os = "macos")]
            platform::macos::macos_set_process_priority,
            #[cfg(target_os = "macos")]
            platform::macos::macos_get_memory_pressure,
            #[cfg(target_os = "macos")]
            platform::macos::macos_get_thermal_state,
            #[cfg(target_os = "macos")]
            platform::macos::macos_get_gpu_state,
            #[cfg(target_os = "macos")]
            platform::macos::macos_configure_gaming_mode,
            // Phase 45: Windows Optimization Core
            #[cfg(target_os = "windows")]
            platform::windows::windows_get_optimization_status,
            #[cfg(target_os = "windows")]
            platform::windows::windows_set_process_priority,
            #[cfg(target_os = "windows")]
            platform::windows::windows_get_memory_info,
            #[cfg(target_os = "windows")]
            platform::windows::windows_optimize_process_memory,
            #[cfg(target_os = "windows")]
            platform::windows::windows_get_gpu_state,
            #[cfg(target_os = "windows")]
            platform::windows::windows_get_power_config,
            #[cfg(target_os = "windows")]
            platform::windows::windows_switch_power_plan,
            #[cfg(target_os = "windows")]
            platform::windows::windows_get_game_mode_status,
            #[cfg(target_os = "windows")]
            platform::windows::windows_configure_gaming_mode,
            #[cfg(target_os = "windows")]
            platform::windows::windows_set_process_affinity
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
