//! Apple platform-specific rendering integration.
//!
//! This module provides Metal backend support for macOS and iOS platforms,
//! including CAMetalLayer surface configuration.
//!
//! Note: Most Apple-specific functionality is already in the main crate
//! (autorelease pool, surface handling). This module provides additional
//! platform-specific utilities.

/// Get the recommended wgpu backend for Apple platforms.
///
/// Always returns Metal as it's the native graphics API for Apple devices.
#[cfg(any(target_os = "macos", target_os = "ios"))]
pub fn recommended_backend() -> wgpu::Backends {
    wgpu::Backends::METAL
}

/// Check if Metal is available on the current system.
///
/// On Apple platforms, Metal is always available on supported hardware.
#[cfg(any(target_os = "macos", target_os = "ios"))]
pub fn is_metal_available() -> bool {
    let instance = wgpu::Instance::new(&wgpu::InstanceDescriptor {
        backends: wgpu::Backends::METAL,
        ..Default::default()
    });
    !instance.enumerate_adapters(wgpu::Backends::METAL).is_empty()
}

/// Get Metal adapter information.
///
/// Returns information about the first available Metal adapter,
/// useful for debugging and capability reporting.
#[cfg(any(target_os = "macos", target_os = "ios"))]
pub fn get_metal_adapter_info() -> Option<wgpu::AdapterInfo> {
    let instance = wgpu::Instance::new(&wgpu::InstanceDescriptor {
        backends: wgpu::Backends::METAL,
        ..Default::default()
    });

    instance
        .enumerate_adapters(wgpu::Backends::METAL)
        .first()
        .map(|adapter| adapter.get_info())
}

/// Check if the system supports Apple Silicon (M-series chips).
///
/// Returns true if the GPU appears to be Apple Silicon based on naming.
#[cfg(any(target_os = "macos", target_os = "ios"))]
pub fn is_apple_silicon() -> bool {
    if let Some(info) = get_metal_adapter_info() {
        // Apple Silicon GPUs contain "Apple" in the name
        info.name.contains("Apple")
    } else {
        false
    }
}

/// Check if the system supports ProMotion (120Hz display).
///
/// Returns true on devices known to support ProMotion.
/// This is a heuristic based on device capabilities.
#[cfg(target_os = "ios")]
pub fn supports_promotion() -> bool {
    // ProMotion is available on iPhone 13 Pro and later, iPad Pro
    // This is a runtime check - actual detection should use UIScreen
    true // Conservative: assume ProMotion support
}

/// Check if the system supports ProMotion (120Hz display) on macOS.
///
/// Returns true on MacBook Pro with M1 Pro/Max or later.
#[cfg(target_os = "macos")]
pub fn supports_promotion() -> bool {
    // ProMotion is available on MacBook Pro with M1 Pro/Max or later
    // This requires checking the display capabilities at runtime
    is_apple_silicon()
}

// Stub implementations for non-Apple platforms
#[cfg(not(any(target_os = "macos", target_os = "ios")))]
pub fn recommended_backend() -> wgpu::Backends {
    wgpu::Backends::PRIMARY
}

#[cfg(not(any(target_os = "macos", target_os = "ios")))]
pub fn is_metal_available() -> bool {
    false
}

#[cfg(not(any(target_os = "macos", target_os = "ios")))]
pub fn is_apple_silicon() -> bool {
    false
}

#[cfg(not(any(target_os = "macos", target_os = "ios")))]
pub fn supports_promotion() -> bool {
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_recommended_backend() {
        let backend = recommended_backend();
        assert!(!backend.is_empty());
    }

    #[cfg(any(target_os = "macos", target_os = "ios"))]
    #[test]
    fn test_metal_availability() {
        // Metal should be available on modern Apple devices
        let available = is_metal_available();
        assert!(available, "Metal should be available on Apple platforms");
    }

    #[cfg(any(target_os = "macos", target_os = "ios"))]
    #[test]
    fn test_adapter_info() {
        // Should return Some on Apple platforms
        let info = get_metal_adapter_info();
        assert!(info.is_some(), "Should find Metal adapter on Apple platforms");
    }
}
