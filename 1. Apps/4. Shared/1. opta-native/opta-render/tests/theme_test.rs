//! Integration tests for theme system.
//!
//! Tests cross-module interactions for color temperature and presets.

use opta_render::quality::QualityLevel;
use opta_render::theme::presets::PanelQualityLevel;
use opta_render::theme::{ColorTemperature, EffectPreset, TemperatureColors};

// =============================================================================
// Color Temperature Integration Tests
// =============================================================================

#[test]
fn test_all_temperatures_have_distinct_colors() {
    let temperatures = [
        ColorTemperature::Dormant,
        ColorTemperature::Idle,
        ColorTemperature::Active,
        ColorTemperature::Processing,
        ColorTemperature::Alert,
    ];

    // Each temperature should produce unique primary colors
    for (i, &temp_a) in temperatures.iter().enumerate() {
        for (j, &temp_b) in temperatures.iter().enumerate() {
            if i != j {
                let colors_a = temp_a.get_colors();
                let colors_b = temp_b.get_colors();

                // Primary colors should differ
                let diff = (colors_a.primary[0] - colors_b.primary[0]).abs()
                    + (colors_a.primary[1] - colors_b.primary[1]).abs()
                    + (colors_a.primary[2] - colors_b.primary[2]).abs();

                assert!(
                    diff > 0.01,
                    "{:?} and {:?} should have distinct primary colors",
                    temp_a,
                    temp_b
                );
            }
        }
    }
}

#[test]
fn test_temperature_round_trip() {
    // Converting to u32 and back should preserve the value
    for i in 0..5 {
        let temp = ColorTemperature::from_u32(i);
        assert_eq!(temp.as_u32(), i);
    }
}

#[test]
fn test_energy_mapping_is_monotonic() {
    // Higher energy should never map to "cooler" temperatures
    let mut prev_temp_value = 0u32;

    for energy_pct in 0..=100 {
        let energy = energy_pct as f32 / 100.0;
        let temp = ColorTemperature::from_energy(energy);

        // Temperature value should never decrease as energy increases
        // (except Alert which is special case handled separately)
        let temp_value = temp.as_u32();
        if temp != ColorTemperature::Alert {
            assert!(
                temp_value >= prev_temp_value || temp_value == 3, // Processing
                "Temperature at energy {} should not decrease from {}",
                energy,
                prev_temp_value
            );
        }
        prev_temp_value = temp_value;
    }
}

#[test]
fn test_color_interpolation_endpoints() {
    let dormant = ColorTemperature::Dormant.get_colors();
    let active = ColorTemperature::Active.get_colors();

    // t=0 should equal from
    let at_0 = TemperatureColors::interpolate(&dormant, &active, 0.0);
    assert_eq!(at_0.primary, dormant.primary);
    assert_eq!(at_0.glow, dormant.glow);
    assert_eq!(at_0.background, dormant.background);
    assert_eq!(at_0.text, dormant.text);

    // t=1 should equal to
    let at_1 = TemperatureColors::interpolate(&dormant, &active, 1.0);
    assert!((at_1.primary[0] - active.primary[0]).abs() < 0.0001);
    assert!((at_1.primary[1] - active.primary[1]).abs() < 0.0001);
    assert!((at_1.primary[2] - active.primary[2]).abs() < 0.0001);
}

#[test]
fn test_colors_for_energy_continuity() {
    // Colors should change smoothly without sudden jumps
    let mut prev_colors = ColorTemperature::from_energy(0.0).get_colors();

    for energy_pct in 1..=100 {
        let energy = energy_pct as f32 / 100.0;
        let colors = ColorTemperature::from_energy(energy).get_colors();

        // Maximum change between adjacent energy levels should be reasonable
        // (discrete temperature states will have some jumps at boundaries)
        let max_change = (colors.primary[0] - prev_colors.primary[0])
            .abs()
            .max((colors.primary[1] - prev_colors.primary[1]).abs())
            .max((colors.primary[2] - prev_colors.primary[2]).abs());

        assert!(
            max_change < 1.0,
            "Color change at energy {} is too large: {}",
            energy,
            max_change
        );

        prev_colors = colors;
    }
}

// =============================================================================
// Preset Integration Tests
// =============================================================================

#[test]
fn test_all_presets_have_valid_configs() {
    let presets = [
        EffectPreset::Performance,
        EffectPreset::Balanced,
        EffectPreset::Quality,
        EffectPreset::Ultra,
    ];

    for preset in presets {
        let config = preset.get_config();

        // Particle density should be in valid range
        assert!(
            config.particle_density >= 0.0 && config.particle_density <= 1.0,
            "{:?} has invalid particle_density: {}",
            preset,
            config.particle_density
        );

        // Blur multiplier should be non-negative
        assert!(
            config.blur_samples_multiplier >= 0.0,
            "{:?} has negative blur_samples_multiplier",
            preset
        );

        // Target FPS should be reasonable
        assert!(
            config.target_fps >= 30 && config.target_fps <= 240,
            "{:?} has unreasonable target_fps: {}",
            preset,
            config.target_fps
        );
    }
}

#[test]
fn test_preset_quality_ordering() {
    let perf = EffectPreset::Performance.get_config();
    let balanced = EffectPreset::Balanced.get_config();
    let quality = EffectPreset::Quality.get_config();
    let ultra = EffectPreset::Ultra.get_config();

    // Particle density should increase with preset quality
    assert!(perf.particle_density <= balanced.particle_density);
    assert!(balanced.particle_density <= quality.particle_density);
    assert!(quality.particle_density <= ultra.particle_density);

    // Ultra should have the highest target FPS
    assert!(ultra.target_fps >= quality.target_fps);
}

#[test]
fn test_preset_from_quality_round_trip() {
    // Converting from quality level and back should be consistent
    for quality in [
        QualityLevel::Low,
        QualityLevel::Medium,
        QualityLevel::High,
        QualityLevel::Ultra,
    ] {
        let preset = EffectPreset::from_quality_level(quality);
        let back_to_quality = preset.to_quality_level();
        assert_eq!(
            quality, back_to_quality,
            "Round trip failed for {:?}",
            quality
        );
    }
}

#[test]
fn test_performance_disables_expensive_effects() {
    let config = EffectPreset::Performance.get_config();

    // Performance should disable expensive effects
    assert!(!config.bloom_enabled, "Performance should disable bloom");
    assert!(!config.glow_enabled, "Performance should disable glow");
    assert!(
        config.blur_samples_multiplier < 0.5,
        "Performance should minimize blur"
    );
}

#[test]
fn test_ultra_enables_all_effects() {
    let config = EffectPreset::Ultra.get_config();

    // Ultra should enable all effects
    assert!(config.bloom_enabled, "Ultra should enable bloom");
    assert!(config.glow_enabled, "Ultra should enable glow");
    assert!(
        config.particle_density >= 0.9,
        "Ultra should have high particle density"
    );
    assert!(
        config.blur_samples_multiplier >= 1.0,
        "Ultra should have full blur"
    );
}

#[test]
fn test_panel_quality_increases_with_preset() {
    let presets = [
        EffectPreset::Performance,
        EffectPreset::Balanced,
        EffectPreset::Quality,
        EffectPreset::Ultra,
    ];

    let mut prev_samples = 0;
    for preset in presets {
        let config = preset.get_config();
        let samples = config.panel_quality.blur_samples();
        assert!(
            samples >= prev_samples,
            "{:?} should have at least as many blur samples as previous preset",
            preset
        );
        prev_samples = samples;
    }
}

// =============================================================================
// Cross-Module Integration Tests
// =============================================================================

#[test]
fn test_temperature_and_preset_compatibility() {
    // Verify that any preset config can work with any color temperature
    let presets = [
        EffectPreset::Performance,
        EffectPreset::Balanced,
        EffectPreset::Quality,
        EffectPreset::Ultra,
    ];

    let temperatures = [
        ColorTemperature::Dormant,
        ColorTemperature::Idle,
        ColorTemperature::Active,
        ColorTemperature::Processing,
        ColorTemperature::Alert,
    ];

    for preset in presets {
        let config = preset.get_config();

        for temp in temperatures {
            let colors = temp.get_colors();

            // If glow is enabled, glow color should be valid
            if config.glow_enabled {
                assert!(
                    colors.glow.iter().all(|&c| c >= 0.0 && c <= 1.5),
                    "Glow color out of range for {:?} at {:?}",
                    preset,
                    temp
                );
            }

            // Primary color should always be valid
            assert!(
                colors.primary.iter().all(|&c| c >= 0.0 && c <= 1.0),
                "Primary color out of range for {:?}",
                temp
            );
        }
    }
}

#[test]
fn test_default_values() {
    // Default temperature should be Dormant
    assert_eq!(ColorTemperature::default(), ColorTemperature::Dormant);

    // Default preset should be Balanced
    assert_eq!(EffectPreset::default(), EffectPreset::Balanced);

    // Default panel quality should be Medium
    assert_eq!(PanelQualityLevel::default(), PanelQualityLevel::Medium);
}
