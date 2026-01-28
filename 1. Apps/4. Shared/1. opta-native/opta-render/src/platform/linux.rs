//! Linux platform-specific rendering integration.
//!
//! This module provides Vulkan backend support for Linux platforms,
//! including X11 and Wayland surface configuration.
//!
//! Note: This is a stub implementation. Full Linux support will be
//! added in a future milestone.

/// Get the recommended wgpu backend for Linux.
///
/// Returns Vulkan as the primary graphics API for Linux.
#[cfg(target_os = "linux")]
pub fn recommended_backend() -> wgpu::Backends {
    wgpu::Backends::VULKAN
}

/// Check if Vulkan is available on the current system.
#[cfg(target_os = "linux")]
pub fn is_vulkan_available() -> bool {
    let instance = wgpu::Instance::new(&wgpu::InstanceDescriptor {
        backends: wgpu::Backends::VULKAN,
        ..Default::default()
    });
    !instance.enumerate_adapters(wgpu::Backends::VULKAN).is_empty()
}

/// Get Vulkan adapter information.
#[cfg(target_os = "linux")]
pub fn get_vulkan_adapter_info() -> Option<wgpu::AdapterInfo> {
    let instance = wgpu::Instance::new(&wgpu::InstanceDescriptor {
        backends: wgpu::Backends::VULKAN,
        ..Default::default()
    });

    instance
        .enumerate_adapters(wgpu::Backends::VULKAN)
        .first()
        .map(|adapter| adapter.get_info())
}

// Stub implementations for non-Linux platforms
#[cfg(not(target_os = "linux"))]
pub fn recommended_backend() -> wgpu::Backends {
    wgpu::Backends::PRIMARY
}

#[cfg(not(target_os = "linux"))]
pub fn is_vulkan_available() -> bool {
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
}
