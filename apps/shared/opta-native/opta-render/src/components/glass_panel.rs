//! Obsidian panel component for UI overlays.
//!
//! Provides a reusable obsidian panel rendering system with opaque dark surfaces,
//! Cook-Torrance specular highlights, and edge branch energy veins.
//! Uses SDF-based rounded rectangles with configurable opacity, border, and depth.
//!
//! # Quality Levels
//!
//! The panel supports multiple quality levels for different performance targets:
//!
//! - **Low**: Flat obsidian color + simple fresnel edge (60fps on low-end devices)
//! - **Medium**: Cook-Torrance specular + simple fresnel border glow (default)
//! - **High**: Full Cook-Torrance + edge branch energy pattern
//! - **Ultra**: High + domain-warped branches for organic feel
//!
//! # Depth Hierarchy
//!
//! Panels support depth-based rendering where depth controls specular and branch intensity:
//!
//! - `depth_layer = 0.0`: Foreground (modals, tooltips) - highest specular, brightest branches
//! - `depth_layer = 0.5`: Content (cards, sections) - medium specular, standard branches
//! - `depth_layer = 1.0`: Background (ambient elements) - minimal specular, dim branches
//!
//! # Example
//!
//! ```ignore
//! use opta_render::components::{GlassPanel, GlassPanelConfig, PanelQualityLevel};
//!
//! let config = GlassPanelConfig::with_quality(PanelQualityLevel::High);
//! let panel = GlassPanel::new(&device, surface_format, width, height);
//! ```

// Allow precision loss for u32 -> f32 conversions in graphics code
#![allow(clippy::cast_precision_loss)]

use crate::quality::QualityLevel;
use wgpu::util::DeviceExt;

// =============================================================================
// Quality Level Enum
// =============================================================================

/// Quality level for obsidian panels.
///
/// Controls specular computation and edge branch effects.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
#[repr(C)]
pub enum PanelQualityLevel {
    /// Low quality - flat obsidian + simple fresnel edge.
    /// Suitable for low-power devices or background panels.
    Low,

    /// Medium quality - Cook-Torrance specular + fresnel.
    /// Default quality level for most devices.
    #[default]
    Medium,

    /// High quality - full Cook-Torrance + edge branch energy.
    /// For high-end devices with ProMotion displays.
    High,

    /// Ultra quality - High + enhanced branch effects.
    /// For maximum visual fidelity on powerful GPUs.
    Ultra,
}

impl PanelQualityLevel {
    /// Check if Cook-Torrance specular is enabled for this quality level.
    #[must_use]
    pub const fn specular_enabled(self) -> bool {
        matches!(self, Self::Medium | Self::High | Self::Ultra)
    }

    /// Check if edge branch energy is enabled for this quality level.
    #[must_use]
    pub const fn branch_enabled(self) -> bool {
        matches!(self, Self::High | Self::Ultra)
    }

    /// Check if HD fresnel (Cook-Torrance) is enabled.
    #[must_use]
    pub const fn hd_fresnel_enabled(self) -> bool {
        matches!(self, Self::High | Self::Ultra)
    }

    /// Convert from integer value.
    #[must_use]
    pub const fn from_u32(value: u32) -> Self {
        match value {
            0 => Self::Low,
            1 => Self::Medium,
            2 => Self::High,
            _ => Self::Ultra,
        }
    }

    /// Convert to integer value.
    #[must_use]
    pub const fn as_u32(self) -> u32 {
        match self {
            Self::Low => 0,
            Self::Medium => 1,
            Self::High => 2,
            Self::Ultra => 3,
        }
    }

    /// Convert from adaptive quality level.
    #[must_use]
    pub const fn from_quality_level(quality: QualityLevel) -> Self {
        match quality {
            QualityLevel::Low => Self::Low,
            QualityLevel::Medium => Self::Medium,
            QualityLevel::High => Self::High,
            QualityLevel::Ultra => Self::Ultra,
        }
    }

    /// Convert to adaptive quality level.
    #[must_use]
    pub const fn to_quality_level(self) -> QualityLevel {
        match self {
            Self::Low => QualityLevel::Low,
            Self::Medium => QualityLevel::Medium,
            Self::High => QualityLevel::High,
            Self::Ultra => QualityLevel::Ultra,
        }
    }
}

// =============================================================================
// Depth Hierarchy
// =============================================================================

/// Depth hierarchy levels for obsidian panels.
///
/// Defines standard depth values for consistent layering.
/// Controls specular intensity and edge branch density rather than blur.
#[derive(Debug, Clone, Copy)]
pub struct DepthHierarchy;

impl DepthHierarchy {
    /// Foreground depth (modals, tooltips, overlays).
    /// Highest specular intensity, brightest edge branches.
    pub const FOREGROUND: f32 = 0.0;

    /// Content depth (cards, sections, widgets).
    /// Medium specular, standard branches.
    pub const CONTENT: f32 = 0.5;

    /// Background depth (ambient elements, decorations).
    /// Minimal specular, dim/no branches.
    pub const BACKGROUND: f32 = 1.0;

    /// Get specular multiplier for a given depth.
    ///
    /// Foreground panels have stronger specular highlights.
    #[must_use]
    pub fn specular_multiplier(depth: f32) -> f32 {
        1.0 - depth * 0.6
    }

    /// Get opacity multiplier for a given depth.
    ///
    /// Deeper panels are slightly more transparent.
    #[must_use]
    pub fn opacity_multiplier(depth: f32) -> f32 {
        1.0 - depth * 0.2
    }

    /// Calculate depth-adjusted specular intensity.
    #[must_use]
    pub fn adjusted_specular(base_specular: f32, depth: f32) -> f32 {
        base_specular * Self::specular_multiplier(depth)
    }

    /// Compare depths for Z-ordering (returns ordering for sorting).
    ///
    /// Panels with lower depth values should render last (on top).
    #[must_use]
    pub fn compare_depth(a: f32, b: f32) -> std::cmp::Ordering {
        // Higher depth (background) renders first
        b.partial_cmp(&a).unwrap_or(std::cmp::Ordering::Equal)
    }

    /// Sort panels by depth for correct rendering order.
    ///
    /// Background panels render first, foreground panels render last (on top).
    pub fn sort_by_depth<T, F>(panels: &mut [T], get_depth: F)
    where
        F: Fn(&T) -> f32,
    {
        panels.sort_by(|a, b| Self::compare_depth(get_depth(a), get_depth(b)));
    }
}

// =============================================================================
// Obsidian Panel Uniforms (for glass_panel_hd.wgsl)
// =============================================================================

/// Uniform buffer data for the HD obsidian panel shader.
///
/// Matches the `ObsidianPanelUniforms` struct in `glass_panel_hd.wgsl`.
/// Total size: 160 bytes (10 * 16-byte aligned groups).
#[repr(C)]
#[derive(Copy, Clone, Debug, bytemuck::Pod, bytemuck::Zeroable)]
pub struct ObsidianPanelUniforms {
    // Base panel properties (16 bytes)
    /// Panel position in pixels.
    pub position: [f32; 2],
    /// Panel size in pixels.
    pub size: [f32; 2],

    // Material properties (16 bytes)
    /// Corner radius in pixels.
    pub corner_radius: f32,
    /// Panel opacity (0.0 - 1.0).
    pub opacity: f32,
    /// Surface roughness.
    pub roughness: f32,
    /// Index of refraction (1.85 for volcanic glass).
    pub ior: f32,

    // Base color (16 bytes)
    /// Obsidian base color (RGB + padding).
    pub base_color: [f32; 4],

    // Depth hierarchy (16 bytes)
    /// Depth layer (0-1).
    pub depth_layer: f32,
    /// Specular intensity (depth-scaled).
    pub specular_intensity: f32,
    /// Padding for alignment.
    pub _pad_depth: [f32; 2],

    // Edge branch parameters (16 bytes)
    /// Branch reach in pixels.
    pub branch_reach: f32,
    /// Branch density.
    pub branch_density: f32,
    /// Branch animation speed.
    pub branch_speed: f32,
    /// Branch energy level [0,1].
    pub branch_energy: f32,

    // Fresnel highlights (16 bytes)
    /// Fresnel color (RGB + intensity).
    pub fresnel_color: [f32; 3],
    /// Fresnel intensity.
    pub fresnel_intensity: f32,

    // Fresnel power and padding (16 bytes)
    /// Fresnel power (sharpness).
    pub fresnel_power: f32,
    /// Padding for alignment.
    pub _padding1: [f32; 3],

    // Border settings (16 bytes)
    /// Border width in pixels.
    pub border_width: f32,
    /// Padding for alignment.
    pub _padding3: [f32; 3],

    // Border color (16 bytes)
    /// Border color (RGBA).
    pub border_color: [f32; 4],

    // Resolution and quality (16 bytes)
    /// Render resolution (width, height).
    pub resolution: [f32; 2],
    /// Quality level (0-3).
    pub quality_level: u32,
    /// Animation time.
    pub time: f32,
}

impl ObsidianPanelUniforms {
    /// Create obsidian uniforms from config and resolution.
    pub fn from_config(config: &GlassPanelConfig, width: u32, height: u32, time: f32) -> Self {
        Self {
            position: config.position,
            size: config.size,
            corner_radius: config.corner_radius,
            opacity: config.effective_opacity(),
            roughness: config.roughness,
            ior: config.ior,
            base_color: [config.base_color[0], config.base_color[1], config.base_color[2], 1.0],
            depth_layer: config.depth_layer,
            specular_intensity: config.effective_specular(),
            _pad_depth: [0.0; 2],
            branch_reach: config.branch_reach,
            branch_density: config.branch_density,
            branch_speed: config.branch_speed,
            branch_energy: if config.quality_level.branch_enabled() {
                config.branch_energy
            } else {
                0.0
            },
            fresnel_color: config.fresnel_color,
            fresnel_intensity: config.fresnel_intensity,
            fresnel_power: config.fresnel_power,
            _padding1: [0.0; 3],
            border_width: config.border_width,
            _padding3: [0.0; 3],
            border_color: config.border_color,
            resolution: [width as f32, height as f32],
            quality_level: config.quality_level.as_u32(),
            time,
        }
    }
}

// =============================================================================
// Vertex Type
// =============================================================================

/// Simple vertex for panel rendering (position and UV only).
#[repr(C)]
#[derive(Copy, Clone, Debug, bytemuck::Pod, bytemuck::Zeroable)]
pub struct PanelVertex {
    /// Position in 2D space (x, y).
    pub position: [f32; 2],
    /// Texture coordinates (u, v).
    pub uv: [f32; 2],
}

impl PanelVertex {
    /// Creates a new panel vertex.
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
            array_stride: std::mem::size_of::<PanelVertex>() as wgpu::BufferAddress,
            step_mode: wgpu::VertexStepMode::Vertex,
            attributes: &ATTRIBUTES,
        }
    }
}

/// Configuration for an obsidian panel.
#[derive(Debug, Clone, Copy)]
pub struct GlassPanelConfig {
    /// Panel position in pixels (top-left corner).
    pub position: [f32; 2],
    /// Panel size in pixels (width, height).
    pub size: [f32; 2],
    /// Corner radius in pixels.
    pub corner_radius: f32,
    /// Panel opacity (0.0 - 1.0).
    pub opacity: f32,
    /// Obsidian base color (RGB, 0.0 - 1.0). Near-black.
    pub base_color: [f32; 3],
    /// Border width in pixels.
    pub border_width: f32,
    /// Border color (RGBA, 0.0 - 1.0).
    pub border_color: [f32; 4],
    /// Depth layer (0.0 = foreground, higher = further back).
    pub depth_layer: f32,
    /// Quality level for effects.
    pub quality_level: PanelQualityLevel,
    /// Index of refraction for obsidian (1.85 = volcanic glass).
    pub ior: f32,
    /// Surface roughness (0.0 = mirror, 1.0 = diffuse).
    pub roughness: f32,
    /// Specular intensity (depth-scaled highlight strength).
    pub specular_intensity: f32,
    /// Fresnel edge highlight color (RGB).
    pub fresnel_color: [f32; 3],
    /// Fresnel edge highlight intensity.
    pub fresnel_intensity: f32,
    /// Fresnel edge power (controls sharpness).
    pub fresnel_power: f32,
    /// Edge branch reach in pixels from border.
    pub branch_reach: f32,
    /// Edge branch density (branches per 100px).
    pub branch_density: f32,
    /// Edge branch animation speed.
    pub branch_speed: f32,
    /// Edge branch energy level [0,1].
    pub branch_energy: f32,
}

impl Default for GlassPanelConfig {
    fn default() -> Self {
        Self {
            position: [0.0, 0.0],
            size: [200.0, 150.0],
            corner_radius: 16.0,
            opacity: 0.9,
            base_color: [0.02, 0.02, 0.03],
            border_width: 1.0,
            border_color: [0.545, 0.361, 0.965, 0.2],
            depth_layer: 0.0,
            quality_level: PanelQualityLevel::default(),
            ior: 1.85,
            roughness: 0.05,
            specular_intensity: 0.15,
            fresnel_color: [0.545, 0.361, 0.965],
            fresnel_intensity: 0.1,
            fresnel_power: 3.0,
            branch_reach: 4.0,
            branch_density: 0.08,
            branch_speed: 0.2,
            branch_energy: 0.3,
        }
    }
}

impl GlassPanelConfig {
    /// Create a new configuration with the specified quality level.
    #[must_use]
    pub fn with_quality(quality: PanelQualityLevel) -> Self {
        let mut config = Self::default();
        config.set_quality(quality);
        config
    }

    /// Create a foreground panel configuration (modals, tooltips).
    #[must_use]
    pub fn foreground() -> Self {
        Self {
            depth_layer: DepthHierarchy::FOREGROUND,
            specular_intensity: 0.2,
            branch_energy: 0.5,
            opacity: 0.95,
            ..Self::default()
        }
    }

    /// Create a content panel configuration (cards, sections).
    #[must_use]
    pub fn content() -> Self {
        Self {
            depth_layer: DepthHierarchy::CONTENT,
            specular_intensity: 0.15,
            branch_energy: 0.3,
            opacity: 0.9,
            ..Self::default()
        }
    }

    /// Create a background panel configuration (ambient elements).
    #[must_use]
    pub fn background() -> Self {
        Self {
            depth_layer: DepthHierarchy::BACKGROUND,
            specular_intensity: 0.08,
            branch_energy: 0.1,
            opacity: 0.85,
            ..Self::default()
        }
    }

    /// Set the quality level and update related properties.
    pub fn set_quality(&mut self, quality: PanelQualityLevel) {
        self.quality_level = quality;

        // Enable branch energy for High/Ultra quality
        if quality.branch_enabled() && self.branch_energy < 0.01 {
            self.branch_energy = 0.3;
        }
    }

    /// Get the effective specular intensity with depth scaling.
    #[must_use]
    pub fn effective_specular(&self) -> f32 {
        DepthHierarchy::adjusted_specular(self.specular_intensity, self.depth_layer)
    }

    /// Get the effective opacity with depth scaling.
    #[must_use]
    pub fn effective_opacity(&self) -> f32 {
        self.opacity * DepthHierarchy::opacity_multiplier(self.depth_layer)
    }
}

/// Uniform buffer data for the LQ obsidian panel shader.
#[repr(C)]
#[derive(Copy, Clone, Debug, bytemuck::Pod, bytemuck::Zeroable)]
pub struct GlassPanelUniforms {
    /// Panel position in pixels.
    pub position: [f32; 2],
    /// Panel size in pixels.
    pub size: [f32; 2],
    /// Corner radius in pixels.
    pub corner_radius: f32,
    /// Opacity.
    pub opacity: f32,
    /// Roughness.
    pub roughness: f32,
    /// Depth layer.
    pub depth_layer: f32,
    /// Obsidian base color (RGB + padding).
    pub base_color: [f32; 4],
    /// Border width.
    pub border_width: f32,
    /// Padding for alignment.
    pub _padding1: [f32; 3],
    /// Border color (RGBA).
    pub border_color: [f32; 4],
    /// Render resolution (width, height).
    pub resolution: [f32; 2],
    /// Padding for 16-byte alignment.
    pub _padding2: [f32; 2],
}

impl GlassPanelUniforms {
    /// Create uniforms from config and resolution.
    pub fn from_config(config: &GlassPanelConfig, width: u32, height: u32) -> Self {
        Self {
            position: config.position,
            size: config.size,
            corner_radius: config.corner_radius,
            opacity: config.opacity,
            roughness: config.roughness,
            depth_layer: config.depth_layer,
            base_color: [config.base_color[0], config.base_color[1], config.base_color[2], 1.0],
            border_width: config.border_width,
            _padding1: [0.0; 3],
            border_color: config.border_color,
            resolution: [width as f32, height as f32],
            _padding2: [0.0; 2],
        }
    }
}

/// Obsidian panel component for rendering dark glass-like UI overlays.
pub struct GlassPanel {
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
    config: GlassPanelConfig,
    width: u32,
    height: u32,

    // Quality level
    quality_level: PanelQualityLevel,
}

impl GlassPanel {
    /// Embedded shader source.
    const SHADER: &'static str = include_str!("../../shaders/glass_panel.wgsl");

    /// Create a new obsidian panel.
    ///
    /// # Arguments
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
        let config = GlassPanelConfig::default();

        // Create quad vertices (full-screen, shader will handle positioning)
        let vertices = [
            PanelVertex::new([-1.0, -1.0], [0.0, 1.0]),
            PanelVertex::new([1.0, -1.0], [1.0, 1.0]),
            PanelVertex::new([1.0, 1.0], [1.0, 0.0]),
            PanelVertex::new([-1.0, 1.0], [0.0, 0.0]),
        ];

        let indices: [u16; 6] = [0, 1, 2, 2, 3, 0];

        let vertex_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Obsidian Panel Vertex Buffer"),
            contents: bytemuck::cast_slice(&vertices),
            usage: wgpu::BufferUsages::VERTEX,
        });

        let index_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Obsidian Panel Index Buffer"),
            contents: bytemuck::cast_slice(&indices),
            usage: wgpu::BufferUsages::INDEX,
        });

        // Create uniform buffer
        let uniforms = GlassPanelUniforms::from_config(&config, width, height);
        let uniform_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Obsidian Panel Uniforms"),
            contents: bytemuck::cast_slice(&[uniforms]),
            usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
        });

        // Create bind group layout (uniform buffer only, no backdrop texture)
        let bind_group_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("Obsidian Panel Bind Group Layout"),
            entries: &[
                // Uniforms
                wgpu::BindGroupLayoutEntry {
                    binding: 0,
                    visibility: wgpu::ShaderStages::VERTEX | wgpu::ShaderStages::FRAGMENT,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Uniform,
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
            ],
        });

        // Create shader module
        let shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("Obsidian Panel Shader"),
            source: wgpu::ShaderSource::Wgsl(Self::SHADER.into()),
        });

        // Create pipeline
        let pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("Obsidian Panel Pipeline Layout"),
            bind_group_layouts: &[&bind_group_layout],
            push_constant_ranges: &[],
        });

        let pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("Obsidian Panel Pipeline"),
            layout: Some(&pipeline_layout),
            vertex: wgpu::VertexState {
                module: &shader,
                entry_point: Some("vs_main"),
                buffers: &[PanelVertex::desc()],
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
            width,
            height,
            quality_level: config.quality_level,
        }
    }

    /// Update the panel configuration.
    pub fn set_config(&mut self, config: GlassPanelConfig) {
        self.config = config;
        self.quality_level = config.quality_level;
    }

    /// Get the current configuration.
    pub fn config(&self) -> &GlassPanelConfig {
        &self.config
    }

    /// Get the current quality level.
    #[must_use]
    pub fn quality_level(&self) -> PanelQualityLevel {
        self.quality_level
    }

    /// Set the quality level.
    ///
    /// Updates both the internal quality level and the configuration.
    pub fn set_quality(&mut self, quality: PanelQualityLevel) {
        self.quality_level = quality;
        self.config.set_quality(quality);
    }

    /// Resize the panel render target.
    pub fn resize(&mut self, width: u32, height: u32) {
        self.width = width;
        self.height = height;
    }

    /// Render the obsidian panel.
    ///
    /// # Arguments
    /// * `device` - The wgpu device
    /// * `queue` - The wgpu queue
    /// * `encoder` - The command encoder
    /// * `output_view` - Destination texture view
    pub fn render(
        &self,
        device: &wgpu::Device,
        queue: &wgpu::Queue,
        encoder: &mut wgpu::CommandEncoder,
        output_view: &wgpu::TextureView,
    ) {
        // Update uniforms
        let uniforms = GlassPanelUniforms::from_config(&self.config, self.width, self.height);
        queue.write_buffer(&self.uniform_buffer, 0, bytemuck::cast_slice(&[uniforms]));

        // Create bind group (uniform buffer only)
        let bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("Obsidian Panel Bind Group"),
            layout: &self.bind_group_layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: self.uniform_buffer.as_entire_binding(),
                },
            ],
        });

        // Render pass
        {
            let mut pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("Obsidian Panel Render Pass"),
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

#[cfg(test)]
mod tests {
    use super::*;

    // ==========================================================================
    // Basic Type Tests
    // ==========================================================================

    #[test]
    fn test_panel_vertex_size() {
        // PanelVertex should be 16 bytes (2 + 2 floats = 4 floats * 4 bytes)
        assert_eq!(std::mem::size_of::<PanelVertex>(), 16);
    }

    #[test]
    fn test_glass_panel_uniforms_size() {
        // Should be 96 bytes (aligned to 16 bytes)
        // position: 8, size: 8, corner_radius: 4, opacity: 4, roughness: 4, depth_layer: 4
        // base_color: 16, border_width: 4, _padding1: 12, border_color: 16
        // resolution: 8, _padding2: 8
        // Total: 8 + 8 + 4 + 4 + 4 + 4 + 16 + 4 + 12 + 16 + 8 + 8 = 96
        assert_eq!(std::mem::size_of::<GlassPanelUniforms>(), 96);
    }

    #[test]
    fn test_obsidian_panel_uniforms_size() {
        // Should be 160 bytes (10 * 16-byte aligned groups)
        // Groups: pos+size(16), material(16), base_color(16), depth(16),
        //         branches(16), fresnel_color+intensity(16), fresnel_power+pad(16),
        //         border_width+pad(16), border_color(16), resolution+quality+time(16)
        assert_eq!(std::mem::size_of::<ObsidianPanelUniforms>(), 160);
    }

    #[test]
    fn test_glass_panel_config_default() {
        let config = GlassPanelConfig::default();
        assert!((config.corner_radius - 16.0).abs() < f32::EPSILON);
        assert!((config.opacity - 0.9).abs() < f32::EPSILON);
        assert!((config.border_width - 1.0).abs() < f32::EPSILON);
        assert!((config.base_color[0] - 0.02).abs() < f32::EPSILON);
        assert!((config.base_color[1] - 0.02).abs() < f32::EPSILON);
        assert!((config.base_color[2] - 0.03).abs() < f32::EPSILON);
        assert!((config.ior - 1.85).abs() < f32::EPSILON);
        assert!((config.roughness - 0.05).abs() < f32::EPSILON);
        assert!((config.specular_intensity - 0.15).abs() < f32::EPSILON);
        assert!((config.branch_reach - 4.0).abs() < f32::EPSILON);
        assert!((config.branch_density - 0.08).abs() < f32::EPSILON);
        assert!((config.branch_speed - 0.2).abs() < f32::EPSILON);
        assert!((config.branch_energy - 0.3).abs() < f32::EPSILON);
    }

    // ==========================================================================
    // Panel Quality Level Tests
    // ==========================================================================

    #[test]
    fn test_panel_quality_level_default() {
        let quality = PanelQualityLevel::default();
        assert_eq!(quality, PanelQualityLevel::Medium);
    }

    #[test]
    fn test_panel_quality_specular_enabled() {
        assert!(!PanelQualityLevel::Low.specular_enabled());
        assert!(PanelQualityLevel::Medium.specular_enabled());
        assert!(PanelQualityLevel::High.specular_enabled());
        assert!(PanelQualityLevel::Ultra.specular_enabled());
    }

    #[test]
    fn test_panel_quality_branch_enabled() {
        assert!(!PanelQualityLevel::Low.branch_enabled());
        assert!(!PanelQualityLevel::Medium.branch_enabled());
        assert!(PanelQualityLevel::High.branch_enabled());
        assert!(PanelQualityLevel::Ultra.branch_enabled());
    }

    #[test]
    fn test_panel_quality_level_conversion() {
        // Test u32 conversion round-trip
        assert_eq!(PanelQualityLevel::from_u32(0), PanelQualityLevel::Low);
        assert_eq!(PanelQualityLevel::from_u32(1), PanelQualityLevel::Medium);
        assert_eq!(PanelQualityLevel::from_u32(2), PanelQualityLevel::High);
        assert_eq!(PanelQualityLevel::from_u32(3), PanelQualityLevel::Ultra);
        assert_eq!(PanelQualityLevel::from_u32(100), PanelQualityLevel::Ultra); // Clamp high values

        assert_eq!(PanelQualityLevel::Low.as_u32(), 0);
        assert_eq!(PanelQualityLevel::Medium.as_u32(), 1);
        assert_eq!(PanelQualityLevel::High.as_u32(), 2);
        assert_eq!(PanelQualityLevel::Ultra.as_u32(), 3);
    }

    #[test]
    fn test_panel_quality_feature_flags() {
        // Low - basic features only
        assert!(!PanelQualityLevel::Low.branch_enabled());
        assert!(!PanelQualityLevel::Low.hd_fresnel_enabled());
        assert!(!PanelQualityLevel::Low.specular_enabled());

        // Medium - specular but no branches
        assert!(!PanelQualityLevel::Medium.branch_enabled());
        assert!(!PanelQualityLevel::Medium.hd_fresnel_enabled());
        assert!(PanelQualityLevel::Medium.specular_enabled());

        // High - HD features enabled
        assert!(PanelQualityLevel::High.branch_enabled());
        assert!(PanelQualityLevel::High.hd_fresnel_enabled());
        assert!(PanelQualityLevel::High.specular_enabled());

        // Ultra - all features
        assert!(PanelQualityLevel::Ultra.branch_enabled());
        assert!(PanelQualityLevel::Ultra.hd_fresnel_enabled());
        assert!(PanelQualityLevel::Ultra.specular_enabled());
    }

    #[test]
    fn test_panel_quality_from_quality_level() {
        assert_eq!(
            PanelQualityLevel::from_quality_level(QualityLevel::Low),
            PanelQualityLevel::Low
        );
        assert_eq!(
            PanelQualityLevel::from_quality_level(QualityLevel::Medium),
            PanelQualityLevel::Medium
        );
        assert_eq!(
            PanelQualityLevel::from_quality_level(QualityLevel::High),
            PanelQualityLevel::High
        );
        assert_eq!(
            PanelQualityLevel::from_quality_level(QualityLevel::Ultra),
            PanelQualityLevel::Ultra
        );
    }

    #[test]
    fn test_config_with_quality() {
        let config = GlassPanelConfig::with_quality(PanelQualityLevel::High);
        assert_eq!(config.quality_level, PanelQualityLevel::High);
        // High quality enables branch energy
        assert!(config.branch_energy > 0.0);
    }

    #[test]
    fn test_config_set_quality() {
        let mut config = GlassPanelConfig::default();
        assert_eq!(config.quality_level, PanelQualityLevel::Medium);

        config.branch_energy = 0.0; // Reset to test auto-enable
        config.set_quality(PanelQualityLevel::High);
        assert_eq!(config.quality_level, PanelQualityLevel::High);
        // High enables branches
        assert!(config.branch_energy > 0.0);
    }

    // ==========================================================================
    // Depth Hierarchy Tests
    // ==========================================================================

    #[test]
    fn test_depth_hierarchy_constants() {
        assert!((DepthHierarchy::FOREGROUND - 0.0).abs() < f32::EPSILON);
        assert!((DepthHierarchy::CONTENT - 0.5).abs() < f32::EPSILON);
        assert!((DepthHierarchy::BACKGROUND - 1.0).abs() < f32::EPSILON);
    }

    #[test]
    fn test_depth_hierarchy_specular_multiplier() {
        // Foreground: maximum specular
        let fg_mult = DepthHierarchy::specular_multiplier(DepthHierarchy::FOREGROUND);
        assert!((fg_mult - 1.0).abs() < f32::EPSILON);

        // Background: reduced specular (1.0 - 1.0 * 0.6 = 0.4)
        let bg_mult = DepthHierarchy::specular_multiplier(DepthHierarchy::BACKGROUND);
        assert!((bg_mult - 0.4).abs() < f32::EPSILON);

        // Content: intermediate
        let content_mult = DepthHierarchy::specular_multiplier(DepthHierarchy::CONTENT);
        assert!(content_mult > bg_mult);
        assert!(content_mult < fg_mult);
    }

    #[test]
    fn test_depth_hierarchy_opacity_multiplier() {
        // Foreground: full opacity
        let fg_opacity = DepthHierarchy::opacity_multiplier(DepthHierarchy::FOREGROUND);
        assert!((fg_opacity - 1.0).abs() < f32::EPSILON);

        // Background: reduced opacity
        let bg_opacity = DepthHierarchy::opacity_multiplier(DepthHierarchy::BACKGROUND);
        assert!((bg_opacity - 0.8).abs() < f32::EPSILON);

        // Opacity decreases with depth
        assert!(fg_opacity > bg_opacity);
    }

    #[test]
    fn test_depth_hierarchy_adjusted_specular() {
        let base_specular = 0.15;

        let fg_specular = DepthHierarchy::adjusted_specular(base_specular, DepthHierarchy::FOREGROUND);
        let bg_specular = DepthHierarchy::adjusted_specular(base_specular, DepthHierarchy::BACKGROUND);

        // Background should have lower specular
        assert!(bg_specular < fg_specular);
        // Foreground should be close to base
        assert!((fg_specular - base_specular).abs() < f32::EPSILON);
    }

    #[test]
    fn test_depth_hierarchy_compare_depth() {
        use std::cmp::Ordering;

        // Higher depth (background) should sort before lower depth (foreground)
        assert_eq!(
            DepthHierarchy::compare_depth(DepthHierarchy::FOREGROUND, DepthHierarchy::BACKGROUND),
            Ordering::Greater
        );
        assert_eq!(
            DepthHierarchy::compare_depth(DepthHierarchy::BACKGROUND, DepthHierarchy::FOREGROUND),
            Ordering::Less
        );
        assert_eq!(
            DepthHierarchy::compare_depth(DepthHierarchy::CONTENT, DepthHierarchy::CONTENT),
            Ordering::Equal
        );
    }

    #[test]
    fn test_depth_hierarchy_sort_by_depth() {
        struct Panel {
            depth: f32,
        }

        let mut panels = vec![
            Panel { depth: DepthHierarchy::FOREGROUND },
            Panel { depth: DepthHierarchy::BACKGROUND },
            Panel { depth: DepthHierarchy::CONTENT },
        ];

        DepthHierarchy::sort_by_depth(&mut panels, |p| p.depth);

        // Should be sorted: background first, then content, then foreground (last = on top)
        assert!((panels[0].depth - DepthHierarchy::BACKGROUND).abs() < f32::EPSILON);
        assert!((panels[1].depth - DepthHierarchy::CONTENT).abs() < f32::EPSILON);
        assert!((panels[2].depth - DepthHierarchy::FOREGROUND).abs() < f32::EPSILON);
    }

    // ==========================================================================
    // Obsidian Panel Uniforms Tests
    // ==========================================================================

    #[test]
    fn test_obsidian_panel_uniforms_from_config() {
        let config = GlassPanelConfig::with_quality(PanelQualityLevel::Ultra);
        let uniforms = ObsidianPanelUniforms::from_config(&config, 1920, 1080, 0.5);

        // Check resolution
        assert!((uniforms.resolution[0] - 1920.0).abs() < f32::EPSILON);
        assert!((uniforms.resolution[1] - 1080.0).abs() < f32::EPSILON);

        // Check quality level
        assert_eq!(uniforms.quality_level, PanelQualityLevel::Ultra.as_u32());

        // Ultra quality enables branch energy
        assert!(uniforms.branch_energy > 0.0);

        // Time is passed through
        assert!((uniforms.time - 0.5).abs() < f32::EPSILON);

        // Base color is obsidian (near-black)
        assert!((uniforms.base_color[0] - 0.02).abs() < f32::EPSILON);
        assert!((uniforms.base_color[1] - 0.02).abs() < f32::EPSILON);
        assert!((uniforms.base_color[2] - 0.03).abs() < f32::EPSILON);

        // IOR is volcanic glass
        assert!((uniforms.ior - 1.85).abs() < f32::EPSILON);
    }

    #[test]
    fn test_obsidian_uniforms_quality_gating() {
        // Low quality should disable branch energy
        let low_config = GlassPanelConfig::with_quality(PanelQualityLevel::Low);
        let low_uniforms = ObsidianPanelUniforms::from_config(&low_config, 1920, 1080, 0.0);
        assert!((low_uniforms.branch_energy - 0.0).abs() < f32::EPSILON);

        // High quality should enable branch energy
        let high_config = GlassPanelConfig::with_quality(PanelQualityLevel::High);
        let high_uniforms = ObsidianPanelUniforms::from_config(&high_config, 1920, 1080, 0.0);
        assert!(high_uniforms.branch_energy > 0.0);
    }

    // ==========================================================================
    // Config Factory Methods Tests
    // ==========================================================================

    #[test]
    fn test_config_foreground() {
        let config = GlassPanelConfig::foreground();
        assert!((config.depth_layer - DepthHierarchy::FOREGROUND).abs() < f32::EPSILON);
        assert!((config.specular_intensity - 0.2).abs() < f32::EPSILON);
        assert!((config.branch_energy - 0.5).abs() < f32::EPSILON);
        assert!((config.opacity - 0.95).abs() < f32::EPSILON);
    }

    #[test]
    fn test_config_content() {
        let config = GlassPanelConfig::content();
        assert!((config.depth_layer - DepthHierarchy::CONTENT).abs() < f32::EPSILON);
        assert!((config.specular_intensity - 0.15).abs() < f32::EPSILON);
        assert!((config.branch_energy - 0.3).abs() < f32::EPSILON);
        assert!((config.opacity - 0.9).abs() < f32::EPSILON);
    }

    #[test]
    fn test_config_background() {
        let config = GlassPanelConfig::background();
        assert!((config.depth_layer - DepthHierarchy::BACKGROUND).abs() < f32::EPSILON);
        assert!((config.specular_intensity - 0.08).abs() < f32::EPSILON);
        assert!((config.branch_energy - 0.1).abs() < f32::EPSILON);
        assert!((config.opacity - 0.85).abs() < f32::EPSILON);
    }

    #[test]
    fn test_config_effective_specular() {
        let fg_config = GlassPanelConfig::foreground();
        let bg_config = GlassPanelConfig::background();

        // Foreground should have higher effective specular
        assert!(fg_config.effective_specular() > bg_config.effective_specular());
    }

    #[test]
    fn test_config_effective_opacity() {
        let fg_config = GlassPanelConfig::foreground();
        let bg_config = GlassPanelConfig::background();

        // Foreground should have higher effective opacity
        assert!(fg_config.effective_opacity() > bg_config.effective_opacity());
    }
}
