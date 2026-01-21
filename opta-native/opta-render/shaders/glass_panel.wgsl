// Glass panel shader for UI overlays.
//
// Renders frosted glass panels with:
// - SDF-based rounded rectangles
// - Circular blur sampling of backdrop texture
// - Depth-dependent blur intensity
// - Fresnel highlight at edges
// - Configurable border

// =============================================================================
// Math Utilities (inlined from math.wgsl for standalone shader)
// =============================================================================

const PI: f32 = 3.14159265359;

fn saturate(x: f32) -> f32 {
    return clamp(x, 0.0, 1.0);
}

// =============================================================================
// SDF Utilities (inlined from sdf.wgsl for standalone shader)
// =============================================================================

/// Rounded box SDF.
/// @param p Point to evaluate (relative to center).
/// @param b Box half-extents.
/// @param r Corner radius.
fn sd_rounded_box_2d(p: vec2<f32>, b: vec2<f32>, r: f32) -> f32 {
    let d = abs(p) - b + r;
    return length(max(d, vec2<f32>(0.0))) + min(max(d.x, d.y), 0.0) - r;
}

// =============================================================================
// Uniforms
// =============================================================================

struct GlassPanelUniforms {
    /// Panel position in pixels.
    position: vec2<f32>,
    /// Panel size in pixels.
    size: vec2<f32>,
    /// Corner radius in pixels.
    corner_radius: f32,
    /// Blur intensity (0.0 - 1.0).
    blur: f32,
    /// Panel opacity (0.0 - 1.0).
    opacity: f32,
    /// Depth layer (affects blur).
    depth_layer: f32,
    /// Tint color (RGB + padding).
    tint: vec4<f32>,
    /// Border width in pixels.
    border_width: f32,
    /// Padding.
    _padding1: vec3<f32>,
    /// Border color (RGBA).
    border_color: vec4<f32>,
    /// Render resolution (width, height).
    resolution: vec2<f32>,
    /// Padding.
    _padding2: vec2<f32>,
}

@group(0) @binding(0)
var<uniform> uniforms: GlassPanelUniforms;

@group(0) @binding(1)
var backdrop_texture: texture_2d<f32>;

@group(0) @binding(2)
var backdrop_sampler: sampler;

// =============================================================================
// Vertex Shader
// =============================================================================

struct VertexInput {
    @location(0) position: vec2<f32>,
    @location(1) uv: vec2<f32>,
}

struct VertexOutput {
    @builtin(position) clip_position: vec4<f32>,
    @location(0) uv: vec2<f32>,
    @location(1) pixel_pos: vec2<f32>,
}

@vertex
fn vs_main(in: VertexInput) -> VertexOutput {
    var out: VertexOutput;

    // Transform vertex to panel space
    // Input position is -1 to 1 (full quad)
    // We scale and position based on uniforms
    let half_size = uniforms.size * 0.5;
    let center = uniforms.position + half_size;

    // Convert to normalized device coordinates
    let pixel_pos = center + in.position * half_size;
    let ndc = (pixel_pos / uniforms.resolution) * 2.0 - 1.0;

    out.clip_position = vec4<f32>(ndc.x, -ndc.y, 0.0, 1.0);
    out.uv = in.uv;
    out.pixel_pos = pixel_pos;

    return out;
}

// =============================================================================
// Fragment Shader
// =============================================================================

// 16-sample circular blur pattern (Poisson disk)
const BLUR_SAMPLES: i32 = 16;
const BLUR_OFFSETS: array<vec2<f32>, 16> = array<vec2<f32>, 16>(
    vec2<f32>(0.0, 0.0),
    vec2<f32>(0.527837, -0.085868),
    vec2<f32>(-0.040088, 0.536087),
    vec2<f32>(-0.670445, -0.179949),
    vec2<f32>(-0.419418, -0.616039),
    vec2<f32>(0.440453, -0.639399),
    vec2<f32>(-0.757088, 0.349334),
    vec2<f32>(0.574619, 0.685879),
    vec2<f32>(0.03851, -0.939059),
    vec2<f32>(-0.993888, -0.024331),
    vec2<f32>(0.962608, 0.128903),
    vec2<f32>(-0.574047, 0.770253),
    vec2<f32>(0.237266, 0.929227),
    vec2<f32>(-0.323289, -0.927614),
    vec2<f32>(0.858376, -0.463171),
    vec2<f32>(-0.908294, -0.412173)
);

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    // Calculate position relative to panel center
    let half_size = uniforms.size * 0.5;
    let center = uniforms.position + half_size;
    let local_pos = in.pixel_pos - center;

    // SDF for rounded rectangle
    let dist = sd_rounded_box_2d(local_pos, half_size, uniforms.corner_radius);

    // Discard pixels outside the panel
    if dist > 0.0 {
        discard;
    }

    // Calculate blur radius based on config and depth
    // Depth layer increases blur for panels further back
    let blur_radius = uniforms.blur * (1.0 + uniforms.depth_layer * 0.5) * 0.01;

    // Sample backdrop with circular blur
    var blurred_color = vec4<f32>(0.0);
    let uv = in.pixel_pos / uniforms.resolution;

    for (var i = 0; i < BLUR_SAMPLES; i = i + 1) {
        let offset = BLUR_OFFSETS[i] * blur_radius;
        let sample_uv = uv + offset;
        blurred_color += textureSample(backdrop_texture, backdrop_sampler, sample_uv);
    }
    blurred_color /= f32(BLUR_SAMPLES);

    // Apply tint
    var panel_color = blurred_color.rgb * uniforms.tint.rgb;

    // Calculate edge distance for fresnel and border
    let edge_dist = -dist; // Distance from edge (positive inside)

    // Fresnel highlight at edges (glass-like reflection)
    let fresnel = pow(saturate(1.0 - edge_dist / 20.0), 2.0) * 0.1;
    panel_color += vec3<f32>(fresnel);

    // Border rendering
    let border_alpha = 1.0 - smoothstep(0.0, uniforms.border_width, edge_dist);
    let border_contribution = uniforms.border_color.rgb * uniforms.border_color.a * border_alpha;
    panel_color = mix(panel_color, uniforms.border_color.rgb, border_alpha * uniforms.border_color.a);

    // Calculate final alpha with soft edge
    let edge_softness = 1.0; // 1 pixel soft edge
    let alpha = uniforms.opacity * saturate(-dist / edge_softness);

    // Add border alpha contribution
    let final_alpha = max(alpha, border_alpha * uniforms.border_color.a);

    return vec4<f32>(panel_color, final_alpha);
}
