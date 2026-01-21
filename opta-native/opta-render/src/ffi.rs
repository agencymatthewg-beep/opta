//! C-compatible FFI exports for Swift integration.
//!
//! This module provides a C ABI interface for initializing and managing
//! the GPU context from Swift/Objective-C code. The design follows the
//! "opaque pointer" pattern where Rust owns the state and Swift holds
//! a raw pointer to it.
//!
//! # Thread Safety
//!
//! All FFI functions must be called from appropriate threads:
//! - `opta_render_init`: Main thread (UI thread)
//! - `opta_render_resize`: Main thread or render thread with synchronization
//! - `opta_render_frame_begin`: Render thread (CADisplayLink callback)
//! - `opta_render_frame_end`: Render thread
//! - `opta_render_destroy`: Main thread
//!
//! # Memory Management
//!
//! Swift is responsible for calling `opta_render_destroy` to free the context.
//! Failure to do so will leak GPU resources.

use std::ffi::c_void;
use std::ptr;
use std::sync::Arc;
use std::time::Instant;

#[cfg(target_os = "macos")]
use raw_window_handle::{AppKitDisplayHandle, AppKitWindowHandle};
#[cfg(target_os = "ios")]
use raw_window_handle::{UiKitDisplayHandle, UiKitWindowHandle};
use raw_window_handle::{
    DisplayHandle, HandleError, HasDisplayHandle, HasWindowHandle, RawDisplayHandle,
    RawWindowHandle, WindowHandle,
};
use tracing::{debug, error, info, warn};

use crate::bridge::RenderStatus;
use crate::error::RenderError;
use crate::instance::GpuContext;
use crate::quality::{QualityLevel, QualitySettings};
use crate::surface::{RenderSurface, SurfaceConfig};
use crate::timing::{FrameInfo, FrameTiming};

/// Opaque handle to the render context passed to Swift.
///
/// This struct bundles the GPU context and surface for FFI.
/// Swift holds a pointer to this and passes it back to Rust functions.
pub struct OptaRenderContext {
    /// The GPU context (instance, device, queue).
    pub gpu: GpuContext,

    /// The render surface (optional, created after init).
    surface: Option<RenderSurface<'static>>,

    /// Wrapper for the view pointer to satisfy raw-window-handle.
    view_wrapper: Option<Arc<ViewWrapper>>,

    /// Frame timing tracker.
    timing: FrameTiming,

    /// Quality settings.
    quality: QualitySettings,

    /// Whether rendering is paused.
    paused: bool,

    /// Whether currently in a frame.
    in_frame: bool,

    /// Frame start time for measuring render duration.
    frame_start: Option<Instant>,

    /// Last frame info.
    last_frame_info: Option<FrameInfo>,

    /// Total frames rendered.
    total_frames: u64,

    /// Dropped frames count.
    dropped_frames: u64,
}

/// Wrapper struct to implement raw-window-handle traits for Apple views.
struct ViewWrapper {
    view_ptr: *mut c_void,
    #[cfg(target_os = "macos")]
    _marker: std::marker::PhantomData<()>,
    #[cfg(target_os = "ios")]
    _marker: std::marker::PhantomData<()>,
}

// SAFETY: ViewWrapper holds a raw pointer that must be valid for the render duration.
// The Swift side guarantees the view outlives the Rust context.
unsafe impl Send for ViewWrapper {}
unsafe impl Sync for ViewWrapper {}

impl HasWindowHandle for ViewWrapper {
    fn window_handle(&self) -> Result<WindowHandle<'_>, HandleError> {
        #[cfg(target_os = "macos")]
        {
            // On macOS, the pointer is to an NSView
            let handle = AppKitWindowHandle::new(
                std::ptr::NonNull::new(self.view_ptr).expect("view_ptr is null"),
            );
            // SAFETY: The caller guarantees the view pointer is valid
            Ok(unsafe { WindowHandle::borrow_raw(RawWindowHandle::AppKit(handle)) })
        }

        #[cfg(target_os = "ios")]
        {
            // On iOS, the pointer is to a UIView
            let handle = UiKitWindowHandle::new(
                std::ptr::NonNull::new(self.view_ptr).expect("view_ptr is null"),
            );
            // SAFETY: The caller guarantees the view pointer is valid
            Ok(unsafe { WindowHandle::borrow_raw(RawWindowHandle::UiKit(handle)) })
        }

        #[cfg(not(any(target_os = "macos", target_os = "ios")))]
        {
            Err(HandleError::Unavailable)
        }
    }
}

impl HasDisplayHandle for ViewWrapper {
    fn display_handle(&self) -> Result<DisplayHandle<'_>, HandleError> {
        #[cfg(target_os = "macos")]
        {
            let handle = AppKitDisplayHandle::new();
            // SAFETY: AppKit display handle requires no pointer
            Ok(unsafe { DisplayHandle::borrow_raw(RawDisplayHandle::AppKit(handle)) })
        }

        #[cfg(target_os = "ios")]
        {
            let handle = UiKitDisplayHandle::new();
            // SAFETY: UIKit display handle requires no pointer
            Ok(unsafe { DisplayHandle::borrow_raw(RawDisplayHandle::UiKit(handle)) })
        }

        #[cfg(not(any(target_os = "macos", target_os = "ios")))]
        {
            Err(HandleError::Unavailable)
        }
    }
}

/// Result code for FFI operations.
#[repr(C)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OptaRenderResult {
    /// Operation succeeded.
    Success = 0,
    /// Null pointer argument.
    NullPointer = 1,
    /// GPU initialization failed.
    GpuInitFailed = 2,
    /// Surface creation failed.
    SurfaceCreationFailed = 3,
    /// Invalid dimensions.
    InvalidDimensions = 4,
    /// Metal backend not available.
    MetalNotAvailable = 5,
    /// Render was skipped (paused or already rendering).
    RenderSkipped = 6,
    /// No surface configured.
    NoSurface = 7,
    /// Invalid quality level.
    InvalidQualityLevel = 8,
    /// Unknown error.
    UnknownError = 255,
}

impl From<RenderError> for OptaRenderResult {
    fn from(err: RenderError) -> Self {
        match err {
            RenderError::InvalidViewPointer => OptaRenderResult::NullPointer,
            RenderError::NoAdapterFound(_) | RenderError::DeviceRequestFailed(_) => {
                OptaRenderResult::GpuInitFailed
            }
            RenderError::SurfaceCreationFailed(_) | RenderError::SurfaceConfigurationFailed => {
                OptaRenderResult::SurfaceCreationFailed
            }
            RenderError::InvalidDimensions(_, _) => OptaRenderResult::InvalidDimensions,
            RenderError::MetalBackendRequired => OptaRenderResult::MetalNotAvailable,
            RenderError::RenderSkipped => OptaRenderResult::RenderSkipped,
            RenderError::NoSurface => OptaRenderResult::NoSurface,
            RenderError::InvalidQualityLevel(_) => OptaRenderResult::InvalidQualityLevel,
            _ => OptaRenderResult::UnknownError,
        }
    }
}

impl From<&RenderError> for OptaRenderResult {
    fn from(err: &RenderError) -> Self {
        Self::from(err.clone())
    }
}

/// GPU capabilities exposed to Swift.
#[repr(C)]
pub struct OptaGpuCapabilities {
    /// Maximum texture dimension (width or height).
    pub max_texture_size: u32,
    /// Maximum compute workgroup size X.
    pub max_compute_workgroup_x: u32,
    /// Maximum compute workgroup size Y.
    pub max_compute_workgroup_y: u32,
    /// Maximum compute workgroup size Z.
    pub max_compute_workgroup_z: u32,
    /// Whether ProMotion (120Hz) is supported.
    pub supports_promotion: bool,
    /// Whether device uses Unified Memory Architecture.
    pub unified_memory: bool,
}

/// Initialize the GPU context (without surface).
///
/// Call this early in app startup to initialize wgpu and detect GPU capabilities.
/// Surface creation happens separately via `opta_render_configure_surface`.
///
/// # Returns
///
/// Pointer to the render context, or null on failure.
///
/// # Safety
///
/// Caller must eventually call `opta_render_destroy` to free the context.
#[no_mangle]
pub extern "C" fn opta_render_init() -> *mut OptaRenderContext {
    info!("opta_render_init: Initializing GPU context");

    match GpuContext::new() {
        Ok(gpu) => {
            // Auto-detect quality based on GPU capabilities
            let quality = QualitySettings::auto_detect(&gpu.capabilities);
            let target_fps = quality.target_fps;

            let context = Box::new(OptaRenderContext {
                gpu,
                surface: None,
                view_wrapper: None,
                timing: FrameTiming::new(target_fps),
                quality,
                paused: false,
                in_frame: false,
                frame_start: None,
                last_frame_info: None,
                total_frames: 0,
                dropped_frames: 0,
            });
            info!("opta_render_init: GPU context created successfully");
            Box::into_raw(context)
        }
        Err(e) => {
            error!("opta_render_init: Failed to create GPU context: {}", e);
            ptr::null_mut()
        }
    }
}

/// Configure the render surface with a view pointer.
///
/// # Arguments
///
/// * `ctx` - Pointer to the render context from `opta_render_init`
/// * `view_ptr` - Pointer to NSView (macOS) or UIView (iOS) backed by CAMetalLayer
/// * `width` - Physical width in pixels
/// * `height` - Physical height in pixels
/// * `scale_factor` - Display scale factor (e.g., 2.0 for Retina)
///
/// # Safety
///
/// - `ctx` must be a valid pointer from `opta_render_init`
/// - `view_ptr` must point to a valid view backed by CAMetalLayer
/// - The view must outlive the render context
#[no_mangle]
pub unsafe extern "C" fn opta_render_configure_surface(
    ctx: *mut OptaRenderContext,
    view_ptr: *mut c_void,
    width: u32,
    height: u32,
    scale_factor: f64,
) -> OptaRenderResult {
    if ctx.is_null() {
        error!("opta_render_configure_surface: null context pointer");
        return OptaRenderResult::NullPointer;
    }

    if view_ptr.is_null() {
        error!("opta_render_configure_surface: null view pointer");
        return OptaRenderResult::NullPointer;
    }

    debug!(
        "opta_render_configure_surface: {}x{} @ {}x",
        width, height, scale_factor
    );

    let context = unsafe { &mut *ctx };

    // Create view wrapper
    let wrapper = Arc::new(ViewWrapper {
        view_ptr,
        _marker: std::marker::PhantomData,
    });

    // Create surface config
    let config = SurfaceConfig {
        width,
        height,
        scale_factor,
        ..Default::default()
    };

    // Create surface
    match RenderSurface::new(&context.gpu, wrapper.clone(), config) {
        Ok(surface) => {
            context.surface = Some(surface);
            context.view_wrapper = Some(wrapper);
            info!("opta_render_configure_surface: Surface configured successfully");
            OptaRenderResult::Success
        }
        Err(e) => {
            error!("opta_render_configure_surface: Failed: {}", e);
            e.into()
        }
    }
}

/// Resize the render surface.
///
/// Call this when the view size changes (window resize, device rotation).
///
/// # Arguments
///
/// * `ctx` - Pointer to the render context
/// * `width` - New physical width in pixels
/// * `height` - New physical height in pixels
///
/// # Safety
///
/// `ctx` must be a valid pointer from `opta_render_init`.
#[no_mangle]
pub unsafe extern "C" fn opta_render_resize(
    ctx: *mut OptaRenderContext,
    width: u32,
    height: u32,
) -> OptaRenderResult {
    if ctx.is_null() {
        return OptaRenderResult::NullPointer;
    }

    let context = unsafe { &mut *ctx };

    if let Some(surface) = &mut context.surface {
        surface.resize(&context.gpu.device, width, height);
        debug!("opta_render_resize: Resized to {}x{}", width, height);
        OptaRenderResult::Success
    } else {
        warn!("opta_render_resize: No surface configured");
        OptaRenderResult::SurfaceCreationFailed
    }
}

/// Get GPU capabilities.
///
/// # Arguments
///
/// * `ctx` - Pointer to the render context
/// * `out_caps` - Pointer to capabilities struct to fill
///
/// # Safety
///
/// Both pointers must be valid.
#[no_mangle]
pub unsafe extern "C" fn opta_render_get_capabilities(
    ctx: *const OptaRenderContext,
    out_caps: *mut OptaGpuCapabilities,
) -> OptaRenderResult {
    if ctx.is_null() || out_caps.is_null() {
        return OptaRenderResult::NullPointer;
    }

    let context = unsafe { &*ctx };
    let caps = &context.gpu.capabilities;

    unsafe {
        (*out_caps).max_texture_size = caps.max_texture_size;
        (*out_caps).max_compute_workgroup_x = caps.max_compute_workgroup_size[0];
        (*out_caps).max_compute_workgroup_y = caps.max_compute_workgroup_size[1];
        (*out_caps).max_compute_workgroup_z = caps.max_compute_workgroup_size[2];
        (*out_caps).supports_promotion = caps.supports_promotion;
        (*out_caps).unified_memory = caps.unified_memory;
    }

    OptaRenderResult::Success
}

/// Destroy the render context and free all resources.
///
/// # Safety
///
/// - `ctx` must be a valid pointer from `opta_render_init`
/// - Do not use the pointer after calling this function
/// - Must be called exactly once per context
#[no_mangle]
pub unsafe extern "C" fn opta_render_destroy(ctx: *mut OptaRenderContext) {
    if ctx.is_null() {
        warn!("opta_render_destroy: null pointer");
        return;
    }

    info!("opta_render_destroy: Destroying render context");

    // Drop the context, which will clean up GPU resources
    let _ = unsafe { Box::from_raw(ctx) };
}

/// Check if the render context has a configured surface.
#[no_mangle]
pub unsafe extern "C" fn opta_render_has_surface(ctx: *const OptaRenderContext) -> bool {
    if ctx.is_null() {
        return false;
    }

    let context = unsafe { &*ctx };
    context.surface.is_some()
}

/// Get the current surface dimensions.
///
/// # Arguments
///
/// * `ctx` - Pointer to the render context
/// * `out_width` - Pointer to store width
/// * `out_height` - Pointer to store height
///
/// # Returns
///
/// Success if surface exists, SurfaceCreationFailed otherwise.
#[no_mangle]
pub unsafe extern "C" fn opta_render_get_surface_size(
    ctx: *const OptaRenderContext,
    out_width: *mut u32,
    out_height: *mut u32,
) -> OptaRenderResult {
    if ctx.is_null() || out_width.is_null() || out_height.is_null() {
        return OptaRenderResult::NullPointer;
    }

    let context = unsafe { &*ctx };

    if let Some(surface) = &context.surface {
        let (w, h) = surface.size();
        unsafe {
            *out_width = w;
            *out_height = h;
        }
        OptaRenderResult::Success
    } else {
        OptaRenderResult::SurfaceCreationFailed
    }
}

// =============================================================================
// Frame Loop FFI Functions
// =============================================================================

/// Begin a render frame.
///
/// Call this at the start of each CADisplayLink/CVDisplayLink callback.
/// Returns Success if a frame should be rendered, RenderSkipped if paused
/// or already in a frame.
///
/// # Arguments
///
/// * `ctx` - Pointer to the render context
///
/// # Safety
///
/// `ctx` must be a valid pointer from `opta_render_init`.
#[no_mangle]
pub unsafe extern "C" fn opta_render_frame_begin(ctx: *mut OptaRenderContext) -> OptaRenderResult {
    if ctx.is_null() {
        return OptaRenderResult::NullPointer;
    }

    let context = unsafe { &mut *ctx };

    // Check if paused or already in frame
    if context.paused {
        return OptaRenderResult::RenderSkipped;
    }

    if context.in_frame {
        warn!("opta_render_frame_begin: Already in frame");
        return OptaRenderResult::RenderSkipped;
    }

    // Begin frame timing
    let frame_info = context.timing.begin_frame();

    // Track frame drops
    if frame_info.is_frame_drop {
        context.dropped_frames += 1;
    }

    context.last_frame_info = Some(frame_info);
    context.in_frame = true;
    context.frame_start = Some(Instant::now());

    debug!(
        "opta_render_frame_begin: Frame {} started (dt={:.3}ms)",
        frame_info.frame_number,
        frame_info.delta_time * 1000.0
    );

    OptaRenderResult::Success
}

/// End a render frame.
///
/// Call this at the end of each render frame, after all GPU commands
/// have been submitted and the frame has been presented.
///
/// # Arguments
///
/// * `ctx` - Pointer to the render context
///
/// # Safety
///
/// `ctx` must be a valid pointer from `opta_render_init`.
#[no_mangle]
pub unsafe extern "C" fn opta_render_frame_end(ctx: *mut OptaRenderContext) -> OptaRenderResult {
    if ctx.is_null() {
        return OptaRenderResult::NullPointer;
    }

    let context = unsafe { &mut *ctx };

    if !context.in_frame {
        warn!("opta_render_frame_end: Not in frame");
        return OptaRenderResult::RenderSkipped;
    }

    context.in_frame = false;
    context.total_frames += 1;
    context.frame_start = None;

    OptaRenderResult::Success
}

/// Set the quality level.
///
/// # Arguments
///
/// * `ctx` - Pointer to the render context
/// * `level` - Quality level (0=Low, 1=Medium, 2=High, 3=Ultra)
///
/// # Safety
///
/// `ctx` must be a valid pointer from `opta_render_init`.
#[no_mangle]
pub unsafe extern "C" fn opta_render_set_quality(
    ctx: *mut OptaRenderContext,
    level: u32,
) -> OptaRenderResult {
    if ctx.is_null() {
        return OptaRenderResult::NullPointer;
    }

    if level > 3 {
        return OptaRenderResult::InvalidQualityLevel;
    }

    let context = unsafe { &mut *ctx };
    let quality_level = QualityLevel::from_u32(level);

    context.quality = QualitySettings::for_level(quality_level);
    context.timing.set_target_fps(context.quality.target_fps);

    info!(
        "opta_render_set_quality: Set to {:?} (target {}fps)",
        quality_level, context.quality.target_fps
    );

    OptaRenderResult::Success
}

/// Set paused state.
///
/// When paused, `opta_render_frame_begin` returns `RenderSkipped`.
///
/// # Arguments
///
/// * `ctx` - Pointer to the render context
/// * `paused` - Whether to pause rendering
///
/// # Safety
///
/// `ctx` must be a valid pointer from `opta_render_init`.
#[no_mangle]
pub unsafe extern "C" fn opta_render_set_paused(
    ctx: *mut OptaRenderContext,
    paused: bool,
) -> OptaRenderResult {
    if ctx.is_null() {
        return OptaRenderResult::NullPointer;
    }

    let context = unsafe { &mut *ctx };
    context.paused = paused;
    context.timing.set_paused(paused);

    debug!("opta_render_set_paused: {}", paused);

    OptaRenderResult::Success
}

/// Get render status.
///
/// Fills in the provided status struct with current render metrics.
///
/// # Arguments
///
/// * `ctx` - Pointer to the render context
/// * `out_status` - Pointer to status struct to fill
///
/// # Safety
///
/// Both pointers must be valid.
#[no_mangle]
pub unsafe extern "C" fn opta_render_get_status(
    ctx: *const OptaRenderContext,
    out_status: *mut RenderStatus,
) -> OptaRenderResult {
    if ctx.is_null() || out_status.is_null() {
        return OptaRenderResult::NullPointer;
    }

    let context = unsafe { &*ctx };

    // Get surface size if available
    let (surface_width, surface_height) = context
        .surface
        .as_ref()
        .map_or((0, 0), RenderSurface::size);

    // Calculate frame time from last frame
    let frame_time_ms = context
        .last_frame_info
        .map_or(0.0, |info| (info.delta_time * 1000.0) as f32);

    // Calculate average frame time
    #[allow(clippy::cast_precision_loss)]
    let average_frame_time_ms = if context.timing.average_fps() > 0.0 {
        (1000.0 / context.timing.average_fps()) as f32
    } else {
        0.0
    };

    #[allow(clippy::cast_precision_loss)]
    let status = RenderStatus {
        is_ready: context.surface.is_some(),
        is_paused: context.paused,
        is_rendering: context.in_frame,
        current_fps: context.timing.average_fps() as f32,
        instant_fps: context
            .last_frame_info
            .map_or(0.0, |info| info.instant_fps as f32),
        target_fps: context.quality.target_fps,
        frame_time_ms,
        average_frame_time_ms,
        gpu_memory_used: 0, // TODO: Track GPU memory usage
        total_frames: context.total_frames,
        dropped_frames: context.dropped_frames,
        quality_level: context.quality.level.as_u32(),
        last_error_code: 0,
        surface_width,
        surface_height,
        _reserved: [0; 4],
    };

    unsafe {
        *out_status = status;
    }

    OptaRenderResult::Success
}

/// Get the current target FPS.
///
/// # Safety
///
/// `ctx` must be a valid pointer from `opta_render_init`.
#[no_mangle]
pub unsafe extern "C" fn opta_render_get_target_fps(ctx: *const OptaRenderContext) -> u32 {
    if ctx.is_null() {
        return 0;
    }

    let context = unsafe { &*ctx };
    context.quality.target_fps
}

/// Get the current average FPS.
///
/// # Safety
///
/// `ctx` must be a valid pointer from `opta_render_init`.
#[no_mangle]
pub unsafe extern "C" fn opta_render_get_current_fps(ctx: *const OptaRenderContext) -> f32 {
    if ctx.is_null() {
        return 0.0;
    }

    let context = unsafe { &*ctx };
    context.timing.average_fps() as f32
}

/// Get the total frames rendered.
///
/// # Safety
///
/// `ctx` must be a valid pointer from `opta_render_init`.
#[no_mangle]
pub unsafe extern "C" fn opta_render_get_total_frames(ctx: *const OptaRenderContext) -> u64 {
    if ctx.is_null() {
        return 0;
    }

    let context = unsafe { &*ctx };
    context.total_frames
}

/// Check if rendering is paused.
///
/// # Safety
///
/// `ctx` must be a valid pointer from `opta_render_init`.
#[no_mangle]
pub unsafe extern "C" fn opta_render_is_paused(ctx: *const OptaRenderContext) -> bool {
    if ctx.is_null() {
        return true;
    }

    let context = unsafe { &*ctx };
    context.paused
}

/// Get the current quality level.
///
/// # Safety
///
/// `ctx` must be a valid pointer from `opta_render_init`.
#[no_mangle]
pub unsafe extern "C" fn opta_render_get_quality_level(ctx: *const OptaRenderContext) -> u32 {
    if ctx.is_null() {
        return 1; // Default to Medium
    }

    let context = unsafe { &*ctx };
    context.quality.level.as_u32()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_result_codes() {
        assert_eq!(OptaRenderResult::Success as i32, 0);
        assert_eq!(OptaRenderResult::NullPointer as i32, 1);
        assert_eq!(OptaRenderResult::RenderSkipped as i32, 6);
    }

    #[test]
    fn test_null_pointer_handling() {
        unsafe {
            assert!(matches!(
                opta_render_resize(ptr::null_mut(), 100, 100),
                OptaRenderResult::NullPointer
            ));

            assert!(matches!(
                opta_render_get_capabilities(ptr::null(), ptr::null_mut()),
                OptaRenderResult::NullPointer
            ));

            assert!(matches!(
                opta_render_frame_begin(ptr::null_mut()),
                OptaRenderResult::NullPointer
            ));

            assert!(matches!(
                opta_render_frame_end(ptr::null_mut()),
                OptaRenderResult::NullPointer
            ));

            assert!(matches!(
                opta_render_set_quality(ptr::null_mut(), 0),
                OptaRenderResult::NullPointer
            ));

            assert!(matches!(
                opta_render_set_paused(ptr::null_mut(), true),
                OptaRenderResult::NullPointer
            ));

            assert!(matches!(
                opta_render_get_status(ptr::null(), ptr::null_mut()),
                OptaRenderResult::NullPointer
            ));
        }
    }

    #[test]
    fn test_invalid_quality_level() {
        // This would require a valid context to test properly
        // For now, just verify the error code exists
        assert_eq!(OptaRenderResult::InvalidQualityLevel as i32, 8);
    }

    #[test]
    fn test_null_fps_functions() {
        unsafe {
            assert_eq!(opta_render_get_target_fps(ptr::null()), 0);
            assert!((opta_render_get_current_fps(ptr::null()) - 0.0).abs() < f32::EPSILON);
            assert_eq!(opta_render_get_total_frames(ptr::null()), 0);
            assert!(opta_render_is_paused(ptr::null()));
            assert_eq!(opta_render_get_quality_level(ptr::null()), 1);
        }
    }
}
