// Glass material with fresnel effect.
//
// Include with: #include "glass.wgsl"
//
// Provides:
// - Fresnel calculations
// - Glass-like refraction and reflection blending
// - Chromatic aberration helpers

// =============================================================================
// Fresnel Functions
// =============================================================================

/// Schlick's approximation for Fresnel reflectance.
/// @param cos_theta Cosine of angle between view and normal.
/// @param f0 Reflectance at normal incidence (typically 0.04 for glass).
fn fresnel_schlick(cos_theta: f32, f0: f32) -> f32 {
    return f0 + (1.0 - f0) * pow(1.0 - cos_theta, 5.0);
}

/// Schlick's approximation for colored Fresnel.
fn fresnel_schlick_3(cos_theta: f32, f0: vec3<f32>) -> vec3<f32> {
    return f0 + (vec3<f32>(1.0) - f0) * pow(1.0 - cos_theta, 5.0);
}

/// Full Fresnel equation for dielectrics.
/// @param cos_theta_i Cosine of incident angle.
/// @param n1 Refractive index of first medium (typically 1.0 for air).
/// @param n2 Refractive index of second medium (1.5 for glass).
fn fresnel_dielectric(cos_theta_i: f32, n1: f32, n2: f32) -> f32 {
    let eta = n1 / n2;
    let sin_theta_t_sq = eta * eta * (1.0 - cos_theta_i * cos_theta_i);
    
    if sin_theta_t_sq >= 1.0 {
        // Total internal reflection
        return 1.0;
    }
    
    let cos_theta_t = sqrt(1.0 - sin_theta_t_sq);
    
    let rs = (n1 * cos_theta_i - n2 * cos_theta_t) / (n1 * cos_theta_i + n2 * cos_theta_t);
    let rp = (n2 * cos_theta_i - n1 * cos_theta_t) / (n2 * cos_theta_i + n1 * cos_theta_t);
    
    return 0.5 * (rs * rs + rp * rp);
}

// =============================================================================
// Glass Material
// =============================================================================

/// Glass material parameters.
struct GlassMaterial {
    /// Index of refraction (1.5 for typical glass).
    ior: f32,
    /// Tint color for the glass.
    tint: vec3<f32>,
    /// Absorption coefficient (for colored glass).
    absorption: vec3<f32>,
}

/// Default glass material.
fn glass_default() -> GlassMaterial {
    return GlassMaterial(
        1.5,                    // IOR for crown glass
        vec3<f32>(1.0),         // No tint
        vec3<f32>(0.0)          // No absorption
    );
}

/// Calculate refracted ray direction.
/// Returns zero vector if total internal reflection occurs.
fn refract_ray(incident: vec3<f32>, normal: vec3<f32>, eta: f32) -> vec3<f32> {
    let cos_i = -dot(incident, normal);
    let sin_t2 = eta * eta * (1.0 - cos_i * cos_i);
    
    if sin_t2 > 1.0 {
        return vec3<f32>(0.0); // TIR
    }
    
    return eta * incident + (eta * cos_i - sqrt(1.0 - sin_t2)) * normal;
}

/// Calculate reflected ray direction.
fn reflect_ray(incident: vec3<f32>, normal: vec3<f32>) -> vec3<f32> {
    return incident - 2.0 * dot(incident, normal) * normal;
}

// =============================================================================
// Chromatic Aberration
// =============================================================================

/// Apply chromatic aberration offset to UV coordinates.
/// @param uv Original UV coordinates.
/// @param center Center point for radial distortion.
/// @param strength Aberration strength.
fn chromatic_aberration_uv(uv: vec2<f32>, center: vec2<f32>, strength: f32) -> vec3<vec2<f32>> {
    let dir = uv - center;
    let dist = length(dir);
    
    let r_offset = dir * (1.0 + strength * dist);
    let g_offset = dir;
    let b_offset = dir * (1.0 - strength * dist);
    
    return vec3<vec2<f32>>(
        center + r_offset,
        center + g_offset,
        center + b_offset
    );
}

// =============================================================================
// Glass Effects
// =============================================================================

/// Calculate glass effect intensity based on viewing angle.
fn glass_intensity(view_dir: vec3<f32>, normal: vec3<f32>, ior: f32) -> f32 {
    let cos_theta = max(dot(view_dir, normal), 0.0);
    let f0 = pow((1.0 - ior) / (1.0 + ior), 2.0);
    return fresnel_schlick(cos_theta, f0);
}

/// Blend reflection and refraction based on Fresnel.
fn glass_blend(
    reflection: vec3<f32>,
    refraction: vec3<f32>,
    fresnel: f32
) -> vec3<f32> {
    return mix(refraction, reflection, fresnel);
}
