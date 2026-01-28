// Edge branch energy pattern for obsidian panels.
//
// Provides 2D branch energy veins along panel borders.
// Adapts the branch_energy.wgsl concepts for flat rectangular
// SDF edges rather than torus surfaces.
//
// Branch veins appear in a thin band along the inner panel border,
// with per-branch phase offsets for organic, non-synchronized pulsing.

// =============================================================================
// Edge Branch Parameters
// =============================================================================

struct EdgeBranchParams {
    /// How far from edge the branches extend inward (pixels).
    reach: f32,
    /// Branch animation speed.
    speed: f32,
    /// Number of branches per 100px of edge length.
    density: f32,
    /// Energy level [0,1] controlling branch visibility.
    energy: f32,
    /// Animation time.
    time: f32,
}

// =============================================================================
// Edge Branch Functions
// =============================================================================

/// Mask that fades branches from the panel edge inward.
/// Returns 1.0 at the edge, 0.0 at `reach` pixels inside.
fn edge_branch_mask(edge_dist: f32, reach: f32) -> f32 {
    return 1.0 - smoothstep(0.0, reach, edge_dist);
}

/// Compute per-branch pattern along an edge.
/// `edge_pos` is the linear perimeter coordinate.
/// Returns branch intensity [0,1].
fn edge_branch_pattern(edge_pos: f32, edge_dist: f32, params: EdgeBranchParams) -> f32 {
    let scaled_pos = edge_pos * params.density;
    let cell = floor(scaled_pos);

    // Per-branch phase offset (hash-based)
    let phase = fract(sin(cell * 127.1) * 43758.5453) * 6.28318530718;

    // Branch pulse animation
    let pulse = sin((scaled_pos + (params.time + phase) * params.speed) * 6.28318530718) * 0.5 + 0.5;

    // Width concentration: branches are thin veins centered in their cell
    let cell_frac = fract(scaled_pos);
    let width_mask = 1.0 - smoothstep(0.0, 0.35, abs(cell_frac - 0.5));

    // Energy-based threshold revelation (low energy = fewer visible branches)
    let threshold = 1.0 - params.energy * 0.8;
    let revealed = smoothstep(threshold - 0.05, threshold + 0.05, pulse);

    // Combine: edge proximity * width concentration * revealed pulse
    let edge_mask = edge_branch_mask(edge_dist, params.reach);
    return edge_mask * width_mask * revealed * pulse;
}

/// Compute the perimeter coordinate from a local position relative to panel center.
/// Approximates distance along the rounded-rect perimeter.
fn edge_perimeter_coord(local_pos: vec2<f32>, half_size: vec2<f32>) -> f32 {
    // Approximate perimeter position using atan2-based mapping
    // This gives a continuous coordinate around the panel edge
    let norm_pos = local_pos / half_size;
    let angle = atan2(norm_pos.y, norm_pos.x);
    // Map [-PI, PI] to [0, 1] for a full perimeter loop
    return (angle + 3.14159265359) / 6.28318530718;
}

/// Main entry point: compute edge branch intensity for a panel fragment.
/// Takes the local position, panel dimensions, and branch parameters.
/// Returns final branch intensity [0,1].
fn edge_branch_intensity(
    local_pos: vec2<f32>,
    half_size: vec2<f32>,
    corner_radius: f32,
    edge_dist: f32,
    params: EdgeBranchParams
) -> f32 {
    // Only compute if within the branch band
    if edge_dist > params.reach {
        return 0.0;
    }

    // Compute perimeter coordinate
    let perimeter = edge_perimeter_coord(local_pos, half_size);

    // Scale perimeter by approximate perimeter length for consistent density
    let perimeter_length = 2.0 * (half_size.x + half_size.y);
    let edge_pos = perimeter * perimeter_length * 0.01; // Scale to density units

    return edge_branch_pattern(edge_pos, edge_dist, params);
}

/// Compute branch color from intensity and energy level.
/// Electric Violet base with white-hot at very high intensity.
fn edge_branch_color(intensity: f32, energy: f32) -> vec3<f32> {
    let violet = vec3<f32>(0.545, 0.361, 0.965);
    let white_hot = vec3<f32>(1.0, 0.9, 1.0);
    let hot_mix = smoothstep(0.9, 1.3, intensity) * energy;
    return mix(violet * intensity, white_hot, hot_mix);
}
