//! Integration Tests for Opta v8.0
//!
//! Comprehensive test suite covering:
//! - wgpu initialization
//! - Shader compilation
//! - Spring physics
//! - Core API
//!
//! Run all tests: `cargo test --workspace`
//! Run GPU tests: `cargo test --workspace -- --ignored`

// =============================================================================
// wgpu Initialization Tests
// =============================================================================

mod wgpu_tests {
    #[test]
    #[ignore = "Requires Metal GPU"]
    fn test_gpu_context_creation() {
        let result = opta_render::GpuContext::new();
        assert!(result.is_ok(), "GPU context should be created successfully");
    }

    #[test]
    #[ignore = "Requires Metal GPU"]
    fn test_gpu_capabilities_detection() {
        let ctx = opta_render::GpuContext::new().expect("GPU context creation failed");
        assert!(ctx.capabilities.max_texture_size >= 4096);
        assert!(!ctx.capabilities.device_name.is_empty());
    }
}

// =============================================================================
// Shader Compilation Tests
// =============================================================================

mod shader_tests {
    use opta_render::shader::{
        ShaderPreprocessor,
        MATH_INCLUDE, TRANSFORMS_INCLUDE, COLOR_INCLUDE, NOISE_INCLUDE, SDF_INCLUDE, GLASS_INCLUDE,
    };

    #[test]
    fn test_shader_preprocessor_basic() {
        let mut pp = ShaderPreprocessor::new();
        pp.register_include("test.wgsl", "const TEST_VAL: f32 = 1.0;");

        let source = "#include \"test.wgsl\"\nfn main() -> f32 { return TEST_VAL; }";
        let result = pp.process(source).expect("Preprocessing should succeed");

        assert!(result.contains("const TEST_VAL: f32 = 1.0;"));
        assert!(result.contains("fn main()"));
    }

    #[test]
    fn test_math_include_content() {
        assert!(MATH_INCLUDE.contains("PI"));
        assert!(MATH_INCLUDE.contains("TAU"));
    }

    #[test]
    fn test_transforms_include_content() {
        assert!(TRANSFORMS_INCLUDE.contains("rotate2d"));
    }

    #[test]
    fn test_color_include_content() {
        assert!(COLOR_INCLUDE.contains("rgb_to_hsv"));
    }

    #[test]
    fn test_noise_include_content() {
        assert!(NOISE_INCLUDE.contains("hash"));
    }

    #[test]
    fn test_sdf_include_content() {
        assert!(SDF_INCLUDE.contains("sd_circle"));
    }

    #[test]
    fn test_glass_include_content() {
        assert!(GLASS_INCLUDE.contains("fresnel"));
    }
}

// =============================================================================
// Spring Physics Tests
// =============================================================================

mod spring_tests {
    use opta_render::animation::{Spring, SpringConfig, DT_60HZ, DT_120HZ};

    #[test]
    fn test_spring_creation() {
        let spring = Spring::new(0.0, SpringConfig::RESPONSIVE);
        assert_eq!(spring.value(), 0.0);
        assert!(spring.is_at_rest());
    }

    #[test]
    fn test_spring_set_target() {
        let mut spring = Spring::new(0.0, SpringConfig::RESPONSIVE);
        spring.set_target(100.0);
        assert_eq!(spring.target(), 100.0);
        assert!(!spring.is_at_rest());
    }

    #[test]
    fn test_spring_update_converges() {
        let mut spring = Spring::new(0.0, SpringConfig::RESPONSIVE);
        spring.set_target(100.0);

        // Run for 2 seconds at 120Hz
        for _ in 0..240 {
            spring.update(DT_120HZ);
        }

        assert!(spring.is_at_rest());
        assert!((spring.value() - 100.0).abs() < 0.1);
    }

    #[test]
    fn test_spring_velocity() {
        let mut spring = Spring::new(0.0, SpringConfig::RESPONSIVE);
        spring.set_target(100.0);
        spring.update(DT_60HZ);
        assert!(spring.velocity().abs() > 0.0);
    }

    #[test]
    fn test_spring_config_presets() {
        let presets = [
            SpringConfig::RESPONSIVE,
            SpringConfig::WOBBLY,
            SpringConfig::STIFF,
            SpringConfig::GENTLE,
            SpringConfig::MOLASSES,
        ];

        for preset in &presets {
            assert!(preset.stiffness > 0.0);
            assert!(preset.damping > 0.0);
            assert!(preset.mass > 0.0);
        }
    }

    #[test]
    fn test_dt_constants() {
        assert!((DT_60HZ - 1.0/60.0).abs() < 0.0001);
        assert!((DT_120HZ - 1.0/120.0).abs() < 0.0001);
    }
}

// =============================================================================
// App Model Tests (using OptaCore from opta_core)
// =============================================================================

mod app_model_tests {
    use opta_core::OptaCore;

    #[test]
    fn test_opta_core_creation() {
        let core = OptaCore::new();
        assert!(core.is_ready());
    }

    #[test]
    fn test_model_json_serialization() {
        let core = OptaCore::new();
        let json = core.get_model_json();
        assert!(json.starts_with('{'));
        assert!(json.ends_with('}'));
    }

    #[test]
    fn test_view_model_json_serialization() {
        let core = OptaCore::new();
        let json = core.get_view_model_json();
        assert!(json.starts_with('{'));
        assert!(json.ends_with('}'));
        assert!(json.contains("current_page"));
    }

    #[test]
    fn test_model_slice_retrieval() {
        let core = OptaCore::new();

        let nav = core.get_model_slice("navigation".to_string());
        assert!(nav.starts_with('{'));

        let invalid = core.get_model_slice("invalid_slice".to_string());
        assert_eq!(invalid, "{}");
    }

    #[test]
    fn test_event_processing() {
        let core = OptaCore::new();
        let effects = core.process_event(r#""AppStarted""#.to_string());
        assert!(!effects.is_empty(), "AppStarted should produce effects");

        let effects = core.process_event("invalid json".to_string());
        assert!(effects.is_empty());
    }
}

// =============================================================================
// Haptics Tests
// =============================================================================

mod haptics_tests {
    use opta_render::{
        HapticType, trigger_haptic,
        haptic_tap, haptic_explosion, haptic_wake_up, haptic_pulse, haptic_warning,
    };

    #[test]
    fn test_haptic_convenience_functions() {
        // These should not panic even without a callback
        haptic_tap();
        haptic_explosion();
        haptic_wake_up();
        haptic_pulse();
        haptic_warning();
    }

    #[test]
    fn test_trigger_haptic_no_callback() {
        trigger_haptic(HapticType::Tap);
    }
}

// =============================================================================
// Version and Meta Tests
// =============================================================================

mod meta_tests {
    use opta_render::VERSION;

    #[test]
    fn test_version_string() {
        assert!(!VERSION.is_empty());
        assert!(VERSION.starts_with("8."));
    }

    #[test]
    fn test_platform_backend() {
        let backend = opta_render::platform::recommended_backend();
        assert!(!backend.is_empty());
    }
}
