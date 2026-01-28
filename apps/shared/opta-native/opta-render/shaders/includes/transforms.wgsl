// Transform utilities for WGSL shaders.
//
// Include with: #include "transforms.wgsl"
//
// Provides:
// - 2D rotation matrices
// - 3D rotation matrices (around X, Y, Z axes)
// - Scale and translation helpers
// - View/projection utilities

// =============================================================================
// 2D Transforms
// =============================================================================

/// Create a 2D rotation matrix.
///
/// @param angle Rotation angle in radians.
/// @returns 2x2 rotation matrix.
fn rotate2d(angle: f32) -> mat2x2<f32> {
    let c = cos(angle);
    let s = sin(angle);
    return mat2x2<f32>(c, -s, s, c);
}

/// Apply 2D rotation to a vector.
fn rotate2d_vec(v: vec2<f32>, angle: f32) -> vec2<f32> {
    let c = cos(angle);
    let s = sin(angle);
    return vec2<f32>(v.x * c - v.y * s, v.x * s + v.y * c);
}

/// Create a 2D scale matrix.
fn scale2d(sx: f32, sy: f32) -> mat2x2<f32> {
    return mat2x2<f32>(sx, 0.0, 0.0, sy);
}

/// Create a uniform 2D scale matrix.
fn scale2d_uniform(s: f32) -> mat2x2<f32> {
    return mat2x2<f32>(s, 0.0, 0.0, s);
}

// =============================================================================
// 3D Rotation Matrices
// =============================================================================

/// Create a 3D rotation matrix around the X axis.
///
/// @param angle Rotation angle in radians.
/// @returns 3x3 rotation matrix.
fn rotate3d_x(angle: f32) -> mat3x3<f32> {
    let c = cos(angle);
    let s = sin(angle);
    return mat3x3<f32>(
        1.0, 0.0, 0.0,
        0.0, c, -s,
        0.0, s, c
    );
}

/// Create a 3D rotation matrix around the Y axis.
///
/// @param angle Rotation angle in radians.
/// @returns 3x3 rotation matrix.
fn rotate3d_y(angle: f32) -> mat3x3<f32> {
    let c = cos(angle);
    let s = sin(angle);
    return mat3x3<f32>(
        c, 0.0, s,
        0.0, 1.0, 0.0,
        -s, 0.0, c
    );
}

/// Create a 3D rotation matrix around the Z axis.
///
/// @param angle Rotation angle in radians.
/// @returns 3x3 rotation matrix.
fn rotate3d_z(angle: f32) -> mat3x3<f32> {
    let c = cos(angle);
    let s = sin(angle);
    return mat3x3<f32>(
        c, -s, 0.0,
        s, c, 0.0,
        0.0, 0.0, 1.0
    );
}

/// Create a 3D rotation matrix from Euler angles (XYZ order).
///
/// @param euler Euler angles (pitch, yaw, roll) in radians.
/// @returns 3x3 rotation matrix.
fn rotate3d_euler(euler: vec3<f32>) -> mat3x3<f32> {
    let rx = rotate3d_x(euler.x);
    let ry = rotate3d_y(euler.y);
    let rz = rotate3d_z(euler.z);
    return rz * ry * rx;
}

/// Create a 3D rotation matrix around an arbitrary axis.
///
/// @param axis Normalized rotation axis.
/// @param angle Rotation angle in radians.
/// @returns 3x3 rotation matrix.
fn rotate3d_axis(axis: vec3<f32>, angle: f32) -> mat3x3<f32> {
    let c = cos(angle);
    let s = sin(angle);
    let t = 1.0 - c;

    let x = axis.x;
    let y = axis.y;
    let z = axis.z;

    return mat3x3<f32>(
        t * x * x + c,     t * x * y - s * z, t * x * z + s * y,
        t * x * y + s * z, t * y * y + c,     t * y * z - s * x,
        t * x * z - s * y, t * y * z + s * x, t * z * z + c
    );
}

// =============================================================================
// 3D Scale Matrices
// =============================================================================

/// Create a 3D scale matrix.
fn scale3d(sx: f32, sy: f32, sz: f32) -> mat3x3<f32> {
    return mat3x3<f32>(
        sx, 0.0, 0.0,
        0.0, sy, 0.0,
        0.0, 0.0, sz
    );
}

/// Create a uniform 3D scale matrix.
fn scale3d_uniform(s: f32) -> mat3x3<f32> {
    return mat3x3<f32>(
        s, 0.0, 0.0,
        0.0, s, 0.0,
        0.0, 0.0, s
    );
}

// =============================================================================
// 4x4 Transform Matrices
// =============================================================================

/// Create a 4x4 translation matrix.
fn translate4x4(translation: vec3<f32>) -> mat4x4<f32> {
    return mat4x4<f32>(
        1.0, 0.0, 0.0, 0.0,
        0.0, 1.0, 0.0, 0.0,
        0.0, 0.0, 1.0, 0.0,
        translation.x, translation.y, translation.z, 1.0
    );
}

/// Create a 4x4 scale matrix.
fn scale4x4(scale: vec3<f32>) -> mat4x4<f32> {
    return mat4x4<f32>(
        scale.x, 0.0, 0.0, 0.0,
        0.0, scale.y, 0.0, 0.0,
        0.0, 0.0, scale.z, 0.0,
        0.0, 0.0, 0.0, 1.0
    );
}

/// Create a 4x4 uniform scale matrix.
fn scale4x4_uniform(s: f32) -> mat4x4<f32> {
    return mat4x4<f32>(
        s, 0.0, 0.0, 0.0,
        0.0, s, 0.0, 0.0,
        0.0, 0.0, s, 0.0,
        0.0, 0.0, 0.0, 1.0
    );
}

/// Embed a 3x3 rotation matrix into a 4x4 matrix.
fn rotation_to_4x4(rot: mat3x3<f32>) -> mat4x4<f32> {
    return mat4x4<f32>(
        vec4<f32>(rot[0], 0.0),
        vec4<f32>(rot[1], 0.0),
        vec4<f32>(rot[2], 0.0),
        vec4<f32>(0.0, 0.0, 0.0, 1.0)
    );
}

// =============================================================================
// Projection Helpers
// =============================================================================

/// Convert from clip space to normalized device coordinates (NDC).
fn clip_to_ndc(clip: vec4<f32>) -> vec3<f32> {
    return clip.xyz / clip.w;
}

/// Convert from NDC to screen coordinates.
fn ndc_to_screen(ndc: vec3<f32>, viewport: vec2<f32>) -> vec2<f32> {
    return (ndc.xy * 0.5 + 0.5) * viewport;
}

/// Convert from screen coordinates to NDC.
fn screen_to_ndc(screen: vec2<f32>, viewport: vec2<f32>) -> vec2<f32> {
    return (screen / viewport) * 2.0 - 1.0;
}
