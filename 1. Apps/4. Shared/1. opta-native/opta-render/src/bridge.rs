//! SwiftUI bridge types for cross-language communication.
//!
//! This module defines C-compatible structs that can be safely passed
//! between Swift and Rust via FFI. All types use `#[repr(C)]` for
//! predictable memory layout.
//!
//! # Type Design
//!
//! - **`RenderConfig`**: Swift -> Rust configuration
//! - **`RenderStatus`**: Rust -> Swift status/metrics
//!
//! # Usage from Swift
//!
//! ```swift
//! var config = RenderConfig()
//! config.physical_width = UInt32(view.bounds.width * scale)
//! config.physical_height = UInt32(view.bounds.height * scale)
//! config.scale_factor = scale
//! config.target_fps = 60
//! config.quality_level = 2 // High
//!
//! var status = RenderStatus()
//! opta_render_get_status(ctx, &status)
//! print("FPS: \(status.current_fps)")
//! ```

use crate::quality::QualityLevel;

/// Render configuration passed from Swift to Rust.
///
/// All fields use primitive types for C ABI compatibility.
/// This struct configures the render surface and quality settings.
#[repr(C)]
#[derive(Debug, Clone, Copy)]
pub struct RenderConfig {
    /// Physical width in pixels (not points).
    ///
    /// On Retina displays: `logical_width * scale_factor`
    pub physical_width: u32,

    /// Physical height in pixels (not points).
    ///
    /// On Retina displays: `logical_height * scale_factor`
    pub physical_height: u32,

    /// Display scale factor (1.0, 2.0, or 3.0).
    ///
    /// - 1.0: Standard displays
    /// - 2.0: Retina displays
    /// - 3.0: iPhone Plus/Pro Max
    pub scale_factor: f64,

    /// Target frames per second (30, 60, or 120).
    pub target_fps: u32,

    /// Quality level (0=Low, 1=Medium, 2=High, 3=Ultra).
    pub quality_level: u32,

    /// Whether to enable VSync.
    ///
    /// Set to 1 for enabled, 0 for disabled.
    pub vsync_enabled: u32,

    /// Color space hint (0=sRGB, 1=DisplayP3).
    pub color_space: u32,

    /// Reserved for future use.
    pub _reserved: [u32; 4],
}

impl RenderConfig {
    /// Create a new render config with reasonable defaults.
    #[must_use]
    pub fn new(width: u32, height: u32, scale_factor: f64) -> Self {
        Self {
            physical_width: width,
            physical_height: height,
            scale_factor,
            target_fps: 60,
            quality_level: QualityLevel::Medium.as_u32(),
            vsync_enabled: 1,
            color_space: 0, // sRGB
            _reserved: [0; 4],
        }
    }

    /// Get the logical width in points.
    #[must_use]
    pub fn logical_width(&self) -> f64 {
        f64::from(self.physical_width) / self.scale_factor
    }

    /// Get the logical height in points.
    #[must_use]
    pub fn logical_height(&self) -> f64 {
        f64::from(self.physical_height) / self.scale_factor
    }

    /// Get the quality level as enum.
    #[must_use]
    pub fn quality(&self) -> QualityLevel {
        QualityLevel::from_u32(self.quality_level)
    }

    /// Check if VSync is enabled.
    #[must_use]
    pub fn is_vsync_enabled(&self) -> bool {
        self.vsync_enabled != 0
    }

    /// Check if using Display P3 color space.
    #[must_use]
    pub fn is_display_p3(&self) -> bool {
        self.color_space == 1
    }

    /// Validate the configuration.
    ///
    /// Returns `true` if all values are within acceptable ranges.
    #[must_use]
    pub fn is_valid(&self) -> bool {
        self.physical_width > 0
            && self.physical_width <= 16384
            && self.physical_height > 0
            && self.physical_height <= 16384
            && self.scale_factor > 0.0
            && self.scale_factor <= 4.0
            && self.target_fps >= 30
            && self.target_fps <= 120
            && self.quality_level <= 3
    }
}

impl Default for RenderConfig {
    fn default() -> Self {
        Self::new(800, 600, 2.0)
    }
}

/// Render status returned from Rust to Swift.
///
/// Contains current state and performance metrics for UI display
/// and adaptive quality adjustment.
#[repr(C)]
#[derive(Debug, Clone, Copy)]
pub struct RenderStatus {
    /// Whether the render context is initialized and ready.
    pub is_ready: bool,

    /// Whether rendering is currently paused.
    pub is_paused: bool,

    /// Whether a frame is currently being rendered.
    pub is_rendering: bool,

    /// Current frames per second (rolling average).
    pub current_fps: f32,

    /// Instantaneous FPS from last frame.
    pub instant_fps: f32,

    /// Target FPS.
    pub target_fps: u32,

    /// Last frame render time in milliseconds.
    pub frame_time_ms: f32,

    /// Average frame render time in milliseconds.
    pub average_frame_time_ms: f32,

    /// GPU memory used in bytes (estimate).
    pub gpu_memory_used: u64,

    /// Total frames rendered since init.
    pub total_frames: u64,

    /// Dropped frames count (frames that missed vsync).
    pub dropped_frames: u64,

    /// Current quality level.
    pub quality_level: u32,

    /// Error code from last frame (0 = no error).
    pub last_error_code: u32,

    /// Surface width in pixels.
    pub surface_width: u32,

    /// Surface height in pixels.
    pub surface_height: u32,

    /// Reserved for future use.
    pub _reserved: [u32; 4],
}

impl RenderStatus {
    /// Create an uninitialized status (renderer not ready).
    #[must_use]
    pub fn not_ready() -> Self {
        Self {
            is_ready: false,
            is_paused: true,
            is_rendering: false,
            current_fps: 0.0,
            instant_fps: 0.0,
            target_fps: 0,
            frame_time_ms: 0.0,
            average_frame_time_ms: 0.0,
            gpu_memory_used: 0,
            total_frames: 0,
            dropped_frames: 0,
            quality_level: 0,
            last_error_code: 0,
            surface_width: 0,
            surface_height: 0,
            _reserved: [0; 4],
        }
    }

    /// Check if the renderer is performing well (FPS near target).
    #[must_use]
    #[allow(clippy::cast_precision_loss)]
    pub fn is_performing_well(&self) -> bool {
        if self.target_fps == 0 {
            return false;
        }
        let target = self.target_fps as f32;
        self.current_fps >= target * 0.9
    }

    /// Get the frame time as a percentage of target.
    ///
    /// Returns 100.0 if hitting target, >100 if over budget.
    #[must_use]
    #[allow(clippy::cast_precision_loss)]
    pub fn frame_budget_percent(&self) -> f32 {
        if self.target_fps == 0 {
            return 0.0;
        }
        let target_ms = 1000.0 / self.target_fps as f32;
        (self.frame_time_ms / target_ms) * 100.0
    }

    /// Get the quality level as enum.
    #[must_use]
    pub fn quality(&self) -> QualityLevel {
        QualityLevel::from_u32(self.quality_level)
    }
}

impl Default for RenderStatus {
    fn default() -> Self {
        Self::not_ready()
    }
}

/// Frame submission result passed back to Swift.
///
/// Indicates whether a frame was rendered and provides timing.
#[repr(C)]
#[derive(Debug, Clone, Copy)]
pub struct FrameResult {
    /// Whether the frame was rendered (false if skipped).
    pub rendered: bool,

    /// Frame number (0 if not rendered).
    pub frame_number: u64,

    /// Delta time from previous frame in seconds.
    pub delta_time: f64,

    /// Time spent rendering in milliseconds.
    pub render_time_ms: f32,

    /// Error code (0 = success).
    pub error_code: u32,
}

impl FrameResult {
    /// Create a result for a skipped frame.
    #[must_use]
    pub fn skipped() -> Self {
        Self {
            rendered: false,
            frame_number: 0,
            delta_time: 0.0,
            render_time_ms: 0.0,
            error_code: 0,
        }
    }

    /// Create a result for a successful frame.
    #[must_use]
    pub fn success(frame_number: u64, delta_time: f64, render_time_ms: f32) -> Self {
        Self {
            rendered: true,
            frame_number,
            delta_time,
            render_time_ms,
            error_code: 0,
        }
    }

    /// Create a result for a failed frame.
    #[must_use]
    pub fn error(error_code: u32) -> Self {
        Self {
            rendered: false,
            frame_number: 0,
            delta_time: 0.0,
            render_time_ms: 0.0,
            error_code,
        }
    }
}

impl Default for FrameResult {
    fn default() -> Self {
        Self::skipped()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_render_config_new() {
        let config = RenderConfig::new(1920, 1080, 2.0);
        assert_eq!(config.physical_width, 1920);
        assert_eq!(config.physical_height, 1080);
        assert!((config.scale_factor - 2.0).abs() < f64::EPSILON);
    }

    #[test]
    fn test_render_config_logical_size() {
        let config = RenderConfig::new(1920, 1080, 2.0);
        assert!((config.logical_width() - 960.0).abs() < 0.001);
        assert!((config.logical_height() - 540.0).abs() < 0.001);
    }

    #[test]
    fn test_render_config_validation() {
        let config = RenderConfig::new(1920, 1080, 2.0);
        assert!(config.is_valid());

        let invalid = RenderConfig {
            physical_width: 0,
            ..Default::default()
        };
        assert!(!invalid.is_valid());
    }

    #[test]
    fn test_render_status_not_ready() {
        let status = RenderStatus::not_ready();
        assert!(!status.is_ready);
        assert!(status.is_paused);
    }

    #[test]
    fn test_render_status_performance() {
        let status = RenderStatus {
            target_fps: 60,
            current_fps: 58.0,
            frame_time_ms: 16.6,
            ..Default::default()
        };

        assert!(status.is_performing_well());
        assert!((status.frame_budget_percent() - 99.6).abs() < 1.0);
    }

    #[test]
    fn test_frame_result() {
        let success = FrameResult::success(100, 0.016, 8.0);
        assert!(success.rendered);
        assert_eq!(success.frame_number, 100);

        let skipped = FrameResult::skipped();
        assert!(!skipped.rendered);

        let error = FrameResult::error(1);
        assert!(!error.rendered);
        assert_eq!(error.error_code, 1);
    }

    #[test]
    fn test_repr_c_size() {
        // Ensure structs have expected sizes for FFI
        assert!(std::mem::size_of::<RenderConfig>() > 0);
        assert!(std::mem::size_of::<RenderStatus>() > 0);
        assert!(std::mem::size_of::<FrameResult>() > 0);
    }
}
