//! Branch Indicator component - circular status indicator with radial branch veins.
//!
//! Replaces status dots. A small circle with branches radiating outward.
//! Energy level controls branch reach and pulse intensity.

use super::cpu_meter::MeterVertex;
use wgpu::util::DeviceExt;

/// Configuration for the branch indicator appearance.
#[derive(Debug, Clone, Copy)]
pub struct BranchIndicatorConfig {
    /// Screen center position in pixels.
    pub center: [f32; 2],
    /// Solid core radius in pixels (typically 4-8).
    pub inner_radius: f32,
    /// Maximum branch reach in pixels (typically 12-20).
    pub outer_radius: f32,
    /// Number of radial branches (default: 6.0).
    pub branch_count: f32,
    /// Pulse speed (default: 0.5).
    pub branch_speed: f32,
    /// Obsidian core color.
    pub base_color: [f32; 3],
    /// Quality level: 0=Low, 1=Medium, 2=High, 3=Ultra.
    pub quality_level: u32,
}

impl Default for BranchIndicatorConfig {
    fn default() -> Self {
        Self {
            center: [100.0, 100.0],
            inner_radius: 6.0,
            outer_radius: 16.0,
            branch_count: 6.0,
            branch_speed: 0.5,
            base_color: [0.035, 0.035, 0.05],
            quality_level: 2,
        }
    }
}

/// Uniform buffer data for the branch indicator shader.
/// Total: 80 bytes (5 x 16-byte aligned groups).
#[repr(C)]
#[derive(Copy, Clone, Debug, bytemuck::Pod, bytemuck::Zeroable)]
pub struct BranchIndicatorUniforms {
    // Group 1: center + inner_radius + outer_radius = 16 bytes
    /// Screen center position in pixels.
    pub center: [f32; 2],
    /// Solid core radius.
    pub inner_radius: f32,
    /// Maximum branch reach.
    pub outer_radius: f32,
    // Group 2: energy + time + base_color_xy = 16 bytes
    /// Overall energy [0, 1].
    pub energy: f32,
    /// Animation time in seconds.
    pub time: f32,
    /// Base color XY components.
    pub base_color_xy: [f32; 2],
    // Group 3: base_color_z + branch_count + branch_speed + quality_level = 16 bytes
    /// Base color Z component.
    pub base_color_z: f32,
    /// Number of radial branches.
    pub branch_count: f32,
    /// Pulse speed.
    pub branch_speed: f32,
    /// Quality level (0-3).
    pub quality_level: u32,
    // Group 4: resolution + padding = 16 bytes
    /// Viewport resolution.
    pub resolution: [f32; 2],
    /// Padding.
    pub _pad0: [f32; 2],
    // Group 5: additional padding to 80 bytes
    /// Padding for 16-byte alignment.
    pub _pad1: [f32; 4],
}

impl Default for BranchIndicatorUniforms {
    fn default() -> Self {
        Self {
            center: [100.0, 100.0],
            inner_radius: 6.0,
            outer_radius: 16.0,
            energy: 0.5,
            time: 0.0,
            base_color_xy: [0.035, 0.035],
            base_color_z: 0.05,
            branch_count: 6.0,
            branch_speed: 0.5,
            quality_level: 2,
            resolution: [800.0, 600.0],
            _pad0: [0.0; 2],
            _pad1: [0.0; 4],
        }
    }
}

/// Branch indicator GPU component.
pub struct BranchIndicator {
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
    config: BranchIndicatorConfig,

    // State
    width: u32,
    height: u32,
}

impl BranchIndicator {
    /// Embedded shader source.
    const SHADER: &'static str = include_str!("../../shaders/branch_indicator.wgsl");

    /// Create a new branch indicator.
    pub fn new(
        device: &wgpu::Device,
        surface_format: wgpu::TextureFormat,
        width: u32,
        height: u32,
    ) -> Self {
        let config = BranchIndicatorConfig::default();

        // Full-screen quad vertices
        let vertices = [
            MeterVertex::new([-1.0, -1.0], [0.0, 1.0]),
            MeterVertex::new([1.0, -1.0], [1.0, 1.0]),
            MeterVertex::new([1.0, 1.0], [1.0, 0.0]),
            MeterVertex::new([-1.0, 1.0], [0.0, 0.0]),
        ];
        let indices: [u16; 6] = [0, 1, 2, 2, 3, 0];

        let vertex_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Branch Indicator Vertex Buffer"),
            contents: bytemuck::cast_slice(&vertices),
            usage: wgpu::BufferUsages::VERTEX,
        });

        let index_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Branch Indicator Index Buffer"),
            contents: bytemuck::cast_slice(&indices),
            usage: wgpu::BufferUsages::INDEX,
        });

        // Uniform buffer
        let uniforms = BranchIndicatorUniforms {
            resolution: [width as f32, height as f32],
            center: config.center,
            inner_radius: config.inner_radius,
            outer_radius: config.outer_radius,
            branch_count: config.branch_count,
            branch_speed: config.branch_speed,
            base_color_xy: [config.base_color[0], config.base_color[1]],
            base_color_z: config.base_color[2],
            quality_level: config.quality_level,
            ..Default::default()
        };

        let uniform_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Branch Indicator Uniforms"),
            contents: bytemuck::cast_slice(&[uniforms]),
            usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
        });

        // Bind group layout
        let bind_group_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("Branch Indicator Bind Group Layout"),
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
            label: Some("Branch Indicator Bind Group"),
            layout: &bind_group_layout,
            entries: &[wgpu::BindGroupEntry {
                binding: 0,
                resource: uniform_buffer.as_entire_binding(),
            }],
        });

        // Shader module
        let shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("Branch Indicator Shader"),
            source: wgpu::ShaderSource::Wgsl(Self::SHADER.into()),
        });

        // Pipeline (alpha blend - circular with transparent outside)
        let pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("Branch Indicator Pipeline Layout"),
            bind_group_layouts: &[&bind_group_layout],
            push_constant_ranges: &[],
        });

        let pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("Branch Indicator Pipeline"),
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

    /// Render the branch indicator with the given uniforms.
    pub fn render(
        &self,
        queue: &wgpu::Queue,
        encoder: &mut wgpu::CommandEncoder,
        output_view: &wgpu::TextureView,
        uniforms: &BranchIndicatorUniforms,
    ) {
        queue.write_buffer(&self.uniform_buffer, 0, bytemuck::cast_slice(&[*uniforms]));

        let mut pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
            label: Some("Branch Indicator Render Pass"),
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
    pub fn config(&self) -> &BranchIndicatorConfig {
        &self.config
    }

    /// Update the configuration.
    pub fn set_config(&mut self, config: BranchIndicatorConfig) {
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
    fn test_branch_indicator_config_default() {
        let config = BranchIndicatorConfig::default();
        assert!((config.center[0] - 100.0).abs() < f32::EPSILON);
        assert!((config.inner_radius - 6.0).abs() < f32::EPSILON);
        assert!((config.outer_radius - 16.0).abs() < f32::EPSILON);
        assert!((config.branch_count - 6.0).abs() < f32::EPSILON);
        assert!((config.branch_speed - 0.5).abs() < f32::EPSILON);
        assert_eq!(config.quality_level, 2);
    }

    #[test]
    fn test_branch_indicator_uniforms_size() {
        // 5 x 16-byte groups = 80 bytes
        assert_eq!(std::mem::size_of::<BranchIndicatorUniforms>(), 80);
    }

    #[test]
    fn test_branch_indicator_uniforms_alignment() {
        // Must be at least 4-byte aligned (f32)
        assert!(std::mem::align_of::<BranchIndicatorUniforms>() >= 4);
    }
}
