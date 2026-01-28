// GPU-instanced particle shader for Opta.
//
// Features:
// - Billboard quads that always face the camera
// - Soft circle rendering with glow effect
// - Per-particle color and size
// - Efficient instanced rendering

// Camera uniforms for view transformation.
struct CameraUniforms {
    // Combined view-projection matrix.
    view_proj: mat4x4<f32>,
    // View matrix (for extracting camera vectors).
    view: mat4x4<f32>,
    // Projection matrix.
    proj: mat4x4<f32>,
}

@group(0) @binding(0) var<uniform> camera: CameraUniforms;

// Per-particle instance data.
// This matches the Particle struct in Rust (Pod/Zeroable).
struct ParticleInput {
    // Quad vertex position (local space, xy from -0.5 to 0.5).
    @location(0) quad_pos: vec2<f32>,
    // World-space particle position (instanced).
    @location(1) position: vec3<f32>,
    // Remaining lifetime.
    @location(2) life: f32,
    // Velocity vector.
    @location(3) velocity: vec3<f32>,
    // Particle size (radius).
    @location(4) size: f32,
    // RGBA color.
    @location(5) color: vec4<f32>,
}

struct VertexOutput {
    @builtin(position) clip_position: vec4<f32>,
    // UV coordinates for the quad (0-1 range).
    @location(0) uv: vec2<f32>,
    // Particle color for fragment shader.
    @location(1) color: vec4<f32>,
    // Life ratio for effects (0 = dead, 1 = full life).
    @location(2) life: f32,
}

@vertex
fn vs_main(in: ParticleInput) -> VertexOutput {
    var out: VertexOutput;

    // Extract camera right and up vectors from view matrix.
    // View matrix columns are: right, up, forward (negated), position.
    // We need the inverse (transpose for rotation part), so:
    // camera_right = view[0].xyz (first column)
    // camera_up = view[1].xyz (second column)
    let camera_right = vec3<f32>(camera.view[0][0], camera.view[1][0], camera.view[2][0]);
    let camera_up = vec3<f32>(camera.view[0][1], camera.view[1][1], camera.view[2][1]);

    // Billboard the quad: offset from particle center using camera vectors.
    // quad_pos is in range [-0.5, 0.5], scale by particle size.
    let world_offset = (camera_right * in.quad_pos.x + camera_up * in.quad_pos.y) * in.size;
    let world_position = in.position + world_offset;

    // Transform to clip space.
    out.clip_position = camera.view_proj * vec4<f32>(world_position, 1.0);

    // UV coordinates: shift from [-0.5, 0.5] to [0, 1].
    out.uv = in.quad_pos + vec2<f32>(0.5);

    // Pass through color and life.
    out.color = in.color;
    out.life = in.life;

    return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    // Calculate distance from center of quad (UV space, center at 0.5, 0.5).
    let center = vec2<f32>(0.5, 0.5);
    let dist = distance(in.uv, center) * 2.0; // Normalize to 0-1 range

    // Soft circle: smooth falloff from center.
    // Core (dist < 0.3): full opacity.
    // Edge (0.3 < dist < 1.0): gradual fade.
    // Outside (dist > 1.0): transparent.
    let core_radius = 0.3;
    let edge_softness = 0.7; // How soft the edge is

    // Soft circle alpha.
    let circle_alpha = 1.0 - smoothstep(core_radius, core_radius + edge_softness, dist);

    // Glow effect: additive brightness near center.
    let glow_intensity = 0.5;
    let glow = exp(-dist * dist * 4.0) * glow_intensity;

    // Combine base color with glow.
    var final_color = in.color.rgb + vec3<f32>(glow);

    // Apply circle alpha and particle alpha.
    let final_alpha = circle_alpha * in.color.a;

    // Discard fully transparent pixels for performance.
    if (final_alpha < 0.01) {
        discard;
    }

    return vec4<f32>(final_color, final_alpha);
}
