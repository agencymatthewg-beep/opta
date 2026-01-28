//! Platform-specific rendering integrations.
//!
//! This module provides platform-specific surface providers and backend
//! configuration for different operating systems:
//!
//! - **macOS/iOS**: Metal backend with CAMetalLayer integration
//! - **Windows**: DX12 backend with Win32 HWND integration
//! - **Linux**: Vulkan backend (future)
//!
//! Each platform module exports:
//! - A surface configuration type
//! - Backend availability checking
//! - Recommended backend selection

#[cfg(target_os = "windows")]
pub mod windows;

#[cfg(any(target_os = "macos", target_os = "ios"))]
pub mod apple;

#[cfg(target_os = "linux")]
pub mod linux;

/// Get the recommended wgpu backend for the current platform.
///
/// This function selects the optimal backend based on platform:
/// - Windows: DX12 (fallback to Vulkan)
/// - macOS/iOS: Metal
/// - Linux: Vulkan
pub fn recommended_backend() -> wgpu::Backends {
    #[cfg(target_os = "windows")]
    {
        windows::recommended_backend()
    }

    #[cfg(any(target_os = "macos", target_os = "ios"))]
    {
        wgpu::Backends::METAL
    }

    #[cfg(target_os = "linux")]
    {
        wgpu::Backends::VULKAN
    }

    #[cfg(not(any(
        target_os = "windows",
        target_os = "macos",
        target_os = "ios",
        target_os = "linux"
    )))]
    {
        wgpu::Backends::PRIMARY
    }
}
