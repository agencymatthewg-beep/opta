// Branch Indicator shader - circular status indicator with radial branch veins.
//
// Replaces status dots. A small circle with branches radiating outward.
// At idle = small dormant circle. At active = branches extend outward like a tiny star.
// Energy level controls branch reach and pulse intensity.
//
// Reduced motion: energy=0 freezes animation (time treated as 0).

const TAU: f32 = 6.28318530718;
const PI: f32 = 3.14159265359;

// =============================================================================
// Uniforms
// =============================================================================

struct BranchIndicatorUniforms {
    // Group 1: center (vec2f) + inner_radius + outer_radius = 16 bytes
    center: vec2<f32>,
    inner_radius: f32,
    outer_radius: f32,
    // Group 2: energy + time + base_color.xy = 16 bytes
    energy: f32,
    time: f32,
    base_color_xy: vec2<f32>,
    // Group 3: base_color.z + branch_count + branch_speed + quality_level = 16 bytes
    base_color_z: f32,
    branch_count: f32,
    branch_speed: f32,
    quality_level: u32,
    // Group 4: resolution (vec2f) + padding = 16 bytes
    resolution: vec2<f32>,
    _pad0: vec2<f32>,
    // Group 5: additional padding to 80 bytes
    _pad1: vec4<f32>,
}

@group(0) @binding(0) var<uniform> u: BranchIndicatorUniforms;

// =============================================================================
// Vertex
// =============================================================================

struct VertexInput {
    @location(0) position: vec2<f32>,
    @location(1) uv: vec2<f32>,
}

struct VertexOutput {
    @builtin(position) clip_position: vec4<f32>,
    @location(0) uv: vec2<f32>,
}

@vertex
fn vs_main(in: VertexInput) -> VertexOutput {
    var out: VertexOutput;
    out.clip_position = vec4<f32>(in.position, 0.0, 1.0);
    out.uv = in.uv;
    return out;
}

// =============================================================================
// Branch Pattern
// =============================================================================

/// Hash function for per-branch phase offsets.
fn branch_hash(cell: f32) -> f32 {
    return fract(sin(cell * 127.1) * 43758.5453);
}

// =============================================================================
// Fragment
// =============================================================================

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    // Convert UV to pixel coordinates
    let frag_pos = in.uv * u.resolution;

    // Distance from center
    let delta = frag_pos - u.center;
    let dist = length(delta);

    // Discard if outside outer_radius + AA margin
    if dist > u.outer_radius + 1.0 {
        discard;
    }

    // Reconstruct base_color from split components
    let base_color = vec3<f32>(u.base_color_xy.x, u.base_color_xy.y, u.base_color_z);

    // Determine animation time (reduced motion: energy=0 freezes)
    let anim_time = select(u.time, 0.0, u.energy == 0.0);

    // Quality level 0: solid colored circle
    if u.quality_level == 0u {
        let dot_color = mix(base_color, base_color + vec3<f32>(0.545, 0.361, 0.965) * 0.5, u.energy);
        let dot_alpha = 1.0 - smoothstep(u.inner_radius - 0.5, u.inner_radius + 0.5, dist);
        return vec4<f32>(dot_color, dot_alpha);
    }

    // Core circle: solid obsidian with subtle violet tint at high energy
    if dist < u.inner_radius {
        let core_tint = vec3<f32>(0.545, 0.361, 0.965) * u.energy * 0.3;
        let core_color = base_color + core_tint;
        let core_alpha = 1.0 - smoothstep(u.inner_radius - 0.5, u.inner_radius, dist);
        return vec4<f32>(core_color, core_alpha);
    }

    // Branch region: between inner_radius and outer_radius
    // Radial reach based on energy
    let max_reach = mix(u.inner_radius, u.outer_radius, u.energy);

    // If distance > max_reach: transparent (branches haven't reached here)
    if dist > max_reach {
        discard;
    }

    // Compute angle and normalize to [0,1]
    let theta = (atan2(delta.y, delta.x) + PI) / TAU;

    // Angular branch pattern
    let scaled_theta = theta * u.branch_count;
    let cell = floor(scaled_theta);

    // Per-branch phase offset
    let phase = branch_hash(cell) * TAU;

    // Width mask: angular concentration into thin radial veins
    let cell_frac = fract(scaled_theta);
    let width = mix(0.05, 0.2, u.energy);
    let width_mask = 1.0 - smoothstep(0.0, width, abs(cell_frac - 0.5));

    // Pulse animation with per-branch phase
    let radial_pos = (dist - u.inner_radius) / max(max_reach - u.inner_radius, 0.001);
    let pulse = sin((radial_pos * 3.0 + (anim_time + phase) * u.branch_speed) * TAU) * 0.5 + 0.5;

    // Fade with distance from inner radius
    let dist_fade = 1.0 - smoothstep(u.inner_radius, max_reach, dist);

    // Combine branch intensity
    let branch_intensity = pulse * width_mask * dist_fade;

    // Branch color: Electric Violet, white-hot at tips when energy > 0.8
    let violet = vec3<f32>(0.545, 0.361, 0.965);
    let white_hot = vec3<f32>(1.0, 0.9, 1.0);
    let tip_factor = (1.0 - dist_fade) * step(0.8, u.energy);
    let branch_color = mix(violet * branch_intensity, white_hot * branch_intensity, tip_factor);

    // Anti-alias outer edge
    let outer_alpha = 1.0 - smoothstep(max_reach - 1.0, max_reach, dist);

    // Final color
    let final_color = base_color * 0.1 + branch_color;
    let final_alpha = branch_intensity * outer_alpha;

    return vec4<f32>(final_color, final_alpha);
}
