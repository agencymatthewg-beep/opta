// Branch Energy shader functions for directional vein-like energy patterns.
//
// Include with: #include "branch_energy.wgsl"
//
// Dependencies:
//   #include "math.wgsl"
//   #include "noise.wgsl"
//   #include "noise_hd.wgsl"
//
// Provides:
// - Branch pattern generation using ridged turbulence
// - Equator-origin masking (strongest at tube equator v=0.5)
// - Threshold revelation (fewer branches at low energy, many at high)
// - Tri-axis response (length, width, brightness scale with energy)
// - Per-branch phase offsets for organic, non-synchronized pulsing
// - Branch coloring with Electric Violet base and hot-white cores

// =============================================================================
// Branch Parameters
// =============================================================================

/// Parameters controlling branch energy appearance and behavior.
struct BranchParams {
    /// Revelation threshold (0-1, lower = more branches visible).
    threshold: f32,
    /// Noise frequency scale (default ~4.0).
    scale: f32,
    /// Time animation speed multiplier (default ~0.3).
    speed: f32,
    /// Number of major branches around the ring (default ~8.0).
    branch_count: f32,
    /// Current energy level [0,1].
    energy: f32,
}

// =============================================================================
// Branch Helper Functions
// =============================================================================

/// Compute equator distance mask.
/// Branches are strongest AT equator (v=0.5), fade with distance.
/// @param v  UV v-coordinate [0,1] around the tube cross-section.
/// @param reach  How far from equator branches extend [0,1].
/// @return Mask value [0,1], 1.0 at equator, 0.0 beyond reach.
fn branch_equator_mask(v: f32, reach: f32) -> f32 {
    let equator_dist = abs(v - 0.5) * 2.0;
    return 1.0 - smoothstep(0.0, reach, equator_dist);
}

/// Compute per-branch phase offset for non-synchronized pulsing.
/// Each branch gets a unique timing offset based on its index.
/// @param u  UV u-coordinate [0,1] around the ring major axis.
/// @param branch_count  Number of major branches.
/// @return Phase offset in radians [0, TAU].
fn branch_phase_offset(u: f32, branch_count: f32) -> f32 {
    let idx = floor(u * branch_count);
    return hash31(vec3<f32>(idx, idx * 7.31, idx * 13.17)) * TAU;
}

/// Compute tri-axis response values based on energy level.
/// Returns (length_reach, width_factor, brightness_factor).
/// @param energy  Current energy level [0,1].
/// @return vec3(reach, width, brightness).
fn branch_tri_axis(energy: f32) -> vec3<f32> {
    let length_reach = mix(0.15, 1.0, energy);
    let width_factor = mix(0.02, 0.12, energy);
    let brightness = mix(0.4, 1.5, energy);
    return vec3<f32>(length_reach, width_factor, brightness);
}

/// Compute width mask concentrating energy into narrow veins.
/// @param u  UV u-coordinate [0,1].
/// @param branch_count  Number of branches.
/// @param width  Width factor for vein thickness.
/// @return Mask value [0,1], 1.0 at branch center.
fn branch_width_mask(u: f32, branch_count: f32, width: f32) -> f32 {
    let cell_frac = fract(u * branch_count);
    let dist_from_center = abs(cell_frac - 0.5) * 2.0;
    return 1.0 - smoothstep(0.0, width, dist_from_center);
}

/// Generate the branch noise field using 3D ridged turbulence.
/// @param uv  Surface UV coordinates.
/// @param time  Current animation time.
/// @param params  Branch parameters.
/// @return Branch noise intensity [0,1].
fn branch_noise_field(uv: vec2<f32>, time: f32, params: BranchParams) -> f32 {
    // Per-branch phase offset for organic pulsing
    let phase_offset = branch_phase_offset(uv.x, params.branch_count);

    // Distance from equator for vertical noise axis
    let equator_dist = abs(uv.y - 0.5) * 2.0;

    // 3D sample point: u for horizontal, equator_dist for vertical, time for animation
    let p = vec3<f32>(
        uv.x * params.scale,
        equator_dist * 3.0,
        (time + phase_offset) * params.speed
    );

    // Sample ridged turbulence for sharp vein-like structures
    let noise_value = ridged_turbulence_3d(p, 4);

    // Apply threshold revelation with smooth transition band
    return smoothstep(params.threshold - 0.05, params.threshold + 0.05, noise_value);
}

// =============================================================================
// Main Entry Points
// =============================================================================

/// Compute complete branch energy intensity at a surface point.
/// Combines equator mask, width mask, noise field, and tri-axis scaling.
/// @param uv  Surface UV coordinates.
/// @param time  Current animation time.
/// @param params  Branch parameters.
/// @return Branch intensity [0, ~1.5].
fn branch_energy(uv: vec2<f32>, time: f32, params: BranchParams) -> f32 {
    // Tri-axis response: (reach, width, brightness)
    let axes = branch_tri_axis(params.energy);

    // Equator mask with energy-driven reach
    let eq_mask = branch_equator_mask(uv.y, axes.x);

    // Width mask for vein concentration
    let w_mask = branch_width_mask(uv.x, params.branch_count, axes.y);

    // Noise field with threshold revelation
    let noise = branch_noise_field(uv, time, params);

    // Combine all factors with brightness scaling
    return noise * eq_mask * w_mask * axes.z;
}

/// Generate branch emission color from intensity and energy level.
/// Base: Electric Violet (0.545, 0.361, 0.965).
/// Hot cores blend toward white-hot at high intensity.
/// @param intensity  Branch intensity value.
/// @param energy  Current energy level [0,1].
/// @return RGB emission color.
fn branch_color(intensity: f32, energy: f32) -> vec3<f32> {
    // Electric Violet #8B5CF6
    let base_violet = vec3<f32>(0.545, 0.361, 0.965);

    // White-hot core color for high intensity
    let white_hot = vec3<f32>(1.0, 0.9, 1.0);

    // Base color scaled by intensity
    let base = base_violet * intensity;

    // Blend toward white-hot at high intensity and energy
    let hot_blend = smoothstep(0.8, 1.2, intensity) * energy;
    return mix(base, white_hot, hot_blend);
}
