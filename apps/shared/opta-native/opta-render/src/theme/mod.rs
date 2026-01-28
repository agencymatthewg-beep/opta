//! Theme and visual consistency system for Opta.
//!
//! This module provides:
//! - Color temperature system for consistent theming across app states
//! - Effect presets for different performance tiers
//!
//! # Color Temperature
//!
//! The color temperature system maps application states to visual appearance:
//!
//! ```ignore
//! use opta_render::theme::{ColorTemperature, TemperatureColors};
//!
//! // Get colors for active state
//! let colors = ColorTemperature::Active.get_colors();
//! let primary = colors.primary; // Vibrant Opta purple
//!
//! // Interpolate between states for smooth transitions
//! let blended = TemperatureColors::interpolate(&dormant, &active, 0.5);
//! ```
//!
//! # Effect Presets
//!
//! Presets configure visual effects for different performance targets:
//!
//! ```ignore
//! use opta_render::theme::{EffectPreset, PresetConfig};
//!
//! // Get preset for balanced performance
//! let config = EffectPreset::Balanced.get_config();
//! assert!(config.bloom_enabled);
//!
//! // Auto-detect best preset for current device
//! let preset = EffectPreset::for_device(&gpu_capabilities);
//! ```

pub mod color_temperature;
pub mod presets;

pub use color_temperature::{ColorTemperature, TemperatureColors};
pub use presets::{EffectPreset, PresetConfig};
