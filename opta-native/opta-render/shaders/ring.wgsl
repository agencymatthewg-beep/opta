// Opta Ring shader.
//
// Renders the glass torus ring with fresnel effect, internal plasma,
// and state-based energy bloom.
//
// Dependencies:
//   #include "math.wgsl"
//   #include "noise.wgsl"
//   #include "glass.wgsl"
//   #include "color.wgsl"

#include "math.wgsl"
#include "noise.wgsl"
#include "glass.wgsl"
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
    /// Index of refraction for glass effect.
    ior: f32,
    /// Padding for alignment.
    _padding: f32,
    /// Glass tint color (RGB).
    tint_color: vec3<f32>,
    /// Additional padding.
    _padding2: f32,
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
    // In a full implementation, camera position would be passed as uniform
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
fn plasma_color(intensity: f32, energy: f32) -> vec3<f32> {
    // Base plasma colors shift from blue to purple to pink based on energy
    let low_color = vec3<f32>(0.2, 0.4, 1.0);   // Cool blue
    let mid_color = vec3<f32>(0.6, 0.3, 1.0);   // Purple
    let high_color = vec3<f32>(1.0, 0.4, 0.8);  // Hot pink
    
    // Blend based on energy level
    var color: vec3<f32>;
    if energy < 0.5 {
        color = mix(low_color, mid_color, energy * 2.0);
    } else {
        color = mix(mid_color, high_color, (energy - 0.5) * 2.0);
    }
    
    // Apply intensity
    return color * intensity * (1.0 + energy * 0.5);
}

// =============================================================================
// Rim Lighting
// =============================================================================

/// Calculate rim lighting contribution.
fn rim_light(normal: vec3<f32>, view_dir: vec3<f32>, power: f32, intensity: f32) -> f32 {
    let ndotv = max(dot(normal, view_dir), 0.0);
    let rim = pow(1.0 - ndotv, power);
    return rim * intensity;
}

// =============================================================================
// Energy Bloom
// =============================================================================

/// Calculate energy bloom effect for explosion state.
fn energy_bloom(uv: vec2<f32>, energy: f32, t: f32) -> vec3<f32> {
    // Only active at high energy levels
    if energy < 0.8 {
        return vec3<f32>(0.0);
    }
    
    // Pulsing bloom intensity
    let bloom_intensity = (energy - 0.8) * 5.0;  // Scale 0.8-1.0 to 0-1
    let pulse = 0.5 + 0.5 * sin(t * 10.0);
    
    // Radial gradient from UV center
    let center_dist = length(uv - vec2<f32>(0.5));
    let radial = 1.0 - saturate(center_dist * 2.0);
    
    // Bloom color (white-hot center, colored edges)
    let white = vec3<f32>(1.0, 1.0, 1.0);
    let hot_color = vec3<f32>(1.0, 0.6, 0.3);  // Orange-white
    let bloom_color = mix(hot_color, white, radial);
    
    return bloom_color * bloom_intensity * pulse * radial;
}

// =============================================================================
// Fragment Shader
// =============================================================================

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    let normal = normalize(in.world_normal);
    let view_dir = normalize(in.view_dir);
    
    // ==========================================================================
    // Fresnel Effect (edge glow)
    // ==========================================================================
    let cos_theta = max(dot(normal, view_dir), 0.0);
    let f0 = pow((1.0 - uniforms.ior) / (1.0 + uniforms.ior), 2.0);
    let fresnel = fresnel_schlick(cos_theta, f0);
    
    // Enhanced edge glow using fresnel power
    let edge_glow = pow(1.0 - cos_theta, uniforms.fresnel_power);
    
    // ==========================================================================
    // Glass Tint
    // ==========================================================================
    let base_tint = uniforms.tint_color;
    
    // Modulate tint by energy level (more saturated at higher energy)
    let energy_boost = 1.0 + uniforms.energy_level * 0.5;
    let tint = base_tint * energy_boost;
    
    // ==========================================================================
    // Internal Plasma
    // ==========================================================================
    var plasma_contrib = vec3<f32>(0.0);
    if uniforms.plasma_intensity > 0.001 {
        let plasma_value = internal_plasma(in.world_position, in.uv, uniforms.time);
        let plasma_col = plasma_color(plasma_value, uniforms.energy_level);
        plasma_contrib = plasma_col * uniforms.plasma_intensity;
        
        // Plasma is more visible in the center of the tube (less at edges)
        plasma_contrib *= (1.0 - edge_glow * 0.5);
    }
    
    // ==========================================================================
    // Rim Lighting
    // ==========================================================================
    let rim = rim_light(normal, view_dir, 2.0, uniforms.energy_level);
    let rim_color = uniforms.tint_color * rim * 1.5;
    
    // ==========================================================================
    // Energy Bloom (for explosion state)
    // ==========================================================================
    let bloom = energy_bloom(in.uv, uniforms.energy_level, uniforms.time);
    
    // ==========================================================================
    // Combine All Effects
    // ==========================================================================
    
    // Base glass color (tint modulated by fresnel)
    var color = tint * (0.3 + fresnel * 0.4);
    
    // Add edge glow
    let glow_color = uniforms.tint_color * (1.0 + uniforms.energy_level);
    color += glow_color * edge_glow * 0.6;
    
    // Add internal plasma
    color += plasma_contrib;
    
    // Add rim lighting
    color += rim_color;
    
    // Add energy bloom
    color += bloom;
    
    // ==========================================================================
    // Alpha Calculation
    // ==========================================================================
    
    // Glass transparency based on viewing angle
    // More transparent when looking straight on, more opaque at edges
    let base_alpha = 0.4;
    let edge_alpha = edge_glow * 0.4;
    let plasma_alpha = uniforms.plasma_intensity * 0.3;
    let energy_alpha = uniforms.energy_level * 0.2;
    
    let alpha = saturate(base_alpha + edge_alpha + plasma_alpha + energy_alpha);
    
    // Apply tone mapping for HDR values
    color = tonemap_aces(color);
    
    return vec4<f32>(color, alpha);
}

// =============================================================================
// Alternative Entry Points
// =============================================================================

/// High-quality version with more plasma detail.
@fragment
fn fs_main_hq(in: VertexOutput) -> @location(0) vec4<f32> {
    let normal = normalize(in.world_normal);
    let view_dir = normalize(in.view_dir);
    
    // Fresnel
    let cos_theta = max(dot(normal, view_dir), 0.0);
    let f0 = pow((1.0 - uniforms.ior) / (1.0 + uniforms.ior), 2.0);
    let fresnel = fresnel_schlick(cos_theta, f0);
    let edge_glow = pow(1.0 - cos_theta, uniforms.fresnel_power);
    
    // Glass tint
    let energy_boost = 1.0 + uniforms.energy_level * 0.5;
    let tint = uniforms.tint_color * energy_boost;
    
    // Enhanced plasma with more octaves
    var plasma_contrib = vec3<f32>(0.0);
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
        plasma_contrib = plasma_col * uniforms.plasma_intensity * (1.0 - edge_glow * 0.5);
    }
    
    // Rim and bloom
    let rim = rim_light(normal, view_dir, 2.0, uniforms.energy_level);
    let rim_color = uniforms.tint_color * rim * 1.5;
    let bloom = energy_bloom(in.uv, uniforms.energy_level, uniforms.time);
    
    // Combine
    var color = tint * (0.3 + fresnel * 0.4);
    let glow_color = uniforms.tint_color * (1.0 + uniforms.energy_level);
    color += glow_color * edge_glow * 0.6;
    color += plasma_contrib;
    color += rim_color;
    color += bloom;
    
    let base_alpha = 0.4;
    let edge_alpha = edge_glow * 0.4;
    let plasma_alpha = uniforms.plasma_intensity * 0.3;
    let energy_alpha = uniforms.energy_level * 0.2;
    let alpha = saturate(base_alpha + edge_alpha + plasma_alpha + energy_alpha);
    
    color = tonemap_aces(color);
    
    return vec4<f32>(color, alpha);
}

/// Low-quality version for power saving.
@fragment
fn fs_main_lq(in: VertexOutput) -> @location(0) vec4<f32> {
    let normal = normalize(in.world_normal);
    let view_dir = normalize(in.view_dir);
    
    // Simple fresnel
    let cos_theta = max(dot(normal, view_dir), 0.0);
    let edge_glow = pow(1.0 - cos_theta, 3.0);
    
    // Simple tint
    let tint = uniforms.tint_color * (1.0 + uniforms.energy_level * 0.3);
    
    // Combine without plasma
    var color = tint * (0.4 + edge_glow * 0.4);
    
    // Simple rim
    color += uniforms.tint_color * edge_glow * uniforms.energy_level * 0.5;
    
    let alpha = saturate(0.5 + edge_glow * 0.3);
    
    return vec4<f32>(color, alpha);
}
