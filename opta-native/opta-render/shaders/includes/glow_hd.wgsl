// HD Glow effects for premium visual polish.
//
// Include with: #include "glow_hd.wgsl"
//
// Dependencies: #include "math.wgsl"
//
// Provides:
// - Soft radial glow
// - Neon edge glow with bloom
// - Energy pulse animations
// - SDF-based glow effects
// - Panel edge glow with fresnel awareness

// =============================================================================
// Glow Configuration
// =============================================================================

/// Configuration for glow effects.
struct GlowConfig {
    /// Base glow color (RGB).
    color: vec3<f32>,
    /// Glow intensity (0.0 - 2.0+).
    intensity: f32,
    /// Falloff exponent (1 = linear, 2 = quadratic).
    falloff: f32,
    /// Glow radius in normalized units.
    radius: f32,
    /// Inner vs outer glow blend (0 = outer only, 1 = inner only).
    inner_blend: f32,
    /// Pulse frequency (Hz).
    pulse_freq: f32,
    /// Pulse amplitude (0.0 - 1.0).
    pulse_amp: f32,
}

/// Create default glow configuration.
fn glow_default() -> GlowConfig {
    return GlowConfig(
        vec3<f32>(0.4, 0.6, 1.0), // Opta blue
        1.0,                       // Standard intensity
        2.0,                       // Quadratic falloff
        0.3,                       // Moderate radius
        0.5,                       // Balanced inner/outer
        1.0,                       // 1 Hz pulse
        0.2                        // Subtle pulse
    );
}

/// Create soft ambient glow config.
fn glow_ambient() -> GlowConfig {
    return GlowConfig(
        vec3<f32>(0.3, 0.5, 0.9),
        0.5,
        3.0,    // Softer falloff
        0.5,
        0.3,    // More outer glow
        0.5,
        0.1
    );
}

/// Create intense neon glow config.
fn glow_neon() -> GlowConfig {
    return GlowConfig(
        vec3<f32>(0.0, 1.0, 1.0), // Cyan
        2.0,                       // Intense
        1.5,                       // Sharp falloff
        0.2,                       // Tight radius
        0.2,                       // Mostly outer
        2.0,                       // Fast pulse
        0.3                        // Noticeable pulse
    );
}

// =============================================================================
// Basic Glow Functions
// =============================================================================

/// Soft radial glow with configurable falloff.
/// @param dist Distance from glow source (normalized).
/// @param config Glow configuration.
fn soft_glow(dist: f32, config: GlowConfig) -> vec3<f32> {
    // Normalized distance within glow radius
    let norm_dist = saturate(dist / config.radius);

    // Apply falloff curve
    let falloff = pow(1.0 - norm_dist, config.falloff);

    return config.color * config.intensity * falloff;
}

/// Sharp edge glow with soft spread (neon-like).
/// @param dist Distance from edge (positive = outside).
/// @param config Glow configuration.
fn neon_glow(dist: f32, config: GlowConfig) -> vec3<f32> {
    // Sharp core at the edge
    let core = exp(-abs(dist) * 20.0);

    // Soft spread beyond core
    let spread = exp(-max(dist, 0.0) * 5.0 / config.radius);

    // Combine core and spread
    let glow = mix(spread, core, 0.5) * config.intensity;

    return config.color * glow;
}

/// Inner glow that intensifies toward the center.
/// @param dist Distance from center (0 = center, 1 = edge).
/// @param config Glow configuration.
fn inner_glow(dist: f32, config: GlowConfig) -> vec3<f32> {
    // Invert distance for inner glow
    let inner_dist = 1.0 - dist;

    // Apply falloff
    let falloff = pow(inner_dist, config.falloff);

    return config.color * config.intensity * falloff * config.inner_blend;
}

/// Outer glow that fades away from center.
/// @param dist Distance from center (0 = center, 1+ = outside).
/// @param config Glow configuration.
fn outer_glow(dist: f32, config: GlowConfig) -> vec3<f32> {
    // Only apply beyond radius 1
    let outer_dist = max(dist - 1.0, 0.0);

    // Fade with distance
    let falloff = exp(-outer_dist * config.falloff / config.radius);

    return config.color * config.intensity * falloff * (1.0 - config.inner_blend);
}

/// Combined inner and outer glow.
fn combined_glow(dist: f32, config: GlowConfig) -> vec3<f32> {
    return inner_glow(min(dist, 1.0), config) + outer_glow(dist, config);
}

// =============================================================================
// Animated Glow Functions
// =============================================================================

/// Energy pulse animation.
/// @param base_intensity Base glow intensity.
/// @param time Current time.
/// @param config Glow configuration.
fn energy_pulse(base_intensity: f32, time: f32, config: GlowConfig) -> f32 {
    let pulse = sin(time * config.pulse_freq * TAU) * 0.5 + 0.5;
    return base_intensity * (1.0 + pulse * config.pulse_amp);
}

/// Breathing glow animation (smooth in/out).
fn breathing_glow(time: f32, freq: f32) -> f32 {
    // Smoother than sine using eased curve
    let t = fract(time * freq);
    let ease = t * t * (3.0 - 2.0 * t); // smoothstep-like
    return ease;
}

/// Flickering glow animation (electrical feel).
fn flicker_glow(time: f32, base_freq: f32) -> f32 {
    // Multiple frequencies for irregular flicker
    let f1 = sin(time * base_freq * 7.3) * 0.5 + 0.5;
    let f2 = sin(time * base_freq * 13.7) * 0.5 + 0.5;
    let f3 = sin(time * base_freq * 23.1) * 0.5 + 0.5;

    // Combine with varying weights
    let flicker = f1 * 0.5 + f2 * 0.3 + f3 * 0.2;

    // Add occasional spike
    let spike = step(0.95, fract(time * base_freq * 2.0)) * 0.5;

    return flicker + spike;
}

// =============================================================================
// SDF-Based Glow Functions
// =============================================================================

/// Glow from signed distance field.
/// @param sdf Signed distance (negative = inside, positive = outside).
/// @param config Glow configuration.
fn glow_from_sdf(sdf: f32, config: GlowConfig) -> vec3<f32> {
    // Inner glow (when inside shape)
    var glow = vec3<f32>(0.0);

    if sdf < 0.0 {
        // Inside - apply inner glow based on distance from edge
        let inner_dist = -sdf / config.radius;
        glow = config.color * config.intensity * config.inner_blend *
               exp(-inner_dist * config.falloff);
    }

    // Outer glow (always applies for positive SDF)
    if sdf > 0.0 || config.inner_blend < 1.0 {
        let outer_dist = max(sdf, 0.0) / config.radius;
        let outer = config.color * config.intensity * (1.0 - config.inner_blend) *
                    exp(-outer_dist * config.falloff);
        glow = glow + outer;
    }

    return glow;
}

/// Edge glow from SDF (concentrated at the edge).
/// @param sdf Signed distance.
/// @param edge_width Width of edge glow region.
/// @param config Glow configuration.
fn edge_glow_from_sdf(sdf: f32, edge_width: f32, config: GlowConfig) -> vec3<f32> {
    // Distance from edge (0 at edge, increases both inside and outside)
    let edge_dist = abs(sdf);

    // Sharp falloff at edge
    let edge_factor = 1.0 - saturate(edge_dist / edge_width);
    let sharp_edge = pow(edge_factor, config.falloff);

    return config.color * config.intensity * sharp_edge;
}

// =============================================================================
// Panel-Specific Glow Functions
// =============================================================================

/// Panel edge glow with fresnel awareness.
/// @param edge_dist Distance from panel edge (positive = inside).
/// @param fresnel Fresnel factor (0 = center, 1 = edge).
/// @param config Glow configuration.
fn panel_edge_glow(edge_dist: f32, fresnel: f32, config: GlowConfig) -> vec3<f32> {
    // Base edge glow
    let glow_dist = saturate(edge_dist / config.radius);
    let base_glow = (1.0 - glow_dist) * exp(-glow_dist * config.falloff);

    // Enhance at fresnel angles
    let fresnel_enhance = 1.0 + fresnel * 0.5;

    return config.color * config.intensity * base_glow * fresnel_enhance;
}

/// Panel corner glow (stronger at corners).
/// @param uv Panel UV coordinates (0-1).
/// @param corner_radius Corner radius in UV space.
/// @param config Glow configuration.
fn panel_corner_glow(uv: vec2<f32>, corner_radius: f32, config: GlowConfig) -> vec3<f32> {
    // Distance from each corner
    let tl = length(uv);
    let tr = length(uv - vec2<f32>(1.0, 0.0));
    let bl = length(uv - vec2<f32>(0.0, 1.0));
    let br = length(uv - vec2<f32>(1.0, 1.0));

    // Minimum corner distance
    let corner_dist = min(min(tl, tr), min(bl, br));

    // Glow in corner regions
    let corner_factor = 1.0 - smoothstep(0.0, corner_radius, corner_dist);

    return config.color * config.intensity * corner_factor * 0.5;
}

// =============================================================================
// Bloom Integration Helpers
// =============================================================================

/// Extract bright areas for bloom pass.
/// @param color Input color.
/// @param threshold Brightness threshold for bloom.
fn extract_bloom(color: vec3<f32>, threshold: f32) -> vec3<f32> {
    let luminance = dot(color, vec3<f32>(0.299, 0.587, 0.114));
    let bloom_factor = max(luminance - threshold, 0.0) / max(luminance, 0.001);
    return color * bloom_factor;
}

/// Apply bloom with intensity control.
/// @param original Original color.
/// @param bloom Bloom texture sample.
/// @param intensity Bloom intensity.
fn apply_bloom(original: vec3<f32>, bloom: vec3<f32>, intensity: f32) -> vec3<f32> {
    return original + bloom * intensity;
}

/// Calculate glow contribution for bloom pass.
/// @param glow_color Glow color from glow functions.
/// @param bloom_threshold Threshold for bloom extraction.
fn glow_for_bloom(glow_color: vec3<f32>, bloom_threshold: f32) -> vec4<f32> {
    let extracted = extract_bloom(glow_color, bloom_threshold);
    let luminance = dot(extracted, vec3<f32>(0.299, 0.587, 0.114));
    return vec4<f32>(extracted, luminance);
}

// =============================================================================
// Utility Functions
// =============================================================================

/// Saturate helper (clamp 0-1).
fn saturate(x: f32) -> f32 {
    return clamp(x, 0.0, 1.0);
}

/// TAU constant.
const TAU: f32 = 6.28318530718;

/// Smoothstep function.
fn smoothstep_custom(edge0: f32, edge1: f32, x: f32) -> f32 {
    let t = saturate((x - edge0) / (edge1 - edge0));
    return t * t * (3.0 - 2.0 * t);
}
