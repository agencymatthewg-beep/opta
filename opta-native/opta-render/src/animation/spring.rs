//! Spring physics simulation for natural animations.
//!
//! Based on damped harmonic oscillator: F = -k*x - d*v
//!
//! This module provides spring-based animation primitives that create
//! natural, physics-based motion. Springs are configured with stiffness
//! (tension), damping (friction), and mass to achieve various animation styles.
//!
//! # Example
//!
//! ```
//! use opta_render::animation::{Spring, SpringConfig};
//!
//! let mut spring = Spring::new(0.0, SpringConfig::RESPONSIVE);
//! spring.set_target(100.0);
//!
//! // Simulate at 60Hz
//! for _ in 0..120 {
//!     spring.update(1.0 / 60.0);
//! }
//!
//! assert!((spring.value() - 100.0).abs() < 0.1);
//! ```

/// Configuration for spring physics simulation.
///
/// Springs are configured using three main parameters:
/// - **stiffness** (k): How "tight" the spring is. Higher = faster response.
/// - **damping** (d): How quickly oscillations decay. Higher = less bouncy.
/// - **mass** (m): Affects acceleration. Higher = slower, more momentum.
///
/// The critical damping ratio is: ζ = d / (2 * √(k * m))
/// - ζ < 1: Underdamped (bouncy)
/// - ζ = 1: Critically damped (fastest without oscillation)
/// - ζ > 1: Overdamped (slow approach)
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct SpringConfig {
    /// Spring stiffness coefficient (tension). Higher values = faster response.
    /// Typical range: 50-500.
    pub stiffness: f32,

    /// Damping coefficient (friction). Higher values = less oscillation.
    /// Typical range: 5-50.
    pub damping: f32,

    /// Mass of the simulated object. Higher values = more momentum.
    /// Typical range: 0.5-5.0.
    pub mass: f32,

    /// Velocity threshold below which the spring is considered at rest.
    /// Default: 0.01
    pub rest_velocity: f32,

    /// Displacement threshold below which the spring is considered at rest.
    /// Default: 0.01
    pub rest_displacement: f32,
}

impl Default for SpringConfig {
    fn default() -> Self {
        Self::RESPONSIVE
    }
}

impl SpringConfig {
    /// Responsive spring: Quick response with minimal overshoot (tension: 170, friction: 26).
    /// Good for UI interactions that need to feel immediate.
    pub const RESPONSIVE: Self = Self {
        stiffness: 170.0,
        damping: 26.0,
        mass: 1.0,
        rest_velocity: 0.01,
        rest_displacement: 0.01,
    };

    /// Wobbly spring: Noticeable bounce and playful feel (tension: 180, friction: 12).
    /// Good for attention-grabbing animations.
    pub const WOBBLY: Self = Self {
        stiffness: 180.0,
        damping: 12.0,
        mass: 1.0,
        rest_velocity: 0.01,
        rest_displacement: 0.01,
    };

    /// Stiff spring: Very quick with almost no overshoot (tension: 210, friction: 30).
    /// Good for snappy micro-interactions.
    pub const STIFF: Self = Self {
        stiffness: 210.0,
        damping: 30.0,
        mass: 1.0,
        rest_velocity: 0.01,
        rest_displacement: 0.01,
    };

    /// Gentle spring: Slow, smooth, and elegant motion (tension: 120, friction: 14).
    /// Good for background or ambient animations.
    pub const GENTLE: Self = Self {
        stiffness: 120.0,
        damping: 14.0,
        mass: 1.0,
        rest_velocity: 0.01,
        rest_displacement: 0.01,
    };

    /// Molasses spring: Very slow and heavy feeling (tension: 100, friction: 30, mass: 2).
    /// Good for dramatic reveals or weighty objects.
    pub const MOLASSES: Self = Self {
        stiffness: 100.0,
        damping: 30.0,
        mass: 2.0,
        rest_velocity: 0.01,
        rest_displacement: 0.01,
    };

    /// Create a spring config from tension and friction values.
    ///
    /// This is a convenience constructor that maps intuitive parameters
    /// to the underlying physics model:
    /// - `tension` maps directly to stiffness
    /// - `friction` maps directly to damping
    ///
    /// # Arguments
    ///
    /// * `tension` - How "tight" the spring is (maps to stiffness)
    /// * `friction` - How much resistance to motion (maps to damping)
    #[must_use]
    pub fn from_tension_friction(tension: f32, friction: f32) -> Self {
        Self {
            stiffness: tension,
            damping: friction,
            mass: 1.0,
            rest_velocity: 0.01,
            rest_displacement: 0.01,
        }
    }

    /// Create a custom spring config with all parameters.
    #[must_use]
    pub fn custom(stiffness: f32, damping: f32, mass: f32) -> Self {
        Self {
            stiffness,
            damping,
            mass,
            rest_velocity: 0.01,
            rest_displacement: 0.01,
        }
    }

    /// Set custom rest thresholds.
    #[must_use]
    pub fn with_rest_thresholds(mut self, velocity: f32, displacement: f32) -> Self {
        self.rest_velocity = velocity;
        self.rest_displacement = displacement;
        self
    }

    /// Calculate the damping ratio (zeta).
    ///
    /// - < 1: Underdamped (bouncy)
    /// - = 1: Critically damped
    /// - > 1: Overdamped
    #[must_use]
    pub fn damping_ratio(&self) -> f32 {
        self.damping / (2.0 * (self.stiffness * self.mass).sqrt())
    }
}

/// A 1D spring for animating a single value.
///
/// The spring uses semi-implicit Euler integration for stability,
/// which is important for maintaining energy conservation over time.
#[derive(Debug, Clone)]
pub struct Spring {
    config: SpringConfig,
    value: f32,
    target: f32,
    velocity: f32,
    at_rest: bool,
}

impl Spring {
    /// Create a new spring at the given initial value.
    #[must_use]
    pub fn new(initial: f32, config: SpringConfig) -> Self {
        Self {
            config,
            value: initial,
            target: initial,
            velocity: 0.0,
            at_rest: true,
        }
    }

    /// Set the target value the spring should animate towards.
    pub fn set_target(&mut self, target: f32) {
        if (self.target - target).abs() > self.config.rest_displacement {
            self.target = target;
            self.at_rest = false;
        }
    }

    /// Immediately set the current value without animation.
    pub fn set_immediate(&mut self, value: f32) {
        self.value = value;
        self.target = value;
        self.velocity = 0.0;
        self.at_rest = true;
    }

    /// Get the current animated value.
    #[must_use]
    pub fn value(&self) -> f32 {
        self.value
    }

    /// Get the current target value.
    #[must_use]
    pub fn target(&self) -> f32 {
        self.target
    }

    /// Get the current velocity.
    #[must_use]
    pub fn velocity(&self) -> f32 {
        self.velocity
    }

    /// Check if the spring has come to rest.
    #[must_use]
    pub fn is_at_rest(&self) -> bool {
        self.at_rest
    }

    /// Update the spring simulation by the given time delta.
    ///
    /// Uses semi-implicit Euler integration for better stability
    /// compared to explicit Euler, especially at larger time steps.
    ///
    /// # Arguments
    ///
    /// * `dt` - Time delta in seconds (e.g., 1/60 for 60Hz)
    pub fn update(&mut self, dt: f32) {
        if self.at_rest {
            return;
        }

        let k = self.config.stiffness;
        let d = self.config.damping;
        let m = self.config.mass;

        // Displacement from target
        let x = self.value - self.target;

        // Spring force: F = -kx - dv
        // Acceleration: a = F/m = (-kx - dv) / m
        let acceleration = (-k * x - d * self.velocity) / m;

        // Semi-implicit Euler: update velocity first, then position
        self.velocity += acceleration * dt;
        self.value += self.velocity * dt;

        // Check if at rest
        let displacement = (self.value - self.target).abs();
        let velocity = self.velocity.abs();

        if displacement < self.config.rest_displacement
            && velocity < self.config.rest_velocity
        {
            self.value = self.target;
            self.velocity = 0.0;
            self.at_rest = true;
        }
    }
}

/// A 2D spring for animating x,y coordinates.
#[derive(Debug, Clone)]
pub struct Spring2D {
    x: Spring,
    y: Spring,
}

impl Spring2D {
    /// Create a new 2D spring at the given initial position.
    #[must_use]
    pub fn new(initial_x: f32, initial_y: f32, config: SpringConfig) -> Self {
        Self {
            x: Spring::new(initial_x, config),
            y: Spring::new(initial_y, config),
        }
    }

    /// Set the target position.
    pub fn set_target(&mut self, x: f32, y: f32) {
        self.x.set_target(x);
        self.y.set_target(y);
    }

    /// Immediately set the current position without animation.
    pub fn set_immediate(&mut self, x: f32, y: f32) {
        self.x.set_immediate(x);
        self.y.set_immediate(y);
    }

    /// Get the current position as (x, y).
    #[must_use]
    pub fn value(&self) -> (f32, f32) {
        (self.x.value(), self.y.value())
    }

    /// Get the current X value.
    #[must_use]
    pub fn x(&self) -> f32 {
        self.x.value()
    }

    /// Get the current Y value.
    #[must_use]
    pub fn y(&self) -> f32 {
        self.y.value()
    }

    /// Check if the spring has come to rest.
    #[must_use]
    pub fn is_at_rest(&self) -> bool {
        self.x.is_at_rest() && self.y.is_at_rest()
    }

    /// Update the spring simulation.
    pub fn update(&mut self, dt: f32) {
        self.x.update(dt);
        self.y.update(dt);
    }
}

/// A 3D spring for animating x,y,z coordinates.
#[derive(Debug, Clone)]
pub struct Spring3D {
    x: Spring,
    y: Spring,
    z: Spring,
}

impl Spring3D {
    /// Create a new 3D spring at the given initial position.
    #[must_use]
    pub fn new(initial_x: f32, initial_y: f32, initial_z: f32, config: SpringConfig) -> Self {
        Self {
            x: Spring::new(initial_x, config),
            y: Spring::new(initial_y, config),
            z: Spring::new(initial_z, config),
        }
    }

    /// Set the target position.
    pub fn set_target(&mut self, x: f32, y: f32, z: f32) {
        self.x.set_target(x);
        self.y.set_target(y);
        self.z.set_target(z);
    }

    /// Immediately set the current position without animation.
    pub fn set_immediate(&mut self, x: f32, y: f32, z: f32) {
        self.x.set_immediate(x);
        self.y.set_immediate(y);
        self.z.set_immediate(z);
    }

    /// Get the current position as (x, y, z).
    #[must_use]
    pub fn value(&self) -> (f32, f32, f32) {
        (self.x.value(), self.y.value(), self.z.value())
    }

    /// Get the current X value.
    #[must_use]
    pub fn x(&self) -> f32 {
        self.x.value()
    }

    /// Get the current Y value.
    #[must_use]
    pub fn y(&self) -> f32 {
        self.y.value()
    }

    /// Get the current Z value.
    #[must_use]
    pub fn z(&self) -> f32 {
        self.z.value()
    }

    /// Check if the spring has come to rest.
    #[must_use]
    pub fn is_at_rest(&self) -> bool {
        self.x.is_at_rest() && self.y.is_at_rest() && self.z.is_at_rest()
    }

    /// Update the spring simulation.
    pub fn update(&mut self, dt: f32) {
        self.x.update(dt);
        self.y.update(dt);
        self.z.update(dt);
    }
}

/// A color spring for animating RGBA colors.
///
/// Each channel (red, green, blue, alpha) is animated independently.
#[derive(Debug, Clone)]
pub struct SpringColor {
    r: Spring,
    g: Spring,
    b: Spring,
    a: Spring,
}

impl SpringColor {
    /// Create a new color spring with initial RGBA values (0.0-1.0 range).
    #[must_use]
    pub fn new(r: f32, g: f32, b: f32, a: f32, config: SpringConfig) -> Self {
        Self {
            r: Spring::new(r, config),
            g: Spring::new(g, config),
            b: Spring::new(b, config),
            a: Spring::new(a, config),
        }
    }

    /// Create a new color spring from a packed RGBA u32 value.
    #[must_use]
    pub fn from_rgba_u32(rgba: u32, config: SpringConfig) -> Self {
        let r = ((rgba >> 24) & 0xFF) as f32 / 255.0;
        let g = ((rgba >> 16) & 0xFF) as f32 / 255.0;
        let b = ((rgba >> 8) & 0xFF) as f32 / 255.0;
        let a = (rgba & 0xFF) as f32 / 255.0;
        Self::new(r, g, b, a, config)
    }

    /// Set the target color (RGBA values in 0.0-1.0 range).
    pub fn set_target(&mut self, r: f32, g: f32, b: f32, a: f32) {
        self.r.set_target(r);
        self.g.set_target(g);
        self.b.set_target(b);
        self.a.set_target(a);
    }

    /// Set the target color from a packed RGBA u32.
    pub fn set_target_rgba_u32(&mut self, rgba: u32) {
        let r = ((rgba >> 24) & 0xFF) as f32 / 255.0;
        let g = ((rgba >> 16) & 0xFF) as f32 / 255.0;
        let b = ((rgba >> 8) & 0xFF) as f32 / 255.0;
        let a = (rgba & 0xFF) as f32 / 255.0;
        self.set_target(r, g, b, a);
    }

    /// Immediately set the current color without animation.
    pub fn set_immediate(&mut self, r: f32, g: f32, b: f32, a: f32) {
        self.r.set_immediate(r);
        self.g.set_immediate(g);
        self.b.set_immediate(b);
        self.a.set_immediate(a);
    }

    /// Get the current color as (r, g, b, a) in 0.0-1.0 range.
    #[must_use]
    pub fn value(&self) -> (f32, f32, f32, f32) {
        (
            self.r.value().clamp(0.0, 1.0),
            self.g.value().clamp(0.0, 1.0),
            self.b.value().clamp(0.0, 1.0),
            self.a.value().clamp(0.0, 1.0),
        )
    }

    /// Get the current color as a packed RGBA u32.
    #[must_use]
    pub fn value_rgba_u32(&self) -> u32 {
        let (r, g, b, a) = self.value();
        let r = (r * 255.0) as u32;
        let g = (g * 255.0) as u32;
        let b = (b * 255.0) as u32;
        let a = (a * 255.0) as u32;
        (r << 24) | (g << 16) | (b << 8) | a
    }

    /// Get the current color as an array [r, g, b, a].
    #[must_use]
    pub fn value_array(&self) -> [f32; 4] {
        let (r, g, b, a) = self.value();
        [r, g, b, a]
    }

    /// Check if the spring has come to rest.
    #[must_use]
    pub fn is_at_rest(&self) -> bool {
        self.r.is_at_rest() && self.g.is_at_rest() && self.b.is_at_rest() && self.a.is_at_rest()
    }

    /// Update the spring simulation.
    pub fn update(&mut self, dt: f32) {
        self.r.update(dt);
        self.g.update(dt);
        self.b.update(dt);
        self.a.update(dt);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const DT_60HZ: f32 = 1.0 / 60.0;
    const DT_120HZ: f32 = 1.0 / 120.0;

    #[test]
    fn test_spring_reaches_target() {
        let mut spring = Spring::new(0.0, SpringConfig::RESPONSIVE);
        spring.set_target(100.0);

        // Simulate 2 seconds at 120Hz
        for _ in 0..240 {
            spring.update(DT_120HZ);
        }

        // Should have reached target within tolerance
        assert!(
            (spring.value() - 100.0).abs() < 0.1,
            "Spring value {} should be close to 100.0",
            spring.value()
        );
        assert!(spring.is_at_rest(), "Spring should be at rest");
    }

    #[test]
    fn test_spring_overshoots_with_wobbly() {
        let mut spring = Spring::new(0.0, SpringConfig::WOBBLY);
        spring.set_target(100.0);

        let mut max_value = 0.0f32;

        // Simulate and track max value
        for _ in 0..240 {
            spring.update(DT_120HZ);
            max_value = max_value.max(spring.value());
        }

        // Wobbly spring should overshoot the target
        assert!(
            max_value > 100.0,
            "Wobbly spring should overshoot, max was {}",
            max_value
        );

        // But should eventually settle
        for _ in 0..480 {
            spring.update(DT_120HZ);
        }
        assert!(
            (spring.value() - 100.0).abs() < 0.1,
            "Spring should settle at target"
        );
    }

    #[test]
    fn test_spring_2d() {
        let mut spring = Spring2D::new(0.0, 0.0, SpringConfig::RESPONSIVE);
        spring.set_target(100.0, 50.0);

        // Simulate 2 seconds at 60Hz
        for _ in 0..120 {
            spring.update(DT_60HZ);
        }

        let (x, y) = spring.value();
        assert!(
            (x - 100.0).abs() < 0.1,
            "X value {} should be close to 100.0",
            x
        );
        assert!((y - 50.0).abs() < 0.1, "Y value {} should be close to 50.0", y);
    }

    #[test]
    fn test_spring_3d() {
        let mut spring = Spring3D::new(0.0, 0.0, 0.0, SpringConfig::STIFF);
        spring.set_target(10.0, 20.0, 30.0);

        // Simulate 2 seconds
        for _ in 0..240 {
            spring.update(DT_120HZ);
        }

        let (x, y, z) = spring.value();
        assert!((x - 10.0).abs() < 0.1);
        assert!((y - 20.0).abs() < 0.1);
        assert!((z - 30.0).abs() < 0.1);
        assert!(spring.is_at_rest());
    }

    #[test]
    fn test_spring_color() {
        let mut spring = SpringColor::new(0.0, 0.0, 0.0, 1.0, SpringConfig::GENTLE);
        spring.set_target(1.0, 0.5, 0.0, 1.0);

        // Simulate 3 seconds (gentle is slow)
        for _ in 0..360 {
            spring.update(DT_120HZ);
        }

        let (r, g, b, a) = spring.value();
        assert!((r - 1.0).abs() < 0.1, "Red {} should be close to 1.0", r);
        assert!((g - 0.5).abs() < 0.1, "Green {} should be close to 0.5", g);
        assert!((b - 0.0).abs() < 0.1, "Blue {} should be close to 0.0", b);
        assert!((a - 1.0).abs() < 0.1, "Alpha {} should be close to 1.0", a);
    }

    #[test]
    fn test_spring_color_u32() {
        let color = 0xFF8040FF_u32; // R=255, G=128, B=64, A=255
        let spring = SpringColor::from_rgba_u32(color, SpringConfig::RESPONSIVE);

        let (r, g, b, a) = spring.value();
        assert!((r - 1.0).abs() < 0.01);
        assert!((g - 0.502).abs() < 0.01); // 128/255 ≈ 0.502
        assert!((b - 0.251).abs() < 0.01); // 64/255 ≈ 0.251
        assert!((a - 1.0).abs() < 0.01);
    }

    #[test]
    fn test_set_immediate() {
        let mut spring = Spring::new(0.0, SpringConfig::RESPONSIVE);
        spring.set_target(100.0);
        spring.update(DT_60HZ);

        // Should be animating
        assert!(!spring.is_at_rest());

        // Set immediate
        spring.set_immediate(50.0);
        assert!(spring.is_at_rest());
        assert!((spring.value() - 50.0).abs() < 0.001);
        assert!((spring.target() - 50.0).abs() < 0.001);
    }

    #[test]
    fn test_damping_ratio() {
        // RESPONSIVE should be close to critically damped (ζ ≈ 1)
        let responsive_zeta = SpringConfig::RESPONSIVE.damping_ratio();
        assert!(
            (0.5..=1.5).contains(&responsive_zeta),
            "RESPONSIVE damping ratio {} should be near critical",
            responsive_zeta
        );

        // WOBBLY should be underdamped (ζ < 1)
        let wobbly_zeta = SpringConfig::WOBBLY.damping_ratio();
        assert!(
            wobbly_zeta < 1.0,
            "WOBBLY damping ratio {} should be underdamped",
            wobbly_zeta
        );
    }

    #[test]
    fn test_from_tension_friction() {
        let config = SpringConfig::from_tension_friction(200.0, 25.0);
        assert!((config.stiffness - 200.0).abs() < 0.001);
        assert!((config.damping - 25.0).abs() < 0.001);
        assert!((config.mass - 1.0).abs() < 0.001);
    }

    #[test]
    fn test_presets_all_settle() {
        let presets = [
            ("RESPONSIVE", SpringConfig::RESPONSIVE),
            ("WOBBLY", SpringConfig::WOBBLY),
            ("STIFF", SpringConfig::STIFF),
            ("GENTLE", SpringConfig::GENTLE),
            ("MOLASSES", SpringConfig::MOLASSES),
        ];

        for (name, config) in presets {
            let mut spring = Spring::new(0.0, config);
            spring.set_target(100.0);

            // Simulate 5 seconds (plenty of time for even MOLASSES)
            for _ in 0..600 {
                spring.update(DT_120HZ);
            }

            assert!(
                (spring.value() - 100.0).abs() < 0.1,
                "Preset {} did not settle at target, value = {}",
                name,
                spring.value()
            );
        }
    }
}
