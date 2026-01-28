// Separable Gaussian blur shader.
//
// Optimized 9-tap Gaussian kernel (sigma ~= 2.0) for two-pass blur.
// First pass: horizontal blur
// Second pass: vertical blur
//
// The separable approach reduces complexity from O(n^2) to O(2n) samples.

// =============================================================================
// Uniforms
// =============================================================================

struct BlurUniforms {
    /// Blur direction: (1.0, 0.0) for horizontal, (0.0, 1.0) for vertical.
    direction: vec2<f32>,
    /// Texel size: (1.0 / width, 1.0 / height).
    texel_size: vec2<f32>,
}

@group(0) @binding(0)
var<uniform> uniforms: BlurUniforms;

@group(0) @binding(1)
var input_texture: texture_2d<f32>;

@group(0) @binding(2)
var input_sampler: sampler;

// =============================================================================
// Gaussian Kernel Weights
// =============================================================================

// 9-tap Gaussian kernel (sigma ~= 2.0)
// These weights are normalized to sum to 1.0
// Calculated from: exp(-x^2 / (2 * sigma^2)) / (sqrt(2 * PI) * sigma)
const KERNEL_SIZE: i32 = 9;

// Weights for a 9-tap kernel with sigma ~= 2.0
// Index 0 = center, indices 1-4 = offsets
// weights[0] + 2 * (weights[1] + weights[2] + weights[3] + weights[4]) = 1.0
const WEIGHT_0: f32 = 0.16266681;  // Center
const WEIGHT_1: f32 = 0.14314637;  // Offset 1
const WEIGHT_2: f32 = 0.09740047;  // Offset 2
const WEIGHT_3: f32 = 0.05117261;  // Offset 3
const WEIGHT_4: f32 = 0.02077877;  // Offset 4

// =============================================================================
// Vertex Shader
// =============================================================================

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
}

@vertex
fn vs_main(@builtin(vertex_index) vertex_index: u32) -> VertexOutput {
    // Full-screen triangle
    var positions = array<vec2<f32>, 3>(
        vec2<f32>(-1.0, -1.0),
        vec2<f32>(3.0, -1.0),
        vec2<f32>(-1.0, 3.0)
    );
    
    var uvs = array<vec2<f32>, 3>(
        vec2<f32>(0.0, 1.0),
        vec2<f32>(2.0, 1.0),
        vec2<f32>(0.0, -1.0)
    );
    
    var out: VertexOutput;
    out.position = vec4<f32>(positions[vertex_index], 0.0, 1.0);
    out.uv = uvs[vertex_index];
    return out;
}

// =============================================================================
// Fragment Shader - 9-tap Gaussian Blur
// =============================================================================

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    // Calculate step size based on direction and texel size
    let step = uniforms.direction * uniforms.texel_size;
    
    // Accumulate weighted samples
    var color = textureSample(input_texture, input_sampler, in.uv) * WEIGHT_0;
    
    // Symmetric sampling (both directions from center)
    color += textureSample(input_texture, input_sampler, in.uv + step * 1.0) * WEIGHT_1;
    color += textureSample(input_texture, input_sampler, in.uv - step * 1.0) * WEIGHT_1;
    
    color += textureSample(input_texture, input_sampler, in.uv + step * 2.0) * WEIGHT_2;
    color += textureSample(input_texture, input_sampler, in.uv - step * 2.0) * WEIGHT_2;
    
    color += textureSample(input_texture, input_sampler, in.uv + step * 3.0) * WEIGHT_3;
    color += textureSample(input_texture, input_sampler, in.uv - step * 3.0) * WEIGHT_3;
    
    color += textureSample(input_texture, input_sampler, in.uv + step * 4.0) * WEIGHT_4;
    color += textureSample(input_texture, input_sampler, in.uv - step * 4.0) * WEIGHT_4;
    
    return color;
}

// =============================================================================
// Fragment Shader - 5-tap Gaussian Blur (Faster)
// =============================================================================

// 5-tap kernel weights (sigma ~= 1.0)
const WEIGHT5_0: f32 = 0.29411764;  // Center
const WEIGHT5_1: f32 = 0.23529411;  // Offset 1
const WEIGHT5_2: f32 = 0.11764706;  // Offset 2

@fragment
fn fs_main_5tap(in: VertexOutput) -> @location(0) vec4<f32> {
    let step = uniforms.direction * uniforms.texel_size;
    
    var color = textureSample(input_texture, input_sampler, in.uv) * WEIGHT5_0;
    
    color += textureSample(input_texture, input_sampler, in.uv + step * 1.0) * WEIGHT5_1;
    color += textureSample(input_texture, input_sampler, in.uv - step * 1.0) * WEIGHT5_1;
    
    color += textureSample(input_texture, input_sampler, in.uv + step * 2.0) * WEIGHT5_2;
    color += textureSample(input_texture, input_sampler, in.uv - step * 2.0) * WEIGHT5_2;
    
    return color;
}

// =============================================================================
// Fragment Shader - 13-tap Gaussian Blur (Higher Quality)
// =============================================================================

// 13-tap kernel weights (sigma ~= 3.0)
const WEIGHT13_0: f32 = 0.10647450;  // Center
const WEIGHT13_1: f32 = 0.10226012;  // Offset 1
const WEIGHT13_2: f32 = 0.09069582;  // Offset 2
const WEIGHT13_3: f32 = 0.07427357;  // Offset 3
const WEIGHT13_4: f32 = 0.05613476;  // Offset 4
const WEIGHT13_5: f32 = 0.03916438;  // Offset 5
const WEIGHT13_6: f32 = 0.02520347;  // Offset 6

@fragment
fn fs_main_13tap(in: VertexOutput) -> @location(0) vec4<f32> {
    let step = uniforms.direction * uniforms.texel_size;
    
    var color = textureSample(input_texture, input_sampler, in.uv) * WEIGHT13_0;
    
    color += textureSample(input_texture, input_sampler, in.uv + step * 1.0) * WEIGHT13_1;
    color += textureSample(input_texture, input_sampler, in.uv - step * 1.0) * WEIGHT13_1;
    
    color += textureSample(input_texture, input_sampler, in.uv + step * 2.0) * WEIGHT13_2;
    color += textureSample(input_texture, input_sampler, in.uv - step * 2.0) * WEIGHT13_2;
    
    color += textureSample(input_texture, input_sampler, in.uv + step * 3.0) * WEIGHT13_3;
    color += textureSample(input_texture, input_sampler, in.uv - step * 3.0) * WEIGHT13_3;
    
    color += textureSample(input_texture, input_sampler, in.uv + step * 4.0) * WEIGHT13_4;
    color += textureSample(input_texture, input_sampler, in.uv - step * 4.0) * WEIGHT13_4;
    
    color += textureSample(input_texture, input_sampler, in.uv + step * 5.0) * WEIGHT13_5;
    color += textureSample(input_texture, input_sampler, in.uv - step * 5.0) * WEIGHT13_5;
    
    color += textureSample(input_texture, input_sampler, in.uv + step * 6.0) * WEIGHT13_6;
    color += textureSample(input_texture, input_sampler, in.uv - step * 6.0) * WEIGHT13_6;
    
    return color;
}

// =============================================================================
// Fragment Shader - Bilinear Optimized 9-tap (5 samples)
// =============================================================================

// Optimized 9-tap using bilinear filtering
// This uses 5 samples instead of 9 by sampling between texels
// Offsets calculated to achieve same result as 9-tap
const OPT_OFFSET_1: f32 = 1.3846153846;
const OPT_OFFSET_2: f32 = 3.2307692308;
const OPT_WEIGHT_0: f32 = 0.2270270270;
const OPT_WEIGHT_1: f32 = 0.3162162162;
const OPT_WEIGHT_2: f32 = 0.0702702703;

@fragment
fn fs_main_optimized(in: VertexOutput) -> @location(0) vec4<f32> {
    let step = uniforms.direction * uniforms.texel_size;
    
    var color = textureSample(input_texture, input_sampler, in.uv) * OPT_WEIGHT_0;
    
    color += textureSample(input_texture, input_sampler, in.uv + step * OPT_OFFSET_1) * OPT_WEIGHT_1;
    color += textureSample(input_texture, input_sampler, in.uv - step * OPT_OFFSET_1) * OPT_WEIGHT_1;
    
    color += textureSample(input_texture, input_sampler, in.uv + step * OPT_OFFSET_2) * OPT_WEIGHT_2;
    color += textureSample(input_texture, input_sampler, in.uv - step * OPT_OFFSET_2) * OPT_WEIGHT_2;
    
    return color;
}

// =============================================================================
// Kawase Blur (Alternative fast blur for bloom)
// =============================================================================

/// Kawase blur - very fast, good for bloom
/// Uses diagonal sampling pattern
@fragment
fn fs_kawase(in: VertexOutput) -> @location(0) vec4<f32> {
    // Kawase iteration offset (increase per pass)
    let offset = uniforms.direction.x; // Reuse direction.x as iteration offset
    
    let uv = in.uv;
    let ts = uniforms.texel_size;
    
    var color = textureSample(input_texture, input_sampler, uv);
    color += textureSample(input_texture, input_sampler, uv + vec2<f32>(-ts.x, -ts.y) * (offset + 0.5));
    color += textureSample(input_texture, input_sampler, uv + vec2<f32>(ts.x, -ts.y) * (offset + 0.5));
    color += textureSample(input_texture, input_sampler, uv + vec2<f32>(-ts.x, ts.y) * (offset + 0.5));
    color += textureSample(input_texture, input_sampler, uv + vec2<f32>(ts.x, ts.y) * (offset + 0.5));
    
    return color * 0.2;
}
