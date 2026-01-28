// Branch Meter shader - horizontal meter filled with branch energy veins.
//
// Replaces linear progress bars. Energy level (0-1) controls how far branches
// extend from left to right. At 0% = empty dark obsidian. At 100% = fully alive
// with pulsing violet branches.
//
// Tri-axis response: reach, width, brightness scale with energy.
// Reduced motion: energy=0 freezes animation (time treated as 0).

const TAU: f32 = 6.28318530718;

// =============================================================================
// Uniforms
// =============================================================================

struct BranchMeterUniforms {
    // Group 1: position (vec2f) + size (vec2f) = 16 bytes
    position: vec2<f32>,
    size: vec2<f32>,
    // Group 2: corner_radius + fill_level + energy + time = 16 bytes
    corner_radius: f32,
    fill_level: f32,
    energy: f32,
    time: f32,
    // Group 3: base_color (vec3f) + branch_speed = 16 bytes
    base_color: vec3<f32>,
    branch_speed: f32,
    // Group 4: branch_density + quality_level + resolution (vec2f) = 16 bytes
    branch_density: f32,
    quality_level: u32,
    resolution: vec2<f32>,
    // Group 5-7: padding to 112 bytes (3 x 16 = 48 bytes padding)
    _pad0: vec4<f32>,
    _pad1: vec4<f32>,
    _pad2: vec4<f32>,
}

@group(0) @binding(0) var<uniform> u: BranchMeterUniforms;

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
// SDF Helpers
// =============================================================================

/// Signed distance field for a rounded rectangle.
fn sdf_rounded_rect(p: vec2<f32>, half_size: vec2<f32>, radius: f32) -> f32 {
    let r = min(radius, min(half_size.x, half_size.y));
    let q = abs(p) - half_size + vec2<f32>(r, r);
    return length(max(q, vec2<f32>(0.0, 0.0))) + min(max(q.x, q.y), 0.0) - r;
}

// =============================================================================
// Branch Pattern
// =============================================================================

/// Hash function for per-branch phase offsets.
fn branch_hash(cell: f32) -> f32 {
    return fract(sin(cell * 127.1) * 43758.5453);
}

/// Compute branch energy pattern for the meter.
fn branch_pattern(local_uv: vec2<f32>, anim_time: f32) -> f32 {
    // Tri-axis response
    let reach = mix(0.1, 0.8, u.energy);
    let width = mix(0.03, 0.15, u.energy);
    let brightness = mix(0.3, 1.5, u.energy);

    // Scale horizontal position by branch density
    let scaled_pos = local_uv.x * u.branch_density;
    let cell = floor(scaled_pos);

    // Per-branch phase offset
    let phase = branch_hash(cell) * TAU;

    // Branch pulse animation
    let pulse = sin((scaled_pos + (anim_time + phase) * u.branch_speed) * TAU) * 0.5 + 0.5;

    // Width mask: concentrate into thin veins
    let cell_frac = fract(scaled_pos);
    let width_mask = 1.0 - smoothstep(0.0, width, abs(cell_frac - 0.5));

    // Vertical reach mask: branches strongest at center (y=0.5), fade toward edges
    let vert_dist = abs(local_uv.y - 0.5) * 2.0;
    let vert_mask = 1.0 - smoothstep(0.0, reach, vert_dist);

    return pulse * width_mask * vert_mask * brightness;
}

/// Compute branch pattern with noise perturbation for High+ quality.
fn branch_pattern_hq(local_uv: vec2<f32>, anim_time: f32) -> f32 {
    // Add subtle noise perturbation to branch positions for organic feel
    let noise_x = fract(sin(dot(local_uv, vec2<f32>(12.9898, 78.233))) * 43758.5453) * 0.02;
    let noise_y = fract(sin(dot(local_uv, vec2<f32>(93.9898, 67.345))) * 24634.6345) * 0.02;
    let perturbed_uv = local_uv + vec2<f32>(noise_x, noise_y);
    return branch_pattern(perturbed_uv, anim_time);
}

// =============================================================================
// Fragment
// =============================================================================

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    // Convert UV to pixel coordinates
    let frag_pos = in.uv * u.resolution;

    // Compute local position relative to meter center
    let meter_center = u.position + u.size * 0.5;
    let local_pos = frag_pos - meter_center;

    // SDF for rounded rectangle
    let half_size = u.size * 0.5;
    let sdf = sdf_rounded_rect(local_pos, half_size, u.corner_radius);

    // Discard fragments outside the meter shape
    if sdf > 0.5 {
        discard;
    }

    // Anti-alias edge
    let edge_alpha = 1.0 - smoothstep(-0.5, 0.5, sdf);

    // Compute fill position (0 = left edge, 1 = right edge)
    let fill_x = (local_pos.x + half_size.x) / u.size.x;

    // Determine animation time (reduced motion: energy=0 freezes)
    let anim_time = select(u.time, 0.0, u.energy == 0.0);

    // Quality level 0 (Low): flat fill with violet tint
    if u.quality_level == 0u {
        let flat_color = select(
            u.base_color,
            u.base_color + vec3<f32>(0.545, 0.361, 0.965) * 0.3 * u.energy,
            fill_x <= u.fill_level
        );
        return vec4<f32>(flat_color, edge_alpha);
    }

    // In unfilled region: render only obsidian base
    if fill_x > u.fill_level {
        return vec4<f32>(u.base_color, edge_alpha);
    }

    // Fill edge: soft transition at fill boundary
    let fill_edge = 1.0 - smoothstep(u.fill_level - 0.02, u.fill_level, fill_x);

    // Map local position to UV space within filled region
    let branch_uv = vec2<f32>(fill_x / max(u.fill_level, 0.001), (local_pos.y + half_size.y) / u.size.y);

    // Compute branch intensity based on quality level
    var branch_intensity: f32;
    if u.quality_level >= 2u {
        // High+ quality: add noise perturbation
        branch_intensity = branch_pattern_hq(branch_uv, anim_time);
    } else {
        // Medium quality: standard pattern
        branch_intensity = branch_pattern(branch_uv, anim_time);
    }

    // Apply fill edge fade
    branch_intensity *= fill_edge;

    // Branch color: Electric Violet with white-hot at high intensity
    let violet = vec3<f32>(0.545, 0.361, 0.965);
    let white_hot = vec3<f32>(1.0, 0.9, 1.0);
    let hot_blend = smoothstep(0.8, 1.2, branch_intensity) * u.energy;
    let branch_color = mix(violet * branch_intensity, white_hot, hot_blend);

    // Final color: blend branch emission onto base
    let final_color = mix(u.base_color, u.base_color + branch_color, clamp(branch_intensity, 0.0, 1.0));

    return vec4<f32>(final_color, edge_alpha);
}
