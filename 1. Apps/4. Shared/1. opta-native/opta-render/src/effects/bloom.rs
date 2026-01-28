//! Bloom post-processing effect.
//!
//! Extracts bright areas from a scene and applies a blurred glow effect.
//! Uses a three-pass approach:
//! 1. Threshold pass: Extract bright areas
//! 2. Blur pass: Gaussian blur (horizontal + vertical)
//! 3. Composite pass: Combine original with bloom

// Allow precision loss for u32 -> f32 conversions in graphics code
// (width/height values are typically well within f32 precision)
#![allow(clippy::cast_precision_loss)]

use wgpu::util::DeviceExt;

/// Configuration for the bloom effect.
#[derive(Debug, Clone, Copy)]
pub struct BloomConfig {
    /// Luminance threshold for bloom extraction (default: 0.8).
    /// Pixels brighter than this will contribute to bloom.
    pub threshold: f32,
    /// Soft knee width for smooth threshold transition (default: 0.5).
    pub knee: f32,
    /// Bloom intensity multiplier (default: 1.0).
    pub intensity: f32,
    /// Whether to apply tone mapping after compositing (default: true).
    pub apply_tonemapping: bool,
    /// Number of blur passes (default: 2).
    /// More passes create a wider, softer bloom.
    pub blur_passes: u32,
}

impl Default for BloomConfig {
    fn default() -> Self {
        Self {
            threshold: 0.8,
            knee: 0.5,
            intensity: 1.0,
            apply_tonemapping: true,
            blur_passes: 2,
        }
    }
}

/// Uniforms for the threshold pass.
#[repr(C)]
#[derive(Copy, Clone, Debug, bytemuck::Pod, bytemuck::Zeroable)]
struct ThresholdUniforms {
    threshold: f32,
    knee: f32,
    _padding: [f32; 2],
}

/// Uniforms for the blur pass.
#[repr(C)]
#[derive(Copy, Clone, Debug, bytemuck::Pod, bytemuck::Zeroable)]
struct BlurUniforms {
    direction: [f32; 2],
    texel_size: [f32; 2],
}

/// Uniforms for the composite pass.
#[repr(C)]
#[derive(Copy, Clone, Debug, bytemuck::Pod, bytemuck::Zeroable)]
struct CompositeUniforms {
    intensity: f32,
    apply_tonemapping: f32,
    _padding: [f32; 2],
}

/// Bloom post-processing effect.
///
/// Applies a configurable bloom/glow effect to bright areas of the image.
pub struct BloomEffect {
    // Threshold pass resources
    threshold_pipeline: wgpu::RenderPipeline,
    threshold_uniform_buffer: wgpu::Buffer,
    threshold_bind_group_layout: wgpu::BindGroupLayout,

    // Blur pass resources
    blur_pipeline: wgpu::RenderPipeline,
    blur_uniform_buffer: wgpu::Buffer,
    blur_bind_group_layout: wgpu::BindGroupLayout,

    // Composite pass resources
    composite_pipeline: wgpu::RenderPipeline,
    composite_uniform_buffer: wgpu::Buffer,
    composite_bind_group_layout: wgpu::BindGroupLayout,

    // Intermediate textures
    threshold_texture: wgpu::Texture,
    threshold_view: wgpu::TextureView,
    blur_texture_a: wgpu::Texture,
    blur_view_a: wgpu::TextureView,
    blur_texture_b: wgpu::Texture,
    blur_view_b: wgpu::TextureView,

    // Sampler
    sampler: wgpu::Sampler,

    // Configuration
    config: BloomConfig,
    width: u32,
    height: u32,
    surface_format: wgpu::TextureFormat,
}

impl BloomEffect {
    /// Embedded shader sources.
    const THRESHOLD_SHADER: &'static str = include_str!("../../shaders/bloom_threshold.wgsl");
    const BLUR_SHADER: &'static str = include_str!("../../shaders/blur.wgsl");
    const COMPOSITE_SHADER: &'static str = include_str!("../../shaders/bloom_composite.wgsl");

    /// Create a new bloom effect.
    ///
    /// # Arguments
    /// * `device` - The wgpu device
    /// * `surface_format` - The texture format for rendering
    /// * `width` - Render target width
    /// * `height` - Render target height
    #[allow(clippy::too_many_lines)]
    pub fn new(
        device: &wgpu::Device,
        surface_format: wgpu::TextureFormat,
        width: u32,
        height: u32,
    ) -> Self {
        // Create sampler for texture sampling
        let sampler = device.create_sampler(&wgpu::SamplerDescriptor {
            label: Some("Bloom Sampler"),
            address_mode_u: wgpu::AddressMode::ClampToEdge,
            address_mode_v: wgpu::AddressMode::ClampToEdge,
            address_mode_w: wgpu::AddressMode::ClampToEdge,
            mag_filter: wgpu::FilterMode::Linear,
            min_filter: wgpu::FilterMode::Linear,
            mipmap_filter: wgpu::FilterMode::Nearest,
            ..Default::default()
        });

        // Create intermediate textures
        let texture_desc = wgpu::TextureDescriptor {
            label: Some("Bloom Texture"),
            size: wgpu::Extent3d {
                width,
                height,
                depth_or_array_layers: 1,
            },
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format: surface_format,
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT | wgpu::TextureUsages::TEXTURE_BINDING,
            view_formats: &[],
        };

        let threshold_texture = device.create_texture(&wgpu::TextureDescriptor {
            label: Some("Bloom Threshold Texture"),
            ..texture_desc
        });
        let threshold_view = threshold_texture.create_view(&wgpu::TextureViewDescriptor::default());

        let blur_texture_a = device.create_texture(&wgpu::TextureDescriptor {
            label: Some("Bloom Blur A"),
            ..texture_desc
        });
        let blur_view_a = blur_texture_a.create_view(&wgpu::TextureViewDescriptor::default());

        let blur_texture_b = device.create_texture(&wgpu::TextureDescriptor {
            label: Some("Bloom Blur B"),
            ..texture_desc
        });
        let blur_view_b = blur_texture_b.create_view(&wgpu::TextureViewDescriptor::default());

        // Create threshold pass resources
        let threshold_shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("Bloom Threshold Shader"),
            source: wgpu::ShaderSource::Wgsl(Self::THRESHOLD_SHADER.into()),
        });

        let threshold_uniform_buffer =
            device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
                label: Some("Threshold Uniforms"),
                contents: bytemuck::cast_slice(&[ThresholdUniforms {
                    threshold: 0.8,
                    knee: 0.5,
                    _padding: [0.0; 2],
                }]),
                usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
            });

        let threshold_bind_group_layout =
            device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
                label: Some("Threshold Bind Group Layout"),
                entries: &[
                    wgpu::BindGroupLayoutEntry {
                        binding: 0,
                        visibility: wgpu::ShaderStages::FRAGMENT,
                        ty: wgpu::BindingType::Buffer {
                            ty: wgpu::BufferBindingType::Uniform,
                            has_dynamic_offset: false,
                            min_binding_size: None,
                        },
                        count: None,
                    },
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
                    wgpu::BindGroupLayoutEntry {
                        binding: 2,
                        visibility: wgpu::ShaderStages::FRAGMENT,
                        ty: wgpu::BindingType::Sampler(wgpu::SamplerBindingType::Filtering),
                        count: None,
                    },
                ],
            });

        let threshold_pipeline_layout =
            device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
                label: Some("Threshold Pipeline Layout"),
                bind_group_layouts: &[&threshold_bind_group_layout],
                push_constant_ranges: &[],
            });

        let threshold_pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("Threshold Pipeline"),
            layout: Some(&threshold_pipeline_layout),
            vertex: wgpu::VertexState {
                module: &threshold_shader,
                entry_point: Some("vs_main"),
                buffers: &[],
                compilation_options: wgpu::PipelineCompilationOptions::default(),
            },
            fragment: Some(wgpu::FragmentState {
                module: &threshold_shader,
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
                ..Default::default()
            },
            depth_stencil: None,
            multisample: wgpu::MultisampleState::default(),
            multiview: None,
            cache: None,
        });

        // Create blur pass resources
        let blur_shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("Blur Shader"),
            source: wgpu::ShaderSource::Wgsl(Self::BLUR_SHADER.into()),
        });

        let blur_uniform_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Blur Uniforms"),
            contents: bytemuck::cast_slice(&[BlurUniforms {
                direction: [1.0, 0.0],
                texel_size: [1.0 / width as f32, 1.0 / height as f32],
            }]),
            usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
        });

        let blur_bind_group_layout =
            device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
                label: Some("Blur Bind Group Layout"),
                entries: &[
                    wgpu::BindGroupLayoutEntry {
                        binding: 0,
                        visibility: wgpu::ShaderStages::FRAGMENT,
                        ty: wgpu::BindingType::Buffer {
                            ty: wgpu::BufferBindingType::Uniform,
                            has_dynamic_offset: false,
                            min_binding_size: None,
                        },
                        count: None,
                    },
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
                    wgpu::BindGroupLayoutEntry {
                        binding: 2,
                        visibility: wgpu::ShaderStages::FRAGMENT,
                        ty: wgpu::BindingType::Sampler(wgpu::SamplerBindingType::Filtering),
                        count: None,
                    },
                ],
            });

        let blur_pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("Blur Pipeline Layout"),
            bind_group_layouts: &[&blur_bind_group_layout],
            push_constant_ranges: &[],
        });

        let blur_pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("Blur Pipeline"),
            layout: Some(&blur_pipeline_layout),
            vertex: wgpu::VertexState {
                module: &blur_shader,
                entry_point: Some("vs_main"),
                buffers: &[],
                compilation_options: wgpu::PipelineCompilationOptions::default(),
            },
            fragment: Some(wgpu::FragmentState {
                module: &blur_shader,
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
                ..Default::default()
            },
            depth_stencil: None,
            multisample: wgpu::MultisampleState::default(),
            multiview: None,
            cache: None,
        });

        // Create composite pass resources
        let composite_shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("Bloom Composite Shader"),
            source: wgpu::ShaderSource::Wgsl(Self::COMPOSITE_SHADER.into()),
        });

        let composite_uniform_buffer =
            device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
                label: Some("Composite Uniforms"),
                contents: bytemuck::cast_slice(&[CompositeUniforms {
                    intensity: 1.0,
                    apply_tonemapping: 1.0,
                    _padding: [0.0; 2],
                }]),
                usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
            });

        let composite_bind_group_layout =
            device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
                label: Some("Composite Bind Group Layout"),
                entries: &[
                    wgpu::BindGroupLayoutEntry {
                        binding: 0,
                        visibility: wgpu::ShaderStages::FRAGMENT,
                        ty: wgpu::BindingType::Buffer {
                            ty: wgpu::BufferBindingType::Uniform,
                            has_dynamic_offset: false,
                            min_binding_size: None,
                        },
                        count: None,
                    },
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
                    wgpu::BindGroupLayoutEntry {
                        binding: 2,
                        visibility: wgpu::ShaderStages::FRAGMENT,
                        ty: wgpu::BindingType::Texture {
                            sample_type: wgpu::TextureSampleType::Float { filterable: true },
                            view_dimension: wgpu::TextureViewDimension::D2,
                            multisampled: false,
                        },
                        count: None,
                    },
                    wgpu::BindGroupLayoutEntry {
                        binding: 3,
                        visibility: wgpu::ShaderStages::FRAGMENT,
                        ty: wgpu::BindingType::Sampler(wgpu::SamplerBindingType::Filtering),
                        count: None,
                    },
                ],
            });

        let composite_pipeline_layout =
            device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
                label: Some("Composite Pipeline Layout"),
                bind_group_layouts: &[&composite_bind_group_layout],
                push_constant_ranges: &[],
            });

        let composite_pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("Composite Pipeline"),
            layout: Some(&composite_pipeline_layout),
            vertex: wgpu::VertexState {
                module: &composite_shader,
                entry_point: Some("vs_main"),
                buffers: &[],
                compilation_options: wgpu::PipelineCompilationOptions::default(),
            },
            fragment: Some(wgpu::FragmentState {
                module: &composite_shader,
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
                ..Default::default()
            },
            depth_stencil: None,
            multisample: wgpu::MultisampleState::default(),
            multiview: None,
            cache: None,
        });

        Self {
            threshold_pipeline,
            threshold_uniform_buffer,
            threshold_bind_group_layout,
            blur_pipeline,
            blur_uniform_buffer,
            blur_bind_group_layout,
            composite_pipeline,
            composite_uniform_buffer,
            composite_bind_group_layout,
            threshold_texture,
            threshold_view,
            blur_texture_a,
            blur_view_a,
            blur_texture_b,
            blur_view_b,
            sampler,
            config: BloomConfig::default(),
            width,
            height,
            surface_format,
        }
    }

    /// Set the bloom configuration.
    pub fn set_config(&mut self, config: BloomConfig) {
        self.config = config;
    }

    /// Get the current configuration.
    pub fn config(&self) -> &BloomConfig {
        &self.config
    }

    /// Resize the intermediate textures.
    ///
    /// Call this when the render target size changes.
    pub fn resize(&mut self, device: &wgpu::Device, width: u32, height: u32) {
        self.width = width;
        self.height = height;

        let texture_desc = wgpu::TextureDescriptor {
            label: Some("Bloom Texture"),
            size: wgpu::Extent3d {
                width,
                height,
                depth_or_array_layers: 1,
            },
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format: self.surface_format,
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT | wgpu::TextureUsages::TEXTURE_BINDING,
            view_formats: &[],
        };

        self.threshold_texture = device.create_texture(&wgpu::TextureDescriptor {
            label: Some("Bloom Threshold Texture"),
            ..texture_desc
        });
        self.threshold_view = self
            .threshold_texture
            .create_view(&wgpu::TextureViewDescriptor::default());

        self.blur_texture_a = device.create_texture(&wgpu::TextureDescriptor {
            label: Some("Bloom Blur A"),
            ..texture_desc
        });
        self.blur_view_a = self
            .blur_texture_a
            .create_view(&wgpu::TextureViewDescriptor::default());

        self.blur_texture_b = device.create_texture(&wgpu::TextureDescriptor {
            label: Some("Bloom Blur B"),
            ..texture_desc
        });
        self.blur_view_b = self
            .blur_texture_b
            .create_view(&wgpu::TextureViewDescriptor::default());
    }

    /// Apply the bloom effect.
    ///
    /// # Arguments
    /// * `device` - The wgpu device (for creating bind groups)
    /// * `queue` - The wgpu queue (for uniform updates)
    /// * `encoder` - The command encoder
    /// * `input_view` - The source texture view (scene to apply bloom to)
    /// * `output_view` - The destination texture view (final result)
    #[allow(clippy::too_many_lines)]
    pub fn apply(
        &self,
        device: &wgpu::Device,
        queue: &wgpu::Queue,
        encoder: &mut wgpu::CommandEncoder,
        input_view: &wgpu::TextureView,
        output_view: &wgpu::TextureView,
    ) {
        // Update threshold uniforms
        queue.write_buffer(
            &self.threshold_uniform_buffer,
            0,
            bytemuck::cast_slice(&[ThresholdUniforms {
                threshold: self.config.threshold,
                knee: self.config.knee,
                _padding: [0.0; 2],
            }]),
        );

        // Update composite uniforms
        queue.write_buffer(
            &self.composite_uniform_buffer,
            0,
            bytemuck::cast_slice(&[CompositeUniforms {
                intensity: self.config.intensity,
                apply_tonemapping: if self.config.apply_tonemapping {
                    1.0
                } else {
                    0.0
                },
                _padding: [0.0; 2],
            }]),
        );

        // Pass 1: Threshold extraction
        let threshold_bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("Threshold Bind Group"),
            layout: &self.threshold_bind_group_layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: self.threshold_uniform_buffer.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: wgpu::BindingResource::TextureView(input_view),
                },
                wgpu::BindGroupEntry {
                    binding: 2,
                    resource: wgpu::BindingResource::Sampler(&self.sampler),
                },
            ],
        });

        {
            let mut pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("Bloom Threshold Pass"),
                color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                    view: &self.threshold_view,
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
            pass.set_pipeline(&self.threshold_pipeline);
            pass.set_bind_group(0, &threshold_bind_group, &[]);
            pass.draw(0..3, 0..1);
        }

        // Pass 2: Blur passes (ping-pong between textures)
        let texel_size = [1.0 / self.width as f32, 1.0 / self.height as f32];

        // Copy threshold to blur_a first
        let mut source_view = &self.threshold_view;
        let mut dest_view = &self.blur_view_a;
        let mut use_a = true;

        for pass_idx in 0..(self.config.blur_passes * 2) {
            let direction = if pass_idx % 2 == 0 {
                [1.0, 0.0] // Horizontal
            } else {
                [0.0, 1.0] // Vertical
            };

            queue.write_buffer(
                &self.blur_uniform_buffer,
                0,
                bytemuck::cast_slice(&[BlurUniforms {
                    direction,
                    texel_size,
                }]),
            );

            let blur_bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
                label: Some("Blur Bind Group"),
                layout: &self.blur_bind_group_layout,
                entries: &[
                    wgpu::BindGroupEntry {
                        binding: 0,
                        resource: self.blur_uniform_buffer.as_entire_binding(),
                    },
                    wgpu::BindGroupEntry {
                        binding: 1,
                        resource: wgpu::BindingResource::TextureView(source_view),
                    },
                    wgpu::BindGroupEntry {
                        binding: 2,
                        resource: wgpu::BindingResource::Sampler(&self.sampler),
                    },
                ],
            });

            {
                let mut pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                    label: Some("Bloom Blur Pass"),
                    color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                        view: dest_view,
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
                pass.set_pipeline(&self.blur_pipeline);
                pass.set_bind_group(0, &blur_bind_group, &[]);
                pass.draw(0..3, 0..1);
            }

            // Swap source and destination
            if use_a {
                source_view = &self.blur_view_a;
                dest_view = &self.blur_view_b;
            } else {
                source_view = &self.blur_view_b;
                dest_view = &self.blur_view_a;
            }
            use_a = !use_a;
        }

        // Pass 3: Composite
        // Source view now contains the final blurred result
        let composite_bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("Composite Bind Group"),
            layout: &self.composite_bind_group_layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: self.composite_uniform_buffer.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: wgpu::BindingResource::TextureView(input_view),
                },
                wgpu::BindGroupEntry {
                    binding: 2,
                    resource: wgpu::BindingResource::TextureView(source_view),
                },
                wgpu::BindGroupEntry {
                    binding: 3,
                    resource: wgpu::BindingResource::Sampler(&self.sampler),
                },
            ],
        });

        {
            let mut pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("Bloom Composite Pass"),
                color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                    view: output_view,
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
            pass.set_pipeline(&self.composite_pipeline);
            pass.set_bind_group(0, &composite_bind_group, &[]);
            pass.draw(0..3, 0..1);
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
    fn test_bloom_config_default() {
        let config = BloomConfig::default();
        assert!((config.threshold - 0.8).abs() < f32::EPSILON);
        assert!((config.knee - 0.5).abs() < f32::EPSILON);
        assert!((config.intensity - 1.0).abs() < f32::EPSILON);
        assert!(config.apply_tonemapping);
        assert_eq!(config.blur_passes, 2);
    }

    #[test]
    fn test_threshold_uniforms_size() {
        assert_eq!(std::mem::size_of::<ThresholdUniforms>(), 16);
    }

    #[test]
    fn test_blur_uniforms_size() {
        assert_eq!(std::mem::size_of::<BlurUniforms>(), 16);
    }

    #[test]
    fn test_composite_uniforms_size() {
        assert_eq!(std::mem::size_of::<CompositeUniforms>(), 16);
    }
}
