//! Plasma visual effect.
//!
//! Creates organic, flowing plasma patterns using multiple sine waves
//! combined with fractal Brownian motion noise.

// Allow precision loss for u32 -> f32 conversions in graphics code
// (width/height values are typically well within f32 precision)
#![allow(clippy::cast_precision_loss)]

use wgpu::util::DeviceExt;

/// Configuration for the plasma effect.
#[derive(Debug, Clone, Copy)]
pub struct PlasmaConfig {
    /// Animation speed multiplier (default: 1.0).
    pub speed: f32,
    /// Pattern scale multiplier (default: 1.0).
    /// Higher values create smaller, more detailed patterns.
    pub scale: f32,
    /// Color palette shift (0.0 to 1.0).
    /// Shifts the hue of the entire color palette.
    pub color_shift: f32,
}

impl Default for PlasmaConfig {
    fn default() -> Self {
        Self {
            speed: 1.0,
            scale: 1.0,
            color_shift: 0.0,
        }
    }
}

/// Uniforms for the plasma shader.
#[repr(C)]
#[derive(Copy, Clone, Debug, bytemuck::Pod, bytemuck::Zeroable)]
struct PlasmaUniforms {
    resolution: [f32; 2],
    time: f32,
    speed: f32,
    scale: f32,
    color_shift: f32,
    _padding: [f32; 2],
}

impl Default for PlasmaUniforms {
    fn default() -> Self {
        Self {
            resolution: [1920.0, 1080.0],
            time: 0.0,
            speed: 1.0,
            scale: 1.0,
            color_shift: 0.0,
            _padding: [0.0; 2],
        }
    }
}

/// Plasma visual effect.
///
/// Renders organic, animated plasma patterns to a texture or directly
/// to the screen.
pub struct PlasmaEffect {
    pipeline: wgpu::RenderPipeline,
    uniform_buffer: wgpu::Buffer,
    bind_group: wgpu::BindGroup,
    config: PlasmaConfig,
    width: u32,
    height: u32,
    time: f32,
}

impl PlasmaEffect {
    /// Embedded plasma shader source.
    const SHADER_SOURCE: &'static str = include_str!("../../shaders/plasma.wgsl");

    /// Create a new plasma effect.
    ///
    /// # Arguments
    /// * `device` - The wgpu device
    /// * `queue` - The wgpu queue (used for initial uniform upload)
    /// * `surface_format` - The texture format to render to
    /// * `width` - Render target width
    /// * `height` - Render target height
    pub fn new(
        device: &wgpu::Device,
        _queue: &wgpu::Queue,
        surface_format: wgpu::TextureFormat,
        width: u32,
        height: u32,
    ) -> Self {
        // Create shader module
        // Note: In production, this would use ShaderLibrary for preprocessing
        let shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("Plasma Shader"),
            source: wgpu::ShaderSource::Wgsl(Self::SHADER_SOURCE.into()),
        });

        // Create uniform buffer
        let uniforms = PlasmaUniforms {
            resolution: [width as f32, height as f32],
            ..Default::default()
        };
        let uniform_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Plasma Uniforms"),
            contents: bytemuck::cast_slice(&[uniforms]),
            usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
        });

        // Create bind group layout
        let bind_group_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("Plasma Bind Group Layout"),
            entries: &[wgpu::BindGroupLayoutEntry {
                binding: 0,
                visibility: wgpu::ShaderStages::VERTEX_FRAGMENT,
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
            label: Some("Plasma Bind Group"),
            layout: &bind_group_layout,
            entries: &[wgpu::BindGroupEntry {
                binding: 0,
                resource: uniform_buffer.as_entire_binding(),
            }],
        });

        // Create pipeline layout
        let pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("Plasma Pipeline Layout"),
            bind_group_layouts: &[&bind_group_layout],
            push_constant_ranges: &[],
        });

        // Create render pipeline
        let pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("Plasma Pipeline"),
            layout: Some(&pipeline_layout),
            vertex: wgpu::VertexState {
                module: &shader,
                entry_point: Some("vs_main"),
                buffers: &[],
                compilation_options: wgpu::PipelineCompilationOptions::default(),
            },
            fragment: Some(wgpu::FragmentState {
                module: &shader,
                entry_point: Some("fs_main"),
                targets: &[Some(wgpu::ColorTargetState {
                    format: surface_format,
                    blend: None,
                    write_mask: wgpu::ColorWrites::ALL,
                })],
                compilation_options: wgpu::PipelineCompilationOptions::default(),
            }),
            primitive: wgpu::PrimitiveState {
                topology: wgpu::PrimitiveTopology::TriangleList,
                strip_index_format: None,
                front_face: wgpu::FrontFace::Ccw,
                cull_mode: None,
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
            pipeline,
            uniform_buffer,
            bind_group,
            config: PlasmaConfig::default(),
            width,
            height,
            time: 0.0,
        }
    }

    /// Set the plasma configuration.
    pub fn set_config(&mut self, config: PlasmaConfig) {
        self.config = config;
    }

    /// Get the current configuration.
    pub fn config(&self) -> &PlasmaConfig {
        &self.config
    }

    /// Update the animation time.
    ///
    /// Call this each frame with the delta time to animate the plasma.
    pub fn update(&mut self, delta_time: f32) {
        self.time += delta_time;
    }

    /// Set the animation time directly.
    pub fn set_time(&mut self, time: f32) {
        self.time = time;
    }

    /// Resize the render target.
    pub fn resize(&mut self, width: u32, height: u32) {
        self.width = width;
        self.height = height;
    }

    /// Render the plasma effect.
    ///
    /// # Arguments
    /// * `queue` - The wgpu queue for uniform updates
    /// * `encoder` - The command encoder
    /// * `view` - The texture view to render to
    pub fn render(
        &self,
        queue: &wgpu::Queue,
        encoder: &mut wgpu::CommandEncoder,
        view: &wgpu::TextureView,
    ) {
        // Update uniforms
        let uniforms = PlasmaUniforms {
            resolution: [self.width as f32, self.height as f32],
            time: self.time,
            speed: self.config.speed,
            scale: self.config.scale,
            color_shift: self.config.color_shift,
            _padding: [0.0; 2],
        };
        queue.write_buffer(&self.uniform_buffer, 0, bytemuck::cast_slice(&[uniforms]));

        // Begin render pass
        let mut render_pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
            label: Some("Plasma Render Pass"),
            color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                view,
                resolve_target: None,
                ops: wgpu::Operations {
                    load: wgpu::LoadOp::Clear(wgpu::Color::BLACK),
                    store: wgpu::StoreOp::Store,
                },
            })],
            depth_stencil_attachment: None,
            timestamp_writes: None,
            occlusion_query_set: None,
        });

        render_pass.set_pipeline(&self.pipeline);
        render_pass.set_bind_group(0, &self.bind_group, &[]);
        render_pass.draw(0..3, 0..1); // Full-screen triangle
    }

    /// Get the current animation time.
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
    fn test_plasma_config_default() {
        let config = PlasmaConfig::default();
        assert!((config.speed - 1.0).abs() < f32::EPSILON);
        assert!((config.scale - 1.0).abs() < f32::EPSILON);
        assert!((config.color_shift - 0.0).abs() < f32::EPSILON);
    }

    #[test]
    fn test_plasma_uniforms_size() {
        // PlasmaUniforms should be 32 bytes (8 floats)
        assert_eq!(std::mem::size_of::<PlasmaUniforms>(), 32);
    }

    #[test]
    fn test_plasma_uniforms_alignment() {
        // Should be 4-byte aligned (f32 alignment)
        assert_eq!(std::mem::align_of::<PlasmaUniforms>(), 4);
    }
}
