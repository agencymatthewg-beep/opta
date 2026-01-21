//! Quality settings and auto-detection for adaptive rendering.
//!
//! This module provides quality presets and auto-detection based on
//! GPU capabilities. Key features:
//!
//! - Four quality levels: Low, Medium, High, Ultra
//! - Auto-detection based on GPU capabilities
//! - Per-setting configuration (MSAA, shadows, particles, etc.)
//! - Thread-safe quality level queries
//!
//! # Quality Detection
//!
//! The auto-detect system analyzes GPU capabilities:
//!
//! - **Ultra**: Apple Silicon M2+, ProMotion capable, 120Hz
//! - **High**: Apple Silicon M1+, standard 60Hz capable
//! - **Medium**: Older Intel Macs or A12+ iOS devices
//! - **Low**: Fallback for limited hardware
//!
//! # Example
//!
//! ```ignore
//! use opta_render::{QualitySettings, GpuCapabilities};
//!
//! let quality = QualitySettings::auto_detect(&gpu.capabilities);
//! let msaa = quality.msaa_samples;
//! ```

use crate::instance::GpuCapabilities;

/// Quality level presets.
///
/// These map to specific rendering settings optimized for
/// different hardware tiers.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
#[repr(C)]
pub enum QualityLevel {
    /// Minimum quality for low-end or thermal-constrained devices.
    ///
    /// - 30 FPS target
    /// - No MSAA
    /// - Reduced particle counts
    /// - No shadows
    Low = 0,

    /// Balanced quality for average devices.
    ///
    /// - 60 FPS target
    /// - 2x MSAA
    /// - Standard particle counts
    /// - Low shadows
    #[default]
    Medium = 1,

    /// High quality for capable devices.
    ///
    /// - 60 FPS target
    /// - 4x MSAA
    /// - Enhanced particle counts
    /// - Medium shadows
    High = 2,

    /// Maximum quality for high-end Apple Silicon.
    ///
    /// - 120 FPS target (ProMotion)
    /// - 4x MSAA
    /// - Full particle counts
    /// - High shadows
    Ultra = 3,
}

impl QualityLevel {
    /// Create quality level from integer value.
    ///
    /// Invalid values default to Medium.
    #[must_use]
    pub fn from_u32(value: u32) -> Self {
        match value {
            0 => Self::Low,
            2 => Self::High,
            3 => Self::Ultra,
            _ => Self::Medium, // 1 or any invalid value
        }
    }

    /// Get the quality level as a u32.
    #[must_use]
    pub fn as_u32(self) -> u32 {
        self as u32
    }

    /// Get a human-readable name for the quality level.
    #[must_use]
    pub fn name(self) -> &'static str {
        match self {
            Self::Low => "Low",
            Self::Medium => "Medium",
            Self::High => "High",
            Self::Ultra => "Ultra",
        }
    }
}

/// Shadow rendering quality.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
#[repr(C)]
pub enum ShadowQuality {
    /// Shadows disabled.
    #[default]
    Off = 0,
    /// Low resolution shadows (512x512).
    Low = 1,
    /// Medium resolution shadows (1024x1024).
    Medium = 2,
    /// High resolution shadows (2048x2048).
    High = 3,
}

impl ShadowQuality {
    /// Get the shadow map resolution for this quality level.
    #[must_use]
    pub fn resolution(self) -> u32 {
        match self {
            Self::Off => 0,
            Self::Low => 512,
            Self::Medium => 1024,
            Self::High => 2048,
        }
    }

    /// Check if shadows are enabled.
    #[must_use]
    pub fn is_enabled(self) -> bool {
        !matches!(self, Self::Off)
    }
}

/// Comprehensive quality settings for rendering.
///
/// Contains all tunable parameters that affect visual quality
/// and performance. Use `auto_detect()` or `for_level()` to create.
#[derive(Debug, Clone)]
pub struct QualitySettings {
    /// Overall quality level.
    pub level: QualityLevel,

    /// Target frames per second (30, 60, or 120).
    pub target_fps: u32,

    /// MSAA sample count (1, 2, or 4).
    pub msaa_samples: u32,

    /// Texture quality multiplier (0.5 to 1.0).
    ///
    /// Lower values use smaller textures to save VRAM.
    pub texture_quality: f32,

    /// Particle count multiplier (0.25 to 1.0).
    ///
    /// Scales the number of particles in effects.
    pub particle_count_multiplier: f32,

    /// Shadow rendering quality.
    pub shadow_quality: ShadowQuality,

    /// Enable bloom post-processing.
    pub bloom_enabled: bool,

    /// Enable ambient occlusion.
    pub ambient_occlusion: bool,

    /// Motion blur intensity (0.0 = off, 1.0 = full).
    pub motion_blur: f32,

    /// Render scale (0.5 to 2.0).
    ///
    /// Values < 1.0 render at lower resolution and upscale.
    /// Values > 1.0 provide supersampling.
    pub render_scale: f32,

    /// Maximum draw distance multiplier.
    pub draw_distance: f32,
}

impl QualitySettings {
    /// Auto-detect quality settings based on GPU capabilities.
    ///
    /// Analyzes the GPU and returns appropriate settings:
    ///
    /// - **Ultra**: Apple Silicon with ProMotion support
    /// - **High**: Apple Silicon without ProMotion
    /// - **Medium**: Capable hardware, not Apple Silicon
    /// - **Low**: Limited hardware fallback
    ///
    /// # Example
    ///
    /// ```ignore
    /// let quality = QualitySettings::auto_detect(&gpu.capabilities);
    /// println!("Auto-detected quality: {:?}", quality.level);
    /// ```
    #[must_use]
    pub fn auto_detect(capabilities: &GpuCapabilities) -> Self {
        let level = if capabilities.unified_memory {
            // Apple Silicon detected
            if capabilities.supports_promotion {
                // M2+ or A15+ with ProMotion capable
                if capabilities.max_texture_size >= 16384 {
                    QualityLevel::Ultra
                } else {
                    QualityLevel::High
                }
            } else {
                // Apple Silicon without ProMotion (older devices)
                QualityLevel::High
            }
        } else {
            // Not Apple Silicon (Intel Mac or unknown)
            if capabilities.max_texture_size >= 8192 {
                QualityLevel::Medium
            } else {
                QualityLevel::Low
            }
        };

        Self::for_level(level)
    }

    /// Create quality settings for a specific level.
    ///
    /// Returns pre-configured settings optimized for each tier.
    #[must_use]
    pub fn for_level(level: QualityLevel) -> Self {
        match level {
            QualityLevel::Low => Self {
                level,
                target_fps: 30,
                msaa_samples: 1,
                texture_quality: 0.5,
                particle_count_multiplier: 0.25,
                shadow_quality: ShadowQuality::Off,
                bloom_enabled: false,
                ambient_occlusion: false,
                motion_blur: 0.0,
                render_scale: 0.75,
                draw_distance: 0.5,
            },
            QualityLevel::Medium => Self {
                level,
                target_fps: 60,
                msaa_samples: 2,
                texture_quality: 0.75,
                particle_count_multiplier: 0.5,
                shadow_quality: ShadowQuality::Low,
                bloom_enabled: true,
                ambient_occlusion: false,
                motion_blur: 0.0,
                render_scale: 1.0,
                draw_distance: 0.75,
            },
            QualityLevel::High => Self {
                level,
                target_fps: 60,
                msaa_samples: 4,
                texture_quality: 1.0,
                particle_count_multiplier: 0.75,
                shadow_quality: ShadowQuality::Medium,
                bloom_enabled: true,
                ambient_occlusion: true,
                motion_blur: 0.3,
                render_scale: 1.0,
                draw_distance: 1.0,
            },
            QualityLevel::Ultra => Self {
                level,
                target_fps: 120,
                msaa_samples: 4,
                texture_quality: 1.0,
                particle_count_multiplier: 1.0,
                shadow_quality: ShadowQuality::High,
                bloom_enabled: true,
                ambient_occlusion: true,
                motion_blur: 0.5,
                render_scale: 1.0,
                draw_distance: 1.0,
            },
        }
    }

    /// Create custom quality settings.
    #[must_use]
    pub fn custom() -> QualitySettingsBuilder {
        QualitySettingsBuilder::default()
    }

    /// Check if MSAA is enabled.
    #[must_use]
    pub fn is_msaa_enabled(&self) -> bool {
        self.msaa_samples > 1
    }

    /// Get the effective MSAA sample count (always power of 2).
    #[must_use]
    pub fn effective_msaa_samples(&self) -> u32 {
        match self.msaa_samples {
            0 | 1 => 1,
            2 => 2,
            _ => 4,
        }
    }

    /// Calculate effective render resolution.
    ///
    /// Returns (width, height) after applying render scale.
    #[must_use]
    #[allow(clippy::cast_precision_loss)]
    pub fn effective_resolution(&self, width: u32, height: u32) -> (u32, u32) {
        let scale = self.render_scale.clamp(0.5, 2.0);
        let w = ((width as f32) * scale) as u32;
        let h = ((height as f32) * scale) as u32;
        (w.max(1), h.max(1))
    }
}

impl Default for QualitySettings {
    fn default() -> Self {
        Self::for_level(QualityLevel::Medium)
    }
}

/// Builder for custom quality settings.
#[derive(Debug, Default)]
pub struct QualitySettingsBuilder {
    target_fps: Option<u32>,
    msaa_samples: Option<u32>,
    texture_quality: Option<f32>,
    particle_count_multiplier: Option<f32>,
    shadow_quality: Option<ShadowQuality>,
    bloom_enabled: Option<bool>,
    ambient_occlusion: Option<bool>,
    motion_blur: Option<f32>,
    render_scale: Option<f32>,
    draw_distance: Option<f32>,
}

impl QualitySettingsBuilder {
    /// Set target FPS.
    #[must_use]
    pub fn target_fps(mut self, fps: u32) -> Self {
        self.target_fps = Some(fps.clamp(30, 120));
        self
    }

    /// Set MSAA samples.
    #[must_use]
    pub fn msaa_samples(mut self, samples: u32) -> Self {
        self.msaa_samples = Some(samples);
        self
    }

    /// Set texture quality.
    #[must_use]
    pub fn texture_quality(mut self, quality: f32) -> Self {
        self.texture_quality = Some(quality.clamp(0.0, 1.0));
        self
    }

    /// Set particle count multiplier.
    #[must_use]
    pub fn particle_count(mut self, multiplier: f32) -> Self {
        self.particle_count_multiplier = Some(multiplier.clamp(0.0, 1.0));
        self
    }

    /// Set shadow quality.
    #[must_use]
    pub fn shadows(mut self, quality: ShadowQuality) -> Self {
        self.shadow_quality = Some(quality);
        self
    }

    /// Enable or disable bloom.
    #[must_use]
    pub fn bloom(mut self, enabled: bool) -> Self {
        self.bloom_enabled = Some(enabled);
        self
    }

    /// Enable or disable ambient occlusion.
    #[must_use]
    pub fn ambient_occlusion(mut self, enabled: bool) -> Self {
        self.ambient_occlusion = Some(enabled);
        self
    }

    /// Set motion blur intensity.
    #[must_use]
    pub fn motion_blur(mut self, intensity: f32) -> Self {
        self.motion_blur = Some(intensity.clamp(0.0, 1.0));
        self
    }

    /// Set render scale.
    #[must_use]
    pub fn render_scale(mut self, scale: f32) -> Self {
        self.render_scale = Some(scale.clamp(0.5, 2.0));
        self
    }

    /// Set draw distance multiplier.
    #[must_use]
    pub fn draw_distance(mut self, distance: f32) -> Self {
        self.draw_distance = Some(distance.clamp(0.0, 1.0));
        self
    }

    /// Build the quality settings with Medium as base.
    #[must_use]
    pub fn build(self) -> QualitySettings {
        let base = QualitySettings::for_level(QualityLevel::Medium);

        QualitySettings {
            level: QualityLevel::Medium, // Custom is treated as medium
            target_fps: self.target_fps.unwrap_or(base.target_fps),
            msaa_samples: self.msaa_samples.unwrap_or(base.msaa_samples),
            texture_quality: self.texture_quality.unwrap_or(base.texture_quality),
            particle_count_multiplier: self
                .particle_count_multiplier
                .unwrap_or(base.particle_count_multiplier),
            shadow_quality: self.shadow_quality.unwrap_or(base.shadow_quality),
            bloom_enabled: self.bloom_enabled.unwrap_or(base.bloom_enabled),
            ambient_occlusion: self.ambient_occlusion.unwrap_or(base.ambient_occlusion),
            motion_blur: self.motion_blur.unwrap_or(base.motion_blur),
            render_scale: self.render_scale.unwrap_or(base.render_scale),
            draw_distance: self.draw_distance.unwrap_or(base.draw_distance),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_quality_level_from_u32() {
        assert_eq!(QualityLevel::from_u32(0), QualityLevel::Low);
        assert_eq!(QualityLevel::from_u32(1), QualityLevel::Medium);
        assert_eq!(QualityLevel::from_u32(2), QualityLevel::High);
        assert_eq!(QualityLevel::from_u32(3), QualityLevel::Ultra);
        assert_eq!(QualityLevel::from_u32(99), QualityLevel::Medium);
    }

    #[test]
    fn test_quality_level_names() {
        assert_eq!(QualityLevel::Low.name(), "Low");
        assert_eq!(QualityLevel::Ultra.name(), "Ultra");
    }

    #[test]
    fn test_shadow_quality_resolution() {
        assert_eq!(ShadowQuality::Off.resolution(), 0);
        assert_eq!(ShadowQuality::Low.resolution(), 512);
        assert_eq!(ShadowQuality::Medium.resolution(), 1024);
        assert_eq!(ShadowQuality::High.resolution(), 2048);
    }

    #[test]
    fn test_quality_settings_for_level() {
        let low = QualitySettings::for_level(QualityLevel::Low);
        assert_eq!(low.target_fps, 30);
        assert_eq!(low.msaa_samples, 1);
        assert!(!low.bloom_enabled);

        let ultra = QualitySettings::for_level(QualityLevel::Ultra);
        assert_eq!(ultra.target_fps, 120);
        assert_eq!(ultra.msaa_samples, 4);
        assert!(ultra.bloom_enabled);
    }

    #[test]
    fn test_quality_settings_auto_detect() {
        // Apple Silicon with ProMotion
        let apple_caps = GpuCapabilities {
            max_texture_size: 16384,
            max_compute_workgroup_size: [1024, 1024, 1024],
            max_compute_invocations_per_workgroup: 1024,
            supports_promotion: true,
            unified_memory: true,
            vendor_name: "Apple".to_string(),
            device_name: "Apple M2".to_string(),
            backend: wgpu::Backend::Metal,
        };

        let settings = QualitySettings::auto_detect(&apple_caps);
        assert_eq!(settings.level, QualityLevel::Ultra);

        // Non-Apple Silicon
        let intel_caps = GpuCapabilities {
            max_texture_size: 16384,
            max_compute_workgroup_size: [1024, 1024, 64],
            max_compute_invocations_per_workgroup: 1024,
            supports_promotion: false,
            unified_memory: false,
            vendor_name: "Intel".to_string(),
            device_name: "Intel UHD 630".to_string(),
            backend: wgpu::Backend::Metal,
        };

        let settings = QualitySettings::auto_detect(&intel_caps);
        assert_eq!(settings.level, QualityLevel::Medium);
    }

    #[test]
    fn test_effective_resolution() {
        let settings = QualitySettings {
            render_scale: 0.5,
            ..Default::default()
        };

        let (w, h) = settings.effective_resolution(1920, 1080);
        assert_eq!(w, 960);
        assert_eq!(h, 540);
    }

    #[test]
    fn test_builder() {
        let settings = QualitySettings::custom()
            .target_fps(120)
            .msaa_samples(4)
            .shadows(ShadowQuality::High)
            .build();

        assert_eq!(settings.target_fps, 120);
        assert_eq!(settings.msaa_samples, 4);
        assert_eq!(settings.shadow_quality, ShadowQuality::High);
    }

    #[test]
    fn test_effective_msaa() {
        let mut settings = QualitySettings::default();

        settings.msaa_samples = 0;
        assert_eq!(settings.effective_msaa_samples(), 1);

        settings.msaa_samples = 3;
        assert_eq!(settings.effective_msaa_samples(), 4);
    }
}
