//! Linux-specific platform initialization and features.
//!
//! This module handles:
//! - Linux distribution detection
//! - Desktop environment detection
//! - D-Bus integration
//! - XDG paths and desktop entries
//! - freedesktop notifications
//! - System tray (StatusNotifierItem)

use super::{
    Architecture, DesktopEnvironment, LaunchOptimization, NativeFeature, OperatingSystem,
    PlatformCapabilities, PlatformContext,
};
use std::env;
use std::fs;
use std::process::Command;

/// Initialize Linux-specific features and return platform context.
pub fn initialize_linux() -> PlatformContext {
    let os = detect_linux_version();
    let capabilities = detect_capabilities();
    let native_features = detect_native_features();
    let launch_optimizations = apply_launch_optimizations();

    PlatformContext {
        os,
        capabilities,
        native_features,
        launch_optimizations,
        display_name: "Linux".to_string(),
        icon: "terminal".to_string(), // Linux icon in Lucide
    }
}

/// Detect Linux distribution and version.
fn detect_linux_version() -> OperatingSystem {
    // Try to read /etc/os-release for distribution info
    let (distro, version) = read_os_release().unwrap_or_else(|| {
        // Fallback to uname
        let version = Command::new("uname")
            .arg("-r")
            .output()
            .ok()
            .and_then(|o| String::from_utf8(o.stdout).ok())
            .map(|s| s.trim().to_string())
            .unwrap_or_else(|| "Unknown".to_string());
        ("Linux".to_string(), version)
    });

    let desktop_env = detect_desktop_environment();

    OperatingSystem::Linux {
        distro,
        version,
        desktop_env,
    }
}

/// Read /etc/os-release for distribution information.
fn read_os_release() -> Option<(String, String)> {
    let content = fs::read_to_string("/etc/os-release").ok()?;

    let mut name = None;
    let mut version = None;

    for line in content.lines() {
        if line.starts_with("NAME=") {
            name = Some(
                line.trim_start_matches("NAME=")
                    .trim_matches('"')
                    .to_string(),
            );
        } else if line.starts_with("VERSION_ID=") {
            version = Some(
                line.trim_start_matches("VERSION_ID=")
                    .trim_matches('"')
                    .to_string(),
            );
        }
    }

    Some((name?, version.unwrap_or_else(|| "Unknown".to_string())))
}

/// Detect the current desktop environment.
fn detect_desktop_environment() -> DesktopEnvironment {
    // Check XDG_CURRENT_DESKTOP first
    if let Ok(desktop) = env::var("XDG_CURRENT_DESKTOP") {
        let desktop_lower = desktop.to_lowercase();
        if desktop_lower.contains("gnome") {
            return DesktopEnvironment::Gnome;
        } else if desktop_lower.contains("kde") || desktop_lower.contains("plasma") {
            return DesktopEnvironment::Kde;
        } else if desktop_lower.contains("xfce") {
            return DesktopEnvironment::Xfce;
        } else if desktop_lower.contains("cinnamon") {
            return DesktopEnvironment::Cinnamon;
        } else if desktop_lower.contains("mate") {
            return DesktopEnvironment::Mate;
        } else if desktop_lower.contains("unity") {
            return DesktopEnvironment::Unity;
        }
    }

    // Check session type for Wayland vs X11
    if let Ok(session) = env::var("XDG_SESSION_TYPE") {
        if session == "wayland" {
            return DesktopEnvironment::Wayland;
        } else if session == "x11" {
            return DesktopEnvironment::X11;
        }
    }

    DesktopEnvironment::Unknown
}

/// Detect platform capabilities on Linux.
fn detect_capabilities() -> PlatformCapabilities {
    let desktop_env = detect_desktop_environment();

    // System tray support varies by DE
    let system_tray = matches!(
        desktop_env,
        DesktopEnvironment::Kde
            | DesktopEnvironment::Xfce
            | DesktopEnvironment::Cinnamon
            | DesktopEnvironment::Mate
    );

    PlatformCapabilities {
        gpu_acceleration: true,      // Mesa/driver dependent
        native_notifications: true,  // freedesktop notifications
        system_tray,                 // DE dependent
        background_execution: true,  // No restrictions
        power_management: check_upower_available(),
        touch_support: false,        // Rare on Linux gaming setups
        high_dpi: true,              // Xft.dpi / Wayland scaling
    }
}

/// Check if UPower D-Bus service is available.
fn check_upower_available() -> bool {
    Command::new("dbus-send")
        .args([
            "--system",
            "--print-reply",
            "--dest=org.freedesktop.UPower",
            "/org/freedesktop/UPower",
            "org.freedesktop.DBus.Introspectable.Introspect",
        ])
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

/// Detect available native features on Linux.
fn detect_native_features() -> Vec<NativeFeature> {
    let mut features = vec![
        NativeFeature::DesktopEntry,
        NativeFeature::DBusNotifications,
        NativeFeature::NativeNotifications,
        NativeFeature::BackgroundExecution,
    ];

    // Check for tray support
    let desktop_env = detect_desktop_environment();
    if matches!(
        desktop_env,
        DesktopEnvironment::Kde
            | DesktopEnvironment::Xfce
            | DesktopEnvironment::Cinnamon
            | DesktopEnvironment::Mate
    ) {
        features.push(NativeFeature::FreedesktopTray);
        features.push(NativeFeature::SystemTray);
    }

    // Check for systemd
    if check_systemd_available() {
        features.push(NativeFeature::SystemdIntegration);
    }

    // Check for power management
    if check_upower_available() {
        features.push(NativeFeature::PowerManagement);
    }

    features
}

/// Check if systemd is available.
fn check_systemd_available() -> bool {
    fs::metadata("/run/systemd/system").is_ok()
}

/// Apply Linux-specific launch optimizations.
fn apply_launch_optimizations() -> Vec<LaunchOptimization> {
    let mut optimizations = vec![];

    // XDG paths
    optimizations.push(LaunchOptimization {
        name: "XDG Base Directory".to_string(),
        description: "Using XDG standard paths for config and data storage".to_string(),
        applied: true,
    });

    // Desktop environment detection
    let desktop_env = detect_desktop_environment();
    optimizations.push(LaunchOptimization {
        name: "Desktop Environment Detection".to_string(),
        description: format!("Detected {:?} desktop environment", desktop_env),
        applied: true,
    });

    // Display server detection
    let session_type = env::var("XDG_SESSION_TYPE").unwrap_or_else(|_| "unknown".to_string());
    optimizations.push(LaunchOptimization {
        name: "Display Server".to_string(),
        description: format!("Running on {} display server", session_type),
        applied: true,
    });

    optimizations
}

// ============================================================================
// Future: Native Linux integrations (to be implemented)
// ============================================================================

/// Send D-Bus notification via freedesktop.Notifications.
#[allow(dead_code)]
pub fn send_notification(title: &str, body: &str) {
    // TODO: Implement using zbus crate
    // org.freedesktop.Notifications.Notify
    let _ = Command::new("notify-send")
        .arg(title)
        .arg(body)
        .arg("--app-name=Opta")
        .output();
}

/// Set up StatusNotifierItem for system tray.
#[allow(dead_code)]
pub fn setup_system_tray() {
    // TODO: Implement using ksni or zbus crate
    // Register StatusNotifierItem with org.kde.StatusNotifierWatcher
}

/// Create XDG autostart entry.
#[allow(dead_code)]
pub fn setup_autostart(enable: bool) {
    // TODO: Create/remove ~/.config/autostart/opta.desktop
    let _ = enable;
}

/// Get XDG config directory.
pub fn get_config_dir() -> String {
    env::var("XDG_CONFIG_HOME").unwrap_or_else(|_| {
        env::var("HOME")
            .map(|h| format!("{}/.config", h))
            .unwrap_or_else(|_| "/tmp".to_string())
    })
}

/// Get XDG data directory.
pub fn get_data_dir() -> String {
    env::var("XDG_DATA_HOME").unwrap_or_else(|_| {
        env::var("HOME")
            .map(|h| format!("{}/.local/share", h))
            .unwrap_or_else(|_| "/tmp".to_string())
    })
}

/// Get XDG cache directory.
pub fn get_cache_dir() -> String {
    env::var("XDG_CACHE_HOME").unwrap_or_else(|_| {
        env::var("HOME")
            .map(|h| format!("{}/.cache", h))
            .unwrap_or_else(|_| "/tmp".to_string())
    })
}

/// Check if running on Wayland.
pub fn is_wayland() -> bool {
    env::var("XDG_SESSION_TYPE")
        .map(|s| s == "wayland")
        .unwrap_or(false)
}

/// Get GPU information via lspci/glxinfo.
#[allow(dead_code)]
pub fn get_gpu_info() -> Option<String> {
    // Try lspci first
    Command::new("lspci")
        .args(["-v", "-s", "$(lspci | grep VGA | cut -d' ' -f1)"])
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .or_else(|| {
            // Fallback to glxinfo
            Command::new("glxinfo")
                .args(["-B"])
                .output()
                .ok()
                .and_then(|o| String::from_utf8(o.stdout).ok())
        })
}
