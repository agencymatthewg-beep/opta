// HD Bloom shader with Kawase blur and multi-pass support.
//
// This shader implements a high-quality bloom pipeline with:
// - Brightness extraction with soft knee
// - Kawase blur (dual filtering for efficiency)
// - Multi-level bloom compositing
// - HDR-aware tone mapping
//
// Dependencies:
//   #include "math.wgsl"
//   #include "color.wgsl"

#include "math.wgsl"
#include "color.wgsl"

// =============================================================================
// Uniforms
// =============================================================================

struct BloomHDUniforms {
    /// Bloom threshold (pixels above this contribute to bloom).
    threshold: f32,
    /// Soft knee for smooth threshold transition.
    knee: f32,
    /// Overall bloom intensity.
    intensity: f32,
    /// Scatter amount (how far bloom spreads).
    scatter: f32,
    /// Number of blur iterations.
    iterations: u32,
    /// Current blur pass index.
    pass_index: u32,
    /// Texel size (1.0 / texture_size).
    texel_size: vec2<f32>,
    /// Bloom tint color.
    tint: vec3<f32>,
    /// Padding.
    _padding: f32,
}

@group(0) @binding(0)
var<uniform> uniforms: BloomHDUniforms;

@group(0) @binding(1)
var input_texture: texture_2d<f32>;

@group(0) @binding(2)
var texture_sampler: sampler;

// =============================================================================
// Vertex Shader (Full-screen Triangle)
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
// Brightness Extraction
// =============================================================================

/// Calculate perceived luminance.
fn luminance(color: vec3<f32>) -> f32 {
    return dot(color, vec3<f32>(0.2126, 0.7152, 0.0722));
}

/// Soft threshold with knee for smooth bloom falloff.
fn soft_threshold(color: vec3<f32>, threshold: f32, knee: f32) -> vec3<f32> {
    let lum = luminance(color);

    // Soft knee calculation
    let soft = lum - threshold + knee;
    let soft_clamped = clamp(soft, 0.0, 2.0 * knee);
    let soft_contrib = soft_clamped * soft_clamped / (4.0 * knee + 0.0001);

    // Contribution factor
    let contrib = max(soft_contrib, lum - threshold) / max(lum, 0.0001);

    return color * max(contrib, 0.0);
}

/// Extract bright pixels for bloom.
@fragment
fn fs_extract_bright(in: VertexOutput) -> @location(0) vec4<f32> {
    let color = textureSample(input_texture, texture_sampler, in.uv).rgb;

    // Apply soft threshold
    let bright = soft_threshold(color, uniforms.threshold, uniforms.knee);

    return vec4<f32>(bright, 1.0);
}

// =============================================================================
// Kawase Blur
// =============================================================================

/// Kawase blur - single pass downsampling.
/// Samples 5 points in a cross pattern with offset based on pass index.
@fragment
fn fs_kawase_down(in: VertexOutput) -> @location(0) vec4<f32> {
    let offset = uniforms.texel_size * (f32(uniforms.pass_index) + 0.5);

    // Center sample
    var color = textureSample(input_texture, texture_sampler, in.uv).rgb;

    // Corner samples (scaled by 2 for wider blur)
    color = color + textureSample(input_texture, texture_sampler, in.uv + vec2<f32>(-offset.x, -offset.y)).rgb;
    color = color + textureSample(input_texture, texture_sampler, in.uv + vec2<f32>(offset.x, -offset.y)).rgb;
    color = color + textureSample(input_texture, texture_sampler, in.uv + vec2<f32>(-offset.x, offset.y)).rgb;
    color = color + textureSample(input_texture, texture_sampler, in.uv + vec2<f32>(offset.x, offset.y)).rgb;

    return vec4<f32>(color / 5.0, 1.0);
}

/// Kawase blur - single pass upsampling.
/// Samples 9 points in a 3x3 pattern.
@fragment
fn fs_kawase_up(in: VertexOutput) -> @location(0) vec4<f32> {
    let offset = uniforms.texel_size * uniforms.scatter;

    var color = vec3<f32>(0.0);

    // 3x3 sampling pattern with weights
    // Corner samples (weight 1)
    color = color + textureSample(input_texture, texture_sampler, in.uv + vec2<f32>(-offset.x, -offset.y)).rgb;
    color = color + textureSample(input_texture, texture_sampler, in.uv + vec2<f32>(offset.x, -offset.y)).rgb;
    color = color + textureSample(input_texture, texture_sampler, in.uv + vec2<f32>(-offset.x, offset.y)).rgb;
    color = color + textureSample(input_texture, texture_sampler, in.uv + vec2<f32>(offset.x, offset.y)).rgb;

    // Edge samples (weight 2)
    color = color + textureSample(input_texture, texture_sampler, in.uv + vec2<f32>(-offset.x, 0.0)).rgb * 2.0;
    color = color + textureSample(input_texture, texture_sampler, in.uv + vec2<f32>(offset.x, 0.0)).rgb * 2.0;
    color = color + textureSample(input_texture, texture_sampler, in.uv + vec2<f32>(0.0, -offset.y)).rgb * 2.0;
    color = color + textureSample(input_texture, texture_sampler, in.uv + vec2<f32>(0.0, offset.y)).rgb * 2.0;

    // Center sample (weight 4)
    color = color + textureSample(input_texture, texture_sampler, in.uv).rgb * 4.0;

    return vec4<f32>(color / 16.0, 1.0);
}

// =============================================================================
// Dual Filtering (More Efficient Alternative)
// =============================================================================

/// Dual filter downsample.
/// Optimized for hardware bilinear filtering.
@fragment
fn fs_dual_down(in: VertexOutput) -> @location(0) vec4<f32> {
    let half_pixel = uniforms.texel_size * 0.5;

    var color = textureSample(input_texture, texture_sampler, in.uv).rgb * 4.0;

    color = color + textureSample(input_texture, texture_sampler, in.uv - half_pixel).rgb;
    color = color + textureSample(input_texture, texture_sampler, in.uv + half_pixel).rgb;
    color = color + textureSample(input_texture, texture_sampler, in.uv + vec2<f32>(half_pixel.x, -half_pixel.y)).rgb;
    color = color + textureSample(input_texture, texture_sampler, in.uv + vec2<f32>(-half_pixel.x, half_pixel.y)).rgb;

    return vec4<f32>(color / 8.0, 1.0);
}

/// Dual filter upsample.
@fragment
fn fs_dual_up(in: VertexOutput) -> @location(0) vec4<f32> {
    let half_pixel = uniforms.texel_size * 0.5;
    let double_pixel = uniforms.texel_size;

    var color = vec3<f32>(0.0);

    // Diagonal samples (weight 1)
    color = color + textureSample(input_texture, texture_sampler, in.uv + vec2<f32>(-double_pixel.x, 0.0)).rgb;
    color = color + textureSample(input_texture, texture_sampler, in.uv + vec2<f32>(double_pixel.x, 0.0)).rgb;
    color = color + textureSample(input_texture, texture_sampler, in.uv + vec2<f32>(0.0, -double_pixel.y)).rgb;
    color = color + textureSample(input_texture, texture_sampler, in.uv + vec2<f32>(0.0, double_pixel.y)).rgb;

    // Half-pixel offset samples (weight 2)
    color = color + textureSample(input_texture, texture_sampler, in.uv + vec2<f32>(-half_pixel.x, -half_pixel.y)).rgb * 2.0;
    color = color + textureSample(input_texture, texture_sampler, in.uv + vec2<f32>(half_pixel.x, -half_pixel.y)).rgb * 2.0;
    color = color + textureSample(input_texture, texture_sampler, in.uv + vec2<f32>(-half_pixel.x, half_pixel.y)).rgb * 2.0;
    color = color + textureSample(input_texture, texture_sampler, in.uv + vec2<f32>(half_pixel.x, half_pixel.y)).rgb * 2.0;

    return vec4<f32>(color / 12.0, 1.0);
}

// =============================================================================
// Bloom Composition
// =============================================================================

/// Additional texture bindings for multi-level composition.
@group(0) @binding(3)
var original_texture: texture_2d<f32>;

@group(0) @binding(4)
var bloom_texture_1: texture_2d<f32>;

@group(0) @binding(5)
var bloom_texture_2: texture_2d<f32>;

@group(0) @binding(6)
var bloom_texture_3: texture_2d<f32>;

struct CompositeUniforms {
    /// Weights for each bloom level.
    weights: vec4<f32>,
    /// Overall intensity.
    intensity: f32,
    /// Whether to apply tone mapping.
    apply_tonemapping: f32,
    /// Bloom tint color.
    tint: vec3<f32>,
    /// Padding.
    _padding: f32,
}

@group(1) @binding(0)
var<uniform> composite_uniforms: CompositeUniforms;

/// Simple additive bloom composition.
@fragment
fn fs_composite_simple(in: VertexOutput) -> @location(0) vec4<f32> {
    let original = textureSample(original_texture, texture_sampler, in.uv);
    let bloom = textureSample(input_texture, texture_sampler, in.uv);

    // Apply intensity and tint
    let bloom_contrib = bloom.rgb * uniforms.intensity * uniforms.tint;

    // Additive blend
    var color = original.rgb + bloom_contrib;

    // Tone mapping
    color = tonemap_aces(color);

    return vec4<f32>(color, original.a);
}

/// Multi-level bloom composition.
@fragment
fn fs_composite_multi(in: VertexOutput) -> @location(0) vec4<f32> {
    let original = textureSample(original_texture, texture_sampler, in.uv);

    // Sample all bloom levels
    let bloom0 = textureSample(input_texture, texture_sampler, in.uv).rgb;
    let bloom1 = textureSample(bloom_texture_1, texture_sampler, in.uv).rgb;
    let bloom2 = textureSample(bloom_texture_2, texture_sampler, in.uv).rgb;
    let bloom3 = textureSample(bloom_texture_3, texture_sampler, in.uv).rgb;

    // Weighted sum
    var bloom = bloom0 * composite_uniforms.weights.x
              + bloom1 * composite_uniforms.weights.y
              + bloom2 * composite_uniforms.weights.z
              + bloom3 * composite_uniforms.weights.w;

    // Apply intensity and tint
    bloom = bloom * composite_uniforms.intensity * composite_uniforms.tint;

    // Additive blend
    var color = original.rgb + bloom;

    // Optional tone mapping
    if composite_uniforms.apply_tonemapping > 0.5 {
        color = tonemap_aces(color);
    }

    return vec4<f32>(color, original.a);
}

/// Screen blend mode composition (softer than additive).
@fragment
fn fs_composite_screen(in: VertexOutput) -> @location(0) vec4<f32> {
    let original = textureSample(original_texture, texture_sampler, in.uv);
    let bloom = textureSample(input_texture, texture_sampler, in.uv);

    let bloom_scaled = bloom.rgb * uniforms.intensity * uniforms.tint;

    // Screen blend: 1 - (1 - a) * (1 - b)
    var color = vec3<f32>(1.0) - (vec3<f32>(1.0) - original.rgb) * (vec3<f32>(1.0) - bloom_scaled);

    color = tonemap_aces(color);

    return vec4<f32>(color, original.a);
}

// =============================================================================
// HDR-Specific Functions
// =============================================================================

/// Extract bloom with HDR range preservation.
@fragment
fn fs_extract_hdr(in: VertexOutput) -> @location(0) vec4<f32> {
    let color = textureSample(input_texture, texture_sampler, in.uv).rgb;

    // Calculate relative luminance
    let lum = luminance(color);

    // Soft threshold with wider knee for HDR
    let knee = uniforms.knee * (1.0 + log2(max(lum, 1.0)));
    let bright = soft_threshold(color, uniforms.threshold, knee);

    // Preserve color ratios
    let bright_lum = luminance(bright);
    if bright_lum > 0.0001 {
        return vec4<f32>(bright * (bright_lum / (bright_lum + 1.0)), 1.0);
    }

    return vec4<f32>(0.0, 0.0, 0.0, 1.0);
}

/// Bloom composite with filmic look.
@fragment
fn fs_composite_filmic(in: VertexOutput) -> @location(0) vec4<f32> {
    let original = textureSample(original_texture, texture_sampler, in.uv);
    let bloom = textureSample(input_texture, texture_sampler, in.uv);

    let bloom_contrib = bloom.rgb * uniforms.intensity * uniforms.tint;

    // Filmic blend (preserves highlights better)
    var color = original.rgb + bloom_contrib;

    // Apply filmic tone mapping with shoulder compression
    let toe_strength = 0.5;
    let shoulder_strength = 0.5;

    // Simplified filmic curve
    let toe = color * toe_strength;
    let shoulder = vec3<f32>(1.0) - exp(-color * shoulder_strength);
    color = mix(toe, shoulder, saturate3(color));

    // Final ACES for display
    color = tonemap_aces(color);

    return vec4<f32>(color, original.a);
}

// =============================================================================
// Anamorphic Bloom (Streak Effect)
// =============================================================================

/// Horizontal streak blur for anamorphic look.
@fragment
fn fs_streak_horizontal(in: VertexOutput) -> @location(0) vec4<f32> {
    let offset = uniforms.texel_size.x * 2.0;

    var color = textureSample(input_texture, texture_sampler, in.uv).rgb * 0.25;

    // Extended horizontal sampling
    color = color + textureSample(input_texture, texture_sampler, in.uv + vec2<f32>(-offset, 0.0)).rgb * 0.2;
    color = color + textureSample(input_texture, texture_sampler, in.uv + vec2<f32>(offset, 0.0)).rgb * 0.2;
    color = color + textureSample(input_texture, texture_sampler, in.uv + vec2<f32>(-offset * 2.0, 0.0)).rgb * 0.125;
    color = color + textureSample(input_texture, texture_sampler, in.uv + vec2<f32>(offset * 2.0, 0.0)).rgb * 0.125;
    color = color + textureSample(input_texture, texture_sampler, in.uv + vec2<f32>(-offset * 3.0, 0.0)).rgb * 0.05;
    color = color + textureSample(input_texture, texture_sampler, in.uv + vec2<f32>(offset * 3.0, 0.0)).rgb * 0.05;

    return vec4<f32>(color, 1.0);
}

/// Vertical streak blur.
@fragment
fn fs_streak_vertical(in: VertexOutput) -> @location(0) vec4<f32> {
    let offset = uniforms.texel_size.y * 2.0;

    var color = textureSample(input_texture, texture_sampler, in.uv).rgb * 0.25;

    color = color + textureSample(input_texture, texture_sampler, in.uv + vec2<f32>(0.0, -offset)).rgb * 0.2;
    color = color + textureSample(input_texture, texture_sampler, in.uv + vec2<f32>(0.0, offset)).rgb * 0.2;
    color = color + textureSample(input_texture, texture_sampler, in.uv + vec2<f32>(0.0, -offset * 2.0)).rgb * 0.125;
    color = color + textureSample(input_texture, texture_sampler, in.uv + vec2<f32>(0.0, offset * 2.0)).rgb * 0.125;
    color = color + textureSample(input_texture, texture_sampler, in.uv + vec2<f32>(0.0, -offset * 3.0)).rgb * 0.05;
    color = color + textureSample(input_texture, texture_sampler, in.uv + vec2<f32>(0.0, offset * 3.0)).rgb * 0.05;

    return vec4<f32>(color, 1.0);
}

// =============================================================================
// Lens Dirt / Starburst (Optional Effects)
// =============================================================================

/// Apply lens dirt texture to bloom.
@group(0) @binding(7)
var dirt_texture: texture_2d<f32>;

@fragment
fn fs_lens_dirt(in: VertexOutput) -> @location(0) vec4<f32> {
    let bloom = textureSample(input_texture, texture_sampler, in.uv).rgb;
    let dirt = textureSample(dirt_texture, texture_sampler, in.uv).rgb;

    // Multiply bloom by dirt mask
    let dirty_bloom = bloom * (vec3<f32>(1.0) + dirt * 0.5);

    return vec4<f32>(dirty_bloom, 1.0);
}

/// Generate simple starburst pattern.
fn starburst(uv: vec2<f32>, center: vec2<f32>, rays: f32) -> f32 {
    let dir = uv - center;
    let angle = atan2(dir.y, dir.x);
    let dist = length(dir);

    let star = pow(abs(sin(angle * rays)), 8.0);
    let falloff = 1.0 / (1.0 + dist * dist * 10.0);

    return star * falloff;
}

/// Apply starburst effect to bright areas.
@fragment
fn fs_starburst(in: VertexOutput) -> @location(0) vec4<f32> {
    let bloom = textureSample(input_texture, texture_sampler, in.uv).rgb;
    let lum = luminance(bloom);

    // Only add starburst to very bright areas
    if lum > 0.8 {
        let star = starburst(in.uv, vec2<f32>(0.5), 6.0);
        let star_color = bloom * star * (lum - 0.8) * 5.0;
        return vec4<f32>(bloom + star_color * uniforms.tint, 1.0);
    }

    return vec4<f32>(bloom, 1.0);
}
