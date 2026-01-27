//! Memory liquid fill visualizer component.
//!
//! Renders a liquid fill effect with wave animation and surface tension
//! highlights. Memory pressure affects the color gradient from blue to red.

// Allow precision loss for u32 -> f32 conversions in graphics code
#![allow(clippy::cast_precision_loss)]

use super::telemetry::MemoryTelemetry;
use wgpu::util::DeviceExt;

/// Simple vertex for meter rendering (position and UV only).
#[repr(C)]
#[derive(Copy, Clone, Debug, bytemuck::Pod, bytemuck::Zeroable)]
pub struct MemoryMeterVertex {
    /// Position in 2D space (x, y).
    pub position: [f32; 2],
    /// Texture coordinates (u, v).
    pub uv: [f32; 2],
}

impl MemoryMeterVertex {
    /// Creates a new meter vertex.
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
            array_stride: std::mem::size_of::<MemoryMeterVertex>() as wgpu::BufferAddress,
            step_mode: wgpu::VertexStepMode::Vertex,
            attributes: &ATTRIBUTES,
        }
    }
}

/// Uniform buffer data for the memory meter shader.
#[repr(C)]
#[derive(Copy, Clone, Debug, bytemuck::Pod, bytemuck::Zeroable)]
pub struct MemoryMeterUniforms {
    /// Render resolution (width, height).
    pub resolution: [f32; 2],
    /// Position in pixels (center).
    pub position: [f32; 2],
    /// Size in pixels (width, height).
    pub size: [f32; 2],
    /// Current time in seconds (for animation).
    pub time: f32,
    /// Memory usage ratio (0.0 to 1.0).
    pub usage: f32,
    /// Memory pressure (0.0 = low, 1.0 = critical).
    pub pressure: f32,
    /// Swap usage ratio (0.0 to 1.0).
    pub swap_usage: f32,
    /// Corner radius in pixels.
    pub corner_radius: f32,
    /// Padding for alignment.
    pub _padding: [f32; 3],
}

impl Default for MemoryMeterUniforms {
    fn default() -> Self {
        Self {
            resolution: [800.0, 600.0],
            position: [400.0, 300.0],
            size: [100.0, 200.0],
            time: 0.0,
            usage: 0.5,
            pressure: 0.3,
            swap_usage: 0.0,
            corner_radius: 16.0,
            _padding: [0.0; 3],
        }
    }
}

impl MemoryMeterUniforms {
    /// Creates uniforms from memory telemetry data.
    pub fn from_telemetry(
        telemetry: &MemoryTelemetry,
        time: f32,
        position: [f32; 2],
        size: [f32; 2],
        corner_radius: f32,
        resolution: [f32; 2],
    ) -> Self {
        Self {
            resolution,
            position,
            size,
            time,
            usage: telemetry.usage_ratio(),
            pressure: telemetry.pressure,
            swap_usage: telemetry.swap_usage,
            corner_radius,
            _padding: [0.0; 3],
        }
    }
}

/// Configuration for the memory meter appearance.
#[derive(Debug, Clone, Copy)]
pub struct MemoryMeterConfig {
    /// Center position in pixels.
    pub position: [f32; 2],
    /// Size in pixels (width, height).
    pub size: [f32; 2],
    /// Corner radius in pixels.
    pub corner_radius: f32,
}

impl Default for MemoryMeterConfig {
    fn default() -> Self {
        Self {
            position: [100.0, 150.0],
            size: [80.0, 160.0],
            corner_radius: 12.0,
        }
    }
}

/// Memory meter component for rendering a liquid fill visualization.
pub struct MemoryMeter {
    // Geometry
    vertex_buffer: wgpu::Buffer,
    index_buffer: wgpu::Buffer,
    index_count: u32,

    // Pipeline
    pipeline: wgpu::RenderPipeline,
    bind_group: wgpu::BindGroup,

    // Uniforms
    uniform_buffer: wgpu::Buffer,

    // Configuration
    config: MemoryMeterConfig,

    // State
    width: u32,
    height: u32,
    time: f32,
}

impl MemoryMeter {
    /// Embedded shader source.
    const SHADER: &'static str = include_str!("../../shaders/memory_meter.wgsl");

    /// Create a new memory meter.
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
        let config = MemoryMeterConfig::default();

        // Create quad vertices (full-screen, shader handles positioning)
        let vertices = [
            MemoryMeterVertex::new([-1.0, -1.0], [0.0, 1.0]),
            MemoryMeterVertex::new([1.0, -1.0], [1.0, 1.0]),
            MemoryMeterVertex::new([1.0, 1.0], [1.0, 0.0]),
            MemoryMeterVertex::new([-1.0, 1.0], [0.0, 0.0]),
        ];

        let indices: [u16; 6] = [0, 1, 2, 2, 3, 0];

        let vertex_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Memory Meter Vertex Buffer"),
            contents: bytemuck::cast_slice(&vertices),
            usage: wgpu::BufferUsages::VERTEX,
        });

        let index_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Memory Meter Index Buffer"),
            contents: bytemuck::cast_slice(&indices),
            usage: wgpu::BufferUsages::INDEX,
        });

        // Create uniform buffer
        let uniforms = MemoryMeterUniforms {
            resolution: [width as f32, height as f32],
            position: config.position,
            size: config.size,
            corner_radius: config.corner_radius,
            ..Default::default()
        };
        let uniform_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Memory Meter Uniforms"),
            contents: bytemuck::cast_slice(&[uniforms]),
            usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
        });

        // Create bind group layout
        let bind_group_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("Memory Meter Bind Group Layout"),
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

        // Create bind group
        let bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("Memory Meter Bind Group"),
            layout: &bind_group_layout,
            entries: &[wgpu::BindGroupEntry {
                binding: 0,
                resource: uniform_buffer.as_entire_binding(),
            }],
        });

        // Create shader module
        let shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("Memory Meter Shader"),
            source: wgpu::ShaderSource::Wgsl(Self::SHADER.into()),
        });

        // Create pipeline
        let pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("Memory Meter Pipeline Layout"),
            bind_group_layouts: &[&bind_group_layout],
            push_constant_ranges: &[],
        });

        let pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("Memory Meter Pipeline"),
            layout: Some(&pipeline_layout),
            vertex: wgpu::VertexState {
                module: &shader,
                entry_point: Some("vs_main"),
                buffers: &[MemoryMeterVertex::desc()],
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
            bind_group,
            uniform_buffer,
            config,
            width,
            height,
            time: 0.0,
        }
    }

    /// Update the meter configuration.
    pub fn set_config(&mut self, config: MemoryMeterConfig) {
        self.config = config;
    }

    /// Get the current configuration.
    pub fn config(&self) -> &MemoryMeterConfig {
        &self.config
    }

    /// Resize the meter render target.
    pub fn resize(&mut self, width: u32, height: u32) {
        self.width = width;
        self.height = height;
    }

    /// Update the meter animation.
    ///
    /// Call this each frame with delta time in seconds.
    pub fn update(&mut self, delta_time: f32) {
        self.time += delta_time;
    }

    /// Render the memory meter.
    ///
    /// # Arguments
    /// * `queue` - The wgpu queue
    /// * `encoder` - The command encoder
    /// * `output_view` - Destination texture view
    /// * `telemetry` - Current memory telemetry data
    pub fn render(
        &self,
        queue: &wgpu::Queue,
        encoder: &mut wgpu::CommandEncoder,
        output_view: &wgpu::TextureView,
        telemetry: &MemoryTelemetry,
    ) {
        // Update uniforms
        let uniforms = MemoryMeterUniforms::from_telemetry(
            telemetry,
            self.time,
            self.config.position,
            self.config.size,
            self.config.corner_radius,
            [self.width as f32, self.height as f32],
        );
        queue.write_buffer(&self.uniform_buffer, 0, bytemuck::cast_slice(&[uniforms]));

        // Render pass
        {
            let mut pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("Memory Meter Render Pass"),
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
            pass.set_bind_group(0, &self.bind_group, &[]);
            pass.set_vertex_buffer(0, self.vertex_buffer.slice(..));
            pass.set_index_buffer(self.index_buffer.slice(..), wgpu::IndexFormat::Uint16);
            pass.draw_indexed(0..self.index_count, 0, 0..1);
        }
    }

    /// Get the current time.
    pub fn time(&self) -> f32 {
        self.time
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
    fn test_memory_meter_vertex_size() {
        // MemoryMeterVertex should be 16 bytes (2 + 2 floats = 4 floats * 4 bytes)
        assert_eq!(std::mem::size_of::<MemoryMeterVertex>(), 16);
    }

    #[test]
    fn test_memory_meter_uniforms_size() {
        // MemoryMeterUniforms: resolution(8) + position(8) + size(8) + time(4) + usage(4)
        // + pressure(4) + swap(4) + corner_radius(4) + padding(12) = 56 bytes
        assert_eq!(std::mem::size_of::<MemoryMeterUniforms>(), 56);
    }

    #[test]
    fn test_memory_meter_uniforms_alignment() {
        // Should be 4-byte aligned (f32 alignment)
        assert!(std::mem::align_of::<MemoryMeterUniforms>() >= 4);
    }

    #[test]
    fn test_memory_meter_config_default() {
        let config = MemoryMeterConfig::default();
        assert!((config.position[0] - 100.0).abs() < f32::EPSILON);
        assert!((config.size[0] - 80.0).abs() < f32::EPSILON);
        assert!((config.corner_radius - 12.0).abs() < f32::EPSILON);
    }

    #[test]
    fn test_uniforms_from_telemetry() {
        let telemetry = MemoryTelemetry {
            total: 32.0,
            used: 16.0,
            pressure: 0.5,
            swap_usage: 0.1,
        };

        let uniforms = MemoryMeterUniforms::from_telemetry(
            &telemetry,
            2.0,
            [200.0, 200.0],
            [100.0, 200.0],
            16.0,
            [800.0, 600.0],
        );

        assert!((uniforms.usage - 0.5).abs() < f32::EPSILON);
        assert!((uniforms.pressure - 0.5).abs() < f32::EPSILON);
        assert!((uniforms.swap_usage - 0.1).abs() < f32::EPSILON);
        assert!((uniforms.time - 2.0).abs() < f32::EPSILON);
    }
}
