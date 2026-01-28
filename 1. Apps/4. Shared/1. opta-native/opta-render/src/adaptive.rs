//! Adaptive quality and 120Hz optimization system.
//!
//! This module provides real-time quality adjustment based on frame performance,
//! optimized for ProMotion displays running at 120Hz.
//!
//! # Features
//!
//! - Frame budget tracking with configurable thresholds
//! - Automatic quality scaling based on sustained performance
//! - Per-frame statistics with rolling averages
//! - Hysteresis to prevent oscillation between quality levels
//! - Thermal state awareness for mobile devices
//!
//! # Example
//!
//! ```ignore
//! use opta_render::{AdaptiveQuality, FrameStats};
//!
//! let mut adaptive = AdaptiveQuality::new(120); // 120Hz target
//!
//! // In render loop
//! let stats = adaptive.begin_frame();
//! // ... render ...
//! adaptive.end_frame();
//!
//! // Check if quality should change
//! if let Some(new_level) = adaptive.recommended_quality() {
//!     ring.set_quality(device, new_level);
//! }
//! ```

use std::time::Instant;

use crate::components::RingQualityLevel;
use crate::quality::QualityLevel;

// =============================================================================
// Frame Budget Constants
// =============================================================================

/// Frame time budget for 120Hz in milliseconds.
const BUDGET_120HZ_MS: f32 = 8.333;

/// Frame time budget for 60Hz in milliseconds.
const BUDGET_60HZ_MS: f32 = 16.667;

/// Threshold above target where quality should decrease (percentage).
const DOWNGRADE_THRESHOLD: f32 = 1.2; // 20% over budget

/// Threshold below target where quality could increase (percentage).
const UPGRADE_THRESHOLD: f32 = 0.7; // 30% under budget

/// Number of consecutive frames required before quality change.
const STABILITY_FRAMES: usize = 30; // Half second at 60Hz

/// Minimum time between quality changes (seconds).
const QUALITY_CHANGE_COOLDOWN: f32 = 2.0;

/// Number of samples for rolling averages.
const STATS_SAMPLE_COUNT: usize = 120;

// =============================================================================
// Frame Statistics
// =============================================================================

/// Detailed per-frame statistics for performance analysis.
#[derive(Debug, Clone, Copy, Default)]
pub struct FrameStats {
    /// Frame time in milliseconds.
    pub frame_time_ms: f32,
    /// CPU time for update logic in milliseconds.
    pub cpu_time_ms: f32,
    /// GPU time for rendering in milliseconds (if available).
    pub gpu_time_ms: f32,
    /// Current quality level.
    pub quality_level: u32,
    /// Target frame time based on refresh rate.
    pub target_frame_time_ms: f32,
    /// Whether this frame exceeded the budget.
    pub exceeded_budget: bool,
    /// Frame number.
    pub frame_number: u64,
    /// Time headroom (positive = under budget, negative = over).
    pub headroom_ms: f32,
}

impl FrameStats {
    /// Check if the frame met the target frame time.
    #[must_use]
    pub fn met_budget(&self) -> bool {
        self.frame_time_ms <= self.target_frame_time_ms
    }

    /// Get the percentage of budget used (100% = exactly at target).
    #[must_use]
    pub fn budget_usage_percent(&self) -> f32 {
        if self.target_frame_time_ms > 0.0 {
            (self.frame_time_ms / self.target_frame_time_ms) * 100.0
        } else {
            100.0
        }
    }
}

/// Rolling statistics over a sample window.
#[derive(Debug, Clone)]
pub struct RollingStats {
    /// Frame time samples.
    frame_times: Vec<f32>,
    /// Current index in ring buffer.
    index: usize,
    /// Number of samples collected.
    count: usize,
    /// Cached sum for fast average.
    sum: f32,
    /// Minimum value in window.
    min: f32,
    /// Maximum value in window.
    max: f32,
}

impl RollingStats {
    /// Create new rolling stats tracker.
    pub fn new(capacity: usize) -> Self {
        Self {
            frame_times: vec![0.0; capacity],
            index: 0,
            count: 0,
            sum: 0.0,
            min: f32::MAX,
            max: f32::MIN,
        }
    }

    /// Add a new sample.
    pub fn push(&mut self, value: f32) {
        // Remove old value from sum
        if self.count >= self.frame_times.len() {
            self.sum -= self.frame_times[self.index];
        }

        // Add new value
        self.frame_times[self.index] = value;
        self.sum += value;
        self.index = (self.index + 1) % self.frame_times.len();
        self.count = self.count.saturating_add(1).min(self.frame_times.len());

        // Update min/max (recalculate when buffer wraps)
        if value < self.min {
            self.min = value;
        }
        if value > self.max {
            self.max = value;
        }
    }

    /// Get average value.
    #[must_use]
    pub fn average(&self) -> f32 {
        if self.count > 0 {
            self.sum / self.count as f32
        } else {
            0.0
        }
    }

    /// Get minimum value.
    #[must_use]
    pub fn min(&self) -> f32 {
        if self.count > 0 {
            self.min
        } else {
            0.0
        }
    }

    /// Get maximum value.
    #[must_use]
    pub fn max(&self) -> f32 {
        if self.count > 0 {
            self.max
        } else {
            0.0
        }
    }

    /// Get 99th percentile approximation.
    #[must_use]
    pub fn percentile_99(&self) -> f32 {
        if self.count < 10 {
            return self.max;
        }

        // Simple approximation: sort and take 99th percentile
        let mut sorted: Vec<f32> = self.frame_times[..self.count].to_vec();
        sorted.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
        let idx = (self.count as f32 * 0.99) as usize;
        sorted.get(idx.min(sorted.len() - 1)).copied().unwrap_or(self.max)
    }

    /// Get the number of samples.
    #[must_use]
    pub fn count(&self) -> usize {
        self.count
    }

    /// Reset statistics.
    pub fn reset(&mut self) {
        self.frame_times.fill(0.0);
        self.index = 0;
        self.count = 0;
        self.sum = 0.0;
        self.min = f32::MAX;
        self.max = f32::MIN;
    }
}

impl Default for RollingStats {
    fn default() -> Self {
        Self::new(STATS_SAMPLE_COUNT)
    }
}

// =============================================================================
// Adaptive Quality System
// =============================================================================

/// Thermal state for mobile devices.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum ThermalState {
    /// Normal operating temperature.
    #[default]
    Nominal,
    /// Slightly elevated temperature.
    Fair,
    /// High temperature - should reduce load.
    Serious,
    /// Critical temperature - minimum quality required.
    Critical,
}

impl ThermalState {
    /// Convert from integer (e.g., iOS ProcessInfo.thermalState).
    #[must_use]
    pub fn from_i32(value: i32) -> Self {
        match value {
            0 => Self::Nominal,
            1 => Self::Fair,
            2 => Self::Serious,
            _ => Self::Critical,
        }
    }

    /// Get maximum allowed quality level for this thermal state.
    #[must_use]
    pub fn max_quality(&self) -> QualityLevel {
        match self {
            Self::Nominal => QualityLevel::Ultra,
            Self::Fair => QualityLevel::High,
            Self::Serious => QualityLevel::Medium,
            Self::Critical => QualityLevel::Low,
        }
    }
}

/// Adaptive quality controller for maintaining smooth frame rates.
#[derive(Debug)]
pub struct AdaptiveQuality {
    /// Target refresh rate (60 or 120).
    target_fps: u32,
    /// Current quality level.
    current_quality: QualityLevel,
    /// Recommended quality level (may differ from current).
    recommended_quality: Option<QualityLevel>,
    /// Rolling frame time statistics.
    frame_stats: RollingStats,
    /// Frame start time.
    frame_start: Option<Instant>,
    /// Frame number counter.
    frame_number: u64,
    /// Consecutive frames under budget.
    frames_under_budget: usize,
    /// Consecutive frames over budget.
    frames_over_budget: usize,
    /// Time since last quality change.
    last_quality_change: Instant,
    /// Current thermal state.
    thermal_state: ThermalState,
    /// Whether adaptive quality is enabled.
    enabled: bool,
    /// Frame budget in milliseconds.
    frame_budget_ms: f32,
}

impl AdaptiveQuality {
    /// Create new adaptive quality controller.
    ///
    /// # Arguments
    ///
    /// * `target_fps` - Target frame rate (60 or 120)
    pub fn new(target_fps: u32) -> Self {
        let target_fps = target_fps.clamp(30, 120);
        let frame_budget_ms = if target_fps >= 120 {
            BUDGET_120HZ_MS
        } else {
            BUDGET_60HZ_MS
        };

        Self {
            target_fps,
            current_quality: QualityLevel::High,
            recommended_quality: None,
            frame_stats: RollingStats::new(STATS_SAMPLE_COUNT),
            frame_start: None,
            frame_number: 0,
            frames_under_budget: 0,
            frames_over_budget: 0,
            last_quality_change: Instant::now(),
            thermal_state: ThermalState::Nominal,
            enabled: true,
            frame_budget_ms,
        }
    }

    /// Create for ProMotion displays (120Hz).
    pub fn for_promotion() -> Self {
        Self::new(120)
    }

    /// Create for standard displays (60Hz).
    pub fn for_standard() -> Self {
        Self::new(60)
    }

    /// Enable or disable adaptive quality.
    pub fn set_enabled(&mut self, enabled: bool) {
        self.enabled = enabled;
        if !enabled {
            self.recommended_quality = None;
        }
    }

    /// Check if adaptive quality is enabled.
    #[must_use]
    pub fn is_enabled(&self) -> bool {
        self.enabled
    }

    /// Set the current quality level.
    pub fn set_quality(&mut self, quality: QualityLevel) {
        if self.current_quality != quality {
            self.current_quality = quality;
            self.last_quality_change = Instant::now();
            self.frames_under_budget = 0;
            self.frames_over_budget = 0;
            self.recommended_quality = None;
        }
    }

    /// Set the thermal state.
    pub fn set_thermal_state(&mut self, state: ThermalState) {
        self.thermal_state = state;
    }

    /// Set target FPS.
    pub fn set_target_fps(&mut self, fps: u32) {
        self.target_fps = fps.clamp(30, 120);
        self.frame_budget_ms = if self.target_fps >= 120 {
            BUDGET_120HZ_MS
        } else {
            BUDGET_60HZ_MS
        };
    }

    /// Get target FPS.
    #[must_use]
    pub fn target_fps(&self) -> u32 {
        self.target_fps
    }

    /// Begin a new frame and start timing.
    pub fn begin_frame(&mut self) {
        self.frame_start = Some(Instant::now());
        self.frame_number += 1;
    }

    /// End the frame and record statistics.
    ///
    /// Returns frame statistics for the completed frame.
    pub fn end_frame(&mut self) -> FrameStats {
        let frame_time_ms = self
            .frame_start
            .map(|start| start.elapsed().as_secs_f32() * 1000.0)
            .unwrap_or(self.frame_budget_ms);

        self.frame_stats.push(frame_time_ms);

        let exceeded_budget = frame_time_ms > self.frame_budget_ms;
        let headroom_ms = self.frame_budget_ms - frame_time_ms;

        // Update budget tracking
        if exceeded_budget {
            self.frames_over_budget += 1;
            self.frames_under_budget = 0;
        } else if frame_time_ms < self.frame_budget_ms * UPGRADE_THRESHOLD {
            self.frames_under_budget += 1;
            self.frames_over_budget = 0;
        } else {
            // In the middle zone - reset both
            self.frames_over_budget = self.frames_over_budget.saturating_sub(1);
            self.frames_under_budget = self.frames_under_budget.saturating_sub(1);
        }

        // Check if quality change is recommended
        if self.enabled {
            self.update_recommended_quality();
        }

        FrameStats {
            frame_time_ms,
            cpu_time_ms: frame_time_ms, // Approximate; GPU time not tracked separately
            gpu_time_ms: 0.0,           // Would need GPU timestamps
            quality_level: self.current_quality.as_u32(),
            target_frame_time_ms: self.frame_budget_ms,
            exceeded_budget,
            frame_number: self.frame_number,
            headroom_ms,
        }
    }

    /// Update the recommended quality level based on performance.
    fn update_recommended_quality(&mut self) {
        // Respect cooldown
        let since_change = self.last_quality_change.elapsed().as_secs_f32();
        if since_change < QUALITY_CHANGE_COOLDOWN {
            return;
        }

        // Get thermal-limited maximum
        let max_thermal_quality = self.thermal_state.max_quality();

        // Check if we need to downgrade
        if self.frames_over_budget >= STABILITY_FRAMES {
            let lower = self.lower_quality(self.current_quality);
            if lower != self.current_quality {
                self.recommended_quality = Some(lower);
                return;
            }
        }

        // Check if we can upgrade
        if self.frames_under_budget >= STABILITY_FRAMES * 2 {
            // Require more stability for upgrades
            let higher = self.higher_quality(self.current_quality);
            if higher != self.current_quality && higher.as_u32() <= max_thermal_quality.as_u32() {
                // Verify average frame time supports upgrade
                let avg_ms = self.frame_stats.average();
                if avg_ms < self.frame_budget_ms * UPGRADE_THRESHOLD {
                    self.recommended_quality = Some(higher);
                }
            }
        }
    }

    /// Get the recommended quality level, if a change is suggested.
    ///
    /// Returns `Some(level)` if quality should change, `None` otherwise.
    #[must_use]
    pub fn recommended_quality(&self) -> Option<QualityLevel> {
        self.recommended_quality
    }

    /// Accept the recommended quality change.
    ///
    /// Call this after applying the quality change.
    pub fn accept_recommendation(&mut self) {
        if let Some(quality) = self.recommended_quality.take() {
            self.set_quality(quality);
        }
    }

    /// Get the next lower quality level.
    fn lower_quality(&self, current: QualityLevel) -> QualityLevel {
        match current {
            QualityLevel::Ultra => QualityLevel::High,
            QualityLevel::High => QualityLevel::Medium,
            QualityLevel::Medium => QualityLevel::Low,
            QualityLevel::Low => QualityLevel::Low,
        }
    }

    /// Get the next higher quality level.
    fn higher_quality(&self, current: QualityLevel) -> QualityLevel {
        match current {
            QualityLevel::Low => QualityLevel::Medium,
            QualityLevel::Medium => QualityLevel::High,
            QualityLevel::High => QualityLevel::Ultra,
            QualityLevel::Ultra => QualityLevel::Ultra,
        }
    }

    /// Get current quality level.
    #[must_use]
    pub fn current_quality(&self) -> QualityLevel {
        self.current_quality
    }

    /// Get average frame time in milliseconds.
    #[must_use]
    pub fn average_frame_time_ms(&self) -> f32 {
        self.frame_stats.average()
    }

    /// Get estimated FPS from recent frames.
    #[must_use]
    pub fn estimated_fps(&self) -> f32 {
        let avg_ms = self.frame_stats.average();
        if avg_ms > 0.0 {
            1000.0 / avg_ms
        } else {
            self.target_fps as f32
        }
    }

    /// Get the 99th percentile frame time.
    #[must_use]
    pub fn percentile_99_frame_time_ms(&self) -> f32 {
        self.frame_stats.percentile_99()
    }

    /// Get frame budget in milliseconds.
    #[must_use]
    pub fn frame_budget_ms(&self) -> f32 {
        self.frame_budget_ms
    }

    /// Get frame headroom (positive = under budget).
    #[must_use]
    pub fn average_headroom_ms(&self) -> f32 {
        self.frame_budget_ms - self.frame_stats.average()
    }

    /// Check if currently meeting performance target.
    #[must_use]
    pub fn is_meeting_target(&self) -> bool {
        self.frame_stats.average() <= self.frame_budget_ms * DOWNGRADE_THRESHOLD
    }

    /// Get the number of frames analyzed.
    #[must_use]
    pub fn frame_count(&self) -> u64 {
        self.frame_number
    }

    /// Reset statistics.
    pub fn reset_stats(&mut self) {
        self.frame_stats.reset();
        self.frames_under_budget = 0;
        self.frames_over_budget = 0;
    }
}

impl Default for AdaptiveQuality {
    fn default() -> Self {
        Self::new(60)
    }
}

// =============================================================================
// Ring Quality Adapter
// =============================================================================

/// Adapts general quality level to ring-specific quality.
pub fn quality_level_to_ring_quality(level: QualityLevel) -> RingQualityLevel {
    match level {
        QualityLevel::Low => RingQualityLevel::Low,
        QualityLevel::Medium => RingQualityLevel::Medium,
        QualityLevel::High => RingQualityLevel::High,
        QualityLevel::Ultra => RingQualityLevel::Ultra,
    }
}

/// Adapts ring quality to general quality level.
pub fn ring_quality_to_quality_level(ring: RingQualityLevel) -> QualityLevel {
    match ring {
        RingQualityLevel::Low => QualityLevel::Low,
        RingQualityLevel::Medium => QualityLevel::Medium,
        RingQualityLevel::High => QualityLevel::High,
        RingQualityLevel::Ultra => QualityLevel::Ultra,
    }
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rolling_stats_average() {
        let mut stats = RollingStats::new(5);
        stats.push(10.0);
        stats.push(20.0);
        stats.push(30.0);

        assert!((stats.average() - 20.0).abs() < 0.01);
    }

    #[test]
    fn test_rolling_stats_min_max() {
        let mut stats = RollingStats::new(10);
        stats.push(5.0);
        stats.push(10.0);
        stats.push(3.0);
        stats.push(8.0);

        assert!((stats.min() - 3.0).abs() < 0.01);
        assert!((stats.max() - 10.0).abs() < 0.01);
    }

    #[test]
    fn test_rolling_stats_wraparound() {
        let mut stats = RollingStats::new(3);
        stats.push(1.0);
        stats.push(2.0);
        stats.push(3.0);
        stats.push(10.0); // Should replace 1.0

        assert_eq!(stats.count(), 3);
        // Average should be (2 + 3 + 10) / 3 = 5
        assert!((stats.average() - 5.0).abs() < 0.01);
    }

    #[test]
    fn test_adaptive_quality_new() {
        let adaptive = AdaptiveQuality::new(120);
        assert_eq!(adaptive.target_fps(), 120);
        assert!((adaptive.frame_budget_ms() - BUDGET_120HZ_MS).abs() < 0.01);
    }

    #[test]
    fn test_adaptive_quality_set_quality() {
        let mut adaptive = AdaptiveQuality::new(60);
        adaptive.set_quality(QualityLevel::Ultra);
        assert_eq!(adaptive.current_quality(), QualityLevel::Ultra);
    }

    #[test]
    fn test_thermal_state_max_quality() {
        assert_eq!(ThermalState::Nominal.max_quality(), QualityLevel::Ultra);
        assert_eq!(ThermalState::Fair.max_quality(), QualityLevel::High);
        assert_eq!(ThermalState::Serious.max_quality(), QualityLevel::Medium);
        assert_eq!(ThermalState::Critical.max_quality(), QualityLevel::Low);
    }

    #[test]
    fn test_frame_stats_budget() {
        let stats = FrameStats {
            frame_time_ms: 8.0,
            cpu_time_ms: 8.0,
            gpu_time_ms: 0.0,
            quality_level: 2,
            target_frame_time_ms: 16.667,
            exceeded_budget: false,
            frame_number: 1,
            headroom_ms: 8.667,
        };

        assert!(stats.met_budget());
        assert!((stats.budget_usage_percent() - 48.0).abs() < 1.0);
    }

    #[test]
    fn test_quality_level_conversion() {
        assert_eq!(
            quality_level_to_ring_quality(QualityLevel::Ultra),
            RingQualityLevel::Ultra
        );
        assert_eq!(
            ring_quality_to_quality_level(RingQualityLevel::Low),
            QualityLevel::Low
        );
    }

    #[test]
    fn test_adaptive_enabled_toggle() {
        let mut adaptive = AdaptiveQuality::new(60);
        assert!(adaptive.is_enabled());

        adaptive.set_enabled(false);
        assert!(!adaptive.is_enabled());
    }

    #[test]
    fn test_estimated_fps() {
        let mut adaptive = AdaptiveQuality::new(60);

        // Simulate some frames
        for _ in 0..10 {
            adaptive.begin_frame();
            // Simulate ~16ms frame time by sleeping (approximation)
            adaptive.frame_stats.push(16.0);
        }

        let fps = adaptive.estimated_fps();
        assert!((fps - 62.5).abs() < 5.0); // Should be around 60 FPS
    }
}
