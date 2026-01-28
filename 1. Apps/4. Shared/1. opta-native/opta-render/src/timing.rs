//! Frame timing infrastructure for high-refresh-rate displays.
//!
//! This module provides frame timing tracking optimized for Apple's
//! `CADisplayLink` and `CVDisplayLink` render loops. Key features:
//!
//! - Delta time calculation between frames
//! - Rolling FPS averaging with configurable sample window
//! - Target FPS tracking (60Hz standard, 120Hz `ProMotion`)
//! - Frame skip detection for adaptive quality
//!
//! # Integration with Swift
//!
//! The timing system is designed for Swift-driven render loops:
//!
//! ```swift
//! // In CADisplayLink callback
//! let info = opta_render_frame_begin(ctx)
//! // ... render with info.delta_time ...
//! opta_render_frame_end(ctx)
//! ```
//!
//! # Thread Safety
//!
//! `FrameTiming` is designed for single-threaded use on the render thread.
//! For cross-thread access (e.g., UI reading FPS), use `RenderState` which
//! provides thread-safe wrappers.

use std::time::Instant;

/// Default number of FPS samples for rolling average.
const DEFAULT_FPS_SAMPLE_COUNT: usize = 60;

/// Minimum delta time to prevent division by zero (corresponds to 10000 FPS).
const MIN_DELTA_TIME: f64 = 0.0001;

/// Maximum delta time to clamp large frame drops (corresponds to 5 FPS).
const MAX_DELTA_TIME: f64 = 0.2;

/// Frame timing tracker for render loop timing.
///
/// Tracks frame deltas, calculates FPS, and provides timing information
/// for physics/animation updates.
///
/// # Example
///
/// ```ignore
/// let mut timing = FrameTiming::new(60);
///
/// // In render loop
/// let info = timing.begin_frame();
/// physics.update(info.delta_time);
/// render();
/// ```
#[derive(Debug)]
pub struct FrameTiming {
    /// Time of the last frame start.
    last_frame_time: Instant,

    /// Total frames rendered.
    frame_count: u64,

    /// Rolling FPS samples for averaging.
    fps_samples: Vec<f64>,

    /// Current index into fps_samples ring buffer.
    fps_sample_index: usize,

    /// Target frames per second (60 or 120).
    target_fps: u32,

    /// Whether frame timing has started (first frame called).
    started: bool,

    /// Accumulated time for frame rate limiting.
    accumulated_time: f64,

    /// Whether rendering is paused.
    paused: bool,
}

impl FrameTiming {
    /// Create a new frame timing tracker.
    ///
    /// # Arguments
    ///
    /// * `target_fps` - Target frame rate (60 for standard, 120 for `ProMotion`)
    ///
    /// # Example
    ///
    /// ```
    /// use opta_render::FrameTiming;
    /// let timing = FrameTiming::new(60);
    /// ```
    #[must_use]
    pub fn new(target_fps: u32) -> Self {
        let target_fps = target_fps.clamp(1, 240);

        Self {
            last_frame_time: Instant::now(),
            frame_count: 0,
            fps_samples: vec![target_fps as f64; DEFAULT_FPS_SAMPLE_COUNT],
            fps_sample_index: 0,
            target_fps,
            started: false,
            accumulated_time: 0.0,
            paused: false,
        }
    }

    /// Create frame timing for ProMotion displays (120Hz).
    #[must_use]
    pub fn for_promotion() -> Self {
        Self::new(120)
    }

    /// Create frame timing for standard displays (60Hz).
    #[must_use]
    pub fn for_standard() -> Self {
        Self::new(60)
    }

    /// Begin a new frame and return timing information.
    ///
    /// Call this at the start of each render frame. Returns delta time
    /// and frame statistics for animation/physics updates.
    ///
    /// # Returns
    ///
    /// `FrameInfo` containing delta time, frame number, and FPS estimates.
    pub fn begin_frame(&mut self) -> FrameInfo {
        let now = Instant::now();

        let delta_time = if self.started {
            let elapsed = now.duration_since(self.last_frame_time);
            elapsed.as_secs_f64().clamp(MIN_DELTA_TIME, MAX_DELTA_TIME)
        } else {
            self.started = true;
            // First frame: use target frame time
            1.0 / f64::from(self.target_fps)
        };

        self.last_frame_time = now;
        self.frame_count += 1;

        // Update FPS sample ring buffer
        let instant_fps = 1.0 / delta_time;
        self.fps_samples[self.fps_sample_index] = instant_fps;
        self.fps_sample_index = (self.fps_sample_index + 1) % self.fps_samples.len();

        // Track accumulated time for frame skip detection
        self.accumulated_time += delta_time;

        FrameInfo {
            delta_time,
            frame_number: self.frame_count,
            target_fps: self.target_fps,
            estimated_fps: self.average_fps(),
            instant_fps,
            is_frame_drop: delta_time > (1.5 / f64::from(self.target_fps)),
        }
    }

    /// Calculate average FPS over the sample window.
    ///
    /// Uses a rolling average of the last N frames for stability.
    #[must_use]
    #[allow(clippy::cast_precision_loss)]
    pub fn average_fps(&self) -> f64 {
        let sum: f64 = self.fps_samples.iter().sum();
        sum / self.fps_samples.len() as f64
    }

    /// Check if we should render a frame based on target FPS.
    ///
    /// Returns true if enough time has elapsed since the last frame.
    /// Useful for frame rate limiting when `vsync` is disabled.
    #[must_use]
    pub fn should_render(&self) -> bool {
        if self.paused {
            return false;
        }

        let target_frame_time = 1.0 / f64::from(self.target_fps);
        let elapsed = self.last_frame_time.elapsed().as_secs_f64();
        elapsed >= target_frame_time * 0.9 // 10% tolerance
    }

    /// Get the current frame count.
    #[must_use]
    pub fn frame_count(&self) -> u64 {
        self.frame_count
    }

    /// Get the target FPS.
    #[must_use]
    pub fn target_fps(&self) -> u32 {
        self.target_fps
    }

    /// Set the target FPS.
    ///
    /// Use this when switching display modes (e.g., standard to `ProMotion`).
    pub fn set_target_fps(&mut self, fps: u32) {
        self.target_fps = fps.clamp(1, 240);
    }

    /// Set paused state.
    ///
    /// When paused, `should_render()` returns false.
    pub fn set_paused(&mut self, paused: bool) {
        self.paused = paused;
        if !paused {
            // Reset timing on unpause to avoid large delta
            self.last_frame_time = Instant::now();
        }
    }

    /// Check if rendering is paused.
    #[must_use]
    pub fn is_paused(&self) -> bool {
        self.paused
    }

    /// Reset timing state (useful after long pauses).
    pub fn reset(&mut self) {
        self.last_frame_time = Instant::now();
        self.started = false;
        self.accumulated_time = 0.0;
        self.fps_samples.fill(f64::from(self.target_fps));
        self.fps_sample_index = 0;
    }

    /// Get time since last frame in seconds.
    #[must_use]
    pub fn time_since_last_frame(&self) -> f64 {
        self.last_frame_time.elapsed().as_secs_f64()
    }
}

impl Default for FrameTiming {
    fn default() -> Self {
        Self::new(60)
    }
}

/// Information about the current frame.
///
/// Returned by `FrameTiming::begin_frame()` to provide timing data
/// for animation, physics, and diagnostics.
#[derive(Debug, Clone, Copy)]
pub struct FrameInfo {
    /// Time elapsed since last frame in seconds.
    ///
    /// Clamped to reasonable bounds (0.0001 to 0.2 seconds).
    pub delta_time: f64,

    /// Sequential frame number (starts at 1).
    pub frame_number: u64,

    /// Target frames per second.
    pub target_fps: u32,

    /// Rolling average FPS over the sample window.
    pub estimated_fps: f64,

    /// Instantaneous FPS (1 / delta_time).
    pub instant_fps: f64,

    /// Whether this frame was likely dropped (delta > 1.5x target).
    pub is_frame_drop: bool,
}

impl FrameInfo {
    /// Get delta time as a float (f32) for graphics APIs.
    #[must_use]
    pub fn delta_time_f32(&self) -> f32 {
        self.delta_time as f32
    }

    /// Get the target frame time in seconds.
    #[must_use]
    pub fn target_frame_time(&self) -> f64 {
        1.0 / f64::from(self.target_fps)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::thread;
    use std::time::Duration;

    #[test]
    fn test_frame_timing_new() {
        let timing = FrameTiming::new(60);
        assert_eq!(timing.target_fps(), 60);
        assert_eq!(timing.frame_count(), 0);
    }

    #[test]
    fn test_frame_timing_begin_frame() {
        let mut timing = FrameTiming::new(60);
        let info = timing.begin_frame();

        assert_eq!(info.target_fps, 60);
        assert_eq!(info.frame_number, 1);
        // First frame should use target frame time
        assert!((info.delta_time - 1.0 / 60.0).abs() < 0.001);
    }

    #[test]
    fn test_frame_timing_delta_time() {
        let mut timing = FrameTiming::new(60);

        // First frame
        let _ = timing.begin_frame();

        // Wait a bit
        thread::sleep(Duration::from_millis(10));

        // Second frame
        let info = timing.begin_frame();

        // Delta should be approximately 10ms
        assert!(info.delta_time >= 0.008);
        assert!(info.delta_time <= 0.02);
    }

    #[test]
    fn test_frame_timing_clamping() {
        let mut timing = FrameTiming::new(60);
        timing.started = true;
        timing.last_frame_time = Instant::now() - Duration::from_secs(1);

        let info = timing.begin_frame();

        // Should be clamped to MAX_DELTA_TIME
        assert!(info.delta_time <= MAX_DELTA_TIME + 0.001);
    }

    #[test]
    fn test_frame_timing_paused() {
        let mut timing = FrameTiming::new(60);

        timing.set_paused(true);
        assert!(timing.is_paused());
        assert!(!timing.should_render());

        timing.set_paused(false);
        assert!(!timing.is_paused());
    }

    #[test]
    fn test_promotion_timing() {
        let timing = FrameTiming::for_promotion();
        assert_eq!(timing.target_fps(), 120);
    }

    #[test]
    fn test_fps_clamping() {
        let timing = FrameTiming::new(0);
        assert_eq!(timing.target_fps(), 1);

        let timing = FrameTiming::new(500);
        assert_eq!(timing.target_fps(), 240);
    }

    #[test]
    fn test_frame_info_delta_f32() {
        let info = FrameInfo {
            delta_time: 0.016_666_666,
            frame_number: 1,
            target_fps: 60,
            estimated_fps: 60.0,
            instant_fps: 60.0,
            is_frame_drop: false,
        };

        assert!((info.delta_time_f32() - 0.0166666).abs() < 0.0001);
        assert!((info.target_frame_time() - 0.0166666).abs() < 0.0001);
    }
}
