// Circular Menu Shader
//
// GPU-rendered radial menu with sectors, glow effects, and glass styling.
// Designed for premium UI with spring-physics animations.
//
// Features:
// - Radial sector rendering using SDF
// - Soft glow on highlighted sector
// - Glass background with blur effect
// - Smooth anti-aliased edges
// - Color temperature theming support

// =============================================================================
// Uniforms
// =============================================================================

struct CircularMenuUniforms {
    // Menu geometry
    center: vec2<f32>,
    radius: f32,
    inner_radius: f32,

    // Sector configuration
    sector_count: u32,
    highlighted_sector: i32,
    rotation_offset: f32,
    _pad0: f32,

    // Animation state
    open_progress: f32,
    highlight_progress: f32,
    time: f32,
    _pad1: f32,

    // Visual styling
    glow_color: vec3<f32>,
    glow_intensity: f32,

    // Theme colors
    base_color: vec3<f32>,
    border_opacity: f32,

    // Display
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

/// Soft radial glow effect.
fn soft_glow(dist: f32, radius: f32, intensity: f32) -> f32 {
    let norm_dist = clamp(dist / radius, 0.0, 1.0);
    return pow(1.0 - norm_dist, 2.0) * intensity;
}

/// Energy pulse animation.
fn energy_pulse(time: f32, freq: f32, amp: f32) -> f32 {
    return 1.0 + sin(time * freq * TAU) * 0.5 * amp;
}

/// Glass-like fresnel effect.
fn fresnel(view_angle: f32, power: f32) -> f32 {
    return pow(1.0 - abs(view_angle), power);
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

    // Base colors
    var final_color = uniforms.base_color;
    var alpha = 0.0;

    // Glass background for ring
    let glass_base = vec3<f32>(0.05, 0.07, 0.12);
    let glass_alpha = 0.85 * uniforms.open_progress;

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

    // Sector highlighting
    var highlight_factor = 0.0;
    if uniforms.highlighted_sector >= 0 && current_sector == uniforms.highlighted_sector {
        // Animate highlight based on progress
        highlight_factor = uniforms.highlight_progress;

        // Add glow effect
        let angles = get_sector_angles(u32(uniforms.highlighted_sector), uniforms.sector_count, uniforms.rotation_offset);
        let sector_dist = sdf_ring_sector(p, center, animated_radius, animated_inner, angles.x, angles.y);

        // Inner glow
        let glow_dist = max(-sector_dist, 0.0);
        let glow_factor = soft_glow(glow_dist, 30.0, uniforms.glow_intensity);

        // Pulse animation
        let pulse = energy_pulse(uniforms.time, 1.5, 0.2);
        highlight_factor *= pulse;

        // Add glow color
        final_color = mix(final_color, uniforms.glow_color, glow_factor * highlight_factor);
    }

    // Compose glass effect
    let normalized_dist = (dist_from_center - animated_inner) / (animated_radius - animated_inner);
    let edge_fresnel = fresnel(normalized_dist * 2.0 - 1.0, 3.0);

    // Base glass color
    var glass_color = glass_base;
    glass_color += edge_fresnel * 0.1;

    // Highlight enhancement
    if highlight_factor > 0.0 {
        let highlight_color = mix(glass_color, uniforms.glow_color * 0.3, highlight_factor * 0.5);
        glass_color = highlight_color;
    }

    // Divider lines
    let divider_color = vec3<f32>(0.3, 0.4, 0.6);
    glass_color = mix(glass_color, divider_color, divider_intensity * uniforms.border_opacity);

    // Outer edge glow
    let outer_edge_dist = animated_radius - dist_from_center;
    let outer_glow = soft_glow(outer_edge_dist, 10.0, 0.3) * uniforms.open_progress;
    glass_color += uniforms.glow_color * outer_glow * 0.5;

    // Inner edge glow
    let inner_edge_dist = dist_from_center - animated_inner;
    let inner_glow = soft_glow(inner_edge_dist, 8.0, 0.2) * uniforms.open_progress;
    glass_color += uniforms.glow_color * inner_glow * 0.3;

    // Final composition
    final_color = glass_color;
    alpha = glass_alpha * ring_mask;

    // Add slight color variation per sector for visual interest
    if current_sector >= 0 {
        let sector_hue_shift = f32(current_sector) / f32(uniforms.sector_count);
        let subtle_tint = vec3<f32>(
            0.05 * sin(sector_hue_shift * TAU),
            0.05 * sin(sector_hue_shift * TAU + 2.094),
            0.05 * sin(sector_hue_shift * TAU + 4.188)
        );
        final_color += subtle_tint * 0.5;
    }

    return vec4<f32>(final_color, alpha);
}
