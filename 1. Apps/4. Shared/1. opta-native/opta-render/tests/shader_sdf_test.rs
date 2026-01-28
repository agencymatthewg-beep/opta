//! Tests for SDF and glass shader includes.
//!
//! These tests verify that the shader preprocessor correctly resolves includes
//! and that the shader content is valid.

use opta_render::shader::{ShaderLibrary, ShaderPreprocessor};
use opta_render::{COLOR_INCLUDE, GLASS_INCLUDE, MATH_INCLUDE, SDF_INCLUDE};

#[test]
fn test_sdf_include_available() {
    let mut preprocessor = ShaderPreprocessor::new();
    preprocessor.register_include("sdf.wgsl", SDF_INCLUDE);

    let source = r#"
#include "sdf.wgsl"

fn main() {
    let d = sd_circle(vec2<f32>(0.0), 1.0);
}
"#;

    let result = preprocessor.process(source);
    assert!(result.is_ok(), "Failed to process SDF include: {:?}", result);
    let processed = result.unwrap();
    assert!(
        processed.contains("fn sd_circle"),
        "sd_circle not found in processed source"
    );
}

#[test]
fn test_glass_include_available() {
    let mut preprocessor = ShaderPreprocessor::new();
    preprocessor.register_include("math.wgsl", MATH_INCLUDE);
    preprocessor.register_include("glass.wgsl", GLASS_INCLUDE);

    let source = r#"
#include "glass.wgsl"

fn main() {
    let f = fresnel_schlick(0.5, 0.04);
}
"#;

    let result = preprocessor.process(source);
    assert!(
        result.is_ok(),
        "Failed to process glass include: {:?}",
        result
    );
    let processed = result.unwrap();
    assert!(
        processed.contains("fn fresnel_schlick"),
        "fresnel_schlick not found in processed source"
    );
}

#[test]
fn test_color_include_available() {
    let mut preprocessor = ShaderPreprocessor::new();
    preprocessor.register_include("color.wgsl", COLOR_INCLUDE);

    let source = r#"
#include "color.wgsl"

fn main() {
    let srgb = linear_to_srgb(vec3<f32>(0.5));
}
"#;

    let result = preprocessor.process(source);
    assert!(
        result.is_ok(),
        "Failed to process color include: {:?}",
        result
    );
    let processed = result.unwrap();
    assert!(
        processed.contains("fn linear_to_srgb"),
        "linear_to_srgb not found in processed source"
    );
}

#[test]
fn test_combined_math_and_glass_includes() {
    let mut preprocessor = ShaderPreprocessor::new();
    preprocessor.register_include("math.wgsl", MATH_INCLUDE);
    preprocessor.register_include("glass.wgsl", GLASS_INCLUDE);

    // Include both math and glass to get all functions
    let source = r#"
#include "math.wgsl"
#include "glass.wgsl"

fn main() {
    let x = saturate(1.5);
    let f = fresnel_schlick(0.5, 0.04);
}
"#;

    let result = preprocessor.process(source);
    assert!(
        result.is_ok(),
        "Failed to process combined includes: {:?}",
        result
    );
    let processed = result.unwrap();
    // Both math and glass functions should be present
    assert!(
        processed.contains("fn saturate"),
        "saturate not found in processed source"
    );
    assert!(
        processed.contains("fn fresnel_schlick"),
        "fresnel_schlick not found in processed source"
    );
}

#[test]
fn test_shader_library_has_all_includes() {
    let lib = ShaderLibrary::new();
    let preprocessor = lib.preprocessor();

    assert!(
        preprocessor.has_include("math.wgsl"),
        "math.wgsl not registered"
    );
    assert!(
        preprocessor.has_include("transforms.wgsl"),
        "transforms.wgsl not registered"
    );
    assert!(preprocessor.has_include("sdf.wgsl"), "sdf.wgsl not registered");
    assert!(
        preprocessor.has_include("glass.wgsl"),
        "glass.wgsl not registered"
    );
    assert!(
        preprocessor.has_include("color.wgsl"),
        "color.wgsl not registered"
    );
}

#[test]
fn test_sdf_2d_primitives_present() {
    assert!(SDF_INCLUDE.contains("fn sd_circle"));
    assert!(SDF_INCLUDE.contains("fn sd_box_2d"));
    assert!(SDF_INCLUDE.contains("fn sd_rounded_box_2d"));
    assert!(SDF_INCLUDE.contains("fn sd_segment"));
    assert!(SDF_INCLUDE.contains("fn sd_ring"));
}

#[test]
fn test_sdf_3d_primitives_present() {
    assert!(SDF_INCLUDE.contains("fn sd_sphere"));
    assert!(SDF_INCLUDE.contains("fn sd_box_3d"));
    assert!(SDF_INCLUDE.contains("fn sd_rounded_box_3d"));
    assert!(SDF_INCLUDE.contains("fn sd_torus"));
    assert!(SDF_INCLUDE.contains("fn sd_cylinder"));
}

#[test]
fn test_sdf_operations_present() {
    assert!(SDF_INCLUDE.contains("fn op_union"));
    assert!(SDF_INCLUDE.contains("fn op_subtraction"));
    assert!(SDF_INCLUDE.contains("fn op_intersection"));
    assert!(SDF_INCLUDE.contains("fn op_smooth_union"));
    assert!(SDF_INCLUDE.contains("fn op_smooth_subtraction"));
    assert!(SDF_INCLUDE.contains("fn op_smooth_intersection"));
}

#[test]
fn test_glass_material_present() {
    assert!(GLASS_INCLUDE.contains("struct GlassMaterial"));
    assert!(GLASS_INCLUDE.contains("fn glass_default"));
    assert!(GLASS_INCLUDE.contains("fn glass_blend"));
    assert!(GLASS_INCLUDE.contains("fn glass_intensity"));
    assert!(GLASS_INCLUDE.contains("fn fresnel_schlick"));
    assert!(GLASS_INCLUDE.contains("fn fresnel_dielectric"));
}

#[test]
fn test_color_utilities_present() {
    assert!(COLOR_INCLUDE.contains("fn linear_to_srgb"));
    assert!(COLOR_INCLUDE.contains("fn srgb_to_linear"));
    assert!(COLOR_INCLUDE.contains("fn rgb_to_hsl"));
    assert!(COLOR_INCLUDE.contains("fn hsl_to_rgb"));
    assert!(COLOR_INCLUDE.contains("fn rgb_to_hsv"));
    assert!(COLOR_INCLUDE.contains("fn hsv_to_rgb"));
    assert!(COLOR_INCLUDE.contains("fn blend_overlay"));
    assert!(COLOR_INCLUDE.contains("fn blend_screen"));
    assert!(COLOR_INCLUDE.contains("fn blend_multiply"));
    assert!(COLOR_INCLUDE.contains("fn luminance"));
}

#[test]
fn test_combined_includes() {
    let lib = ShaderLibrary::new();

    // Test that we can include all the shaders from plan 61-02
    let source = r#"
#include "sdf.wgsl"
#include "glass.wgsl"
#include "color.wgsl"

fn test_combined() {
    // SDF
    let d = sd_circle(vec2<f32>(0.0), 0.5);
    let d2 = op_smooth_union(d, d, 0.1);

    // Glass
    let mat = glass_default();
    let f = fresnel_schlick(0.5, 0.04);

    // Color
    let srgb = linear_to_srgb(vec3<f32>(0.5));
    let hsl = rgb_to_hsl(srgb);
}
"#;

    let result = lib.preprocessor().process(source);
    assert!(
        result.is_ok(),
        "Failed to process combined includes: {:?}",
        result
    );

    let processed = result.unwrap();
    assert!(processed.contains("fn sd_circle"));
    assert!(processed.contains("fn op_smooth_union"));
    assert!(processed.contains("fn glass_default"));
    assert!(processed.contains("fn fresnel_schlick"));
    assert!(processed.contains("fn linear_to_srgb"));
    assert!(processed.contains("fn rgb_to_hsl"));
}
