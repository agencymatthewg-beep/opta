// Obsidian panel shader for premium UI overlays.
//
// Renders opaque obsidian panels with:
// - Cook-Torrance BRDF for physically-based specular highlights
// - SDF-based rounded rectangles with anti-aliased edges
// - Edge branch energy veins (Electric Violet, High/Ultra quality)
// - Depth-dependent specular intensity scaling
// - Fresnel edge highlights matching ring obsidian material

// =============================================================================
// Math Utilities (inlined for standalone shader)
// =============================================================================

const PI: f32 = 3.14159265359;
const TAU: f32 = 6.28318530718;

fn saturate(x: f32) -> f32 {
    return clamp(x, 0.0, 1.0);
}

fn saturate3(v: vec3<f32>) -> vec3<f32> {
    return clamp(v, vec3<f32>(0.0), vec3<f32>(1.0));
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
// Cook-Torrance BRDF Components (obsidian specular)
// =============================================================================

/// GGX/Trowbridge-Reitz Normal Distribution Function (NDF).
fn distribution_ggx(n_dot_h: f32, roughness: f32) -> f32 {
    let a = roughness * roughness;
    let a2 = a * a;
    let n_dot_h2 = n_dot_h * n_dot_h;

    let nom = a2;
    var denom = n_dot_h2 * (a2 - 1.0) + 1.0;
    denom = PI * denom * denom;

    return nom / max(denom, 0.0001);
}

/// Schlick-GGX Geometry Function (single direction).
fn geometry_schlick_ggx(n_dot_v: f32, roughness: f32) -> f32 {
    let r = roughness + 1.0;
    let k = (r * r) / 8.0;

    let nom = n_dot_v;
    let denom = n_dot_v * (1.0 - k) + k;

    return nom / max(denom, 0.0001);
}

/// Smith's Geometry Function (bidirectional shadowing-masking).
fn geometry_smith(n_dot_v: f32, n_dot_l: f32, roughness: f32) -> f32 {
    let ggx_v = geometry_schlick_ggx(n_dot_v, roughness);
    let ggx_l = geometry_schlick_ggx(n_dot_l, roughness);
    return ggx_v * ggx_l;
}

/// Schlick's Fresnel approximation with roughness correction.
fn fresnel_schlick_roughness(cos_theta: f32, f0: vec3<f32>, roughness: f32) -> vec3<f32> {
    let one_minus_rough = saturate3(vec3<f32>(1.0 - roughness));
    return f0 + (max(one_minus_rough, f0) - f0) * pow(saturate(1.0 - cos_theta), 5.0);
}

/// Calculate F0 (base reflectivity) from IOR.
fn f0_from_ior(ior: f32) -> f32 {
    let r = (1.0 - ior) / (1.0 + ior);
    return r * r;
}

// =============================================================================
// Edge Branch Energy (inlined for standalone shader)
// =============================================================================

/// Mask that fades branches from the panel edge inward.
fn edge_branch_mask(edge_dist: f32, reach: f32) -> f32 {
    return 1.0 - smoothstep(0.0, reach, edge_dist);
}

/// Compute perimeter coordinate from local position.
fn edge_perimeter_coord(local_pos: vec2<f32>, half_size: vec2<f32>) -> f32 {
    let norm_pos = local_pos / half_size;
    let angle = atan2(norm_pos.y, norm_pos.x);
    return (angle + PI) / TAU;
}

/// Compute edge branch pattern intensity.
fn edge_branch_compute(
    local_pos: vec2<f32>,
    half_size: vec2<f32>,
    corner_radius: f32,
    edge_dist: f32,
    reach: f32,
    density: f32,
    speed: f32,
    energy: f32,
    time: f32
) -> f32 {
    // Only compute if within the branch band
    if edge_dist > reach {
        return 0.0;
    }

    // Compute perimeter coordinate
    let perimeter = edge_perimeter_coord(local_pos, half_size);
    let perimeter_length = 2.0 * (half_size.x + half_size.y);
    let edge_pos = perimeter * perimeter_length * 0.01;

    // Branch cell and phase
    let scaled_pos = edge_pos * density;
    let cell = floor(scaled_pos);
    let phase = fract(sin(cell * 127.1) * 43758.5453) * TAU;

    // Branch pulse animation
    let pulse = sin((scaled_pos + (time + phase) * speed) * TAU) * 0.5 + 0.5;

    // Width concentration
    let cell_frac = fract(scaled_pos);
    let width_mask = 1.0 - smoothstep(0.0, 0.35, abs(cell_frac - 0.5));

    // Energy-based threshold revelation
    let threshold = 1.0 - energy * 0.8;
    let revealed = smoothstep(threshold - 0.05, threshold + 0.05, pulse);

    // Edge mask
    let mask = edge_branch_mask(edge_dist, reach);

    return mask * width_mask * revealed * pulse;
}

/// Compute branch color: Electric Violet with white-hot at peak.
fn edge_branch_color(intensity: f32, energy: f32) -> vec3<f32> {
    let violet = vec3<f32>(0.545, 0.361, 0.965);
    let white_hot = vec3<f32>(1.0, 0.9, 1.0);
    let hot_mix = smoothstep(0.9, 1.3, intensity) * energy;
    return mix(violet * intensity, white_hot, hot_mix);
}

// =============================================================================
// Uniforms
// =============================================================================

struct ObsidianPanelUniforms {
    // Base panel properties (16 bytes)
    /// Panel position in pixels.
    position: vec2<f32>,
    /// Panel size in pixels.
    size: vec2<f32>,

    // Material properties (16 bytes)
    /// Corner radius in pixels.
    corner_radius: f32,
    /// Panel opacity (0.0 - 1.0).
    opacity: f32,
    /// Surface roughness [0,1].
    roughness: f32,
    /// Index of refraction (1.85 for volcanic glass).
    ior: f32,

    // Base color (16 bytes)
    /// Obsidian base color (RGB + padding). Near-black.
    base_color: vec4<f32>,

    // Depth hierarchy (16 bytes)
    /// Depth layer (0.0 = foreground, 1.0 = background).
    depth_layer: f32,
    /// Specular intensity (depth-scaled).
    specular_intensity: f32,
    /// Padding for alignment.
    _pad_depth: vec2<f32>,

    // Edge branch parameters (16 bytes)
    /// Branch reach in pixels from edge.
    branch_reach: f32,
    /// Branch density (branches per 100px).
    branch_density: f32,
    /// Branch animation speed.
    branch_speed: f32,
    /// Branch energy level [0,1].
    branch_energy: f32,

    // Fresnel edge highlights (16 bytes)
    /// Fresnel edge highlight color (RGB).
    fresnel_color: vec3<f32>,
    /// Fresnel edge highlight intensity.
    fresnel_intensity: f32,

    // Fresnel power and padding (16 bytes)
    /// Fresnel edge power (controls sharpness).
    fresnel_power: f32,
    /// Padding for alignment.
    _padding1: vec3<f32>,

    // Border settings (16 bytes)
    /// Border width in pixels.
    border_width: f32,
    /// Padding for alignment.
    _padding3: vec3<f32>,

    // Border color (16 bytes)
    /// Border color (RGBA).
    border_color: vec4<f32>,

    // Resolution and quality (16 bytes)
    /// Render resolution (width, height).
    resolution: vec2<f32>,
    /// Quality level (0=low, 1=medium, 2=high, 3=ultra).
    quality_level: u32,
    /// Animation time for effects.
    time: f32,
}

@group(0) @binding(0)
var<uniform> uniforms: ObsidianPanelUniforms;

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

    let edge_dist = -dist; // Positive inside

    // =========================================================================
    // Obsidian Base Color
    // =========================================================================

    var panel_color = uniforms.base_color.rgb;

    // =========================================================================
    // Cook-Torrance Specular Highlights
    // =========================================================================

    // Simulate view angle based on edge distance (edges = glancing angle)
    let normalized_edge = saturate(edge_dist / (uniforms.corner_radius * 2.0 + 1.0));
    let simulated_cos_theta = normalized_edge; // Center = 1.0, edges = 0.0

    // Calculate base reflectivity from IOR (volcanic glass f0 ~ 0.085)
    let base_f0 = f0_from_ior(uniforms.ior);
    let f0 = vec3<f32>(base_f0);

    // Fresnel with roughness correction
    let fresnel = fresnel_schlick_roughness(simulated_cos_theta, f0, uniforms.roughness);

    // Specular highlight scaled by depth (foreground brighter, background dimmer)
    let depth_specular = uniforms.specular_intensity * (1.0 - uniforms.depth_layer * 0.6);
    let specular_contribution = fresnel * depth_specular;
    panel_color += specular_contribution;

    // =========================================================================
    // Fresnel Edge Highlight
    // =========================================================================

    let fresnel_strength = pow(1.0 - simulated_cos_theta, uniforms.fresnel_power);
    panel_color += uniforms.fresnel_color * fresnel_strength * uniforms.fresnel_intensity;

    // =========================================================================
    // Edge Branch Energy (High/Ultra quality only)
    // =========================================================================

    if uniforms.quality_level >= 2u && uniforms.branch_energy > 0.001 {
        let branch_intensity = edge_branch_compute(
            local_pos, half_size, uniforms.corner_radius,
            edge_dist, uniforms.branch_reach,
            uniforms.branch_density, uniforms.branch_speed,
            uniforms.branch_energy, uniforms.time
        );
        let branch_col = edge_branch_color(branch_intensity, uniforms.branch_energy);
        panel_color += branch_col;
    }

    // =========================================================================
    // Border Rendering
    // =========================================================================

    let border_alpha = 1.0 - smoothstep(0.0, uniforms.border_width, edge_dist);
    panel_color = mix(panel_color, uniforms.border_color.rgb, border_alpha * uniforms.border_color.a);

    // =========================================================================
    // Final Alpha (opaque obsidian with soft edge AA)
    // =========================================================================

    let edge_softness = 1.0;
    let shape_alpha = saturate(-dist / edge_softness);
    let alpha = uniforms.opacity * shape_alpha;
    let final_alpha = max(alpha, border_alpha * uniforms.border_color.a);

    return vec4<f32>(panel_color, final_alpha);
}

// =============================================================================
// Glow-Only Pass (for bloom integration)
// =============================================================================

@fragment
fn fs_glow_only(in: VertexOutput) -> @location(0) vec4<f32> {
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

    let edge_dist = -dist;

    // Only output glow contributions for bloom pass
    var glow = vec3<f32>(0.0);

    // Edge branch glow (if visible)
    if uniforms.quality_level >= 2u && uniforms.branch_energy > 0.001 {
        let branch_intensity = edge_branch_compute(
            local_pos, half_size, uniforms.corner_radius,
            edge_dist, uniforms.branch_reach,
            uniforms.branch_density, uniforms.branch_speed,
            uniforms.branch_energy, uniforms.time
        );
        glow += edge_branch_color(branch_intensity, uniforms.branch_energy) * 0.7;
    }

    // Fresnel edge glow
    let normalized_edge = saturate(edge_dist / (uniforms.corner_radius * 2.0 + 1.0));
    let fresnel_strength = pow(1.0 - normalized_edge, uniforms.fresnel_power);
    glow += uniforms.fresnel_color * fresnel_strength * uniforms.fresnel_intensity * 0.5;

    let glow_luminance = dot(glow, vec3<f32>(0.299, 0.587, 0.114));
    return vec4<f32>(glow, glow_luminance);
}
