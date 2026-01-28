// GPU heat meter shader.
//
// Renders a heat map visualization with:
// - Temperature gradient (green -> yellow -> orange -> red)
// - Heat shimmer effect based on temperature
// - Power-based outer glow
// - Chip/processor shape using SDF

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

/// Box SDF (axis-aligned)
fn sd_box_2d(p: vec2<f32>, b: vec2<f32>) -> f32 {
    let d = abs(p) - b;
    return length(max(d, vec2<f32>(0.0))) + min(max(d.x, d.y), 0.0);
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

struct GpuMeterUniforms {
    /// Render resolution (width, height).
    resolution: vec2<f32>,
    /// Position in pixels (center).
    position: vec2<f32>,
    /// Size in pixels (width, height).
    size: vec2<f32>,
    /// Current time in seconds.
    time: f32,
    /// GPU utilization (0.0 to 1.0).
    usage: f32,
    /// Normalized temperature (0.0 = cool, 1.0 = hot).
    temperature: f32,
    /// Power consumption ratio (0.0 to 1.0 of TDP).
    power: f32,
    /// VRAM usage ratio (0.0 to 1.0).
    vram_usage: f32,
    /// Padding.
    _padding: vec3<f32>,
}

@group(0) @binding(0)
var<uniform> uniforms: GpuMeterUniforms;

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

/// Get temperature-based color gradient for heat map
/// Cool (0.0) = green, Hot (1.0) = red
fn heat_color(temp: f32) -> vec3<f32> {
    let cool = vec3<f32>(0.2, 0.8, 0.3);      // Green (cool)
    let warm = vec3<f32>(0.95, 0.85, 0.2);    // Yellow (warm)
    let hot = vec3<f32>(0.95, 0.5, 0.1);      // Orange (hot)
    let critical = vec3<f32>(0.9, 0.15, 0.1); // Red (critical)

    if temp < 0.33 {
        return mix(cool, warm, temp * 3.0);
    } else if temp < 0.66 {
        return mix(warm, hot, (temp - 0.33) * 3.0);
    } else {
        return mix(hot, critical, (temp - 0.66) * 3.0);
    }
}

/// Calculate heat shimmer distortion
fn heat_shimmer(p: vec2<f32>, time: f32, intensity: f32) -> vec2<f32> {
    let freq = 10.0;
    let speed = 3.0;

    let shimmer_x = sin(p.y * freq + time * speed) * intensity * 0.02;
    let shimmer_y = cos(p.x * freq * 0.7 + time * speed * 0.8) * intensity * 0.01;

    return vec2<f32>(shimmer_x, shimmer_y);
}

/// Render chip/processor shape SDF
/// Creates a square chip with beveled corners and pin notches
fn chip_sdf(p: vec2<f32>, size: f32) -> f32 {
    // Main chip body (rounded square)
    let body = sd_rounded_box_2d(p, vec2<f32>(size), size * 0.1);

    // Inner die area (slightly smaller, sharper corners)
    let die_size = size * 0.7;
    let die = sd_rounded_box_2d(p, vec2<f32>(die_size), size * 0.05);

    return body;
}

/// Render the die/core pattern inside the chip
fn die_pattern(p: vec2<f32>, size: f32) -> f32 {
    let die_size = size * 0.65;

    // Check if inside die area
    let dist = sd_rounded_box_2d(p, vec2<f32>(die_size), size * 0.03);
    if dist > 0.0 {
        return 0.0;
    }

    // Create grid pattern for transistor blocks
    let grid_scale = 8.0;
    let grid_p = fract(p / size * grid_scale);
    let grid_center = grid_p - 0.5;
    let block = sd_box_2d(grid_center, vec2<f32>(0.35));

    // Random brightness per block
    let block_id = floor(p / size * grid_scale);
    let block_activity = hash21(block_id + uniforms.time * 0.1);

    if block < 0.0 {
        return block_activity;
    }

    return 0.0;
}

/// Render heat radiation effect
fn heat_radiation(p: vec2<f32>, size: f32) -> vec4<f32> {
    let temp = uniforms.temperature;
    let time = uniforms.time;

    if temp < 0.3 {
        return vec4<f32>(0.0);
    }

    // Radial distance from center
    let dist = length(p) / size;

    // Animated heat waves
    let wave_freq = 3.0;
    let wave_speed = 2.0;
    let wave = sin((dist - time * wave_speed * 0.1) * TAU * wave_freq);
    let wave_intensity = saturate(wave * 0.5 + 0.5) * (1.0 - dist);

    // Only show outside the main chip
    let falloff = smoothstep(0.9, 1.5, dist);
    let intensity = wave_intensity * falloff * (temp - 0.3) / 0.7;

    let heat_col = heat_color(temp);
    return vec4<f32>(heat_col * intensity * 0.3, intensity * 0.2);
}

/// Render power glow effect
fn power_glow(p: vec2<f32>, size: f32) -> vec4<f32> {
    let power = uniforms.power;
    let temp = uniforms.temperature;
    let time = uniforms.time;

    // Outer glow based on power consumption
    let dist = length(p) / size;

    // Pulsing glow
    let pulse = sin(time * TAU * (0.5 + power)) * 0.2 + 0.8;

    // Glow intensity
    let glow = exp(-dist * 2.0) * power * pulse;

    // Color based on power level
    let glow_color = mix(
        vec3<f32>(0.2, 0.5, 0.9),  // Low power - blue
        heat_color(temp),          // High power - heat color
        power
    );

    return vec4<f32>(glow_color * glow, glow * 0.5);
}

/// Render VRAM indicator bar
fn vram_indicator(p: vec2<f32>, size: f32) -> vec4<f32> {
    let vram = uniforms.vram_usage;

    // Position bar below the chip
    let bar_pos = p + vec2<f32>(0.0, size * 1.3);
    let bar_size = vec2<f32>(size * 0.8, size * 0.08);

    // Bar background
    let bar_bg = sd_rounded_box_2d(bar_pos, bar_size, size * 0.02);

    if bar_bg > 0.0 {
        return vec4<f32>(0.0);
    }

    // Fill level
    let fill_width = bar_size.x * vram;
    let fill_pos = bar_pos + vec2<f32>((bar_size.x - fill_width) * 0.5, 0.0);
    let is_filled = bar_pos.x < -bar_size.x + fill_width * 2.0;

    // Colors
    let bg_color = vec3<f32>(0.1, 0.12, 0.15);
    let fill_color = mix(
        vec3<f32>(0.2, 0.6, 0.9),  // Low VRAM - blue
        vec3<f32>(0.9, 0.4, 0.2),  // High VRAM - orange
        vram
    );

    if is_filled {
        return vec4<f32>(fill_color, 0.9);
    } else {
        return vec4<f32>(bg_color, 0.7);
    }
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    // Calculate position relative to meter center
    let center = uniforms.position;
    let local_pos = in.pixel_pos - center;
    let half_size = min(uniforms.size.x, uniforms.size.y) * 0.5;

    // Normalize to -1 to 1 range
    let p = local_pos / half_size;

    // Apply heat shimmer distortion
    let shimmer = heat_shimmer(p, uniforms.time, uniforms.temperature);
    let distorted_p = p + shimmer * uniforms.temperature;

    // Chip SDF
    let chip_size = 0.6;
    let chip_dist = chip_sdf(distorted_p, chip_size);

    // Start with transparent
    var final_color = vec3<f32>(0.0);
    var final_alpha = 0.0;

    // Render power glow (behind chip)
    let glow = power_glow(p, chip_size * 1.2);
    final_color = final_color + glow.rgb;
    final_alpha = max(final_alpha, glow.a);

    // Render heat radiation (behind chip)
    let radiation = heat_radiation(p, chip_size);
    final_color = final_color + radiation.rgb;
    final_alpha = max(final_alpha, radiation.a);

    // Render chip body
    if chip_dist < 0.0 {
        // Base chip color (dark)
        let base_color = vec3<f32>(0.08, 0.1, 0.12);

        // Die pattern with activity
        let die_activity = die_pattern(distorted_p, chip_size);

        // Heat color based on temperature
        let heat = heat_color(uniforms.temperature);

        // Blend die activity with heat
        let activity_color = mix(base_color, heat, die_activity * uniforms.usage);

        // Overall heat tint based on temperature
        let chip_color = mix(activity_color, heat * 0.5 + activity_color * 0.5, uniforms.temperature * 0.3);

        // Metallic edge highlight
        let edge_dist = -chip_dist;
        let edge_highlight = exp(-edge_dist * 20.0) * 0.2;
        let edge_color = mix(vec3<f32>(0.3, 0.35, 0.4), heat, uniforms.temperature * 0.5);

        final_color = chip_color + edge_color * edge_highlight;
        final_alpha = 0.95;

        // Add heat shimmer glow inside when hot
        if uniforms.temperature > 0.5 {
            let inner_glow = fbm(distorted_p * 5.0 + uniforms.time, 3) * 0.5 + 0.5;
            let heat_intensity = (uniforms.temperature - 0.5) * 2.0;
            final_color = final_color + heat * inner_glow * heat_intensity * 0.2;
        }
    }

    // Render VRAM indicator
    let vram = vram_indicator(p, chip_size);
    final_color = mix(final_color, vram.rgb, vram.a);
    final_alpha = max(final_alpha, vram.a);

    // Discard pixels too far from anything visible
    if final_alpha < 0.01 {
        discard;
    }

    return vec4<f32>(final_color, final_alpha);
}
