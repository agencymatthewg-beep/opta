//! WGSL shader module loading and management.
//!
//! This module provides:
//! - `ShaderLoader` - Load and cache WGSL shaders from various sources
//! - `ShaderPreprocessor` - Process shaders with #include and #define support
//! - `ShaderLibrary` - Pre-configured library with common includes
//! - `ShaderWatcher` - Hot-reload watcher for development (feature-gated)
//!
//! # Example
//!
//! ```ignore
//! use opta_render::shader::{ShaderLibrary, ShaderPreprocessor};
//!
//! // Create a library with built-in includes
//! let mut library = ShaderLibrary::new();
//!
//! // Register custom includes
//! library.register_include("my_utils.wgsl", "fn my_func() -> f32 { return 1.0; }");
//!
//! // Load a shader with preprocessing
//! let source = r#"
//!     #include "math.wgsl"
//!     #include "my_utils.wgsl"
//!
//!     @fragment
//!     fn fs_main() -> @location(0) vec4<f32> {
//!         let val = saturate(my_func());
//!         return vec4<f32>(val, val, val, 1.0);
//!     }
//! "#;
//!
//! let shader = library.load_shader(&device, "my_shader", source)?;
//! ```
//!
//! # Built-in Includes
//!
//! The `ShaderLibrary` comes with these pre-registered includes:
//!
//! - `math.wgsl` - Mathematical constants and utility functions
//!   - `PI`, `TAU`, `E` - Common constants
//!   - `saturate(x)` - Clamp to [0, 1]
//!   - `lerp(a, b, t)` - Linear interpolation
//!   - `remap(value, in_min, in_max, out_min, out_max)` - Remap value between ranges
//!
//! - `transforms.wgsl` - Transformation matrices
//!   - `rotate2d(angle)` - 2D rotation matrix
//!   - `rotate3d_x(angle)`, `rotate3d_y(angle)`, `rotate3d_z(angle)` - 3D rotation matrices
//!
//! # Hot Reload
//!
//! Enable the `shader-hot-reload` feature for development hot-reload:
//!
//! ```toml
//! [dependencies]
//! opta-render = { version = "8.0", features = ["shader-hot-reload"] }
//! ```
//!
//! Then use `ShaderWatcher` to detect changes:
//!
//! ```ignore
//! use opta_render::shader::ShaderWatcher;
//!
//! let watcher = ShaderWatcher::new(Path::new("shaders"))?;
//!
//! // In render loop:
//! for changed_path in watcher.poll_changes() {
//!     // Reload the changed shader
//!     library.reload_shader(&device, shader_name)?;
//! }
//! ```

mod error;
mod library;
mod loader;
mod preprocessor;
mod watcher;

// Re-export main types
pub use error::{PreprocessError, ShaderError, ShaderResult};
pub use library::{
    ShaderLibrary, COLOR_INCLUDE, GLASS_INCLUDE, MATH_INCLUDE, NOISE_INCLUDE, SDF_INCLUDE,
    TRANSFORMS_INCLUDE,
};
pub use loader::{ShaderLoader, ShaderMeta, ShaderSource};
pub use preprocessor::ShaderPreprocessor;
pub use watcher::ShaderWatcher;

#[cfg(not(feature = "shader-hot-reload"))]
pub use watcher::ShaderWatcherError;
