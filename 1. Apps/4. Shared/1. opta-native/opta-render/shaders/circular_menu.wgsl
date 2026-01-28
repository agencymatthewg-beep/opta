// Circular Menu Shader — Obsidian + Branch Energy
//
// GPU-rendered radial menu with obsidian material and branch-energy sector
// highlights. Designed for premium UI with spring-physics animations.
//
// Features:
// - Radial sector rendering using SDF
// - Obsidian material (deep black with subtle reflections)
// - Branch energy highlight that grows from inner radius outward
// - Smooth anti-aliased edges
// - Color temperature theming support

// =============================================================================
// Uniforms
// =============================================================================

struct CircularMenuUniforms {
    // Menu geometry (16 bytes)
    center: vec2<f32>,
    radius: f32,
    inner_radius: f32,

    // Sector configuration (16 bytes)
    sector_count: u32,
    highlighted_sector: i32,
    rotation_offset: f32,
    _pad0: f32,

    // Animation state (16 bytes)
    open_progress: f32,
    highlight_progress: f32,
    time: f32,
    _pad1: f32,

    // Branch energy styling (16 bytes)
    branch_energy_color: vec3<f32>,
    branch_energy_intensity: f32,

    // Theme colors (16 bytes)
    base_color: vec3<f32>,
    border_opacity: f32,

    // Display (16 bytes)
    resolution: vec2<f32>,
    _pad2: vec2<f32>,
}

@group(0) @binding(0) var<uniform> uniforms: CircularMenuUniforms;

// =============================================================================
// Vertex Shader
// =============================================================================

struct VertexInput {
    @location(0) position: vec2<f32>,
    @location(1) uv: vec2<f32>,
}

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
    @location(1) world_pos: vec2<f32>,
}

@vertex
fn vs_main(in: VertexInput) -> VertexOutput {
    var out: VertexOutput;
    out.position = vec4<f32>(in.position, 0.0, 1.0);
    out.uv = in.uv;
    // Convert UV to world coordinates centered at menu center
    out.world_pos = (in.uv - 0.5) * uniforms.resolution + uniforms.center;
    return out;
}

// =============================================================================
// Constants
// =============================================================================

const PI: f32 = 3.14159265359;
const TAU: f32 = 6.28318530718;
const AA_PIXELS: f32 = 1.5;

// Obsidian material properties
const OBSIDIAN_BASE: vec3<f32> = vec3<f32>(0.02, 0.02, 0.03);
const OBSIDIAN_ROUGHNESS: f32 = 0.03;

// Electric Violet (branch energy default)
const ELECTRIC_VIOLET: vec3<f32> = vec3<f32>(0.545, 0.361, 0.965);

// =============================================================================
// SDF Functions
// =============================================================================

/// Signed distance to a ring (annulus).
fn sdf_ring(p: vec2<f32>, center: vec2<f32>, outer_r: f32, inner_r: f32) -> f32 {
    let d = length(p - center);
    let outer_dist = d - outer_r;
    let inner_dist = inner_r - d;
    return max(outer_dist, inner_dist);
}

/// Signed distance to a ring sector.
/// angle_start and angle_end in radians, counter-clockwise from positive X.
fn sdf_ring_sector(
    p: vec2<f32>,
    center: vec2<f32>,
    outer_r: f32,
    inner_r: f32,
    angle_start: f32,
    angle_end: f32
) -> f32 {
    let rel_p = p - center;
    let d = length(rel_p);

    // Ring distance
    let ring_dist = max(d - outer_r, inner_r - d);

    // Angular distance
    var angle = atan2(rel_p.y, rel_p.x);
    if angle < 0.0 {
        angle += TAU;
    }

    // Normalize angles
    var start = angle_start;
    var end = angle_end;
    if start < 0.0 { start += TAU; }
    if end < 0.0 { end += TAU; }

    // Handle wraparound
    var in_sector: bool;
    if start <= end {
        in_sector = angle >= start && angle <= end;
    } else {
        in_sector = angle >= start || angle <= end;
    }

    if in_sector {
        return ring_dist;
    }

    // Distance to sector edges (angular)
    let mid_r = (outer_r + inner_r) * 0.5;
    let start_point = center + vec2<f32>(cos(start), sin(start)) * mid_r;
    let end_point = center + vec2<f32>(cos(end), sin(end)) * mid_r;

    let dist_to_start = length(p - start_point) - (outer_r - inner_r) * 0.5;
    let dist_to_end = length(p - end_point) - (outer_r - inner_r) * 0.5;

    return min(dist_to_start, dist_to_end);
}

/// Signed distance to a line segment.
fn sdf_line_segment(p: vec2<f32>, a: vec2<f32>, b: vec2<f32>, thickness: f32) -> f32 {
    let pa = p - a;
    let ba = b - a;
    let h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h) - thickness;
}

// =============================================================================
// Helper Functions
// =============================================================================

/// Smoothstep for anti-aliasing.
fn aa_smooth(dist: f32, aa_width: f32) -> f32 {
    return 1.0 - smoothstep(-aa_width, aa_width, dist);
}

/// Get sector angle bounds.
fn get_sector_angles(sector_index: u32, sector_count: u32, rotation: f32) -> vec2<f32> {
    let sector_angle = TAU / f32(sector_count);
    let start_angle = f32(sector_index) * sector_angle + rotation;
    let end_angle = start_angle + sector_angle;
    return vec2<f32>(start_angle, end_angle);
}

/// Calculate which sector a point is in.
fn point_to_sector(p: vec2<f32>, center: vec2<f32>, sector_count: u32, rotation: f32) -> i32 {
    let rel_p = p - center;
    let d = length(rel_p);

    // Check if within ring
    let animated_radius = uniforms.radius * uniforms.open_progress;
    let animated_inner = uniforms.inner_radius * uniforms.open_progress;

    if d < animated_inner || d > animated_radius {
        return -1;
    }

    var angle = atan2(rel_p.y, rel_p.x) - rotation;
    if angle < 0.0 {
        angle += TAU;
    }

    let sector_angle = TAU / f32(sector_count);
    let sector = i32(floor(angle / sector_angle));

    return sector % i32(sector_count);
}

// =============================================================================
// Obsidian Material
// =============================================================================

/// Compute obsidian material appearance.
/// Returns color with subtle anisotropic highlights characteristic of volcanic glass.
fn obsidian_material(normalized_dist: f32, view_angle: f32, time: f32) -> vec3<f32> {
    // Base obsidian surface
    var color = OBSIDIAN_BASE;

    // Subtle specular highlight (simulates polished volcanic glass)
    let spec_angle = view_angle * PI;
    let specular = pow(max(cos(spec_angle), 0.0), 1.0 / OBSIDIAN_ROUGHNESS) * 0.08;
    color += vec3<f32>(specular);

    // Very subtle depth variation (internal structure of obsidian)
    let depth_noise = sin(normalized_dist * 12.0 + time * 0.3) * 0.005;
    color += vec3<f32>(depth_noise);

    return color;
}

/// Fresnel-like edge highlight for obsidian.
fn obsidian_fresnel(normalized_dist: f32) -> f32 {
    // Stronger at edges of the ring (both inner and outer)
    let edge = abs(normalized_dist * 2.0 - 1.0);
    return pow(edge, 4.0) * 0.15;
}

// =============================================================================
// Branch Energy Functions
// =============================================================================

/// Compute branch energy intensity at a given point within the highlighted sector.
/// Energy grows from the inner radius outward, creating a rising energy wave.
fn branch_energy_wave(
    dist_from_center: f32,
    inner_r: f32,
    outer_r: f32,
    progress: f32,
    time: f32
) -> f32 {
    // Normalized position within the ring (0 = inner edge, 1 = outer edge)
    let ring_t = clamp((dist_from_center - inner_r) / (outer_r - inner_r), 0.0, 1.0);

    // Energy front: grows outward with highlight_progress
    // At progress=0, no energy. At progress=1, full reach.
    let energy_front = progress;

    // The energy is strongest behind the wavefront and fades at the leading edge
    let behind_front = smoothstep(energy_front, energy_front - 0.3, ring_t);
    let at_front = 1.0 - smoothstep(energy_front - 0.05, energy_front, ring_t);

    // Combine: energy exists from inner to front, brightest near the front
    let base_energy = behind_front * (0.4 + 0.6 * (1.0 - at_front));

    // Pulsing animation along the energy body
    let pulse = sin(ring_t * 8.0 - time * 3.0) * 0.15 + 0.85;

    // Wavefront glow: extra brightness right at the leading edge
    let front_glow = exp(-pow((ring_t - energy_front) * 10.0, 2.0)) * 0.6;

    return clamp((base_energy * pulse + front_glow) * progress, 0.0, 1.0);
}

/// Compute the angular fade for branch energy within a sector.
/// Energy is strongest at the sector center and fades toward edges.
fn branch_energy_angular_fade(
    p: vec2<f32>,
    center: vec2<f32>,
    sector_start: f32,
    sector_end: f32
) -> f32 {
    let rel_p = p - center;
    var angle = atan2(rel_p.y, rel_p.x);
    if angle < 0.0 {
        angle += TAU;
    }

    // Compute how far into the sector this angle is (0-1)
    var sector_span = sector_end - sector_start;
    if sector_span < 0.0 {
        sector_span += TAU;
    }

    var angle_in_sector = angle - sector_start;
    if angle_in_sector < 0.0 {
        angle_in_sector += TAU;
    }

    let t = clamp(angle_in_sector / sector_span, 0.0, 1.0);

    // Smooth fade at sector edges (strongest in center)
    let edge_fade = smoothstep(0.0, 0.15, t) * smoothstep(1.0, 0.85, t);

    return edge_fade;
}

// =============================================================================
// Fragment Shader
// =============================================================================

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    let p = in.world_pos;
    let center = uniforms.center;
    let rel_p = p - center;
    let dist_from_center = length(rel_p);

    // Apply open animation to radii
    let animated_radius = uniforms.radius * uniforms.open_progress;
    let animated_inner = uniforms.inner_radius * uniforms.open_progress;

    // Early out if far from menu
    if dist_from_center > animated_radius + 50.0 {
        return vec4<f32>(0.0);
    }

    // Calculate AA width based on screen resolution
    let aa_width = AA_PIXELS / min(uniforms.resolution.x, uniforms.resolution.y) * animated_radius;

    // Ring SDF
    let ring_dist = sdf_ring(p, center, animated_radius, animated_inner);
    let ring_mask = aa_smooth(ring_dist, aa_width);

    if ring_mask < 0.001 {
        return vec4<f32>(0.0);
    }

    // Normalized distance within ring (0 = inner edge, 1 = outer edge)
    let normalized_dist = (dist_from_center - animated_inner) / (animated_radius - animated_inner);

    // Determine current sector
    let current_sector = point_to_sector(p, center, uniforms.sector_count, uniforms.rotation_offset);

    // Draw sector dividers
    var divider_intensity = 0.0;
    let divider_thickness = 1.0;
    let sector_angle = TAU / f32(uniforms.sector_count);

    for (var i = 0u; i < uniforms.sector_count; i++) {
        let angle = f32(i) * sector_angle + uniforms.rotation_offset;
        let dir = vec2<f32>(cos(angle), sin(angle));

        // Line from inner to outer radius
        let line_start = center + dir * animated_inner;
        let line_end = center + dir * animated_radius;

        let line_dist = sdf_line_segment(p, line_start, line_end, divider_thickness);
        let line_mask = aa_smooth(line_dist, aa_width);

        divider_intensity = max(divider_intensity, line_mask);
    }

    // Obsidian base material
    let view_angle = normalized_dist * 2.0 - 1.0; // -1 at inner, +1 at outer
    var final_color = obsidian_material(normalized_dist, view_angle, uniforms.time);

    // Obsidian fresnel at ring edges
    let fresnel = obsidian_fresnel(normalized_dist);
    final_color += vec3<f32>(fresnel);

    // Branch energy on highlighted sector
    if uniforms.highlighted_sector >= 0 && current_sector == uniforms.highlighted_sector {
        let angles = get_sector_angles(
            u32(uniforms.highlighted_sector),
            uniforms.sector_count,
            uniforms.rotation_offset
        );

        // Compute radial energy wave
        let energy_wave = branch_energy_wave(
            dist_from_center,
            animated_inner,
            animated_radius,
            uniforms.highlight_progress,
            uniforms.time
        );

        // Angular fade (energy strongest at sector center)
        let angular_fade = branch_energy_angular_fade(p, center, angles.x, angles.y);

        // Combined branch energy intensity
        let energy = energy_wave * angular_fade * uniforms.branch_energy_intensity;

        // Apply energy color with additive blending
        let energy_color = uniforms.branch_energy_color * energy;
        final_color += energy_color;

        // Subtle inner glow at the energy boundary
        let inner_glow = exp(-pow((dist_from_center - animated_inner) * 0.1, 2.0))
            * uniforms.highlight_progress * 0.2 * angular_fade;
        final_color += uniforms.branch_energy_color * inner_glow;
    }

    // Divider lines (subtle on obsidian)
    let divider_color = vec3<f32>(0.08, 0.08, 0.10);
    final_color = mix(final_color, divider_color, divider_intensity * uniforms.border_opacity);

    // Outer edge subtle rim light
    let outer_edge_dist = animated_radius - dist_from_center;
    let outer_rim = exp(-outer_edge_dist * 0.5) * 0.04 * uniforms.open_progress;
    final_color += vec3<f32>(outer_rim);

    // Inner edge subtle rim light
    let inner_edge_dist = dist_from_center - animated_inner;
    let inner_rim = exp(-inner_edge_dist * 0.5) * 0.03 * uniforms.open_progress;
    final_color += vec3<f32>(inner_rim);

    // Alpha: obsidian is opaque where the ring exists
    let alpha = 0.92 * uniforms.open_progress * ring_mask;

    return vec4<f32>(final_color, alpha);
}
