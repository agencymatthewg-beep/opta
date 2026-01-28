//! Animation primitives for Opta.
//!
//! This module provides physics-based animation tools including:
//! - Spring: Natural spring physics with configurable tension, friction, and mass
//! - State Machine: Complex animation sequences with transitions and timing
//! - Particles: GPU-instanced particle system for visual effects
//!
//! Springs use semi-implicit Euler integration for stability and provide
//! presets for common animation styles (responsive, wobbly, stiff, gentle, molasses).
//!
//! # Example
//!
//! ```
//! use opta_render::animation::{Spring, SpringConfig, DT_60HZ};
//!
//! let mut spring = Spring::new(0.0, SpringConfig::RESPONSIVE);
//! spring.set_target(100.0);
//!
//! // Simulate at 60Hz
//! while !spring.is_at_rest() {
//!     spring.update(DT_60HZ);
//!     // Use spring.value() for animation
//! }
//! ```

mod particles;
mod spring;
mod state_machine;

pub use particles::{EmitterConfig, Particle, ParticleEmitter, ParticleRenderer, MAX_PARTICLES};
pub use spring::{Spring, Spring2D, Spring3D, SpringColor, SpringConfig};
pub use state_machine::{ring_states, AnimationState, AnimationStateMachine, StateId, Transition};

/// Time delta for 60Hz animation (approximately 16.67ms).
pub const DT_60HZ: f32 = 1.0 / 60.0;

/// Time delta for 120Hz animation (approximately 8.33ms).
/// Useful for ProMotion displays on Apple devices.
pub const DT_120HZ: f32 = 1.0 / 120.0;
