//! C-compatible FFI exports for GlassPanel and Branch energy components.
//!
//! This module provides a C ABI interface for creating, configuring, updating,
//! and rendering obsidian panels and branch energy visualizations from Swift.
//! Follows the opaque-pointer pattern established in `ffi.rs`.
//!
//! # Components
//!
//! - **OptaPanel**: Obsidian glass panel with Cook-Torrance specular and edge branches
//! - **OptaBranchMeter**: Horizontal meter with branch energy veins (replaces progress bars)
//! - **OptaBranchIndicator**: Circular status indicator with radial branch veins
//! - **OptaBranchBorder**: Panel border with perimeter-flowing branch veins
//!
//! # Thread Safety
//!
//! All FFI functions must be called from the render thread or main thread
//! with proper synchronization. The render context pointer must remain valid
//! for the lifetime of all component pointers.

use tracing::{debug, error, info, warn};

use crate::components::{
    BranchBorder, BranchBorderUniforms,
    BranchIndicator, BranchIndicatorUniforms,
    BranchMeter, BranchMeterUniforms,
    GlassPanel, GlassPanelConfig, PanelQualityLevel,
};
use crate::ffi::{OptaRenderContext, OptaRenderResult};

// =============================================================================
// GlassPanel FFI Types
// =============================================================================

/// Configuration passed from Swift for panel creation.
#[repr(C)]
#[derive(Debug, Clone, Copy)]
pub struct OptaPanelConfig {
    /// Panel position X in pixels.
    pub position_x: f32,
    /// Panel position Y in pixels.
    pub position_y: f32,
    /// Panel width in pixels.
    pub width: f32,
    /// Panel height in pixels.
    pub height: f32,
    /// Corner radius in pixels.
    pub corner_radius: f32,
    /// Border width in pixels.
    pub border_width: f32,
    /// Initial branch energy level [0, 1].
    pub energy: f32,
    /// Depth hierarchy layer [0, 1].
    pub depth_layer: f32,
    /// Quality level (0=Low, 1=Medium, 2=High, 3=Ultra).
    pub quality_level: u32,
}

impl Default for OptaPanelConfig {
    fn default() -> Self {
        Self {
            position_x: 0.0,
            position_y: 0.0,
            width: 200.0,
            height: 150.0,
            corner_radius: 16.0,
            border_width: 1.0,
            energy: 0.3,
            depth_layer: 0.0,
            quality_level: 2,
        }
    }
}

/// Opaque handle to a GlassPanel for Swift.
pub struct OptaPanel {
    /// The GlassPanel GPU component.
    panel: GlassPanel,
    /// Current configuration.
    config: GlassPanelConfig,
    /// Animation time accumulator.
    time: f32,
}

// =============================================================================
// GlassPanel FFI Functions
// =============================================================================

/// Create a new obsidian panel.
///
/// # Arguments
///
/// * `ctx` - Pointer to the render context (provides device and surface format)
/// * `config` - Pointer to panel configuration (null for defaults)
///
/// # Returns
///
/// Pointer to the panel, or null on failure.
///
/// # Safety
///
/// - `ctx` must be a valid pointer from `opta_render_init`
/// - Caller must eventually call `opta_panel_destroy` to free the panel
#[no_mangle]
pub unsafe extern "C" fn opta_panel_create(
    ctx: *mut OptaRenderContext,
    config: *const OptaPanelConfig,
) -> *mut OptaPanel {
    if ctx.is_null() {
        error!("opta_panel_create: null context pointer");
        return std::ptr::null_mut();
    }

    let context = unsafe { &*ctx };
    let ffi_config = if config.is_null() {
        OptaPanelConfig::default()
    } else {
        unsafe { *config }
    };

    // Build GlassPanelConfig from FFI config
    let mut panel_config = GlassPanelConfig::default();
    panel_config.position = [ffi_config.position_x, ffi_config.position_y];
    panel_config.size = [ffi_config.width, ffi_config.height];
    panel_config.corner_radius = ffi_config.corner_radius;
    panel_config.border_width = ffi_config.border_width;
    panel_config.branch_energy = ffi_config.energy;
    panel_config.depth_layer = ffi_config.depth_layer;
    panel_config.set_quality(PanelQualityLevel::from_u32(ffi_config.quality_level));

    // Get surface dimensions (default to config size if no surface)
    let (surface_width, surface_height) = if let Some(surface) = &context.surface {
        surface.size()
    } else {
        (ffi_config.width as u32, ffi_config.height as u32)
    };

    // Get surface format
    let surface_format = if let Some(surface) = &context.surface {
        surface.format()
    } else {
        wgpu::TextureFormat::Bgra8UnormSrgb
    };

    let panel = GlassPanel::new(
        &context.gpu.device,
        surface_format,
        surface_width,
        surface_height,
    );

    let opta_panel = Box::new(OptaPanel {
        panel,
        config: panel_config,
        time: 0.0,
    });

    info!("opta_panel_create: Created panel ({}x{} at [{}, {}])",
        ffi_config.width, ffi_config.height, ffi_config.position_x, ffi_config.position_y);

    Box::into_raw(opta_panel)
}

/// Destroy a panel and free resources.
///
/// # Safety
///
/// - `panel` must be a valid pointer from `opta_panel_create`
/// - Do not use the pointer after calling this function
#[no_mangle]
pub unsafe extern "C" fn opta_panel_destroy(panel: *mut OptaPanel) {
    if panel.is_null() {
        warn!("opta_panel_destroy: null pointer");
        return;
    }

    info!("opta_panel_destroy: Destroying panel");
    let _ = unsafe { Box::from_raw(panel) };
}

/// Set the panel position.
///
/// # Safety
///
/// `panel` must be a valid pointer from `opta_panel_create`.
#[no_mangle]
pub unsafe extern "C" fn opta_panel_set_position(
    panel: *mut OptaPanel,
    x: f32,
    y: f32,
) -> OptaRenderResult {
    if panel.is_null() {
        return OptaRenderResult::NullPointer;
    }

    let p = unsafe { &mut *panel };
    p.config.position = [x, y];
    p.panel.set_config(p.config);
    debug!("opta_panel_set_position: [{}, {}]", x, y);
    OptaRenderResult::Success
}

/// Set the panel size.
///
/// # Safety
///
/// `panel` must be a valid pointer from `opta_panel_create`.
#[no_mangle]
pub unsafe extern "C" fn opta_panel_set_size(
    panel: *mut OptaPanel,
    width: f32,
    height: f32,
) -> OptaRenderResult {
    if panel.is_null() {
        return OptaRenderResult::NullPointer;
    }

    let p = unsafe { &mut *panel };
    p.config.size = [width, height];
    p.panel.set_config(p.config);
    debug!("opta_panel_set_size: {}x{}", width, height);
    OptaRenderResult::Success
}

/// Set the branch energy level.
///
/// # Arguments
///
/// * `panel` - Pointer to the panel
/// * `energy` - Energy level [0.0, 1.0]
///
/// # Safety
///
/// `panel` must be a valid pointer from `opta_panel_create`.
#[no_mangle]
pub unsafe extern "C" fn opta_panel_set_energy(
    panel: *mut OptaPanel,
    energy: f32,
) -> OptaRenderResult {
    if panel.is_null() {
        return OptaRenderResult::NullPointer;
    }

    let p = unsafe { &mut *panel };
    p.config.branch_energy = energy.clamp(0.0, 1.0);
    p.panel.set_config(p.config);
    debug!("opta_panel_set_energy: {:.2}", energy);
    OptaRenderResult::Success
}

/// Set the depth layer.
///
/// # Arguments
///
/// * `panel` - Pointer to the panel
/// * `depth` - Depth layer [0.0 = foreground, 1.0 = background]
///
/// # Safety
///
/// `panel` must be a valid pointer from `opta_panel_create`.
#[no_mangle]
pub unsafe extern "C" fn opta_panel_set_depth(
    panel: *mut OptaPanel,
    depth: f32,
) -> OptaRenderResult {
    if panel.is_null() {
        return OptaRenderResult::NullPointer;
    }

    let p = unsafe { &mut *panel };
    p.config.depth_layer = depth.clamp(0.0, 1.0);
    p.panel.set_config(p.config);
    debug!("opta_panel_set_depth: {:.2}", depth);
    OptaRenderResult::Success
}

/// Set the quality level.
///
/// # Arguments
///
/// * `panel` - Pointer to the panel
/// * `level` - Quality level (0=Low, 1=Medium, 2=High, 3=Ultra)
///
/// # Safety
///
/// `panel` must be a valid pointer from `opta_panel_create`.
#[no_mangle]
pub unsafe extern "C" fn opta_panel_set_quality(
    panel: *mut OptaPanel,
    level: u32,
) -> OptaRenderResult {
    if panel.is_null() {
        return OptaRenderResult::NullPointer;
    }

    if level > 3 {
        return OptaRenderResult::InvalidQualityLevel;
    }

    let p = unsafe { &mut *panel };
    let quality = PanelQualityLevel::from_u32(level);
    p.config.set_quality(quality);
    p.panel.set_quality(quality);
    debug!("opta_panel_set_quality: {:?}", quality);
    OptaRenderResult::Success
}

/// Update the panel animation.
///
/// # Arguments
///
/// * `panel` - Pointer to the panel
/// * `dt` - Time delta in seconds
///
/// # Safety
///
/// `panel` must be a valid pointer from `opta_panel_create`.
#[no_mangle]
pub unsafe extern "C" fn opta_panel_update(
    panel: *mut OptaPanel,
    dt: f32,
) -> OptaRenderResult {
    if panel.is_null() {
        return OptaRenderResult::NullPointer;
    }

    let p = unsafe { &mut *panel };
    p.time += dt;
    OptaRenderResult::Success
}

/// Render the panel to the current surface.
///
/// # Arguments
///
/// * `panel` - Pointer to the panel
/// * `ctx` - Pointer to the render context
///
/// # Safety
///
/// Both pointers must be valid. The render context must have a configured surface.
#[no_mangle]
pub unsafe extern "C" fn opta_panel_render(
    panel: *mut OptaPanel,
    ctx: *mut OptaRenderContext,
) -> OptaRenderResult {
    if panel.is_null() || ctx.is_null() {
        return OptaRenderResult::NullPointer;
    }

    let p = unsafe { &mut *panel };
    let context = unsafe { &*ctx };

    let Some(surface) = &context.surface else {
        warn!("opta_panel_render: No surface configured");
        return OptaRenderResult::NoSurface;
    };

    let Ok(frame) = surface.get_current_texture() else {
        error!("opta_panel_render: Failed to acquire surface texture");
        return OptaRenderResult::SurfaceCreationFailed;
    };

    let view = frame.texture.create_view(&wgpu::TextureViewDescriptor::default());

    let mut encoder = context.gpu.device.create_command_encoder(
        &wgpu::CommandEncoderDescriptor {
            label: Some("Panel Render Encoder"),
        },
    );

    p.panel.render(&context.gpu.device, &context.gpu.queue, &mut encoder, &view);

    context.gpu.queue.submit(std::iter::once(encoder.finish()));
    frame.present();

    OptaRenderResult::Success
}

// =============================================================================
// BranchMeter FFI Types
// =============================================================================

/// Configuration passed from Swift for branch meter creation.
#[repr(C)]
#[derive(Debug, Clone, Copy)]
pub struct OptaBranchMeterConfig {
    /// Position X in pixels.
    pub position_x: f32,
    /// Position Y in pixels.
    pub position_y: f32,
    /// Width in pixels.
    pub width: f32,
    /// Height in pixels.
    pub height: f32,
    /// Corner radius in pixels.
    pub corner_radius: f32,
    /// Initial fill level [0, 1].
    pub fill_level: f32,
    /// Initial branch energy [0, 1].
    pub energy: f32,
    /// Quality level (0-3).
    pub quality_level: u32,
    /// Viewport resolution width.
    pub resolution_width: f32,
    /// Viewport resolution height.
    pub resolution_height: f32,
}

impl Default for OptaBranchMeterConfig {
    fn default() -> Self {
        Self {
            position_x: 50.0,
            position_y: 50.0,
            width: 200.0,
            height: 24.0,
            corner_radius: 8.0,
            fill_level: 0.5,
            energy: 0.5,
            quality_level: 2,
            resolution_width: 800.0,
            resolution_height: 600.0,
        }
    }
}

/// Opaque handle to a BranchMeter for Swift.
pub struct OptaBranchMeter {
    /// The BranchMeter GPU component.
    meter: BranchMeter,
    /// Current uniforms state.
    uniforms: BranchMeterUniforms,
    /// Animation time accumulator.
    time: f32,
}

// =============================================================================
// BranchMeter FFI Functions
// =============================================================================

/// Create a new branch meter.
///
/// # Arguments
///
/// * `ctx` - Pointer to the render context
/// * `config` - Pointer to configuration (null for defaults)
///
/// # Returns
///
/// Pointer to the branch meter, or null on failure.
///
/// # Safety
///
/// - `ctx` must be a valid pointer from `opta_render_init`
/// - Caller must eventually call `opta_branch_meter_destroy`
#[no_mangle]
pub unsafe extern "C" fn opta_branch_meter_create(
    ctx: *mut OptaRenderContext,
    config: *const OptaBranchMeterConfig,
) -> *mut OptaBranchMeter {
    if ctx.is_null() {
        error!("opta_branch_meter_create: null context pointer");
        return std::ptr::null_mut();
    }

    let context = unsafe { &*ctx };
    let ffi_config = if config.is_null() {
        OptaBranchMeterConfig::default()
    } else {
        unsafe { *config }
    };

    // Get surface format
    let surface_format = if let Some(surface) = &context.surface {
        surface.format()
    } else {
        wgpu::TextureFormat::Bgra8UnormSrgb
    };

    let (res_w, res_h) = if let Some(surface) = &context.surface {
        let (w, h) = surface.size();
        (w, h)
    } else {
        (ffi_config.resolution_width as u32, ffi_config.resolution_height as u32)
    };

    let meter = BranchMeter::new(
        &context.gpu.device,
        surface_format,
        res_w,
        res_h,
    );

    let uniforms = BranchMeterUniforms {
        position: [ffi_config.position_x, ffi_config.position_y],
        size: [ffi_config.width, ffi_config.height],
        corner_radius: ffi_config.corner_radius,
        fill_level: ffi_config.fill_level,
        energy: ffi_config.energy,
        time: 0.0,
        resolution: [res_w as f32, res_h as f32],
        quality_level: ffi_config.quality_level,
        ..Default::default()
    };

    let opta_meter = Box::new(OptaBranchMeter {
        meter,
        uniforms,
        time: 0.0,
    });

    info!("opta_branch_meter_create: Created branch meter ({}x{})", ffi_config.width, ffi_config.height);
    Box::into_raw(opta_meter)
}

/// Destroy a branch meter and free resources.
///
/// # Safety
///
/// `meter` must be a valid pointer from `opta_branch_meter_create`.
#[no_mangle]
pub unsafe extern "C" fn opta_branch_meter_destroy(meter: *mut OptaBranchMeter) {
    if meter.is_null() {
        warn!("opta_branch_meter_destroy: null pointer");
        return;
    }

    info!("opta_branch_meter_destroy: Destroying branch meter");
    let _ = unsafe { Box::from_raw(meter) };
}

/// Set the fill level of the branch meter.
///
/// # Arguments
///
/// * `meter` - Pointer to the branch meter
/// * `fill_level` - Fill level [0.0, 1.0]
///
/// # Safety
///
/// `meter` must be a valid pointer from `opta_branch_meter_create`.
#[no_mangle]
pub unsafe extern "C" fn opta_branch_meter_set_fill(
    meter: *mut OptaBranchMeter,
    fill_level: f32,
) -> OptaRenderResult {
    if meter.is_null() {
        return OptaRenderResult::NullPointer;
    }

    let m = unsafe { &mut *meter };
    m.uniforms.fill_level = fill_level.clamp(0.0, 1.0);
    debug!("opta_branch_meter_set_fill: {:.2}", fill_level);
    OptaRenderResult::Success
}

/// Set the branch energy level of the meter.
///
/// # Arguments
///
/// * `meter` - Pointer to the branch meter
/// * `energy` - Energy level [0.0, 1.0]
///
/// # Safety
///
/// `meter` must be a valid pointer from `opta_branch_meter_create`.
#[no_mangle]
pub unsafe extern "C" fn opta_branch_meter_set_energy(
    meter: *mut OptaBranchMeter,
    energy: f32,
) -> OptaRenderResult {
    if meter.is_null() {
        return OptaRenderResult::NullPointer;
    }

    let m = unsafe { &mut *meter };
    m.uniforms.energy = energy.clamp(0.0, 1.0);
    debug!("opta_branch_meter_set_energy: {:.2}", energy);
    OptaRenderResult::Success
}

/// Update the branch meter animation.
///
/// # Arguments
///
/// * `meter` - Pointer to the branch meter
/// * `dt` - Time delta in seconds
///
/// # Safety
///
/// `meter` must be a valid pointer from `opta_branch_meter_create`.
#[no_mangle]
pub unsafe extern "C" fn opta_branch_meter_update(
    meter: *mut OptaBranchMeter,
    dt: f32,
) -> OptaRenderResult {
    if meter.is_null() {
        return OptaRenderResult::NullPointer;
    }

    let m = unsafe { &mut *meter };
    m.time += dt;
    m.uniforms.time = m.time;
    OptaRenderResult::Success
}

/// Render the branch meter to the current surface.
///
/// # Safety
///
/// Both pointers must be valid. The render context must have a configured surface.
#[no_mangle]
pub unsafe extern "C" fn opta_branch_meter_render(
    meter: *mut OptaBranchMeter,
    ctx: *mut OptaRenderContext,
) -> OptaRenderResult {
    if meter.is_null() || ctx.is_null() {
        return OptaRenderResult::NullPointer;
    }

    let m = unsafe { &mut *meter };
    let context = unsafe { &*ctx };

    let Some(surface) = &context.surface else {
        warn!("opta_branch_meter_render: No surface configured");
        return OptaRenderResult::NoSurface;
    };

    let Ok(frame) = surface.get_current_texture() else {
        error!("opta_branch_meter_render: Failed to acquire surface texture");
        return OptaRenderResult::SurfaceCreationFailed;
    };

    let view = frame.texture.create_view(&wgpu::TextureViewDescriptor::default());

    let mut encoder = context.gpu.device.create_command_encoder(
        &wgpu::CommandEncoderDescriptor {
            label: Some("Branch Meter Render Encoder"),
        },
    );

    m.meter.render(&context.gpu.queue, &mut encoder, &view, &m.uniforms);

    context.gpu.queue.submit(std::iter::once(encoder.finish()));
    frame.present();

    OptaRenderResult::Success
}

// =============================================================================
// BranchIndicator FFI Types
// =============================================================================

/// Configuration passed from Swift for branch indicator creation.
#[repr(C)]
#[derive(Debug, Clone, Copy)]
pub struct OptaBranchIndicatorConfig {
    /// Center X position in pixels.
    pub center_x: f32,
    /// Center Y position in pixels.
    pub center_y: f32,
    /// Inner core radius in pixels.
    pub inner_radius: f32,
    /// Outer branch reach in pixels.
    pub outer_radius: f32,
    /// Initial energy [0, 1].
    pub energy: f32,
    /// Number of radial branches.
    pub branch_count: u32,
    /// Quality level (0-3).
    pub quality_level: u32,
    /// Viewport resolution width.
    pub resolution_width: f32,
    /// Viewport resolution height.
    pub resolution_height: f32,
}

impl Default for OptaBranchIndicatorConfig {
    fn default() -> Self {
        Self {
            center_x: 100.0,
            center_y: 100.0,
            inner_radius: 6.0,
            outer_radius: 16.0,
            energy: 0.5,
            branch_count: 6,
            quality_level: 2,
            resolution_width: 800.0,
            resolution_height: 600.0,
        }
    }
}

/// Opaque handle to a BranchIndicator for Swift.
pub struct OptaBranchIndicator {
    /// The BranchIndicator GPU component.
    indicator: BranchIndicator,
    /// Current uniforms state.
    uniforms: BranchIndicatorUniforms,
    /// Animation time accumulator.
    time: f32,
}

// =============================================================================
// BranchIndicator FFI Functions
// =============================================================================

/// Create a new branch indicator.
///
/// # Arguments
///
/// * `ctx` - Pointer to the render context
/// * `config` - Pointer to configuration (null for defaults)
///
/// # Returns
///
/// Pointer to the branch indicator, or null on failure.
///
/// # Safety
///
/// - `ctx` must be a valid pointer from `opta_render_init`
/// - Caller must eventually call `opta_branch_indicator_destroy`
#[no_mangle]
pub unsafe extern "C" fn opta_branch_indicator_create(
    ctx: *mut OptaRenderContext,
    config: *const OptaBranchIndicatorConfig,
) -> *mut OptaBranchIndicator {
    if ctx.is_null() {
        error!("opta_branch_indicator_create: null context pointer");
        return std::ptr::null_mut();
    }

    let context = unsafe { &*ctx };
    let ffi_config = if config.is_null() {
        OptaBranchIndicatorConfig::default()
    } else {
        unsafe { *config }
    };

    let surface_format = if let Some(surface) = &context.surface {
        surface.format()
    } else {
        wgpu::TextureFormat::Bgra8UnormSrgb
    };

    let (res_w, res_h) = if let Some(surface) = &context.surface {
        let (w, h) = surface.size();
        (w, h)
    } else {
        (ffi_config.resolution_width as u32, ffi_config.resolution_height as u32)
    };

    let indicator = BranchIndicator::new(
        &context.gpu.device,
        surface_format,
        res_w,
        res_h,
    );

    let uniforms = BranchIndicatorUniforms {
        center: [ffi_config.center_x, ffi_config.center_y],
        inner_radius: ffi_config.inner_radius,
        outer_radius: ffi_config.outer_radius,
        energy: ffi_config.energy,
        time: 0.0,
        branch_count: ffi_config.branch_count as f32,
        quality_level: ffi_config.quality_level,
        resolution: [res_w as f32, res_h as f32],
        ..Default::default()
    };

    let opta_indicator = Box::new(OptaBranchIndicator {
        indicator,
        uniforms,
        time: 0.0,
    });

    info!("opta_branch_indicator_create: Created branch indicator at [{}, {}]",
        ffi_config.center_x, ffi_config.center_y);
    Box::into_raw(opta_indicator)
}

/// Destroy a branch indicator and free resources.
///
/// # Safety
///
/// `indicator` must be a valid pointer from `opta_branch_indicator_create`.
#[no_mangle]
pub unsafe extern "C" fn opta_branch_indicator_destroy(indicator: *mut OptaBranchIndicator) {
    if indicator.is_null() {
        warn!("opta_branch_indicator_destroy: null pointer");
        return;
    }

    info!("opta_branch_indicator_destroy: Destroying branch indicator");
    let _ = unsafe { Box::from_raw(indicator) };
}

/// Set the energy level of the branch indicator.
///
/// # Arguments
///
/// * `indicator` - Pointer to the branch indicator
/// * `energy` - Energy level [0.0, 1.0]
///
/// # Safety
///
/// `indicator` must be a valid pointer from `opta_branch_indicator_create`.
#[no_mangle]
pub unsafe extern "C" fn opta_branch_indicator_set_energy(
    indicator: *mut OptaBranchIndicator,
    energy: f32,
) -> OptaRenderResult {
    if indicator.is_null() {
        return OptaRenderResult::NullPointer;
    }

    let ind = unsafe { &mut *indicator };
    ind.uniforms.energy = energy.clamp(0.0, 1.0);
    debug!("opta_branch_indicator_set_energy: {:.2}", energy);
    OptaRenderResult::Success
}

/// Update the branch indicator animation.
///
/// # Arguments
///
/// * `indicator` - Pointer to the branch indicator
/// * `dt` - Time delta in seconds
///
/// # Safety
///
/// `indicator` must be a valid pointer from `opta_branch_indicator_create`.
#[no_mangle]
pub unsafe extern "C" fn opta_branch_indicator_update(
    indicator: *mut OptaBranchIndicator,
    dt: f32,
) -> OptaRenderResult {
    if indicator.is_null() {
        return OptaRenderResult::NullPointer;
    }

    let ind = unsafe { &mut *indicator };
    ind.time += dt;
    ind.uniforms.time = ind.time;
    OptaRenderResult::Success
}

/// Render the branch indicator to the current surface.
///
/// # Safety
///
/// Both pointers must be valid. The render context must have a configured surface.
#[no_mangle]
pub unsafe extern "C" fn opta_branch_indicator_render(
    indicator: *mut OptaBranchIndicator,
    ctx: *mut OptaRenderContext,
) -> OptaRenderResult {
    if indicator.is_null() || ctx.is_null() {
        return OptaRenderResult::NullPointer;
    }

    let ind = unsafe { &mut *indicator };
    let context = unsafe { &*ctx };

    let Some(surface) = &context.surface else {
        warn!("opta_branch_indicator_render: No surface configured");
        return OptaRenderResult::NoSurface;
    };

    let Ok(frame) = surface.get_current_texture() else {
        error!("opta_branch_indicator_render: Failed to acquire surface texture");
        return OptaRenderResult::SurfaceCreationFailed;
    };

    let view = frame.texture.create_view(&wgpu::TextureViewDescriptor::default());

    let mut encoder = context.gpu.device.create_command_encoder(
        &wgpu::CommandEncoderDescriptor {
            label: Some("Branch Indicator Render Encoder"),
        },
    );

    ind.indicator.render(&context.gpu.queue, &mut encoder, &view, &ind.uniforms);

    context.gpu.queue.submit(std::iter::once(encoder.finish()));
    frame.present();

    OptaRenderResult::Success
}

// =============================================================================
// BranchBorder FFI Types
// =============================================================================

/// Configuration passed from Swift for branch border creation.
#[repr(C)]
#[derive(Debug, Clone, Copy)]
pub struct OptaBranchBorderConfig {
    /// Position X in pixels.
    pub position_x: f32,
    /// Position Y in pixels.
    pub position_y: f32,
    /// Width in pixels.
    pub width: f32,
    /// Height in pixels.
    pub height: f32,
    /// Corner radius in pixels.
    pub corner_radius: f32,
    /// Border band thickness in pixels.
    pub border_width: f32,
    /// Initial energy [0, 1].
    pub energy: f32,
    /// Quality level (0-3).
    pub quality_level: u32,
    /// Viewport resolution width.
    pub resolution_width: f32,
    /// Viewport resolution height.
    pub resolution_height: f32,
}

impl Default for OptaBranchBorderConfig {
    fn default() -> Self {
        Self {
            position_x: 50.0,
            position_y: 50.0,
            width: 300.0,
            height: 200.0,
            corner_radius: 12.0,
            border_width: 3.0,
            energy: 0.5,
            quality_level: 2,
            resolution_width: 800.0,
            resolution_height: 600.0,
        }
    }
}

/// Opaque handle to a BranchBorder for Swift.
pub struct OptaBranchBorder {
    /// The BranchBorder GPU component.
    border: BranchBorder,
    /// Current uniforms state.
    uniforms: BranchBorderUniforms,
    /// Animation time accumulator.
    time: f32,
}

// =============================================================================
// BranchBorder FFI Functions
// =============================================================================

/// Create a new branch border.
///
/// # Arguments
///
/// * `ctx` - Pointer to the render context
/// * `config` - Pointer to configuration (null for defaults)
///
/// # Returns
///
/// Pointer to the branch border, or null on failure.
///
/// # Safety
///
/// - `ctx` must be a valid pointer from `opta_render_init`
/// - Caller must eventually call `opta_branch_border_destroy`
#[no_mangle]
pub unsafe extern "C" fn opta_branch_border_create(
    ctx: *mut OptaRenderContext,
    config: *const OptaBranchBorderConfig,
) -> *mut OptaBranchBorder {
    if ctx.is_null() {
        error!("opta_branch_border_create: null context pointer");
        return std::ptr::null_mut();
    }

    let context = unsafe { &*ctx };
    let ffi_config = if config.is_null() {
        OptaBranchBorderConfig::default()
    } else {
        unsafe { *config }
    };

    let surface_format = if let Some(surface) = &context.surface {
        surface.format()
    } else {
        wgpu::TextureFormat::Bgra8UnormSrgb
    };

    let (res_w, res_h) = if let Some(surface) = &context.surface {
        let (w, h) = surface.size();
        (w, h)
    } else {
        (ffi_config.resolution_width as u32, ffi_config.resolution_height as u32)
    };

    let border = BranchBorder::new(
        &context.gpu.device,
        surface_format,
        res_w,
        res_h,
    );

    let uniforms = BranchBorderUniforms {
        position: [ffi_config.position_x, ffi_config.position_y],
        size: [ffi_config.width, ffi_config.height],
        corner_radius: ffi_config.corner_radius,
        border_width: ffi_config.border_width,
        energy: ffi_config.energy,
        time: 0.0,
        quality_level: ffi_config.quality_level,
        resolution: [res_w as f32, res_h as f32],
        ..Default::default()
    };

    let opta_border = Box::new(OptaBranchBorder {
        border,
        uniforms,
        time: 0.0,
    });

    info!("opta_branch_border_create: Created branch border ({}x{})", ffi_config.width, ffi_config.height);
    Box::into_raw(opta_border)
}

/// Destroy a branch border and free resources.
///
/// # Safety
///
/// `border` must be a valid pointer from `opta_branch_border_create`.
#[no_mangle]
pub unsafe extern "C" fn opta_branch_border_destroy(border: *mut OptaBranchBorder) {
    if border.is_null() {
        warn!("opta_branch_border_destroy: null pointer");
        return;
    }

    info!("opta_branch_border_destroy: Destroying branch border");
    let _ = unsafe { Box::from_raw(border) };
}

/// Set the energy level of the branch border.
///
/// # Arguments
///
/// * `border` - Pointer to the branch border
/// * `energy` - Energy level [0.0, 1.0]
///
/// # Safety
///
/// `border` must be a valid pointer from `opta_branch_border_create`.
#[no_mangle]
pub unsafe extern "C" fn opta_branch_border_set_energy(
    border: *mut OptaBranchBorder,
    energy: f32,
) -> OptaRenderResult {
    if border.is_null() {
        return OptaRenderResult::NullPointer;
    }

    let b = unsafe { &mut *border };
    b.uniforms.energy = energy.clamp(0.0, 1.0);
    debug!("opta_branch_border_set_energy: {:.2}", energy);
    OptaRenderResult::Success
}

/// Update the branch border animation.
///
/// # Arguments
///
/// * `border` - Pointer to the branch border
/// * `dt` - Time delta in seconds
///
/// # Safety
///
/// `border` must be a valid pointer from `opta_branch_border_create`.
#[no_mangle]
pub unsafe extern "C" fn opta_branch_border_update(
    border: *mut OptaBranchBorder,
    dt: f32,
) -> OptaRenderResult {
    if border.is_null() {
        return OptaRenderResult::NullPointer;
    }

    let b = unsafe { &mut *border };
    b.time += dt;
    b.uniforms.time = b.time;
    OptaRenderResult::Success
}

/// Render the branch border to the current surface.
///
/// # Safety
///
/// Both pointers must be valid. The render context must have a configured surface.
#[no_mangle]
pub unsafe extern "C" fn opta_branch_border_render(
    border: *mut OptaBranchBorder,
    ctx: *mut OptaRenderContext,
) -> OptaRenderResult {
    if border.is_null() || ctx.is_null() {
        return OptaRenderResult::NullPointer;
    }

    let b = unsafe { &mut *border };
    let context = unsafe { &*ctx };

    let Some(surface) = &context.surface else {
        warn!("opta_branch_border_render: No surface configured");
        return OptaRenderResult::NoSurface;
    };

    let Ok(frame) = surface.get_current_texture() else {
        error!("opta_branch_border_render: Failed to acquire surface texture");
        return OptaRenderResult::SurfaceCreationFailed;
    };

    let view = frame.texture.create_view(&wgpu::TextureViewDescriptor::default());

    let mut encoder = context.gpu.device.create_command_encoder(
        &wgpu::CommandEncoderDescriptor {
            label: Some("Branch Border Render Encoder"),
        },
    );

    b.border.render(&context.gpu.queue, &mut encoder, &view, &b.uniforms);

    context.gpu.queue.submit(std::iter::once(encoder.finish()));
    frame.present();

    OptaRenderResult::Success
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use std::ptr;

    // =========================================================================
    // GlassPanel null-pointer tests
    // =========================================================================

    #[test]
    fn test_panel_null_pointer_handling() {
        unsafe {
            assert!(matches!(
                opta_panel_set_position(ptr::null_mut(), 0.0, 0.0),
                OptaRenderResult::NullPointer
            ));

            assert!(matches!(
                opta_panel_set_size(ptr::null_mut(), 100.0, 100.0),
                OptaRenderResult::NullPointer
            ));

            assert!(matches!(
                opta_panel_set_energy(ptr::null_mut(), 0.5),
                OptaRenderResult::NullPointer
            ));

            assert!(matches!(
                opta_panel_set_depth(ptr::null_mut(), 0.5),
                OptaRenderResult::NullPointer
            ));

            assert!(matches!(
                opta_panel_set_quality(ptr::null_mut(), 2),
                OptaRenderResult::NullPointer
            ));

            assert!(matches!(
                opta_panel_update(ptr::null_mut(), 0.016),
                OptaRenderResult::NullPointer
            ));

            assert!(matches!(
                opta_panel_render(ptr::null_mut(), ptr::null_mut()),
                OptaRenderResult::NullPointer
            ));
        }
    }

    #[test]
    fn test_panel_create_null_context() {
        unsafe {
            let panel = opta_panel_create(ptr::null_mut(), ptr::null());
            assert!(panel.is_null());
        }
    }

    #[test]
    fn test_panel_destroy_null() {
        unsafe {
            // Should not crash
            opta_panel_destroy(ptr::null_mut());
        }
    }

    #[test]
    fn test_panel_invalid_quality() {
        unsafe {
            // With null pointer, we get NullPointer before quality check
            assert!(matches!(
                opta_panel_set_quality(ptr::null_mut(), 99),
                OptaRenderResult::NullPointer
            ));
        }
    }

    // =========================================================================
    // BranchMeter null-pointer tests
    // =========================================================================

    #[test]
    fn test_branch_meter_null_pointer_handling() {
        unsafe {
            assert!(matches!(
                opta_branch_meter_set_fill(ptr::null_mut(), 0.5),
                OptaRenderResult::NullPointer
            ));

            assert!(matches!(
                opta_branch_meter_set_energy(ptr::null_mut(), 0.5),
                OptaRenderResult::NullPointer
            ));

            assert!(matches!(
                opta_branch_meter_update(ptr::null_mut(), 0.016),
                OptaRenderResult::NullPointer
            ));

            assert!(matches!(
                opta_branch_meter_render(ptr::null_mut(), ptr::null_mut()),
                OptaRenderResult::NullPointer
            ));
        }
    }

    #[test]
    fn test_branch_meter_create_null_context() {
        unsafe {
            let meter = opta_branch_meter_create(ptr::null_mut(), ptr::null());
            assert!(meter.is_null());
        }
    }

    #[test]
    fn test_branch_meter_destroy_null() {
        unsafe {
            opta_branch_meter_destroy(ptr::null_mut());
        }
    }

    // =========================================================================
    // BranchIndicator null-pointer tests
    // =========================================================================

    #[test]
    fn test_branch_indicator_null_pointer_handling() {
        unsafe {
            assert!(matches!(
                opta_branch_indicator_set_energy(ptr::null_mut(), 0.5),
                OptaRenderResult::NullPointer
            ));

            assert!(matches!(
                opta_branch_indicator_update(ptr::null_mut(), 0.016),
                OptaRenderResult::NullPointer
            ));

            assert!(matches!(
                opta_branch_indicator_render(ptr::null_mut(), ptr::null_mut()),
                OptaRenderResult::NullPointer
            ));
        }
    }

    #[test]
    fn test_branch_indicator_create_null_context() {
        unsafe {
            let indicator = opta_branch_indicator_create(ptr::null_mut(), ptr::null());
            assert!(indicator.is_null());
        }
    }

    #[test]
    fn test_branch_indicator_destroy_null() {
        unsafe {
            opta_branch_indicator_destroy(ptr::null_mut());
        }
    }

    // =========================================================================
    // BranchBorder null-pointer tests
    // =========================================================================

    #[test]
    fn test_branch_border_null_pointer_handling() {
        unsafe {
            assert!(matches!(
                opta_branch_border_set_energy(ptr::null_mut(), 0.5),
                OptaRenderResult::NullPointer
            ));

            assert!(matches!(
                opta_branch_border_update(ptr::null_mut(), 0.016),
                OptaRenderResult::NullPointer
            ));

            assert!(matches!(
                opta_branch_border_render(ptr::null_mut(), ptr::null_mut()),
                OptaRenderResult::NullPointer
            ));
        }
    }

    #[test]
    fn test_branch_border_create_null_context() {
        unsafe {
            let border = opta_branch_border_create(ptr::null_mut(), ptr::null());
            assert!(border.is_null());
        }
    }

    #[test]
    fn test_branch_border_destroy_null() {
        unsafe {
            opta_branch_border_destroy(ptr::null_mut());
        }
    }

    // =========================================================================
    // Config default value tests
    // =========================================================================

    #[test]
    fn test_panel_config_defaults() {
        let config = OptaPanelConfig::default();
        assert_eq!(config.corner_radius, 16.0);
        assert_eq!(config.quality_level, 2);
        assert_eq!(config.energy, 0.3);
    }

    #[test]
    fn test_branch_meter_config_defaults() {
        let config = OptaBranchMeterConfig::default();
        assert_eq!(config.corner_radius, 8.0);
        assert_eq!(config.fill_level, 0.5);
        assert_eq!(config.quality_level, 2);
    }

    #[test]
    fn test_branch_indicator_config_defaults() {
        let config = OptaBranchIndicatorConfig::default();
        assert_eq!(config.inner_radius, 6.0);
        assert_eq!(config.outer_radius, 16.0);
        assert_eq!(config.branch_count, 6);
    }

    #[test]
    fn test_branch_border_config_defaults() {
        let config = OptaBranchBorderConfig::default();
        assert_eq!(config.corner_radius, 12.0);
        assert_eq!(config.border_width, 3.0);
        assert_eq!(config.quality_level, 2);
    }
}
