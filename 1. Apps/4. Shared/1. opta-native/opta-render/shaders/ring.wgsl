// Opta Ring shader.
//
// Renders the obsidian torus ring with Cook-Torrance BRDF, branch energy,
// and subsurface emission blend gated by inverse Fresnel.
//
// Dependencies:
//   #include "math.wgsl"
//   #include "noise.wgsl"
//   #include "noise_hd.wgsl"
//   #include "obsidian.wgsl"
//   #include "color.wgsl"
//   #include "branch_energy.wgsl"

#include "math.wgsl"
#include "noise.wgsl"
#include "noise_hd.wgsl"
#include "obsidian.wgsl"
#include "color.wgsl"
#include "branch_energy.wgsl"

// =============================================================================
// Uniforms
// =============================================================================

struct RingUniforms {
    /// Model transformation matrix (includes rotation and tilt).
    model_matrix: mat4x4<f32>,
    /// Combined view-projection matrix.
    view_proj_matrix: mat4x4<f32>,
    /// Current time in seconds.
    time: f32,
    /// Energy level (0.0 to 1.0).
    energy_level: f32,
    /// Plasma effect intensity (0.0 to 1.0).
    plasma_intensity: f32,
    /// Fresnel effect power (higher = sharper edge glow).
    fresnel_power: f32,
    /// Current ring rotation angle (radians).
    ring_rotation: f32,
    /// Current tilt angle (radians).
    tilt_angle: f32,
    /// Surface roughness for obsidian (0.03 default).
    roughness: f32,
    /// Emission intensity for energy visibility.
    emission_intensity: f32,
    /// Near-black obsidian base color (RGB).
    base_color: vec3<f32>,
    /// Additional padding for 16-byte alignment.
    _padding: f32,
    /// Branch revelation threshold (0-1, lower = more branches visible).
    branch_threshold: f32,
    /// Branch noise frequency scale.
    branch_scale: f32,
    /// Branch animation speed multiplier.
    branch_speed: f32,
    /// Number of major branches around the ring.
    branch_count: f32,
}

@group(0) @binding(0)
var<uniform> uniforms: RingUniforms;

// =============================================================================
// Vertex Shader
// =============================================================================

struct VertexInput {
    @location(0) position: vec3<f32>,
    @location(1) normal: vec3<f32>,
    @location(2) uv: vec2<f32>,
}

struct VertexOutput {
    @builtin(position) clip_position: vec4<f32>,
    @location(0) world_position: vec3<f32>,
    @location(1) world_normal: vec3<f32>,
    @location(2) uv: vec2<f32>,
    @location(3) view_dir: vec3<f32>,
}

@vertex
fn vs_main(in: VertexInput) -> VertexOutput {
    var out: VertexOutput;

    // Apply model transformation
    let world_pos = uniforms.model_matrix * vec4<f32>(in.position, 1.0);
    out.world_position = world_pos.xyz;

    // Transform normal (using upper 3x3 of model matrix)
    let normal_matrix = mat3x3<f32>(
        uniforms.model_matrix[0].xyz,
        uniforms.model_matrix[1].xyz,
        uniforms.model_matrix[2].xyz
    );
    out.world_normal = normalize(normal_matrix * in.normal);

    // Apply view-projection
    out.clip_position = uniforms.view_proj_matrix * world_pos;

    // Pass through UVs
    out.uv = in.uv;

    // Calculate view direction (assuming camera at origin for simplicity)
    out.view_dir = normalize(-world_pos.xyz);

    return out;
}

// =============================================================================
// Fragment Shader
// =============================================================================

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    let normal = normalize(in.world_normal);
    let view_dir = normalize(in.view_dir);

    // ==========================================================================
    // Obsidian Material Setup
    // ==========================================================================
    var material = obsidian_opta_ring();
    material.roughness = uniforms.roughness;
    material.base_color = uniforms.base_color;

    // ==========================================================================
    // Cook-Torrance Reflection
    // ==========================================================================
    // Ambient light from above
    let light_dir = normalize(vec3<f32>(0.3, 1.0, 0.5));
    let shaded = obsidian_shade(normal, view_dir, light_dir, material);
    var color = shaded.xyz;

    // ==========================================================================
    // Fresnel for Emission Gating
    // ==========================================================================
    let fresnel = obsidian_view_fresnel(normal, view_dir, material.ior);

    // ==========================================================================
    // Branch Energy (subsurface emission)
    // ==========================================================================
    var emission = vec3<f32>(0.0);
    if uniforms.plasma_intensity > 0.001 {
        let params = BranchParams(
            uniforms.branch_threshold,
            uniforms.branch_scale,
            uniforms.branch_speed,
            uniforms.branch_count,
            uniforms.energy_level
        );
        let branch_value = branch_energy(in.uv, uniforms.time, params);
        let branch_col = branch_color(branch_value, uniforms.energy_level);
        emission = branch_col * uniforms.plasma_intensity;
    }

    // ==========================================================================
    // Emission Blend (energy visible face-on, edges show reflection)
    // ==========================================================================
    color = obsidian_emission_blend(color, emission, uniforms.emission_intensity, fresnel);

    // ==========================================================================
    // Tone Mapping
    // ==========================================================================
    color = tonemap_aces(color);

    // Always fully opaque - obsidian is solid stone
    return vec4<f32>(color, 1.0);
}

// =============================================================================
// Alternative Entry Points
// =============================================================================

/// High-quality version with domain-warped branch detail.
@fragment
fn fs_main_hq(in: VertexOutput) -> @location(0) vec4<f32> {
    let normal = normalize(in.world_normal);
    let view_dir = normalize(in.view_dir);

    // Obsidian material
    var material = obsidian_opta_ring();
    material.roughness = uniforms.roughness;
    material.base_color = uniforms.base_color;

    // Cook-Torrance with ambient light from above
    let light_dir = normalize(vec3<f32>(0.3, 1.0, 0.5));
    let shaded = obsidian_shade(normal, view_dir, light_dir, material);
    var color = shaded.xyz;

    // Add secondary fill light for depth
    let fill_dir = normalize(vec3<f32>(-0.5, 0.3, -0.8));
    let fill_shaded = obsidian_shade(normal, view_dir, fill_dir, material);
    color += fill_shaded.xyz * 0.3;

    // Fresnel for emission gating
    let fresnel = obsidian_view_fresnel(normal, view_dir, material.ior);

    // Enhanced branch energy with domain-warped UVs for organic feel
    var emission = vec3<f32>(0.0);
    if uniforms.plasma_intensity > 0.001 {
        let params = BranchParams(
            uniforms.branch_threshold,
            uniforms.branch_scale * 1.5,
            uniforms.branch_speed,
            uniforms.branch_count,
            uniforms.energy_level
        );
        // Warp UVs for organic feel
        let warped_uv = in.uv + vec2<f32>(
            simplex_noise_2d(in.uv * 3.0 + uniforms.time * 0.1) * 0.02,
            simplex_noise_2d(in.uv * 3.0 + 5.0 + uniforms.time * 0.1) * 0.02
        );
        let branch_value = branch_energy(warped_uv, uniforms.time, params);
        let branch_col = branch_color(branch_value, uniforms.energy_level);
        emission = branch_col * uniforms.plasma_intensity;
    }

    // Emission blend
    color = obsidian_emission_blend(color, emission, uniforms.emission_intensity, fresnel);

    // Tone mapping
    color = tonemap_aces(color);

    // Always fully opaque
    return vec4<f32>(color, 1.0);
}

/// Low-quality version for power saving.
@fragment
fn fs_main_lq(in: VertexOutput) -> @location(0) vec4<f32> {
    let normal = normalize(in.world_normal);
    let view_dir = normalize(in.view_dir);

    // Simple Fresnel-based edge highlight on obsidian base color
    let n_dot_v = max(dot(normal, view_dir), 0.0);
    let f0 = obsidian_f0_from_ior(1.85);
    let fresnel = obsidian_fresnel_schlick(n_dot_v, f0);

    // Base obsidian color with subtle fresnel highlight
    let base = uniforms.base_color;
    let highlight = vec3<f32>(0.15, 0.15, 0.18); // Subtle silver highlight

    // Combine base with edge highlight
    var color = mix(base, highlight, fresnel * 0.6);

    // Simple energy glow (no branch computation)
    let energy_color = vec3<f32>(0.545, 0.361, 0.965); // Electric Violet
    color += energy_color * uniforms.energy_level * (1.0 - fresnel) * 0.3;

    // Always fully opaque
    return vec4<f32>(color, 1.0);
}
