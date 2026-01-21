//! Glass panel component for UI overlays.
//!
//! Provides a reusable glass panel rendering system with blur and depth effects.
//! Uses SDF-based rounded rectangles with configurable blur, opacity, and tint.

// Allow precision loss for u32 -> f32 conversions in graphics code
#![allow(clippy::cast_precision_loss)]

use wgpu::util::DeviceExt;

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
}

impl Default for GlassPanelConfig {
    fn default() -> Self {
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
        }
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
        }
    }

    /// Update the panel configuration.
    pub fn set_config(&mut self, config: GlassPanelConfig) {
        self.config = config;
    }

    /// Get the current configuration.
    pub fn config(&self) -> &GlassPanelConfig {
        &self.config
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
