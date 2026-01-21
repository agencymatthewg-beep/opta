// Signed Distance Field primitives and operations.
//
// Include with: #include "sdf.wgsl"
//
// Provides:
// - 2D SDF primitives (circle, box, line, etc.)
// - 3D SDF primitives (sphere, box, cylinder, etc.)
// - SDF operations (union, intersection, subtraction)
// - Smooth boolean operations

// =============================================================================
// 2D Primitives
// =============================================================================

/// Circle SDF.
/// @param p Point to evaluate.
/// @param r Circle radius.
fn sd_circle(p: vec2<f32>, r: f32) -> f32 {
    return length(p) - r;
}

/// Box SDF (axis-aligned).
/// @param p Point to evaluate.
/// @param b Box half-extents.
fn sd_box_2d(p: vec2<f32>, b: vec2<f32>) -> f32 {
    let d = abs(p) - b;
    return length(max(d, vec2<f32>(0.0))) + min(max(d.x, d.y), 0.0);
}

/// Rounded box SDF.
/// @param p Point to evaluate.
/// @param b Box half-extents.
/// @param r Corner radius.
fn sd_rounded_box_2d(p: vec2<f32>, b: vec2<f32>, r: f32) -> f32 {
    let d = abs(p) - b + r;
    return length(max(d, vec2<f32>(0.0))) + min(max(d.x, d.y), 0.0) - r;
}

/// Line segment SDF.
/// @param p Point to evaluate.
/// @param a Line start.
/// @param b Line end.
fn sd_segment(p: vec2<f32>, a: vec2<f32>, b: vec2<f32>) -> f32 {
    let pa = p - a;
    let ba = b - a;
    let h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h);
}

/// Ring SDF (hollow circle).
/// @param p Point to evaluate.
/// @param r Ring radius.
/// @param w Ring thickness.
fn sd_ring(p: vec2<f32>, r: f32, w: f32) -> f32 {
    return abs(length(p) - r) - w;
}

// =============================================================================
// 3D Primitives
// =============================================================================

/// Sphere SDF.
/// @param p Point to evaluate.
/// @param r Sphere radius.
fn sd_sphere(p: vec3<f32>, r: f32) -> f32 {
    return length(p) - r;
}

/// Box SDF (axis-aligned).
/// @param p Point to evaluate.
/// @param b Box half-extents.
fn sd_box_3d(p: vec3<f32>, b: vec3<f32>) -> f32 {
    let d = abs(p) - b;
    return length(max(d, vec3<f32>(0.0))) + min(max(d.x, max(d.y, d.z)), 0.0);
}

/// Rounded box SDF.
fn sd_rounded_box_3d(p: vec3<f32>, b: vec3<f32>, r: f32) -> f32 {
    let d = abs(p) - b + r;
    return length(max(d, vec3<f32>(0.0))) + min(max(d.x, max(d.y, d.z)), 0.0) - r;
}

/// Cylinder SDF (along Y axis).
fn sd_cylinder(p: vec3<f32>, r: f32, h: f32) -> f32 {
    let d = vec2<f32>(length(p.xz) - r, abs(p.y) - h);
    return min(max(d.x, d.y), 0.0) + length(max(d, vec2<f32>(0.0)));
}

/// Torus SDF.
fn sd_torus(p: vec3<f32>, t: vec2<f32>) -> f32 {
    let q = vec2<f32>(length(p.xz) - t.x, p.y);
    return length(q) - t.y;
}

/// Plane SDF.
fn sd_plane(p: vec3<f32>, n: vec3<f32>, h: f32) -> f32 {
    return dot(p, n) + h;
}

// =============================================================================
// Boolean Operations
// =============================================================================

/// Union of two SDFs.
fn op_union(d1: f32, d2: f32) -> f32 {
    return min(d1, d2);
}

/// Intersection of two SDFs.
fn op_intersection(d1: f32, d2: f32) -> f32 {
    return max(d1, d2);
}

/// Subtraction of two SDFs (d1 - d2).
fn op_subtraction(d1: f32, d2: f32) -> f32 {
    return max(d1, -d2);
}

// =============================================================================
// Smooth Boolean Operations
// =============================================================================

/// Smooth union.
fn op_smooth_union(d1: f32, d2: f32, k: f32) -> f32 {
    let h = clamp(0.5 + 0.5 * (d2 - d1) / k, 0.0, 1.0);
    return mix(d2, d1, h) - k * h * (1.0 - h);
}

/// Smooth intersection.
fn op_smooth_intersection(d1: f32, d2: f32, k: f32) -> f32 {
    let h = clamp(0.5 - 0.5 * (d2 - d1) / k, 0.0, 1.0);
    return mix(d2, d1, h) + k * h * (1.0 - h);
}

/// Smooth subtraction.
fn op_smooth_subtraction(d1: f32, d2: f32, k: f32) -> f32 {
    let h = clamp(0.5 - 0.5 * (d2 + d1) / k, 0.0, 1.0);
    return mix(d1, -d2, h) + k * h * (1.0 - h);
}

// =============================================================================
// Domain Operations
// =============================================================================

/// Translate a point.
fn op_translate(p: vec3<f32>, t: vec3<f32>) -> vec3<f32> {
    return p - t;
}

/// Repeat space infinitely.
fn op_repeat(p: vec3<f32>, c: vec3<f32>) -> vec3<f32> {
    return (p % c) - c * 0.5;
}
