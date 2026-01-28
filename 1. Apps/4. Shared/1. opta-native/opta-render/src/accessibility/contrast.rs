//! High contrast support for accessibility.
//!
//! Provides configuration for users who need higher contrast.

/// Contrast preference setting.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum ContrastPreference {
    /// Standard contrast (default).
    #[default]
    Standard,
    /// Increased contrast.
    High,
    /// Maximum contrast.
    Maximum,
}

/// Configuration for high contrast mode.
#[derive(Debug, Clone, Copy)]
pub struct HighContrastConfig {
    /// Use solid backgrounds instead of glass.
    pub use_solid_backgrounds: bool,
    /// Increase border widths.
    pub thick_borders: bool,
    /// Border width multiplier.
    pub border_multiplier: f32,
    /// Disable blur effects.
    pub disable_blur: bool,
    /// Increase text contrast.
    pub high_contrast_text: bool,
}

impl Default for HighContrastConfig {
    fn default() -> Self {
        Self {
            use_solid_backgrounds: false,
            thick_borders: false,
            border_multiplier: 1.0,
            disable_blur: false,
            high_contrast_text: false,
        }
    }
}

impl HighContrastConfig {
    /// Create config for the given contrast preference.
    #[must_use]
    pub fn for_preference(preference: ContrastPreference) -> Self {
        match preference {
            ContrastPreference::Standard => Self::default(),
            ContrastPreference::High => Self {
                use_solid_backgrounds: false,
                thick_borders: true,
                border_multiplier: 1.5,
                disable_blur: false,
                high_contrast_text: true,
            },
            ContrastPreference::Maximum => Self {
                use_solid_backgrounds: true,
                thick_borders: true,
                border_multiplier: 2.0,
                disable_blur: true,
                high_contrast_text: true,
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_standard_contrast_default() {
        let config = HighContrastConfig::for_preference(ContrastPreference::Standard);
        assert!(!config.use_solid_backgrounds);
        assert!(!config.thick_borders);
        assert!((config.border_multiplier - 1.0).abs() < f32::EPSILON);
    }

    #[test]
    fn test_high_contrast() {
        let config = HighContrastConfig::for_preference(ContrastPreference::High);
        assert!(config.thick_borders);
        assert!(config.high_contrast_text);
        assert!((config.border_multiplier - 1.5).abs() < f32::EPSILON);
    }

    #[test]
    fn test_maximum_contrast() {
        let config = HighContrastConfig::for_preference(ContrastPreference::Maximum);
        assert!(config.use_solid_backgrounds);
        assert!(config.disable_blur);
        assert!((config.border_multiplier - 2.0).abs() < f32::EPSILON);
    }
}
