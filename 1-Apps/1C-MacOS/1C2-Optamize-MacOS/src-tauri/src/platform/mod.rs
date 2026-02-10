//! Platform abstraction layer for Opta.
//!
//! This module provides platform-specific initialization and capabilities
//! detection for optimal app launching on each operating system.

use serde::{Deserialize, Serialize};
use std::fmt;

// Platform-specific modules
#[cfg(target_os = "macos")]
pub mod macos;

#[cfg(target_os = "windows")]
pub mod windows;

#[cfg(target_os = "linux")]
pub mod linux;

// Mobile stubs (architecture ready, not implemented)
#[cfg(any(target_os = "ios", target_os = "android"))]
pub mod mobile;

/// Operating system identification with version details.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum OperatingSystem {
    #[serde(rename = "macos")]
    MacOS {
        version: String,
        build: String,
        architecture: Architecture,
    },
    #[serde(rename = "windows")]
    Windows {
        version: String,
        build: u32,
        edition: String,
    },
    #[serde(rename = "linux")]
    Linux {
        distro: String,
        version: String,
        desktop_env: DesktopEnvironment,
    },
    #[serde(rename = "ios")]
    IOS { version: String },
    #[serde(rename = "android")]
    Android { api_level: u32, version: String },
    #[serde(rename = "unknown")]
    Unknown,
}

impl fmt::Display for OperatingSystem {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            OperatingSystem::MacOS { version, .. } => write!(f, "macOS {}", version),
            OperatingSystem::Windows { version, build, .. } => {
                write!(f, "Windows {} (Build {})", version, build)
            }
            OperatingSystem::Linux { distro, version, .. } => write!(f, "{} {}", distro, version),
            OperatingSystem::IOS { version } => write!(f, "iOS {}", version),
            OperatingSystem::Android { version, .. } => write!(f, "Android {}", version),
            OperatingSystem::Unknown => write!(f, "Unknown OS"),
        }
    }
}

/// CPU architecture.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Architecture {
    Arm64,
    X86_64,
    X86,
    Unknown,
}

impl Architecture {
    pub fn current() -> Self {
        #[cfg(target_arch = "aarch64")]
        return Architecture::Arm64;

        #[cfg(target_arch = "x86_64")]
        return Architecture::X86_64;

        #[cfg(target_arch = "x86")]
        return Architecture::X86;

        #[cfg(not(any(target_arch = "aarch64", target_arch = "x86_64", target_arch = "x86")))]
        return Architecture::Unknown;
    }
}

/// Linux desktop environment detection.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum DesktopEnvironment {
    Gnome,
    Kde,
    Xfce,
    Cinnamon,
    Mate,
    Unity,
    Wayland,
    X11,
    Unknown,
}

/// Native features available on the current platform.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum NativeFeature {
    // macOS features
    MenuBar,
    DockBadge,
    AppNap,
    Metal,
    Spotlight,

    // Windows features
    JumpList,
    TaskbarProgress,
    ToastNotifications,
    StartupRegistration,

    // Linux features
    DesktopEntry,
    DBusNotifications,
    FreedesktopTray,
    SystemdIntegration,

    // Cross-platform
    SystemTray,
    NativeNotifications,
    BackgroundExecution,
    PowerManagement,
}

/// Platform capabilities summary.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlatformCapabilities {
    /// GPU acceleration available
    pub gpu_acceleration: bool,
    /// Native notification support
    pub native_notifications: bool,
    /// System tray / menu bar support
    pub system_tray: bool,
    /// Can run in background
    pub background_execution: bool,
    /// Power management integration
    pub power_management: bool,
    /// Touch input support
    pub touch_support: bool,
    /// High DPI support
    pub high_dpi: bool,
}

impl Default for PlatformCapabilities {
    fn default() -> Self {
        Self {
            gpu_acceleration: true,
            native_notifications: true,
            system_tray: true,
            background_execution: true,
            power_management: true,
            touch_support: false,
            high_dpi: true,
        }
    }
}

/// Launch optimization applied during startup.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LaunchOptimization {
    pub name: String,
    pub description: String,
    pub applied: bool,
}

/// Complete platform context returned to frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlatformContext {
    /// Operating system details
    pub os: OperatingSystem,
    /// Platform capabilities
    pub capabilities: PlatformCapabilities,
    /// Native features available
    pub native_features: Vec<NativeFeature>,
    /// Optimizations applied at launch
    pub launch_optimizations: Vec<LaunchOptimization>,
    /// Display name for UI
    pub display_name: String,
    /// Platform icon identifier for frontend
    pub icon: String,
}

/// Initialize platform-specific features and return context.
pub fn initialize() -> PlatformContext {
    #[cfg(target_os = "macos")]
    return macos::initialize_macos();

    #[cfg(target_os = "windows")]
    return windows::initialize_windows();

    #[cfg(target_os = "linux")]
    return linux::initialize_linux();

    #[cfg(any(target_os = "ios", target_os = "android"))]
    return mobile::initialize_mobile();

    // Fallback for unknown platforms
    #[cfg(not(any(
        target_os = "macos",
        target_os = "windows",
        target_os = "linux",
        target_os = "ios",
        target_os = "android"
    )))]
    return PlatformContext {
        os: OperatingSystem::Unknown,
        capabilities: PlatformCapabilities::default(),
        native_features: vec![],
        launch_optimizations: vec![],
        display_name: "Unknown Platform".to_string(),
        icon: "help-circle".to_string(),
    };
}

/// Get current platform context without re-initializing.
/// Use this for subsequent calls after initial startup.
#[tauri::command]
pub fn get_platform_context() -> PlatformContext {
    initialize()
}

/// Check if a specific native feature is available.
pub fn has_feature(feature: &NativeFeature) -> bool {
    let context = initialize();
    context.native_features.contains(feature)
}

/// Trait for mobile-ready code abstractions.
/// All platform implementations should consider mobile compatibility.
pub trait MobileReady {
    /// Whether the platform supports touch input
    fn supports_touch(&self) -> bool;

    /// Get recommended telemetry polling interval
    /// Mobile platforms should use longer intervals to save battery
    fn telemetry_interval_ms(&self) -> u64;

    /// Whether background execution is limited
    fn background_limited(&self) -> bool;
}

// Implement MobileReady for PlatformContext
impl MobileReady for PlatformContext {
    fn supports_touch(&self) -> bool {
        self.capabilities.touch_support
    }

    fn telemetry_interval_ms(&self) -> u64 {
        match &self.os {
            OperatingSystem::IOS { .. } | OperatingSystem::Android { .. } => 60000, // 1 minute
            _ => 2000, // 2 seconds for desktop
        }
    }

    fn background_limited(&self) -> bool {
        matches!(
            &self.os,
            OperatingSystem::IOS { .. } | OperatingSystem::Android { .. }
        )
    }
}
