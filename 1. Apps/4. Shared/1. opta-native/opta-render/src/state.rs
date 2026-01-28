//! Thread-safe render state for display link callbacks.
//!
//! This module provides a thread-safe wrapper around render state that can
//! be accessed from both the main thread (UI) and render thread (`CVDisplayLink`
//! or `CADisplayLink` callback).
//!
//! # Thread Model
//!
//! - **Main Thread**: UI updates, resize requests, pause/resume
//! - **Render Thread**: Frame rendering, timing updates
//!
//! The `RenderState` uses interior mutability with `RwLock` to allow
//! concurrent reads (FPS queries from UI) with exclusive writes (frame render).
//!
//! # Example
//!
//! ```ignore
//! // Main thread: create state
//! let state = RenderState::new(60);
//!
//! // Render thread (CADisplayLink callback)
//! state.render_frame(|inner| {
//!     // Render code here
//!     Ok(())
//! })?;
//!
//! // Main thread: resize
//! state.request_resize(1920, 1080);
//! ```

use std::sync::{Arc, RwLock, RwLockReadGuard, RwLockWriteGuard};

use crate::error::{RenderError, RenderResult};
use crate::quality::{QualityLevel, QualitySettings};
use crate::timing::{FrameInfo, FrameTiming};

/// Thread-safe render state for CVDisplayLink/CADisplayLink callbacks.
///
/// This struct wraps the mutable render state in a thread-safe container,
/// allowing the Swift-driven display link to call into Rust safely.
#[derive(Debug, Clone)]
pub struct RenderState {
    inner: Arc<RwLock<RenderStateInner>>,
}

// SAFETY: RenderState uses Arc<RwLock<_>> which is Send + Sync
unsafe impl Send for RenderState {}
unsafe impl Sync for RenderState {}

/// Inner mutable state protected by RwLock.
#[derive(Debug)]
pub struct RenderStateInner {
    /// Frame timing tracker.
    pub timing: FrameTiming,

    /// Quality settings.
    pub quality: QualitySettings,

    /// Pending resize request (width, height).
    pub pending_resize: Option<(u32, u32)>,

    /// Whether rendering is paused.
    pub paused: bool,

    /// Whether a frame is currently being rendered.
    pub rendering: bool,

    /// Last frame info for queries.
    pub last_frame_info: Option<FrameInfo>,

    /// Error from last frame (if any).
    pub last_error: Option<RenderError>,

    /// Frame count since last reset.
    pub frames_rendered: u64,

    /// Total render time in seconds (for profiling).
    pub total_render_time: f64,
}

impl RenderState {
    /// Create a new render state with target FPS.
    ///
    /// # Arguments
    ///
    /// * `target_fps` - Target frame rate (60 or 120)
    #[must_use]
    pub fn new(target_fps: u32) -> Self {
        Self {
            inner: Arc::new(RwLock::new(RenderStateInner {
                timing: FrameTiming::new(target_fps),
                quality: QualitySettings::for_level(QualityLevel::Medium),
                pending_resize: None,
                paused: false,
                rendering: false,
                last_frame_info: None,
                last_error: None,
                frames_rendered: 0,
                total_render_time: 0.0,
            })),
        }
    }

    /// Create render state with quality settings.
    #[must_use]
    pub fn with_quality(quality: QualitySettings) -> Self {
        let target_fps = quality.target_fps;
        Self {
            inner: Arc::new(RwLock::new(RenderStateInner {
                timing: FrameTiming::new(target_fps),
                quality,
                pending_resize: None,
                paused: false,
                rendering: false,
                last_frame_info: None,
                last_error: None,
                frames_rendered: 0,
                total_render_time: 0.0,
            })),
        }
    }

    /// Request a surface resize.
    ///
    /// The resize will be applied before the next frame render.
    /// This is thread-safe and can be called from the main thread.
    pub fn request_resize(&self, width: u32, height: u32) {
        if let Ok(mut inner) = self.inner.write() {
            inner.pending_resize = Some((width, height));
        }
    }

    /// Check and consume pending resize request.
    ///
    /// Returns `Some((width, height))` if a resize was requested,
    /// `None` otherwise. Clears the pending request.
    pub fn take_pending_resize(&self) -> Option<(u32, u32)> {
        if let Ok(mut inner) = self.inner.write() {
            inner.pending_resize.take()
        } else {
            None
        }
    }

    /// Begin a frame and get timing info.
    ///
    /// Returns `None` if paused or already rendering.
    pub fn begin_frame(&self) -> Option<FrameInfo> {
        let mut inner = self.inner.write().ok()?;

        if inner.paused || inner.rendering {
            return None;
        }

        inner.rendering = true;
        let info = inner.timing.begin_frame();
        inner.last_frame_info = Some(info);

        Some(info)
    }

    /// End the current frame.
    ///
    /// Updates statistics and marks frame as complete.
    pub fn end_frame(&self, render_time: f64) {
        if let Ok(mut inner) = self.inner.write() {
            if inner.rendering {
                inner.rendering = false;
                inner.frames_rendered += 1;
                inner.total_render_time += render_time;
                inner.last_error = None;
            }
        }
    }

    /// End frame with error.
    pub fn end_frame_with_error(&self, error: RenderError) {
        if let Ok(mut inner) = self.inner.write() {
            inner.rendering = false;
            inner.last_error = Some(error);
        }
    }

    /// Execute a render frame with the callback.
    ///
    /// This is the preferred way to render a frame:
    /// 1. Begins the frame
    /// 2. Calls the render callback
    /// 3. Ends the frame (with error if callback failed)
    ///
    /// Returns `Ok(frame_info)` on success, `Err` if rendering failed or skipped.
    pub fn render_frame<F>(&self, render_fn: F) -> RenderResult<FrameInfo>
    where
        F: FnOnce(&RenderStateInner) -> RenderResult<()>,
    {
        // Begin frame
        let frame_info = self.begin_frame().ok_or(RenderError::RenderSkipped)?;

        let start = std::time::Instant::now();

        // Execute render callback with read access
        let result = {
            let inner = self
                .inner
                .read()
                .map_err(|_| RenderError::LockPoisoned)?;
            render_fn(&inner)
        };

        let render_time = start.elapsed().as_secs_f64();

        // End frame
        match result {
            Ok(()) => {
                self.end_frame(render_time);
                Ok(frame_info)
            }
            Err(e) => {
                self.end_frame_with_error(e.clone());
                Err(e)
            }
        }
    }

    /// Set paused state.
    ///
    /// When paused, `begin_frame()` returns `None`.
    pub fn set_paused(&self, paused: bool) {
        if let Ok(mut inner) = self.inner.write() {
            inner.paused = paused;
            inner.timing.set_paused(paused);
        }
    }

    /// Check if rendering is paused.
    #[must_use]
    pub fn is_paused(&self) -> bool {
        self.inner
            .read()
            .map(|inner| inner.paused)
            .unwrap_or(true)
    }

    /// Check if currently rendering a frame.
    #[must_use]
    pub fn is_rendering(&self) -> bool {
        self.inner
            .read()
            .map(|inner| inner.rendering)
            .unwrap_or(false)
    }

    /// Get the current FPS.
    #[must_use]
    pub fn current_fps(&self) -> f64 {
        self.inner
            .read()
            .map(|inner| inner.timing.average_fps())
            .unwrap_or(0.0)
    }

    /// Get frames rendered count.
    #[must_use]
    pub fn frames_rendered(&self) -> u64 {
        self.inner
            .read()
            .map(|inner| inner.frames_rendered)
            .unwrap_or(0)
    }

    /// Get average frame render time in milliseconds.
    #[must_use]
    #[allow(clippy::cast_precision_loss)]
    pub fn average_render_time_ms(&self) -> f64 {
        self.inner
            .read()
            .map(|inner| {
                if inner.frames_rendered > 0 {
                    (inner.total_render_time / inner.frames_rendered as f64) * 1000.0
                } else {
                    0.0
                }
            })
            .unwrap_or(0.0)
    }

    /// Get the quality level.
    #[must_use]
    pub fn quality_level(&self) -> QualityLevel {
        self.inner
            .read()
            .map(|inner| inner.quality.level)
            .unwrap_or(QualityLevel::Medium)
    }

    /// Set the quality level.
    pub fn set_quality_level(&self, level: QualityLevel) {
        if let Ok(mut inner) = self.inner.write() {
            let settings = QualitySettings::for_level(level);
            let target_fps = settings.target_fps;
            inner.quality = settings;
            inner.timing.set_target_fps(target_fps);
        }
    }

    /// Set custom quality settings.
    pub fn set_quality_settings(&self, settings: QualitySettings) {
        if let Ok(mut inner) = self.inner.write() {
            inner.timing.set_target_fps(settings.target_fps);
            inner.quality = settings;
        }
    }

    /// Get read access to inner state.
    pub fn read(&self) -> Option<RwLockReadGuard<'_, RenderStateInner>> {
        self.inner.read().ok()
    }

    /// Get write access to inner state.
    pub fn write(&self) -> Option<RwLockWriteGuard<'_, RenderStateInner>> {
        self.inner.write().ok()
    }

    /// Get the last frame info.
    #[must_use]
    pub fn last_frame_info(&self) -> Option<FrameInfo> {
        self.inner.read().ok()?.last_frame_info
    }

    /// Get the last error (if any).
    #[must_use]
    pub fn last_error(&self) -> Option<RenderError> {
        self.inner.read().ok()?.last_error.clone()
    }

    /// Reset statistics.
    pub fn reset_stats(&self) {
        if let Ok(mut inner) = self.inner.write() {
            inner.frames_rendered = 0;
            inner.total_render_time = 0.0;
            inner.timing.reset();
        }
    }
}

impl Default for RenderState {
    fn default() -> Self {
        Self::new(60)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_render_state_new() {
        let state = RenderState::new(60);
        assert!(!state.is_paused());
        assert!(!state.is_rendering());
        assert_eq!(state.frames_rendered(), 0);
    }

    #[test]
    fn test_render_state_pause() {
        let state = RenderState::new(60);

        state.set_paused(true);
        assert!(state.is_paused());

        // Begin frame should return None when paused
        assert!(state.begin_frame().is_none());

        state.set_paused(false);
        assert!(!state.is_paused());
    }

    #[test]
    fn test_render_state_resize() {
        let state = RenderState::new(60);

        assert!(state.take_pending_resize().is_none());

        state.request_resize(1920, 1080);
        assert_eq!(state.take_pending_resize(), Some((1920, 1080)));
        assert!(state.take_pending_resize().is_none());
    }

    #[test]
    fn test_render_state_frame() {
        let state = RenderState::new(60);

        let info = state.begin_frame().unwrap();
        assert!(state.is_rendering());
        assert_eq!(info.frame_number, 1);

        state.end_frame(0.016);
        assert!(!state.is_rendering());
        assert_eq!(state.frames_rendered(), 1);
    }

    #[test]
    fn test_render_frame_callback() {
        let state = RenderState::new(60);

        let result = state.render_frame(|_inner| Ok(()));

        assert!(result.is_ok());
        assert_eq!(state.frames_rendered(), 1);
    }

    #[test]
    fn test_quality_level_change() {
        let state = RenderState::new(60);

        state.set_quality_level(QualityLevel::Ultra);
        assert_eq!(state.quality_level(), QualityLevel::Ultra);
    }

    #[test]
    fn test_send_sync() {
        // Compile-time check that RenderState is Send + Sync
        fn assert_send_sync<T: Send + Sync>() {}
        assert_send_sync::<RenderState>();
    }

    #[test]
    fn test_thread_safety() {
        use std::thread;

        let state = Arc::new(RenderState::new(60));
        let state2 = Arc::clone(&state);

        // Spawn thread to render
        let handle = thread::spawn(move || {
            for _ in 0..10 {
                if let Some(_info) = state2.begin_frame() {
                    state2.end_frame(0.001);
                }
            }
        });

        // Main thread: query FPS
        for _ in 0..10 {
            let _fps = state.current_fps();
            let _paused = state.is_paused();
        }

        handle.join().unwrap();
        assert!(state.frames_rendered() > 0);
    }
}
