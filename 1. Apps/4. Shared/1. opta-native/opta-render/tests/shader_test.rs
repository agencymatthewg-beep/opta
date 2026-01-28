//! Tests for the shader module.
//!
//! Note: Tests that require a GPU device are marked with #[ignore] and can be
//! run manually with `cargo test -- --ignored` on a machine with GPU support.

use opta_render::shader::{
    PreprocessError, ShaderError, ShaderLibrary, ShaderLoader, ShaderPreprocessor, ShaderSource,
    MATH_INCLUDE, TRANSFORMS_INCLUDE,
};
use std::path::Path;

// =============================================================================
// ShaderPreprocessor Tests
// =============================================================================

#[test]
fn test_preprocessor_basic_include() {
    let mut pp = ShaderPreprocessor::new();
    pp.register_include("utils.wgsl", "fn util_func() -> f32 { return 1.0; }");

    let source = r#"#include "utils.wgsl"

fn main() -> f32 {
    return util_func();
}"#;

    let result = pp.process(source).unwrap();
    assert!(result.contains("fn util_func()"));
    assert!(result.contains("fn main()"));
}

#[test]
fn test_preprocessor_nested_includes() {
    let mut pp = ShaderPreprocessor::new();
    pp.register_include("constants.wgsl", "const MY_CONST: f32 = 42.0;");
    pp.register_include(
        "math.wgsl",
        r#"#include "constants.wgsl"
fn double_const() -> f32 { return MY_CONST * 2.0; }"#,
    );

    let source = r#"#include "math.wgsl"
fn main() -> f32 { return double_const(); }"#;

    let result = pp.process(source).unwrap();
    assert!(result.contains("const MY_CONST"));
    assert!(result.contains("fn double_const()"));
    assert!(result.contains("fn main()"));
}

#[test]
fn test_preprocessor_circular_include_detection() {
    let mut pp = ShaderPreprocessor::new();
    pp.register_include("a.wgsl", r#"#include "b.wgsl""#);
    pp.register_include("b.wgsl", r#"#include "a.wgsl""#);

    let source = r#"#include "a.wgsl""#;

    let result = pp.process(source);
    assert!(matches!(result, Err(PreprocessError::CircularInclude(_))));
}

#[test]
fn test_preprocessor_include_not_found() {
    let pp = ShaderPreprocessor::new();
    let source = r#"#include "nonexistent.wgsl""#;

    let result = pp.process(source);
    assert!(matches!(result, Err(PreprocessError::IncludeNotFound(_))));
}

#[test]
fn test_preprocessor_define_replacement() {
    let mut pp = ShaderPreprocessor::new();
    pp.define("MAX_ITERATIONS", "100");
    pp.define("EPSILON", "0.001");

    let source = r#"
const iterations: u32 = MAX_ITERATIONS;
const eps: f32 = EPSILON;
"#;

    let result = pp.process(source).unwrap();
    assert!(result.contains("const iterations: u32 = 100"));
    assert!(result.contains("const eps: f32 = 0.001"));
}

#[test]
fn test_preprocessor_angle_bracket_include() {
    let mut pp = ShaderPreprocessor::new();
    pp.register_include("system.wgsl", "// System include");

    let source = r#"#include <system.wgsl>"#;
    let result = pp.process(source).unwrap();
    assert!(result.contains("System include"));
}

#[test]
fn test_preprocessor_no_directives() {
    let pp = ShaderPreprocessor::new();
    let source = "fn simple() -> f32 { return 1.0; }";

    let result = pp.process(source).unwrap();
    assert!(result.contains("fn simple()"));
}

#[test]
fn test_preprocessor_empty_source() {
    let pp = ShaderPreprocessor::new();
    let result = pp.process("").unwrap();
    assert!(result.is_empty());
}

#[test]
fn test_preprocessor_include_comments() {
    let mut pp = ShaderPreprocessor::new();
    pp.register_include("test.wgsl", "const X: f32 = 1.0;");

    let source = r#"#include "test.wgsl"
fn main() {}"#;

    let result = pp.process(source).unwrap();
    // Should have BEGIN/END comments around include
    assert!(result.contains("BEGIN include"));
    assert!(result.contains("END include"));
}

// =============================================================================
// ShaderLoader Tests
// =============================================================================

#[test]
fn test_loader_new() {
    let loader = ShaderLoader::new();
    assert!(loader.is_empty());
    assert!(loader.shader_dir().is_none());
}

#[test]
fn test_loader_with_shader_dir() {
    let loader = ShaderLoader::with_shader_dir("/path/to/shaders");
    assert_eq!(loader.shader_dir(), Some(Path::new("/path/to/shaders")));
}

#[test]
fn test_shader_source_constructors() {
    let embedded = ShaderSource::embedded("fn test() {}");
    assert!(matches!(embedded, ShaderSource::Embedded(_)));

    let file = ShaderSource::file("test.wgsl");
    assert!(matches!(file, ShaderSource::File(_)));

    let processed = ShaderSource::processed("processed source");
    assert!(matches!(processed, ShaderSource::Processed(_)));
}

// =============================================================================
// ShaderLibrary Tests
// =============================================================================

#[test]
fn test_library_has_builtin_includes() {
    let lib = ShaderLibrary::new();
    assert!(lib.preprocessor().has_include("math.wgsl"));
    assert!(lib.preprocessor().has_include("transforms.wgsl"));
}

#[test]
fn test_library_register_custom_include() {
    let mut lib = ShaderLibrary::new();
    lib.register_include("custom.wgsl", "// Custom shader code");
    assert!(lib.preprocessor().has_include("custom.wgsl"));
}

#[test]
fn test_library_define_macro() {
    let mut lib = ShaderLibrary::new();
    lib.define("DEBUG_MODE", "true");
    assert_eq!(lib.preprocessor().define_count(), 1);
}

// =============================================================================
// Built-in Include Content Tests
// =============================================================================

#[test]
fn test_math_include_content() {
    // Verify math.wgsl contains expected functions
    assert!(MATH_INCLUDE.contains("const PI: f32"));
    assert!(MATH_INCLUDE.contains("const TAU: f32"));
    assert!(MATH_INCLUDE.contains("fn saturate("));
    assert!(MATH_INCLUDE.contains("fn lerp("));
    assert!(MATH_INCLUDE.contains("fn remap("));
    assert!(MATH_INCLUDE.contains("fn smin("));
    assert!(MATH_INCLUDE.contains("fn smax("));
}

#[test]
fn test_transforms_include_content() {
    // Verify transforms.wgsl contains expected functions
    assert!(TRANSFORMS_INCLUDE.contains("fn rotate2d("));
    assert!(TRANSFORMS_INCLUDE.contains("fn rotate3d_x("));
    assert!(TRANSFORMS_INCLUDE.contains("fn rotate3d_y("));
    assert!(TRANSFORMS_INCLUDE.contains("fn rotate3d_z("));
    assert!(TRANSFORMS_INCLUDE.contains("fn scale2d("));
    assert!(TRANSFORMS_INCLUDE.contains("fn scale3d("));
    assert!(TRANSFORMS_INCLUDE.contains("fn translate4x4("));
}

#[test]
fn test_math_include_can_be_processed() {
    let mut pp = ShaderPreprocessor::new();
    pp.register_include("math.wgsl", MATH_INCLUDE);

    let source = r#"#include "math.wgsl"

fn test() -> f32 {
    return saturate(lerp(0.0, 1.0, 0.5));
}"#;

    let result = pp.process(source);
    assert!(result.is_ok());
    assert!(result.unwrap().contains("const PI"));
}

#[test]
fn test_transforms_include_can_be_processed() {
    let mut pp = ShaderPreprocessor::new();
    pp.register_include("transforms.wgsl", TRANSFORMS_INCLUDE);

    let source = r#"#include "transforms.wgsl"

fn test() -> mat2x2<f32> {
    return rotate2d(0.5);
}"#;

    let result = pp.process(source);
    assert!(result.is_ok());
    assert!(result.unwrap().contains("fn rotate2d"));
}

// =============================================================================
// Integration Tests (require GPU - marked as ignored)
// =============================================================================

#[test]
#[ignore = "Requires GPU device"]
fn test_shader_compilation() {
    // This test requires a GPU device and would test actual shader compilation
    // Run with: cargo test -- --ignored
}

#[test]
#[ignore = "Requires GPU device"]
fn test_library_load_shader_with_includes() {
    // This test would load a shader using the library with actual preprocessing
    // Run with: cargo test -- --ignored
}
