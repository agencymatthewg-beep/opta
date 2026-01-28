//! Accessibility features for Opta.
//!
//! This module provides accessibility support including:
//! - Reduced motion mode for motion-sensitive users
//! - High contrast mode for visibility
//!
//! # Reduced Motion
//!
//! Respects system preferences for reduced motion:
//!
//! ```ignore
//! use opta_render::accessibility::{MotionPreference, ReducedMotionConfig};
//!
//! let config = ReducedMotionConfig::for_preference(MotionPreference::Reduced);
//! if config.disable_ring_spin {
//!     // Skip rotation animation
//! }
//! ```
//!
//! # High Contrast
//!
//! Increases visibility for users who need higher contrast:
//!
//! ```ignore
//! use opta_render::accessibility::{ContrastPreference, HighContrastConfig};
//!
//! let config = HighContrastConfig::for_preference(ContrastPreference::High);
//! if config.use_solid_backgrounds {
//!     // Skip glass blur, use solid colors
//! }
//! ```

pub mod contrast;
pub mod motion;

pub use contrast::{ContrastPreference, HighContrastConfig};
pub use motion::{MotionPreference, ReducedMotionConfig};
