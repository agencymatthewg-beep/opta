//! Branch Border component - rectangular panel borders with pulsing branch veins.
//!
//! A standalone border decoration (no fill). Branches flow continuously around
//! the border perimeter. Composable overlay that can be placed around ANY element.

use super::cpu_meter::MeterVertex;
use wgpu::util::DeviceExt;

/// Configuration for the branch border appearance.
#[derive(Debug, Clone, Copy)]
pub struct BranchBorderConfig {
    /// Panel top-left position in pixels.
    pub position: [f32; 2],
    /// Panel dimensions in pixels.
    pub size: [f32; 2],
    /// Rounded corner radius in pixels.
    pub corner_radius: f32,
    /// Border band thickness in pixels (typically 2-6).
    pub border_width: f32,
    /// Flow speed along perimeter (default: 0.4).
    pub branch_speed: f32,
    /// Branches per 100px of edge (default: 8.0).
    pub branch_density: f32,
    /// Quality level: 0=Low, 1=Medium, 2=High, 3=Ultra.
    pub quality_level: u32,
}

impl Default for BranchBorderConfig {
    fn default() -> Self {
        Self {
            position: [50.0, 50.0],
            size: [300.0, 200.0],
            corner_radius: 12.0,
            border_width: 3.0,
            branch_speed: 0.4,
            branch_density: 8.0,
            quality_level: 2,
        }
    }
}

/// Uniform buffer data for the branch border shader.
/// Total: 96 bytes (6 x 16-byte aligned groups).
#[repr(C)]
#[derive(Copy, Clone, Debug, bytemuck::Pod, bytemuck::Zeroable)]
pub struct BranchBorderUniforms {
    // Group 1: position + size = 16 bytes
    /// Panel top-left position in pixels.
    pub position: [f32; 2],
    /// Panel dimensions in pixels.
    pub size: [f32; 2],
    // Group 2: corner_radius + border_width + energy + time = 16 bytes
    /// Rounded corner radius.
    pub corner_radius: f32,
    /// Border band thickness.
    pub border_width: f32,
    /// Overall energy [0, 1].
    pub energy: f32,
    /// Animation time in seconds.
    pub time: f32,
    // Group 3: branch_speed + branch_density + quality_level + padding = 16 bytes
    /// Flow speed along perimeter.
    pub branch_speed: f32,
    /// Branches per 100px of edge.
    pub branch_density: f32,
    /// Quality level (0-3).
    pub quality_level: u32,
    /// Padding.
    pub _pad0: f32,
    // Group 4: resolution + padding = 16 bytes
    /// Viewport resolution.
    pub resolution: [f32; 2],
    /// Padding.
    pub _pad1: [f32; 2],
    // Groups 5-6: additional padding to 96 bytes
    /// Padding for 16-byte alignment.
    pub _pad2: [f32; 4],
    /// Padding for 16-byte alignment.
    pub _pad3: [f32; 4],
}

impl Default for BranchBorderUniforms {
    fn default() -> Self {
        Self {
            position: [50.0, 50.0],
            size: [300.0, 200.0],
            corner_radius: 12.0,
            border_width: 3.0,
            energy: 0.5,
            time: 0.0,
            branch_speed: 0.4,
            branch_density: 8.0,
            quality_level: 2,
            _pad0: 0.0,
            resolution: [800.0, 600.0],
            _pad1: [0.0; 2],
            _pad2: [0.0; 4],
            _pad3: [0.0; 4],
        }
    }
}

/// Branch border GPU component.
pub struct BranchBorder {
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
    config: BranchBorderConfig,

    // State
    width: u32,
    height: u32,
}

impl BranchBorder {
    /// Embedded shader source.
    const SHADER: &'static str = include_str!("../../shaders/branch_border.wgsl");

    /// Create a new branch border.
    pub fn new(
        device: &wgpu::Device,
        surface_format: wgpu::TextureFormat,
        width: u32,
        height: u32,
    ) -> Self {
        let config = BranchBorderConfig::default();

        // Full-screen quad vertices
        let vertices = [
            MeterVertex::new([-1.0, -1.0], [0.0, 1.0]),
            MeterVertex::new([1.0, -1.0], [1.0, 1.0]),
            MeterVertex::new([1.0, 1.0], [1.0, 0.0]),
            MeterVertex::new([-1.0, 1.0], [0.0, 0.0]),
        ];
        let indices: [u16; 6] = [0, 1, 2, 2, 3, 0];

        let vertex_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Branch Border Vertex Buffer"),
            contents: bytemuck::cast_slice(&vertices),
            usage: wgpu::BufferUsages::VERTEX,
        });

        let index_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Branch Border Index Buffer"),
            contents: bytemuck::cast_slice(&indices),
            usage: wgpu::BufferUsages::INDEX,
        });

        // Uniform buffer
        let uniforms = BranchBorderUniforms {
            resolution: [width as f32, height as f32],
            position: config.position,
            size: config.size,
            corner_radius: config.corner_radius,
            border_width: config.border_width,
            branch_speed: config.branch_speed,
            branch_density: config.branch_density,
            quality_level: config.quality_level,
            ..Default::default()
        };

        let uniform_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Branch Border Uniforms"),
            contents: bytemuck::cast_slice(&[uniforms]),
            usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
        });

        // Bind group layout
        let bind_group_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("Branch Border Bind Group Layout"),
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

        let bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("Branch Border Bind Group"),
            layout: &bind_group_layout,
            entries: &[wgpu::BindGroupEntry {
                binding: 0,
                resource: uniform_buffer.as_entire_binding(),
            }],
        });

        // Shader module
        let shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("Branch Border Shader"),
            source: wgpu::ShaderSource::Wgsl(Self::SHADER.into()),
        });

        // Pipeline (alpha blend - only border band visible)
        let pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("Branch Border Pipeline Layout"),
            bind_group_layouts: &[&bind_group_layout],
            push_constant_ranges: &[],
        });

        let pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("Branch Border Pipeline"),
            layout: Some(&pipeline_layout),
            vertex: wgpu::VertexState {
                module: &shader,
                entry_point: Some("vs_main"),
                buffers: &[MeterVertex::desc()],
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
        }
    }

    /// Resize the render target.
    pub fn resize(&mut self, width: u32, height: u32) {
        self.width = width;
        self.height = height;
    }

    /// Render the branch border with the given uniforms.
    pub fn render(
        &self,
        queue: &wgpu::Queue,
        encoder: &mut wgpu::CommandEncoder,
        output_view: &wgpu::TextureView,
        uniforms: &BranchBorderUniforms,
    ) {
        queue.write_buffer(&self.uniform_buffer, 0, bytemuck::cast_slice(&[*uniforms]));

        let mut pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
            label: Some("Branch Border Render Pass"),
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

    /// Get the current configuration.
    pub fn config(&self) -> &BranchBorderConfig {
        &self.config
    }

    /// Update the configuration.
    pub fn set_config(&mut self, config: BranchBorderConfig) {
        self.config = config;
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
    fn test_branch_border_config_default() {
        let config = BranchBorderConfig::default();
        assert!((config.position[0] - 50.0).abs() < f32::EPSILON);
        assert!((config.size[0] - 300.0).abs() < f32::EPSILON);
        assert!((config.size[1] - 200.0).abs() < f32::EPSILON);
        assert!((config.corner_radius - 12.0).abs() < f32::EPSILON);
        assert!((config.border_width - 3.0).abs() < f32::EPSILON);
        assert!((config.branch_speed - 0.4).abs() < f32::EPSILON);
        assert!((config.branch_density - 8.0).abs() < f32::EPSILON);
        assert_eq!(config.quality_level, 2);
    }

    #[test]
    fn test_branch_border_uniforms_size() {
        // 6 x 16-byte groups = 96 bytes
        assert_eq!(std::mem::size_of::<BranchBorderUniforms>(), 96);
    }

    #[test]
    fn test_branch_border_uniforms_alignment() {
        // Must be at least 4-byte aligned (f32)
        assert!(std::mem::align_of::<BranchBorderUniforms>() >= 4);
    }
}
