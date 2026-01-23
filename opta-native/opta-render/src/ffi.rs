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
use crate::components::{
    AnimatedCircularMenu, CircularMenuConfig, CircularMenuSector,
    is_point_in_menu, point_to_sector, sector_center_position,
};
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
    pub(crate) surface: Option<RenderSurface<'static>>,

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

// MARK: - Compatibility Aliases

/// Create a new render context (alias for opta_render_init).
///
/// # Returns
///
/// Pointer to the render context, or null on failure.
///
/// # Safety
///
/// Caller must eventually call `opta_render_destroy` to free the context.
#[no_mangle]
pub extern "C" fn opta_render_create() -> *mut OptaRenderContext {
    opta_render_init()
}

/// Get the last error message (currently always returns null).
///
/// # Safety
///
/// `ctx` can be null.
#[no_mangle]
pub unsafe extern "C" fn opta_render_get_last_error(_ctx: *const OptaRenderContext) -> *const std::ffi::c_char {
    std::ptr::null()
}

/// Set quality level as a float value (0.0 = lowest, 1.0 = highest).
///
/// # Safety
///
/// `ctx` must be a valid pointer from `opta_render_init`.
#[no_mangle]
pub unsafe extern "C" fn opta_render_set_quality_value(
    ctx: *mut OptaRenderContext,
    quality_value: f32,
) -> OptaRenderResult {
    if ctx.is_null() {
        return OptaRenderResult::NullPointer;
    }

    let context = unsafe { &mut *ctx };

    // Map 0.0-1.0 to quality levels
    let level = if quality_value <= 0.25 {
        QualityLevel::Low
    } else if quality_value <= 0.5 {
        QualityLevel::Medium
    } else if quality_value <= 0.75 {
        QualityLevel::High
    } else {
        QualityLevel::Ultra
    };

    // Create new quality settings for this level
    context.quality = QualitySettings::for_level(level);

    info!("Set quality value to {:.2} (level: {:?})", quality_value, level);
    OptaRenderResult::Success
}

/// Set the target frame rate.
///
/// # Safety
///
/// `ctx` must be a valid pointer from `opta_render_init`.
#[no_mangle]
pub unsafe extern "C" fn opta_render_set_target_fps(
    ctx: *mut OptaRenderContext,
    target_fps: u32,
) -> OptaRenderResult {
    if ctx.is_null() {
        return OptaRenderResult::NullPointer;
    }

    let context = unsafe { &mut *ctx };
    context.quality.target_fps = target_fps;
    context.timing = FrameTiming::new(target_fps);

    info!("Set target FPS to {}", target_fps);
    OptaRenderResult::Success
}

// =============================================================================
// Circular Menu FFI Functions
// =============================================================================

/// Opaque handle to a circular menu for Swift.
pub struct OptaCircularMenu {
    /// Configuration for the menu.
    config: CircularMenuConfig,
    /// Animated state wrapper.
    animation: AnimatedCircularMenu,
    /// Sectors in the menu (reserved for future use).
    #[allow(dead_code)]
    sectors: Vec<CircularMenuSector>,
}

/// Configuration passed from Swift for circular menu creation.
#[repr(C)]
pub struct OptaCircularMenuConfig {
    /// Center X position in pixels.
    pub center_x: f32,
    /// Center Y position in pixels.
    pub center_y: f32,
    /// Outer radius in pixels.
    pub radius: f32,
    /// Inner radius in pixels.
    pub inner_radius: f32,
    /// Number of sectors.
    pub sector_count: u32,
    /// Branch energy color red component (0.0-1.0).
    pub branch_energy_r: f32,
    /// Branch energy color green component (0.0-1.0).
    pub branch_energy_g: f32,
    /// Branch energy color blue component (0.0-1.0).
    pub branch_energy_b: f32,
    /// Branch energy intensity (0.0 - 2.0+).
    pub branch_energy_intensity: f32,
    /// Rotation offset in radians.
    pub rotation_offset: f32,
}

impl Default for OptaCircularMenuConfig {
    fn default() -> Self {
        Self {
            center_x: 0.0,
            center_y: 0.0,
            radius: 150.0,
            inner_radius: 50.0,
            sector_count: 4,
            branch_energy_r: 0.545,
            branch_energy_g: 0.361,
            branch_energy_b: 0.965,
            branch_energy_intensity: 1.5,
            rotation_offset: -std::f32::consts::FRAC_PI_2,
        }
    }
}

/// Hit test result for circular menu.
#[repr(C)]
pub struct OptaCircularMenuHitTest {
    /// Sector index (-1 if not in menu).
    pub sector_index: i32,
    /// Whether the point is within the menu ring.
    pub is_in_menu: bool,
    /// X position of the sector center (valid if sector_index >= 0).
    pub sector_center_x: f32,
    /// Y position of the sector center (valid if sector_index >= 0).
    pub sector_center_y: f32,
}

/// Create a new circular menu.
///
/// # Arguments
///
/// * `config` - Pointer to configuration struct
///
/// # Returns
///
/// Pointer to the circular menu, or null on failure.
///
/// # Safety
///
/// Caller must eventually call `opta_circular_menu_destroy` to free the menu.
#[no_mangle]
pub unsafe extern "C" fn opta_circular_menu_create(
    config: *const OptaCircularMenuConfig,
) -> *mut OptaCircularMenu {
    let config_ref = if config.is_null() {
        OptaCircularMenuConfig::default()
    } else {
        unsafe { &*config }.clone()
    };

    let menu_config = CircularMenuConfig {
        position: [config_ref.center_x, config_ref.center_y],
        radius: config_ref.radius,
        inner_radius: config_ref.inner_radius,
        sector_count: config_ref.sector_count,
        branch_energy_color: [
            config_ref.branch_energy_r,
            config_ref.branch_energy_g,
            config_ref.branch_energy_b,
        ],
        branch_energy_intensity: config_ref.branch_energy_intensity,
        rotation_offset: config_ref.rotation_offset,
        ..CircularMenuConfig::default()
    };

    let menu = Box::new(OptaCircularMenu {
        config: menu_config,
        animation: AnimatedCircularMenu::new(),
        sectors: Vec::new(),
    });

    info!("opta_circular_menu_create: Created circular menu");
    Box::into_raw(menu)
}

impl Clone for OptaCircularMenuConfig {
    fn clone(&self) -> Self {
        *self
    }
}

impl Copy for OptaCircularMenuConfig {}

/// Destroy a circular menu and free resources.
///
/// # Safety
///
/// * `menu` must be a valid pointer from `opta_circular_menu_create`
/// * Do not use the pointer after calling this function
#[no_mangle]
pub unsafe extern "C" fn opta_circular_menu_destroy(menu: *mut OptaCircularMenu) {
    if menu.is_null() {
        warn!("opta_circular_menu_destroy: null pointer");
        return;
    }

    info!("opta_circular_menu_destroy: Destroying circular menu");
    let _ = unsafe { Box::from_raw(menu) };
}

/// Open the circular menu with animation.
///
/// # Safety
///
/// `menu` must be a valid pointer from `opta_circular_menu_create`.
#[no_mangle]
pub unsafe extern "C" fn opta_circular_menu_open(menu: *mut OptaCircularMenu) -> OptaRenderResult {
    if menu.is_null() {
        return OptaRenderResult::NullPointer;
    }

    let menu_ref = unsafe { &mut *menu };
    menu_ref.animation.open();
    debug!("opta_circular_menu_open: Menu opening");
    OptaRenderResult::Success
}

/// Close the circular menu with animation.
///
/// # Safety
///
/// `menu` must be a valid pointer from `opta_circular_menu_create`.
#[no_mangle]
pub unsafe extern "C" fn opta_circular_menu_close(menu: *mut OptaCircularMenu) -> OptaRenderResult {
    if menu.is_null() {
        return OptaRenderResult::NullPointer;
    }

    let menu_ref = unsafe { &mut *menu };
    menu_ref.animation.close();
    debug!("opta_circular_menu_close: Menu closing");
    OptaRenderResult::Success
}

/// Toggle the circular menu open/closed state.
///
/// # Safety
///
/// `menu` must be a valid pointer from `opta_circular_menu_create`.
#[no_mangle]
pub unsafe extern "C" fn opta_circular_menu_toggle(menu: *mut OptaCircularMenu) -> OptaRenderResult {
    if menu.is_null() {
        return OptaRenderResult::NullPointer;
    }

    let menu_ref = unsafe { &mut *menu };
    menu_ref.animation.toggle();
    debug!("opta_circular_menu_toggle: Menu toggled, is_open={}", menu_ref.animation.is_open());
    OptaRenderResult::Success
}

/// Check if the circular menu is open.
///
/// # Safety
///
/// `menu` must be a valid pointer from `opta_circular_menu_create`.
#[no_mangle]
pub unsafe extern "C" fn opta_circular_menu_is_open(menu: *const OptaCircularMenu) -> bool {
    if menu.is_null() {
        return false;
    }

    let menu_ref = unsafe { &*menu };
    menu_ref.animation.is_open()
}

/// Set the highlighted sector.
///
/// # Arguments
///
/// * `menu` - Pointer to the circular menu
/// * `sector` - Sector index to highlight (-1 for none)
///
/// # Safety
///
/// `menu` must be a valid pointer from `opta_circular_menu_create`.
#[no_mangle]
pub unsafe extern "C" fn opta_circular_menu_set_highlighted_sector(
    menu: *mut OptaCircularMenu,
    sector: i32,
) -> OptaRenderResult {
    if menu.is_null() {
        return OptaRenderResult::NullPointer;
    }

    let menu_ref = unsafe { &mut *menu };
    menu_ref.animation.set_highlighted_sector(sector);
    OptaRenderResult::Success
}

/// Get the currently highlighted sector.
///
/// # Safety
///
/// `menu` must be a valid pointer from `opta_circular_menu_create`.
#[no_mangle]
pub unsafe extern "C" fn opta_circular_menu_get_highlighted_sector(menu: *const OptaCircularMenu) -> i32 {
    if menu.is_null() {
        return -1;
    }

    let menu_ref = unsafe { &*menu };
    menu_ref.animation.highlighted_sector()
}

/// Update the circular menu animation.
///
/// # Arguments
///
/// * `menu` - Pointer to the circular menu
/// * `dt` - Time delta in seconds
///
/// # Safety
///
/// `menu` must be a valid pointer from `opta_circular_menu_create`.
#[no_mangle]
pub unsafe extern "C" fn opta_circular_menu_update(
    menu: *mut OptaCircularMenu,
    dt: f32,
) -> OptaRenderResult {
    if menu.is_null() {
        return OptaRenderResult::NullPointer;
    }

    let menu_ref = unsafe { &mut *menu };
    menu_ref.animation.update(dt);
    OptaRenderResult::Success
}

/// Check if the menu animation is currently active.
///
/// # Safety
///
/// `menu` must be a valid pointer from `opta_circular_menu_create`.
#[no_mangle]
pub unsafe extern "C" fn opta_circular_menu_is_animating(menu: *const OptaCircularMenu) -> bool {
    if menu.is_null() {
        return false;
    }

    let menu_ref = unsafe { &*menu };
    menu_ref.animation.is_animating()
}

/// Get the current open progress (0.0 = closed, 1.0 = open).
///
/// # Safety
///
/// `menu` must be a valid pointer from `opta_circular_menu_create`.
#[no_mangle]
pub unsafe extern "C" fn opta_circular_menu_get_open_progress(menu: *const OptaCircularMenu) -> f32 {
    if menu.is_null() {
        return 0.0;
    }

    let menu_ref = unsafe { &*menu };
    menu_ref.animation.open_progress()
}

/// Get the current highlight progress (0.0 = none, 1.0 = full).
///
/// # Safety
///
/// `menu` must be a valid pointer from `opta_circular_menu_create`.
#[no_mangle]
pub unsafe extern "C" fn opta_circular_menu_get_highlight_progress(menu: *const OptaCircularMenu) -> f32 {
    if menu.is_null() {
        return 0.0;
    }

    let menu_ref = unsafe { &*menu };
    menu_ref.animation.highlight_progress()
}

/// Set the menu center position.
///
/// # Safety
///
/// `menu` must be a valid pointer from `opta_circular_menu_create`.
#[no_mangle]
pub unsafe extern "C" fn opta_circular_menu_set_position(
    menu: *mut OptaCircularMenu,
    center_x: f32,
    center_y: f32,
) -> OptaRenderResult {
    if menu.is_null() {
        return OptaRenderResult::NullPointer;
    }

    let menu_ref = unsafe { &mut *menu };
    menu_ref.config.set_position(center_x, center_y);
    OptaRenderResult::Success
}

/// Hit test a point against the circular menu.
///
/// # Arguments
///
/// * `menu` - Pointer to the circular menu
/// * `x` - X coordinate to test
/// * `y` - Y coordinate to test
/// * `out_result` - Pointer to hit test result struct
///
/// # Safety
///
/// Both pointers must be valid.
#[no_mangle]
pub unsafe extern "C" fn opta_circular_menu_hit_test(
    menu: *const OptaCircularMenu,
    x: f32,
    y: f32,
    out_result: *mut OptaCircularMenuHitTest,
) -> OptaRenderResult {
    if menu.is_null() || out_result.is_null() {
        return OptaRenderResult::NullPointer;
    }

    let menu_ref = unsafe { &*menu };
    let point = [x, y];
    let center = menu_ref.config.position;
    let open_progress = menu_ref.animation.open_progress();

    // Scale radii by open progress
    let radius = menu_ref.config.radius * open_progress;
    let inner_radius = menu_ref.config.inner_radius * open_progress;

    let is_in_menu = is_point_in_menu(point, center, inner_radius, radius);
    let sector_index = point_to_sector(
        point,
        center,
        inner_radius,
        radius,
        menu_ref.config.sector_count,
        menu_ref.config.rotation_offset,
    );

    let (sector_center_x, sector_center_y) = if sector_index >= 0 {
        let pos = sector_center_position(
            sector_index as u32,
            menu_ref.config.sector_count,
            center,
            inner_radius,
            radius,
            menu_ref.config.rotation_offset,
        );
        (pos[0], pos[1])
    } else {
        (0.0, 0.0)
    };

    unsafe {
        (*out_result) = OptaCircularMenuHitTest {
            sector_index,
            is_in_menu,
            sector_center_x,
            sector_center_y,
        };
    }

    OptaRenderResult::Success
}

/// Set the number of sectors in the menu.
///
/// # Safety
///
/// `menu` must be a valid pointer from `opta_circular_menu_create`.
#[no_mangle]
pub unsafe extern "C" fn opta_circular_menu_set_sector_count(
    menu: *mut OptaCircularMenu,
    count: u32,
) -> OptaRenderResult {
    if menu.is_null() {
        return OptaRenderResult::NullPointer;
    }

    if count == 0 || count > 12 {
        return OptaRenderResult::InvalidDimensions;
    }

    let menu_ref = unsafe { &mut *menu };
    menu_ref.config.sector_count = count;
    OptaRenderResult::Success
}

/// Get the number of sectors in the menu.
///
/// # Safety
///
/// `menu` must be a valid pointer from `opta_circular_menu_create`.
#[no_mangle]
pub unsafe extern "C" fn opta_circular_menu_get_sector_count(menu: *const OptaCircularMenu) -> u32 {
    if menu.is_null() {
        return 0;
    }

    let menu_ref = unsafe { &*menu };
    menu_ref.config.sector_count
}

/// Set the branch energy color for the highlighted sector.
///
/// # Safety
///
/// `menu` must be a valid pointer from `opta_circular_menu_create`.
#[no_mangle]
pub unsafe extern "C" fn opta_circular_menu_set_branch_energy_color(
    menu: *mut OptaCircularMenu,
    r: f32,
    g: f32,
    b: f32,
) -> OptaRenderResult {
    if menu.is_null() {
        return OptaRenderResult::NullPointer;
    }

    let menu_ref = unsafe { &mut *menu };
    menu_ref.config.set_branch_energy_color(r, g, b);
    OptaRenderResult::Success
}

/// Immediately set the open state without animation.
///
/// # Safety
///
/// `menu` must be a valid pointer from `opta_circular_menu_create`.
#[no_mangle]
pub unsafe extern "C" fn opta_circular_menu_set_open_immediate(
    menu: *mut OptaCircularMenu,
    open: bool,
) -> OptaRenderResult {
    if menu.is_null() {
        return OptaRenderResult::NullPointer;
    }

    let menu_ref = unsafe { &mut *menu };
    menu_ref.animation.set_open_immediate(open);
    OptaRenderResult::Success
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

    #[test]
    fn test_circular_menu_null_pointer_handling() {
        unsafe {
            assert!(matches!(
                opta_circular_menu_open(ptr::null_mut()),
                OptaRenderResult::NullPointer
            ));

            assert!(matches!(
                opta_circular_menu_close(ptr::null_mut()),
                OptaRenderResult::NullPointer
            ));

            assert!(matches!(
                opta_circular_menu_toggle(ptr::null_mut()),
                OptaRenderResult::NullPointer
            ));

            assert!(!opta_circular_menu_is_open(ptr::null()));

            assert!(matches!(
                opta_circular_menu_update(ptr::null_mut(), 0.016),
                OptaRenderResult::NullPointer
            ));

            assert_eq!(opta_circular_menu_get_highlighted_sector(ptr::null()), -1);
            assert!((opta_circular_menu_get_open_progress(ptr::null()) - 0.0).abs() < f32::EPSILON);
        }
    }

    #[test]
    fn test_circular_menu_create_destroy() {
        unsafe {
            // Create with default config
            let menu = opta_circular_menu_create(ptr::null());
            assert!(!menu.is_null());

            // Check initial state
            assert!(!opta_circular_menu_is_open(menu));
            assert_eq!(opta_circular_menu_get_highlighted_sector(menu), -1);
            assert!((opta_circular_menu_get_open_progress(menu) - 0.0).abs() < f32::EPSILON);

            // Destroy
            opta_circular_menu_destroy(menu);
        }
    }

    #[test]
    fn test_circular_menu_open_close() {
        unsafe {
            let menu = opta_circular_menu_create(ptr::null());
            assert!(!menu.is_null());

            // Open
            assert!(matches!(
                opta_circular_menu_open(menu),
                OptaRenderResult::Success
            ));
            assert!(opta_circular_menu_is_open(menu));
            assert!(opta_circular_menu_is_animating(menu));

            // Simulate animation
            for _ in 0..240 {
                opta_circular_menu_update(menu, 1.0 / 120.0);
            }

            // Should be near fully open
            let progress = opta_circular_menu_get_open_progress(menu);
            assert!(progress > 0.9);

            // Close
            assert!(matches!(
                opta_circular_menu_close(menu),
                OptaRenderResult::Success
            ));
            assert!(!opta_circular_menu_is_open(menu));

            opta_circular_menu_destroy(menu);
        }
    }

    #[test]
    fn test_circular_menu_hit_test() {
        unsafe {
            let mut config = OptaCircularMenuConfig::default();
            config.center_x = 200.0;
            config.center_y = 200.0;
            config.radius = 150.0;
            config.inner_radius = 50.0;
            config.sector_count = 4;
            config.rotation_offset = 0.0;

            let menu = opta_circular_menu_create(&config);
            assert!(!menu.is_null());

            // Set menu fully open immediately
            opta_circular_menu_set_open_immediate(menu, true);

            let mut result = OptaCircularMenuHitTest {
                sector_index: -1,
                is_in_menu: false,
                sector_center_x: 0.0,
                sector_center_y: 0.0,
            };

            // Test point in sector 0 (right side)
            assert!(matches!(
                opta_circular_menu_hit_test(menu, 300.0, 200.0, &mut result),
                OptaRenderResult::Success
            ));
            assert!(result.is_in_menu);
            assert_eq!(result.sector_index, 0);

            // Test point outside menu
            assert!(matches!(
                opta_circular_menu_hit_test(menu, 0.0, 0.0, &mut result),
                OptaRenderResult::Success
            ));
            assert!(!result.is_in_menu);
            assert_eq!(result.sector_index, -1);

            opta_circular_menu_destroy(menu);
        }
    }
}
