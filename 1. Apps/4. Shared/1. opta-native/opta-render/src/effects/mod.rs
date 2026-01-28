//! Visual effects module for Opta.
//!
//! This module provides GPU-accelerated visual effects including:
//! - Plasma: Organic, flowing color patterns using noise functions
//! - Bloom: Bright area glow with configurable threshold and blur
//!
//! # Example
//!
//! ```ignore
//! use opta_render::effects::{PlasmaEffect, PlasmaConfig, BloomEffect, BloomConfig};
//!
//! // Create plasma effect
//! let mut plasma = PlasmaEffect::new(&device, &queue, surface_format, 1920, 1080);
//! plasma.set_config(PlasmaConfig {
//!     speed: 1.5,
//!     scale: 2.0,
//!     color_shift: 0.3,
//! });
//!
//! // Create bloom effect
//! let mut bloom = BloomEffect::new(&device, surface_format, 1920, 1080);
//! bloom.set_config(BloomConfig {
//!     threshold: 0.8,
//!     intensity: 1.0,
//!     ..Default::default()
//! });
//! ```

mod bloom;
mod plasma;

pub use bloom::{BloomConfig, BloomEffect};
pub use plasma::{PlasmaConfig, PlasmaEffect};
