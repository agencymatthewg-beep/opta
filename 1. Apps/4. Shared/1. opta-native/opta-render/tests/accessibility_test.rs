//! Integration tests for accessibility features.
//!
//! Tests reduced motion and high contrast modes.

use opta_render::accessibility::{
    ContrastPreference, HighContrastConfig, MotionPreference, ReducedMotionConfig,
};

// =============================================================================
// Reduced Motion Tests
// =============================================================================

#[test]
fn test_reduced_motion_disables_animations() {
    let config = ReducedMotionConfig::for_preference(MotionPreference::Reduced);

    // Reduced motion should disable non-essential animations
    assert!(
        config.disable_ring_spin,
        "Reduced motion should disable ring spin"
    );
    assert!(
        config.disable_particles,
        "Reduced motion should disable particles"
    );
    assert!(
        config.disable_bloom_pulse,
        "Reduced motion should disable bloom pulse"
    );
}

#[test]
fn test_no_motion_is_instant() {
    let config = ReducedMotionConfig::for_preference(MotionPreference::None);

    // No motion should use instant transitions
    assert!(
        config.instant_transitions,
        "No motion should use instant transitions"
    );
    assert!(
        config.animation_speed <= 0.0,
        "No motion should have zero animation speed"
    );
}

#[test]
fn test_full_motion_preserves_all_effects() {
    let config = ReducedMotionConfig::for_preference(MotionPreference::Full);

    // Full motion should preserve all effects
    assert!(
        !config.disable_ring_spin,
        "Full motion should allow ring spin"
    );
    assert!(
        !config.disable_particles,
        "Full motion should allow particles"
    );
    assert!(
        !config.instant_transitions,
        "Full motion should use animated transitions"
    );
    assert!(
        (config.animation_speed - 1.0).abs() < f32::EPSILON,
        "Full motion should have normal animation speed"
    );
}

#[test]
fn test_reduced_motion_slows_animations() {
    let full = ReducedMotionConfig::for_preference(MotionPreference::Full);
    let reduced = ReducedMotionConfig::for_preference(MotionPreference::Reduced);

    // Reduced should have slower animations than full
    assert!(
        reduced.animation_speed < full.animation_speed,
        "Reduced motion should slow animations"
    );
    assert!(
        reduced.animation_speed > 0.0,
        "Reduced motion should still animate (not instant)"
    );
}

#[test]
fn test_motion_preference_default() {
    // Default motion preference should be Full (not reduced)
    assert_eq!(MotionPreference::default(), MotionPreference::Full);
}

// =============================================================================
// High Contrast Tests
// =============================================================================

#[test]
fn test_high_contrast_increases_borders() {
    let standard = HighContrastConfig::for_preference(ContrastPreference::Standard);
    let high = HighContrastConfig::for_preference(ContrastPreference::High);
    let maximum = HighContrastConfig::for_preference(ContrastPreference::Maximum);

    // Border multiplier should increase with contrast level
    assert!(
        high.border_multiplier > standard.border_multiplier,
        "High contrast should increase border width"
    );
    assert!(
        maximum.border_multiplier >= high.border_multiplier,
        "Maximum contrast should have at least as thick borders"
    );
}

#[test]
fn test_maximum_contrast_uses_solid_backgrounds() {
    let config = HighContrastConfig::for_preference(ContrastPreference::Maximum);

    // Maximum contrast should use solid backgrounds (no glass blur)
    assert!(
        config.use_solid_backgrounds,
        "Maximum contrast should use solid backgrounds"
    );
    assert!(
        config.disable_blur,
        "Maximum contrast should disable blur"
    );
}

#[test]
fn test_standard_contrast_preserves_effects() {
    let config = HighContrastConfig::for_preference(ContrastPreference::Standard);

    // Standard contrast should preserve visual effects
    assert!(
        !config.use_solid_backgrounds,
        "Standard contrast should allow glass"
    );
    assert!(!config.disable_blur, "Standard contrast should allow blur");
    assert!(
        !config.thick_borders,
        "Standard contrast should use normal borders"
    );
}

#[test]
fn test_high_contrast_text() {
    let standard = HighContrastConfig::for_preference(ContrastPreference::Standard);
    let high = HighContrastConfig::for_preference(ContrastPreference::High);

    // High contrast should enable high contrast text
    assert!(
        !standard.high_contrast_text,
        "Standard should use normal text"
    );
    assert!(high.high_contrast_text, "High should use high contrast text");
}

#[test]
fn test_contrast_preference_default() {
    // Default contrast preference should be Standard
    assert_eq!(ContrastPreference::default(), ContrastPreference::Standard);
}

// =============================================================================
// Cross-Accessibility Integration Tests
// =============================================================================

#[test]
fn test_reduced_motion_with_high_contrast() {
    // Both accessibility features should be able to work together
    let motion_config = ReducedMotionConfig::for_preference(MotionPreference::Reduced);
    let contrast_config = HighContrastConfig::for_preference(ContrastPreference::High);

    // Both should be independently configurable
    assert!(motion_config.disable_ring_spin);
    assert!(contrast_config.thick_borders);

    // Neither should conflict with the other's settings
    // (they affect different visual aspects)
}

#[test]
fn test_maximum_accessibility_mode() {
    // Simulate maximum accessibility: no motion + maximum contrast
    let motion_config = ReducedMotionConfig::for_preference(MotionPreference::None);
    let contrast_config = HighContrastConfig::for_preference(ContrastPreference::Maximum);

    // Motion: all animations disabled
    assert!(motion_config.disable_ring_spin);
    assert!(motion_config.disable_particles);
    assert!(motion_config.disable_bloom_pulse);
    assert!(motion_config.instant_transitions);

    // Contrast: maximum visibility
    assert!(contrast_config.use_solid_backgrounds);
    assert!(contrast_config.disable_blur);
    assert!(contrast_config.thick_borders);
    assert!(contrast_config.high_contrast_text);
}

#[test]
fn test_accessibility_configs_are_cloneable() {
    // Configs should be cloneable for easy copying
    let motion_config = ReducedMotionConfig::for_preference(MotionPreference::Reduced);
    let contrast_config = HighContrastConfig::for_preference(ContrastPreference::High);

    let motion_clone = motion_config;
    let contrast_clone = contrast_config;

    // Clones should equal originals
    assert_eq!(motion_config.disable_ring_spin, motion_clone.disable_ring_spin);
    assert_eq!(
        contrast_config.thick_borders,
        contrast_clone.thick_borders
    );
}

// =============================================================================
// WCAG Compliance Tests
// =============================================================================

#[test]
fn test_border_multiplier_meets_wcag() {
    // WCAG recommends increased visual indicators for focus states
    let high = HighContrastConfig::for_preference(ContrastPreference::High);
    let maximum = HighContrastConfig::for_preference(ContrastPreference::Maximum);

    // Multipliers should provide noticeable increase
    assert!(
        high.border_multiplier >= 1.5,
        "High contrast should have at least 1.5x border width"
    );
    assert!(
        maximum.border_multiplier >= 2.0,
        "Maximum contrast should have at least 2x border width"
    );
}
