// HD Noise functions for premium visual effects.
//
// Include with: #include "noise_hd.wgsl"
//
// Dependencies: #include "math.wgsl"
//
// Provides:
// - 3D Perlin noise with analytic derivatives
// - 3D Simplex noise
// - Domain warping functions
// - Turbulence with octave control
// - Curl noise for fluid-like motion
// - Volumetric noise for plasma effects

// =============================================================================
// 3D Hash Functions
// =============================================================================

/// Hash function: vec3 -> vec3
/// Returns pseudo-random vec3 in [0, 1] for each component.
fn hash33(p: vec3<f32>) -> vec3<f32> {
    var q = fract(p * vec3<f32>(0.1031, 0.1030, 0.0973));
    q = q + dot(q, q.yxz + 33.33);
    return fract((q.xxy + q.yxx) * q.zyx);
}

/// Hash function: vec3 -> f32
fn hash31_hd(p: vec3<f32>) -> f32 {
    var p3 = fract(p * 0.1031);
    p3 = p3 + dot(p3, p3.zyx + 31.32);
    return fract((p3.x + p3.y) * p3.z);
}

/// Hash for gradient generation (3D)
fn hash_grad3(p: vec3<f32>) -> vec3<f32> {
    let h = hash33(p);
    return normalize(h * 2.0 - 1.0);
}

// =============================================================================
// 3D Perlin Noise with Analytic Derivatives
// =============================================================================

/// 3D Perlin noise with quintic interpolation.
/// Returns value in approximately [-1, 1].
fn perlin_noise_3d(p: vec3<f32>) -> f32 {
    let i = floor(p);
    let f = fract(p);

    // Quintic interpolation
    let u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);

    // Gradients at 8 corners
    let g000 = hash_grad3(i);
    let g100 = hash_grad3(i + vec3<f32>(1.0, 0.0, 0.0));
    let g010 = hash_grad3(i + vec3<f32>(0.0, 1.0, 0.0));
    let g110 = hash_grad3(i + vec3<f32>(1.0, 1.0, 0.0));
    let g001 = hash_grad3(i + vec3<f32>(0.0, 0.0, 1.0));
    let g101 = hash_grad3(i + vec3<f32>(1.0, 0.0, 1.0));
    let g011 = hash_grad3(i + vec3<f32>(0.0, 1.0, 1.0));
    let g111 = hash_grad3(i + vec3<f32>(1.0, 1.0, 1.0));

    // Distance vectors
    let d000 = f;
    let d100 = f - vec3<f32>(1.0, 0.0, 0.0);
    let d010 = f - vec3<f32>(0.0, 1.0, 0.0);
    let d110 = f - vec3<f32>(1.0, 1.0, 0.0);
    let d001 = f - vec3<f32>(0.0, 0.0, 1.0);
    let d101 = f - vec3<f32>(1.0, 0.0, 1.0);
    let d011 = f - vec3<f32>(0.0, 1.0, 1.0);
    let d111 = f - vec3<f32>(1.0, 1.0, 1.0);

    // Dot products
    let v000 = dot(g000, d000);
    let v100 = dot(g100, d100);
    let v010 = dot(g010, d010);
    let v110 = dot(g110, d110);
    let v001 = dot(g001, d001);
    let v101 = dot(g101, d101);
    let v011 = dot(g011, d011);
    let v111 = dot(g111, d111);

    // Trilinear interpolation
    let x00 = mix(v000, v100, u.x);
    let x10 = mix(v010, v110, u.x);
    let x01 = mix(v001, v101, u.x);
    let x11 = mix(v011, v111, u.x);

    let y0 = mix(x00, x10, u.y);
    let y1 = mix(x01, x11, u.y);

    return mix(y0, y1, u.z);
}

/// 3D Perlin noise with analytic derivatives.
/// Returns vec4(value, dx, dy, dz).
fn perlin_noise_3d_deriv(p: vec3<f32>) -> vec4<f32> {
    let i = floor(p);
    let f = fract(p);

    // Quintic interpolation and derivatives
    let u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
    let du = 30.0 * f * f * (f * (f - 2.0) + 1.0);

    // Gradients at 8 corners
    let g000 = hash_grad3(i);
    let g100 = hash_grad3(i + vec3<f32>(1.0, 0.0, 0.0));
    let g010 = hash_grad3(i + vec3<f32>(0.0, 1.0, 0.0));
    let g110 = hash_grad3(i + vec3<f32>(1.0, 1.0, 0.0));
    let g001 = hash_grad3(i + vec3<f32>(0.0, 0.0, 1.0));
    let g101 = hash_grad3(i + vec3<f32>(1.0, 0.0, 1.0));
    let g011 = hash_grad3(i + vec3<f32>(0.0, 1.0, 1.0));
    let g111 = hash_grad3(i + vec3<f32>(1.0, 1.0, 1.0));

    // Distance vectors
    let d000 = f;
    let d100 = f - vec3<f32>(1.0, 0.0, 0.0);
    let d010 = f - vec3<f32>(0.0, 1.0, 0.0);
    let d110 = f - vec3<f32>(1.0, 1.0, 0.0);
    let d001 = f - vec3<f32>(0.0, 0.0, 1.0);
    let d101 = f - vec3<f32>(1.0, 0.0, 1.0);
    let d011 = f - vec3<f32>(0.0, 1.0, 1.0);
    let d111 = f - vec3<f32>(1.0, 1.0, 1.0);

    // Dot products
    let v000 = dot(g000, d000);
    let v100 = dot(g100, d100);
    let v010 = dot(g010, d010);
    let v110 = dot(g110, d110);
    let v001 = dot(g001, d001);
    let v101 = dot(g101, d101);
    let v011 = dot(g011, d011);
    let v111 = dot(g111, d111);

    // Interpolation
    let k0 = v000;
    let k1 = v100 - v000;
    let k2 = v010 - v000;
    let k3 = v001 - v000;
    let k4 = v000 - v100 - v010 + v110;
    let k5 = v000 - v010 - v001 + v011;
    let k6 = v000 - v100 - v001 + v101;
    let k7 = -v000 + v100 + v010 - v110 + v001 - v101 - v011 + v111;

    let value = k0 + k1 * u.x + k2 * u.y + k3 * u.z +
                k4 * u.x * u.y + k5 * u.y * u.z + k6 * u.z * u.x +
                k7 * u.x * u.y * u.z;

    let deriv = vec3<f32>(
        du.x * (k1 + k4 * u.y + k6 * u.z + k7 * u.y * u.z),
        du.y * (k2 + k5 * u.z + k4 * u.x + k7 * u.z * u.x),
        du.z * (k3 + k6 * u.x + k5 * u.y + k7 * u.x * u.y)
    );

    return vec4<f32>(value, deriv);
}

// =============================================================================
// 3D Simplex Noise
// =============================================================================

/// Skew factors for 3D simplex noise
const SKEW_3D: f32 = 0.333333333;  // 1/3
const UNSKEW_3D: f32 = 0.166666667; // 1/6

/// 3D Simplex noise.
/// Returns value in approximately [-1, 1].
fn simplex_noise_3d(p: vec3<f32>) -> f32 {
    // Skew input space
    let s = (p.x + p.y + p.z) * SKEW_3D;
    let i = floor(p + s);

    // Unskew cell origin
    let t = (i.x + i.y + i.z) * UNSKEW_3D;
    let x0 = p - (i - t);

    // Determine simplex (6 possibilities in 3D)
    var i1: vec3<f32>;
    var i2: vec3<f32>;

    if x0.x >= x0.y {
        if x0.y >= x0.z {
            i1 = vec3<f32>(1.0, 0.0, 0.0);
            i2 = vec3<f32>(1.0, 1.0, 0.0);
        } else if x0.x >= x0.z {
            i1 = vec3<f32>(1.0, 0.0, 0.0);
            i2 = vec3<f32>(1.0, 0.0, 1.0);
        } else {
            i1 = vec3<f32>(0.0, 0.0, 1.0);
            i2 = vec3<f32>(1.0, 0.0, 1.0);
        }
    } else {
        if x0.y < x0.z {
            i1 = vec3<f32>(0.0, 0.0, 1.0);
            i2 = vec3<f32>(0.0, 1.0, 1.0);
        } else if x0.x < x0.z {
            i1 = vec3<f32>(0.0, 1.0, 0.0);
            i2 = vec3<f32>(0.0, 1.0, 1.0);
        } else {
            i1 = vec3<f32>(0.0, 1.0, 0.0);
            i2 = vec3<f32>(1.0, 1.0, 0.0);
        }
    }

    // Offsets for remaining corners
    let x1 = x0 - i1 + UNSKEW_3D;
    let x2 = x0 - i2 + 2.0 * UNSKEW_3D;
    let x3 = x0 - 1.0 + 3.0 * UNSKEW_3D;

    // Gradients
    let g0 = hash_grad3(i);
    let g1 = hash_grad3(i + i1);
    let g2 = hash_grad3(i + i2);
    let g3 = hash_grad3(i + 1.0);

    // Calculate contributions
    var n = 0.0;

    var t0 = 0.6 - dot(x0, x0);
    if t0 > 0.0 {
        t0 = t0 * t0;
        n = n + t0 * t0 * dot(g0, x0);
    }

    var t1 = 0.6 - dot(x1, x1);
    if t1 > 0.0 {
        t1 = t1 * t1;
        n = n + t1 * t1 * dot(g1, x1);
    }

    var t2 = 0.6 - dot(x2, x2);
    if t2 > 0.0 {
        t2 = t2 * t2;
        n = n + t2 * t2 * dot(g2, x2);
    }

    var t3 = 0.6 - dot(x3, x3);
    if t3 > 0.0 {
        t3 = t3 * t3;
        n = n + t3 * t3 * dot(g3, x3);
    }

    return 32.0 * n;
}

// =============================================================================
// Fractal Brownian Motion (3D)
// =============================================================================

/// 3D FBM using Perlin noise.
fn fbm_perlin_3d(p: vec3<f32>, octaves: i32, lacunarity: f32, gain: f32) -> f32 {
    var value = 0.0;
    var amplitude = 0.5;
    var frequency = 1.0;
    var pos = p;

    for (var i = 0; i < octaves; i = i + 1) {
        value = value + amplitude * perlin_noise_3d(pos * frequency);
        frequency = frequency * lacunarity;
        amplitude = amplitude * gain;
    }

    return value;
}

/// 3D FBM using Simplex noise (faster).
fn fbm_simplex_3d(p: vec3<f32>, octaves: i32, lacunarity: f32, gain: f32) -> f32 {
    var value = 0.0;
    var amplitude = 0.5;
    var frequency = 1.0;
    var pos = p;

    for (var i = 0; i < octaves; i = i + 1) {
        value = value + amplitude * simplex_noise_3d(pos * frequency);
        frequency = frequency * lacunarity;
        amplitude = amplitude * gain;
    }

    return value;
}

// =============================================================================
// Domain Warping
// =============================================================================

/// Apply domain warping using noise.
/// Warps the input coordinates before sampling.
fn domain_warp(p: vec3<f32>, strength: f32, time: f32) -> vec3<f32> {
    let offset = vec3<f32>(
        simplex_noise_3d(p + vec3<f32>(0.0, 0.0, time * 0.3)),
        simplex_noise_3d(p + vec3<f32>(5.2, 1.3, time * 0.3)),
        simplex_noise_3d(p + vec3<f32>(2.1, 3.7, time * 0.3))
    );
    return p + offset * strength;
}

/// Multi-layer domain warping for organic effects.
fn domain_warp_fbm(p: vec3<f32>, strength: f32, time: f32) -> vec3<f32> {
    // First warp layer
    let q = vec3<f32>(
        fbm_simplex_3d(p, 4, 2.0, 0.5),
        fbm_simplex_3d(p + vec3<f32>(5.2, 1.3, 0.0), 4, 2.0, 0.5),
        fbm_simplex_3d(p + vec3<f32>(2.1, 3.7, 0.0), 4, 2.0, 0.5)
    );

    // Second warp layer
    let r = vec3<f32>(
        fbm_simplex_3d(p + 4.0 * q + vec3<f32>(1.7, 9.2, time * 0.2), 4, 2.0, 0.5),
        fbm_simplex_3d(p + 4.0 * q + vec3<f32>(8.3, 2.8, time * 0.2), 4, 2.0, 0.5),
        fbm_simplex_3d(p + 4.0 * q + vec3<f32>(3.9, 5.4, time * 0.2), 4, 2.0, 0.5)
    );

    return p + r * strength;
}

// =============================================================================
// Curl Noise (Divergence-Free)
// =============================================================================

/// Calculate curl of noise field for fluid-like motion.
/// Returns a divergence-free vector field.
fn curl_noise(p: vec3<f32>) -> vec3<f32> {
    let e = 0.01;

    // Partial derivatives via finite differences
    let dx = (perlin_noise_3d(p + vec3<f32>(e, 0.0, 0.0)) -
              perlin_noise_3d(p - vec3<f32>(e, 0.0, 0.0))) / (2.0 * e);
    let dy = (perlin_noise_3d(p + vec3<f32>(0.0, e, 0.0)) -
              perlin_noise_3d(p - vec3<f32>(0.0, e, 0.0))) / (2.0 * e);
    let dz = (perlin_noise_3d(p + vec3<f32>(0.0, 0.0, e)) -
              perlin_noise_3d(p - vec3<f32>(0.0, 0.0, e))) / (2.0 * e);

    // Curl: nabla x F
    return vec3<f32>(dy - dz, dz - dx, dx - dy);
}

/// Curl noise using analytic derivatives (faster).
fn curl_noise_analytic(p: vec3<f32>) -> vec3<f32> {
    let n1 = perlin_noise_3d_deriv(p);
    let n2 = perlin_noise_3d_deriv(p + vec3<f32>(31.416, 47.853, 12.793));

    return vec3<f32>(
        n1.w - n2.z,
        n2.y - n1.y,
        n1.z - n2.w
    );
}

// =============================================================================
// Volumetric Plasma Effects
// =============================================================================

/// Volumetric plasma noise for the Opta ring core.
/// @param p 3D position (world space).
/// @param time Current time for animation.
/// @param energy Energy level [0,1] affecting intensity.
fn volumetric_plasma(p: vec3<f32>, time: f32, energy: f32) -> f32 {
    // Apply domain warping for organic flow
    let warped = domain_warp(p * 2.0, 0.5 + energy * 0.3, time);

    // Multi-octave noise
    var plasma = 0.0;
    plasma = plasma + fbm_simplex_3d(warped, 4, 2.0, 0.5) * 0.5;
    plasma = plasma + simplex_noise_3d(warped * 3.0 + time * 0.3) * 0.3;
    plasma = plasma + simplex_noise_3d(warped * 5.0 - time * 0.2) * 0.2;

    // Add curl-based swirls
    let swirl = curl_noise(p * 1.5 + time * 0.1);
    plasma = plasma + dot(swirl, swirl) * 0.1 * energy;

    // Remap to [0, 1]
    return saturate(plasma * 0.5 + 0.5);
}

/// Premium plasma with color gradients.
/// Returns vec4(R, G, B, intensity).
fn premium_plasma(p: vec3<f32>, time: f32, energy: f32) -> vec4<f32> {
    // Base plasma intensity
    let intensity = volumetric_plasma(p, time, energy);

    // Color gradients based on energy and position
    let phase = time * 0.5 + p.x * 2.0;
    let color_shift = sin(phase) * 0.5 + 0.5;

    // Color palette: blue -> purple -> pink based on energy
    let low_color = vec3<f32>(0.2, 0.4, 1.0);   // Cool blue
    let mid_color = vec3<f32>(0.6, 0.3, 1.0);   // Purple
    let high_color = vec3<f32>(1.0, 0.4, 0.8);  // Hot pink
    let white_hot = vec3<f32>(1.0, 1.0, 1.0);   // White

    var color: vec3<f32>;
    if energy < 0.33 {
        color = mix(low_color, mid_color, energy * 3.0);
    } else if energy < 0.66 {
        color = mix(mid_color, high_color, (energy - 0.33) * 3.0);
    } else {
        color = mix(high_color, white_hot, (energy - 0.66) * 3.0);
    }

    // Apply intensity
    color = color * intensity * (1.0 + energy * 0.5);

    return vec4<f32>(color, intensity);
}

/// Ring-specific plasma that flows around the torus.
/// @param uv Ring UV coordinates (u = around ring, v = around tube).
/// @param time Animation time.
/// @param energy Energy level.
fn ring_plasma(uv: vec2<f32>, time: f32, energy: f32) -> vec4<f32> {
    // Convert ring UVs to 3D position on torus
    let theta = uv.x * TAU; // Around ring
    let phi = uv.y * TAU;   // Around tube

    // Torus-relative 3D position
    let p = vec3<f32>(
        cos(theta) * (1.0 + 0.3 * cos(phi)),
        sin(phi) * 0.3,
        sin(theta) * (1.0 + 0.3 * cos(phi))
    );

    // Apply time-based flow
    let flow_offset = vec3<f32>(
        time * 0.3,  // Flow around the ring
        time * 0.2,  // Flow around the tube
        0.0
    );

    return premium_plasma(p + flow_offset, time, energy);
}

// =============================================================================
// Turbulence Variants
// =============================================================================

/// Ridged turbulence (sharp ridges).
fn ridged_turbulence_3d(p: vec3<f32>, octaves: i32) -> f32 {
    var value = 0.0;
    var amplitude = 0.5;
    var frequency = 1.0;
    var pos = p;

    for (var i = 0; i < octaves; i = i + 1) {
        let n = 1.0 - abs(simplex_noise_3d(pos * frequency));
        value = value + amplitude * n * n;
        frequency = frequency * 2.0;
        amplitude = amplitude * 0.5;
    }

    return value;
}

/// Billowy turbulence (soft clouds).
fn billowy_turbulence_3d(p: vec3<f32>, octaves: i32) -> f32 {
    var value = 0.0;
    var amplitude = 0.5;
    var frequency = 1.0;
    var pos = p;

    for (var i = 0; i < octaves; i = i + 1) {
        let n = abs(simplex_noise_3d(pos * frequency));
        value = value + amplitude * n;
        frequency = frequency * 2.0;
        amplitude = amplitude * 0.5;
    }

    return value;
}

/// Swiss turbulence (combines ridged and billowy).
fn swiss_turbulence_3d(p: vec3<f32>, octaves: i32, warp: f32) -> f32 {
    var value = 0.0;
    var amplitude = 0.5;
    var frequency = 1.0;
    var sum = 0.0;
    var pos = p;

    for (var i = 0; i < octaves; i = i + 1) {
        let n = simplex_noise_3d(pos * frequency);
        let dn = perlin_noise_3d_deriv(pos * frequency);

        value = value + amplitude * (1.0 - abs(n));
        sum = sum + amplitude;

        // Warp subsequent octaves
        pos = pos + dn.yzw * warp * amplitude;

        frequency = frequency * 2.0;
        amplitude = amplitude * 0.5;
    }

    return value / sum;
}
