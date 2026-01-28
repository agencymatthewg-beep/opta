// Bloom threshold extraction shader.
//
// Extracts bright areas from an image using luminance calculation
// with soft threshold knee for smooth cutoff transitions.
//
// Dependencies:
//   #include "color.wgsl"

#include "color.wgsl"

// =============================================================================
// Uniforms
// =============================================================================

struct BloomThresholdUniforms {
    /// Luminance threshold (default: 0.8).
    /// Pixels below this luminance are cut off.
    threshold: f32,
    /// Soft knee width (default: 0.5).
    /// Higher values create smoother transitions at the threshold boundary.
    knee: f32,
    /// Padding for alignment.
    _padding: vec2<f32>,
}

@group(0) @binding(0)
var<uniform> uniforms: BloomThresholdUniforms;

@group(0) @binding(1)
var input_texture: texture_2d<f32>;

@group(0) @binding(2)
var input_sampler: sampler;

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
// Threshold Functions
// =============================================================================

/// Soft threshold with knee for smooth transition.
/// Returns contribution factor based on luminance.
fn soft_threshold(lum: f32, threshold: f32, knee: f32) -> f32 {
    // Calculate knee boundaries
    let knee_start = threshold - knee;
    let knee_end = threshold + knee;
    
    if lum < knee_start {
        // Below knee: no contribution
        return 0.0;
    } else if lum > knee_end {
        // Above knee: full contribution relative to threshold
        return lum - threshold;
    } else {
        // Within knee: smooth transition (quadratic)
        let t = (lum - knee_start) / (knee * 2.0);
        return t * t * (lum - threshold + knee);
    }
}

/// Hard threshold (no knee).
fn hard_threshold(lum: f32, threshold: f32) -> f32 {
    if lum > threshold {
        return lum - threshold;
    }
    return 0.0;
}

// =============================================================================
// Fragment Shader
// =============================================================================

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    // Sample input texture
    let color = textureSample(input_texture, input_sampler, in.uv);
    
    // Calculate luminance
    let lum = luminance(color.rgb);
    
    // Apply soft threshold
    let contribution = soft_threshold(lum, uniforms.threshold, uniforms.knee);
    
    // Scale color by contribution factor
    if contribution > 0.0 {
        // Preserve color hue, scale by contribution
        let scale = contribution / max(lum, 0.0001);
        return vec4<f32>(color.rgb * scale, 1.0);
    }
    
    return vec4<f32>(0.0, 0.0, 0.0, 1.0);
}

/// Fragment shader with hard threshold (no knee).
@fragment
fn fs_main_hard(in: VertexOutput) -> @location(0) vec4<f32> {
    let color = textureSample(input_texture, input_sampler, in.uv);
    let lum = luminance(color.rgb);
    
    let contribution = hard_threshold(lum, uniforms.threshold);
    
    if contribution > 0.0 {
        let scale = contribution / max(lum, 0.0001);
        return vec4<f32>(color.rgb * scale, 1.0);
    }
    
    return vec4<f32>(0.0, 0.0, 0.0, 1.0);
}

/// Fragment shader preserving original brightness above threshold.
@fragment
fn fs_main_preserve(in: VertexOutput) -> @location(0) vec4<f32> {
    let color = textureSample(input_texture, input_sampler, in.uv);
    let lum = luminance(color.rgb);
    
    // Smooth step transition
    let contribution = smoothstep(
        uniforms.threshold - uniforms.knee,
        uniforms.threshold + uniforms.knee,
        lum
    );
    
    return vec4<f32>(color.rgb * contribution, 1.0);
}
