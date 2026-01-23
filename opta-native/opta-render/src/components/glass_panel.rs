//! Glass panel component for UI overlays.
//!
//! Provides a reusable glass panel rendering system with blur and depth effects.
//! Uses SDF-based rounded rectangles with configurable blur, opacity, and tint.
//!
//! # Quality Levels
//!
//! The panel supports multiple quality levels for different performance targets:
//!
//! - **Low**: 8 blur samples, basic effects (60fps on low-end devices)
//! - **Medium**: 16 blur samples, standard effects (default)
//! - **High**: 32 blur samples, HD fresnel + inner glow
//! - **Ultra**: 64 blur samples, full Cook-Torrance + dispersion
//!
//! # Depth Hierarchy
//!
//! Panels support depth-based rendering where background panels have more blur:
//!
//! - `depth_layer = 0.0`: Foreground (modals, tooltips) - minimal blur
//! - `depth_layer = 0.5`: Content (cards, sections) - medium blur
//! - `depth_layer = 1.0`: Background (ambient elements) - maximum blur
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

/// Quality level for glass panels.
///
/// Controls blur sample counts and visual effect complexity.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
#[repr(C)]
pub enum PanelQualityLevel {
    /// Low quality - 8 blur samples, basic fresnel.
    /// Suitable for low-power devices or background panels.
    Low,

    /// Medium quality - 16 blur samples, standard fresnel.
    /// Default quality level for most devices.
    #[default]
    Medium,

    /// High quality - 32 blur samples, HD fresnel + inner glow.
    /// For high-end devices with ProMotion displays.
    High,

    /// Ultra quality - 64 blur samples, full Cook-Torrance + dispersion.
    /// For maximum visual fidelity on powerful GPUs.
    Ultra,
}

impl PanelQualityLevel {
    /// Get the blur sample count for this quality level.
    #[must_use]
    pub const fn blur_samples(self) -> u32 {
        match self {
            Self::Low => 8,
            Self::Medium => 16,
            Self::High => 32,
            Self::Ultra => 64,
        }
    }

    /// Check if blur is enabled for this quality level.
    #[must_use]
    pub const fn blur_enabled(self) -> bool {
        !matches!(self, Self::Low) || true // Low still has basic blur
    }

    /// Check if inner glow is enabled for this quality level.
    #[must_use]
    pub const fn inner_glow_enabled(self) -> bool {
        matches!(self, Self::High | Self::Ultra)
    }

    /// Check if HD fresnel (Cook-Torrance) is enabled.
    #[must_use]
    pub const fn hd_fresnel_enabled(self) -> bool {
        matches!(self, Self::High | Self::Ultra)
    }

    /// Check if dispersion (chromatic aberration) is enabled.
    #[must_use]
    pub const fn dispersion_enabled(self) -> bool {
        matches!(self, Self::Ultra)
    }

    /// Get the blur intensity multiplier for this quality level.
    #[must_use]
    pub const fn blur_intensity_multiplier(self) -> f32 {
        match self {
            Self::Low => 0.5,
            Self::Medium => 1.0,
            Self::High => 1.5,
            Self::Ultra => 2.0,
        }
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

/// Depth hierarchy levels for glass panels.
///
/// Defines standard depth values for consistent layering.
#[derive(Debug, Clone, Copy)]
pub struct DepthHierarchy;

impl DepthHierarchy {
    /// Foreground depth (modals, tooltips, overlays).
    /// Minimal blur for sharp, immediate UI elements.
    pub const FOREGROUND: f32 = 0.0;

    /// Content depth (cards, sections, widgets).
    /// Standard blur for content containers.
    pub const CONTENT: f32 = 0.5;

    /// Background depth (ambient elements, decorations).
    /// Maximum blur for distant elements.
    pub const BACKGROUND: f32 = 1.0;

    /// Get blur multiplier for a given depth.
    ///
    /// Deeper panels have more blur to simulate depth of field.
    #[must_use]
    pub fn blur_multiplier(depth: f32) -> f32 {
        1.0 + depth * 2.0
    }

    /// Get opacity multiplier for a given depth.
    ///
    /// Deeper panels are slightly more transparent.
    #[must_use]
    pub fn opacity_multiplier(depth: f32) -> f32 {
        1.0 - depth * 0.2
    }

    /// Calculate depth-adjusted blur intensity.
    #[must_use]
    pub fn adjusted_blur(base_blur: f32, depth: f32, falloff: f32) -> f32 {
        base_blur * (1.0 + depth.powf(falloff) * 2.0)
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
// HD Panel Uniforms (for glass_panel_hd.wgsl)
// =============================================================================

/// Uniform buffer data for the HD glass panel shader.
///
/// Matches the `HDPanelUniforms` struct in `glass_panel_hd.wgsl`.
/// Total size: 192 bytes (aligned to 16 bytes).
#[repr(C)]
#[derive(Copy, Clone, Debug, bytemuck::Pod, bytemuck::Zeroable)]
pub struct HDPanelUniforms {
    // Base panel properties (16 bytes)
    /// Panel position in pixels.
    pub position: [f32; 2],
    /// Panel size in pixels.
    pub size: [f32; 2],

    // More base properties (16 bytes)
    /// Corner radius in pixels.
    pub corner_radius: f32,
    /// Panel opacity (0.0 - 1.0).
    pub opacity: f32,
    /// Index of refraction.
    pub ior: f32,
    /// Surface roughness.
    pub roughness: f32,

    // Tint and dispersion (16 bytes)
    /// Tint color (RGB + padding).
    pub tint: [f32; 4],

    // Depth hierarchy (16 bytes)
    /// Dispersion amount.
    pub dispersion: f32,
    /// Depth layer (0-1).
    pub depth_layer: f32,
    /// Blur intensity base.
    pub blur_intensity: f32,
    /// Blur falloff exponent.
    pub blur_falloff: f32,

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

    // Glow settings (16 bytes)
    /// Glow color (RGB + intensity).
    pub glow_color: [f32; 3],
    /// Glow intensity.
    pub glow_intensity: f32,

    // Glow radius and padding (16 bytes)
    /// Glow radius in pixels.
    pub glow_radius: f32,
    /// Padding for alignment.
    pub _padding2: [f32; 3],

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

impl HDPanelUniforms {
    /// Create HD uniforms from config and resolution.
    pub fn from_config(config: &GlassPanelConfig, width: u32, height: u32, time: f32) -> Self {
        Self {
            position: config.position,
            size: config.size,
            corner_radius: config.corner_radius,
            opacity: config.effective_opacity(),
            ior: config.ior,
            roughness: config.roughness,
            tint: [config.tint[0], config.tint[1], config.tint[2], 1.0],
            dispersion: if config.quality_level.dispersion_enabled() {
                config.dispersion
            } else {
                0.0
            },
            depth_layer: config.depth_layer,
            blur_intensity: config.effective_blur(),
            blur_falloff: config.blur_falloff,
            fresnel_color: config.fresnel_color,
            fresnel_intensity: config.fresnel_intensity,
            fresnel_power: config.fresnel_power,
            _padding1: [0.0; 3],
            glow_color: config.glow_color,
            glow_intensity: if config.quality_level.inner_glow_enabled() {
                config.glow_intensity
            } else {
                0.0
            },
            glow_radius: config.glow_radius,
            _padding2: [0.0; 3],
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

/// Configuration for a glass panel.
#[derive(Debug, Clone, Copy)]
pub struct GlassPanelConfig {
    /// Panel position in pixels (top-left corner).
    pub position: [f32; 2],
    /// Panel size in pixels (width, height).
    pub size: [f32; 2],
    /// Corner radius in pixels.
    pub corner_radius: f32,
    /// Blur intensity (0.0 - 1.0).
    pub blur: f32,
    /// Panel opacity (0.0 - 1.0).
    pub opacity: f32,
    /// Tint color (RGB, 0.0 - 1.0).
    pub tint: [f32; 3],
    /// Border width in pixels.
    pub border_width: f32,
    /// Border color (RGBA, 0.0 - 1.0).
    pub border_color: [f32; 4],
    /// Depth layer (0.0 = foreground, higher = further back).
    pub depth_layer: f32,
    /// Quality level for blur and effects.
    pub quality_level: PanelQualityLevel,
    /// Index of refraction for HD glass (1.5 = crown glass).
    pub ior: f32,
    /// Surface roughness for HD glass (0.0 = mirror, 1.0 = diffuse).
    pub roughness: f32,
    /// Dispersion amount for chromatic aberration (0.0 = none).
    pub dispersion: f32,
    /// Blur falloff curve exponent for depth scaling.
    pub blur_falloff: f32,
    /// Fresnel edge highlight color (RGB).
    pub fresnel_color: [f32; 3],
    /// Fresnel edge highlight intensity.
    pub fresnel_intensity: f32,
    /// Fresnel edge power (controls sharpness).
    pub fresnel_power: f32,
    /// Inner glow color (RGB).
    pub glow_color: [f32; 3],
    /// Inner glow intensity.
    pub glow_intensity: f32,
    /// Inner glow radius in pixels.
    pub glow_radius: f32,
}

impl Default for GlassPanelConfig {
    fn default() -> Self {
        let quality = PanelQualityLevel::default();
        Self {
            position: [0.0, 0.0],
            size: [200.0, 150.0],
            corner_radius: 16.0,
            blur: 0.5,
            opacity: 0.8,
            tint: [1.0, 1.0, 1.0],
            border_width: 1.0,
            border_color: [1.0, 1.0, 1.0, 0.2],
            depth_layer: 0.0,
            quality_level: quality,
            ior: 1.5,
            roughness: 0.05,
            dispersion: 0.0,
            blur_falloff: 1.5,
            fresnel_color: [1.0, 1.0, 1.0],
            fresnel_intensity: 0.15,
            fresnel_power: 3.0,
            glow_color: [0.4, 0.6, 1.0],
            glow_intensity: 0.0,
            glow_radius: 20.0,
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
            blur: 0.3,
            opacity: 0.9,
            ..Self::default()
        }
    }

    /// Create a content panel configuration (cards, sections).
    #[must_use]
    pub fn content() -> Self {
        Self {
            depth_layer: DepthHierarchy::CONTENT,
            blur: 0.5,
            opacity: 0.8,
            ..Self::default()
        }
    }

    /// Create a background panel configuration (ambient elements).
    #[must_use]
    pub fn background() -> Self {
        Self {
            depth_layer: DepthHierarchy::BACKGROUND,
            blur: 0.8,
            opacity: 0.6,
            ..Self::default()
        }
    }

    /// Set the quality level and update related properties.
    pub fn set_quality(&mut self, quality: PanelQualityLevel) {
        self.quality_level = quality;

        // Enable HD features based on quality
        if quality.inner_glow_enabled() && self.glow_intensity == 0.0 {
            self.glow_intensity = 0.1;
        }

        if quality.dispersion_enabled() && self.dispersion == 0.0 {
            self.dispersion = 0.02;
        }
    }

    /// Get the effective blur intensity with depth scaling.
    #[must_use]
    pub fn effective_blur(&self) -> f32 {
        DepthHierarchy::adjusted_blur(self.blur, self.depth_layer, self.blur_falloff)
            * self.quality_level.blur_intensity_multiplier()
    }

    /// Get the effective opacity with depth scaling.
    #[must_use]
    pub fn effective_opacity(&self) -> f32 {
        self.opacity * DepthHierarchy::opacity_multiplier(self.depth_layer)
    }
}

/// Uniform buffer data for the glass panel shader.
#[repr(C)]
#[derive(Copy, Clone, Debug, bytemuck::Pod, bytemuck::Zeroable)]
pub struct GlassPanelUniforms {
    /// Panel position in pixels.
    pub position: [f32; 2],
    /// Panel size in pixels.
    pub size: [f32; 2],
    /// Corner radius in pixels.
    pub corner_radius: f32,
    /// Blur intensity.
    pub blur: f32,
    /// Opacity.
    pub opacity: f32,
    /// Depth layer.
    pub depth_layer: f32,
    /// Tint color (RGB + padding).
    pub tint: [f32; 4],
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
            blur: config.blur,
            opacity: config.opacity,
            depth_layer: config.depth_layer,
            tint: [config.tint[0], config.tint[1], config.tint[2], 1.0],
            border_width: config.border_width,
            _padding1: [0.0; 3],
            border_color: config.border_color,
            resolution: [width as f32, height as f32],
            _padding2: [0.0; 2],
        }
    }
}

/// Glass panel component for rendering frosted glass UI overlays.
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

    // Sampler
    sampler: wgpu::Sampler,

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

    /// Create a new glass panel.
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
            label: Some("Glass Panel Vertex Buffer"),
            contents: bytemuck::cast_slice(&vertices),
            usage: wgpu::BufferUsages::VERTEX,
        });

        let index_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Glass Panel Index Buffer"),
            contents: bytemuck::cast_slice(&indices),
            usage: wgpu::BufferUsages::INDEX,
        });

        // Create sampler
        let sampler = device.create_sampler(&wgpu::SamplerDescriptor {
            label: Some("Glass Panel Sampler"),
            address_mode_u: wgpu::AddressMode::ClampToEdge,
            address_mode_v: wgpu::AddressMode::ClampToEdge,
            address_mode_w: wgpu::AddressMode::ClampToEdge,
            mag_filter: wgpu::FilterMode::Linear,
            min_filter: wgpu::FilterMode::Linear,
            mipmap_filter: wgpu::FilterMode::Nearest,
            ..Default::default()
        });

        // Create uniform buffer
        let uniforms = GlassPanelUniforms::from_config(&config, width, height);
        let uniform_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Glass Panel Uniforms"),
            contents: bytemuck::cast_slice(&[uniforms]),
            usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
        });

        // Create bind group layout
        let bind_group_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("Glass Panel Bind Group Layout"),
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
                // Backdrop texture
                wgpu::BindGroupLayoutEntry {
                    binding: 1,
                    visibility: wgpu::ShaderStages::FRAGMENT,
                    ty: wgpu::BindingType::Texture {
                        sample_type: wgpu::TextureSampleType::Float { filterable: true },
                        view_dimension: wgpu::TextureViewDimension::D2,
                        multisampled: false,
                    },
                    count: None,
                },
                // Sampler
                wgpu::BindGroupLayoutEntry {
                    binding: 2,
                    visibility: wgpu::ShaderStages::FRAGMENT,
                    ty: wgpu::BindingType::Sampler(wgpu::SamplerBindingType::Filtering),
                    count: None,
                },
            ],
        });

        // Create shader module
        let shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("Glass Panel Shader"),
            source: wgpu::ShaderSource::Wgsl(Self::SHADER.into()),
        });

        // Create pipeline
        let pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("Glass Panel Pipeline Layout"),
            bind_group_layouts: &[&bind_group_layout],
            push_constant_ranges: &[],
        });

        let pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("Glass Panel Pipeline"),
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
            sampler,
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

    /// Render the glass panel.
    ///
    /// # Arguments
    /// * `device` - The wgpu device
    /// * `queue` - The wgpu queue
    /// * `encoder` - The command encoder
    /// * `backdrop_view` - Texture view of the scene behind the panel
    /// * `output_view` - Destination texture view
    pub fn render(
        &self,
        device: &wgpu::Device,
        queue: &wgpu::Queue,
        encoder: &mut wgpu::CommandEncoder,
        backdrop_view: &wgpu::TextureView,
        output_view: &wgpu::TextureView,
    ) {
        // Update uniforms
        let uniforms = GlassPanelUniforms::from_config(&self.config, self.width, self.height);
        queue.write_buffer(&self.uniform_buffer, 0, bytemuck::cast_slice(&[uniforms]));

        // Create bind group
        let bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("Glass Panel Bind Group"),
            layout: &self.bind_group_layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: self.uniform_buffer.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: wgpu::BindingResource::TextureView(backdrop_view),
                },
                wgpu::BindGroupEntry {
                    binding: 2,
                    resource: wgpu::BindingResource::Sampler(&self.sampler),
                },
            ],
        });

        // Render pass
        {
            let mut pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("Glass Panel Render Pass"),
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

    #[test]
    fn test_panel_vertex_size() {
        // PanelVertex should be 16 bytes (2 + 2 floats = 4 floats * 4 bytes)
        assert_eq!(std::mem::size_of::<PanelVertex>(), 16);
    }

    #[test]
    fn test_glass_panel_uniforms_size() {
        // Should be 96 bytes (aligned to 16 bytes)
        // position: 8, size: 8, corner_radius: 4, blur: 4, opacity: 4, depth_layer: 4
        // tint: 16, border_width: 4, _padding1: 12, border_color: 16
        // resolution: 8, _padding2: 8
        // Total: 8 + 8 + 4 + 4 + 4 + 4 + 16 + 4 + 12 + 16 + 8 + 8 = 96
        assert_eq!(std::mem::size_of::<GlassPanelUniforms>(), 96);
    }

    #[test]
    fn test_glass_panel_config_default() {
        let config = GlassPanelConfig::default();
        assert!((config.corner_radius - 16.0).abs() < f32::EPSILON);
        assert!((config.blur - 0.5).abs() < f32::EPSILON);
        assert!((config.opacity - 0.8).abs() < f32::EPSILON);
        assert!((config.border_width - 1.0).abs() < f32::EPSILON);
    }
}
