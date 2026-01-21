// SDF Demo Shader - demonstrates SDF primitives with glass material
//
// This shader showcases:
// - 2D SDF primitives (circle, rounded box)
// - SDF smooth union for organic shapes
// - Glass material with fresnel effect
// - Anti-aliased edges
// - Animated composition

#include "sdf.wgsl"
#include "glass.wgsl"
#include "color.wgsl"

// =============================================================================
// Uniforms
// =============================================================================

struct Uniforms {
    resolution: vec2<f32>,
    time: f32,
    _padding: f32,
}

@group(0) @binding(0)
var<uniform> uniforms: Uniforms;

// =============================================================================
// Vertex Shader
// =============================================================================

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
}

@vertex
fn vs_main(@builtin(vertex_index) vertex_index: u32) -> VertexOutput {
    // Fullscreen triangle (covers viewport with 3 vertices)
    var positions = array<vec2<f32>, 3>(
        vec2<f32>(-1.0, -1.0),
        vec2<f32>(3.0, -1.0),
        vec2<f32>(-1.0, 3.0)
    );

    var output: VertexOutput;
    output.position = vec4<f32>(positions[vertex_index], 0.0, 1.0);
    output.uv = positions[vertex_index] * 0.5 + 0.5;
    return output;
}

// =============================================================================
// Scene Definition
// =============================================================================

/// Main SDF scene - returns distance to nearest surface.
fn scene_sdf(p: vec2<f32>, t: f32) -> f32 {
    // Animated positions
    let circle_pos = vec2<f32>(sin(t) * 0.5, 0.0);
    let box_pos = vec2<f32>(-0.5, sin(t * 1.3) * 0.3);

    // SDF primitives
    let circle = sd_circle(p - circle_pos, 0.3);
    let box = sd_rounded_box_2d(p - box_pos, vec2<f32>(0.2, 0.2), 0.05);

    // Add a ring for visual interest
    let ring_pos = vec2<f32>(0.3, -0.2);
    let ring = sd_ring(p - ring_pos, 0.15, 0.04);

    // Smooth union creates organic blend between shapes
    var d = op_smooth_union(circle, box, 0.2);
    d = op_smooth_union(d, ring, 0.15);

    return d;
}

/// Calculate approximate normal at point (for 2D).
fn calc_normal_2d(p: vec2<f32>, t: f32) -> vec2<f32> {
    let eps = 0.001;
    let dx = scene_sdf(p + vec2<f32>(eps, 0.0), t) - scene_sdf(p - vec2<f32>(eps, 0.0), t);
    let dy = scene_sdf(p + vec2<f32>(0.0, eps), t) - scene_sdf(p - vec2<f32>(0.0, eps), t);
    return normalize(vec2<f32>(dx, dy));
}

// =============================================================================
// Background
// =============================================================================

/// Create animated background gradient.
fn background(uv: vec2<f32>, t: f32) -> vec3<f32> {
    // Dark gradient from bottom to top
    let base_dark = vec3<f32>(0.08, 0.08, 0.12);
    let base_light = vec3<f32>(0.15, 0.12, 0.2);
    var bg = mix(base_dark, base_light, uv.y);

    // Subtle animated noise-like pattern
    let wave = sin(uv.x * 10.0 + t) * sin(uv.y * 8.0 - t * 0.5);
    bg += vec3<f32>(0.01, 0.015, 0.02) * wave;

    return bg;
}

// =============================================================================
// Fragment Shader
// =============================================================================

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
    // Correct aspect ratio
    let aspect = uniforms.resolution.x / uniforms.resolution.y;
    var uv = input.uv * 2.0 - 1.0;
    uv.x *= aspect;

    // Animation time
    let t = uniforms.time * 0.5;

    // Calculate SDF distance
    let d = scene_sdf(uv, t);

    // Background gradient
    let bg = background(input.uv, t);

    // Inside the shape - apply glass effect
    if (d < 0.0) {
        // Glass material with blue tint
        var mat = glass_default();
        mat.tint = vec3<f32>(0.85, 0.9, 1.0);
        mat.ior = 1.45;

        // Calculate view angle based on depth into shape
        let depth = clamp(-d * 3.0, 0.0, 1.0);
        let view_angle = 1.0 - depth * 0.5;

        // Fresnel at edges - calculate F0 from IOR
        let f0 = pow((1.0 - mat.ior) / (1.0 + mat.ior), 2.0);
        let fresnel = fresnel_schlick(view_angle, f0);

        // Normal for edge highlighting
        let normal = calc_normal_2d(uv, t);
        let light_dir = normalize(vec2<f32>(-0.5, 0.7));
        let n_dot_l = max(dot(normal, light_dir), 0.0);

        // Edge highlight
        let edge_dist = clamp(-d * 5.0, 0.0, 1.0);
        let edge_glow = (1.0 - edge_dist) * fresnel * vec3<f32>(0.8, 0.85, 1.0);

        // Specular highlight
        let spec_strength = pow(n_dot_l, 8.0) * 0.4;
        let specular = vec3<f32>(1.0, 0.95, 0.9) * spec_strength;

        // Tinted background through glass
        let glass_bg = bg * mat.tint * (1.0 - fresnel * 0.3);

        // Combine
        var color = glass_bg + edge_glow + specular;

        // Inner glow for depth
        let inner_glow = exp(d * 4.0) * vec3<f32>(0.3, 0.4, 0.6) * 0.2;
        color += inner_glow;

        return vec4<f32>(linear_to_srgb(color), 0.95);
    }

    // Anti-aliased edge
    let aa = fwidth(d) * 1.5;
    let edge = smoothstep(0.0, aa, d);

    // Edge glow (outside the shape)
    let glow_intensity = exp(-d * 8.0);
    let glow_color = vec3<f32>(0.4, 0.5, 0.8) * glow_intensity;

    // Secondary outer glow
    let outer_glow = exp(-d * 3.0) * vec3<f32>(0.2, 0.25, 0.4) * 0.3;

    // Combine background with glow
    var final_color = bg + (glow_color + outer_glow) * (1.0 - edge);

    // Apply sRGB conversion for correct display
    return vec4<f32>(linear_to_srgb(final_color), 1.0);
}

// =============================================================================
// Alternative Entry Points for Variations
// =============================================================================

/// Simple solid color version (for testing).
@fragment
fn fs_solid(input: VertexOutput) -> @location(0) vec4<f32> {
    let aspect = uniforms.resolution.x / uniforms.resolution.y;
    var uv = input.uv * 2.0 - 1.0;
    uv.x *= aspect;

    let d = scene_sdf(uv, uniforms.time * 0.5);

    // Simple solid with anti-aliasing
    let aa = fwidth(d) * 1.5;
    let alpha = smoothstep(aa, -aa, d);

    let color = vec3<f32>(0.4, 0.5, 0.8);
    return vec4<f32>(color, alpha);
}

/// Wireframe/outline version.
@fragment
fn fs_outline(input: VertexOutput) -> @location(0) vec4<f32> {
    let aspect = uniforms.resolution.x / uniforms.resolution.y;
    var uv = input.uv * 2.0 - 1.0;
    uv.x *= aspect;

    let d = scene_sdf(uv, uniforms.time * 0.5);

    // Outline using annular SDF
    let outline_width = 0.02;
    let outline_d = abs(d) - outline_width;

    let aa = fwidth(outline_d) * 1.5;
    let alpha = smoothstep(aa, -aa, outline_d);

    let color = vec3<f32>(0.6, 0.7, 1.0);
    return vec4<f32>(color, alpha);
}
