//! Haptics Capability
//!
//! Defines the interface for haptic feedback operations.
//! Part of Crux State Management - Plan 65-01.

use serde::{Deserialize, Serialize};
use opta_shared::OptaResult;

/// Haptic operation types for the shell to execute
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum HapticOp {
    /// Play a haptic feedback pattern
    Play(HapticType),
    /// Stop any ongoing haptic feedback
    Stop,
}

/// Haptic feedback types
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum HapticType {
    /// Light impact - selection changes, toggles
    Light,
    /// Medium impact - button presses, confirmations
    Medium,
    /// Heavy impact - important actions, warnings
    Heavy,
    /// Soft impact - subtle feedback
    Soft,
    /// Rigid impact - firm feedback
    Rigid,
    /// Success notification - positive outcome
    Success,
    /// Warning notification - caution required
    Warning,
    /// Error notification - something went wrong
    Error,
    /// Selection changed
    Selection,
    /// Ring hover feedback
    RingHover,
    /// Ring click feedback
    RingClick,
    /// Ring activation feedback
    RingActivate,
    /// Optimization started
    OptimizationStart,
    /// Optimization in progress pulse
    OptimizationPulse,
    /// Optimization completed successfully
    OptimizationComplete,
    /// Score increase celebration
    ScoreCelebration,
}

impl HapticType {
    /// Get the intensity level (0.0 - 1.0)
    pub fn intensity(&self) -> f32 {
        match self {
            HapticType::Light | HapticType::Soft | HapticType::Selection => 0.3,
            HapticType::Medium | HapticType::RingHover => 0.5,
            HapticType::Heavy | HapticType::Rigid | HapticType::RingClick => 0.7,
            HapticType::Success | HapticType::OptimizationComplete | HapticType::ScoreCelebration => 0.8,
            HapticType::Warning | HapticType::OptimizationStart => 0.6,
            HapticType::Error | HapticType::RingActivate => 0.9,
            HapticType::OptimizationPulse => 0.4,
        }
    }

    /// Get the duration in milliseconds (approximate)
    pub fn duration_ms(&self) -> u64 {
        match self {
            HapticType::Light | HapticType::Soft | HapticType::Selection => 10,
            HapticType::Medium | HapticType::RingHover => 20,
            HapticType::Heavy | HapticType::Rigid | HapticType::RingClick => 30,
            HapticType::Success | HapticType::Warning | HapticType::Error => 50,
            HapticType::RingActivate | HapticType::OptimizationStart => 40,
            HapticType::OptimizationPulse => 100,
            HapticType::OptimizationComplete | HapticType::ScoreCelebration => 150,
        }
    }

    /// Check if this is a continuous/repeating haptic
    pub fn is_continuous(&self) -> bool {
        matches!(self, HapticType::OptimizationPulse)
    }
}

/// Capability trait for haptic feedback
pub trait HapticsCapability {
    /// Play a haptic feedback pattern
    fn play(&self, haptic_type: HapticType) -> OptaResult<()>;

    /// Stop any ongoing haptic feedback
    fn stop(&self) -> OptaResult<()>;

    /// Check if haptics are supported on this device
    fn is_supported(&self) -> bool;

    /// Check if haptics are currently enabled
    fn is_enabled(&self) -> bool;

    /// Enable or disable haptics
    fn set_enabled(&mut self, enabled: bool);
}

/// Haptic feedback request for the shell
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HapticRequest {
    /// The operation to perform
    pub op: HapticOp,
    /// Optional intensity override (0.0 - 1.0)
    pub intensity_override: Option<f32>,
    /// Optional delay before playing (ms)
    pub delay_ms: Option<u64>,
}

impl HapticRequest {
    /// Create a new play request
    pub fn play(haptic_type: HapticType) -> Self {
        Self {
            op: HapticOp::Play(haptic_type),
            intensity_override: None,
            delay_ms: None,
        }
    }

    /// Create a new stop request
    pub fn stop() -> Self {
        Self {
            op: HapticOp::Stop,
            intensity_override: None,
            delay_ms: None,
        }
    }

    /// Set intensity override
    pub fn with_intensity(mut self, intensity: f32) -> Self {
        self.intensity_override = Some(intensity.clamp(0.0, 1.0));
        self
    }

    /// Set delay before playing
    pub fn with_delay(mut self, delay_ms: u64) -> Self {
        self.delay_ms = Some(delay_ms);
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_haptic_type_intensity() {
        assert!(HapticType::Light.intensity() < HapticType::Heavy.intensity());
        assert!(HapticType::Success.intensity() > HapticType::Selection.intensity());
    }

    #[test]
    fn test_haptic_type_duration() {
        assert!(HapticType::Light.duration_ms() < HapticType::Success.duration_ms());
        assert_eq!(HapticType::OptimizationPulse.is_continuous(), true);
        assert_eq!(HapticType::Light.is_continuous(), false);
    }

    #[test]
    fn test_haptic_request_builder() {
        let request = HapticRequest::play(HapticType::Success)
            .with_intensity(0.9)
            .with_delay(100);

        assert!(matches!(request.op, HapticOp::Play(HapticType::Success)));
        assert_eq!(request.intensity_override, Some(0.9));
        assert_eq!(request.delay_ms, Some(100));
    }
}
