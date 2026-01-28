//! Surface management for wgpu rendering on Apple platforms.
//!
//! This module handles the creation and configuration of wgpu surfaces
//! for rendering into SwiftUI/UIKit views backed by CAMetalLayer.
//!
//! Key considerations for Apple platforms:
//! - Surface must be backed by CAMetalLayer
//! - Physical pixel dimensions (not logical points) must be used
//! - Retina/ProMotion scaling requires proper scale_factor handling
//! - TBDR optimization via proper LoadOp/StoreOp configuration

use std::sync::Arc;

use raw_window_handle::{HasDisplayHandle, HasWindowHandle};
use tracing::{debug, info, warn};
use wgpu::{
    CompositeAlphaMode, Device, PresentMode, Surface, SurfaceCapabilities, SurfaceConfiguration,
    SurfaceTexture, TextureFormat, TextureUsages,
};

use crate::error::{RenderError, RenderResult};
use crate::instance::GpuContext;

/// Configuration for render surface creation.
#[derive(Debug, Clone)]
pub struct SurfaceConfig {
    /// Physical width in pixels (not logical points).
    pub width: u32,

    /// Physical height in pixels (not logical points).
    pub height: u32,

    /// Display scale factor (e.g., 2.0 for Retina, 3.0 for iPhone Plus).
    pub scale_factor: f64,

    /// Preferred present mode (Fifo for VSync, Mailbox for low-latency).
    pub present_mode: PresentMode,

    /// Preferred texture format (usually BGRA8 for Metal).
    pub format: Option<TextureFormat>,
}

impl Default for SurfaceConfig {
    fn default() -> Self {
        Self {
            width: 800,
            height: 600,
            scale_factor: 1.0,
            present_mode: PresentMode::Fifo, // VSync - best for mobile battery
            format: None,                     // Auto-detect
        }
    }
}

impl SurfaceConfig {
    /// Create config from logical size and scale factor.
    ///
    /// # Arguments
    ///
    /// * `logical_width` - Width in logical points (SwiftUI/UIKit coordinates)
    /// * `logical_height` - Height in logical points
    /// * `scale_factor` - Display scale (e.g., 2.0 for Retina)
    pub fn from_logical_size(logical_width: f64, logical_height: f64, scale_factor: f64) -> Self {
        let physical_width = (logical_width * scale_factor) as u32;
        let physical_height = (logical_height * scale_factor) as u32;

        Self {
            width: physical_width.max(1),
            height: physical_height.max(1),
            scale_factor,
            ..Default::default()
        }
    }

    /// Set present mode for the surface.
    pub fn with_present_mode(mut self, mode: PresentMode) -> Self {
        self.present_mode = mode;
        self
    }

    /// Set explicit texture format.
    pub fn with_format(mut self, format: TextureFormat) -> Self {
        self.format = Some(format);
        self
    }
}

/// A render surface for drawing into a native view.
///
/// RenderSurface wraps a wgpu Surface configured for Apple platforms.
/// It handles:
/// - Surface configuration with proper color space
/// - Retina/ProMotion display scaling
/// - Dynamic resize handling
/// - Swapchain texture acquisition
///
/// # Thread Safety
///
/// RenderSurface is NOT thread-safe. On macOS with CVDisplayLink,
/// ensure proper synchronization when resizing from main thread
/// while rendering on display link thread.
pub struct RenderSurface<'window> {
    /// The underlying wgpu surface.
    surface: Surface<'window>,

    /// Current surface configuration.
    config: SurfaceConfiguration,

    /// Current scale factor for Retina handling.
    scale_factor: f64,

    /// Cached surface capabilities.
    capabilities: SurfaceCapabilities,
}

impl<'window> RenderSurface<'window> {
    /// Create a new render surface from a raw window handle.
    ///
    /// # Arguments
    ///
    /// * `gpu_context` - The initialized GPU context
    /// * `window` - Window/view handle (must be backed by CAMetalLayer on Apple)
    /// * `config` - Surface configuration
    ///
    /// # Safety
    ///
    /// The `window` handle must remain valid for the lifetime of this surface.
    /// On iOS/macOS, the view must be backed by CAMetalLayer.
    ///
    /// # Errors
    ///
    /// Returns error if:
    /// - Surface creation fails (invalid view pointer)
    /// - No compatible texture format is found
    /// - Surface configuration fails
    pub fn new<W>(gpu_context: &GpuContext, window: Arc<W>, config: SurfaceConfig) -> RenderResult<Self>
    where
        W: HasWindowHandle + HasDisplayHandle + Send + Sync + 'window,
    {
        // Validate dimensions
        if config.width == 0 || config.height == 0 {
            return Err(RenderError::InvalidDimensions(config.width, config.height));
        }

        info!(
            "Creating render surface: {}x{} @ {}x scale",
            config.width, config.height, config.scale_factor
        );

        // Create surface from window handle
        let surface = gpu_context.instance.create_surface(window)?;

        // Get surface capabilities for this adapter
        let capabilities = surface.get_capabilities(&gpu_context.adapter);

        debug!(
            "Surface capabilities: formats={:?}, present_modes={:?}",
            capabilities.formats, capabilities.present_modes
        );

        // Select optimal format (prefer sRGB for correct color)
        let format = config.format.unwrap_or_else(|| {
            Self::select_optimal_format(&capabilities.formats)
        });

        info!("Selected surface format: {:?}", format);

        // Select present mode (prefer Fifo for battery, Mailbox for low-latency)
        let present_mode = if capabilities.present_modes.contains(&config.present_mode) {
            config.present_mode
        } else {
            warn!(
                "Requested present mode {:?} not available, using {:?}",
                config.present_mode, capabilities.present_modes[0]
            );
            capabilities.present_modes[0]
        };

        // Build surface configuration
        let surface_config = SurfaceConfiguration {
            usage: TextureUsages::RENDER_ATTACHMENT,
            format,
            width: config.width,
            height: config.height,
            present_mode,
            alpha_mode: Self::select_alpha_mode(&capabilities.alpha_modes),
            view_formats: vec![], // Empty = use format directly
            desired_maximum_frame_latency: 2, // Double buffering
        };

        // Configure the surface
        surface.configure(&gpu_context.device, &surface_config);

        debug!("Surface configured successfully");

        Ok(Self {
            surface,
            config: surface_config,
            scale_factor: config.scale_factor,
            capabilities,
        })
    }

    /// Select the optimal texture format for Apple platforms.
    ///
    /// Prefers BGRA8UnormSrgb for correct sRGB color space handling.
    /// Falls back to BGRA8Unorm if sRGB not available.
    fn select_optimal_format(formats: &[TextureFormat]) -> TextureFormat {
        // Prefer sRGB formats for correct color
        let preferred = [
            TextureFormat::Bgra8UnormSrgb,
            TextureFormat::Rgba8UnormSrgb,
            TextureFormat::Bgra8Unorm,
            TextureFormat::Rgba8Unorm,
        ];

        for format in preferred {
            if formats.contains(&format) {
                return format;
            }
        }

        // Fallback to first available
        formats.first().copied().unwrap_or(TextureFormat::Bgra8UnormSrgb)
    }

    /// Select appropriate alpha compositing mode.
    fn select_alpha_mode(modes: &[CompositeAlphaMode]) -> CompositeAlphaMode {
        // Prefer opaque for best performance, then premultiplied for compositing
        let preferred = [
            CompositeAlphaMode::Opaque,
            CompositeAlphaMode::PreMultiplied,
            CompositeAlphaMode::PostMultiplied,
            CompositeAlphaMode::Auto,
        ];

        for mode in preferred {
            if modes.contains(&mode) {
                return mode;
            }
        }

        CompositeAlphaMode::Auto
    }

    /// Resize the surface to new dimensions.
    ///
    /// Call this when the view size changes (window resize, device rotation).
    ///
    /// # Arguments
    ///
    /// * `device` - The GPU device
    /// * `new_width` - New physical width in pixels
    /// * `new_height` - New physical height in pixels
    ///
    /// # Note
    ///
    /// On macOS with CVDisplayLink, call this from the render thread
    /// or use proper synchronization.
    pub fn resize(&mut self, device: &Device, new_width: u32, new_height: u32) {
        // Ignore invalid dimensions
        if new_width == 0 || new_height == 0 {
            warn!("Ignoring resize to invalid dimensions: {}x{}", new_width, new_height);
            return;
        }

        // Skip if dimensions unchanged
        if self.config.width == new_width && self.config.height == new_height {
            return;
        }

        debug!("Resizing surface: {}x{} -> {}x{}", 
            self.config.width, self.config.height, new_width, new_height);

        self.config.width = new_width;
        self.config.height = new_height;
        self.surface.configure(device, &self.config);
    }

    /// Resize from logical coordinates with scale factor.
    pub fn resize_logical(&mut self, device: &Device, logical_width: f64, logical_height: f64) {
        let physical_width = (logical_width * self.scale_factor) as u32;
        let physical_height = (logical_height * self.scale_factor) as u32;
        self.resize(device, physical_width, physical_height);
    }

    /// Update scale factor (e.g., when moving between displays).
    pub fn update_scale_factor(&mut self, device: &Device, new_scale_factor: f64) {
        if (self.scale_factor - new_scale_factor).abs() < 0.001 {
            return;
        }

        debug!("Updating scale factor: {} -> {}", self.scale_factor, new_scale_factor);
        
        // Recalculate physical size from logical
        let logical_width = self.config.width as f64 / self.scale_factor;
        let logical_height = self.config.height as f64 / self.scale_factor;
        
        self.scale_factor = new_scale_factor;
        self.resize_logical(device, logical_width, logical_height);
    }

    /// Get the next texture from the swapchain for rendering.
    ///
    /// # Errors
    ///
    /// Returns `SurfaceError::Timeout` if the timeout is exceeded.
    /// Returns `SurfaceError::Outdated` if surface needs reconfiguration.
    /// Returns `SurfaceError::Lost` if surface is no longer valid.
    pub fn get_current_texture(&self) -> RenderResult<SurfaceTexture> {
        self.surface
            .get_current_texture()
            .map_err(RenderError::from)
    }

    /// Get the current surface texture format.
    pub fn format(&self) -> TextureFormat {
        self.config.format
    }

    /// Get the current physical dimensions.
    pub fn size(&self) -> (u32, u32) {
        (self.config.width, self.config.height)
    }

    /// Get the current scale factor.
    pub fn scale_factor(&self) -> f64 {
        self.scale_factor
    }

    /// Get the current present mode.
    pub fn present_mode(&self) -> PresentMode {
        self.config.present_mode
    }

    /// Check if a present mode is supported.
    pub fn supports_present_mode(&self, mode: PresentMode) -> bool {
        self.capabilities.present_modes.contains(&mode)
    }

    /// Set present mode (reconfigures surface).
    pub fn set_present_mode(&mut self, device: &Device, mode: PresentMode) {
        if !self.supports_present_mode(mode) {
            warn!("Present mode {:?} not supported", mode);
            return;
        }

        if self.config.present_mode != mode {
            debug!("Changing present mode: {:?} -> {:?}", self.config.present_mode, mode);
            self.config.present_mode = mode;
            self.surface.configure(device, &self.config);
        }
    }
}

impl std::fmt::Debug for RenderSurface<'_> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("RenderSurface")
            .field("width", &self.config.width)
            .field("height", &self.config.height)
            .field("scale_factor", &self.scale_factor)
            .field("format", &self.config.format)
            .field("present_mode", &self.config.present_mode)
            .finish()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_surface_config_from_logical() {
        let config = SurfaceConfig::from_logical_size(400.0, 300.0, 2.0);
        assert_eq!(config.width, 800);
        assert_eq!(config.height, 600);
        assert_eq!(config.scale_factor, 2.0);
    }

    #[test]
    fn test_surface_config_default() {
        let config = SurfaceConfig::default();
        assert_eq!(config.present_mode, PresentMode::Fifo);
        assert!(config.format.is_none());
    }

    #[test]
    fn test_format_selection() {
        let formats = vec![
            TextureFormat::Bgra8Unorm,
            TextureFormat::Bgra8UnormSrgb,
        ];
        let selected = RenderSurface::select_optimal_format(&formats);
        assert_eq!(selected, TextureFormat::Bgra8UnormSrgb);
    }

    #[test]
    fn test_format_fallback() {
        let formats = vec![TextureFormat::Rgba8Unorm];
        let selected = RenderSurface::select_optimal_format(&formats);
        assert_eq!(selected, TextureFormat::Rgba8Unorm);
    }
}
