//! Effect presets for different performance tiers.
//!
//! Provides pre-configured settings optimized for different hardware capabilities:
//!
//! - **Performance**: Minimal effects, guaranteed 60fps
//! - **Balanced**: Good effects, 60fps target
//! - **Quality**: Full effects, 60fps preferred
//! - **Ultra**: Maximum quality, 120Hz capable
//!
//! # Example
//!
//! ```ignore
//! use opta_render::theme::{EffectPreset, PresetConfig};
//!
//! let config = EffectPreset::Balanced.get_config();
//! println!("Bloom enabled: {}", config.bloom_enabled);
//!
//! // Auto-detect best preset
//! let preset = EffectPreset::for_device(&gpu_capabilities);
//! ```

use crate::components::RingQualityLevel;
use crate::quality::QualityLevel;

/// Effect presets for different performance targets.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
#[repr(C)]
pub enum EffectPreset {
    /// Minimal effects, 60fps guaranteed.
    /// For low-end devices or battery saver mode.
    Performance,

    /// Good effects, 60fps target.
    /// Default for most devices.
    #[default]
    Balanced,

    /// Full effects, 60fps preferred.
    /// For high-end devices at standard refresh rate.
    Quality,

    /// Maximum quality, 120Hz capable.
    /// For ProMotion displays and powerful GPUs.
    Ultra,
}

impl EffectPreset {
    /// Convert from integer value.
    #[must_use]
    pub fn from_u32(value: u32) -> Self {
        match value {
            0 => Self::Performance,
            1 => Self::Balanced,
            2 => Self::Quality,
            3 => Self::Ultra,
            _ => Self::Balanced,
        }
    }

    /// Convert to integer value.
    #[must_use]
    pub fn as_u32(self) -> u32 {
        match self {
            Self::Performance => 0,
            Self::Balanced => 1,
            Self::Quality => 2,
            Self::Ultra => 3,
        }
    }

    /// Get the name of this preset.
    #[must_use]
    pub fn name(self) -> &'static str {
        match self {
            Self::Performance => "Performance",
            Self::Balanced => "Balanced",
            Self::Quality => "Quality",
            Self::Ultra => "Ultra",
        }
    }

    /// Get the configuration for this preset.
    #[must_use]
    pub fn get_config(self) -> PresetConfig {
        get_preset(self)
    }

    /// Map from adaptive quality level to preset.
    #[must_use]
    pub fn from_quality_level(quality: QualityLevel) -> Self {
        preset_from_adaptive(quality)
    }

    /// Get the corresponding quality level for this preset.
    #[must_use]
    pub fn to_quality_level(self) -> QualityLevel {
        match self {
            Self::Performance => QualityLevel::Low,
            Self::Balanced => QualityLevel::Medium,
            Self::Quality => QualityLevel::High,
            Self::Ultra => QualityLevel::Ultra,
        }
    }
}

/// Configuration for a preset.
///
/// Contains all the settings that control visual effects quality.
#[derive(Debug, Clone)]
pub struct PresetConfig {
    /// Quality level for the Opta Ring component.
    pub ring_quality: RingQualityLevel,

    /// Quality level for glass panels.
    pub panel_quality: PanelQualityLevel,

    /// Whether bloom post-processing is enabled.
    pub bloom_enabled: bool,

    /// Quality level for bloom effect.
    pub bloom_quality: QualityLevel,

    /// Whether glow effects are enabled.
    pub glow_enabled: bool,

    /// Particle density multiplier (0.0 to 1.0).
    pub particle_density: f32,

    /// Blur sample count multiplier.
    pub blur_samples_multiplier: f32,

    /// Target frames per second.
    pub target_fps: u32,

    /// Whether to enable adaptive quality.
    pub adaptive_enabled: bool,
}

impl Default for PresetConfig {
    fn default() -> Self {
        get_preset(EffectPreset::Balanced)
    }
}

/// Quality level for glass panels.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
#[repr(C)]
pub enum PanelQualityLevel {
    /// Low quality - solid background, no blur.
    Low,

    /// Medium quality - simple blur.
    #[default]
    Medium,

    /// High quality - multi-pass blur.
    High,

    /// Ultra quality - HD glass with full effects.
    Ultra,
}

impl PanelQualityLevel {
    /// Get the blur sample count for this quality level.
    #[must_use]
    pub fn blur_samples(self) -> u32 {
        match self {
            Self::Low => 0,
            Self::Medium => 4,
            Self::High => 8,
            Self::Ultra => 16,
        }
    }

    /// Check if blur is enabled for this quality level.
    #[must_use]
    pub fn blur_enabled(self) -> bool {
        !matches!(self, Self::Low)
    }

    /// Convert from QualityLevel.
    #[must_use]
    pub fn from_quality_level(quality: QualityLevel) -> Self {
        match quality {
            QualityLevel::Low => Self::Low,
            QualityLevel::Medium => Self::Medium,
            QualityLevel::High => Self::High,
            QualityLevel::Ultra => Self::Ultra,
        }
    }

    /// Convert to QualityLevel.
    #[must_use]
    pub fn to_quality_level(self) -> QualityLevel {
        match self {
            Self::Low => QualityLevel::Low,
            Self::Medium => QualityLevel::Medium,
            Self::High => QualityLevel::High,
            Self::Ultra => QualityLevel::Ultra,
        }
    }
}

/// Get the configuration for a preset.
#[must_use]
pub fn get_preset(preset: EffectPreset) -> PresetConfig {
    match preset {
        EffectPreset::Performance => PresetConfig {
            ring_quality: RingQualityLevel::Low,
            panel_quality: PanelQualityLevel::Low,
            bloom_enabled: false,
            bloom_quality: QualityLevel::Low,
            glow_enabled: false,
            particle_density: 0.25,
            blur_samples_multiplier: 0.0,
            target_fps: 60,
            adaptive_enabled: true,
        },

        EffectPreset::Balanced => PresetConfig {
            ring_quality: RingQualityLevel::Medium,
            panel_quality: PanelQualityLevel::Medium,
            bloom_enabled: true,
            bloom_quality: QualityLevel::Medium,
            glow_enabled: true,
            particle_density: 0.5,
            blur_samples_multiplier: 0.5,
            target_fps: 60,
            adaptive_enabled: true,
        },

        EffectPreset::Quality => PresetConfig {
            ring_quality: RingQualityLevel::High,
            panel_quality: PanelQualityLevel::High,
            bloom_enabled: true,
            bloom_quality: QualityLevel::High,
            glow_enabled: true,
            particle_density: 0.75,
            blur_samples_multiplier: 1.0,
            target_fps: 60,
            adaptive_enabled: true,
        },

        EffectPreset::Ultra => PresetConfig {
            ring_quality: RingQualityLevel::Ultra,
            panel_quality: PanelQualityLevel::Ultra,
            bloom_enabled: true,
            bloom_quality: QualityLevel::Ultra,
            glow_enabled: true,
            particle_density: 1.0,
            blur_samples_multiplier: 1.5,
            target_fps: 120,
            adaptive_enabled: true,
        },
    }
}

/// Auto-detect the best preset based on GPU capabilities.
///
/// Analyzes the GPU and returns the most appropriate preset:
/// - Ultra: Apple Silicon with ProMotion
/// - Quality: Apple Silicon without ProMotion
/// - Balanced: Capable discrete GPU
/// - Performance: Integrated GPU or limited hardware
#[must_use]
pub fn preset_for_device(capabilities: &crate::instance::GpuCapabilities) -> EffectPreset {
    if capabilities.unified_memory {
        // Apple Silicon
        if capabilities.supports_promotion {
            EffectPreset::Ultra
        } else {
            EffectPreset::Quality
        }
    } else {
        // Not Apple Silicon
        if capabilities.max_texture_size >= 8192 {
            EffectPreset::Balanced
        } else {
            EffectPreset::Performance
        }
    }
}

/// Map from adaptive quality level to effect preset.
#[must_use]
pub fn preset_from_adaptive(quality: QualityLevel) -> EffectPreset {
    match quality {
        QualityLevel::Low => EffectPreset::Performance,
        QualityLevel::Medium => EffectPreset::Balanced,
        QualityLevel::High => EffectPreset::Quality,
        QualityLevel::Ultra => EffectPreset::Ultra,
    }
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_preset_from_u32() {
        assert_eq!(EffectPreset::from_u32(0), EffectPreset::Performance);
        assert_eq!(EffectPreset::from_u32(1), EffectPreset::Balanced);
        assert_eq!(EffectPreset::from_u32(2), EffectPreset::Quality);
        assert_eq!(EffectPreset::from_u32(3), EffectPreset::Ultra);
        assert_eq!(EffectPreset::from_u32(99), EffectPreset::Balanced);
    }

    #[test]
    fn test_preset_as_u32() {
        assert_eq!(EffectPreset::Performance.as_u32(), 0);
        assert_eq!(EffectPreset::Balanced.as_u32(), 1);
        assert_eq!(EffectPreset::Quality.as_u32(), 2);
        assert_eq!(EffectPreset::Ultra.as_u32(), 3);
    }

    #[test]
    fn test_preset_names() {
        assert_eq!(EffectPreset::Performance.name(), "Performance");
        assert_eq!(EffectPreset::Balanced.name(), "Balanced");
        assert_eq!(EffectPreset::Quality.name(), "Quality");
        assert_eq!(EffectPreset::Ultra.name(), "Ultra");
    }

    #[test]
    fn test_preset_quality_levels() {
        let perf = EffectPreset::Performance.get_config();
        let balanced = EffectPreset::Balanced.get_config();
        let quality = EffectPreset::Quality.get_config();
        let ultra = EffectPreset::Ultra.get_config();

        // Performance should have minimal effects
        assert_eq!(perf.ring_quality, RingQualityLevel::Low);
        assert!(!perf.bloom_enabled);
        assert!(!perf.glow_enabled);

        // Ultra should have all effects enabled
        assert_eq!(ultra.ring_quality, RingQualityLevel::Ultra);
        assert!(ultra.bloom_enabled);
        assert!(ultra.glow_enabled);
        assert_eq!(ultra.target_fps, 120);

        // Particle density should increase with quality
        assert!(perf.particle_density < balanced.particle_density);
        assert!(balanced.particle_density < quality.particle_density);
        assert!(quality.particle_density < ultra.particle_density);
    }

    #[test]
    fn test_performance_preset_minimal() {
        let config = EffectPreset::Performance.get_config();

        assert!(!config.bloom_enabled);
        assert!(!config.glow_enabled);
        assert_eq!(config.ring_quality, RingQualityLevel::Low);
        assert_eq!(config.panel_quality, PanelQualityLevel::Low);
        assert!(config.particle_density < 0.5);
    }

    #[test]
    fn test_ultra_preset_full() {
        let config = EffectPreset::Ultra.get_config();

        assert!(config.bloom_enabled);
        assert!(config.glow_enabled);
        assert_eq!(config.ring_quality, RingQualityLevel::Ultra);
        assert_eq!(config.panel_quality, PanelQualityLevel::Ultra);
        assert!((config.particle_density - 1.0).abs() < f32::EPSILON);
        assert_eq!(config.target_fps, 120);
    }

    #[test]
    fn test_preset_from_adaptive() {
        assert_eq!(preset_from_adaptive(QualityLevel::Low), EffectPreset::Performance);
        assert_eq!(preset_from_adaptive(QualityLevel::Medium), EffectPreset::Balanced);
        assert_eq!(preset_from_adaptive(QualityLevel::High), EffectPreset::Quality);
        assert_eq!(preset_from_adaptive(QualityLevel::Ultra), EffectPreset::Ultra);
    }

    #[test]
    fn test_preset_to_quality_level() {
        assert_eq!(EffectPreset::Performance.to_quality_level(), QualityLevel::Low);
        assert_eq!(EffectPreset::Balanced.to_quality_level(), QualityLevel::Medium);
        assert_eq!(EffectPreset::Quality.to_quality_level(), QualityLevel::High);
        assert_eq!(EffectPreset::Ultra.to_quality_level(), QualityLevel::Ultra);
    }

    #[test]
    fn test_panel_quality_blur_samples() {
        assert_eq!(PanelQualityLevel::Low.blur_samples(), 0);
        assert_eq!(PanelQualityLevel::Medium.blur_samples(), 4);
        assert_eq!(PanelQualityLevel::High.blur_samples(), 8);
        assert_eq!(PanelQualityLevel::Ultra.blur_samples(), 16);
    }

    #[test]
    fn test_panel_quality_blur_enabled() {
        assert!(!PanelQualityLevel::Low.blur_enabled());
        assert!(PanelQualityLevel::Medium.blur_enabled());
        assert!(PanelQualityLevel::High.blur_enabled());
        assert!(PanelQualityLevel::Ultra.blur_enabled());
    }
}
