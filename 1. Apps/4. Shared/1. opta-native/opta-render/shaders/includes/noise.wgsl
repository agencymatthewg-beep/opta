// Noise generation utilities for WGSL shaders.
//
// Include with: #include "noise.wgsl"
//
// Dependencies: #include "math.wgsl"
//
// Provides:
// - Hash functions for pseudo-random number generation
// - Value noise (2D)
// - Perlin noise with quintic interpolation (2D)
// - Fractal Brownian Motion (fbm)
// - Simplex noise (2D)
// - Worley/cellular noise (2D)

// =============================================================================
// Hash Functions (Pseudo-random number generation)
// =============================================================================

/// Hash function: vec2 -> f32
/// Returns a pseudo-random value in [0, 1].
fn hash21(p: vec2<f32>) -> f32 {
    var p3 = fract(vec3<f32>(p.xyx) * 0.1031);
    p3 = p3 + dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

/// Hash function: vec2 -> vec2
/// Returns a pseudo-random vec2 in [0, 1] for each component.
fn hash22(p: vec2<f32>) -> vec2<f32> {
    var p3 = fract(vec3<f32>(p.xyx) * vec3<f32>(0.1031, 0.1030, 0.0973));
    p3 = p3 + dot(p3, p3.yzx + 33.33);
    return fract((p3.xx + p3.yz) * p3.zy);
}

/// Hash function: vec3 -> f32
/// Returns a pseudo-random value in [0, 1].
fn hash31(p: vec3<f32>) -> f32 {
    var p3 = fract(p * 0.1031);
    p3 = p3 + dot(p3, p3.zyx + 31.32);
    return fract((p3.x + p3.y) * p3.z);
}

/// Hash function for integer grid (for gradient noise).
fn hash_grad2(p: vec2<f32>) -> vec2<f32> {
    let angle = hash21(p) * 6.28318530718;
    return vec2<f32>(cos(angle), sin(angle));
}

// =============================================================================
// Value Noise (2D)
// =============================================================================

/// 2D Value noise.
/// Returns a value in approximately [-1, 1].
fn value_noise_2d(p: vec2<f32>) -> f32 {
    let i = floor(p);
    let f = fract(p);
    
    // Quintic interpolation for smoother results
    let u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
    
    // Corner values
    let a = hash21(i);
    let b = hash21(i + vec2<f32>(1.0, 0.0));
    let c = hash21(i + vec2<f32>(0.0, 1.0));
    let d = hash21(i + vec2<f32>(1.0, 1.0));
    
    // Bilinear interpolation
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y) * 2.0 - 1.0;
}

// =============================================================================
// Perlin Noise (2D) with Quintic Interpolation
// =============================================================================

/// 2D Perlin noise with quintic interpolation.
/// Returns a value in approximately [-1, 1].
fn perlin_noise_2d(p: vec2<f32>) -> f32 {
    let i = floor(p);
    let f = fract(p);
    
    // Quintic interpolation curve
    let u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
    
    // Gradients at corners
    let g00 = hash_grad2(i);
    let g10 = hash_grad2(i + vec2<f32>(1.0, 0.0));
    let g01 = hash_grad2(i + vec2<f32>(0.0, 1.0));
    let g11 = hash_grad2(i + vec2<f32>(1.0, 1.0));
    
    // Distance vectors to corners
    let d00 = f;
    let d10 = f - vec2<f32>(1.0, 0.0);
    let d01 = f - vec2<f32>(0.0, 1.0);
    let d11 = f - vec2<f32>(1.0, 1.0);
    
    // Dot products
    let v00 = dot(g00, d00);
    let v10 = dot(g10, d10);
    let v01 = dot(g01, d01);
    let v11 = dot(g11, d11);
    
    // Interpolate
    return mix(mix(v00, v10, u.x), mix(v01, v11, u.x), u.y);
}

// =============================================================================
// Fractal Brownian Motion (fbm)
// =============================================================================

/// Fractal Brownian Motion using Perlin noise.
/// - octaves: Number of noise layers (typically 4-8)
/// - lacunarity: Frequency multiplier per octave (typically 2.0)
/// - gain: Amplitude multiplier per octave (typically 0.5)
fn fbm_perlin(p: vec2<f32>, octaves: i32, lacunarity: f32, gain: f32) -> f32 {
    var value = 0.0;
    var amplitude = 0.5;
    var frequency = 1.0;
    var pos = p;
    
    for (var i = 0; i < octaves; i = i + 1) {
        value = value + amplitude * perlin_noise_2d(pos * frequency);
        frequency = frequency * lacunarity;
        amplitude = amplitude * gain;
    }
    
    return value;
}

/// Simplified fbm with default parameters.
fn fbm(p: vec2<f32>) -> f32 {
    return fbm_perlin(p, 5, 2.0, 0.5);
}

/// fbm with value noise (faster but less smooth).
fn fbm_value(p: vec2<f32>, octaves: i32) -> f32 {
    var value = 0.0;
    var amplitude = 0.5;
    var pos = p;
    
    for (var i = 0; i < octaves; i = i + 1) {
        value = value + amplitude * value_noise_2d(pos);
        pos = pos * 2.0;
        amplitude = amplitude * 0.5;
    }
    
    return value;
}

// =============================================================================
// Simplex Noise (2D)
// =============================================================================

/// Skew factors for 2D simplex noise.
const SKEW_2D: f32 = 0.36602540378; // (sqrt(3) - 1) / 2
const UNSKEW_2D: f32 = 0.21132486540; // (3 - sqrt(3)) / 6

/// 2D Simplex noise.
/// Returns a value in approximately [-1, 1].
fn simplex_noise_2d(p: vec2<f32>) -> f32 {
    // Skew input space to determine simplex cell
    let skew = (p.x + p.y) * SKEW_2D;
    let i = floor(p + skew);
    
    // Unskew cell origin back to (x, y) space
    let unskew = (i.x + i.y) * UNSKEW_2D;
    let x0 = p - (i - unskew);
    
    // Determine which simplex we're in
    var i1: vec2<f32>;
    if x0.x > x0.y {
        i1 = vec2<f32>(1.0, 0.0);
    } else {
        i1 = vec2<f32>(0.0, 1.0);
    }
    
    // Offsets for corners
    let x1 = x0 - i1 + UNSKEW_2D;
    let x2 = x0 - 1.0 + 2.0 * UNSKEW_2D;
    
    // Gradients at corners
    let g0 = hash_grad2(i);
    let g1 = hash_grad2(i + i1);
    let g2 = hash_grad2(i + 1.0);
    
    // Calculate contributions from each corner
    var n0 = 0.0;
    var n1 = 0.0;
    var n2 = 0.0;
    
    var t0 = 0.5 - dot(x0, x0);
    if t0 > 0.0 {
        t0 = t0 * t0;
        n0 = t0 * t0 * dot(g0, x0);
    }
    
    var t1 = 0.5 - dot(x1, x1);
    if t1 > 0.0 {
        t1 = t1 * t1;
        n1 = t1 * t1 * dot(g1, x1);
    }
    
    var t2 = 0.5 - dot(x2, x2);
    if t2 > 0.0 {
        t2 = t2 * t2;
        n2 = t2 * t2 * dot(g2, x2);
    }
    
    // Scale to approximately [-1, 1]
    return 70.0 * (n0 + n1 + n2);
}

/// fbm using simplex noise.
fn fbm_simplex(p: vec2<f32>, octaves: i32, lacunarity: f32, gain: f32) -> f32 {
    var value = 0.0;
    var amplitude = 0.5;
    var frequency = 1.0;
    var pos = p;
    
    for (var i = 0; i < octaves; i = i + 1) {
        value = value + amplitude * simplex_noise_2d(pos * frequency);
        frequency = frequency * lacunarity;
        amplitude = amplitude * gain;
    }
    
    return value;
}

// =============================================================================
// Worley / Cellular Noise (2D)
// =============================================================================

/// 2D Worley (cellular) noise.
/// Returns distance to the nearest feature point.
/// Output is in [0, ~1] range (can exceed 1 rarely).
fn worley_noise_2d(p: vec2<f32>) -> f32 {
    let n = floor(p);
    let f = fract(p);
    
    var min_dist = 1.0;
    
    // Check 3x3 grid of cells
    for (var j = -1; j <= 1; j = j + 1) {
        for (var i = -1; i <= 1; i = i + 1) {
            let neighbor = vec2<f32>(f32(i), f32(j));
            let cell = n + neighbor;
            
            // Random point within this cell
            let point = hash22(cell);
            
            // Vector from fragment to this point
            let diff = neighbor + point - f;
            let dist = length(diff);
            
            min_dist = min(min_dist, dist);
        }
    }
    
    return min_dist;
}

/// 2D Worley noise returning F1 and F2 distances.
/// F1 = distance to nearest point
/// F2 = distance to second nearest point
fn worley_noise_2d_f1f2(p: vec2<f32>) -> vec2<f32> {
    let n = floor(p);
    let f = fract(p);
    
    var f1 = 1.0;
    var f2 = 1.0;
    
    // Check 3x3 grid of cells
    for (var j = -1; j <= 1; j = j + 1) {
        for (var i = -1; i <= 1; i = i + 1) {
            let neighbor = vec2<f32>(f32(i), f32(j));
            let cell = n + neighbor;
            
            // Random point within this cell
            let point = hash22(cell);
            
            // Vector from fragment to this point
            let diff = neighbor + point - f;
            let dist = length(diff);
            
            // Update F1 and F2
            if dist < f1 {
                f2 = f1;
                f1 = dist;
            } else if dist < f2 {
                f2 = dist;
            }
        }
    }
    
    return vec2<f32>(f1, f2);
}

/// Worley noise with cell-edge detection.
/// Returns value between 0 (on edge) and 1 (at cell center).
fn worley_edges_2d(p: vec2<f32>) -> f32 {
    let f1f2 = worley_noise_2d_f1f2(p);
    return f1f2.y - f1f2.x;
}

// =============================================================================
// Turbulence (absolute value fbm)
// =============================================================================

/// Turbulence using absolute value of noise.
/// Creates more ridged, turbulent patterns.
fn turbulence(p: vec2<f32>, octaves: i32) -> f32 {
    var value = 0.0;
    var amplitude = 0.5;
    var pos = p;
    
    for (var i = 0; i < octaves; i = i + 1) {
        value = value + amplitude * abs(perlin_noise_2d(pos));
        pos = pos * 2.0;
        amplitude = amplitude * 0.5;
    }
    
    return value;
}

/// Ridged turbulence (inverted absolute value).
/// Creates sharp ridges.
fn ridged_turbulence(p: vec2<f32>, octaves: i32) -> f32 {
    var value = 0.0;
    var amplitude = 0.5;
    var pos = p;
    
    for (var i = 0; i < octaves; i = i + 1) {
        value = value + amplitude * (1.0 - abs(perlin_noise_2d(pos)));
        pos = pos * 2.0;
        amplitude = amplitude * 0.5;
    }
    
    return value;
}
