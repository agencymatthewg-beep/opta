//! Mobile platform stubs for future iOS and Android support.
//!
//! This module provides the architecture foundation for mobile platforms
//! without implementing actual functionality. Mobile support is planned
//! for post-v1.0 release.
//!
//! Key differences from desktop:
//! - Limited background execution
//! - Battery-conscious polling intervals
//! - Touch-first interactions
//! - Platform permission model
//! - Push notifications instead of persistent connection

use super::{
    Architecture, LaunchOptimization, NativeFeature, OperatingSystem, PlatformCapabilities,
    PlatformContext,
};

/// Initialize mobile platform (iOS or Android).
/// Currently returns stub implementation.
pub fn initialize_mobile() -> PlatformContext {
    #[cfg(target_os = "ios")]
    return initialize_ios();

    #[cfg(target_os = "android")]
    return initialize_android();

    // Fallback (should not be reached)
    #[cfg(not(any(target_os = "ios", target_os = "android")))]
    return PlatformContext {
        os: OperatingSystem::Unknown,
        capabilities: PlatformCapabilities::default(),
        native_features: vec![],
        launch_optimizations: vec![],
        display_name: "Mobile".to_string(),
        icon: "smartphone".to_string(),
    };
}

/// Initialize iOS platform (stub).
#[cfg(target_os = "ios")]
fn initialize_ios() -> PlatformContext {
    // TODO: Implement actual iOS detection when Tauri mobile is stable
    let os = OperatingSystem::IOS {
        version: "Unknown".to_string(),
    };

    let capabilities = PlatformCapabilities {
        gpu_acceleration: true,      // Metal available
        native_notifications: true,  // APNs available
        system_tray: false,          // No system tray on iOS
        background_execution: false, // Limited background
        power_management: true,      // Battery optimization
        touch_support: true,         // Touch-first
        high_dpi: true,              // Retina displays
    };

    let native_features = vec![
        NativeFeature::NativeNotifications,
        NativeFeature::Metal,
        NativeFeature::PowerManagement,
    ];

    let launch_optimizations = vec![LaunchOptimization {
        name: "iOS Optimizations".to_string(),
        description: "Mobile-optimized launch configuration".to_string(),
        applied: true,
    }];

    PlatformContext {
        os,
        capabilities,
        native_features,
        launch_optimizations,
        display_name: "iOS".to_string(),
        icon: "smartphone".to_string(),
    }
}

/// Initialize Android platform (stub).
#[cfg(target_os = "android")]
fn initialize_android() -> PlatformContext {
    // TODO: Implement actual Android detection when Tauri mobile is stable
    let os = OperatingSystem::Android {
        api_level: 0,
        version: "Unknown".to_string(),
    };

    let capabilities = PlatformCapabilities {
        gpu_acceleration: true,      // Vulkan/OpenGL available
        native_notifications: true,  // FCM available
        system_tray: false,          // No system tray
        background_execution: false, // Limited by Doze mode
        power_management: true,      // Battery optimization
        touch_support: true,         // Touch-first
        high_dpi: true,              // Various densities
    };

    let native_features = vec![
        NativeFeature::NativeNotifications,
        NativeFeature::PowerManagement,
    ];

    let launch_optimizations = vec![LaunchOptimization {
        name: "Android Optimizations".to_string(),
        description: "Mobile-optimized launch configuration".to_string(),
        applied: true,
    }];

    PlatformContext {
        os,
        capabilities,
        native_features,
        launch_optimizations,
        display_name: "Android".to_string(),
        icon: "smartphone".to_string(),
    }
}

// ============================================================================
// Mobile Abstractions (for future implementation)
// ============================================================================

/// Permission types for mobile platforms.
#[derive(Debug, Clone, Copy)]
#[allow(dead_code)]
pub enum Permission {
    /// Internet access
    Internet,
    /// Push notifications
    Notifications,
    /// Background execution
    BackgroundExecution,
    /// Read external storage
    ReadStorage,
    /// Write external storage
    WriteStorage,
}

/// Request platform permission (stub).
#[allow(dead_code)]
pub async fn request_permission(_permission: Permission) -> bool {
    // TODO: Implement when mobile is supported
    // iOS: Request via Info.plist usage descriptions
    // Android: Request via AndroidManifest.xml and runtime permissions
    false
}

/// Battery optimization mode.
#[derive(Debug, Clone, Copy)]
#[allow(dead_code)]
pub enum BatteryMode {
    /// Normal operation
    Normal,
    /// Power saving mode active
    PowerSaver,
    /// Ultra power saving
    UltraPowerSaver,
}

/// Get current battery mode (stub).
#[allow(dead_code)]
pub fn get_battery_mode() -> BatteryMode {
    // TODO: Implement when mobile is supported
    // iOS: Check processorCount or thermalState
    // Android: Check PowerManager
    BatteryMode::Normal
}

/// Get recommended polling interval based on platform and battery.
pub fn get_recommended_poll_interval() -> u64 {
    // Mobile platforms need longer intervals to save battery
    // Desktop: 2 seconds
    // Mobile (normal): 60 seconds
    // Mobile (power saver): 300 seconds (5 minutes)

    #[cfg(any(target_os = "ios", target_os = "android"))]
    {
        match get_battery_mode() {
            BatteryMode::Normal => 60000,       // 1 minute
            BatteryMode::PowerSaver => 300000,  // 5 minutes
            BatteryMode::UltraPowerSaver => 0,  // Disable polling
        }
    }

    #[cfg(not(any(target_os = "ios", target_os = "android")))]
    {
        2000 // 2 seconds for desktop
    }
}

/// Mobile-specific telemetry limitations.
/// Returns what telemetry is available on mobile.
#[allow(dead_code)]
pub struct MobileTelemetrySupport {
    pub cpu_usage: bool,
    pub memory_usage: bool,
    pub battery_level: bool,
    pub storage_usage: bool,
    pub gpu_info: bool,      // Limited on mobile
    pub process_list: bool,  // Not available
    pub temperatures: bool,  // Limited
}

/// Get mobile telemetry support matrix.
#[allow(dead_code)]
pub fn get_telemetry_support() -> MobileTelemetrySupport {
    MobileTelemetrySupport {
        cpu_usage: true,      // Available via /proc on Android, limited on iOS
        memory_usage: true,   // Available
        battery_level: true,  // Available
        storage_usage: true,  // Available
        gpu_info: false,      // Not exposed
        process_list: false,  // Sandboxed, not available
        temperatures: false,  // Not exposed to apps
    }
}
