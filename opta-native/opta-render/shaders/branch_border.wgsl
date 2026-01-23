// Branch Border shader - rectangular panel borders with pulsing branch veins.
//
// A standalone border decoration (no fill). Branches flow continuously around
// the border perimeter, with per-branch phase offsets for organic pulsing.
// Energy controls how many branches are visible and how bright they pulse.
//
// Composable overlay that can be placed around ANY element.
// Reduced motion: energy=0 freezes animation (time treated as 0).

const TAU: f32 = 6.28318530718;
const PI: f32 = 3.14159265359;

// =============================================================================
// Uniforms
// =============================================================================

struct BranchBorderUniforms {
    // Group 1: position (vec2f) + size (vec2f) = 16 bytes
    position: vec2<f32>,
    size: vec2<f32>,
    // Group 2: corner_radius + border_width + energy + time = 16 bytes
    corner_radius: f32,
    border_width: f32,
    energy: f32,
    time: f32,
    // Group 3: branch_speed + branch_density + quality_level + padding = 16 bytes
    branch_speed: f32,
    branch_density: f32,
    quality_level: u32,
    _pad0: f32,
    // Group 4: resolution (vec2f) + padding = 16 bytes
    resolution: vec2<f32>,
    _pad1: vec2<f32>,
    // Group 5-6: additional padding to 96 bytes (2 x 16 = 32 bytes)
    _pad2: vec4<f32>,
    _pad3: vec4<f32>,
}

@group(0) @binding(0) var<uniform> u: BranchBorderUniforms;

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

/// Compute perimeter coordinate from local position relative to panel center.
fn perimeter_coord(local_pos: vec2<f32>, half_size: vec2<f32>) -> f32 {
    let norm_pos = local_pos / half_size;
    let angle = atan2(norm_pos.y, norm_pos.x);
    // Map [-PI, PI] to [0, 1]
    return (angle + PI) / TAU;
}

/// Compute branch pattern along the perimeter.
fn border_branch_pattern(perimeter: f32, perimeter_length: f32, anim_time: f32) -> f32 {
    let scaled_pos = perimeter * perimeter_length * u.branch_density * 0.01;
    let cell = floor(scaled_pos);

    // Per-branch phase offset
    let phase = branch_hash(cell) * TAU;

    // Branch pulse animation
    let pulse = sin((scaled_pos + (anim_time + phase) * u.branch_speed) * TAU) * 0.5 + 0.5;

    // Width concentration: thin veins within each cell
    let cell_frac = fract(scaled_pos);
    let width_mask = 1.0 - smoothstep(0.0, 0.35, abs(cell_frac - 0.5));

    // Threshold revelation: fewer branches at low energy
    let threshold = 1.0 - u.energy * 0.8;
    let revealed = smoothstep(threshold - 0.05, threshold + 0.05, pulse);

    return width_mask * revealed * pulse;
}

/// Secondary harmonic layer for High+ quality (half-density at 60% speed).
fn border_branch_secondary(perimeter: f32, perimeter_length: f32, anim_time: f32) -> f32 {
    let scaled_pos = perimeter * perimeter_length * u.branch_density * 0.005; // half density
    let cell = floor(scaled_pos);
    let phase = branch_hash(cell + 100.0) * TAU; // different phase set

    let pulse = sin((scaled_pos + (anim_time + phase) * u.branch_speed * 0.6) * TAU) * 0.5 + 0.5;
    let cell_frac = fract(scaled_pos);
    let width_mask = 1.0 - smoothstep(0.0, 0.4, abs(cell_frac - 0.5));

    let threshold = 1.0 - u.energy * 0.6;
    let revealed = smoothstep(threshold - 0.05, threshold + 0.05, pulse);

    return width_mask * revealed * pulse * 0.4; // Subtle secondary layer
}

// =============================================================================
// Fragment
// =============================================================================

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    // Convert UV to pixel coordinates
    let frag_pos = in.uv * u.resolution;

    // Compute panel center and local position
    let panel_center = u.position + u.size * 0.5;
    let local_pos = frag_pos - panel_center;
    let half_size = u.size * 0.5;

    // Compute SDF for rounded rectangle
    let sdf = sdf_rounded_rect(local_pos, half_size, u.corner_radius);

    // Edge distance: distance from the panel edge (0 = on edge)
    let edge_dist = abs(sdf);

    // Border mask: only render within border band
    let border_mask = 1.0 - smoothstep(0.0, u.border_width, edge_dist);

    // Discard if not in border region
    if border_mask < 0.01 {
        discard;
    }

    // Determine animation time (reduced motion: energy=0 freezes)
    let anim_time = select(u.time, 0.0, u.energy == 0.0);

    // Quality level 0: solid subtle violet border line
    if u.quality_level == 0u {
        let violet = vec3<f32>(0.545, 0.361, 0.965);
        let line_color = violet * u.energy * 0.5;
        return vec4<f32>(line_color, border_mask * u.energy);
    }

    // Compute perimeter coordinate
    let perimeter = perimeter_coord(local_pos, half_size);

    // Approximate perimeter length
    let perimeter_length = 2.0 * (u.size.x + u.size.y);

    // Compute primary branch pattern
    var branch_intensity = border_branch_pattern(perimeter, perimeter_length, anim_time);

    // Quality level >= 2: add secondary harmonic for depth
    if u.quality_level >= 2u {
        branch_intensity += border_branch_secondary(perimeter, perimeter_length, anim_time);
    }

    // Branch color: Electric Violet with white-hot at peaks
    let violet = vec3<f32>(0.545, 0.361, 0.965);
    let white_hot = vec3<f32>(1.0, 0.9, 1.0);
    let hot_blend = smoothstep(0.7, 1.1, branch_intensity) * u.energy;
    let branch_color = mix(violet * branch_intensity, white_hot * branch_intensity, hot_blend);

    // Output alpha: border_mask * branch_intensity
    let final_alpha = border_mask * clamp(branch_intensity, 0.0, 1.0);

    return vec4<f32>(branch_color, final_alpha);
}
