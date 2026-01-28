//! Tests for the effects module.
//!
//! Note: Full GPU tests require a device context which is tested
//! in integration tests. These tests verify configuration defaults
//! and shader source availability.

use opta_render::effects::{BloomConfig, PlasmaConfig};
use opta_render::{ShaderLibrary, NOISE_INCLUDE};

// =============================================================================
// PlasmaConfig Tests
// =============================================================================

#[test]
fn test_plasma_config_default() {
    let config = PlasmaConfig::default();
    assert!((config.speed - 1.0).abs() < f32::EPSILON);
    assert!((config.scale - 1.0).abs() < f32::EPSILON);
    assert!((config.color_shift - 0.0).abs() < f32::EPSILON);
}

#[test]
fn test_plasma_config_custom() {
    let config = PlasmaConfig {
        speed: 2.0,
        scale: 0.5,
        color_shift: 0.75,
    };
    assert!((config.speed - 2.0).abs() < f32::EPSILON);
    assert!((config.scale - 0.5).abs() < f32::EPSILON);
    assert!((config.color_shift - 0.75).abs() < f32::EPSILON);
}

// =============================================================================
// BloomConfig Tests
// =============================================================================

#[test]
fn test_bloom_config_default() {
    let config = BloomConfig::default();
    assert!((config.threshold - 0.8).abs() < f32::EPSILON);
    assert!((config.knee - 0.5).abs() < f32::EPSILON);
    assert!((config.intensity - 1.0).abs() < f32::EPSILON);
    assert!(config.apply_tonemapping);
    assert_eq!(config.blur_passes, 2);
}

#[test]
fn test_bloom_config_custom() {
    let config = BloomConfig {
        threshold: 0.6,
        knee: 0.3,
        intensity: 1.5,
        apply_tonemapping: false,
        blur_passes: 3,
    };
    assert!((config.threshold - 0.6).abs() < f32::EPSILON);
    assert!((config.knee - 0.3).abs() < f32::EPSILON);
    assert!((config.intensity - 1.5).abs() < f32::EPSILON);
    assert!(!config.apply_tonemapping);
    assert_eq!(config.blur_passes, 3);
}

// =============================================================================
// Shader Include Tests
// =============================================================================

#[test]
fn test_noise_include_available() {
    // Verify the noise include is non-empty
    assert!(!NOISE_INCLUDE.is_empty());
    // Verify it contains expected functions
    assert!(NOISE_INCLUDE.contains("fn hash21"));
    assert!(NOISE_INCLUDE.contains("fn hash22"));
    assert!(NOISE_INCLUDE.contains("fn hash31"));
    assert!(NOISE_INCLUDE.contains("fn value_noise_2d"));
    assert!(NOISE_INCLUDE.contains("fn perlin_noise_2d"));
    assert!(NOISE_INCLUDE.contains("fn fbm"));
    assert!(NOISE_INCLUDE.contains("fn simplex_noise_2d"));
    assert!(NOISE_INCLUDE.contains("fn worley_noise_2d"));
    assert!(NOISE_INCLUDE.contains("fn worley_noise_2d_f1f2"));
    assert!(NOISE_INCLUDE.contains("fn worley_edges_2d"));
    assert!(NOISE_INCLUDE.contains("fn turbulence"));
    assert!(NOISE_INCLUDE.contains("fn ridged_turbulence"));
}

#[test]
fn test_noise_include_registered_in_library() {
    let lib = ShaderLibrary::new();
    assert!(lib.preprocessor().has_include("noise.wgsl"));
}

#[test]
fn test_shader_library_has_all_includes() {
    let lib = ShaderLibrary::new();
    let preprocessor = lib.preprocessor();

    // All built-in includes should be registered
    assert!(preprocessor.has_include("math.wgsl"));
    assert!(preprocessor.has_include("transforms.wgsl"));
    assert!(preprocessor.has_include("sdf.wgsl"));
    assert!(preprocessor.has_include("glass.wgsl"));
    assert!(preprocessor.has_include("color.wgsl"));
    assert!(preprocessor.has_include("noise.wgsl"));
}

// =============================================================================
// Shader Preprocessing Tests
// =============================================================================

#[test]
fn test_noise_preprocessing() {
    let lib = ShaderLibrary::new();

    // Test that noise shader can be preprocessed
    let source = r#"
#include "math.wgsl"
#include "noise.wgsl"

fn test_noise(p: vec2<f32>) -> f32 {
    return perlin_noise_2d(p);
}
"#;

    let result = lib.preprocessor().process(source);
    assert!(result.is_ok());

    let processed = result.unwrap();
    // After preprocessing, includes should be resolved
    assert!(processed.contains("fn perlin_noise_2d"));
    assert!(processed.contains("const PI"));
}

#[test]
fn test_plasma_shader_preprocessing() {
    let lib = ShaderLibrary::new();

    // Test that plasma shader includes can be resolved
    let source = r#"
#include "noise.wgsl"
#include "color.wgsl"

fn test_plasma() -> vec3<f32> {
    let noise = fbm(vec2<f32>(0.5, 0.5));
    return hsl_to_rgb(vec3<f32>(noise, 1.0, 0.5));
}
"#;

    let result = lib.preprocessor().process(source);
    assert!(result.is_ok());

    let processed = result.unwrap();
    assert!(processed.contains("fn fbm"));
    assert!(processed.contains("fn hsl_to_rgb"));
}

#[test]
fn test_bloom_shader_preprocessing() {
    let lib = ShaderLibrary::new();

    // Test that bloom shader includes can be resolved
    let source = r#"
#include "color.wgsl"

fn test_bloom(color: vec3<f32>) -> f32 {
    return luminance(color);
}
"#;

    let result = lib.preprocessor().process(source);
    assert!(result.is_ok());

    let processed = result.unwrap();
    assert!(processed.contains("fn luminance"));
}
