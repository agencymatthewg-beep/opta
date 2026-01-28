//! Reduced motion support for accessibility.
//!
//! Provides configuration for users who prefer reduced motion.

/// Motion preference setting.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum MotionPreference {
    /// Full motion enabled (default).
    #[default]
    Full,
    /// Reduced motion requested by user.
    Reduced,
    /// No motion at all.
    None,
}

/// Configuration for reduced motion mode.
#[derive(Debug, Clone, Copy)]
pub struct ReducedMotionConfig {
    /// Disable ring spin animation.
    pub disable_ring_spin: bool,
    /// Disable particle effects.
    pub disable_particles: bool,
    /// Disable bloom pulsing.
    pub disable_bloom_pulse: bool,
    /// Use instant transitions instead of animations.
    pub instant_transitions: bool,
    /// Animation speed multiplier (1.0 = normal, 0.0 = instant).
    pub animation_speed: f32,
}

impl Default for ReducedMotionConfig {
    fn default() -> Self {
        Self {
            disable_ring_spin: false,
            disable_particles: false,
            disable_bloom_pulse: false,
            instant_transitions: false,
            animation_speed: 1.0,
        }
    }
}

impl ReducedMotionConfig {
    /// Create config for the given motion preference.
    #[must_use]
    pub fn for_preference(preference: MotionPreference) -> Self {
        match preference {
            MotionPreference::Full => Self::default(),
            MotionPreference::Reduced => Self {
                disable_ring_spin: true,
                disable_particles: true,
                disable_bloom_pulse: true,
                instant_transitions: false,
                animation_speed: 0.5,
            },
            MotionPreference::None => Self {
                disable_ring_spin: true,
                disable_particles: true,
                disable_bloom_pulse: true,
                instant_transitions: true,
                animation_speed: 0.0,
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_full_motion_default() {
        let config = ReducedMotionConfig::for_preference(MotionPreference::Full);
        assert!(!config.disable_ring_spin);
        assert!(!config.disable_particles);
        assert!((config.animation_speed - 1.0).abs() < f32::EPSILON);
    }

    #[test]
    fn test_reduced_motion() {
        let config = ReducedMotionConfig::for_preference(MotionPreference::Reduced);
        assert!(config.disable_ring_spin);
        assert!(config.disable_particles);
        assert!((config.animation_speed - 0.5).abs() < f32::EPSILON);
    }

    #[test]
    fn test_no_motion() {
        let config = ReducedMotionConfig::for_preference(MotionPreference::None);
        assert!(config.instant_transitions);
        assert!((config.animation_speed - 0.0).abs() < f32::EPSILON);
    }
}
