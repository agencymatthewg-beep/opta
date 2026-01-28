// HD Glass material with Cook-Torrance BRDF.
//
// Include with: #include "glass_hd.wgsl"
//
// Dependencies: #include "math.wgsl"
//
// Provides:
// - Cook-Torrance specular BRDF
// - Advanced Fresnel calculations (Schlick, Full, Multi-scatter)
// - Physically-based glass rendering
// - Subsurface scattering approximation
// - Dispersion (chromatic aberration) for prismatic effects

// =============================================================================
// Cook-Torrance BRDF Components
// =============================================================================

/// GGX/Trowbridge-Reitz Normal Distribution Function (NDF).
/// Models how microfacets are distributed across the surface.
/// @param n_dot_h Dot product of normal and half-vector.
/// @param roughness Surface roughness (0 = mirror, 1 = diffuse).
fn distribution_ggx(n_dot_h: f32, roughness: f32) -> f32 {
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
fn geometry_schlick_ggx(n_dot_v: f32, roughness: f32) -> f32 {
    let r = roughness + 1.0;
    let k = (r * r) / 8.0;

    let nom = n_dot_v;
    let denom = n_dot_v * (1.0 - k) + k;

    return nom / max(denom, 0.0001);
}

/// Smith's Geometry Function (bidirectional shadowing-masking).
/// Combines view and light direction geometry terms.
fn geometry_smith(n_dot_v: f32, n_dot_l: f32, roughness: f32) -> f32 {
    let ggx_v = geometry_schlick_ggx(n_dot_v, roughness);
    let ggx_l = geometry_schlick_ggx(n_dot_l, roughness);
    return ggx_v * ggx_l;
}

// =============================================================================
// Advanced Fresnel Functions
// =============================================================================

/// Schlick's approximation with roughness correction.
/// More accurate for rough surfaces.
fn fresnel_schlick_roughness(cos_theta: f32, f0: vec3<f32>, roughness: f32) -> vec3<f32> {
    let one_minus_rough = saturate3(vec3<f32>(1.0 - roughness));
    return f0 + (max(one_minus_rough, f0) - f0) * pow(saturate(1.0 - cos_theta), 5.0);
}

/// Multi-scatter Fresnel approximation.
/// Accounts for energy lost in multiple bounces.
fn fresnel_multi_scatter(cos_theta: f32, f0: vec3<f32>, roughness: f32) -> vec3<f32> {
    let single_scatter = fresnel_schlick_roughness(cos_theta, f0, roughness);

    // Energy compensation factor
    let f_avg = f0 + (vec3<f32>(1.0) - f0) * (1.0 / 21.0);
    let f_ms = single_scatter * f_avg / (vec3<f32>(1.0) - f_avg * (1.0 - single_scatter));

    return single_scatter + f_ms * (1.0 - single_scatter);
}

/// Full Fresnel equations for dielectric (glass) with spectral IOR.
/// Provides per-channel IOR for dispersion effects.
fn fresnel_dielectric_spectral(cos_theta_i: f32, n1: f32, n2_rgb: vec3<f32>) -> vec3<f32> {
    var result: vec3<f32>;

    // Calculate fresnel for each color channel
    for (var i = 0; i < 3; i = i + 1) {
        let n2 = n2_rgb[i];
        let eta = n1 / n2;
        let sin_theta_t_sq = eta * eta * (1.0 - cos_theta_i * cos_theta_i);

        if sin_theta_t_sq >= 1.0 {
            result[i] = 1.0; // Total internal reflection
        } else {
            let cos_theta_t = sqrt(1.0 - sin_theta_t_sq);
            let rs = (n1 * cos_theta_i - n2 * cos_theta_t) / (n1 * cos_theta_i + n2 * cos_theta_t);
            let rp = (n2 * cos_theta_i - n1 * cos_theta_t) / (n2 * cos_theta_i + n1 * cos_theta_t);
            result[i] = 0.5 * (rs * rs + rp * rp);
        }
    }

    return result;
}

// =============================================================================
// Cook-Torrance BRDF
// =============================================================================

/// Full Cook-Torrance specular BRDF.
/// @param normal Surface normal.
/// @param view_dir Direction to viewer (normalized).
/// @param light_dir Direction to light (normalized).
/// @param roughness Surface roughness [0,1].
/// @param f0 Base reflectivity (metalness dependent).
fn cook_torrance_specular(
    normal: vec3<f32>,
    view_dir: vec3<f32>,
    light_dir: vec3<f32>,
    roughness: f32,
    f0: vec3<f32>
) -> vec3<f32> {
    let half_vec = normalize(view_dir + light_dir);

    let n_dot_h = max(dot(normal, half_vec), 0.0);
    let n_dot_v = max(dot(normal, view_dir), 0.0);
    let n_dot_l = max(dot(normal, light_dir), 0.0);
    let v_dot_h = max(dot(view_dir, half_vec), 0.0);

    // Fresnel
    let f = fresnel_schlick_roughness(v_dot_h, f0, roughness);

    // Normal Distribution Function
    let d = distribution_ggx(n_dot_h, roughness);

    // Geometry Function
    let g = geometry_smith(n_dot_v, n_dot_l, roughness);

    // Cook-Torrance BRDF
    let numerator = d * g * f;
    let denominator = 4.0 * n_dot_v * n_dot_l + 0.0001;

    return numerator / denominator;
}

// =============================================================================
// HD Glass Material
// =============================================================================

/// HD Glass material parameters with physically-based properties.
struct HDGlassMaterial {
    /// Index of refraction (1.5 for crown glass, 1.7 for flint glass).
    ior: f32,
    /// Surface roughness [0,1] (0 = perfect mirror, 0.05 = typical glass).
    roughness: f32,
    /// Tint color (absorption per unit distance).
    tint: vec3<f32>,
    /// Dispersion amount (Abbe number inverse, 0.02 typical).
    dispersion: f32,
    /// Subsurface density (for frosted glass effect).
    subsurface: f32,
}

/// Create default HD glass material.
fn hd_glass_default() -> HDGlassMaterial {
    return HDGlassMaterial(
        1.5,                        // Crown glass IOR
        0.02,                       // Very smooth
        vec3<f32>(1.0, 1.0, 1.0),   // No tint
        0.0,                        // No dispersion
        0.0                         // No subsurface
    );
}

/// Create Opta ring HD glass material.
fn hd_glass_opta_ring() -> HDGlassMaterial {
    return HDGlassMaterial(
        1.52,                       // Slightly higher IOR for premium look
        0.015,                      // Ultra smooth
        vec3<f32>(0.4, 0.6, 1.0),   // Opta blue tint
        0.01,                       // Subtle dispersion
        0.0                         // No subsurface
    );
}

/// Get spectral IOR for dispersion (chromatic aberration).
/// Returns different IOR for R, G, B channels.
fn spectral_ior(base_ior: f32, dispersion: f32) -> vec3<f32> {
    // Cauchy equation approximation: n(lambda) = A + B/lambda^2
    // Red has longer wavelength (lower IOR), Blue has shorter (higher IOR)
    return vec3<f32>(
        base_ior - dispersion * 0.5,  // Red (650nm)
        base_ior,                      // Green (550nm)
        base_ior + dispersion * 0.5   // Blue (450nm)
    );
}

// =============================================================================
// HD Glass Shading Functions
// =============================================================================

/// Calculate F0 (base reflectivity) from IOR.
fn f0_from_ior(ior: f32) -> f32 {
    let r = (1.0 - ior) / (1.0 + ior);
    return r * r;
}

/// Calculate tinted F0 for colored glass.
fn f0_tinted(base_f0: f32, tint: vec3<f32>) -> vec3<f32> {
    return vec3<f32>(base_f0) * tint;
}

/// Full HD glass shading.
/// @param normal Surface normal (world space).
/// @param view_dir Direction to camera (normalized).
/// @param light_dir Direction to light (normalized, if any).
/// @param material HD glass material properties.
/// @param env_reflection Environment reflection color.
/// @param transmission Background/refracted color.
fn hd_glass_shade(
    normal: vec3<f32>,
    view_dir: vec3<f32>,
    light_dir: vec3<f32>,
    material: HDGlassMaterial,
    env_reflection: vec3<f32>,
    transmission: vec3<f32>
) -> vec4<f32> {
    let n_dot_v = max(dot(normal, view_dir), 0.0);

    // Calculate base reflectivity
    let base_f0 = f0_from_ior(material.ior);
    let f0 = f0_tinted(base_f0, material.tint);

    // Multi-scatter Fresnel
    let fresnel = fresnel_multi_scatter(n_dot_v, f0, material.roughness);

    // Cook-Torrance specular for direct lighting
    var specular = vec3<f32>(0.0);
    if length(light_dir) > 0.1 {
        specular = cook_torrance_specular(normal, view_dir, light_dir, material.roughness, f0);
    }

    // Blend reflection and transmission based on fresnel
    let reflection_contrib = env_reflection * fresnel;
    let transmission_contrib = transmission * (vec3<f32>(1.0) - fresnel) * material.tint;

    var color = reflection_contrib + transmission_contrib + specular;

    // Calculate alpha (more opaque at glancing angles due to fresnel)
    let base_alpha = 0.3; // Base glass transparency
    let fresnel_alpha = (fresnel.r + fresnel.g + fresnel.b) / 3.0 * 0.7;
    let alpha = saturate(base_alpha + fresnel_alpha);

    return vec4<f32>(color, alpha);
}

/// Simplified HD glass shading for the Opta ring.
/// Optimized version without separate light direction.
fn hd_glass_ring_shade(
    normal: vec3<f32>,
    view_dir: vec3<f32>,
    material: HDGlassMaterial,
    energy_level: f32
) -> vec4<f32> {
    let n_dot_v = max(dot(normal, view_dir), 0.0);

    // Edge glow calculation
    let edge_factor = 1.0 - n_dot_v;
    let edge_glow = pow(edge_factor, 3.0);

    // Base reflectivity with energy boost
    let base_f0 = f0_from_ior(material.ior);
    let energy_boost = 1.0 + energy_level * 0.5;
    let f0 = f0_tinted(base_f0 * energy_boost, material.tint);

    // Fresnel calculation
    let fresnel = fresnel_multi_scatter(n_dot_v, f0, material.roughness);

    // Base glass color
    var color = material.tint * (0.3 + (fresnel.r + fresnel.g + fresnel.b) / 3.0 * 0.4);

    // Add edge glow
    let glow_color = material.tint * (1.0 + energy_level);
    color = color + glow_color * edge_glow * 0.6;

    // Calculate alpha
    let base_alpha = 0.4;
    let edge_alpha = edge_glow * 0.4;
    let energy_alpha = energy_level * 0.2;
    let alpha = saturate(base_alpha + edge_alpha + energy_alpha);

    return vec4<f32>(color, alpha);
}

// =============================================================================
// Dispersion / Chromatic Aberration
// =============================================================================

/// Calculate refracted directions for RGB channels (dispersion).
/// Used for prismatic/rainbow effects at glass edges.
fn dispersion_refract(
    incident: vec3<f32>,
    normal: vec3<f32>,
    base_ior: f32,
    dispersion: f32
) -> vec3<vec3<f32>> {
    let spectral = spectral_ior(base_ior, dispersion);

    var refracted: vec3<vec3<f32>>;

    // Red channel
    let eta_r = 1.0 / spectral.x;
    let cos_i = -dot(incident, normal);
    let sin_t2_r = eta_r * eta_r * (1.0 - cos_i * cos_i);
    if sin_t2_r <= 1.0 {
        refracted[0] = eta_r * incident + (eta_r * cos_i - sqrt(1.0 - sin_t2_r)) * normal;
    } else {
        refracted[0] = reflect(incident, normal);
    }

    // Green channel
    let eta_g = 1.0 / spectral.y;
    let sin_t2_g = eta_g * eta_g * (1.0 - cos_i * cos_i);
    if sin_t2_g <= 1.0 {
        refracted[1] = eta_g * incident + (eta_g * cos_i - sqrt(1.0 - sin_t2_g)) * normal;
    } else {
        refracted[1] = reflect(incident, normal);
    }

    // Blue channel
    let eta_b = 1.0 / spectral.z;
    let sin_t2_b = eta_b * eta_b * (1.0 - cos_i * cos_i);
    if sin_t2_b <= 1.0 {
        refracted[2] = eta_b * incident + (eta_b * cos_i - sqrt(1.0 - sin_t2_b)) * normal;
    } else {
        refracted[2] = reflect(incident, normal);
    }

    return refracted;
}

/// Calculate dispersion offset for UV-based effects.
/// Returns UV offset per color channel.
fn dispersion_uv_offset(
    uv: vec2<f32>,
    center: vec2<f32>,
    edge_factor: f32,
    dispersion: f32
) -> vec3<vec2<f32>> {
    let dir = uv - center;
    let strength = dispersion * edge_factor * edge_factor;

    return vec3<vec2<f32>>(
        center + dir * (1.0 + strength),      // Red (spread outward)
        center + dir,                          // Green (no offset)
        center + dir * (1.0 - strength)        // Blue (pull inward)
    );
}

// =============================================================================
// Subsurface Scattering Approximation
// =============================================================================

/// Simplified subsurface scattering for frosted glass.
/// @param normal Surface normal.
/// @param view_dir View direction.
/// @param light_dir Light direction.
/// @param thickness Estimated material thickness.
/// @param subsurface_color Tint color for scattered light.
fn subsurface_scatter(
    normal: vec3<f32>,
    view_dir: vec3<f32>,
    light_dir: vec3<f32>,
    thickness: f32,
    subsurface_color: vec3<f32>
) -> vec3<f32> {
    // Wrap lighting for soft diffuse
    let n_dot_l = dot(normal, light_dir);
    let wrap = 0.5;
    let wrap_diffuse = saturate((n_dot_l + wrap) / (1.0 + wrap));

    // View-dependent transmission
    let v_dot_l = max(dot(view_dir, -light_dir), 0.0);
    let back_scatter = pow(v_dot_l, 4.0) * thickness;

    // Forward scatter approximation
    let forward_scatter = wrap_diffuse * thickness * 0.5;

    return subsurface_color * (forward_scatter + back_scatter);
}
