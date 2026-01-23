//! Branch Meter component - horizontal meter with branch energy veins.
//!
//! Replaces linear progress bars. Energy level (0-1) controls how far branches
//! extend from left to right. Uses tri-axis response (reach, width, brightness).

use super::cpu_meter::MeterVertex;
use wgpu::util::DeviceExt;

/// Configuration for the branch meter appearance.
#[derive(Debug, Clone, Copy)]
pub struct BranchMeterConfig {
    /// Top-left position in pixels.
    pub position: [f32; 2],
    /// Meter dimensions in pixels (width, height).
    pub size: [f32; 2],
    /// Rounded corner radius in pixels.
    pub corner_radius: f32,
    /// Pulse animation speed (default: 0.3).
    pub branch_speed: f32,
    /// Branches per unit (default: 6.0).
    pub branch_density: f32,
    /// Obsidian base color (default: dark obsidian).
    pub base_color: [f32; 3],
    /// Quality level: 0=Low, 1=Medium, 2=High, 3=Ultra.
    pub quality_level: u32,
}

impl Default for BranchMeterConfig {
    fn default() -> Self {
        Self {
            position: [50.0, 50.0],
            size: [200.0, 24.0],
            corner_radius: 8.0,
            branch_speed: 0.3,
            branch_density: 6.0,
            base_color: [0.035, 0.035, 0.05],
            quality_level: 2,
        }
    }
}

/// Uniform buffer data for the branch meter shader.
/// Total: 112 bytes (7 x 16-byte aligned groups).
#[repr(C)]
#[derive(Copy, Clone, Debug, bytemuck::Pod, bytemuck::Zeroable)]
pub struct BranchMeterUniforms {
    // Group 1: position + size = 16 bytes
    /// Top-left position in pixels.
    pub position: [f32; 2],
    /// Meter dimensions (width, height) in pixels.
    pub size: [f32; 2],
    // Group 2: corner_radius + fill_level + energy + time = 16 bytes
    /// Rounded corner radius.
    pub corner_radius: f32,
    /// Current fill value [0, 1].
    pub fill_level: f32,
    /// Overall energy/intensity [0, 1].
    pub energy: f32,
    /// Animation time in seconds.
    pub time: f32,
    // Group 3: base_color + branch_speed = 16 bytes
    /// Obsidian base color RGB.
    pub base_color: [f32; 3],
    /// Pulse animation speed.
    pub branch_speed: f32,
    // Group 4: branch_density + quality_level + resolution = 16 bytes
    /// Branches per unit.
    pub branch_density: f32,
    /// Quality level (0-3).
    pub quality_level: u32,
    /// Viewport resolution.
    pub resolution: [f32; 2],
    // Groups 5-7: padding to 112 bytes
    /// Padding for 16-byte alignment.
    pub _pad0: [f32; 4],
    /// Padding for 16-byte alignment.
    pub _pad1: [f32; 4],
    /// Padding for 16-byte alignment.
    pub _pad2: [f32; 4],
}

impl Default for BranchMeterUniforms {
    fn default() -> Self {
        Self {
            position: [50.0, 50.0],
            size: [200.0, 24.0],
            corner_radius: 8.0,
            fill_level: 0.5,
            energy: 0.5,
            time: 0.0,
            base_color: [0.035, 0.035, 0.05],
            branch_speed: 0.3,
            branch_density: 6.0,
            quality_level: 2,
            resolution: [800.0, 600.0],
            _pad0: [0.0; 4],
            _pad1: [0.0; 4],
            _pad2: [0.0; 4],
        }
    }
}

/// Branch meter GPU component.
pub struct BranchMeter {
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
    config: BranchMeterConfig,

    // State
    width: u32,
    height: u32,
}

impl BranchMeter {
    /// Embedded shader source.
    const SHADER: &'static str = include_str!("../../shaders/branch_meter.wgsl");

    /// Create a new branch meter.
    pub fn new(
        device: &wgpu::Device,
        surface_format: wgpu::TextureFormat,
        width: u32,
        height: u32,
    ) -> Self {
        let config = BranchMeterConfig::default();

        // Full-screen quad vertices
        let vertices = [
            MeterVertex::new([-1.0, -1.0], [0.0, 1.0]),
            MeterVertex::new([1.0, -1.0], [1.0, 1.0]),
            MeterVertex::new([1.0, 1.0], [1.0, 0.0]),
            MeterVertex::new([-1.0, 1.0], [0.0, 0.0]),
        ];
        let indices: [u16; 6] = [0, 1, 2, 2, 3, 0];

        let vertex_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Branch Meter Vertex Buffer"),
            contents: bytemuck::cast_slice(&vertices),
            usage: wgpu::BufferUsages::VERTEX,
        });

        let index_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Branch Meter Index Buffer"),
            contents: bytemuck::cast_slice(&indices),
            usage: wgpu::BufferUsages::INDEX,
        });

        // Uniform buffer
        let uniforms = BranchMeterUniforms {
            resolution: [width as f32, height as f32],
            position: config.position,
            size: config.size,
            corner_radius: config.corner_radius,
            branch_speed: config.branch_speed,
            branch_density: config.branch_density,
            base_color: config.base_color,
            quality_level: config.quality_level,
            ..Default::default()
        };

        let uniform_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Branch Meter Uniforms"),
            contents: bytemuck::cast_slice(&[uniforms]),
            usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
        });

        // Bind group layout
        let bind_group_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("Branch Meter Bind Group Layout"),
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
            label: Some("Branch Meter Bind Group"),
            layout: &bind_group_layout,
            entries: &[wgpu::BindGroupEntry {
                binding: 0,
                resource: uniform_buffer.as_entire_binding(),
            }],
        });

        // Shader module
        let shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("Branch Meter Shader"),
            source: wgpu::ShaderSource::Wgsl(Self::SHADER.into()),
        });

        // Pipeline (opaque blend - meter fills its entire rounded rect)
        let pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("Branch Meter Pipeline Layout"),
            bind_group_layouts: &[&bind_group_layout],
            push_constant_ranges: &[],
        });

        let pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("Branch Meter Pipeline"),
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

    /// Render the branch meter with the given uniforms.
    pub fn render(
        &self,
        queue: &wgpu::Queue,
        encoder: &mut wgpu::CommandEncoder,
        output_view: &wgpu::TextureView,
        uniforms: &BranchMeterUniforms,
    ) {
        queue.write_buffer(&self.uniform_buffer, 0, bytemuck::cast_slice(&[*uniforms]));

        let mut pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
            label: Some("Branch Meter Render Pass"),
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
    pub fn config(&self) -> &BranchMeterConfig {
        &self.config
    }

    /// Update the configuration.
    pub fn set_config(&mut self, config: BranchMeterConfig) {
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
    fn test_branch_meter_config_default() {
        let config = BranchMeterConfig::default();
        assert!((config.position[0] - 50.0).abs() < f32::EPSILON);
        assert!((config.size[0] - 200.0).abs() < f32::EPSILON);
        assert!((config.size[1] - 24.0).abs() < f32::EPSILON);
        assert!((config.corner_radius - 8.0).abs() < f32::EPSILON);
        assert!((config.branch_speed - 0.3).abs() < f32::EPSILON);
        assert!((config.branch_density - 6.0).abs() < f32::EPSILON);
        assert_eq!(config.quality_level, 2);
    }

    #[test]
    fn test_branch_meter_uniforms_size() {
        // 7 x 16-byte groups = 112 bytes
        assert_eq!(std::mem::size_of::<BranchMeterUniforms>(), 112);
    }

    #[test]
    fn test_branch_meter_uniforms_alignment() {
        // Must be at least 4-byte aligned (f32)
        assert!(std::mem::align_of::<BranchMeterUniforms>() >= 4);
    }
}
