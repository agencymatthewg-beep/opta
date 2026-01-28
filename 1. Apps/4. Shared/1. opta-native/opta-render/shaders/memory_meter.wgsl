// Memory liquid fill meter shader.
//
// Renders a liquid fill visualization with:
// - Animated wave surface at the fill level
// - Surface tension highlight effect
// - Pressure-based color gradient (blue -> red)
// - Internal movement noise for liquid effect
// - Rounded container using SDF

// =============================================================================
// Constants
// =============================================================================

const PI: f32 = 3.14159265359;
const TAU: f32 = 6.28318530718;

// =============================================================================
// Noise Functions (inlined for standalone shader)
// =============================================================================

/// Hash function: vec2 -> f32
fn hash21(p: vec2<f32>) -> f32 {
    var p3 = fract(vec3<f32>(p.xyx) * 0.1031);
    p3 = p3 + dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

/// Hash function for gradient noise
fn hash_grad2(p: vec2<f32>) -> vec2<f32> {
    let angle = hash21(p) * TAU;
    return vec2<f32>(cos(angle), sin(angle));
}

/// 2D Perlin noise with quintic interpolation
fn perlin_noise_2d(p: vec2<f32>) -> f32 {
    let i = floor(p);
    let f = fract(p);

    // Quintic interpolation curve
    let u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);

    // Gradients at corners
    let g00 = hash_grad2(i);
    let g10 = hash_grad2(i + vec2<f32>(1.0, 0.0));
    let g01 = hash_grad2(i + vec2<f32>(0.0, 1.0));
    let g11 = hash_grad2(i + vec2<f32>(1.0, 1.0));

    // Distance vectors
    let d00 = f;
    let d10 = f - vec2<f32>(1.0, 0.0);
    let d01 = f - vec2<f32>(0.0, 1.0);
    let d11 = f - vec2<f32>(1.0, 1.0);

    // Dot products and interpolate
    let v00 = dot(g00, d00);
    let v10 = dot(g10, d10);
    let v01 = dot(g01, d01);
    let v11 = dot(g11, d11);

    return mix(mix(v00, v10, u.x), mix(v01, v11, u.x), u.y);
}

/// Fractal Brownian Motion
fn fbm(p: vec2<f32>, octaves: i32) -> f32 {
    var value = 0.0;
    var amplitude = 0.5;
    var pos = p;

    for (var i = 0; i < octaves; i = i + 1) {
        value = value + amplitude * perlin_noise_2d(pos);
        pos = pos * 2.0;
        amplitude = amplitude * 0.5;
    }

    return value;
}

// =============================================================================
// SDF Functions
// =============================================================================

/// Rounded box SDF
fn sd_rounded_box_2d(p: vec2<f32>, b: vec2<f32>, r: f32) -> f32 {
    let d = abs(p) - b + r;
    return length(max(d, vec2<f32>(0.0))) + min(max(d.x, d.y), 0.0) - r;
}

// =============================================================================
// Utility Functions
// =============================================================================

fn saturate(x: f32) -> f32 {
    return clamp(x, 0.0, 1.0);
}

fn remap(value: f32, in_min: f32, in_max: f32, out_min: f32, out_max: f32) -> f32 {
    return out_min + (value - in_min) * (out_max - out_min) / (in_max - in_min);
}

// =============================================================================
// Uniforms
// =============================================================================

struct MemoryMeterUniforms {
    /// Render resolution (width, height).
    resolution: vec2<f32>,
    /// Position in pixels (center).
    position: vec2<f32>,
    /// Size in pixels (width, height).
    size: vec2<f32>,
    /// Current time in seconds.
    time: f32,
    /// Memory usage ratio (0.0 to 1.0).
    usage: f32,
    /// Memory pressure (0.0 = low, 1.0 = critical).
    pressure: f32,
    /// Swap usage ratio (0.0 to 1.0).
    swap_usage: f32,
    /// Corner radius in pixels.
    corner_radius: f32,
    /// Padding.
    _padding: vec3<f32>,
}

@group(0) @binding(0)
var<uniform> uniforms: MemoryMeterUniforms;

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

    // Transform vertex to meter space
    let half_size = uniforms.size * 0.5;
    let center = uniforms.position;

    // Convert to pixel position
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

/// Get pressure-based color gradient
/// Low pressure (0.0) = blue, High pressure (1.0) = red
fn pressure_color(pressure: f32) -> vec3<f32> {
    let low = vec3<f32>(0.2, 0.5, 0.9);      // Calm blue
    let medium = vec3<f32>(0.9, 0.7, 0.2);   // Warning yellow
    let high = vec3<f32>(0.9, 0.2, 0.2);     // Critical red

    if pressure < 0.5 {
        return mix(low, medium, pressure * 2.0);
    } else {
        return mix(medium, high, (pressure - 0.5) * 2.0);
    }
}

/// Calculate wave surface height
fn wave_surface(x: f32, time: f32, amplitude: f32) -> f32 {
    // Multiple overlapping sine waves for natural look
    let wave1 = sin(x * 8.0 + time * 2.0) * 0.4;
    let wave2 = sin(x * 12.0 - time * 1.5) * 0.3;
    let wave3 = sin(x * 20.0 + time * 3.0) * 0.15;
    let wave4 = sin(x * 6.0 - time * 0.8) * 0.15;

    return (wave1 + wave2 + wave3 + wave4) * amplitude;
}

/// Render the container outline/glass
fn container_outline(dist: f32, border_width: f32) -> vec4<f32> {
    // Glass-like container
    let edge = smoothstep(border_width + 1.0, border_width, abs(dist));
    let glass_color = vec3<f32>(0.4, 0.5, 0.6);
    let glass_alpha = edge * 0.3;

    // Highlight at the edge
    let highlight = smoothstep(border_width + 2.0, border_width, dist) * 0.2;

    return vec4<f32>(glass_color + highlight, glass_alpha + highlight);
}

/// Render the liquid fill
fn liquid_fill(local_pos: vec2<f32>, half_size: vec2<f32>, fill_level: f32) -> vec4<f32> {
    let time = uniforms.time;
    let pressure = uniforms.pressure;

    // Normalize position to -1 to 1 range
    let norm_pos = local_pos / half_size;

    // Calculate fill height in normalized space (-1 = bottom, 1 = top)
    let fill_height = -1.0 + fill_level * 2.0;

    // Wave animation at surface
    let wave_amplitude = 0.03 + pressure * 0.02;
    let wave = wave_surface(norm_pos.x, time, wave_amplitude);

    // Surface line with wave
    let surface_y = fill_height + wave;

    // Distance from surface
    let dist_from_surface = norm_pos.y - surface_y;

    // Check if we're below the surface (in the liquid)
    if dist_from_surface > 0.0 {
        return vec4<f32>(0.0); // Above liquid
    }

    // Base liquid color from pressure
    let base_color = pressure_color(pressure);

    // Depth-based shading (darker at bottom)
    let depth = saturate((-norm_pos.y + 1.0) * 0.5);
    let depth_color = mix(base_color * 0.7, base_color, 1.0 - depth * 0.5);

    // Internal movement noise
    let noise_scale = 4.0;
    let noise_p = norm_pos * noise_scale + vec2<f32>(time * 0.3, time * 0.2);
    let internal_noise = fbm(noise_p, 3) * 0.15;

    // Bubbles/particles in liquid
    let bubble_p = norm_pos * 10.0 + vec2<f32>(time * 0.5, -time * 2.0);
    let bubble_noise = perlin_noise_2d(bubble_p);
    let bubbles = smoothstep(0.6, 0.8, bubble_noise) * 0.2;

    // Surface highlight (meniscus/surface tension)
    let surface_dist = abs(dist_from_surface);
    let surface_highlight = exp(-surface_dist * 30.0) * 0.4;
    let meniscus_color = vec3<f32>(1.0) * surface_highlight;

    // Combine effects
    var liquid_color = depth_color + internal_noise + bubbles * 0.5;
    liquid_color = liquid_color + meniscus_color;

    // Slight glow at edges (fresnel-like)
    let edge_dist = (abs(norm_pos.x) - 0.7) / 0.3;
    let edge_glow = saturate(edge_dist) * 0.1;
    liquid_color = liquid_color + base_color * edge_glow;

    // Alpha based on surface proximity (softer edge at top)
    let surface_alpha = smoothstep(0.0, -0.02, dist_from_surface);
    let final_alpha = surface_alpha * 0.9;

    return vec4<f32>(liquid_color, final_alpha);
}

/// Render swap usage indicator
fn swap_indicator(local_pos: vec2<f32>, half_size: vec2<f32>) -> vec4<f32> {
    let swap = uniforms.swap_usage;
    if swap < 0.01 {
        return vec4<f32>(0.0);
    }

    let time = uniforms.time;

    // Swap is shown as a warning stripe at the bottom
    let norm_pos = local_pos / half_size;
    let swap_height = -1.0 + swap * 0.3; // Up to 15% of container height

    if norm_pos.y > swap_height {
        return vec4<f32>(0.0);
    }

    // Warning stripe pattern
    let stripe = sin((norm_pos.x + norm_pos.y) * 20.0 + time * 2.0) * 0.5 + 0.5;
    let stripe_color = mix(
        vec3<f32>(0.9, 0.5, 0.1), // Orange
        vec3<f32>(0.9, 0.2, 0.1), // Red
        stripe
    );

    // Fade in based on swap amount
    let alpha = saturate(swap * 2.0) * 0.7;

    return vec4<f32>(stripe_color, alpha);
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    // Calculate position relative to meter center
    let center = uniforms.position;
    let local_pos = in.pixel_pos - center;
    let half_size = uniforms.size * 0.5;

    // Container SDF
    let container_dist = sd_rounded_box_2d(local_pos, half_size, uniforms.corner_radius);

    // Discard pixels outside container with some margin for effects
    if container_dist > 2.0 {
        discard;
    }

    // Start with container background
    var final_color = vec3<f32>(0.05, 0.08, 0.12); // Dark background
    var final_alpha = 0.0;

    // Container interior
    if container_dist < 0.0 {
        // Draw liquid fill
        let liquid = liquid_fill(local_pos, half_size, uniforms.usage);
        final_color = mix(final_color, liquid.rgb, liquid.a);
        final_alpha = max(final_alpha, liquid.a);

        // Draw swap indicator (underneath liquid for effect)
        let swap = swap_indicator(local_pos, half_size);
        final_color = mix(final_color, swap.rgb, swap.a * 0.5);

        // Container interior alpha
        final_alpha = max(final_alpha, 0.8);
    }

    // Draw container outline
    let outline = container_outline(container_dist, 2.0);
    final_color = mix(final_color, outline.rgb, outline.a);
    final_alpha = max(final_alpha, outline.a);

    // Soft edge at container boundary
    let edge_softness = 1.0;
    let edge_alpha = 1.0 - smoothstep(-edge_softness, edge_softness, container_dist);
    final_alpha = final_alpha * edge_alpha;

    return vec4<f32>(final_color, final_alpha);
}
