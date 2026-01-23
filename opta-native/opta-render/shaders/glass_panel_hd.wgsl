// HD Glass panel shader for premium UI overlays.
//
// Renders frosted glass panels with:
// - Cook-Torrance BRDF for physically-based reflections
// - Kawase blur sampling for efficient backdrop blur
// - Depth-dependent blur intensity scaling
// - Soft fresnel edge highlights using multi-scatter model
// - Configurable inner glow effect
// - Support for dispersion and chromatic aberration

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
// Cook-Torrance BRDF Components (from glass_hd.wgsl)
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

/// Multi-scatter Fresnel approximation.
fn fresnel_multi_scatter(cos_theta: f32, f0: vec3<f32>, roughness: f32) -> vec3<f32> {
    let single_scatter = fresnel_schlick_roughness(cos_theta, f0, roughness);

    // Energy compensation factor
    let f_avg = f0 + (vec3<f32>(1.0) - f0) * (1.0 / 21.0);
    let f_ms = single_scatter * f_avg / (vec3<f32>(1.0) - f_avg * (1.0 - single_scatter));

    return single_scatter + f_ms * (1.0 - single_scatter);
}

/// Calculate F0 (base reflectivity) from IOR.
fn f0_from_ior(ior: f32) -> f32 {
    let r = (1.0 - ior) / (1.0 + ior);
    return r * r;
}

// =============================================================================
// Uniforms
// =============================================================================

struct HDPanelUniforms {
    // Base panel properties
    /// Panel position in pixels.
    position: vec2<f32>,
    /// Panel size in pixels.
    size: vec2<f32>,
    /// Corner radius in pixels.
    corner_radius: f32,
    /// Panel opacity (0.0 - 1.0).
    opacity: f32,

    // HD glass properties
    /// Index of refraction (1.5 default for glass).
    ior: f32,
    /// Surface roughness [0,1] (affects blur and reflections).
    roughness: f32,
    /// Tint color (RGB + padding).
    tint: vec4<f32>,
    /// Dispersion amount for chromatic aberration.
    dispersion: f32,

    // Depth hierarchy
    /// Depth layer (0.0 = foreground, 1.0 = background).
    depth_layer: f32,
    /// Blur intensity base (scaled by depth).
    blur_intensity: f32,
    /// Blur falloff curve exponent.
    blur_falloff: f32,

    // Fresnel edge highlights
    /// Fresnel edge highlight color (RGB).
    fresnel_color: vec3<f32>,
    /// Fresnel edge highlight intensity.
    fresnel_intensity: f32,
    /// Fresnel edge power (controls sharpness).
    fresnel_power: f32,
    /// Padding for 16-byte alignment.
    _padding1: vec3<f32>,

    // Ambient glow
    /// Inner glow color (RGB).
    glow_color: vec3<f32>,
    /// Inner glow intensity.
    glow_intensity: f32,
    /// Inner glow radius (pixels from edge).
    glow_radius: f32,
    /// Padding.
    _padding2: vec3<f32>,

    // Border
    /// Border width in pixels.
    border_width: f32,
    /// Padding for vec4 alignment.
    _padding3: vec3<f32>,
    /// Border color (RGBA).
    border_color: vec4<f32>,

    // Resolution
    /// Render resolution (width, height).
    resolution: vec2<f32>,
    /// Quality level (0=low, 1=medium, 2=high, 3=ultra).
    quality_level: u32,
    /// Animation time for effects.
    time: f32,
}

@group(0) @binding(0)
var<uniform> uniforms: HDPanelUniforms;

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
// Blur Sampling (Kawase-style progressive blur)
// =============================================================================

// Sample counts per quality level
const SAMPLES_LOW: i32 = 8;
const SAMPLES_MEDIUM: i32 = 16;
const SAMPLES_HIGH: i32 = 32;
const SAMPLES_ULTRA: i32 = 64;

// Kawase blur kernel offsets (progressive sampling)
fn kawase_offset(iteration: i32, sample_idx: i32, total_samples: i32) -> vec2<f32> {
    // Create a spiral pattern for better coverage
    let angle = f32(sample_idx) / f32(total_samples) * TAU;
    let radius = f32(iteration + 1) * 0.5;
    return vec2<f32>(cos(angle), sin(angle)) * radius;
}

/// Depth-adjusted blur radius.
/// Panels further back (higher depth_layer) have more blur.
fn depth_adjusted_blur(base_blur: f32, depth_layer: f32, falloff: f32) -> f32 {
    // Blur scales with depth: foreground = base, background = base * (1 + depth * falloff)
    let depth_scale = 1.0 + pow(depth_layer, falloff) * 2.0;
    return base_blur * depth_scale;
}

/// Sample backdrop with Kawase blur based on quality level.
fn sample_backdrop_hd(uv: vec2<f32>, blur_radius: f32) -> vec3<f32> {
    var color = vec3<f32>(0.0);
    let pixel_size = 1.0 / uniforms.resolution;

    // Select sample count based on quality
    var sample_count: i32;
    if uniforms.quality_level == 0u {
        sample_count = SAMPLES_LOW;
    } else if uniforms.quality_level == 1u {
        sample_count = SAMPLES_MEDIUM;
    } else if uniforms.quality_level == 2u {
        sample_count = SAMPLES_HIGH;
    } else {
        sample_count = SAMPLES_ULTRA;
    }

    // Progressive blur iterations (Kawase-style)
    let iterations = 3;
    var total_weight = 0.0;

    for (var iter = 0; iter < iterations; iter = iter + 1) {
        let iter_radius = blur_radius * f32(iter + 1) / f32(iterations);
        let samples_this_iter = sample_count / iterations;

        for (var i = 0; i < samples_this_iter; i = i + 1) {
            let offset = kawase_offset(iter, i, samples_this_iter) * iter_radius * pixel_size;
            let sample_uv = clamp(uv + offset, vec2<f32>(0.001), vec2<f32>(0.999));

            // Weight by distance from center (gaussian-like falloff)
            let dist = length(offset);
            let weight = exp(-dist * dist * 2.0);

            color += textureSample(backdrop_texture, backdrop_sampler, sample_uv).rgb * weight;
            total_weight += weight;
        }
    }

    // Center sample
    color += textureSample(backdrop_texture, backdrop_sampler, uv).rgb * 1.5;
    total_weight += 1.5;

    return color / total_weight;
}

/// Sample with chromatic aberration (dispersion effect).
fn sample_backdrop_dispersed(uv: vec2<f32>, blur_radius: f32, dispersion: f32) -> vec3<f32> {
    if dispersion < 0.001 {
        return sample_backdrop_hd(uv, blur_radius);
    }

    // Calculate UV offsets for each color channel
    let center = vec2<f32>(0.5);
    let dir = normalize(uv - center);
    let dist = length(uv - center);

    let r_offset = dispersion * dist * 0.02;
    let b_offset = -dispersion * dist * 0.02;

    let r_uv = uv + dir * r_offset;
    let g_uv = uv;
    let b_uv = uv + dir * b_offset;

    // Sample each channel separately
    let r = sample_backdrop_hd(r_uv, blur_radius).r;
    let g = sample_backdrop_hd(g_uv, blur_radius).g;
    let b = sample_backdrop_hd(b_uv, blur_radius).b;

    return vec3<f32>(r, g, b);
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

    // Calculate blur radius with depth scaling
    let effective_blur = depth_adjusted_blur(
        uniforms.blur_intensity,
        uniforms.depth_layer,
        uniforms.blur_falloff
    );

    // Sample backdrop with blur and optional dispersion
    let uv = in.pixel_pos / uniforms.resolution;
    var backdrop_color: vec3<f32>;

    if uniforms.quality_level >= 3u && uniforms.dispersion > 0.001 {
        // Ultra quality: enable dispersion
        backdrop_color = sample_backdrop_dispersed(uv, effective_blur, uniforms.dispersion);
    } else {
        backdrop_color = sample_backdrop_hd(uv, effective_blur);
    }

    // Apply tint
    var panel_color = backdrop_color * uniforms.tint.rgb;

    // Edge distance for fresnel and effects (positive inside)
    let edge_dist = -dist;

    // ==========================================================================
    // Cook-Torrance Fresnel Edge Highlights
    // ==========================================================================

    // Simulate view angle based on edge distance (edges = glancing angle)
    let normalized_edge = saturate(edge_dist / (uniforms.corner_radius * 2.0 + 1.0));
    let simulated_cos_theta = normalized_edge; // Center = 1.0, edges = 0.0

    // Calculate base reflectivity from IOR
    let base_f0 = f0_from_ior(uniforms.ior);
    let f0 = vec3<f32>(base_f0) * uniforms.tint.rgb;

    // Multi-scatter fresnel for physically accurate edge highlights
    let fresnel = fresnel_multi_scatter(simulated_cos_theta, f0, uniforms.roughness);

    // Apply fresnel highlight with configurable color and intensity
    let fresnel_strength = (1.0 - simulated_cos_theta);
    let fresnel_contribution = pow(fresnel_strength, uniforms.fresnel_power) * uniforms.fresnel_intensity;
    panel_color += uniforms.fresnel_color * fresnel_contribution;

    // ==========================================================================
    // Inner Glow Effect
    // ==========================================================================

    if uniforms.glow_intensity > 0.001 && uniforms.quality_level >= 2u {
        // Inner glow based on distance from edge
        let glow_dist = saturate(edge_dist / uniforms.glow_radius);
        let glow_factor = (1.0 - glow_dist) * exp(-glow_dist * 2.0);
        panel_color += uniforms.glow_color * glow_factor * uniforms.glow_intensity;
    }

    // ==========================================================================
    // Border Rendering
    // ==========================================================================

    let border_alpha = 1.0 - smoothstep(0.0, uniforms.border_width, edge_dist);
    panel_color = mix(panel_color, uniforms.border_color.rgb, border_alpha * uniforms.border_color.a);

    // ==========================================================================
    // Final Alpha Calculation
    // ==========================================================================

    // Soft edge antialiasing
    let edge_softness = 1.0;
    let shape_alpha = saturate(-dist / edge_softness);

    // Depth-based opacity (background panels more transparent)
    let depth_opacity = 1.0 - uniforms.depth_layer * 0.3;

    // Fresnel-based opacity (more opaque at edges)
    let fresnel_avg = (fresnel.r + fresnel.g + fresnel.b) / 3.0;
    let fresnel_opacity = fresnel_avg * 0.3;

    // Combine opacity factors
    let base_alpha = uniforms.opacity * depth_opacity;
    let alpha = saturate(base_alpha + fresnel_opacity) * shape_alpha;

    // Include border alpha
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

    // Only output glow contribution for bloom pass
    var glow = vec3<f32>(0.0);

    // Inner glow
    if uniforms.glow_intensity > 0.001 {
        let glow_dist = saturate(edge_dist / uniforms.glow_radius);
        let glow_factor = (1.0 - glow_dist) * exp(-glow_dist * 2.0);
        glow = uniforms.glow_color * glow_factor * uniforms.glow_intensity;
    }

    // Fresnel edge glow
    let normalized_edge = saturate(edge_dist / (uniforms.corner_radius * 2.0 + 1.0));
    let fresnel_strength = pow(1.0 - normalized_edge, uniforms.fresnel_power);
    glow += uniforms.fresnel_color * fresnel_strength * uniforms.fresnel_intensity * 0.5;

    let glow_luminance = dot(glow, vec3<f32>(0.299, 0.587, 0.114));
    return vec4<f32>(glow, glow_luminance);
}
