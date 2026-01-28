// HD Neon and energy trail effects.
//
// Include with: #include "neon_hd.wgsl"
//
// Dependencies: #include "math.wgsl"
//
// Provides:
// - Glowing line segments
// - Bezier curves with glow
// - Energy trails with motion blur
// - Pulse effects along paths
// - Chromatic aberration for enhanced effects

// =============================================================================
// Neon Line Configuration
// =============================================================================

/// Configuration for neon line effects.
struct NeonLineConfig {
    /// Line color (RGB).
    color: vec3<f32>,
    /// Line width in pixels.
    width: f32,
    /// Glow radius multiplier (relative to width).
    glow_radius: f32,
    /// Glow intensity.
    glow_intensity: f32,
    /// Motion blur strength (0 = none, 1 = full).
    motion_blur: f32,
    /// Pulse frequency (Hz).
    pulse_freq: f32,
    /// Enable chromatic aberration.
    chromatic: f32,
}

/// Create default neon line config.
fn neon_line_default() -> NeonLineConfig {
    return NeonLineConfig(
        vec3<f32>(0.4, 0.6, 1.0), // Opta blue
        2.0,                       // 2px width
        4.0,                       // 4x glow radius
        1.5,                       // Good glow
        0.0,                       // No motion blur
        1.0,                       // 1 Hz pulse
        0.0                        // No chromatic
    );
}

/// Create hot neon line config.
fn neon_line_hot() -> NeonLineConfig {
    return NeonLineConfig(
        vec3<f32>(1.0, 0.3, 0.1), // Hot orange
        3.0,
        5.0,
        2.0,
        0.0,
        2.0,
        0.0
    );
}

/// Create electric neon line config.
fn neon_line_electric() -> NeonLineConfig {
    return NeonLineConfig(
        vec3<f32>(0.0, 1.0, 1.0), // Cyan
        1.5,
        6.0,
        2.5,
        0.3,    // Some motion blur
        3.0,    // Fast pulse
        0.5     // Chromatic aberration
    );
}

// =============================================================================
// Distance Functions for Lines and Curves
// =============================================================================

/// Signed distance to line segment.
/// @param p Point to evaluate.
/// @param a Line start.
/// @param b Line end.
fn sd_line_segment(p: vec2<f32>, a: vec2<f32>, b: vec2<f32>) -> f32 {
    let pa = p - a;
    let ba = b - a;
    let h = saturate(dot(pa, ba) / dot(ba, ba));
    return length(pa - ba * h);
}

/// Point on quadratic bezier curve at t.
/// @param t Parameter (0-1).
/// @param p0 Start point.
/// @param p1 Control point.
/// @param p2 End point.
fn bezier_point(t: f32, p0: vec2<f32>, p1: vec2<f32>, p2: vec2<f32>) -> vec2<f32> {
    let u = 1.0 - t;
    return u * u * p0 + 2.0 * u * t * p1 + t * t * p2;
}

/// Tangent on quadratic bezier curve at t.
fn bezier_tangent(t: f32, p0: vec2<f32>, p1: vec2<f32>, p2: vec2<f32>) -> vec2<f32> {
    let u = 1.0 - t;
    return normalize(2.0 * u * (p1 - p0) + 2.0 * t * (p2 - p1));
}

/// Approximate distance to quadratic bezier curve.
/// Uses sampling approach for reasonable accuracy.
fn sd_bezier_approx(p: vec2<f32>, p0: vec2<f32>, p1: vec2<f32>, p2: vec2<f32>) -> f32 {
    var min_dist = 1e10;

    // Sample curve at multiple points
    let samples = 16;
    for (var i = 0; i < samples; i = i + 1) {
        let t = f32(i) / f32(samples - 1);
        let curve_point = bezier_point(t, p0, p1, p2);
        min_dist = min(min_dist, length(p - curve_point));
    }

    return min_dist;
}

/// Point on cubic bezier curve at t.
fn cubic_bezier_point(t: f32, p0: vec2<f32>, p1: vec2<f32>, p2: vec2<f32>, p3: vec2<f32>) -> vec2<f32> {
    let u = 1.0 - t;
    let u2 = u * u;
    let u3 = u2 * u;
    let t2 = t * t;
    let t3 = t2 * t;
    return u3 * p0 + 3.0 * u2 * t * p1 + 3.0 * u * t2 * p2 + t3 * p3;
}

// =============================================================================
// Neon Line Rendering
// =============================================================================

/// Render a glowing neon line segment.
/// @param p Point to evaluate.
/// @param a Line start.
/// @param b Line end.
/// @param config Line configuration.
fn neon_line(p: vec2<f32>, a: vec2<f32>, b: vec2<f32>, config: NeonLineConfig) -> vec4<f32> {
    let dist = sd_line_segment(p, a, b);

    // Core line (sharp)
    let core_half_width = config.width * 0.5;
    let core = 1.0 - smoothstep(0.0, core_half_width, dist);

    // Glow (soft falloff)
    let glow_radius = config.width * config.glow_radius;
    let glow = exp(-dist * dist / (glow_radius * glow_radius)) * config.glow_intensity;

    // Combine
    let intensity = core + glow;
    let color = config.color * intensity;

    return vec4<f32>(color, intensity);
}

/// Render a glowing neon bezier curve.
/// @param p Point to evaluate.
/// @param p0 Start point.
/// @param p1 Control point.
/// @param p2 End point.
/// @param config Line configuration.
fn neon_curve(p: vec2<f32>, p0: vec2<f32>, p1: vec2<f32>, p2: vec2<f32>, config: NeonLineConfig) -> vec4<f32> {
    let dist = sd_bezier_approx(p, p0, p1, p2);

    // Core
    let core_half_width = config.width * 0.5;
    let core = 1.0 - smoothstep(0.0, core_half_width, dist);

    // Glow
    let glow_radius = config.width * config.glow_radius;
    let glow = exp(-dist * dist / (glow_radius * glow_radius)) * config.glow_intensity;

    let intensity = core + glow;
    let color = config.color * intensity;

    return vec4<f32>(color, intensity);
}

// =============================================================================
// Motion Trail Effects
// =============================================================================

/// Neon trail with motion blur fading.
/// @param p Point to evaluate.
/// @param points Trail points (newest to oldest).
/// @param point_count Number of points.
/// @param config Line configuration.
fn neon_trail(p: vec2<f32>, points: array<vec2<f32>, 16>, point_count: i32, config: NeonLineConfig) -> vec4<f32> {
    var color = vec3<f32>(0.0);
    var alpha = 0.0;

    // Render line segments with decreasing intensity
    for (var i = 0; i < point_count - 1; i = i + 1) {
        // Fade factor (newer = brighter)
        let age = f32(i) / f32(point_count - 1);
        let fade = 1.0 - age * config.motion_blur;

        let segment = neon_line(p, points[i], points[i + 1], config);
        color = color + segment.rgb * fade;
        alpha = max(alpha, segment.a * fade);
    }

    return vec4<f32>(color, alpha);
}

/// Energy pulse traveling along a path.
/// @param p Point to evaluate.
/// @param path_t Parameter along path (0-1).
/// @param pulse_t Current pulse position (0-1).
/// @param config Line configuration.
/// @param time Current time.
fn neon_pulse(p: vec2<f32>, path_t: f32, pulse_t: f32, config: NeonLineConfig, time: f32) -> f32 {
    // Distance from pulse center
    let pulse_width = 0.15;
    let dist_from_pulse = abs(path_t - pulse_t);

    // Wrap around for continuous pulse
    let wrapped_dist = min(dist_from_pulse, 1.0 - dist_from_pulse);

    // Pulse intensity
    let pulse = exp(-wrapped_dist * wrapped_dist / (pulse_width * pulse_width));

    // Add temporal variation
    let flicker = 0.9 + 0.1 * sin(time * config.pulse_freq * TAU * 5.0);

    return pulse * flicker;
}

/// Animated energy pulse along a line.
fn animated_neon_line(p: vec2<f32>, a: vec2<f32>, b: vec2<f32>, config: NeonLineConfig, time: f32) -> vec4<f32> {
    // Base line
    let base = neon_line(p, a, b, config);

    // Calculate position along line
    let ab = b - a;
    let ap = p - a;
    let t = saturate(dot(ap, ab) / dot(ab, ab));

    // Pulse position (moving along line)
    let pulse_t = fract(time * config.pulse_freq * 0.5);

    // Pulse intensity
    let pulse = neon_pulse(p, t, pulse_t, config, time);

    // Enhance color at pulse
    let pulse_color = config.color * (1.0 + pulse * 2.0);
    let final_color = mix(base.rgb, pulse_color, pulse * 0.5);

    return vec4<f32>(final_color, base.a * (1.0 + pulse * 0.5));
}

// =============================================================================
// Chromatic Aberration
// =============================================================================

/// Apply chromatic aberration to neon effect.
/// @param uv Current UV coordinate.
/// @param center Effect center.
/// @param strength Aberration strength.
fn chromatic_offset(uv: vec2<f32>, center: vec2<f32>, strength: f32) -> vec3<vec2<f32>> {
    let dir = normalize(uv - center);
    let dist = length(uv - center);

    // RGB channel offsets
    let r_offset = dir * dist * strength * 1.0;
    let g_offset = vec2<f32>(0.0);
    let b_offset = -dir * dist * strength * 1.0;

    return vec3<vec2<f32>>(
        uv + r_offset,
        uv + g_offset,
        uv + b_offset
    );
}

/// Render neon line with chromatic aberration.
fn neon_line_chromatic(
    p: vec2<f32>,
    a: vec2<f32>,
    b: vec2<f32>,
    config: NeonLineConfig,
    screen_center: vec2<f32>
) -> vec4<f32> {
    if config.chromatic < 0.001 {
        return neon_line(p, a, b, config);
    }

    let offsets = chromatic_offset(p, screen_center, config.chromatic * 0.01);

    // Sample each channel at offset position
    let r_config = NeonLineConfig(vec3<f32>(1.0, 0.0, 0.0), config.width, config.glow_radius,
                                   config.glow_intensity, config.motion_blur, config.pulse_freq, 0.0);
    let g_config = NeonLineConfig(vec3<f32>(0.0, 1.0, 0.0), config.width, config.glow_radius,
                                   config.glow_intensity, config.motion_blur, config.pulse_freq, 0.0);
    let b_config = NeonLineConfig(vec3<f32>(0.0, 0.0, 1.0), config.width, config.glow_radius,
                                   config.glow_intensity, config.motion_blur, config.pulse_freq, 0.0);

    let r = neon_line(offsets[0], a, b, r_config).r;
    let g = neon_line(offsets[1], a, b, g_config).g;
    let b_val = neon_line(offsets[2], a, b, b_config).b;

    // Tint by original color
    let final_color = vec3<f32>(r, g, b_val) * config.color;
    let alpha = max(max(r, g), b_val);

    return vec4<f32>(final_color, alpha);
}

// =============================================================================
// Spark and Particle Effects
// =============================================================================

/// Render a single spark point.
/// @param p Point to evaluate.
/// @param spark_pos Spark position.
/// @param config Line configuration.
fn neon_spark(p: vec2<f32>, spark_pos: vec2<f32>, config: NeonLineConfig) -> vec4<f32> {
    let dist = length(p - spark_pos);

    // Intense core
    let core = exp(-dist * dist * 100.0 / (config.width * config.width));

    // Softer glow
    let glow_radius = config.width * config.glow_radius * 0.5;
    let glow = exp(-dist * dist / (glow_radius * glow_radius)) * config.glow_intensity * 0.5;

    let intensity = core + glow;
    return vec4<f32>(config.color * intensity, intensity);
}

/// Energy arc between two points (electrical discharge).
/// @param p Point to evaluate.
/// @param a Arc start.
/// @param b Arc end.
/// @param config Line configuration.
/// @param time Current time for animation.
/// @param seed Random seed for arc variation.
fn energy_arc(p: vec2<f32>, a: vec2<f32>, b: vec2<f32>, config: NeonLineConfig, time: f32, seed: f32) -> vec4<f32> {
    let ab = b - a;
    let len = length(ab);
    let dir = ab / len;
    let perp = vec2<f32>(-dir.y, dir.x);

    // Project point onto line
    let ap = p - a;
    let t = saturate(dot(ap, dir) / len);

    // Displacement from straight line (sinusoidal with noise)
    let freq1 = 3.0 + seed;
    let freq2 = 7.0 + seed * 2.0;
    let displacement = sin(t * freq1 * TAU + time * 10.0) * 0.02 * len +
                       sin(t * freq2 * TAU + time * 15.0) * 0.01 * len;

    // Arc point
    let arc_point = a + dir * t * len + perp * displacement;

    // Distance to arc
    let dist = length(p - arc_point);

    // Render as neon
    let core = exp(-dist * dist * 200.0 / (config.width * config.width));
    let glow_radius = config.width * config.glow_radius * 0.5;
    let glow = exp(-dist * dist / (glow_radius * glow_radius)) * config.glow_intensity;

    let intensity = core + glow;
    return vec4<f32>(config.color * intensity, intensity);
}

// =============================================================================
// Utility Functions
// =============================================================================

/// Saturate helper.
fn saturate(x: f32) -> f32 {
    return clamp(x, 0.0, 1.0);
}

/// TAU constant.
const TAU: f32 = 6.28318530718;

/// Smoothstep function.
fn smoothstep(edge0: f32, edge1: f32, x: f32) -> f32 {
    let t = saturate((x - edge0) / (edge1 - edge0));
    return t * t * (3.0 - 2.0 * t);
}
