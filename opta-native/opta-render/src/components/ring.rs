//! Opta Ring 3D component.
//!
//! The ring is the central visual element of Opta - an obsidian torus that
//! represents the AI's state through animation, Cook-Torrance reflection,
//! and subsurface emission effects.

// Allow precision loss for u32 -> f32 conversions in graphics code
#![allow(clippy::cast_precision_loss)]

use std::f32::consts::TAU;
use wgpu::util::DeviceExt;

/// Quality level for ring rendering.
///
/// Higher quality levels use more geometry segments for smoother curves
/// and enable additional visual effects.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum RingQualityLevel {
    /// Low quality - 32x16 segments, minimal effects.
    /// Suitable for low-power devices or background rendering.
    Low,
    /// Medium quality - 64x32 segments, standard effects.
    /// Default quality level for most devices.
    #[default]
    Medium,
    /// High quality - 128x64 segments, enhanced effects.
    /// For high-end devices with ProMotion displays.
    High,
    /// Ultra quality - 256x128 segments, all effects enabled.
    /// For maximum visual fidelity on powerful GPUs.
    Ultra,
}

impl RingQualityLevel {
    /// Get the segment multiplier for this quality level.
    ///
    /// This multiplier is applied to base segment counts.
    pub fn segment_multiplier(&self) -> f32 {
        match self {
            Self::Low => 0.5,
            Self::Medium => 1.0,
            Self::High => 2.0,
            Self::Ultra => 4.0,
        }
    }

    /// Get base major segments for this quality level.
    pub fn major_segments(&self) -> u32 {
        match self {
            Self::Low => 32,
            Self::Medium => 64,
            Self::High => 128,
            Self::Ultra => 256,
        }
    }

    /// Get base minor segments for this quality level.
    pub fn minor_segments(&self) -> u32 {
        match self {
            Self::Low => 16,
            Self::Medium => 32,
            Self::High => 64,
            Self::Ultra => 128,
        }
    }

    /// Convert from u32 quality level value.
    pub fn from_u32(value: u32) -> Self {
        match value {
            0 => Self::Low,
            1 => Self::Medium,
            2 => Self::High,
            _ => Self::Ultra,
        }
    }

    /// Convert to u32 for FFI.
    pub fn as_u32(&self) -> u32 {
        match self {
            Self::Low => 0,
            Self::Medium => 1,
            Self::High => 2,
            Self::Ultra => 3,
        }
    }
}

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
/// Uses obsidian material properties (roughness, emission, base_color).
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
    /// Surface roughness for obsidian (0.03 = near-mirror polished).
    pub roughness: f32,
    /// Emission intensity for energy visibility through obsidian.
    pub emission_intensity: f32,
    /// Near-black obsidian base color (RGB).
    pub base_color: [f32; 3],
    /// Padding for 16-byte alignment.
    pub _padding: f32,
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
            roughness: 0.03,             // Near-mirror polished obsidian
            emission_intensity: 0.0,     // No emission by default
            base_color: [0.02, 0.02, 0.03], // Near-black obsidian
            _padding: 0.0,
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
    /// Surface roughness for obsidian (0.03 = near-mirror polished).
    pub roughness: f32,
    /// Near-black obsidian base color (RGB).
    pub base_color: [f32; 3],
    /// Energy color for subsurface emission (Electric Violet #8B5CF6).
    pub energy_color: [f32; 3],
    /// Quality level for rendering.
    pub quality_level: RingQualityLevel,
}

impl Default for RingConfig {
    fn default() -> Self {
        let quality = RingQualityLevel::default();
        Self {
            major_radius: 1.0,
            minor_radius: 0.15,
            major_segments: quality.major_segments(),
            minor_segments: quality.minor_segments(),
            roughness: 0.03,                       // Near-mirror polished obsidian
            base_color: [0.02, 0.02, 0.03],        // Near-black obsidian
            energy_color: [0.545, 0.361, 0.965],   // Electric Violet #8B5CF6
            quality_level: quality,
        }
    }
}

impl RingConfig {
    /// Create a new configuration with the specified quality level.
    ///
    /// Segment counts are automatically set based on quality.
    pub fn with_quality(quality: RingQualityLevel) -> Self {
        Self {
            major_radius: 1.0,
            minor_radius: 0.15,
            major_segments: quality.major_segments(),
            minor_segments: quality.minor_segments(),
            roughness: 0.03,
            base_color: [0.02, 0.02, 0.03],
            energy_color: [0.545, 0.361, 0.965],
            quality_level: quality,
        }
    }

    /// Set the quality level and update segment counts accordingly.
    pub fn set_quality(&mut self, quality: RingQualityLevel) {
        self.quality_level = quality;
        self.major_segments = quality.major_segments();
        self.minor_segments = quality.minor_segments();
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

// =============================================================================
// Spring Physics System
// =============================================================================

/// Spring physics configuration for natural motion.
///
/// Based on damped harmonic oscillator model for smooth, responsive animations.
#[derive(Debug, Clone, Copy)]
pub struct SpringConfig {
    /// Stiffness coefficient (higher = faster response).
    /// Typical range: 100-500 for UI animations.
    pub stiffness: f32,
    /// Damping coefficient (higher = less oscillation).
    /// Critical damping = 2 * sqrt(stiffness * mass).
    pub damping: f32,
    /// Mass of the simulated object (affects momentum).
    pub mass: f32,
}

impl Default for SpringConfig {
    fn default() -> Self {
        Self {
            stiffness: 200.0,
            damping: 20.0,
            mass: 1.0,
        }
    }
}

impl SpringConfig {
    /// Create a snappy spring (quick response, minimal overshoot).
    pub fn snappy() -> Self {
        Self {
            stiffness: 400.0,
            damping: 30.0,
            mass: 1.0,
        }
    }

    /// Create a bouncy spring (slower, more oscillation).
    pub fn bouncy() -> Self {
        Self {
            stiffness: 150.0,
            damping: 10.0,
            mass: 1.0,
        }
    }

    /// Create a gentle spring (slow, smooth motion).
    pub fn gentle() -> Self {
        Self {
            stiffness: 100.0,
            damping: 15.0,
            mass: 1.0,
        }
    }

    /// Create a critically damped spring (no overshoot).
    pub fn critically_damped(stiffness: f32) -> Self {
        let mass = 1.0;
        let critical_damping = 2.0 * (stiffness * mass).sqrt();
        Self {
            stiffness,
            damping: critical_damping,
            mass,
        }
    }

    /// Calculate the angular frequency (omega).
    ///
    /// Used internally for spring dynamics calculations.
    #[inline]
    #[allow(dead_code)]
    pub fn omega(&self) -> f32 {
        (self.stiffness / self.mass).sqrt()
    }

    /// Calculate the damping ratio (zeta).
    ///
    /// - < 1.0: Under-damped (oscillates)
    /// - = 1.0: Critically damped (fastest without oscillation)
    /// - > 1.0: Over-damped (slow, no oscillation)
    #[inline]
    pub fn damping_ratio(&self) -> f32 {
        self.damping / (2.0 * (self.stiffness * self.mass).sqrt())
    }
}

/// A single spring-animated value with velocity tracking.
#[derive(Debug, Clone, Copy)]
pub struct SpringValue {
    /// Current position.
    pub value: f32,
    /// Current velocity.
    pub velocity: f32,
    /// Target position.
    pub target: f32,
}

impl SpringValue {
    /// Create a new spring value at rest.
    pub fn new(initial: f32) -> Self {
        Self {
            value: initial,
            velocity: 0.0,
            target: initial,
        }
    }

    /// Set a new target with optional velocity impulse.
    pub fn set_target(&mut self, target: f32) {
        self.target = target;
    }

    /// Set target and add velocity impulse for snappier response.
    pub fn set_target_with_impulse(&mut self, target: f32, impulse: f32) {
        self.target = target;
        self.velocity += impulse;
    }

    /// Update the spring simulation.
    ///
    /// Uses semi-implicit Euler integration for stability.
    pub fn update(&mut self, config: &SpringConfig, dt: f32) {
        // Calculate spring force: F = -k * x - c * v
        let displacement = self.value - self.target;
        let spring_force = -config.stiffness * displacement;
        let damping_force = -config.damping * self.velocity;
        let total_force = spring_force + damping_force;

        // Apply acceleration: a = F / m
        let acceleration = total_force / config.mass;

        // Semi-implicit Euler: update velocity first, then position
        self.velocity += acceleration * dt;
        self.value += self.velocity * dt;
    }

    /// Check if the spring is at rest (within tolerance).
    pub fn is_at_rest(&self, tolerance: f32) -> bool {
        (self.value - self.target).abs() < tolerance && self.velocity.abs() < tolerance
    }

    /// Snap to target immediately.
    pub fn snap_to_target(&mut self) {
        self.value = self.target;
        self.velocity = 0.0;
    }
}

/// Spring-animated 3D vector.
#[derive(Debug, Clone, Copy)]
pub struct SpringVec3 {
    /// X component spring.
    pub x: SpringValue,
    /// Y component spring.
    pub y: SpringValue,
    /// Z component spring.
    pub z: SpringValue,
}

impl SpringVec3 {
    /// Create a new spring vector at the given position.
    pub fn new(x: f32, y: f32, z: f32) -> Self {
        Self {
            x: SpringValue::new(x),
            y: SpringValue::new(y),
            z: SpringValue::new(z),
        }
    }

    /// Set target for all components.
    pub fn set_target(&mut self, x: f32, y: f32, z: f32) {
        self.x.set_target(x);
        self.y.set_target(y);
        self.z.set_target(z);
    }

    /// Update all components.
    pub fn update(&mut self, config: &SpringConfig, dt: f32) {
        self.x.update(config, dt);
        self.y.update(config, dt);
        self.z.update(config, dt);
    }

    /// Get current values as array.
    pub fn values(&self) -> [f32; 3] {
        [self.x.value, self.y.value, self.z.value]
    }

    /// Check if all components are at rest.
    pub fn is_at_rest(&self, tolerance: f32) -> bool {
        self.x.is_at_rest(tolerance) && self.y.is_at_rest(tolerance) && self.z.is_at_rest(tolerance)
    }
}

/// Complete spring animation state for the ring.
#[derive(Debug, Clone)]
pub struct RingSpringState {
    /// Spring for rotation speed (not angle - we animate speed).
    pub rotation_speed: SpringValue,
    /// Spring for tilt angle.
    pub tilt: SpringValue,
    /// Spring for energy level.
    pub energy: SpringValue,
    /// Spring for plasma intensity.
    pub plasma: SpringValue,
    /// Spring for scale (used during explosions).
    pub scale: SpringValue,
    /// Spring configuration for fast properties (rotation, energy).
    pub fast_config: SpringConfig,
    /// Spring configuration for slow properties (tilt).
    pub slow_config: SpringConfig,
    /// Spring configuration for bouncy effects (explosion).
    pub bounce_config: SpringConfig,
}

impl Default for RingSpringState {
    fn default() -> Self {
        let state = RingState::default();
        Self {
            rotation_speed: SpringValue::new(state.rotation_speed()),
            tilt: SpringValue::new(state.tilt_angle()),
            energy: SpringValue::new(state.energy_level()),
            plasma: SpringValue::new(0.0),
            scale: SpringValue::new(1.0),
            fast_config: SpringConfig::snappy(),
            slow_config: SpringConfig::gentle(),
            bounce_config: SpringConfig::bouncy(),
        }
    }
}

impl RingSpringState {
    /// Create spring state initialized for a specific ring state.
    pub fn for_state(state: RingState) -> Self {
        Self {
            rotation_speed: SpringValue::new(state.rotation_speed()),
            tilt: SpringValue::new(state.tilt_angle()),
            energy: SpringValue::new(state.energy_level()),
            plasma: SpringValue::new(if matches!(state, RingState::Processing | RingState::Exploding) { 1.0 } else { 0.0 }),
            scale: SpringValue::new(1.0),
            fast_config: SpringConfig::snappy(),
            slow_config: SpringConfig::gentle(),
            bounce_config: SpringConfig::bouncy(),
        }
    }

    /// Transition to a new state with appropriate spring dynamics.
    pub fn transition_to(&mut self, state: RingState) {
        // Set targets for all springs
        self.rotation_speed.set_target(state.rotation_speed());
        self.tilt.set_target(state.tilt_angle());
        self.energy.set_target(state.energy_level());

        // Plasma and scale depend on state
        match state {
            RingState::Processing => {
                self.plasma.set_target(1.0);
                self.scale.set_target(1.0);
            }
            RingState::Exploding => {
                self.plasma.set_target_with_impulse(1.0, 2.0);
                self.scale.set_target_with_impulse(1.3, 5.0); // Expand with impulse
            }
            RingState::Recovering => {
                self.plasma.set_target(0.3);
                self.scale.set_target(1.0);
            }
            _ => {
                self.plasma.set_target(0.0);
                self.scale.set_target(1.0);
            }
        }
    }

    /// Update all springs with delta time.
    pub fn update(&mut self, dt: f32) {
        // Fast springs for responsive properties
        self.rotation_speed.update(&self.fast_config, dt);
        self.energy.update(&self.fast_config, dt);
        self.plasma.update(&self.fast_config, dt);

        // Slow spring for tilt (smooth, gradual)
        self.tilt.update(&self.slow_config, dt);

        // Bouncy spring for scale (explosive effects)
        self.scale.update(&self.bounce_config, dt);
    }

    /// Check if all springs are at rest.
    pub fn is_at_rest(&self) -> bool {
        let tolerance = 0.001;
        self.rotation_speed.is_at_rest(tolerance)
            && self.tilt.is_at_rest(tolerance)
            && self.energy.is_at_rest(tolerance)
            && self.plasma.is_at_rest(tolerance)
            && self.scale.is_at_rest(tolerance)
    }

    /// Get current rotation speed.
    pub fn current_rotation_speed(&self) -> f32 {
        self.rotation_speed.value
    }

    /// Get current tilt angle.
    pub fn current_tilt(&self) -> f32 {
        self.tilt.value
    }

    /// Get current energy level.
    pub fn current_energy(&self) -> f32 {
        self.energy.value.clamp(0.0, 1.0)
    }

    /// Get current plasma intensity.
    pub fn current_plasma(&self) -> f32 {
        self.plasma.value.clamp(0.0, 1.0)
    }

    /// Get current scale.
    pub fn current_scale(&self) -> f32 {
        self.scale.value.max(0.1)
    }
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
    bind_group_layout: wgpu::BindGroupLayout,
    pipeline: wgpu::RenderPipeline,
    config: RingConfig,
    state: RingState,
    quality_level: RingQualityLevel,
    // Animation state - accumulated rotation angle
    current_rotation: f32,
    // Spring physics state
    spring_state: RingSpringState,
    // Whether to use spring physics (true) or legacy lerp (false)
    use_spring_physics: bool,
    // Legacy animation state (for compatibility)
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
            roughness: config.roughness,
            base_color: config.base_color,
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
                    // Blend state kept for compatibility (obsidian outputs alpha=1.0)
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
                // No culling - ring visible from all angles
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
        let quality_level = config.quality_level;
        let spring_state = RingSpringState::for_state(state);
        Self {
            vertex_buffer,
            index_buffer,
            index_count,
            uniform_buffer,
            bind_group,
            bind_group_layout,
            pipeline,
            config,
            state,
            quality_level,
            current_rotation: 0.0,
            spring_state,
            use_spring_physics: true, // Enable spring physics by default
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

            // Update spring physics targets
            self.spring_state.transition_to(state);

            // Update legacy targets for compatibility
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

    /// Enable or disable spring physics.
    ///
    /// When enabled, transitions use spring-based physics for natural motion.
    /// When disabled, uses simple lerp-based interpolation (legacy mode).
    pub fn set_spring_physics_enabled(&mut self, enabled: bool) {
        self.use_spring_physics = enabled;
    }

    /// Check if spring physics is enabled.
    pub fn is_spring_physics_enabled(&self) -> bool {
        self.use_spring_physics
    }

    /// Get the spring state for advanced customization.
    pub fn spring_state(&self) -> &RingSpringState {
        &self.spring_state
    }

    /// Get mutable spring state for customization.
    pub fn spring_state_mut(&mut self) -> &mut RingSpringState {
        &mut self.spring_state
    }

    /// Check if all spring animations have settled.
    pub fn is_animation_complete(&self) -> bool {
        if self.use_spring_physics {
            self.spring_state.is_at_rest()
        } else {
            self.transition_progress >= 1.0
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

        if self.use_spring_physics {
            // Spring physics update
            self.spring_state.update(delta_time);

            // Update rotation based on spring-driven speed
            self.current_rotation += self.spring_state.current_rotation_speed() * delta_time;
            if self.current_rotation > TAU {
                self.current_rotation -= TAU;
            }

            // Sync spring values to legacy fields for render()
            self.current_tilt = self.spring_state.current_tilt();
            self.current_energy = self.spring_state.current_energy();
            self.current_plasma = self.spring_state.current_plasma();
        } else {
            // Legacy lerp-based animation
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
    }

    /// Build the model matrix from current rotation, tilt, and scale.
    fn build_model_matrix(&self) -> [[f32; 4]; 4] {
        // Get scale from spring state if using spring physics
        let scale = if self.use_spring_physics {
            self.spring_state.current_scale()
        } else {
            1.0
        };

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
        let mut temp = [[0.0f32; 4]; 4];
        for i in 0..4 {
            for j in 0..4 {
                temp[i][j] = tilt_x[i][0] * rotation_y[0][j]
                    + tilt_x[i][1] * rotation_y[1][j]
                    + tilt_x[i][2] * rotation_y[2][j]
                    + tilt_x[i][3] * rotation_y[3][j];
            }
        }

        // Apply scale to the result
        let mut result = temp;
        for i in 0..3 {
            for j in 0..4 {
                result[i][j] *= scale;
            }
        }

        result
    }

    /// Get the current scale factor (from spring physics).
    pub fn current_scale(&self) -> f32 {
        if self.use_spring_physics {
            self.spring_state.current_scale()
        } else {
            1.0
        }
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
            roughness: self.config.roughness,
            emission_intensity: self.current_energy * self.current_plasma,
            base_color: self.config.base_color,
            _padding: 0.0,
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

    /// Get the current quality level.
    pub fn quality_level(&self) -> RingQualityLevel {
        self.quality_level
    }

    /// Set the quality level and regenerate geometry if needed.
    ///
    /// This will recreate vertex and index buffers with the new segment counts.
    pub fn set_quality(&mut self, device: &wgpu::Device, quality: RingQualityLevel) {
        if self.quality_level != quality {
            self.quality_level = quality;
            self.config.set_quality(quality);
            self.regenerate_geometry(device);
        }
    }

    /// Regenerate the ring geometry based on current config.
    ///
    /// Call this after changing segment counts or radii.
    pub fn regenerate_geometry(&mut self, device: &wgpu::Device) {
        let (vertices, indices) = generate_torus_geometry(&self.config);
        self.index_count = indices.len() as u32;

        // Create new vertex buffer
        self.vertex_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Ring Vertex Buffer"),
            contents: bytemuck::cast_slice(&vertices),
            usage: wgpu::BufferUsages::VERTEX,
        });

        // Create new index buffer
        self.index_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Ring Index Buffer"),
            contents: bytemuck::cast_slice(&indices),
            usage: wgpu::BufferUsages::INDEX,
        });

        // Recreate bind group with existing uniform buffer
        self.bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("Ring Bind Group"),
            layout: &self.bind_group_layout,
            entries: &[wgpu::BindGroupEntry {
                binding: 0,
                resource: self.uniform_buffer.as_entire_binding(),
            }],
        });
    }

    /// Get the current vertex count (for debug/stats).
    pub fn vertex_count(&self) -> u32 {
        let major = self.config.major_segments;
        let minor = self.config.minor_segments;
        (major + 1) * (minor + 1)
    }

    /// Get the current triangle count (for debug/stats).
    pub fn triangle_count(&self) -> u32 {
        self.index_count / 3
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
        assert!((config.roughness - 0.03).abs() < f32::EPSILON);
        assert!((config.base_color[0] - 0.02).abs() < f32::EPSILON);
        assert!((config.base_color[1] - 0.02).abs() < f32::EPSILON);
        assert!((config.base_color[2] - 0.03).abs() < f32::EPSILON);
        assert!((config.energy_color[0] - 0.545).abs() < 0.001);
        assert!((config.energy_color[1] - 0.361).abs() < 0.001);
        assert!((config.energy_color[2] - 0.965).abs() < 0.001);
        assert_eq!(config.quality_level, RingQualityLevel::Medium);
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
            roughness: 0.03,
            base_color: [0.02, 0.02, 0.03],
            energy_color: [0.545, 0.361, 0.965],
            quality_level: RingQualityLevel::Low,
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

    #[test]
    fn test_quality_level_segments() {
        // Test that quality levels have correct segment counts
        assert_eq!(RingQualityLevel::Low.major_segments(), 32);
        assert_eq!(RingQualityLevel::Low.minor_segments(), 16);

        assert_eq!(RingQualityLevel::Medium.major_segments(), 64);
        assert_eq!(RingQualityLevel::Medium.minor_segments(), 32);

        assert_eq!(RingQualityLevel::High.major_segments(), 128);
        assert_eq!(RingQualityLevel::High.minor_segments(), 64);

        assert_eq!(RingQualityLevel::Ultra.major_segments(), 256);
        assert_eq!(RingQualityLevel::Ultra.minor_segments(), 128);
    }

    #[test]
    fn test_quality_level_conversion() {
        // Test u32 conversion round-trip
        assert_eq!(RingQualityLevel::from_u32(0), RingQualityLevel::Low);
        assert_eq!(RingQualityLevel::from_u32(1), RingQualityLevel::Medium);
        assert_eq!(RingQualityLevel::from_u32(2), RingQualityLevel::High);
        assert_eq!(RingQualityLevel::from_u32(3), RingQualityLevel::Ultra);
        assert_eq!(RingQualityLevel::from_u32(100), RingQualityLevel::Ultra); // Clamp high values

        assert_eq!(RingQualityLevel::Low.as_u32(), 0);
        assert_eq!(RingQualityLevel::Medium.as_u32(), 1);
        assert_eq!(RingQualityLevel::High.as_u32(), 2);
        assert_eq!(RingQualityLevel::Ultra.as_u32(), 3);
    }

    #[test]
    fn test_quality_level_multipliers() {
        assert!((RingQualityLevel::Low.segment_multiplier() - 0.5).abs() < f32::EPSILON);
        assert!((RingQualityLevel::Medium.segment_multiplier() - 1.0).abs() < f32::EPSILON);
        assert!((RingQualityLevel::High.segment_multiplier() - 2.0).abs() < f32::EPSILON);
        assert!((RingQualityLevel::Ultra.segment_multiplier() - 4.0).abs() < f32::EPSILON);
    }

    #[test]
    fn test_config_with_quality() {
        let config = RingConfig::with_quality(RingQualityLevel::High);
        assert_eq!(config.major_segments, 128);
        assert_eq!(config.minor_segments, 64);
        assert_eq!(config.quality_level, RingQualityLevel::High);
    }

    #[test]
    fn test_config_set_quality() {
        let mut config = RingConfig::default();
        assert_eq!(config.quality_level, RingQualityLevel::Medium);

        config.set_quality(RingQualityLevel::Ultra);
        assert_eq!(config.quality_level, RingQualityLevel::Ultra);
        assert_eq!(config.major_segments, 256);
        assert_eq!(config.minor_segments, 128);
    }

    // Spring Physics Tests

    #[test]
    fn test_spring_config_default() {
        let config = SpringConfig::default();
        assert!((config.stiffness - 200.0).abs() < f32::EPSILON);
        assert!((config.damping - 20.0).abs() < f32::EPSILON);
        assert!((config.mass - 1.0).abs() < f32::EPSILON);
    }

    #[test]
    fn test_spring_config_presets() {
        let snappy = SpringConfig::snappy();
        let bouncy = SpringConfig::bouncy();
        let gentle = SpringConfig::gentle();

        // Snappy should have high stiffness
        assert!(snappy.stiffness > gentle.stiffness);
        // Bouncy should have low damping
        assert!(bouncy.damping < snappy.damping);
    }

    #[test]
    fn test_spring_config_critically_damped() {
        let config = SpringConfig::critically_damped(200.0);
        let damping_ratio = config.damping_ratio();
        // Critical damping ratio should be ~1.0
        assert!((damping_ratio - 1.0).abs() < 0.01, "Damping ratio: {}", damping_ratio);
    }

    #[test]
    fn test_spring_value_new() {
        let spring = SpringValue::new(5.0);
        assert!((spring.value - 5.0).abs() < f32::EPSILON);
        assert!((spring.velocity - 0.0).abs() < f32::EPSILON);
        assert!((spring.target - 5.0).abs() < f32::EPSILON);
    }

    #[test]
    fn test_spring_value_set_target() {
        let mut spring = SpringValue::new(0.0);
        spring.set_target(10.0);
        assert!((spring.target - 10.0).abs() < f32::EPSILON);
        assert!((spring.value - 0.0).abs() < f32::EPSILON); // Value unchanged
    }

    #[test]
    fn test_spring_value_update_moves_toward_target() {
        let mut spring = SpringValue::new(0.0);
        spring.set_target(10.0);
        let config = SpringConfig::default();

        // Update several times
        for _ in 0..100 {
            spring.update(&config, 0.016); // ~60fps
        }

        // Should have moved toward target
        assert!(spring.value > 5.0, "Spring value should increase: {}", spring.value);
    }

    #[test]
    fn test_spring_value_settles_at_target() {
        let mut spring = SpringValue::new(0.0);
        spring.set_target(10.0);
        let config = SpringConfig::critically_damped(200.0);

        // Update many times to ensure settling
        for _ in 0..500 {
            spring.update(&config, 0.016);
        }

        // Should be at target within tolerance
        assert!((spring.value - 10.0).abs() < 0.01, "Spring should settle at target: {}", spring.value);
        assert!(spring.is_at_rest(0.01), "Spring should be at rest");
    }

    #[test]
    fn test_spring_value_snap_to_target() {
        let mut spring = SpringValue::new(0.0);
        spring.set_target(10.0);
        spring.snap_to_target();

        assert!((spring.value - 10.0).abs() < f32::EPSILON);
        assert!((spring.velocity - 0.0).abs() < f32::EPSILON);
    }

    #[test]
    fn test_spring_vec3() {
        let mut vec = SpringVec3::new(0.0, 0.0, 0.0);
        vec.set_target(1.0, 2.0, 3.0);

        let config = SpringConfig::default();
        for _ in 0..200 {
            vec.update(&config, 0.016);
        }

        let values = vec.values();
        assert!(values[0] > 0.5, "X should move toward 1.0");
        assert!(values[1] > 1.0, "Y should move toward 2.0");
        assert!(values[2] > 1.5, "Z should move toward 3.0");
    }

    #[test]
    fn test_ring_spring_state_default() {
        let state = RingSpringState::default();
        let ring_state = RingState::default();

        assert!((state.current_rotation_speed() - ring_state.rotation_speed()).abs() < f32::EPSILON);
        assert!((state.current_tilt() - ring_state.tilt_angle()).abs() < f32::EPSILON);
        assert!((state.current_energy() - ring_state.energy_level()).abs() < f32::EPSILON);
    }

    #[test]
    fn test_ring_spring_state_transition() {
        let mut spring_state = RingSpringState::for_state(RingState::Dormant);

        // Transition to Processing
        spring_state.transition_to(RingState::Processing);

        // Targets should be set
        assert!((spring_state.rotation_speed.target - RingState::Processing.rotation_speed()).abs() < f32::EPSILON);
        assert!((spring_state.energy.target - RingState::Processing.energy_level()).abs() < f32::EPSILON);
        assert!((spring_state.plasma.target - 1.0).abs() < f32::EPSILON);

        // Update to move values
        for _ in 0..100 {
            spring_state.update(0.016);
        }

        // Values should have moved toward targets
        assert!(spring_state.current_rotation_speed() > RingState::Dormant.rotation_speed());
        assert!(spring_state.current_energy() > RingState::Dormant.energy_level());
    }

    #[test]
    fn test_ring_spring_state_explosion() {
        let mut spring_state = RingSpringState::for_state(RingState::Active);

        // Explode!
        spring_state.transition_to(RingState::Exploding);

        // Scale target should be > 1.0
        assert!(spring_state.scale.target > 1.0, "Explosion should expand");

        // Velocity should have impulse
        assert!(spring_state.scale.velocity > 0.0, "Should have positive velocity impulse");
    }

    #[test]
    fn test_ring_spring_state_is_at_rest() {
        let mut spring_state = RingSpringState::for_state(RingState::Active);

        // Initially at rest (already at target)
        assert!(spring_state.is_at_rest(), "Should be at rest initially");

        // Transition triggers motion
        spring_state.transition_to(RingState::Processing);
        spring_state.update(0.001); // Small update to start motion

        // Not at rest while transitioning
        assert!(!spring_state.is_at_rest(), "Should not be at rest while transitioning");
    }
}
