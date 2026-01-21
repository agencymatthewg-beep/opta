//! Opta Ring 3D component.
//!
//! The ring is the central visual element of Opta - a glass torus that
//! represents the AI's state through animation, color, and effects.

// Allow precision loss for u32 -> f32 conversions in graphics code
#![allow(clippy::cast_precision_loss)]

use std::f32::consts::TAU;
use wgpu::util::DeviceExt;

/// A 3D vertex for the ring geometry.
///
/// Contains position, normal, and UV attributes for proper lighting and texturing.
#[repr(C)]
#[derive(Copy, Clone, Debug, bytemuck::Pod, bytemuck::Zeroable)]
pub struct RingVertex {
    /// Position in 3D space (x, y, z).
    pub position: [f32; 3],
    /// Surface normal for lighting calculations.
    pub normal: [f32; 3],
    /// Texture coordinates (u, v).
    pub uv: [f32; 2],
}

impl RingVertex {
    /// Creates a new ring vertex.
    pub const fn new(position: [f32; 3], normal: [f32; 3], uv: [f32; 2]) -> Self {
        Self {
            position,
            normal,
            uv,
        }
    }

    /// Returns the vertex buffer layout descriptor for this vertex type.
    pub const fn desc() -> wgpu::VertexBufferLayout<'static> {
        const ATTRIBUTES: [wgpu::VertexAttribute; 3] = [
            // Position at location 0
            wgpu::VertexAttribute {
                offset: 0,
                shader_location: 0,
                format: wgpu::VertexFormat::Float32x3,
            },
            // Normal at location 1
            wgpu::VertexAttribute {
                offset: std::mem::size_of::<[f32; 3]>() as wgpu::BufferAddress,
                shader_location: 1,
                format: wgpu::VertexFormat::Float32x3,
            },
            // UV at location 2
            wgpu::VertexAttribute {
                offset: (std::mem::size_of::<[f32; 3]>() * 2) as wgpu::BufferAddress,
                shader_location: 2,
                format: wgpu::VertexFormat::Float32x2,
            },
        ];

        wgpu::VertexBufferLayout {
            array_stride: std::mem::size_of::<RingVertex>() as wgpu::BufferAddress,
            step_mode: wgpu::VertexStepMode::Vertex,
            attributes: &ATTRIBUTES,
        }
    }
}

/// The current state of the Opta Ring.
///
/// Each state has associated visual characteristics and animations.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum RingState {
    /// Idle state - slow rotation, subtle glow, tilted angle.
    #[default]
    Dormant,
    /// Transitioning from dormant to active - speeding up.
    Waking,
    /// Active listening/ready state - faster rotation, level angle.
    Active,
    /// Processing user input - rapid rotation, plasma effects.
    Processing,
    /// Explosion effect - ring expands with energy burst.
    Exploding,
    /// Recovering from explosion back to dormant.
    Recovering,
}

impl RingState {
    /// Get the target rotation speed for this state (radians per second).
    pub fn rotation_speed(&self) -> f32 {
        match self {
            Self::Dormant => 0.1,
            Self::Waking => 0.5,
            Self::Active => 1.0,
            Self::Processing => 2.0,
            Self::Exploding => 3.0,
            Self::Recovering => 0.3,
        }
    }

    /// Get the target tilt angle for this state (radians).
    pub fn tilt_angle(&self) -> f32 {
        match self {
            Self::Dormant => 0.26,     // ~15 degrees
            Self::Waking => 0.13,      // ~7.5 degrees
            Self::Active => 0.0,       // Level
            Self::Processing => 0.0,   // Level
            Self::Exploding => 0.0,    // Level
            Self::Recovering => 0.13,  // ~7.5 degrees
        }
    }

    /// Get the target energy level for this state (0.0 to 1.0).
    pub fn energy_level(&self) -> f32 {
        match self {
            Self::Dormant => 0.2,
            Self::Waking => 0.5,
            Self::Active => 0.7,
            Self::Processing => 0.9,
            Self::Exploding => 1.0,
            Self::Recovering => 0.4,
        }
    }

    /// Get the transition duration to this state in seconds.
    pub fn transition_duration(&self) -> f32 {
        match self {
            Self::Dormant => 2.0,
            Self::Waking => 0.5,
            Self::Active => 0.3,
            Self::Processing => 0.2,
            Self::Exploding => 0.1,
            Self::Recovering => 1.5,
        }
    }
}

/// Shader uniforms for the ring.
///
/// Packed for 16-byte alignment as required by wgpu.
#[repr(C)]
#[derive(Copy, Clone, Debug, bytemuck::Pod, bytemuck::Zeroable)]
pub struct RingUniforms {
    /// Model transformation matrix (includes rotation and tilt).
    pub model_matrix: [[f32; 4]; 4],
    /// Combined view-projection matrix.
    pub view_proj_matrix: [[f32; 4]; 4],
    /// Current time in seconds.
    pub time: f32,
    /// Energy level (0.0 to 1.0).
    pub energy_level: f32,
    /// Plasma effect intensity (0.0 to 1.0).
    pub plasma_intensity: f32,
    /// Fresnel effect power (higher = sharper edge glow).
    pub fresnel_power: f32,
    /// Current ring rotation angle (radians).
    pub ring_rotation: f32,
    /// Current tilt angle (radians).
    pub tilt_angle: f32,
    /// Index of refraction for glass effect.
    pub ior: f32,
    /// Padding for 16-byte alignment.
    pub _padding: f32,
    /// Glass tint color (RGB).
    pub tint_color: [f32; 3],
    /// Additional padding.
    pub _padding2: f32,
}

impl Default for RingUniforms {
    fn default() -> Self {
        Self {
            model_matrix: [
                [1.0, 0.0, 0.0, 0.0],
                [0.0, 1.0, 0.0, 0.0],
                [0.0, 0.0, 1.0, 0.0],
                [0.0, 0.0, 0.0, 1.0],
            ],
            view_proj_matrix: [
                [1.0, 0.0, 0.0, 0.0],
                [0.0, 1.0, 0.0, 0.0],
                [0.0, 0.0, 1.0, 0.0],
                [0.0, 0.0, 0.0, 1.0],
            ],
            time: 0.0,
            energy_level: 0.2,
            plasma_intensity: 0.0,
            fresnel_power: 3.0,
            ring_rotation: 0.0,
            tilt_angle: 0.26,
            ior: 1.5,
            _padding: 0.0,
            tint_color: [0.4, 0.6, 1.0], // Light blue tint
            _padding2: 0.0,
        }
    }
}

/// Configuration for the Opta Ring geometry and appearance.
#[derive(Debug, Clone)]
pub struct RingConfig {
    /// Major radius of the torus (distance from center to tube center).
    pub major_radius: f32,
    /// Minor radius of the torus (tube radius).
    pub minor_radius: f32,
    /// Number of segments around the major circumference.
    pub major_segments: u32,
    /// Number of segments around the tube.
    pub minor_segments: u32,
    /// Index of refraction for glass effect.
    pub ior: f32,
    /// Glass tint color (RGB).
    pub tint: [f32; 3],
}

impl Default for RingConfig {
    fn default() -> Self {
        Self {
            major_radius: 1.0,
            minor_radius: 0.15,
            major_segments: 64,
            minor_segments: 32,
            ior: 1.5,
            tint: [0.4, 0.6, 1.0], // Light blue
        }
    }
}

/// Generate torus geometry with the given parameters.
///
/// Returns a tuple of (vertices, indices).
pub fn generate_torus_geometry(config: &RingConfig) -> (Vec<RingVertex>, Vec<u32>) {
    let mut vertices = Vec::new();
    let mut indices = Vec::new();

    let major_step = TAU / config.major_segments as f32;
    let minor_step = TAU / config.minor_segments as f32;

    // Generate vertices
    for i in 0..=config.major_segments {
        let theta = i as f32 * major_step;
        let cos_theta = theta.cos();
        let sin_theta = theta.sin();

        for j in 0..=config.minor_segments {
            let phi = j as f32 * minor_step;
            let cos_phi = phi.cos();
            let sin_phi = phi.sin();

            // Position on torus surface
            let x = (config.major_radius + config.minor_radius * cos_phi) * cos_theta;
            let y = config.minor_radius * sin_phi;
            let z = (config.major_radius + config.minor_radius * cos_phi) * sin_theta;

            // Normal vector (pointing outward from tube surface)
            let nx = cos_phi * cos_theta;
            let ny = sin_phi;
            let nz = cos_phi * sin_theta;

            // UV coordinates
            let u = i as f32 / config.major_segments as f32;
            let v = j as f32 / config.minor_segments as f32;

            vertices.push(RingVertex::new([x, y, z], [nx, ny, nz], [u, v]));
        }
    }

    // Generate indices
    let stride = config.minor_segments + 1;
    for i in 0..config.major_segments {
        for j in 0..config.minor_segments {
            let current = i * stride + j;
            let next = (i + 1) * stride + j;

            // First triangle
            indices.push(current);
            indices.push(next);
            indices.push(current + 1);

            // Second triangle
            indices.push(current + 1);
            indices.push(next);
            indices.push(next + 1);
        }
    }

    (vertices, indices)
}

/// Linear interpolation helper.
#[inline]
fn lerp(a: f32, b: f32, t: f32) -> f32 {
    a + (b - a) * t
}

/// The main Opta Ring component.
///
/// Manages the ring's geometry, state, and rendering.
pub struct OptaRing {
    vertex_buffer: wgpu::Buffer,
    index_buffer: wgpu::Buffer,
    index_count: u32,
    uniform_buffer: wgpu::Buffer,
    bind_group: wgpu::BindGroup,
    pipeline: wgpu::RenderPipeline,
    config: RingConfig,
    state: RingState,
    // Animation state
    current_rotation: f32,
    current_tilt: f32,
    current_energy: f32,
    current_plasma: f32,
    target_rotation_speed: f32,
    target_tilt: f32,
    target_energy: f32,
    target_plasma: f32,
    // Timing
    time: f32,
    transition_progress: f32,
}

impl OptaRing {
    /// Embedded ring shader source.
    const SHADER_SOURCE: &'static str = include_str!("../../shaders/ring.wgsl");

    /// Create a new Opta Ring.
    pub fn new(
        device: &wgpu::Device,
        _queue: &wgpu::Queue,
        surface_format: wgpu::TextureFormat,
        config: RingConfig,
    ) -> Self {
        // Generate geometry
        let (vertices, indices) = generate_torus_geometry(&config);
        let index_count = indices.len() as u32;

        // Create vertex buffer
        let vertex_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Ring Vertex Buffer"),
            contents: bytemuck::cast_slice(&vertices),
            usage: wgpu::BufferUsages::VERTEX,
        });

        // Create index buffer
        let index_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Ring Index Buffer"),
            contents: bytemuck::cast_slice(&indices),
            usage: wgpu::BufferUsages::INDEX,
        });

        // Create uniform buffer
        let uniforms = RingUniforms {
            tint_color: config.tint,
            ior: config.ior,
            ..Default::default()
        };
        let uniform_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Ring Uniforms"),
            contents: bytemuck::cast_slice(&[uniforms]),
            usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
        });

        // Create shader module
        let shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("Ring Shader"),
            source: wgpu::ShaderSource::Wgsl(Self::SHADER_SOURCE.into()),
        });

        // Create bind group layout
        let bind_group_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("Ring Bind Group Layout"),
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
            label: Some("Ring Bind Group"),
            layout: &bind_group_layout,
            entries: &[wgpu::BindGroupEntry {
                binding: 0,
                resource: uniform_buffer.as_entire_binding(),
            }],
        });

        // Create pipeline layout
        let pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("Ring Pipeline Layout"),
            bind_group_layouts: &[&bind_group_layout],
            push_constant_ranges: &[],
        });

        // Create render pipeline
        let pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("Ring Pipeline"),
            layout: Some(&pipeline_layout),
            vertex: wgpu::VertexState {
                module: &shader,
                entry_point: Some("vs_main"),
                buffers: &[RingVertex::desc()],
                compilation_options: wgpu::PipelineCompilationOptions::default(),
            },
            fragment: Some(wgpu::FragmentState {
                module: &shader,
                entry_point: Some("fs_main"),
                targets: &[Some(wgpu::ColorTargetState {
                    format: surface_format,
                    // Alpha blending for glass transparency
                    blend: Some(wgpu::BlendState {
                        color: wgpu::BlendComponent {
                            src_factor: wgpu::BlendFactor::SrcAlpha,
                            dst_factor: wgpu::BlendFactor::OneMinusSrcAlpha,
                            operation: wgpu::BlendOperation::Add,
                        },
                        alpha: wgpu::BlendComponent {
                            src_factor: wgpu::BlendFactor::One,
                            dst_factor: wgpu::BlendFactor::OneMinusSrcAlpha,
                            operation: wgpu::BlendOperation::Add,
                        },
                    }),
                    write_mask: wgpu::ColorWrites::ALL,
                })],
                compilation_options: wgpu::PipelineCompilationOptions::default(),
            }),
            primitive: wgpu::PrimitiveState {
                topology: wgpu::PrimitiveTopology::TriangleList,
                strip_index_format: None,
                front_face: wgpu::FrontFace::Ccw,
                // No culling - glass is see-through from both sides
                cull_mode: None,
                unclipped_depth: false,
                polygon_mode: wgpu::PolygonMode::Fill,
                conservative: false,
            },
            depth_stencil: Some(wgpu::DepthStencilState {
                format: wgpu::TextureFormat::Depth32Float,
                depth_write_enabled: true,
                depth_compare: wgpu::CompareFunction::Less,
                stencil: wgpu::StencilState::default(),
                bias: wgpu::DepthBiasState::default(),
            }),
            multisample: wgpu::MultisampleState::default(),
            multiview: None,
            cache: None,
        });

        let state = RingState::default();
        Self {
            vertex_buffer,
            index_buffer,
            index_count,
            uniform_buffer,
            bind_group,
            pipeline,
            config,
            state,
            current_rotation: 0.0,
            current_tilt: state.tilt_angle(),
            current_energy: state.energy_level(),
            current_plasma: 0.0,
            target_rotation_speed: state.rotation_speed(),
            target_tilt: state.tilt_angle(),
            target_energy: state.energy_level(),
            target_plasma: 0.0,
            time: 0.0,
            transition_progress: 1.0,
        }
    }

    /// Set the ring state with smooth transition.
    pub fn set_state(&mut self, state: RingState) {
        if self.state != state {
            self.state = state;
            self.target_rotation_speed = state.rotation_speed();
            self.target_tilt = state.tilt_angle();
            self.target_energy = state.energy_level();
            self.target_plasma = match state {
                RingState::Processing | RingState::Exploding => 1.0,
                _ => 0.0,
            };
            self.transition_progress = 0.0;
        }
    }

    /// Get the current state.
    pub fn state(&self) -> RingState {
        self.state
    }

    /// Get the configuration.
    pub fn config(&self) -> &RingConfig {
        &self.config
    }

    /// Update the ring animation.
    ///
    /// Call this each frame with delta time in seconds.
    pub fn update(&mut self, delta_time: f32) {
        self.time += delta_time;

        // Calculate transition factor (ease-in-out)
        let duration = self.state.transition_duration();
        if self.transition_progress < 1.0 {
            self.transition_progress += delta_time / duration;
            self.transition_progress = self.transition_progress.min(1.0);
        }

        // Smooth step for easing
        let t = self.transition_progress;
        let ease = t * t * (3.0 - 2.0 * t);

        // Update rotation (accumulate based on current speed)
        let current_speed = lerp(
            self.target_rotation_speed * 0.5,
            self.target_rotation_speed,
            ease,
        );
        self.current_rotation += current_speed * delta_time;
        if self.current_rotation > TAU {
            self.current_rotation -= TAU;
        }

        // Interpolate other values
        self.current_tilt = lerp(self.current_tilt, self.target_tilt, ease * 0.1);
        self.current_energy = lerp(self.current_energy, self.target_energy, ease * 0.1);
        self.current_plasma = lerp(self.current_plasma, self.target_plasma, ease * 0.15);
    }

    /// Build the model matrix from current rotation and tilt.
    fn build_model_matrix(&self) -> [[f32; 4]; 4] {
        // Y-axis rotation matrix
        let cos_r = self.current_rotation.cos();
        let sin_r = self.current_rotation.sin();
        let rotation_y = [
            [cos_r, 0.0, sin_r, 0.0],
            [0.0, 1.0, 0.0, 0.0],
            [-sin_r, 0.0, cos_r, 0.0],
            [0.0, 0.0, 0.0, 1.0],
        ];

        // X-axis tilt matrix
        let cos_t = self.current_tilt.cos();
        let sin_t = self.current_tilt.sin();
        let tilt_x = [
            [1.0, 0.0, 0.0, 0.0],
            [0.0, cos_t, -sin_t, 0.0],
            [0.0, sin_t, cos_t, 0.0],
            [0.0, 0.0, 0.0, 1.0],
        ];

        // Multiply tilt * rotation
        let mut result = [[0.0f32; 4]; 4];
        for i in 0..4 {
            for j in 0..4 {
                result[i][j] = tilt_x[i][0] * rotation_y[0][j]
                    + tilt_x[i][1] * rotation_y[1][j]
                    + tilt_x[i][2] * rotation_y[2][j]
                    + tilt_x[i][3] * rotation_y[3][j];
            }
        }
        result
    }

    /// Render the ring.
    pub fn render(
        &self,
        queue: &wgpu::Queue,
        encoder: &mut wgpu::CommandEncoder,
        color_view: &wgpu::TextureView,
        depth_view: &wgpu::TextureView,
        view_proj_matrix: [[f32; 4]; 4],
    ) {
        // Update uniforms
        let uniforms = RingUniforms {
            model_matrix: self.build_model_matrix(),
            view_proj_matrix,
            time: self.time,
            energy_level: self.current_energy,
            plasma_intensity: self.current_plasma,
            fresnel_power: 3.0,
            ring_rotation: self.current_rotation,
            tilt_angle: self.current_tilt,
            ior: self.config.ior,
            _padding: 0.0,
            tint_color: self.config.tint,
            _padding2: 0.0,
        };
        queue.write_buffer(&self.uniform_buffer, 0, bytemuck::cast_slice(&[uniforms]));

        // Begin render pass
        let mut render_pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
            label: Some("Ring Render Pass"),
            color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                view: color_view,
                resolve_target: None,
                ops: wgpu::Operations {
                    load: wgpu::LoadOp::Load,
                    store: wgpu::StoreOp::Store,
                },
            })],
            depth_stencil_attachment: Some(wgpu::RenderPassDepthStencilAttachment {
                view: depth_view,
                depth_ops: Some(wgpu::Operations {
                    load: wgpu::LoadOp::Load,
                    store: wgpu::StoreOp::Store,
                }),
                stencil_ops: None,
            }),
            timestamp_writes: None,
            occlusion_query_set: None,
        });

        render_pass.set_pipeline(&self.pipeline);
        render_pass.set_bind_group(0, &self.bind_group, &[]);
        render_pass.set_vertex_buffer(0, self.vertex_buffer.slice(..));
        render_pass.set_index_buffer(self.index_buffer.slice(..), wgpu::IndexFormat::Uint32);
        render_pass.draw_indexed(0..self.index_count, 0, 0..1);
    }

    /// Get the current time.
    pub fn time(&self) -> f32 {
        self.time
    }

    /// Get the current energy level.
    pub fn energy_level(&self) -> f32 {
        self.current_energy
    }

    /// Get the current plasma intensity.
    pub fn plasma_intensity(&self) -> f32 {
        self.current_plasma
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::f32::consts::PI;

    #[test]
    fn test_ring_vertex_size() {
        // RingVertex should be 32 bytes (3 + 3 + 2 floats = 8 floats * 4 bytes)
        assert_eq!(std::mem::size_of::<RingVertex>(), 32);
    }

    #[test]
    fn test_ring_vertex_alignment() {
        // Should be 4-byte aligned (f32 alignment)
        assert_eq!(std::mem::align_of::<RingVertex>(), 4);
    }

    #[test]
    fn test_ring_uniforms_size() {
        // RingUniforms should be properly aligned for GPU
        // 2 mat4x4 (128 bytes) + 12 floats (48 bytes) = 176 bytes
        let size = std::mem::size_of::<RingUniforms>();
        assert_eq!(size, 176);
    }

    #[test]
    fn test_ring_config_default() {
        let config = RingConfig::default();
        assert!((config.major_radius - 1.0).abs() < f32::EPSILON);
        assert!((config.minor_radius - 0.15).abs() < f32::EPSILON);
        assert_eq!(config.major_segments, 64);
        assert_eq!(config.minor_segments, 32);
        assert!((config.ior - 1.5).abs() < f32::EPSILON);
    }

    #[test]
    fn test_ring_state_values() {
        // Test that all states have reasonable values
        let states = [
            RingState::Dormant,
            RingState::Waking,
            RingState::Active,
            RingState::Processing,
            RingState::Exploding,
            RingState::Recovering,
        ];

        for state in states {
            let speed = state.rotation_speed();
            let tilt = state.tilt_angle();
            let energy = state.energy_level();
            let duration = state.transition_duration();

            assert!(speed >= 0.0 && speed <= 10.0, "Invalid speed for {:?}", state);
            assert!(
                tilt >= 0.0 && tilt <= PI,
                "Invalid tilt for {:?}",
                state
            );
            assert!(
                energy >= 0.0 && energy <= 1.0,
                "Invalid energy for {:?}",
                state
            );
            assert!(
                duration > 0.0 && duration <= 10.0,
                "Invalid duration for {:?}",
                state
            );
        }
    }

    #[test]
    fn test_generate_torus_geometry() {
        let config = RingConfig {
            major_radius: 1.0,
            minor_radius: 0.1,
            major_segments: 8,
            minor_segments: 6,
            ior: 1.5,
            tint: [1.0, 1.0, 1.0],
        };

        let (vertices, indices) = generate_torus_geometry(&config);

        // Check vertex count: (major_segments + 1) * (minor_segments + 1)
        let expected_vertices = (config.major_segments + 1) * (config.minor_segments + 1);
        assert_eq!(
            vertices.len(),
            expected_vertices as usize,
            "Unexpected vertex count"
        );

        // Check index count: major_segments * minor_segments * 6 (2 triangles * 3 indices)
        let expected_indices = config.major_segments * config.minor_segments * 6;
        assert_eq!(
            indices.len(),
            expected_indices as usize,
            "Unexpected index count"
        );

        // Check that normals are normalized
        for vertex in &vertices {
            let len = (vertex.normal[0].powi(2)
                + vertex.normal[1].powi(2)
                + vertex.normal[2].powi(2))
            .sqrt();
            assert!(
                (len - 1.0).abs() < 0.001,
                "Normal not normalized: {}",
                len
            );
        }

        // Check UV ranges
        for vertex in &vertices {
            assert!(
                vertex.uv[0] >= 0.0 && vertex.uv[0] <= 1.0,
                "U out of range: {}",
                vertex.uv[0]
            );
            assert!(
                vertex.uv[1] >= 0.0 && vertex.uv[1] <= 1.0,
                "V out of range: {}",
                vertex.uv[1]
            );
        }
    }

    #[test]
    fn test_lerp() {
        assert!((lerp(0.0, 10.0, 0.0) - 0.0).abs() < f32::EPSILON);
        assert!((lerp(0.0, 10.0, 1.0) - 10.0).abs() < f32::EPSILON);
        assert!((lerp(0.0, 10.0, 0.5) - 5.0).abs() < f32::EPSILON);
        assert!((lerp(5.0, 15.0, 0.25) - 7.5).abs() < f32::EPSILON);
    }
}
