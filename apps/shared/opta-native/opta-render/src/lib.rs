//! # opta-render
//!
//! GPU rendering crate for Opta using wgpu with Metal backend optimization.
//!
//! This crate provides:
//! - GPU context initialization with Metal backend
//! - Surface management for SwiftUI/UIKit integration
//! - Apple Silicon-specific optimizations
//! - C-compatible FFI for Swift integration
//!
//! ## Architecture
//!
//! The rendering architecture follows Apple best practices:
//!
//! 1. **Metal Backend Only**: Uses wgpu's Metal backend directly, avoiding
//!    `MoltenVK` overhead for optimal performance.
//!
//! 2. **Unified Memory Architecture**: Aware of Apple Silicon's UMA,
//!    avoiding redundant staging buffers where possible.
//!
//! 3. **Tile-Based Deferred Rendering**: Optimized for Apple's TBDR
//!    architecture with proper `LoadOp`/`StoreOp` configuration.
//!
//! 4. **Inverted Control Loop**: The Swift host drives the render loop
//!    via `CADisplayLink`; Rust responds to render requests.
//!
//! ## Usage
//!
//! ### From Rust
//!
//! ```ignore
//! use opta_render::{GpuContext, RenderSurface, SurfaceConfig};
//!
//! // Initialize GPU
//! let gpu = GpuContext::new()?;
//!
//! // Create surface (requires window handle)
//! let config = SurfaceConfig::from_logical_size(400.0, 300.0, 2.0);
//! let surface = RenderSurface::new(&gpu, window, config)?;
//!
//! // Render loop
//! let frame = surface.get_current_texture()?;
//! // ... render commands ...
//! frame.present();
//! ```
//!
//! ### From Swift (via FFI)
//!
//! ```swift
//! // Initialize GPU context
//! let ctx = opta_render_init()
//!
//! // Configure surface with MTKView pointer
//! opta_render_configure_surface(ctx, mtkView, width, height, scale)
//!
//! // In CADisplayLink callback
//! opta_render_frame_begin(ctx)
//! // ... render ...
//! opta_render_frame_end(ctx)
//!
//! // Cleanup
//! opta_render_destroy(ctx)
//! ```
//!
//! ## Apple Platform Considerations
//!
//! ### `CAMetalLayer` Requirement
//!
//! The view passed to `opta_render_configure_surface` MUST be backed by
//! `CAMetalLayer`. For iOS, subclass `UIView` and override `layerClass`:
//!
//! ```swift
//! class MetalRenderView: UIView {
//!     override class var layerClass: AnyClass {
//!         return CAMetalLayer.self
//!     }
//! }
//! ```
//!
//! ### `ProMotion` (120Hz)
//!
//! Configure `CADisplayLink` with `preferredFrameRateRange` for 120Hz:
//!
//! ```swift
//! if #available(iOS 15.0, *) {
//!     displayLink.preferredFrameRateRange = CAFrameRateRange(
//!         minimum: 80, maximum: 120, preferred: 120
//!     )
//! }
//! ```
//!
//! ### Thread Safety
//!
//! - Initialize GPU context on main thread
//! - Render on `CADisplayLink`/`CVDisplayLink` thread
//! - Use proper synchronization for resize (main thread) during render
//!
//! ## Feature Flags
//!
//! - `promotion`: Enable 120Hz `ProMotion` support utilities
//! - `compute`: Enable compute shader support with Apple Silicon limits
//! - `shader-hot-reload`: Enable shader file watching for development

#![warn(missing_docs)]
#![warn(clippy::all)]
#![warn(clippy::pedantic)]
#![allow(clippy::module_name_repetitions)]
// Allow common patterns in rendering code
#![allow(clippy::cast_possible_truncation)]
#![allow(clippy::cast_sign_loss)]
#![allow(clippy::cast_lossless)]
#![allow(clippy::must_use_candidate)]
// Allow doc comments without backticks for common terms
#![allow(clippy::doc_markdown)]
// FFI requires these patterns
#![allow(clippy::not_unsafe_ptr_arg_deref)]
#![allow(clippy::ptr_as_ptr)]
#![allow(clippy::missing_safety_doc)]
// Additional pedantic lints that are too strict for this crate
#![allow(clippy::missing_errors_doc)]
#![allow(clippy::field_reassign_with_default)]
#![allow(clippy::missing_fields_in_debug)]
#![allow(clippy::pub_underscore_fields)]
#![allow(clippy::return_self_not_must_use)]
#![allow(clippy::needless_pass_by_value)]

pub mod adaptive;
pub mod animation;
pub mod autorelease;
pub mod bridge;
pub mod buffer;

// Platform-specific rendering integrations
pub mod platform;
pub mod components;
pub mod debug;
pub mod depth;
pub mod effects;
pub mod encoder;
pub mod error;
pub mod ffi;
#[allow(clippy::cast_precision_loss)]
pub mod ffi_panels;
pub mod haptics;
pub mod instance;
pub mod memory;
pub mod pipeline;
pub mod quality;
pub mod shader;
pub mod state;
pub mod surface;
pub mod texture;
pub mod theme;
pub mod timing;

// Accessibility module
pub mod accessibility;

// Re-export main types from Plan 60-02
pub use buffer::{IndexBuffer, Vertex2D, VertexBuffer};
pub use depth::DepthBuffer;
pub use encoder::{FrameEncoder, QueueExt};
pub use error::{RenderError, RenderResult};
pub use instance::{GpuCapabilities, GpuContext};
pub use pipeline::{RenderPipeline2D, Uniforms};
pub use surface::{RenderSurface, SurfaceConfig};

// Re-export types from Plan 60-03
pub use autorelease::{with_autorelease_pool, AutoreleaseGuard};
pub use bridge::{FrameResult, RenderConfig, RenderStatus};
pub use quality::{QualityLevel, QualitySettings, ShadowQuality};
pub use state::{RenderState, RenderStateInner};
pub use timing::{FrameInfo, FrameTiming};

// Re-export FFI types for external use
pub use ffi::{OptaGpuCapabilities, OptaRenderContext, OptaRenderResult};

// Re-export shader types from Plan 61-01 and 61-02
pub use shader::{
    PreprocessError, ShaderError, ShaderLibrary, ShaderLoader, ShaderPreprocessor, ShaderResult,
    ShaderSource, ShaderWatcher,
    // Shader includes from Plan 61-02 and 61-03
    COLOR_INCLUDE, GLASS_INCLUDE, MATH_INCLUDE, NOISE_INCLUDE, SDF_INCLUDE, TRANSFORMS_INCLUDE,
};

// Re-export effects types from Plan 61-03
pub use effects::{BloomConfig, BloomEffect, PlasmaConfig, PlasmaEffect};

// Re-export haptics types from Plan 62-02
pub use haptics::{
    haptic_explosion, haptic_pulse, haptic_tap, haptic_wake_up, haptic_warning,
    set_haptic_callback, trigger_haptic, HapticCallback, HapticType,
};

// Re-export components types from Plan 63-01 and 63-02
pub use components::{
    // Ring component (Plan 63-01)
    generate_torus_geometry, OptaRing, RingConfig, RingState, RingUniforms, RingVertex,
    // Ring quality and spring physics (Plan 77-01)
    RingQualityLevel, RingSpringState, SpringConfig as RingSpringConfig, SpringValue, SpringVec3,
    // Glass panel component (Plan 63-02)
    GlassPanel, GlassPanelConfig, GlassPanelUniforms, PanelVertex,
};

// Re-export animation types from Plan 64-01
pub use animation::{Spring, Spring2D, Spring3D, SpringColor, SpringConfig, DT_60HZ, DT_120HZ};

// Re-export debug types from Plan 66-01
pub use debug::DebugOverlay;

// Re-export adaptive quality types from Plan 77-01
pub use adaptive::{
    AdaptiveQuality, FrameStats, RollingStats, ThermalState, quality_level_to_ring_quality,
    ring_quality_to_quality_level,
};

// Re-export memory pool types from Plan 66-02
pub use memory::{BufferPool, BufferSizeClass, PoolStats};

// Re-export texture types from Plan 66-02
pub use texture::{TextureData, TextureError, TextureFormat, TextureLoader};

// Re-export platform types from Plan 67-02
#[cfg(target_os = "linux")]
pub use platform::linux::{get_vulkan_adapter_info, is_vulkan_available};
pub use platform::recommended_backend;

// Re-export theme types from Plan 78-02
pub use theme::{ColorTemperature, EffectPreset, PresetConfig, TemperatureColors};

// Re-export accessibility types from Plan 78-02
pub use accessibility::{
    ContrastPreference, HighContrastConfig, MotionPreference, ReducedMotionConfig,
};

/// Crate version string.
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

/// Check if running on Apple Silicon (Unified Memory Architecture).
///
/// Returns true if the GPU appears to be Apple Silicon based on naming.
#[must_use]
pub fn is_apple_silicon() -> bool {
    if let Ok(ctx) = GpuContext::new() {
        ctx.is_unified_memory()
    } else {
        // If we can't create a context, we're probably not on Apple
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_version() {
        assert!(!VERSION.is_empty());
        assert!(VERSION.starts_with("8."));
    }
}
