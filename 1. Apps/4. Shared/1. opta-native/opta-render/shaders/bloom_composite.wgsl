// Bloom composite shader.
//
// Combines the original image with the blurred bloom texture
// using additive blending with intensity control.
//
// Dependencies:
//   #include "color.wgsl"

#include "color.wgsl"

// =============================================================================
// Uniforms
// =============================================================================

struct BloomCompositeUniforms {
    /// Bloom intensity multiplier (default: 1.0).
    intensity: f32,
    /// Whether to apply tone mapping (0.0 = no, 1.0 = yes).
    apply_tonemapping: f32,
    /// Padding for alignment.
    _padding: vec2<f32>,
}

@group(0) @binding(0)
var<uniform> uniforms: BloomCompositeUniforms;

@group(0) @binding(1)
var original_texture: texture_2d<f32>;

@group(0) @binding(2)
var bloom_texture: texture_2d<f32>;

@group(0) @binding(3)
var texture_sampler: sampler;

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
    
    var uvs = array<vec2<f32>, 3>(
        vec2<f32>(0.0, 1.0),
        vec2<f32>(2.0, 1.0),
        vec2<f32>(0.0, -1.0)
    );
    
    var out: VertexOutput;
    out.position = vec4<f32>(positions[vertex_index], 0.0, 1.0);
    out.uv = uvs[vertex_index];
    return out;
}

// =============================================================================
// Fragment Shader - Additive Blend
// =============================================================================

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    // Sample both textures
    let original = textureSample(original_texture, texture_sampler, in.uv);
    let bloom = textureSample(bloom_texture, texture_sampler, in.uv);
    
    // Additive blend with intensity
    var color = original.rgb + bloom.rgb * uniforms.intensity;
    
    // Optional tone mapping to prevent clipping
    if uniforms.apply_tonemapping > 0.5 {
        color = tonemap_aces(color);
    }
    
    return vec4<f32>(color, original.a);
}

/// Additive blend with Reinhard tone mapping.
@fragment
fn fs_main_reinhard(in: VertexOutput) -> @location(0) vec4<f32> {
    let original = textureSample(original_texture, texture_sampler, in.uv);
    let bloom = textureSample(bloom_texture, texture_sampler, in.uv);
    
    var color = original.rgb + bloom.rgb * uniforms.intensity;
    color = tonemap_reinhard(color);
    
    return vec4<f32>(color, original.a);
}

/// Screen blend mode (softer than additive).
@fragment
fn fs_main_screen(in: VertexOutput) -> @location(0) vec4<f32> {
    let original = textureSample(original_texture, texture_sampler, in.uv);
    let bloom = textureSample(bloom_texture, texture_sampler, in.uv);
    
    // Screen blend: 1 - (1 - a) * (1 - b)
    let bloom_scaled = bloom.rgb * uniforms.intensity;
    var color = blend_screen(original.rgb, bloom_scaled);
    
    if uniforms.apply_tonemapping > 0.5 {
        color = tonemap_aces(color);
    }
    
    return vec4<f32>(color, original.a);
}

/// Soft light blend (subtle glow).
@fragment
fn fs_main_softlight(in: VertexOutput) -> @location(0) vec4<f32> {
    let original = textureSample(original_texture, texture_sampler, in.uv);
    let bloom = textureSample(bloom_texture, texture_sampler, in.uv);
    
    let bloom_scaled = bloom.rgb * uniforms.intensity;
    var color = blend_softlight(original.rgb, bloom_scaled);
    
    if uniforms.apply_tonemapping > 0.5 {
        color = tonemap_aces(color);
    }
    
    return vec4<f32>(color, original.a);
}

// =============================================================================
// Fragment Shader - Multi-Level Bloom
// =============================================================================

// For multi-level bloom, we sample multiple mip levels
// This requires additional texture bindings

@group(0) @binding(4)
var bloom_texture_1: texture_2d<f32>;

@group(0) @binding(5)
var bloom_texture_2: texture_2d<f32>;

@group(0) @binding(6)
var bloom_texture_3: texture_2d<f32>;

struct MultiBloomUniforms {
    /// Weights for each bloom level (default: 1.0, 0.8, 0.6, 0.4).
    weights: vec4<f32>,
    /// Overall intensity multiplier.
    intensity: f32,
    /// Whether to apply tone mapping.
    apply_tonemapping: f32,
    /// Padding.
    _padding: vec2<f32>,
}

@group(1) @binding(0)
var<uniform> multi_uniforms: MultiBloomUniforms;

/// Multi-level bloom composite.
/// Combines multiple blur levels for more natural bloom spread.
@fragment
fn fs_main_multi(in: VertexOutput) -> @location(0) vec4<f32> {
    let original = textureSample(original_texture, texture_sampler, in.uv);
    
    // Sample each bloom level
    let bloom0 = textureSample(bloom_texture, texture_sampler, in.uv).rgb;
    let bloom1 = textureSample(bloom_texture_1, texture_sampler, in.uv).rgb;
    let bloom2 = textureSample(bloom_texture_2, texture_sampler, in.uv).rgb;
    let bloom3 = textureSample(bloom_texture_3, texture_sampler, in.uv).rgb;
    
    // Weighted sum of bloom levels
    var bloom = bloom0 * multi_uniforms.weights.x 
              + bloom1 * multi_uniforms.weights.y 
              + bloom2 * multi_uniforms.weights.z 
              + bloom3 * multi_uniforms.weights.w;
    
    bloom = bloom * multi_uniforms.intensity;
    
    // Additive blend
    var color = original.rgb + bloom;
    
    if multi_uniforms.apply_tonemapping > 0.5 {
        color = tonemap_aces(color);
    }
    
    return vec4<f32>(color, original.a);
}

// =============================================================================
// Utility Functions
// =============================================================================

/// Apply vignette effect (darker edges).
fn apply_vignette(color: vec3<f32>, uv: vec2<f32>, strength: f32) -> vec3<f32> {
    let center = vec2<f32>(0.5);
    let dist = distance(uv, center);
    let vignette = 1.0 - smoothstep(0.3, 0.7, dist) * strength;
    return color * vignette;
}

/// Fragment shader with vignette.
@fragment
fn fs_main_vignette(in: VertexOutput) -> @location(0) vec4<f32> {
    let original = textureSample(original_texture, texture_sampler, in.uv);
    let bloom = textureSample(bloom_texture, texture_sampler, in.uv);
    
    var color = original.rgb + bloom.rgb * uniforms.intensity;
    
    if uniforms.apply_tonemapping > 0.5 {
        color = tonemap_aces(color);
    }
    
    // Apply subtle vignette
    color = apply_vignette(color, in.uv, 0.3);
    
    return vec4<f32>(color, original.a);
}
