// CPU energy core meter shader.
//
// Renders a pulsing energy core effect with:
// - Central energy orb with procedural noise
// - Per-core activity indicators as ring dots
// - Temperature-based color gradient (cool blue -> hot orange)
// - Pulsing animation based on CPU usage

// =============================================================================
// Constants
// =============================================================================

const PI: f32 = 3.14159265359;
const TAU: f32 = 6.28318530718;
const MAX_CORES: u32 = 16u;

// =============================================================================
// Noise Functions (inlined for standalone shader)
// =============================================================================

/// Hash function: vec2 -> f32
fn hash21(p: vec2<f32>) -> f32 {
    var p3 = fract(vec3<f32>(p.xyx) * 0.1031);
    p3 = p3 + dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

/// Hash function: vec2 -> vec2
fn hash22(p: vec2<f32>) -> vec2<f32> {
    var p3 = fract(vec3<f32>(p.xyx) * vec3<f32>(0.1031, 0.1030, 0.0973));
    p3 = p3 + dot(p3, p3.yzx + 33.33);
    return fract((p3.xx + p3.yz) * p3.zy);
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

    // Distance vectors to corners
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
fn fbm(p: vec2<f32>) -> f32 {
    var value = 0.0;
    var amplitude = 0.5;
    var pos = p;

    for (var i = 0; i < 5; i = i + 1) {
        value = value + amplitude * perlin_noise_2d(pos);
        pos = pos * 2.0;
        amplitude = amplitude * 0.5;
    }

    return value;
}

// =============================================================================
// SDF Functions
// =============================================================================

/// Circle SDF
fn sd_circle(p: vec2<f32>, r: f32) -> f32 {
    return length(p) - r;
}

/// Ring SDF (hollow circle)
fn sd_ring(p: vec2<f32>, r: f32, w: f32) -> f32 {
    return abs(length(p) - r) - w;
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

struct CpuMeterUniforms {
    /// Render resolution (width, height).
    resolution: vec2<f32>,
    /// Position in pixels (center).
    position: vec2<f32>,
    /// Size in pixels (width, height).
    size: vec2<f32>,
    /// Current time in seconds.
    time: f32,
    /// Overall CPU usage (0.0 to 1.0).
    usage: f32,
    /// Normalized temperature (0.0 = cool, 1.0 = hot).
    temperature: f32,
    /// Number of active cores.
    core_count: u32,
    /// Padding.
    _padding: vec2<f32>,
    /// Per-core usage values (up to 16 cores).
    core_usage: array<f32, 16>,
}

@group(0) @binding(0)
var<uniform> uniforms: CpuMeterUniforms;

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

/// Get temperature-based color gradient
/// Cool (0.0) = blue, Hot (1.0) = orange/red
fn temperature_color(temp: f32) -> vec3<f32> {
    let cool = vec3<f32>(0.2, 0.5, 1.0);   // Cool blue
    let warm = vec3<f32>(1.0, 0.7, 0.2);   // Warm orange
    let hot = vec3<f32>(1.0, 0.3, 0.1);    // Hot red-orange

    if temp < 0.5 {
        return mix(cool, warm, temp * 2.0);
    } else {
        return mix(warm, hot, (temp - 0.5) * 2.0);
    }
}

/// Render the central energy core
fn energy_core(p: vec2<f32>, radius: f32) -> vec4<f32> {
    let time = uniforms.time;
    let usage = uniforms.usage;
    let temp = uniforms.temperature;

    // Distance from center
    let dist = length(p);
    let norm_dist = dist / radius;

    // Core glow falloff
    let core_glow = 1.0 - saturate(norm_dist);
    let core_glow_sq = core_glow * core_glow;

    // Procedural noise for inner energy
    let noise_scale = 3.0 + usage * 2.0;
    let noise_speed = 1.0 + usage * 2.0;
    let noise_p = p / radius * noise_scale + vec2<f32>(time * noise_speed, time * noise_speed * 0.7);
    let energy_noise = fbm(noise_p) * 0.5 + 0.5;

    // Swirling motion
    let angle = atan2(p.y, p.x);
    let swirl = sin(angle * 3.0 + time * 2.0 + norm_dist * 5.0) * 0.5 + 0.5;

    // Pulse based on usage
    let pulse_freq = 1.0 + usage * 3.0;
    let pulse = sin(time * pulse_freq * TAU) * 0.3 + 0.7;

    // Combine effects
    let energy = energy_noise * swirl * pulse;
    let intensity = core_glow_sq * (0.5 + energy * 0.5) * (0.3 + usage * 0.7);

    // Color based on temperature
    let base_color = temperature_color(temp);
    let glow_color = mix(base_color, vec3<f32>(1.0), 0.3);

    // Inner bright core
    let inner_core = exp(-norm_dist * 4.0) * (0.5 + usage * 0.5);

    let final_color = mix(base_color * intensity, glow_color, inner_core);
    let alpha = saturate(intensity + inner_core * 0.5);

    // Only show within the core radius
    let edge_falloff = 1.0 - smoothstep(0.8, 1.0, norm_dist);

    return vec4<f32>(final_color * edge_falloff, alpha * edge_falloff);
}

/// Render core activity indicators around the ring
fn core_indicators(p: vec2<f32>, ring_radius: f32, dot_radius: f32) -> vec4<f32> {
    let core_count = uniforms.core_count;
    let time = uniforms.time;
    let temp = uniforms.temperature;

    if core_count == 0u {
        return vec4<f32>(0.0);
    }

    var color = vec3<f32>(0.0);
    var alpha = 0.0;

    // Calculate angle for each core
    let angle_step = TAU / f32(core_count);

    // Current pixel angle and distance
    let pixel_angle = atan2(p.y, p.x);
    let pixel_dist = length(p);

    for (var i = 0u; i < core_count && i < MAX_CORES; i = i + 1u) {
        // Core position on ring
        let core_angle = f32(i) * angle_step - PI * 0.5; // Start from top
        let core_pos = vec2<f32>(cos(core_angle), sin(core_angle)) * ring_radius;

        // Distance to this core indicator
        let to_core = p - core_pos;
        let dist_to_core = length(to_core);

        // Get this core's usage
        let core_usage = uniforms.core_usage[i];

        // Dot size varies with usage
        let active_radius = dot_radius * (0.5 + core_usage * 0.5);

        // Distance field for the dot
        let dot_dist = dist_to_core - active_radius;

        // Glow effect
        let glow = exp(-dot_dist * 0.1) * core_usage;

        // Pulse for active cores
        let pulse = sin(time * TAU * (1.0 + core_usage * 2.0) + f32(i) * 0.5) * 0.2 + 0.8;

        // Core color based on temperature and usage
        let core_color = mix(
            temperature_color(temp * 0.5),
            temperature_color(temp),
            core_usage
        );

        // Solid dot
        let dot_alpha = 1.0 - smoothstep(-1.0, 1.0, dot_dist);
        let dot_intensity = dot_alpha * (0.3 + core_usage * 0.7) * pulse;

        color += core_color * (dot_intensity + glow * 0.2);
        alpha = max(alpha, dot_intensity + glow * 0.3);
    }

    return vec4<f32>(color, saturate(alpha));
}

/// Render the outer ring glow
fn outer_ring(p: vec2<f32>, radius: f32, width: f32) -> vec4<f32> {
    let usage = uniforms.usage;
    let temp = uniforms.temperature;
    let time = uniforms.time;

    // Ring SDF
    let dist = sd_ring(p, radius, width);

    // Soft glow
    let glow = exp(-abs(dist) * 0.05) * (0.2 + usage * 0.3);

    // Animated energy along ring
    let angle = atan2(p.y, p.x);
    let energy = sin(angle * 8.0 - time * 3.0) * 0.3 + 0.7;

    let ring_color = temperature_color(temp) * glow * energy;
    let alpha = glow * 0.5;

    return vec4<f32>(ring_color, alpha);
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    // Calculate position relative to meter center
    let center = uniforms.position;
    let local_pos = in.pixel_pos - center;

    // Normalize to meter space (-1 to 1)
    let half_size = min(uniforms.size.x, uniforms.size.y) * 0.5;
    let p = local_pos / half_size;

    // Radii for different elements
    let core_radius = 0.4;
    let ring_radius = 0.7;
    let dot_radius = half_size * 0.08;

    // Render layers
    let core = energy_core(p, core_radius);
    let indicators = core_indicators(local_pos, ring_radius * half_size, dot_radius);
    let ring = outer_ring(p, ring_radius, 0.02);

    // Composite layers (back to front)
    var final_color = ring.rgb * ring.a;
    var final_alpha = ring.a;

    // Add core (behind indicators)
    final_color = mix(final_color, core.rgb, core.a);
    final_alpha = max(final_alpha, core.a);

    // Add indicators (on top)
    final_color = mix(final_color, indicators.rgb, indicators.a);
    final_alpha = max(final_alpha, indicators.a);

    // Discard pixels outside the meter bounds
    let dist_from_center = length(p);
    if dist_from_center > 1.0 {
        discard;
    }

    return vec4<f32>(final_color, final_alpha);
}
