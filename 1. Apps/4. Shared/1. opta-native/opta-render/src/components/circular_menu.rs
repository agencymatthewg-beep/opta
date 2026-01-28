//! Circular (radial) menu component for Opta.
//!
//! Provides a GPU-rendered radial menu with obsidian material and branch-energy
//! sector highlights. Designed for premium UI experiences with smooth interactions.
//!
//! # Features
//!
//! - Radial sector rendering using SDF
//! - Obsidian material base (deep black volcanic glass aesthetic)
//! - Branch energy highlights that grow from inner radius outward
//! - Spring-physics animations for open/close and highlight transitions
//! - Configurable sector count and colors
//! - Theme-aware styling with color temperature support
//!
//! # Example
//!
//! ```ignore
//! use opta_render::components::{CircularMenu, CircularMenuConfig};
//!
//! let config = CircularMenuConfig::default();
//! let mut menu = CircularMenu::new(&device, surface_format, width, height);
//! menu.set_sectors(vec![
//!     CircularMenuSector::new("settings", "gear", "Settings"),
//!     CircularMenuSector::new("optimize", "bolt", "Optimize"),
//!     CircularMenuSector::new("games", "gamepad", "Games"),
//! ]);
//! menu.open();
//! ```

#![allow(clippy::cast_precision_loss)]

use std::f32::consts::{PI, TAU};

use wgpu::util::DeviceExt;

use crate::animation::{Spring, SpringConfig};
use crate::components::glass_panel::PanelQualityLevel;

// =============================================================================
// Configuration Types
// =============================================================================

/// Configuration for the circular menu.
#[derive(Debug, Clone)]
pub struct CircularMenuConfig {
    /// Center position in pixels.
    pub position: [f32; 2],
    /// Outer radius in pixels.
    pub radius: f32,
    /// Inner radius in pixels (creates ring thickness).
    pub inner_radius: f32,
    /// Number of sectors (can be overridden by sector count).
    pub sector_count: u32,
    /// Quality level for visual effects.
    pub quality_level: PanelQualityLevel,
    /// Branch energy color (RGB) for highlighted sector.
    pub branch_energy_color: [f32; 3],
    /// Branch energy intensity (0.0 - 2.0+).
    pub branch_energy_intensity: f32,
    /// Base menu color (RGB) — obsidian default.
    pub base_color: [f32; 3],
    /// Border/divider opacity (0.0 - 1.0).
    pub border_opacity: f32,
    /// Rotation offset in radians.
    pub rotation_offset: f32,
}

impl Default for CircularMenuConfig {
    fn default() -> Self {
        Self {
            position: [0.0, 0.0],
            radius: 150.0,
            inner_radius: 50.0,
            sector_count: 4,
            quality_level: PanelQualityLevel::Medium,
            branch_energy_color: [0.545, 0.361, 0.965], // Electric Violet
            branch_energy_intensity: 1.5,
            base_color: [0.02, 0.02, 0.03], // Obsidian
            border_opacity: 0.6,
            rotation_offset: -PI / 2.0, // Start from top
        }
    }
}

impl CircularMenuConfig {
    /// Create a configuration with the specified quality level.
    #[must_use]
    pub fn with_quality(quality: PanelQualityLevel) -> Self {
        Self {
            quality_level: quality,
            ..Self::default()
        }
    }

    /// Create a configuration for a specific number of sectors.
    #[must_use]
    pub fn with_sectors(count: u32) -> Self {
        Self {
            sector_count: count,
            ..Self::default()
        }
    }

    /// Set the center position.
    pub fn set_position(&mut self, x: f32, y: f32) {
        self.position = [x, y];
    }

    /// Set the branch energy color from RGB values.
    pub fn set_branch_energy_color(&mut self, r: f32, g: f32, b: f32) {
        self.branch_energy_color = [r, g, b];
    }
}

/// Represents a single sector in the circular menu.
#[derive(Debug, Clone)]
pub struct CircularMenuSector {
    /// Unique identifier for the sector.
    pub id: String,
    /// SF Symbol name or icon identifier.
    pub icon: String,
    /// Human-readable label.
    pub label: String,
    /// Accent color for this sector (RGB).
    pub color: [f32; 3],
    /// Whether this sector is enabled.
    pub enabled: bool,
}

impl CircularMenuSector {
    /// Create a new sector with default color.
    #[must_use]
    pub fn new(id: impl Into<String>, icon: impl Into<String>, label: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            icon: icon.into(),
            label: label.into(),
            color: [0.545, 0.361, 0.965], // Electric Violet
            enabled: true,
        }
    }

    /// Create a new sector with a custom color.
    #[must_use]
    pub fn with_color(
        id: impl Into<String>,
        icon: impl Into<String>,
        label: impl Into<String>,
        color: [f32; 3],
    ) -> Self {
        Self {
            id: id.into(),
            icon: icon.into(),
            label: label.into(),
            color,
            enabled: true,
        }
    }

    /// Set whether this sector is enabled.
    pub fn set_enabled(&mut self, enabled: bool) {
        self.enabled = enabled;
    }
}

// =============================================================================
// Uniform Buffer
// =============================================================================

/// Uniform buffer data for the circular menu shader.
///
/// Matches the `CircularMenuUniforms` struct in `circular_menu.wgsl`.
/// Total size: 96 bytes (6 * 16-byte aligned groups).
#[repr(C)]
#[derive(Copy, Clone, Debug, bytemuck::Pod, bytemuck::Zeroable)]
pub struct CircularMenuUniforms {
    // Menu geometry (16 bytes)
    /// Menu center position in pixels.
    pub center: [f32; 2],
    /// Outer radius.
    pub radius: f32,
    /// Inner radius.
    pub inner_radius: f32,

    // Sector configuration (16 bytes)
    /// Number of sectors.
    pub sector_count: u32,
    /// Currently highlighted sector (-1 = none).
    pub highlighted_sector: i32,
    /// Rotation offset in radians.
    pub rotation_offset: f32,
    /// Padding.
    pub _pad0: f32,

    // Animation state (16 bytes)
    /// Open/close animation progress (0.0-1.0).
    pub open_progress: f32,
    /// Highlight animation progress (0.0-1.0).
    pub highlight_progress: f32,
    /// Animation time.
    pub time: f32,
    /// Padding.
    pub _pad1: f32,

    // Branch energy styling (16 bytes)
    /// Branch energy color (RGB).
    pub branch_energy_color: [f32; 3],
    /// Branch energy intensity.
    pub branch_energy_intensity: f32,

    // Theme colors (16 bytes)
    /// Base menu color (RGB).
    pub base_color: [f32; 3],
    /// Border opacity.
    pub border_opacity: f32,

    // Display (16 bytes)
    /// Render resolution.
    pub resolution: [f32; 2],
    /// Padding.
    pub _pad2: [f32; 2],
}

impl CircularMenuUniforms {
    /// Create uniforms from configuration.
    pub fn from_config(
        config: &CircularMenuConfig,
        highlighted_sector: i32,
        open_progress: f32,
        highlight_progress: f32,
        width: u32,
        height: u32,
        time: f32,
    ) -> Self {
        Self {
            center: config.position,
            radius: config.radius,
            inner_radius: config.inner_radius,
            sector_count: config.sector_count,
            highlighted_sector,
            rotation_offset: config.rotation_offset,
            _pad0: 0.0,
            open_progress,
            highlight_progress,
            time,
            _pad1: 0.0,
            branch_energy_color: config.branch_energy_color,
            branch_energy_intensity: config.branch_energy_intensity,
            base_color: config.base_color,
            border_opacity: config.border_opacity,
            resolution: [width as f32, height as f32],
            _pad2: [0.0; 2],
        }
    }
}

// =============================================================================
// Vertex Type
// =============================================================================

/// Simple vertex for menu rendering (position and UV only).
#[repr(C)]
#[derive(Copy, Clone, Debug, bytemuck::Pod, bytemuck::Zeroable)]
pub struct MenuVertex {
    /// Position in 2D space (x, y).
    pub position: [f32; 2],
    /// Texture coordinates (u, v).
    pub uv: [f32; 2],
}

impl MenuVertex {
    /// Creates a new menu vertex.
    pub const fn new(position: [f32; 2], uv: [f32; 2]) -> Self {
        Self { position, uv }
    }

    /// Returns the vertex buffer layout descriptor.
    pub const fn desc() -> wgpu::VertexBufferLayout<'static> {
        const ATTRIBUTES: [wgpu::VertexAttribute; 2] = [
            wgpu::VertexAttribute {
                offset: 0,
                shader_location: 0,
                format: wgpu::VertexFormat::Float32x2,
            },
            wgpu::VertexAttribute {
                offset: std::mem::size_of::<[f32; 2]>() as wgpu::BufferAddress,
                shader_location: 1,
                format: wgpu::VertexFormat::Float32x2,
            },
        ];

        wgpu::VertexBufferLayout {
            array_stride: std::mem::size_of::<MenuVertex>() as wgpu::BufferAddress,
            step_mode: wgpu::VertexStepMode::Vertex,
            attributes: &ATTRIBUTES,
        }
    }
}

// =============================================================================
// Geometry Calculations
// =============================================================================

/// Calculate the angle range for a specific sector.
///
/// Returns (start_angle, end_angle) in radians, counter-clockwise from positive X.
#[must_use]
pub fn calculate_sector_angles(
    sector_index: u32,
    sector_count: u32,
    rotation_offset: f32,
) -> (f32, f32) {
    let sector_angle = TAU / sector_count as f32;
    let start_angle = sector_index as f32 * sector_angle + rotation_offset;
    let end_angle = start_angle + sector_angle;
    (start_angle, end_angle)
}

/// Calculate all sector angle boundaries.
///
/// Returns a vector of (start_angle, end_angle) tuples for each sector.
#[must_use]
pub fn calculate_all_sector_angles(sector_count: u32, rotation_offset: f32) -> Vec<(f32, f32)> {
    (0..sector_count)
        .map(|i| calculate_sector_angles(i, sector_count, rotation_offset))
        .collect()
}

/// Determine which sector a point is in.
///
/// Returns the sector index (0-based) or -1 if the point is outside the menu ring.
///
/// # Arguments
///
/// * `point` - The point to test (x, y)
/// * `center` - Menu center position
/// * `inner_radius` - Inner radius of the ring
/// * `outer_radius` - Outer radius of the ring
/// * `sector_count` - Number of sectors
/// * `rotation_offset` - Rotation offset in radians
#[must_use]
pub fn point_to_sector(
    point: [f32; 2],
    center: [f32; 2],
    inner_radius: f32,
    outer_radius: f32,
    sector_count: u32,
    rotation_offset: f32,
) -> i32 {
    let dx = point[0] - center[0];
    let dy = point[1] - center[1];
    let distance = (dx * dx + dy * dy).sqrt();

    // Check if within ring
    if distance < inner_radius || distance > outer_radius {
        return -1;
    }

    // Calculate angle
    let mut angle = dy.atan2(dx) - rotation_offset;

    // Normalize to [0, TAU)
    while angle < 0.0 {
        angle += TAU;
    }
    while angle >= TAU {
        angle -= TAU;
    }

    // Determine sector
    let sector_angle = TAU / sector_count as f32;
    let sector = (angle / sector_angle).floor() as i32;

    sector % sector_count as i32
}

/// Check if a point is within the menu ring.
#[must_use]
pub fn is_point_in_menu(
    point: [f32; 2],
    center: [f32; 2],
    inner_radius: f32,
    outer_radius: f32,
) -> bool {
    let dx = point[0] - center[0];
    let dy = point[1] - center[1];
    let distance_sq = dx * dx + dy * dy;

    distance_sq >= inner_radius * inner_radius && distance_sq <= outer_radius * outer_radius
}

/// Calculate the center position of a sector arc.
///
/// Returns the (x, y) position at the center of the sector, useful for icon positioning.
#[must_use]
pub fn sector_center_position(
    sector_index: u32,
    sector_count: u32,
    center: [f32; 2],
    inner_radius: f32,
    outer_radius: f32,
    rotation_offset: f32,
) -> [f32; 2] {
    let (start_angle, end_angle) = calculate_sector_angles(sector_index, sector_count, rotation_offset);
    let mid_angle = (start_angle + end_angle) / 2.0;
    let mid_radius = (inner_radius + outer_radius) / 2.0;

    [
        center[0] + mid_radius * mid_angle.cos(),
        center[1] + mid_radius * mid_angle.sin(),
    ]
}

/// Calculate sector center positions for all sectors.
#[must_use]
pub fn all_sector_center_positions(
    sector_count: u32,
    center: [f32; 2],
    inner_radius: f32,
    outer_radius: f32,
    rotation_offset: f32,
) -> Vec<[f32; 2]> {
    (0..sector_count)
        .map(|i| sector_center_position(i, sector_count, center, inner_radius, outer_radius, rotation_offset))
        .collect()
}

// =============================================================================
// Animated Circular Menu
// =============================================================================

/// Animated wrapper for CircularMenu with spring physics.
///
/// Provides smooth animations for:
/// - Open/close transitions
/// - Highlight sector changes
/// - Optional rotation animation
#[derive(Debug)]
pub struct AnimatedCircularMenu {
    /// Open progress spring (0.0 = closed, 1.0 = open).
    open_spring: Spring,
    /// Highlight intensity spring (0.0 = none, 1.0 = full).
    highlight_spring: Spring,
    /// Current highlighted sector (-1 = none).
    highlighted_sector: i32,
    /// Previous highlighted sector for smooth transitions.
    previous_highlighted_sector: i32,
    /// Whether the menu is animating.
    animating: bool,
}

impl Default for AnimatedCircularMenu {
    fn default() -> Self {
        Self::new()
    }
}

impl AnimatedCircularMenu {
    /// Create a new animated menu wrapper.
    #[must_use]
    pub fn new() -> Self {
        Self {
            open_spring: Spring::new(0.0, SpringConfig::RESPONSIVE),
            highlight_spring: Spring::new(0.0, SpringConfig::STIFF),
            highlighted_sector: -1,
            previous_highlighted_sector: -1,
            animating: false,
        }
    }

    /// Create with custom spring configurations.
    #[must_use]
    pub fn with_springs(open_config: SpringConfig, highlight_config: SpringConfig) -> Self {
        Self {
            open_spring: Spring::new(0.0, open_config),
            highlight_spring: Spring::new(0.0, highlight_config),
            highlighted_sector: -1,
            previous_highlighted_sector: -1,
            animating: false,
        }
    }

    /// Open the menu with animation.
    pub fn open(&mut self) {
        self.open_spring.set_target(1.0);
        self.animating = true;
    }

    /// Close the menu with animation.
    pub fn close(&mut self) {
        self.open_spring.set_target(0.0);
        self.animating = true;
    }

    /// Toggle the menu open/closed state.
    pub fn toggle(&mut self) {
        if self.open_spring.target() > 0.5 {
            self.close();
        } else {
            self.open();
        }
    }

    /// Check if the menu is open (or opening).
    #[must_use]
    pub fn is_open(&self) -> bool {
        self.open_spring.target() > 0.5
    }

    /// Get the current open progress (0.0-1.0).
    #[must_use]
    pub fn open_progress(&self) -> f32 {
        self.open_spring.value()
    }

    /// Set the highlighted sector with animation.
    pub fn set_highlighted_sector(&mut self, sector: i32) {
        if sector != self.highlighted_sector {
            self.previous_highlighted_sector = self.highlighted_sector;
            self.highlighted_sector = sector;

            if sector >= 0 {
                self.highlight_spring.set_target(1.0);
            } else {
                self.highlight_spring.set_target(0.0);
            }
            self.animating = true;
        }
    }

    /// Get the currently highlighted sector.
    #[must_use]
    pub fn highlighted_sector(&self) -> i32 {
        self.highlighted_sector
    }

    /// Get the highlight animation progress (0.0-1.0).
    #[must_use]
    pub fn highlight_progress(&self) -> f32 {
        self.highlight_spring.value()
    }

    /// Update the animation state.
    ///
    /// # Arguments
    ///
    /// * `dt` - Time delta in seconds
    pub fn update(&mut self, dt: f32) {
        if !self.animating {
            return;
        }

        self.open_spring.update(dt);
        self.highlight_spring.update(dt);

        // Check if all animations are at rest
        if self.open_spring.is_at_rest() && self.highlight_spring.is_at_rest() {
            self.animating = false;
        }
    }

    /// Check if any animation is currently active.
    #[must_use]
    pub fn is_animating(&self) -> bool {
        self.animating
    }

    /// Immediately set the open state without animation.
    pub fn set_open_immediate(&mut self, open: bool) {
        let value = if open { 1.0 } else { 0.0 };
        self.open_spring.set_immediate(value);
        self.animating = false;
    }
}

// =============================================================================
// Circular Menu Component
// =============================================================================

/// GPU-rendered circular menu component.
pub struct CircularMenu {
    // Geometry
    vertex_buffer: wgpu::Buffer,
    index_buffer: wgpu::Buffer,
    index_count: u32,

    // Pipeline
    pipeline: wgpu::RenderPipeline,
    bind_group_layout: wgpu::BindGroupLayout,

    // Uniforms
    uniform_buffer: wgpu::Buffer,

    // Configuration
    config: CircularMenuConfig,
    sectors: Vec<CircularMenuSector>,
    width: u32,
    height: u32,

    // Animation state
    animation: AnimatedCircularMenu,
    time: f32,
}

impl CircularMenu {
    /// Embedded shader source.
    const SHADER: &'static str = include_str!("../../shaders/circular_menu.wgsl");

    /// Create a new circular menu.
    ///
    /// # Arguments
    ///
    /// * `device` - The wgpu device
    /// * `surface_format` - The texture format for rendering
    /// * `width` - Render target width
    /// * `height` - Render target height
    pub fn new(
        device: &wgpu::Device,
        surface_format: wgpu::TextureFormat,
        width: u32,
        height: u32,
    ) -> Self {
        let config = CircularMenuConfig::default();

        // Create fullscreen quad vertices
        let vertices = [
            MenuVertex::new([-1.0, -1.0], [0.0, 1.0]),
            MenuVertex::new([1.0, -1.0], [1.0, 1.0]),
            MenuVertex::new([1.0, 1.0], [1.0, 0.0]),
            MenuVertex::new([-1.0, 1.0], [0.0, 0.0]),
        ];

        let indices: [u16; 6] = [0, 1, 2, 2, 3, 0];

        let vertex_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Circular Menu Vertex Buffer"),
            contents: bytemuck::cast_slice(&vertices),
            usage: wgpu::BufferUsages::VERTEX,
        });

        let index_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Circular Menu Index Buffer"),
            contents: bytemuck::cast_slice(&indices),
            usage: wgpu::BufferUsages::INDEX,
        });

        // Create uniform buffer
        let uniforms = CircularMenuUniforms::from_config(&config, -1, 0.0, 0.0, width, height, 0.0);
        let uniform_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Circular Menu Uniforms"),
            contents: bytemuck::cast_slice(&[uniforms]),
            usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
        });

        // Create bind group layout
        let bind_group_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("Circular Menu Bind Group Layout"),
            entries: &[wgpu::BindGroupLayoutEntry {
                binding: 0,
                visibility: wgpu::ShaderStages::VERTEX | wgpu::ShaderStages::FRAGMENT,
                ty: wgpu::BindingType::Buffer {
                    ty: wgpu::BufferBindingType::Uniform,
                    has_dynamic_offset: false,
                    min_binding_size: None,
                },
                count: None,
            }],
        });

        // Create shader module
        let shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("Circular Menu Shader"),
            source: wgpu::ShaderSource::Wgsl(Self::SHADER.into()),
        });

        // Create pipeline
        let pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("Circular Menu Pipeline Layout"),
            bind_group_layouts: &[&bind_group_layout],
            push_constant_ranges: &[],
        });

        let pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("Circular Menu Pipeline"),
            layout: Some(&pipeline_layout),
            vertex: wgpu::VertexState {
                module: &shader,
                entry_point: Some("vs_main"),
                buffers: &[MenuVertex::desc()],
                compilation_options: wgpu::PipelineCompilationOptions::default(),
            },
            fragment: Some(wgpu::FragmentState {
                module: &shader,
                entry_point: Some("fs_main"),
                targets: &[Some(wgpu::ColorTargetState {
                    format: surface_format,
                    blend: Some(wgpu::BlendState::ALPHA_BLENDING),
                    write_mask: wgpu::ColorWrites::ALL,
                })],
                compilation_options: wgpu::PipelineCompilationOptions::default(),
            }),
            primitive: wgpu::PrimitiveState {
                topology: wgpu::PrimitiveTopology::TriangleList,
                strip_index_format: None,
                front_face: wgpu::FrontFace::Ccw,
                cull_mode: Some(wgpu::Face::Back),
                unclipped_depth: false,
                polygon_mode: wgpu::PolygonMode::Fill,
                conservative: false,
            },
            depth_stencil: None,
            multisample: wgpu::MultisampleState::default(),
            multiview: None,
            cache: None,
        });

        Self {
            vertex_buffer,
            index_buffer,
            index_count: indices.len() as u32,
            pipeline,
            bind_group_layout,
            uniform_buffer,
            config,
            sectors: Vec::new(),
            width,
            height,
            animation: AnimatedCircularMenu::new(),
            time: 0.0,
        }
    }

    /// Set the menu configuration.
    pub fn set_config(&mut self, config: CircularMenuConfig) {
        self.config = config;
    }

    /// Get the current configuration.
    pub fn config(&self) -> &CircularMenuConfig {
        &self.config
    }

    /// Get the current configuration mutably.
    pub fn config_mut(&mut self) -> &mut CircularMenuConfig {
        &mut self.config
    }

    /// Set the sectors for the menu.
    pub fn set_sectors(&mut self, sectors: Vec<CircularMenuSector>) {
        self.config.sector_count = sectors.len() as u32;
        self.sectors = sectors;
    }

    /// Get the sectors.
    pub fn sectors(&self) -> &[CircularMenuSector] {
        &self.sectors
    }

    /// Get the animation state.
    pub fn animation(&self) -> &AnimatedCircularMenu {
        &self.animation
    }

    /// Get the animation state mutably.
    pub fn animation_mut(&mut self) -> &mut AnimatedCircularMenu {
        &mut self.animation
    }

    /// Open the menu.
    pub fn open(&mut self) {
        self.animation.open();
    }

    /// Close the menu.
    pub fn close(&mut self) {
        self.animation.close();
    }

    /// Toggle the menu.
    pub fn toggle(&mut self) {
        self.animation.toggle();
    }

    /// Check if the menu is open.
    #[must_use]
    pub fn is_open(&self) -> bool {
        self.animation.is_open()
    }

    /// Set the highlighted sector.
    pub fn set_highlighted_sector(&mut self, sector: i32) {
        self.animation.set_highlighted_sector(sector);
    }

    /// Get the highlighted sector.
    #[must_use]
    pub fn highlighted_sector(&self) -> i32 {
        self.animation.highlighted_sector()
    }

    /// Update the menu (call each frame).
    ///
    /// # Arguments
    ///
    /// * `dt` - Time delta in seconds
    pub fn update(&mut self, dt: f32) {
        self.time += dt;
        self.animation.update(dt);
    }

    /// Perform hit testing for a point.
    ///
    /// Returns the sector index or -1 if outside the menu.
    #[must_use]
    pub fn point_to_sector(&self, point: [f32; 2]) -> i32 {
        // Scale radii by open progress
        let open_progress = self.animation.open_progress();
        let radius = self.config.radius * open_progress;
        let inner_radius = self.config.inner_radius * open_progress;

        point_to_sector(
            point,
            self.config.position,
            inner_radius,
            radius,
            self.config.sector_count,
            self.config.rotation_offset,
        )
    }

    /// Get the center position of a sector.
    #[must_use]
    pub fn sector_center(&self, sector_index: u32) -> [f32; 2] {
        let open_progress = self.animation.open_progress();
        sector_center_position(
            sector_index,
            self.config.sector_count,
            self.config.position,
            self.config.inner_radius * open_progress,
            self.config.radius * open_progress,
            self.config.rotation_offset,
        )
    }

    /// Resize the menu render target.
    pub fn resize(&mut self, width: u32, height: u32) {
        self.width = width;
        self.height = height;
    }

    /// Render the circular menu.
    pub fn render(
        &self,
        device: &wgpu::Device,
        queue: &wgpu::Queue,
        encoder: &mut wgpu::CommandEncoder,
        output_view: &wgpu::TextureView,
    ) {
        // Skip rendering if menu is fully closed
        if self.animation.open_progress() < 0.001 {
            return;
        }

        // Update uniforms
        let uniforms = CircularMenuUniforms::from_config(
            &self.config,
            self.animation.highlighted_sector(),
            self.animation.open_progress(),
            self.animation.highlight_progress(),
            self.width,
            self.height,
            self.time,
        );
        queue.write_buffer(&self.uniform_buffer, 0, bytemuck::cast_slice(&[uniforms]));

        // Create bind group
        let bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("Circular Menu Bind Group"),
            layout: &self.bind_group_layout,
            entries: &[wgpu::BindGroupEntry {
                binding: 0,
                resource: self.uniform_buffer.as_entire_binding(),
            }],
        });

        // Render pass
        {
            let mut pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("Circular Menu Render Pass"),
                color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                    view: output_view,
                    resolve_target: None,
                    ops: wgpu::Operations {
                        load: wgpu::LoadOp::Load,
                        store: wgpu::StoreOp::Store,
                    },
                })],
                depth_stencil_attachment: None,
                timestamp_writes: None,
                occlusion_query_set: None,
            });

            pass.set_pipeline(&self.pipeline);
            pass.set_bind_group(0, &bind_group, &[]);
            pass.set_vertex_buffer(0, self.vertex_buffer.slice(..));
            pass.set_index_buffer(self.index_buffer.slice(..), wgpu::IndexFormat::Uint16);
            pass.draw_indexed(0..self.index_count, 0, 0..1);
        }
    }

    /// Get the render dimensions.
    pub fn dimensions(&self) -> (u32, u32) {
        (self.width, self.height)
    }
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    // ==========================================================================
    // Configuration Tests
    // ==========================================================================

    #[test]
    fn test_config_default() {
        let config = CircularMenuConfig::default();
        assert!((config.radius - 150.0).abs() < f32::EPSILON);
        assert!((config.inner_radius - 50.0).abs() < f32::EPSILON);
        assert_eq!(config.sector_count, 4);
        assert_eq!(config.quality_level, PanelQualityLevel::Medium);
    }

    #[test]
    fn test_config_with_sectors() {
        let config = CircularMenuConfig::with_sectors(6);
        assert_eq!(config.sector_count, 6);
    }

    #[test]
    fn test_config_with_quality() {
        let config = CircularMenuConfig::with_quality(PanelQualityLevel::High);
        assert_eq!(config.quality_level, PanelQualityLevel::High);
    }

    // ==========================================================================
    // Sector Tests
    // ==========================================================================

    #[test]
    fn test_sector_new() {
        let sector = CircularMenuSector::new("test", "icon", "Test Label");
        assert_eq!(sector.id, "test");
        assert_eq!(sector.icon, "icon");
        assert_eq!(sector.label, "Test Label");
        assert!(sector.enabled);
    }

    #[test]
    fn test_sector_with_color() {
        let sector = CircularMenuSector::with_color("test", "icon", "Label", [1.0, 0.0, 0.0]);
        assert!((sector.color[0] - 1.0).abs() < f32::EPSILON);
        assert!((sector.color[1] - 0.0).abs() < f32::EPSILON);
        assert!((sector.color[2] - 0.0).abs() < f32::EPSILON);
    }

    // ==========================================================================
    // Geometry Calculation Tests
    // ==========================================================================

    #[test]
    fn test_sector_angle_calculation() {
        let (start, end) = calculate_sector_angles(0, 4, 0.0);
        assert!((start - 0.0).abs() < 0.001);
        assert!((end - PI / 2.0).abs() < 0.001);

        let (start, end) = calculate_sector_angles(1, 4, 0.0);
        assert!((start - PI / 2.0).abs() < 0.001);
        assert!((end - PI).abs() < 0.001);
    }

    #[test]
    fn test_sector_angles_with_rotation() {
        let rotation = PI / 4.0;
        let (start, _end) = calculate_sector_angles(0, 4, rotation);
        assert!((start - rotation).abs() < 0.001);
    }

    #[test]
    fn test_point_to_sector_inside() {
        let center = [0.0, 0.0];
        let inner_radius = 50.0;
        let outer_radius = 150.0;
        let sector_count = 4;
        let rotation = 0.0;

        // With 4 sectors and rotation 0:
        // Sector 0: 0 to PI/2 (right-top quadrant)
        // Sector 1: PI/2 to PI (top-left quadrant)
        // Sector 2: PI to 3*PI/2 (left-bottom quadrant)
        // Sector 3: 3*PI/2 to 2*PI (bottom-right quadrant)

        // Point in sector 0 (right side, angle ~0)
        let point = [100.0, 10.0]; // Slightly above positive X axis
        let sector = point_to_sector(point, center, inner_radius, outer_radius, sector_count, rotation);
        assert_eq!(sector, 0);

        // Point in sector 1 (top-left, angle ~3*PI/4)
        let point = [-70.0, 70.0];
        let sector = point_to_sector(point, center, inner_radius, outer_radius, sector_count, rotation);
        assert_eq!(sector, 1);

        // Point in sector 2 (left-bottom, angle ~5*PI/4)
        let point = [-70.0, -70.0];
        let sector = point_to_sector(point, center, inner_radius, outer_radius, sector_count, rotation);
        assert_eq!(sector, 2);

        // Point in sector 3 (bottom-right, angle ~7*PI/4)
        let point = [70.0, -70.0];
        let sector = point_to_sector(point, center, inner_radius, outer_radius, sector_count, rotation);
        assert_eq!(sector, 3);
    }

    #[test]
    fn test_point_outside_menu() {
        let center = [0.0, 0.0];
        let inner_radius = 50.0;
        let outer_radius = 150.0;
        let sector_count = 4;
        let rotation = 0.0;

        // Point too close to center
        let point = [25.0, 0.0];
        let sector = point_to_sector(point, center, inner_radius, outer_radius, sector_count, rotation);
        assert_eq!(sector, -1);

        // Point too far from center
        let point = [200.0, 0.0];
        let sector = point_to_sector(point, center, inner_radius, outer_radius, sector_count, rotation);
        assert_eq!(sector, -1);
    }

    #[test]
    fn test_is_point_in_menu() {
        let center = [0.0, 0.0];
        let inner_radius = 50.0;
        let outer_radius = 150.0;

        assert!(is_point_in_menu([100.0, 0.0], center, inner_radius, outer_radius));
        assert!(!is_point_in_menu([25.0, 0.0], center, inner_radius, outer_radius));
        assert!(!is_point_in_menu([200.0, 0.0], center, inner_radius, outer_radius));
    }

    #[test]
    fn test_sector_center_position() {
        let center = [0.0, 0.0];
        let inner_radius = 50.0;
        let outer_radius = 150.0;
        let rotation = 0.0;

        // Sector 0 center should be to the right
        let pos = sector_center_position(0, 4, center, inner_radius, outer_radius, rotation);
        let mid_radius = (inner_radius + outer_radius) / 2.0;
        let expected_angle = PI / 4.0; // Middle of first sector
        assert!((pos[0] - mid_radius * expected_angle.cos()).abs() < 1.0);
        assert!((pos[1] - mid_radius * expected_angle.sin()).abs() < 1.0);
    }

    // ==========================================================================
    // Uniform Tests
    // ==========================================================================

    #[test]
    fn test_menu_uniforms_size() {
        // Should be 96 bytes (6 * 16 bytes for proper alignment)
        assert_eq!(std::mem::size_of::<CircularMenuUniforms>(), 96);
    }

    #[test]
    fn test_uniforms_from_config() {
        let config = CircularMenuConfig::default();
        let uniforms = CircularMenuUniforms::from_config(&config, 2, 0.75, 1.0, 1920, 1080, 0.5);

        assert!((uniforms.radius - config.radius).abs() < f32::EPSILON);
        assert_eq!(uniforms.sector_count, config.sector_count);
        assert_eq!(uniforms.highlighted_sector, 2);
        assert!((uniforms.open_progress - 0.75).abs() < f32::EPSILON);
        assert!((uniforms.time - 0.5).abs() < f32::EPSILON);
    }

    // ==========================================================================
    // Animation Tests
    // ==========================================================================

    #[test]
    fn test_animated_menu_open_close() {
        let mut menu = AnimatedCircularMenu::new();
        assert!(!menu.is_open());

        menu.open();
        assert!(menu.is_open());
        assert!(menu.is_animating());

        // Simulate animation
        for _ in 0..240 {
            menu.update(1.0 / 120.0);
        }

        assert!((menu.open_progress() - 1.0).abs() < 0.1);

        menu.close();
        assert!(!menu.is_open());

        // Simulate closing
        for _ in 0..240 {
            menu.update(1.0 / 120.0);
        }

        assert!((menu.open_progress() - 0.0).abs() < 0.1);
    }

    #[test]
    fn test_animated_menu_highlight() {
        let mut menu = AnimatedCircularMenu::new();
        menu.open();

        menu.set_highlighted_sector(2);
        assert_eq!(menu.highlighted_sector(), 2);
        assert!(menu.is_animating());

        // Simulate animation
        for _ in 0..120 {
            menu.update(1.0 / 120.0);
        }

        assert!((menu.highlight_progress() - 1.0).abs() < 0.1);
    }

    #[test]
    fn test_animated_menu_toggle() {
        let mut menu = AnimatedCircularMenu::new();
        assert!(!menu.is_open());

        menu.toggle();
        assert!(menu.is_open());

        menu.toggle();
        assert!(!menu.is_open());
    }

    // ==========================================================================
    // Vertex Tests
    // ==========================================================================

    #[test]
    fn test_menu_vertex_size() {
        // MenuVertex should be 16 bytes (2 + 2 floats = 4 floats * 4 bytes)
        assert_eq!(std::mem::size_of::<MenuVertex>(), 16);
    }
}
