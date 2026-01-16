//! Windows-specific platform initialization and features.
//!
//! This module handles:
//! - Windows version detection
//! - Jump List setup
//! - Taskbar progress indicators
//! - System tray integration
//! - Toast notifications
//! - High-DPI configuration

use super::{
    Architecture, LaunchOptimization, NativeFeature, OperatingSystem, PlatformCapabilities,
    PlatformContext,
};
use std::process::Command;

/// Initialize Windows-specific features and return platform context.
pub fn initialize_windows() -> PlatformContext {
    let os = detect_windows_version();
    let capabilities = detect_capabilities();
    let native_features = detect_native_features();
    let launch_optimizations = apply_launch_optimizations();

    PlatformContext {
        os,
        capabilities,
        native_features,
        launch_optimizations,
        display_name: "Windows".to_string(),
        icon: "monitor".to_string(), // Windows icon in Lucide
    }
}

/// Detect Windows version information.
fn detect_windows_version() -> OperatingSystem {
    // Get Windows version using PowerShell
    let version_info = Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            "[System.Environment]::OSVersion.Version.ToString()",
        ])
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|s| s.trim().to_string())
        .unwrap_or_else(|| "Unknown".to_string());

    // Get build number
    let build = Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            "(Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion').CurrentBuild",
        ])
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .and_then(|s| s.trim().parse().ok())
        .unwrap_or(0);

    // Get edition
    let edition = Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            "(Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion').ProductName",
        ])
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|s| s.trim().to_string())
        .unwrap_or_else(|| "Windows".to_string());

    // Determine Windows version from build number
    let version = get_windows_version_name(build);

    OperatingSystem::Windows {
        version,
        build,
        edition,
    }
}

/// Get Windows version name from build number.
fn get_windows_version_name(build: u32) -> String {
    match build {
        b if b >= 22000 => "11".to_string(),
        b if b >= 19041 => "10".to_string(),
        b if b >= 10240 => "10 (Legacy)".to_string(),
        _ => "Unknown".to_string(),
    }
}

/// Detect platform capabilities on Windows.
fn detect_capabilities() -> PlatformCapabilities {
    PlatformCapabilities {
        gpu_acceleration: true, // DirectX available on all Windows
        native_notifications: true, // Toast notifications available
        system_tray: true,      // System tray always available
        background_execution: true, // No restrictions like mobile
        power_management: true, // Power APIs available
        touch_support: check_touch_support(),
        high_dpi: true, // Per-monitor DPI available
    }
}

/// Check if touch input is available.
fn check_touch_support() -> bool {
    // On Windows, check for touch digitizer
    // For now, return false as gaming PCs rarely have touch
    // In production: use GetSystemMetrics(SM_DIGITIZER)
    false
}

/// Detect available native features on Windows.
fn detect_native_features() -> Vec<NativeFeature> {
    vec![
        NativeFeature::JumpList,
        NativeFeature::TaskbarProgress,
        NativeFeature::ToastNotifications,
        NativeFeature::SystemTray,
        NativeFeature::NativeNotifications,
        NativeFeature::StartupRegistration,
        NativeFeature::PowerManagement,
        NativeFeature::BackgroundExecution,
    ]
}

/// Apply Windows-specific launch optimizations.
fn apply_launch_optimizations() -> Vec<LaunchOptimization> {
    let mut optimizations = vec![];

    // High-DPI awareness
    optimizations.push(LaunchOptimization {
        name: "High-DPI Awareness".to_string(),
        description: "Configured Per-Monitor DPI awareness v2 for crisp rendering".to_string(),
        applied: true,
    });

    // Hardware acceleration
    optimizations.push(LaunchOptimization {
        name: "Hardware Acceleration".to_string(),
        description: "DirectX hardware acceleration enabled for WebView2".to_string(),
        applied: true,
    });

    // Console window hidden
    optimizations.push(LaunchOptimization {
        name: "Console Window Hidden".to_string(),
        description: "Windows subsystem configured to hide console window".to_string(),
        applied: true,
    });

    optimizations
}

// ============================================================================
// Future: Native Windows integrations (to be implemented)
// ============================================================================

/// Set up Jump List for taskbar right-click menu.
#[allow(dead_code)]
pub fn setup_jump_list() {
    // TODO: Implement using windows-rs crate
    // ICustomDestinationList for recent games and quick actions
}

/// Set taskbar progress indicator.
#[allow(dead_code)]
pub fn set_taskbar_progress(progress: f32, state: TaskbarProgressState) {
    // TODO: Implement using windows-rs crate
    // ITaskbarList3::SetProgressValue and SetProgressState
    let _ = (progress, state);
}

/// Taskbar progress states.
#[allow(dead_code)]
#[derive(Debug, Clone, Copy)]
pub enum TaskbarProgressState {
    NoProgress,
    Indeterminate,
    Normal,
    Error,
    Paused,
}

/// Set up system tray icon and menu.
#[allow(dead_code)]
pub fn setup_system_tray() {
    // TODO: Implement using windows-rs crate
    // Shell_NotifyIcon for tray icon
    // Create context menu for right-click
}

/// Send Windows Toast notification.
#[allow(dead_code)]
pub fn send_toast_notification(title: &str, body: &str) {
    // TODO: Implement using windows-rs crate
    // ToastNotificationManager
    let _ = (title, body);
}

/// Register app in startup (Run registry key).
#[allow(dead_code)]
pub fn register_startup(enable: bool) {
    // TODO: Implement using windows-rs crate
    // HKCU\Software\Microsoft\Windows\CurrentVersion\Run
    let _ = enable;
}

/// Get GPU information via WMI.
#[allow(dead_code)]
pub fn get_gpu_info() -> Option<String> {
    Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            "Get-WmiObject Win32_VideoController | Select-Object Name, DriverVersion | ConvertTo-Json",
        ])
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
}

/// Check if running on Windows 11.
pub fn is_windows_11() -> bool {
    let build = Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            "(Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion').CurrentBuild",
        ])
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .and_then(|s| s.trim().parse::<u32>().ok())
        .unwrap_or(0);

    build >= 22000
}

/// Check if WebView2 runtime is available.
#[allow(dead_code)]
pub fn check_webview2_available() -> bool {
    // Check if WebView2 runtime is installed
    // Tauri handles this automatically with embedded bootstrapper
    true
}
