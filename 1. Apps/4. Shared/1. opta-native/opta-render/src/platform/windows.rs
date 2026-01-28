//! Windows-specific rendering integration.
//!
//! This module provides DX12 backend support for Windows platforms,
//! including surface configuration for Win32 HWND windows.
//!
//! ## Features
//!
//! - DX12 backend with fallback to Vulkan
//! - Win32 HWND surface creation
//! - Proper raw window handle integration
//!
//! ## Usage
//!
//! ```ignore
//! use opta_render::platform::windows::{WindowsSurface, is_dx12_available};
//!
//! // Check DX12 availability
//! if is_dx12_available() {
//!     println!("DX12 is available!");
//! }
//!
//! // Create surface from HWND
//! let surface = WindowsSurface::new(hwnd, 800, 600);
//! ```

#[cfg(target_os = "windows")]
use raw_window_handle::{
    DisplayHandle, HandleError, HasDisplayHandle, HasWindowHandle, RawDisplayHandle,
    RawWindowHandle, Win32WindowHandle, WindowHandle, WindowsDisplayHandle,
};
#[cfg(target_os = "windows")]
use std::num::NonZeroIsize;

/// Windows surface configuration for Win32 HWND windows.
///
/// This struct wraps a Win32 HWND handle and provides the necessary
/// raw window handle traits for wgpu surface creation.
#[cfg(target_os = "windows")]
pub struct WindowsSurface {
    /// The Win32 window handle.
    hwnd: windows::Win32::Foundation::HWND,
    /// Current width in pixels.
    width: u32,
    /// Current height in pixels.
    height: u32,
}

#[cfg(target_os = "windows")]
impl WindowsSurface {
    /// Create a new Windows surface from an HWND.
    ///
    /// # Arguments
    ///
    /// * `hwnd` - The Win32 window handle
    /// * `width` - Initial width in pixels
    /// * `height` - Initial height in pixels
    ///
    /// # Safety
    ///
    /// The HWND must be a valid window handle that remains valid
    /// for the lifetime of this surface.
    pub fn new(hwnd: windows::Win32::Foundation::HWND, width: u32, height: u32) -> Self {
        Self { hwnd, width, height }
    }

    /// Resize the surface dimensions.
    ///
    /// Note: This only updates the stored dimensions. The actual
    /// wgpu surface must be reconfigured separately.
    pub fn resize(&mut self, width: u32, height: u32) {
        self.width = width;
        self.height = height;
    }

    /// Get the current surface dimensions.
    pub fn size(&self) -> (u32, u32) {
        (self.width, self.height)
    }

    /// Get the underlying HWND.
    pub fn hwnd(&self) -> windows::Win32::Foundation::HWND {
        self.hwnd
    }
}

#[cfg(target_os = "windows")]
impl HasWindowHandle for WindowsSurface {
    fn window_handle(&self) -> Result<WindowHandle<'_>, HandleError> {
        // Convert HWND to NonZeroIsize
        let hwnd_ptr = self.hwnd.0 as isize;
        let non_zero = NonZeroIsize::new(hwnd_ptr).ok_or(HandleError::Unavailable)?;

        let mut handle = Win32WindowHandle::new(non_zero);
        // hinstance is optional for DX12
        handle.hinstance = None;

        // Safety: The handle is valid for the lifetime of self
        let raw_handle = RawWindowHandle::Win32(handle);
        Ok(unsafe { WindowHandle::borrow_raw(raw_handle) })
    }
}

#[cfg(target_os = "windows")]
impl HasDisplayHandle for WindowsSurface {
    fn display_handle(&self) -> Result<DisplayHandle<'_>, HandleError> {
        let handle = WindowsDisplayHandle::new();
        let raw_handle = RawDisplayHandle::Windows(handle);
        // Safety: Windows display handle is always valid
        Ok(unsafe { DisplayHandle::borrow_raw(raw_handle) })
    }
}

/// Check if DX12 is available on the current system.
///
/// This function creates a temporary wgpu instance to enumerate
/// available DX12 adapters.
///
/// # Returns
///
/// `true` if at least one DX12-compatible adapter is found.
#[cfg(target_os = "windows")]
pub fn is_dx12_available() -> bool {
    let instance = wgpu::Instance::new(&wgpu::InstanceDescriptor {
        backends: wgpu::Backends::DX12,
        ..Default::default()
    });
    !instance.enumerate_adapters(wgpu::Backends::DX12).is_empty()
}

/// Check if Vulkan is available on the current system.
///
/// Useful as a fallback when DX12 is not available.
#[cfg(target_os = "windows")]
pub fn is_vulkan_available() -> bool {
    let instance = wgpu::Instance::new(&wgpu::InstanceDescriptor {
        backends: wgpu::Backends::VULKAN,
        ..Default::default()
    });
    !instance.enumerate_adapters(wgpu::Backends::VULKAN).is_empty()
}

/// Get the recommended wgpu backend for Windows.
///
/// Prefers DX12 as the native Windows graphics API, with
/// Vulkan as a fallback for older systems or when DX12
/// is unavailable.
///
/// # Returns
///
/// - `wgpu::Backends::DX12` if DX12 is available
/// - `wgpu::Backends::VULKAN` if DX12 is not available but Vulkan is
/// - `wgpu::Backends::PRIMARY` as final fallback
#[cfg(target_os = "windows")]
pub fn recommended_backend() -> wgpu::Backends {
    if is_dx12_available() {
        wgpu::Backends::DX12
    } else if is_vulkan_available() {
        wgpu::Backends::VULKAN
    } else {
        wgpu::Backends::PRIMARY
    }
}

/// Get DX12 adapter information.
///
/// Returns information about the first available DX12 adapter,
/// useful for debugging and capability reporting.
#[cfg(target_os = "windows")]
pub fn get_dx12_adapter_info() -> Option<wgpu::AdapterInfo> {
    let instance = wgpu::Instance::new(&wgpu::InstanceDescriptor {
        backends: wgpu::Backends::DX12,
        ..Default::default()
    });

    instance
        .enumerate_adapters(wgpu::Backends::DX12)
        .first()
        .map(|adapter| adapter.get_info())
}

// Stub implementations for non-Windows platforms
#[cfg(not(target_os = "windows"))]
pub fn recommended_backend() -> wgpu::Backends {
    wgpu::Backends::PRIMARY
}

#[cfg(not(target_os = "windows"))]
pub fn is_dx12_available() -> bool {
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_recommended_backend() {
        // Should always return a valid backend
        let backend = recommended_backend();
        assert!(!backend.is_empty());
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn test_dx12_availability_check() {
        // Should not panic
        let _ = is_dx12_available();
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn test_vulkan_availability_check() {
        // Should not panic
        let _ = is_vulkan_available();
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn test_adapter_info() {
        // Should not panic even if no adapter found
        let _ = get_dx12_adapter_info();
    }
}
