// Common math utilities for WGSL shaders.
//
// Include with: #include "math.wgsl"
//
// Provides:
// - Mathematical constants (PI, TAU, E)
// - Saturation/clamping functions
// - Interpolation functions
// - Remapping functions

// =============================================================================
// Constants
// =============================================================================

/// Pi constant (3.14159...)
const PI: f32 = 3.14159265359;

/// Tau constant (2 * PI = 6.28318...)
const TAU: f32 = 6.28318530718;

/// Euler's number (2.71828...)
const E: f32 = 2.71828182846;

/// Golden ratio (1.61803...)
const PHI: f32 = 1.61803398875;

/// Square root of 2
const SQRT2: f32 = 1.41421356237;

/// Natural log of 2
const LN2: f32 = 0.69314718056;

// =============================================================================
// Saturation / Clamping
// =============================================================================

/// Clamp a scalar to [0, 1].
fn saturate(x: f32) -> f32 {
    return clamp(x, 0.0, 1.0);
}

/// Clamp a vec2 to [0, 1].
fn saturate2(v: vec2<f32>) -> vec2<f32> {
    return clamp(v, vec2<f32>(0.0), vec2<f32>(1.0));
}

/// Clamp a vec3 to [0, 1].
fn saturate3(v: vec3<f32>) -> vec3<f32> {
    return clamp(v, vec3<f32>(0.0), vec3<f32>(1.0));
}

/// Clamp a vec4 to [0, 1].
fn saturate4(v: vec4<f32>) -> vec4<f32> {
    return clamp(v, vec4<f32>(0.0), vec4<f32>(1.0));
}

// =============================================================================
// Interpolation
// =============================================================================

/// Linear interpolation between two scalars.
fn lerp(a: f32, b: f32, t: f32) -> f32 {
    return a + (b - a) * t;
}

/// Linear interpolation between two vec2s.
fn lerp2(a: vec2<f32>, b: vec2<f32>, t: f32) -> vec2<f32> {
    return a + (b - a) * t;
}

/// Linear interpolation between two vec3s.
fn lerp3(a: vec3<f32>, b: vec3<f32>, t: f32) -> vec3<f32> {
    return a + (b - a) * t;
}

/// Linear interpolation between two vec4s.
fn lerp4(a: vec4<f32>, b: vec4<f32>, t: f32) -> vec4<f32> {
    return a + (b - a) * t;
}

/// Smooth Hermite interpolation (smoothstep).
fn smooth(t: f32) -> f32 {
    return t * t * (3.0 - 2.0 * t);
}

/// Smoother interpolation (smootherstep).
fn smoother(t: f32) -> f32 {
    return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

// =============================================================================
// Remapping
// =============================================================================

/// Remap a value from one range to another.
fn remap(value: f32, in_min: f32, in_max: f32, out_min: f32, out_max: f32) -> f32 {
    return out_min + (value - in_min) * (out_max - out_min) / (in_max - in_min);
}

/// Remap a value from one range to another, clamped to output range.
fn remap_clamped(value: f32, in_min: f32, in_max: f32, out_min: f32, out_max: f32) -> f32 {
    let t = saturate((value - in_min) / (in_max - in_min));
    return out_min + t * (out_max - out_min);
}

// =============================================================================
// Utility Functions
// =============================================================================

/// Return the fractional part of a value.
fn frac(x: f32) -> f32 {
    return x - floor(x);
}

/// Return the fractional part of a vec2.
fn frac2(v: vec2<f32>) -> vec2<f32> {
    return v - floor(v);
}

/// Return the fractional part of a vec3.
fn frac3(v: vec3<f32>) -> vec3<f32> {
    return v - floor(v);
}

/// Compute the length squared (avoids sqrt).
fn length_squared2(v: vec2<f32>) -> f32 {
    return dot(v, v);
}

/// Compute the length squared (avoids sqrt).
fn length_squared3(v: vec3<f32>) -> f32 {
    return dot(v, v);
}

/// Safe normalize that returns zero vector if input is zero.
fn safe_normalize2(v: vec2<f32>) -> vec2<f32> {
    let len_sq = dot(v, v);
    if len_sq < 0.0001 {
        return vec2<f32>(0.0);
    }
    return v / sqrt(len_sq);
}

/// Safe normalize that returns zero vector if input is zero.
fn safe_normalize3(v: vec3<f32>) -> vec3<f32> {
    let len_sq = dot(v, v);
    if len_sq < 0.0001 {
        return vec3<f32>(0.0);
    }
    return v / sqrt(len_sq);
}

// =============================================================================
// Angle Conversions
// =============================================================================

/// Convert degrees to radians.
fn deg_to_rad(degrees: f32) -> f32 {
    return degrees * PI / 180.0;
}

/// Convert radians to degrees.
fn rad_to_deg(radians: f32) -> f32 {
    return radians * 180.0 / PI;
}

// =============================================================================
// Step Functions
// =============================================================================

/// Smooth minimum (soft blend between two values).
fn smin(a: f32, b: f32, k: f32) -> f32 {
    let h = max(k - abs(a - b), 0.0) / k;
    return min(a, b) - h * h * k * 0.25;
}

/// Smooth maximum (soft blend between two values).
fn smax(a: f32, b: f32, k: f32) -> f32 {
    let h = max(k - abs(a - b), 0.0) / k;
    return max(a, b) + h * h * k * 0.25;
}
