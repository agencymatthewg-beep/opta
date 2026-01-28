// Obsidian material with Cook-Torrance BRDF.
//
// Include with: #include "obsidian.wgsl"
//
// Dependencies: #include "math.wgsl"
//
// Provides:
// - Cook-Torrance specular BRDF for opaque volcanic glass
// - Obsidian material with near-mirror roughness (0.03)
// - Subsurface emission blend gated by inverse Fresnel
// - Always returns alpha = 1.0 (fully opaque)

// =============================================================================
// Cook-Torrance BRDF Components
// =============================================================================

/// GGX/Trowbridge-Reitz Normal Distribution Function (NDF).
/// Models how microfacets are distributed across the surface.
fn obsidian_distribution_ggx(n_dot_h: f32, roughness: f32) -> f32 {
    let a = roughness * roughness;
    let a2 = a * a;
    let n_dot_h2 = n_dot_h * n_dot_h;

    let nom = a2;
    var denom = n_dot_h2 * (a2 - 1.0) + 1.0;
    denom = PI * denom * denom;

    return nom / max(denom, 0.0001);
}

/// Schlick-GGX Geometry Function (single direction).
/// Models self-shadowing of microfacets.
fn obsidian_geometry_schlick_ggx(n_dot_v: f32, roughness: f32) -> f32 {
    let r = roughness + 1.0;
    let k = (r * r) / 8.0;

    let nom = n_dot_v;
    let denom = n_dot_v * (1.0 - k) + k;

    return nom / max(denom, 0.0001);
}

/// Smith's Geometry Function (bidirectional shadowing-masking).
fn obsidian_geometry_smith(n_dot_v: f32, n_dot_l: f32, roughness: f32) -> f32 {
    let ggx_v = obsidian_geometry_schlick_ggx(n_dot_v, roughness);
    let ggx_l = obsidian_geometry_schlick_ggx(n_dot_l, roughness);
    return ggx_v * ggx_l;
}

/// Schlick's Fresnel approximation (scalar).
fn obsidian_fresnel_schlick(cos_theta: f32, f0: f32) -> f32 {
    return f0 + (1.0 - f0) * pow(saturate(1.0 - cos_theta), 5.0);
}

// =============================================================================
// Obsidian Material
// =============================================================================

/// Obsidian material parameters for opaque volcanic glass.
struct ObsidianMaterial {
    /// Surface roughness (0.03 for polished obsidian).
    roughness: f32,
    /// Index of refraction (1.85 for volcanic glass).
    ior: f32,
    /// Near-black base color of the obsidian stone.
    base_color: vec3<f32>,
    /// Energy color for subsurface emission (Electric Violet).
    energy_color: vec3<f32>,
}

/// Create the default Opta ring obsidian material.
fn obsidian_opta_ring() -> ObsidianMaterial {
    return ObsidianMaterial(
        0.03,                              // Near-mirror polished obsidian
        1.85,                              // Volcanic glass IOR
        vec3<f32>(0.02, 0.02, 0.03),       // Near-black with subtle deep blue
        vec3<f32>(0.545, 0.361, 0.965)     // Electric Violet #8B5CF6
    );
}

// =============================================================================
// Obsidian Shading
// =============================================================================

/// Calculate F0 (base reflectivity) from IOR.
/// For IOR 1.85: f0 = ((1-1.85)/(1+1.85))^2 = 0.085
fn obsidian_f0_from_ior(ior: f32) -> f32 {
    let r = (1.0 - ior) / (1.0 + ior);
    return r * r;
}

/// Full obsidian shading with Cook-Torrance BRDF.
/// Returns fully opaque color (alpha = 1.0).
///
/// @param normal Surface normal (world space, normalized).
/// @param view_dir Direction to camera (normalized).
/// @param light_dir Direction to light (normalized).
/// @param material Obsidian material properties.
fn obsidian_shade(
    normal: vec3<f32>,
    view_dir: vec3<f32>,
    light_dir: vec3<f32>,
    material: ObsidianMaterial
) -> vec4<f32> {
    let half_vec = normalize(view_dir + light_dir);

    let n_dot_h = max(dot(normal, half_vec), 0.0);
    let n_dot_v = max(dot(normal, view_dir), 0.0);
    let n_dot_l = max(dot(normal, light_dir), 0.0);
    let v_dot_h = max(dot(view_dir, half_vec), 0.0);

    // Base reflectivity from IOR (f0 ~ 0.085 for obsidian)
    let f0 = obsidian_f0_from_ior(material.ior);

    // Fresnel term
    let fresnel = obsidian_fresnel_schlick(v_dot_h, f0);

    // Normal Distribution Function
    let d = obsidian_distribution_ggx(n_dot_h, material.roughness);

    // Geometry Function
    let g = obsidian_geometry_smith(n_dot_v, n_dot_l, material.roughness);

    // Cook-Torrance specular BRDF
    let numerator = d * g * fresnel;
    let denominator = 4.0 * n_dot_v * n_dot_l + 0.0001;
    let specular = numerator / denominator;

    // Diffuse contribution (dark obsidian base)
    let kd = (1.0 - fresnel);
    let diffuse = material.base_color * kd * n_dot_l;

    // Ambient term (very subtle for dark obsidian)
    let ambient = material.base_color * 0.05;

    // Combine
    let color = ambient + diffuse + vec3<f32>(specular) * n_dot_l;

    return vec4<f32>(color, 1.0);
}

// =============================================================================
// Emission Blend
// =============================================================================

/// Blend subsurface emission with surface reflection.
/// Energy is visible face-on (where fresnel is LOW) and
/// edges are dominated by specular reflection (high fresnel).
///
/// @param reflection The Cook-Torrance surface reflection color.
/// @param emission The emission color (plasma * energy_color).
/// @param emission_intensity Strength of the emission effect.
/// @param fresnel Fresnel factor at this fragment (0 = face-on, 1 = edge).
fn obsidian_emission_blend(
    reflection: vec3<f32>,
    emission: vec3<f32>,
    emission_intensity: f32,
    fresnel: f32
) -> vec3<f32> {
    // Energy shows MORE at face-on angles (where fresnel is LOW)
    // Edges dominated by specular reflection (high fresnel)
    return reflection + emission * emission_intensity * (1.0 - fresnel);
}

/// Calculate the view-dependent Fresnel for emission gating.
/// Standalone helper for use in fragment shaders.
fn obsidian_view_fresnel(normal: vec3<f32>, view_dir: vec3<f32>, ior: f32) -> f32 {
    let n_dot_v = max(dot(normal, view_dir), 0.0);
    let f0 = obsidian_f0_from_ior(ior);
    return obsidian_fresnel_schlick(n_dot_v, f0);
}
