//! Debug overlay and profiling utilities.
//!
//! This module provides debug-only functionality that is compiled out in release builds.
//! All structs and methods become no-ops when compiled without the `debug_assertions` flag.
//!
//! ## Usage
//!
//! ```ignore
//! use opta_render::debug::{DebugOverlay, debug_log};
//!
//! let mut overlay = DebugOverlay::new();
//!
//! // In render loop
//! overlay.record_frame(delta_time);
//! debug_log!("Frame time: {:.2}ms", delta_time * 1000.0);
//!
//! // Get average FPS
//! let fps = overlay.average_fps();
//! ```
//!
//! ## Release Behavior
//!
//! In release builds (`#[cfg(not(debug_assertions))]`):
//! - `DebugOverlay` is a zero-sized type
//! - All methods are no-ops that get optimized away
//! - `debug_log!` macro expands to nothing
//! - No runtime cost

/// Maximum number of frame samples to store for averaging.
#[cfg(debug_assertions)]
const MAX_SAMPLES: usize = 120;

/// Debug overlay for frame timing and performance metrics.
///
/// In debug builds, this struct tracks frame times and provides
/// performance statistics. In release builds, it becomes a zero-sized
/// type with no-op methods.
#[cfg(debug_assertions)]
#[derive(Debug)]
pub struct DebugOverlay {
    /// Ring buffer of FPS values
    fps_history: Vec<f32>,
    /// Ring buffer of frame times (in seconds)
    frame_times: Vec<f32>,
    /// Current write index in the ring buffers
    write_index: usize,
    /// Total frames recorded
    total_frames: u64,
}

/// Release build: zero-sized debug overlay (optimized away).
#[cfg(not(debug_assertions))]
#[derive(Debug, Clone, Copy, Default)]
pub struct DebugOverlay;

#[cfg(debug_assertions)]
impl DebugOverlay {
    /// Create a new debug overlay.
    #[must_use]
    pub fn new() -> Self {
        Self {
            fps_history: Vec::with_capacity(MAX_SAMPLES),
            frame_times: Vec::with_capacity(MAX_SAMPLES),
            write_index: 0,
            total_frames: 0,
        }
    }

    /// Record a frame's delta time.
    ///
    /// # Arguments
    /// * `delta` - Frame delta time in seconds
    pub fn record_frame(&mut self, delta: f32) {
        let fps = if delta > 0.0 { 1.0 / delta } else { 0.0 };

        if self.fps_history.len() < MAX_SAMPLES {
            self.fps_history.push(fps);
            self.frame_times.push(delta);
        } else {
            self.fps_history[self.write_index] = fps;
            self.frame_times[self.write_index] = delta;
        }

        self.write_index = (self.write_index + 1) % MAX_SAMPLES;
        self.total_frames += 1;
    }

    /// Get the average FPS over the sample window.
    ///
    /// Returns 0.0 if no frames have been recorded.
    #[must_use]
    pub fn average_fps(&self) -> f32 {
        if self.fps_history.is_empty() {
            return 0.0;
        }
        let sum: f32 = self.fps_history.iter().sum();
        sum / self.fps_history.len() as f32
    }

    /// Get the average frame time in milliseconds.
    ///
    /// Returns 0.0 if no frames have been recorded.
    #[must_use]
    pub fn average_frame_time_ms(&self) -> f32 {
        if self.frame_times.is_empty() {
            return 0.0;
        }
        let sum: f32 = self.frame_times.iter().sum();
        (sum / self.frame_times.len() as f32) * 1000.0
    }

    /// Get the minimum FPS in the sample window.
    #[must_use]
    pub fn min_fps(&self) -> f32 {
        self.fps_history
            .iter()
            .cloned()
            .min_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal))
            .unwrap_or(0.0)
    }

    /// Get the maximum FPS in the sample window.
    #[must_use]
    pub fn max_fps(&self) -> f32 {
        self.fps_history
            .iter()
            .cloned()
            .max_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal))
            .unwrap_or(0.0)
    }

    /// Get the total number of frames recorded.
    #[must_use]
    pub fn total_frames(&self) -> u64 {
        self.total_frames
    }

    /// Get the number of samples currently in the buffer.
    #[must_use]
    pub fn sample_count(&self) -> usize {
        self.fps_history.len()
    }

    /// Reset all statistics.
    pub fn reset(&mut self) {
        self.fps_history.clear();
        self.frame_times.clear();
        self.write_index = 0;
        self.total_frames = 0;
    }
}

#[cfg(debug_assertions)]
impl Default for DebugOverlay {
    fn default() -> Self {
        Self::new()
    }
}

// Release build: no-op implementations
#[cfg(not(debug_assertions))]
impl DebugOverlay {
    /// Create a new debug overlay (no-op in release).
    #[inline(always)]
    #[must_use]
    pub const fn new() -> Self {
        Self
    }

    /// Record a frame's delta time (no-op in release).
    #[inline(always)]
    pub fn record_frame(&mut self, _delta: f32) {}

    /// Get the average FPS (always returns 0.0 in release).
    #[inline(always)]
    #[must_use]
    pub const fn average_fps(&self) -> f32 {
        0.0
    }

    /// Get the average frame time in milliseconds (always returns 0.0 in release).
    #[inline(always)]
    #[must_use]
    pub const fn average_frame_time_ms(&self) -> f32 {
        0.0
    }

    /// Get the minimum FPS (always returns 0.0 in release).
    #[inline(always)]
    #[must_use]
    pub const fn min_fps(&self) -> f32 {
        0.0
    }

    /// Get the maximum FPS (always returns 0.0 in release).
    #[inline(always)]
    #[must_use]
    pub const fn max_fps(&self) -> f32 {
        0.0
    }

    /// Get the total number of frames (always returns 0 in release).
    #[inline(always)]
    #[must_use]
    pub const fn total_frames(&self) -> u64 {
        0
    }

    /// Get the number of samples (always returns 0 in release).
    #[inline(always)]
    #[must_use]
    pub const fn sample_count(&self) -> usize {
        0
    }

    /// Reset all statistics (no-op in release).
    #[inline(always)]
    pub fn reset(&mut self) {}
}

/// Debug logging macro that compiles to nothing in release builds.
///
/// # Examples
///
/// ```ignore
/// use opta_render::debug_log;
///
/// debug_log!("Starting render pass");
/// debug_log!("Frame delta: {:.4}s", delta);
/// debug_log!("Resolution: {}x{}", width, height);
/// ```
///
/// In release builds, this macro expands to nothing.
#[macro_export]
macro_rules! debug_log {
    ($($arg:tt)*) => {
        #[cfg(debug_assertions)]
        {
            tracing::debug!($($arg)*);
        }
    };
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_debug_overlay_basic() {
        let mut overlay = DebugOverlay::new();

        // Record some frames at 60fps (16.67ms)
        for _ in 0..10 {
            overlay.record_frame(1.0 / 60.0);
        }

        #[cfg(debug_assertions)]
        {
            assert_eq!(overlay.sample_count(), 10);
            assert_eq!(overlay.total_frames(), 10);

            let avg_fps = overlay.average_fps();
            assert!((avg_fps - 60.0).abs() < 0.1);

            let avg_time = overlay.average_frame_time_ms();
            assert!((avg_time - 16.67).abs() < 0.1);
        }
    }

    #[test]
    fn test_debug_overlay_reset() {
        let mut overlay = DebugOverlay::new();

        overlay.record_frame(1.0 / 60.0);
        overlay.reset();

        #[cfg(debug_assertions)]
        {
            assert_eq!(overlay.sample_count(), 0);
            assert_eq!(overlay.total_frames(), 0);
        }
    }

    #[test]
    fn test_debug_overlay_ring_buffer() {
        let mut overlay = DebugOverlay::new();

        // Fill beyond capacity to test ring buffer behavior
        #[cfg(debug_assertions)]
        {
            for _ in 0..150 {
                overlay.record_frame(1.0 / 60.0);
            }

            // Should only keep MAX_SAMPLES
            assert_eq!(overlay.sample_count(), MAX_SAMPLES);
            assert_eq!(overlay.total_frames(), 150);
        }
    }
}
