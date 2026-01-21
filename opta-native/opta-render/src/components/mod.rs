//! Visual components module for Opta.
//!
//! This module provides GPU-accelerated 3D components including:
//! - OptaRing: The central glass torus ring component
//! - GlassPanel: Frosted glass UI panels with blur effects
//!
//! # Example
//!
//! ```ignore
//! use opta_render::components::{OptaRing, RingConfig, RingState};
//!
//! // Create ring with default config
//! let mut ring = OptaRing::new(&device, &queue, surface_format, RingConfig::default());
//!
//! // Transition to active state
//! ring.set_state(RingState::Active);
//!
//! // Update animation
//! ring.update(delta_time);
//!
//! // Render
//! ring.render(&queue, &mut encoder, &color_view, &depth_view, view_proj_matrix);
//! ```

mod glass_panel;
mod ring;

pub use glass_panel::{GlassPanel, GlassPanelConfig, GlassPanelUniforms, PanelVertex};
pub use ring::{
    generate_torus_geometry, OptaRing, RingConfig, RingState, RingUniforms, RingVertex,
};
