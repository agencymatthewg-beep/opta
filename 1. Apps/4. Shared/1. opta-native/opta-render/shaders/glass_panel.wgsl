// Obsidian panel shader (low quality) for UI overlays.
//
// Renders flat obsidian panels with:
// - SDF-based rounded rectangles
// - Simple Fresnel edge highlight
// - Configurable border
// - Opaque dark surface (no backdrop blur or transmission)

// =============================================================================
// Math Utilities (inlined for standalone shader)
// =============================================================================

const PI: f32 = 3.14159265359;

fn saturate(x: f32) -> f32 {
    return clamp(x, 0.0, 1.0);
}

// =============================================================================
// SDF Utilities (inlined for standalone shader)
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

struct ObsidianPanelLQUniforms {
    /// Panel position in pixels.
    position: vec2<f32>,
    /// Panel size in pixels.
    size: vec2<f32>,
    /// Corner radius in pixels.
    corner_radius: f32,
    /// Panel opacity (0.0 - 1.0).
    opacity: f32,
    /// Surface roughness (controls fresnel sharpness).
    roughness: f32,
    /// Depth layer (affects edge brightness).
    depth_layer: f32,
    /// Obsidian base color (RGB + padding).
    base_color: vec4<f32>,
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
var<uniform> uniforms: ObsidianPanelLQUniforms;

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

    // Flat obsidian base color
    var panel_color = uniforms.base_color.rgb;

    // Simple Fresnel edge highlight (approximation for low quality)
    let edge_dist = -dist; // Positive inside
    let fresnel = pow(saturate(1.0 - edge_dist / 20.0), 3.0) * 0.08;
    panel_color += vec3<f32>(fresnel);

    // Border rendering
    let border_alpha = 1.0 - smoothstep(0.0, uniforms.border_width, edge_dist);
    panel_color = mix(panel_color, uniforms.border_color.rgb, border_alpha * uniforms.border_color.a);

    // Opaque with soft edge antialiasing
    let edge_softness = 1.0;
    let alpha = uniforms.opacity * saturate(-dist / edge_softness);
    let final_alpha = max(alpha, border_alpha * uniforms.border_color.a);

    return vec4<f32>(panel_color, final_alpha);
}
