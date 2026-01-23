// Opta Ring shader.
//
// Renders the obsidian torus ring with Cook-Torrance BRDF, internal plasma,
// and subsurface emission blend gated by inverse Fresnel.
//
// Dependencies:
//   #include "math.wgsl"
//   #include "noise.wgsl"
//   #include "obsidian.wgsl"
//   #include "color.wgsl"

#include "math.wgsl"
#include "noise.wgsl"
#include "obsidian.wgsl"
#include "color.wgsl"

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
// Internal Plasma Generation
// =============================================================================

/// Generate internal plasma effect based on position and time.
fn internal_plasma(pos: vec3<f32>, uv: vec2<f32>, t: f32) -> f32 {
    // Use UV coordinates to create flowing plasma inside the tube
    let plasma_pos = vec2<f32>(
        uv.x * 6.28318530718 + t * 0.5,  // Flow around the ring
        uv.y * 6.28318530718 + t * 0.3   // Flow around the tube
    );

    // Multiple noise octaves for organic look
    var plasma = 0.0;
    plasma += fbm_perlin(plasma_pos * 2.0, 4, 2.0, 0.5) * 0.5;
    plasma += simplex_noise_2d(plasma_pos * 3.0 + t * 0.2) * 0.3;
    plasma += sin(plasma_pos.x * 4.0 + t) * sin(plasma_pos.y * 3.0 + t * 0.7) * 0.2;

    // Remap to [0, 1]
    return saturate(plasma * 0.5 + 0.5);
}

/// Generate plasma color based on intensity and energy level.
/// Uses Electric Violet as the energy color.
fn plasma_color(intensity: f32, energy: f32) -> vec3<f32> {
    // Energy color: Electric Violet #8B5CF6
    let energy_color = vec3<f32>(0.545, 0.361, 0.965);

    // Dimmer variant for low energy
    let low_color = energy_color * 0.3;
    // Full saturation at high energy
    let high_color = energy_color * 1.2;

    // Blend based on energy level
    let color = mix(low_color, high_color, energy);

    // Apply intensity
    return color * intensity * (0.8 + energy * 0.4);
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
    // Internal Plasma (subsurface emission)
    // ==========================================================================
    var emission = vec3<f32>(0.0);
    if uniforms.plasma_intensity > 0.001 {
        let plasma_value = internal_plasma(in.world_position, in.uv, uniforms.time);
        let plasma_col = plasma_color(plasma_value, uniforms.energy_level);
        emission = plasma_col * uniforms.plasma_intensity * uniforms.energy_level;
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

/// High-quality version with more plasma detail.
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

    // Enhanced plasma with more octaves
    var emission = vec3<f32>(0.0);
    if uniforms.plasma_intensity > 0.001 {
        let plasma_pos = vec2<f32>(
            in.uv.x * 6.28318530718 + uniforms.time * 0.5,
            in.uv.y * 6.28318530718 + uniforms.time * 0.3
        );

        var plasma = 0.0;
        plasma += fbm_perlin(plasma_pos * 2.0, 6, 2.0, 0.5) * 0.4;
        plasma += fbm_simplex(plasma_pos * 3.0 + uniforms.time * 0.1, 4, 2.0, 0.5) * 0.3;
        plasma += sin(plasma_pos.x * 4.0 + uniforms.time) * sin(plasma_pos.y * 3.0 + uniforms.time * 0.7) * 0.15;
        plasma += worley_noise_2d(plasma_pos * 1.5) * 0.15;

        let plasma_value = saturate(plasma * 0.5 + 0.5);
        let plasma_col = plasma_color(plasma_value, uniforms.energy_level);
        emission = plasma_col * uniforms.plasma_intensity * uniforms.energy_level;
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

    // Simple energy glow (no plasma computation)
    let energy_color = vec3<f32>(0.545, 0.361, 0.965); // Electric Violet
    color += energy_color * uniforms.energy_level * (1.0 - fresnel) * 0.3;

    // Always fully opaque
    return vec4<f32>(color, 1.0);
}
