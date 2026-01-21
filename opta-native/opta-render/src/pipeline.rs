//! 2D Render pipeline for UI components.
//!
//! Implements a wgpu render pipeline optimized for TBDR (Tile-Based Deferred Rendering)
//! on Apple Silicon GPUs.

use crate::buffer::Vertex2D;
use wgpu::util::DeviceExt;

/// Uniforms passed to the shader.
///
/// Memory layout must match the WGSL struct exactly (16-byte aligned).
#[repr(C)]
#[derive(Copy, Clone, Debug, bytemuck::Pod, bytemuck::Zeroable)]
pub struct Uniforms {
    /// View-projection matrix for 2D to clip space transformation.
    pub view_proj: [[f32; 4]; 4],
    /// Animation time in seconds.
    pub time: f32,
    /// Padding for 16-byte alignment.
    pub _padding: [f32; 3],
}

impl Default for Uniforms {
    fn default() -> Self {
        Self {
            // Identity matrix
            view_proj: [
                [1.0, 0.0, 0.0, 0.0],
                [0.0, 1.0, 0.0, 0.0],
                [0.0, 0.0, 1.0, 0.0],
                [0.0, 0.0, 0.0, 1.0],
            ],
            time: 0.0,
            _padding: [0.0; 3],
        }
    }
}

impl Uniforms {
    /// Creates a 2D orthographic projection matrix.
    ///
    /// Maps (0, 0) to top-left and (width, height) to bottom-right.
    pub fn orthographic_2d(width: f32, height: f32) -> [[f32; 4]; 4] {
        [
            [2.0 / width, 0.0, 0.0, 0.0],
            [0.0, -2.0 / height, 0.0, 0.0],
            [0.0, 0.0, 1.0, 0.0],
            [-1.0, 1.0, 0.0, 1.0],
        ]
    }
}

/// A 2D render pipeline for UI rendering.
///
/// Uses TBDR-optimized load/store operations for Apple Silicon:
/// - LoadOp::Clear for color (avoids loading tile memory)
/// - StoreOp::Discard for depth (avoids writing depth tiles)
pub struct RenderPipeline2D {
    pipeline: wgpu::RenderPipeline,
    bind_group_layout: wgpu::BindGroupLayout,
    uniform_buffer: wgpu::Buffer,
    bind_group: wgpu::BindGroup,
}

impl RenderPipeline2D {
    /// Creates a new 2D render pipeline.
    ///
    /// # Arguments
    /// * `device` - The wgpu device
    /// * `surface_format` - The texture format of the render target
    pub fn new(device: &wgpu::Device, surface_format: wgpu::TextureFormat) -> Self {
        // Create shader module from embedded WGSL
        let shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("Basic 2D Shader"),
            source: wgpu::ShaderSource::Wgsl(include_str!("../shaders/basic.wgsl").into()),
        });

        // Create uniform buffer
        let uniform_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Uniforms Buffer"),
            contents: bytemuck::cast_slice(&[Uniforms::default()]),
            usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
        });

        // Create bind group layout
        let bind_group_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("Uniforms Bind Group Layout"),
            entries: &[wgpu::BindGroupLayoutEntry {
                binding: 0,
                visibility: wgpu::ShaderStages::VERTEX,
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
            label: Some("Uniforms Bind Group"),
            layout: &bind_group_layout,
            entries: &[wgpu::BindGroupEntry {
                binding: 0,
                resource: uniform_buffer.as_entire_binding(),
            }],
        });

        // Create pipeline layout
        let pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("2D Pipeline Layout"),
            bind_group_layouts: &[&bind_group_layout],
            push_constant_ranges: &[],
        });

        // Create render pipeline
        let pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("2D Render Pipeline"),
            layout: Some(&pipeline_layout),
            vertex: wgpu::VertexState {
                module: &shader,
                entry_point: Some("vs_main"),
                buffers: &[Vertex2D::desc()],
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
                cull_mode: None, // No culling for 2D UI
                unclipped_depth: false,
                polygon_mode: wgpu::PolygonMode::Fill,
                conservative: false,
            },
            depth_stencil: None, // No depth for basic 2D
            multisample: wgpu::MultisampleState {
                count: 1,
                mask: !0,
                alpha_to_coverage_enabled: false,
            },
            multiview: None,
            cache: None,
        });

        Self {
            pipeline,
            bind_group_layout,
            uniform_buffer,
            bind_group,
        }
    }

    /// Updates the uniform buffer with new values.
    pub fn update_uniforms(&self, queue: &wgpu::Queue, uniforms: &Uniforms) {
        queue.write_buffer(&self.uniform_buffer, 0, bytemuck::cast_slice(&[*uniforms]));
    }

    /// Returns a reference to the underlying wgpu render pipeline.
    #[inline]
    pub fn pipeline(&self) -> &wgpu::RenderPipeline {
        &self.pipeline
    }

    /// Returns a reference to the bind group.
    #[inline]
    pub fn bind_group(&self) -> &wgpu::BindGroup {
        &self.bind_group
    }

    /// Returns a reference to the bind group layout.
    #[inline]
    pub fn bind_group_layout(&self) -> &wgpu::BindGroupLayout {
        &self.bind_group_layout
    }

    /// Begins a render pass with TBDR-optimized operations.
    ///
    /// Uses LoadOp::Clear for color to avoid loading tile memory on Apple Silicon.
    pub fn begin_render_pass<'a>(
        &'a self,
        encoder: &'a mut wgpu::CommandEncoder,
        view: &'a wgpu::TextureView,
        clear_color: wgpu::Color,
    ) -> wgpu::RenderPass<'a> {
        let mut render_pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
            label: Some("2D Render Pass"),
            color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                view,
                resolve_target: None,
                ops: wgpu::Operations {
                    // TBDR optimization: Clear avoids loading tile memory
                    load: wgpu::LoadOp::Clear(clear_color),
                    store: wgpu::StoreOp::Store,
                },
            })],
            depth_stencil_attachment: None,
            timestamp_writes: None,
            occlusion_query_set: None,
        });

        render_pass.set_pipeline(&self.pipeline);
        render_pass.set_bind_group(0, &self.bind_group, &[]);

        render_pass
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_uniforms_size() {
        // Uniforms should be 80 bytes (64 for mat4x4 + 4 for time + 12 for padding)
        assert_eq!(std::mem::size_of::<Uniforms>(), 80);
    }

    #[test]
    fn test_uniforms_alignment() {
        // Should be 4-byte aligned (f32 alignment)
        assert_eq!(std::mem::align_of::<Uniforms>(), 4);
    }

    #[test]
    fn test_orthographic_projection() {
        let proj = Uniforms::orthographic_2d(800.0, 600.0);
        // Check scaling factors
        assert!((proj[0][0] - 2.0 / 800.0).abs() < 1e-6);
        assert!((proj[1][1] - (-2.0 / 600.0)).abs() < 1e-6);
    }
}
