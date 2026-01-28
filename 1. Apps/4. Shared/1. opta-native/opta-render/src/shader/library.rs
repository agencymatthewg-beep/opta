//! Built-in shader library with common utilities.
//!
//! Provides a pre-configured shader loading system with common includes
//! for math operations, transforms, and other utilities.

use std::path::Path;

use wgpu::{Device, ShaderModule};

use super::error::{ShaderError, ShaderResult};
use super::loader::ShaderLoader;
use super::preprocessor::ShaderPreprocessor;

/// Common math utilities for shaders.
pub const MATH_INCLUDE: &str = include_str!("../../shaders/includes/math.wgsl");

/// Transform utilities for shaders.
pub const TRANSFORMS_INCLUDE: &str = include_str!("../../shaders/includes/transforms.wgsl");

/// Signed Distance Field primitives and operations.
pub const SDF_INCLUDE: &str = include_str!("../../shaders/includes/sdf.wgsl");

/// Glass material with fresnel effect.
pub const GLASS_INCLUDE: &str = include_str!("../../shaders/includes/glass.wgsl");

/// Color space utilities (sRGB/linear, HSL, HSV).
pub const COLOR_INCLUDE: &str = include_str!("../../shaders/includes/color.wgsl");

/// Noise generation utilities (Perlin, Simplex, Worley, fbm).
pub const NOISE_INCLUDE: &str = include_str!("../../shaders/includes/noise.wgsl");

/// Built-in shader library with common utilities.
///
/// Provides:
/// - Pre-registered common includes (math, transforms)
/// - Shader loading with automatic preprocessing
/// - Caching of compiled shaders
#[derive(Debug)]
pub struct ShaderLibrary {
    /// The preprocessor with registered includes.
    preprocessor: ShaderPreprocessor,
    /// The shader loader with cache.
    loader: ShaderLoader,
}

impl Default for ShaderLibrary {
    fn default() -> Self {
        Self::new()
    }
}

impl ShaderLibrary {
    /// Create a new shader library with built-in includes.
    #[must_use]
    pub fn new() -> Self {
        let mut preprocessor = ShaderPreprocessor::new();

        // Register built-in includes
        preprocessor.register_include("math.wgsl", MATH_INCLUDE);
        preprocessor.register_include("transforms.wgsl", TRANSFORMS_INCLUDE);
        preprocessor.register_include("sdf.wgsl", SDF_INCLUDE);
        preprocessor.register_include("glass.wgsl", GLASS_INCLUDE);
        preprocessor.register_include("color.wgsl", COLOR_INCLUDE);
        preprocessor.register_include("noise.wgsl", NOISE_INCLUDE);

        Self {
            preprocessor,
            loader: ShaderLoader::new(),
        }
    }

    /// Create a shader library with a custom shader directory.
    pub fn with_shader_dir(dir: impl AsRef<Path>) -> Self {
        let mut preprocessor = ShaderPreprocessor::new();

        // Register built-in includes
        preprocessor.register_include("math.wgsl", MATH_INCLUDE);
        preprocessor.register_include("transforms.wgsl", TRANSFORMS_INCLUDE);
        preprocessor.register_include("sdf.wgsl", SDF_INCLUDE);
        preprocessor.register_include("glass.wgsl", GLASS_INCLUDE);
        preprocessor.register_include("color.wgsl", COLOR_INCLUDE);
        preprocessor.register_include("noise.wgsl", NOISE_INCLUDE);

        Self {
            preprocessor,
            loader: ShaderLoader::with_shader_dir(dir),
        }
    }

    /// Get a mutable reference to the preprocessor for adding custom includes.
    pub fn preprocessor_mut(&mut self) -> &mut ShaderPreprocessor {
        &mut self.preprocessor
    }

    /// Get a reference to the preprocessor.
    #[must_use]
    pub fn preprocessor(&self) -> &ShaderPreprocessor {
        &self.preprocessor
    }

    /// Get a mutable reference to the loader.
    pub fn loader_mut(&mut self) -> &mut ShaderLoader {
        &mut self.loader
    }

    /// Get a reference to the loader.
    #[must_use]
    pub fn loader(&self) -> &ShaderLoader {
        &self.loader
    }

    /// Register a custom include.
    pub fn register_include(&mut self, name: impl Into<String>, source: impl Into<String>) {
        self.preprocessor.register_include(name, source);
    }

    /// Add a define macro.
    pub fn define(&mut self, name: impl Into<String>, value: impl Into<String>) {
        self.preprocessor.define(name, value);
    }

    /// Load a shader with preprocessing.
    ///
    /// The shader source is preprocessed to resolve includes and defines,
    /// then compiled and cached.
    pub fn load_shader(
        &mut self,
        device: &Device,
        name: &str,
        source: &str,
    ) -> ShaderResult<&ShaderModule> {
        self.loader
            .load_with_preprocessing(device, name, source, &self.preprocessor)
    }

    /// Load a shader from an embedded source with preprocessing.
    pub fn load_embedded(
        &mut self,
        device: &Device,
        name: &str,
        source: &'static str,
    ) -> ShaderResult<&ShaderModule> {
        self.loader
            .load_with_preprocessing(device, name, source, &self.preprocessor)
    }

    /// Load a shader from a file with preprocessing.
    ///
    /// The file is read, preprocessed, and then compiled.
    pub fn load_file(
        &mut self,
        device: &Device,
        name: &str,
        path: &Path,
    ) -> ShaderResult<&ShaderModule> {
        // Read the file
        let full_path = if let Some(dir) = self.loader.shader_dir() {
            dir.join(path)
        } else {
            path.to_path_buf()
        };

        let source = std::fs::read_to_string(&full_path)
            .map_err(|e| ShaderError::FileReadError(format!("{}: {}", full_path.display(), e)))?;

        self.load_shader(device, name, &source)
    }

    /// Load a shader without preprocessing.
    ///
    /// Use this for shaders that don't need include resolution.
    pub fn load_raw(
        &mut self,
        device: &Device,
        name: &str,
        source: &str,
    ) -> ShaderResult<&ShaderModule> {
        self.loader
            .load(device, name, super::loader::ShaderSource::Processed(source.to_string()))
    }

    /// Get a loaded shader.
    #[must_use]
    pub fn get_shader(&self, name: &str) -> Option<&ShaderModule> {
        self.loader.get(name)
    }

    /// Check if a shader is loaded.
    #[must_use]
    pub fn has_shader(&self, name: &str) -> bool {
        self.loader.is_cached(name)
    }

    /// Get the processed source for a shader.
    #[must_use]
    pub fn get_shader_source(&self, name: &str) -> Option<&str> {
        self.loader.get_source(name)
    }

    /// Reload a shader.
    pub fn reload_shader(&mut self, device: &Device, name: &str) -> ShaderResult<()> {
        self.loader.reload(device, name)
    }

    /// Remove a shader from the cache.
    pub fn remove_shader(&mut self, name: &str) -> Option<ShaderModule> {
        self.loader.remove(name)
    }

    /// Clear all cached shaders.
    pub fn clear(&mut self) {
        self.loader.clear();
    }

    /// Get the number of loaded shaders.
    #[must_use]
    pub fn shader_count(&self) -> usize {
        self.loader.len()
    }

    /// List all loaded shader names.
    pub fn shader_names(&self) -> impl Iterator<Item = &str> {
        self.loader.names()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_library_new() {
        let lib = ShaderLibrary::new();
        assert!(lib.preprocessor().has_include("math.wgsl"));
        assert!(lib.preprocessor().has_include("transforms.wgsl"));
        assert!(lib.preprocessor().has_include("sdf.wgsl"));
        assert!(lib.preprocessor().has_include("glass.wgsl"));
        assert!(lib.preprocessor().has_include("color.wgsl"));
        assert!(lib.preprocessor().has_include("noise.wgsl"));
    }

    #[test]
    fn test_register_custom_include() {
        let mut lib = ShaderLibrary::new();
        lib.register_include("custom.wgsl", "// Custom shader");
        assert!(lib.preprocessor().has_include("custom.wgsl"));
    }

    #[test]
    fn test_define_macro() {
        let mut lib = ShaderLibrary::new();
        lib.define("DEBUG", "true");
        assert_eq!(lib.preprocessor().define_count(), 1);
    }

    #[test]
    fn test_math_include_content() {
        assert!(MATH_INCLUDE.contains("PI"));
        assert!(MATH_INCLUDE.contains("saturate"));
        assert!(MATH_INCLUDE.contains("lerp"));
    }

    #[test]
    fn test_transforms_include_content() {
        assert!(TRANSFORMS_INCLUDE.contains("rotate2d"));
        assert!(TRANSFORMS_INCLUDE.contains("rotate3d_x"));
        assert!(TRANSFORMS_INCLUDE.contains("rotate3d_y"));
        assert!(TRANSFORMS_INCLUDE.contains("rotate3d_z"));
    }

    #[test]
    fn test_sdf_include_content() {
        assert!(SDF_INCLUDE.contains("sd_circle"));
        assert!(SDF_INCLUDE.contains("sd_box_2d"));
        assert!(SDF_INCLUDE.contains("sd_sphere"));
        assert!(SDF_INCLUDE.contains("sd_torus"));
        assert!(SDF_INCLUDE.contains("op_smooth_union"));
        assert!(SDF_INCLUDE.contains("op_smooth_subtraction"));
        assert!(SDF_INCLUDE.contains("op_smooth_intersection"));
    }

    #[test]
    fn test_glass_include_content() {
        assert!(GLASS_INCLUDE.contains("fresnel_schlick"));
        assert!(GLASS_INCLUDE.contains("GlassMaterial"));
        assert!(GLASS_INCLUDE.contains("glass_default"));
        assert!(GLASS_INCLUDE.contains("glass_blend"));
        assert!(GLASS_INCLUDE.contains("glass_intensity"));
    }

    #[test]
    fn test_color_include_content() {
        assert!(COLOR_INCLUDE.contains("linear_to_srgb"));
        assert!(COLOR_INCLUDE.contains("srgb_to_linear"));
        assert!(COLOR_INCLUDE.contains("rgb_to_hsl"));
        assert!(COLOR_INCLUDE.contains("hsl_to_rgb"));
        assert!(COLOR_INCLUDE.contains("blend_overlay"));
        assert!(COLOR_INCLUDE.contains("luminance"));
    }

    #[test]
    fn test_noise_include_content() {
        assert!(NOISE_INCLUDE.contains("hash21"));
        assert!(NOISE_INCLUDE.contains("hash22"));
        assert!(NOISE_INCLUDE.contains("hash31"));
        assert!(NOISE_INCLUDE.contains("value_noise_2d"));
        assert!(NOISE_INCLUDE.contains("perlin_noise_2d"));
        assert!(NOISE_INCLUDE.contains("fbm"));
        assert!(NOISE_INCLUDE.contains("simplex_noise_2d"));
        assert!(NOISE_INCLUDE.contains("worley_noise_2d"));
    }
}
