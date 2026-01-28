//! Integration tests for frame timing and quality systems.

use opta_render::{
    FrameInfo, FrameTiming, QualityLevel, QualitySettings, RenderState, ShadowQuality,
};

// =============================================================================
// Frame Timing Tests
// =============================================================================

#[test]
fn test_frame_timing_creation() {
    let timing = FrameTiming::new(60);
    assert_eq!(timing.target_fps(), 60);
    assert_eq!(timing.frame_count(), 0);
    assert!(!timing.is_paused());
}

#[test]
fn test_frame_timing_promotion() {
    let timing = FrameTiming::for_promotion();
    assert_eq!(timing.target_fps(), 120);
}

#[test]
fn test_frame_timing_standard() {
    let timing = FrameTiming::for_standard();
    assert_eq!(timing.target_fps(), 60);
}

#[test]
fn test_frame_timing_begin_frame() {
    let mut timing = FrameTiming::new(60);

    let info = timing.begin_frame();
    assert_eq!(info.frame_number, 1);
    assert_eq!(info.target_fps, 60);
    assert!(info.delta_time > 0.0);
    assert!(info.estimated_fps > 0.0);

    let info2 = timing.begin_frame();
    assert_eq!(info2.frame_number, 2);
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
fn test_frame_timing_target_fps_change() {
    let mut timing = FrameTiming::new(60);
    assert_eq!(timing.target_fps(), 60);

    timing.set_target_fps(120);
    assert_eq!(timing.target_fps(), 120);

    // Test clamping
    timing.set_target_fps(0);
    assert_eq!(timing.target_fps(), 1);

    timing.set_target_fps(300);
    assert_eq!(timing.target_fps(), 240);
}

#[test]
fn test_frame_info_methods() {
    let info = FrameInfo {
        delta_time: 0.016_666,
        frame_number: 100,
        target_fps: 60,
        estimated_fps: 60.0,
        instant_fps: 60.0,
        is_frame_drop: false,
    };

    assert!((info.delta_time_f32() - 0.016_666).abs() < 0.0001);
    assert!((info.target_frame_time() - 0.016_666).abs() < 0.001);
}

// =============================================================================
// Quality Settings Tests
// =============================================================================

#[test]
fn test_quality_level_from_u32() {
    assert_eq!(QualityLevel::from_u32(0), QualityLevel::Low);
    assert_eq!(QualityLevel::from_u32(1), QualityLevel::Medium);
    assert_eq!(QualityLevel::from_u32(2), QualityLevel::High);
    assert_eq!(QualityLevel::from_u32(3), QualityLevel::Ultra);
    assert_eq!(QualityLevel::from_u32(99), QualityLevel::Medium); // Invalid defaults to Medium
}

#[test]
fn test_quality_level_as_u32() {
    assert_eq!(QualityLevel::Low.as_u32(), 0);
    assert_eq!(QualityLevel::Medium.as_u32(), 1);
    assert_eq!(QualityLevel::High.as_u32(), 2);
    assert_eq!(QualityLevel::Ultra.as_u32(), 3);
}

#[test]
fn test_quality_level_names() {
    assert_eq!(QualityLevel::Low.name(), "Low");
    assert_eq!(QualityLevel::Medium.name(), "Medium");
    assert_eq!(QualityLevel::High.name(), "High");
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
fn test_shadow_quality_enabled() {
    assert!(!ShadowQuality::Off.is_enabled());
    assert!(ShadowQuality::Low.is_enabled());
    assert!(ShadowQuality::Medium.is_enabled());
    assert!(ShadowQuality::High.is_enabled());
}

#[test]
fn test_quality_settings_for_level_low() {
    let settings = QualitySettings::for_level(QualityLevel::Low);

    assert_eq!(settings.level, QualityLevel::Low);
    assert_eq!(settings.target_fps, 30);
    assert_eq!(settings.msaa_samples, 1);
    assert!(!settings.is_msaa_enabled());
    assert_eq!(settings.shadow_quality, ShadowQuality::Off);
    assert!(!settings.bloom_enabled);
}

#[test]
fn test_quality_settings_for_level_medium() {
    let settings = QualitySettings::for_level(QualityLevel::Medium);

    assert_eq!(settings.level, QualityLevel::Medium);
    assert_eq!(settings.target_fps, 60);
    assert_eq!(settings.msaa_samples, 2);
    assert!(settings.is_msaa_enabled());
    assert_eq!(settings.shadow_quality, ShadowQuality::Low);
    assert!(settings.bloom_enabled);
}

#[test]
fn test_quality_settings_for_level_high() {
    let settings = QualitySettings::for_level(QualityLevel::High);

    assert_eq!(settings.level, QualityLevel::High);
    assert_eq!(settings.target_fps, 60);
    assert_eq!(settings.msaa_samples, 4);
    assert!(settings.ambient_occlusion);
}

#[test]
fn test_quality_settings_for_level_ultra() {
    let settings = QualitySettings::for_level(QualityLevel::Ultra);

    assert_eq!(settings.level, QualityLevel::Ultra);
    assert_eq!(settings.target_fps, 120);
    assert_eq!(settings.msaa_samples, 4);
    assert_eq!(settings.shadow_quality, ShadowQuality::High);
}

#[test]
fn test_quality_settings_effective_msaa() {
    let mut settings = QualitySettings::default();

    settings.msaa_samples = 0;
    assert_eq!(settings.effective_msaa_samples(), 1);

    settings.msaa_samples = 1;
    assert_eq!(settings.effective_msaa_samples(), 1);

    settings.msaa_samples = 2;
    assert_eq!(settings.effective_msaa_samples(), 2);

    settings.msaa_samples = 3;
    assert_eq!(settings.effective_msaa_samples(), 4);

    settings.msaa_samples = 4;
    assert_eq!(settings.effective_msaa_samples(), 4);
}

#[test]
fn test_quality_settings_effective_resolution() {
    let mut settings = QualitySettings::default();

    settings.render_scale = 1.0;
    let (w, h) = settings.effective_resolution(1920, 1080);
    assert_eq!(w, 1920);
    assert_eq!(h, 1080);

    settings.render_scale = 0.5;
    let (w, h) = settings.effective_resolution(1920, 1080);
    assert_eq!(w, 960);
    assert_eq!(h, 540);

    settings.render_scale = 2.0;
    let (w, h) = settings.effective_resolution(1920, 1080);
    assert_eq!(w, 3840);
    assert_eq!(h, 2160);
}

#[test]
fn test_quality_settings_builder() {
    let settings = QualitySettings::custom()
        .target_fps(120)
        .msaa_samples(4)
        .shadows(ShadowQuality::High)
        .bloom(true)
        .ambient_occlusion(true)
        .render_scale(1.5)
        .build();

    assert_eq!(settings.target_fps, 120);
    assert_eq!(settings.msaa_samples, 4);
    assert_eq!(settings.shadow_quality, ShadowQuality::High);
    assert!(settings.bloom_enabled);
    assert!(settings.ambient_occlusion);
    assert!((settings.render_scale - 1.5).abs() < f32::EPSILON);
}

// =============================================================================
// Render State Tests
// =============================================================================

#[test]
fn test_render_state_creation() {
    let state = RenderState::new(60);

    assert!(!state.is_paused());
    assert!(!state.is_rendering());
    assert_eq!(state.frames_rendered(), 0);
    assert_eq!(state.quality_level(), QualityLevel::Medium);
}

#[test]
fn test_render_state_with_quality() {
    let quality = QualitySettings::for_level(QualityLevel::Ultra);
    let state = RenderState::with_quality(quality);

    assert_eq!(state.quality_level(), QualityLevel::Ultra);
}

#[test]
fn test_render_state_pause() {
    let state = RenderState::new(60);

    state.set_paused(true);
    assert!(state.is_paused());
    assert!(state.begin_frame().is_none()); // Should not begin frame when paused

    state.set_paused(false);
    assert!(!state.is_paused());
    assert!(state.begin_frame().is_some()); // Should begin frame when unpaused
}

#[test]
fn test_render_state_frame_lifecycle() {
    let state = RenderState::new(60);

    // Begin frame
    let info = state.begin_frame().unwrap();
    assert_eq!(info.frame_number, 1);
    assert!(state.is_rendering());

    // Cannot begin another frame while rendering
    assert!(state.begin_frame().is_none());

    // End frame
    state.end_frame(0.010);
    assert!(!state.is_rendering());
    assert_eq!(state.frames_rendered(), 1);
}

#[test]
fn test_render_state_resize() {
    let state = RenderState::new(60);

    // No pending resize initially
    assert!(state.take_pending_resize().is_none());

    // Request resize
    state.request_resize(1920, 1080);
    assert_eq!(state.take_pending_resize(), Some((1920, 1080)));

    // Should be consumed
    assert!(state.take_pending_resize().is_none());
}

#[test]
fn test_render_state_quality_change() {
    let state = RenderState::new(60);

    state.set_quality_level(QualityLevel::Ultra);
    assert_eq!(state.quality_level(), QualityLevel::Ultra);

    state.set_quality_level(QualityLevel::Low);
    assert_eq!(state.quality_level(), QualityLevel::Low);
}

#[test]
fn test_render_state_thread_safety() {
    use std::sync::Arc;
    use std::thread;

    let state = Arc::new(RenderState::new(60));
    let state_clone = Arc::clone(&state);

    // Render thread
    let render_handle = thread::spawn(move || {
        for _ in 0..5 {
            if let Some(_info) = state_clone.begin_frame() {
                thread::sleep(std::time::Duration::from_millis(1));
                state_clone.end_frame(0.001);
            }
        }
    });

    // Main thread queries
    for _ in 0..10 {
        let _ = state.current_fps();
        let _ = state.is_paused();
        let _ = state.frames_rendered();
    }

    render_handle.join().unwrap();
    assert!(state.frames_rendered() > 0);
}

#[test]
fn test_render_state_stats_reset() {
    let state = RenderState::new(60);

    // Render some frames
    for _ in 0..5 {
        if let Some(_info) = state.begin_frame() {
            state.end_frame(0.001);
        }
    }
    assert_eq!(state.frames_rendered(), 5);

    // Reset stats
    state.reset_stats();
    assert_eq!(state.frames_rendered(), 0);
}

#[test]
fn test_render_state_send_sync() {
    fn assert_send_sync<T: Send + Sync>() {}
    assert_send_sync::<RenderState>();
}
