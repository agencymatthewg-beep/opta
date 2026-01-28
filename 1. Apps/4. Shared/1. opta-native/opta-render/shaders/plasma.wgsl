// Plasma effect shader.
//
// Creates organic, flowing plasma patterns using multiple sine waves
// combined with fractal Brownian motion noise.
//
// Dependencies:
//   #include "noise.wgsl"
//   #include "color.wgsl"

#include "noise.wgsl"
#include "color.wgsl"

// =============================================================================
// Uniforms
// =============================================================================

struct PlasmaUniforms {
    /// Render target resolution (width, height).
    resolution: vec2<f32>,
    /// Current time in seconds.
    time: f32,
    /// Animation speed multiplier (default: 1.0).
    speed: f32,
    /// Pattern scale multiplier (default: 1.0).
    scale: f32,
    /// Color palette shift (0.0 to 1.0).
    color_shift: f32,
    /// Padding for alignment.
    _padding: vec2<f32>,
}

@group(0) @binding(0)
var<uniform> uniforms: PlasmaUniforms;

// =============================================================================
// Vertex Shader
// =============================================================================

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
}

@vertex
fn vs_main(@builtin(vertex_index) vertex_index: u32) -> VertexOutput {
    // Full-screen triangle
    var positions = array<vec2<f32>, 3>(
        vec2<f32>(-1.0, -1.0),
        vec2<f32>(3.0, -1.0),
        vec2<f32>(-1.0, 3.0)
    );
    
    var out: VertexOutput;
    out.position = vec4<f32>(positions[vertex_index], 0.0, 1.0);
    out.uv = positions[vertex_index] * 0.5 + 0.5;
    return out;
}

// =============================================================================
// Plasma Pattern Generation
// =============================================================================

/// Generate a plasma pattern value at the given position.
fn plasma_pattern(p: vec2<f32>, t: f32) -> f32 {
    // Multiple sine wave layers at different frequencies and directions
    var value = 0.0;
    
    // Layer 1: Horizontal waves
    value += sin(p.x * 3.0 + t * 1.2);
    
    // Layer 2: Vertical waves
    value += sin(p.y * 2.7 + t * 0.8);
    
    // Layer 3: Diagonal waves
    value += sin((p.x + p.y) * 2.5 + t * 1.5);
    
    // Layer 4: Circular waves from center
    let dist = length(p - 0.5);
    value += sin(dist * 8.0 - t * 2.0);
    
    // Layer 5: Rotating pattern
    let angle = atan2(p.y - 0.5, p.x - 0.5);
    value += sin(angle * 3.0 + dist * 5.0 + t * 1.3);
    
    // Add fbm noise for organic variation
    let noise_pos = p * 3.0 + vec2<f32>(t * 0.3, t * 0.2);
    value += fbm_perlin(noise_pos, 4, 2.0, 0.5) * 1.5;
    
    // Normalize to [0, 1]
    return value * 0.1 + 0.5;
}

/// Generate color from plasma value using HSL palette.
fn plasma_color(value: f32, shift: f32) -> vec3<f32> {
    // Use the plasma value to cycle through hue
    let hue = fract(value + shift);
    
    // Vary saturation and lightness for more interesting colors
    let saturation = 0.7 + 0.3 * sin(value * 6.28318530718);
    let lightness = 0.4 + 0.2 * cos(value * 3.14159265359);
    
    return hsl_to_rgb(vec3<f32>(hue, saturation, lightness));
}

// =============================================================================
// Fragment Shader
// =============================================================================

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    // Normalized coordinates with aspect ratio correction
    var uv = in.uv;
    let aspect = uniforms.resolution.x / uniforms.resolution.y;
    uv.x *= aspect;
    
    // Apply scale
    uv = uv * uniforms.scale;
    
    // Animated time
    let t = uniforms.time * uniforms.speed;
    
    // Generate plasma pattern
    let plasma = plasma_pattern(uv, t);
    
    // Generate color
    let color = plasma_color(plasma, uniforms.color_shift);
    
    return vec4<f32>(color, 1.0);
}

// =============================================================================
// Alternative Entry Points
// =============================================================================

/// High-quality plasma with more noise octaves.
@fragment
fn fs_main_hq(in: VertexOutput) -> @location(0) vec4<f32> {
    var uv = in.uv;
    let aspect = uniforms.resolution.x / uniforms.resolution.y;
    uv.x *= aspect;
    uv = uv * uniforms.scale;
    
    let t = uniforms.time * uniforms.speed;
    
    // Enhanced plasma with more layers
    var value = 0.0;
    
    // Base sine waves
    value += sin(uv.x * 3.0 + t * 1.2);
    value += sin(uv.y * 2.7 + t * 0.8);
    value += sin((uv.x + uv.y) * 2.5 + t * 1.5);
    value += sin((uv.x - uv.y) * 2.3 + t * 1.1);
    
    // Circular and spiral
    let dist = length(uv - 0.5 * uniforms.scale);
    let angle = atan2(uv.y - 0.5 * uniforms.scale, uv.x - 0.5 * uniforms.scale);
    value += sin(dist * 8.0 - t * 2.0);
    value += sin(angle * 5.0 + dist * 4.0 + t * 1.7);
    
    // High-quality fbm with more octaves
    let noise_pos = uv * 3.0 + vec2<f32>(t * 0.3, t * 0.2);
    value += fbm_perlin(noise_pos, 6, 2.0, 0.5) * 2.0;
    
    // Add simplex noise for extra detail
    value += simplex_noise_2d(uv * 5.0 + t * 0.5) * 0.5;
    
    let plasma = value * 0.08 + 0.5;
    let color = plasma_color(plasma, uniforms.color_shift);
    
    return vec4<f32>(color, 1.0);
}

/// Minimal plasma for low-power mode.
@fragment
fn fs_main_lq(in: VertexOutput) -> @location(0) vec4<f32> {
    var uv = in.uv;
    let aspect = uniforms.resolution.x / uniforms.resolution.y;
    uv.x *= aspect;
    uv = uv * uniforms.scale;
    
    let t = uniforms.time * uniforms.speed;
    
    // Simple plasma with fewer layers
    var value = 0.0;
    value += sin(uv.x * 3.0 + t);
    value += sin(uv.y * 2.5 + t * 0.7);
    value += sin((uv.x + uv.y) * 2.0 + t * 1.2);
    
    let plasma = value * 0.15 + 0.5;
    let color = plasma_color(plasma, uniforms.color_shift);
    
    return vec4<f32>(color, 1.0);
}
