//! GPU-instanced particle system for Opta.
//!
//! This module provides a flexible particle system supporting:
//! - Explosion effects with radial velocity
//! - Ambient floating particles
//! - Energy bursts and sparks
//!
//! Particles use GPU instancing for efficient rendering of many particles
//! with minimal draw calls. The system handles particle lifecycle, physics,
//! and color interpolation automatically.
//!
//! # Example
//!
//! ```
//! use opta_render::animation::{ParticleEmitter, EmitterConfig};
//!
//! let mut emitter = ParticleEmitter::new(EmitterConfig::explosion());
//! emitter.set_position([0.0, 0.0, 0.0]);
//! emitter.burst(100);
//!
//! // In render loop
//! emitter.update(1.0 / 60.0);
//! let particles = emitter.active_particles();
//! // Upload particles to GPU and render
//! ```

use bytemuck::{Pod, Zeroable};

/// Maximum number of particles per emitter.
///
/// This limit ensures bounded memory usage and consistent performance.
/// For more particles, use multiple emitters.
pub const MAX_PARTICLES: usize = 2048;

/// A single particle instance.
///
/// This struct is GPU-friendly with proper alignment and padding for
/// efficient buffer uploads. Uses `repr(C)` for predictable memory layout.
#[repr(C)]
#[derive(Debug, Clone, Copy, Pod, Zeroable)]
pub struct Particle {
    /// World-space position (x, y, z).
    pub position: [f32; 3],
    /// Remaining lifetime in seconds. Particle dies when <= 0.
    pub life: f32,
    /// Velocity vector (x, y, z) in units per second.
    pub velocity: [f32; 3],
    /// Visual size (radius or scale factor).
    pub size: f32,
    /// RGBA color with alpha for transparency.
    pub color: [f32; 4],
}

impl Default for Particle {
    fn default() -> Self {
        Self {
            position: [0.0; 3],
            life: 0.0,
            velocity: [0.0; 3],
            size: 1.0,
            color: [1.0, 1.0, 1.0, 1.0],
        }
    }
}

impl Particle {
    /// Create a new particle with the given properties.
    #[must_use]
    pub fn new(
        position: [f32; 3],
        velocity: [f32; 3],
        life: f32,
        size: f32,
        color: [f32; 4],
    ) -> Self {
        Self {
            position,
            life,
            velocity,
            size,
            color,
        }
    }

    /// Check if this particle is still alive.
    #[must_use]
    pub fn is_alive(&self) -> bool {
        self.life > 0.0
    }
}

/// Configuration for particle emitters.
///
/// Controls emission rate, particle properties, and physics behavior.
/// Use the preset constructors for common effect types.
#[derive(Debug, Clone)]
pub struct EmitterConfig {
    /// Particles emitted per second during continuous emission.
    pub emission_rate: f32,
    /// Particle lifetime range (min, max) in seconds.
    pub lifetime: (f32, f32),
    /// Minimum initial velocity (x, y, z).
    pub velocity_min: [f32; 3],
    /// Maximum initial velocity (x, y, z).
    pub velocity_max: [f32; 3],
    /// Minimum initial particle size.
    pub size_min: f32,
    /// Maximum initial particle size.
    pub size_max: f32,
    /// Gravity vector applied to all particles (usually [0, -9.8, 0]).
    pub gravity: [f32; 3],
    /// Starting color (RGBA).
    pub color_start: [f32; 4],
    /// Ending color (RGBA) - particles interpolate towards this over lifetime.
    pub color_end: [f32; 4],
    /// Size multiplier over lifetime (1.0 = constant, 0.0 = shrink to nothing).
    pub size_over_life: f32,
    /// Velocity damping factor (0.0 = no damping, 1.0 = full stop).
    pub damping: f32,
}

impl Default for EmitterConfig {
    fn default() -> Self {
        Self {
            emission_rate: 10.0,
            lifetime: (1.0, 2.0),
            velocity_min: [-1.0, -1.0, -1.0],
            velocity_max: [1.0, 1.0, 1.0],
            size_min: 0.1,
            size_max: 0.2,
            gravity: [0.0, 0.0, 0.0],
            color_start: [1.0, 1.0, 1.0, 1.0],
            color_end: [1.0, 1.0, 1.0, 0.0],
            size_over_life: 1.0,
            damping: 0.0,
        }
    }
}

impl EmitterConfig {
    /// Create an explosion preset.
    ///
    /// Features:
    /// - High initial velocity in all directions
    /// - Short lifetime (0.3-0.8s)
    /// - Orange to red color fade
    /// - Shrinks over time
    /// - Light gravity pulling down
    #[must_use]
    pub fn explosion() -> Self {
        Self {
            emission_rate: 0.0, // Explosions use burst(), not continuous emission
            lifetime: (0.3, 0.8),
            velocity_min: [-5.0, -5.0, -5.0],
            velocity_max: [5.0, 5.0, 5.0],
            size_min: 0.05,
            size_max: 0.15,
            gravity: [0.0, -2.0, 0.0],
            color_start: [1.0, 0.6, 0.1, 1.0], // Orange
            color_end: [0.8, 0.1, 0.0, 0.0],   // Red, fading out
            size_over_life: 0.0,               // Shrink to nothing
            damping: 0.1,
        }
    }

    /// Create an ambient particles preset.
    ///
    /// Features:
    /// - Slow, gentle drift
    /// - Long lifetime (3-6s)
    /// - Subtle white/blue glow
    /// - Slight upward float
    /// - No shrinking
    #[must_use]
    pub fn ambient() -> Self {
        Self {
            emission_rate: 5.0, // Steady emission
            lifetime: (3.0, 6.0),
            velocity_min: [-0.3, 0.1, -0.3],
            velocity_max: [0.3, 0.5, 0.3],
            size_min: 0.02,
            size_max: 0.05,
            gravity: [0.0, 0.05, 0.0], // Slight upward drift
            color_start: [0.8, 0.9, 1.0, 0.6],
            color_end: [0.6, 0.8, 1.0, 0.0],
            size_over_life: 1.0, // Constant size
            damping: 0.02,
        }
    }

    /// Create a sparks preset.
    ///
    /// Features:
    /// - Fast initial velocity with upward bias
    /// - Very short lifetime (0.2-0.5s)
    /// - Bright yellow to orange
    /// - Strong gravity
    /// - Fast shrinking
    #[must_use]
    pub fn sparks() -> Self {
        Self {
            emission_rate: 50.0,
            lifetime: (0.2, 0.5),
            velocity_min: [-2.0, 2.0, -2.0],
            velocity_max: [2.0, 6.0, 2.0],
            size_min: 0.01,
            size_max: 0.03,
            gravity: [0.0, -15.0, 0.0], // Strong gravity
            color_start: [1.0, 0.9, 0.3, 1.0], // Bright yellow
            color_end: [1.0, 0.4, 0.0, 0.0],   // Orange, fading
            size_over_life: 0.2,
            damping: 0.05,
        }
    }
}

/// Simple pseudo-random number generator for particle spawning.
///
/// Uses a linear congruential generator for speed - we don't need
/// cryptographic randomness for particle effects.
#[derive(Debug, Clone)]
struct SimpleRng {
    state: u64,
}

impl SimpleRng {
    fn new(seed: u64) -> Self {
        Self {
            state: seed.wrapping_add(1),
        }
    }

    fn next_u64(&mut self) -> u64 {
        // LCG constants from Numerical Recipes
        self.state = self.state.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
        self.state
    }

    /// Generate a random f32 in [0, 1)
    fn next_f32(&mut self) -> f32 {
        (self.next_u64() >> 40) as f32 / (1u64 << 24) as f32
    }

    /// Generate a random f32 in [min, max)
    fn range(&mut self, min: f32, max: f32) -> f32 {
        min + self.next_f32() * (max - min)
    }
}

/// A particle emitter that spawns and manages particles.
///
/// Handles:
/// - Continuous emission at a configured rate
/// - Burst spawning for instant effects
/// - Particle physics simulation
/// - Lifetime and color interpolation
/// - Dead particle compaction
#[derive(Debug, Clone)]
pub struct ParticleEmitter {
    /// Emitter configuration.
    config: EmitterConfig,
    /// All particles (active count tracked separately).
    particles: Vec<Particle>,
    /// Number of currently active particles.
    active_count: usize,
    /// Accumulator for fractional particle emission.
    emission_accumulator: f32,
    /// World position of the emitter.
    position: [f32; 3],
    /// Whether continuous emission is enabled.
    is_emitting: bool,
    /// RNG for particle spawning.
    rng: SimpleRng,
    /// Initial lifetime storage for interpolation calculations.
    initial_lifetimes: Vec<f32>,
}

impl ParticleEmitter {
    /// Create a new particle emitter with the given configuration.
    #[must_use]
    pub fn new(config: EmitterConfig) -> Self {
        Self {
            config,
            particles: Vec::with_capacity(MAX_PARTICLES),
            active_count: 0,
            emission_accumulator: 0.0,
            position: [0.0; 3],
            is_emitting: false,
            rng: SimpleRng::new(0x12345678),
            initial_lifetimes: Vec::with_capacity(MAX_PARTICLES),
        }
    }

    /// Set the world position of the emitter.
    pub fn set_position(&mut self, position: [f32; 3]) {
        self.position = position;
    }

    /// Get the current emitter position.
    #[must_use]
    pub fn position(&self) -> [f32; 3] {
        self.position
    }

    /// Start continuous particle emission.
    pub fn start(&mut self) {
        self.is_emitting = true;
    }

    /// Stop continuous particle emission.
    ///
    /// Existing particles will continue their lifecycle.
    pub fn stop(&mut self) {
        self.is_emitting = false;
        self.emission_accumulator = 0.0;
    }

    /// Check if the emitter is currently emitting.
    #[must_use]
    pub fn is_emitting(&self) -> bool {
        self.is_emitting
    }

    /// Instantly spawn a burst of particles.
    ///
    /// Useful for explosions and other instant effects.
    /// The count is clamped to not exceed MAX_PARTICLES total.
    pub fn burst(&mut self, count: usize) {
        let spawn_count = count.min(MAX_PARTICLES - self.active_count);
        for _ in 0..spawn_count {
            self.spawn_particle();
        }
    }

    /// Get a slice of currently active particles.
    ///
    /// Use this for uploading to the GPU instance buffer.
    #[must_use]
    pub fn active_particles(&self) -> &[Particle] {
        &self.particles[..self.active_count]
    }

    /// Get the number of currently active particles.
    #[must_use]
    pub fn active_count(&self) -> usize {
        self.active_count
    }

    /// Update the particle system.
    ///
    /// This method:
    /// 1. Spawns new particles if emitting
    /// 2. Updates particle physics (position, velocity)
    /// 3. Applies gravity and damping
    /// 4. Updates lifetime and interpolates color
    /// 5. Removes dead particles (compaction)
    ///
    /// Call this once per frame with the time delta.
    pub fn update(&mut self, dt: f32) {
        // Continuous emission
        if self.is_emitting && self.config.emission_rate > 0.0 {
            self.emission_accumulator += self.config.emission_rate * dt;
            while self.emission_accumulator >= 1.0 && self.active_count < MAX_PARTICLES {
                self.spawn_particle();
                self.emission_accumulator -= 1.0;
            }
        }

        // Update physics and lifetime for all active particles
        for i in 0..self.active_count {
            let particle = &mut self.particles[i];
            let initial_life = self.initial_lifetimes[i];

            // Decrease lifetime
            particle.life -= dt;

            if particle.life > 0.0 {
                // Apply gravity
                particle.velocity[0] += self.config.gravity[0] * dt;
                particle.velocity[1] += self.config.gravity[1] * dt;
                particle.velocity[2] += self.config.gravity[2] * dt;

                // Apply damping
                let damping_factor = 1.0 - self.config.damping * dt;
                particle.velocity[0] *= damping_factor;
                particle.velocity[1] *= damping_factor;
                particle.velocity[2] *= damping_factor;

                // Update position
                particle.position[0] += particle.velocity[0] * dt;
                particle.position[1] += particle.velocity[1] * dt;
                particle.position[2] += particle.velocity[2] * dt;

                // Interpolate color over lifetime
                let life_ratio = particle.life / initial_life;
                let t = 1.0 - life_ratio; // 0 at start, 1 at end
                for c in 0..4 {
                    particle.color[c] =
                        lerp(self.config.color_start[c], self.config.color_end[c], t);
                }

                // Scale size over lifetime
                let base_size = (self.config.size_min + self.config.size_max) * 0.5;
                let size_factor = lerp(1.0, self.config.size_over_life, t);
                particle.size = base_size * size_factor;
            }
        }

        // Compact: remove dead particles by swapping with last active
        let mut i = 0;
        while i < self.active_count {
            if !self.particles[i].is_alive() {
                self.active_count -= 1;
                if i < self.active_count {
                    self.particles.swap(i, self.active_count);
                    self.initial_lifetimes.swap(i, self.active_count);
                }
            } else {
                i += 1;
            }
        }
    }

    /// Spawn a single particle with randomized properties.
    fn spawn_particle(&mut self) {
        let lifetime = self.rng.range(self.config.lifetime.0, self.config.lifetime.1);

        let velocity = [
            self.rng.range(self.config.velocity_min[0], self.config.velocity_max[0]),
            self.rng.range(self.config.velocity_min[1], self.config.velocity_max[1]),
            self.rng.range(self.config.velocity_min[2], self.config.velocity_max[2]),
        ];

        let size = self.rng.range(self.config.size_min, self.config.size_max);

        let particle = Particle::new(
            self.position,
            velocity,
            lifetime,
            size,
            self.config.color_start,
        );

        if self.active_count < self.particles.len() {
            self.particles[self.active_count] = particle;
            self.initial_lifetimes[self.active_count] = lifetime;
        } else {
            self.particles.push(particle);
            self.initial_lifetimes.push(lifetime);
        }
        self.active_count += 1;
    }

    /// Set a new RNG seed for deterministic behavior.
    pub fn set_seed(&mut self, seed: u64) {
        self.rng = SimpleRng::new(seed);
    }

    /// Get a reference to the emitter configuration.
    #[must_use]
    pub fn config(&self) -> &EmitterConfig {
        &self.config
    }

    /// Set a new emitter configuration.
    pub fn set_config(&mut self, config: EmitterConfig) {
        self.config = config;
    }

    /// Clear all particles.
    pub fn clear(&mut self) {
        self.active_count = 0;
        self.emission_accumulator = 0.0;
    }
}

/// Linear interpolation helper.
#[inline]
fn lerp(a: f32, b: f32, t: f32) -> f32 {
    a + (b - a) * t
}

/// Particle renderer for GPU instanced rendering.
///
/// Handles pipeline creation, buffer management, and draw calls.
/// Currently a stub - full implementation requires wgpu device context.
pub struct ParticleRenderer {
    // These fields will be populated when wgpu context is available
    _pipeline: (),
    _instance_buffer: (),
    _bind_group: (),
    _quad_vertex_buffer: (),
}

impl ParticleRenderer {
    /// Create a new particle renderer.
    ///
    /// TODO: Implement with wgpu device and queue.
    #[must_use]
    pub fn new() -> Self {
        todo!("ParticleRenderer::new() requires wgpu device context")
    }

    /// Upload particle data to the GPU.
    ///
    /// TODO: Implement buffer upload.
    pub fn upload(&mut self, _particles: &[Particle]) {
        todo!("ParticleRenderer::upload() requires wgpu queue")
    }

    /// Render particles.
    ///
    /// TODO: Implement render pass.
    pub fn render(&self) {
        todo!("ParticleRenderer::render() requires wgpu render pass")
    }
}

impl Default for ParticleRenderer {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_particle_burst() {
        let mut emitter = ParticleEmitter::new(EmitterConfig::explosion());
        emitter.burst(100);
        assert_eq!(
            emitter.active_count(),
            100,
            "Burst should spawn exactly 100 particles"
        );
    }

    #[test]
    fn test_particle_lifetime() {
        let config = EmitterConfig {
            lifetime: (0.1, 0.1), // Fixed 0.1s lifetime
            ..EmitterConfig::default()
        };
        let mut emitter = ParticleEmitter::new(config);
        emitter.burst(10);

        assert_eq!(emitter.active_count(), 10, "Should have 10 particles initially");

        // Update for 0.2 seconds (longer than lifetime)
        emitter.update(0.2);

        assert_eq!(
            emitter.active_count(),
            0,
            "All particles should be dead after 0.2s (lifetime was 0.1s)"
        );
    }

    #[test]
    fn test_continuous_emission() {
        let config = EmitterConfig {
            emission_rate: 100.0, // 100 particles per second
            lifetime: (10.0, 10.0), // Long lifetime so they don't die
            ..EmitterConfig::default()
        };
        let mut emitter = ParticleEmitter::new(config);
        emitter.start();

        // Update for 0.1 seconds
        emitter.update(0.1);

        let count = emitter.active_count();
        // Should have approximately 10 particles (100/s * 0.1s = 10)
        // Allow some tolerance for floating point accumulation
        assert!(
            (8..=12).contains(&count),
            "Expected ~10 particles from 100/s emission over 0.1s, got {}",
            count
        );
    }

    #[test]
    fn test_max_particles_limit() {
        let mut emitter = ParticleEmitter::new(EmitterConfig::default());
        emitter.burst(MAX_PARTICLES + 500);

        assert_eq!(
            emitter.active_count(),
            MAX_PARTICLES,
            "Burst should be clamped to MAX_PARTICLES"
        );
    }

    #[test]
    fn test_emitter_start_stop() {
        let mut emitter = ParticleEmitter::new(EmitterConfig::ambient());

        assert!(!emitter.is_emitting(), "Should not be emitting initially");

        emitter.start();
        assert!(emitter.is_emitting(), "Should be emitting after start()");

        emitter.stop();
        assert!(!emitter.is_emitting(), "Should not be emitting after stop()");
    }

    #[test]
    fn test_particle_physics() {
        let config = EmitterConfig {
            velocity_min: [1.0, 0.0, 0.0],
            velocity_max: [1.0, 0.0, 0.0], // Fixed velocity
            gravity: [0.0, -10.0, 0.0],
            lifetime: (10.0, 10.0),
            damping: 0.0,
            ..EmitterConfig::default()
        };
        let mut emitter = ParticleEmitter::new(config);
        emitter.set_position([0.0, 0.0, 0.0]);
        emitter.burst(1);

        // Update for 1 second
        for _ in 0..60 {
            emitter.update(1.0 / 60.0);
        }

        let particles = emitter.active_particles();
        assert_eq!(particles.len(), 1);

        let p = &particles[0];
        // X should have moved ~1.0 (velocity 1.0 for 1 second)
        assert!(
            (p.position[0] - 1.0).abs() < 0.1,
            "X position {} should be ~1.0",
            p.position[0]
        );
        // Y should have moved down due to gravity: -0.5 * g * t^2 = -0.5 * 10 * 1 = -5
        assert!(
            (p.position[1] - (-5.0)).abs() < 1.0,
            "Y position {} should be ~-5.0",
            p.position[1]
        );
    }

    #[test]
    fn test_color_interpolation() {
        let config = EmitterConfig {
            lifetime: (1.0, 1.0),
            color_start: [1.0, 0.0, 0.0, 1.0], // Red
            color_end: [0.0, 0.0, 1.0, 0.0],   // Blue, transparent
            ..EmitterConfig::default()
        };
        let mut emitter = ParticleEmitter::new(config);
        emitter.burst(1);

        // At t=0, color should be start color
        let p = &emitter.active_particles()[0];
        assert!(
            (p.color[0] - 1.0).abs() < 0.01,
            "Red should be 1.0 at start"
        );

        // Update halfway through lifetime
        emitter.update(0.5);
        let p = &emitter.active_particles()[0];
        // Color should be interpolated
        assert!(
            (p.color[0] - 0.5).abs() < 0.1,
            "Red {} should be ~0.5 at halfway",
            p.color[0]
        );
        assert!(
            (p.color[2] - 0.5).abs() < 0.1,
            "Blue {} should be ~0.5 at halfway",
            p.color[2]
        );
    }

    #[test]
    fn test_presets() {
        // Just verify presets can be constructed and used
        let _explosion = EmitterConfig::explosion();
        let _ambient = EmitterConfig::ambient();
        let _sparks = EmitterConfig::sparks();

        // Test that each preset produces valid particles
        let mut emitter = ParticleEmitter::new(EmitterConfig::explosion());
        emitter.burst(10);
        assert_eq!(emitter.active_count(), 10);

        let mut emitter = ParticleEmitter::new(EmitterConfig::ambient());
        emitter.start();
        emitter.update(0.5);
        assert!(emitter.active_count() > 0);

        let mut emitter = ParticleEmitter::new(EmitterConfig::sparks());
        emitter.start();
        emitter.update(0.1);
        assert!(emitter.active_count() > 0);
    }

    #[test]
    fn test_deterministic_with_seed() {
        let mut emitter1 = ParticleEmitter::new(EmitterConfig::default());
        emitter1.set_seed(42);
        emitter1.burst(5);
        let particles1: Vec<_> = emitter1.active_particles().to_vec();

        let mut emitter2 = ParticleEmitter::new(EmitterConfig::default());
        emitter2.set_seed(42);
        emitter2.burst(5);
        let particles2: Vec<_> = emitter2.active_particles().to_vec();

        for (p1, p2) in particles1.iter().zip(particles2.iter()) {
            assert_eq!(p1.position, p2.position, "Positions should match with same seed");
            assert_eq!(p1.velocity, p2.velocity, "Velocities should match with same seed");
            assert_eq!(p1.life, p2.life, "Lifetimes should match with same seed");
        }
    }
}
