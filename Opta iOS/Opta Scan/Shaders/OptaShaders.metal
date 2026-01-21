//
//  OptaShaders.metal
//  Opta Scan
//
//  Metal shader library for GPU-accelerated visual effects
//  Part of Phase 10: Metal Shaders
//
//  Created by Matthew Byrden
//

#include <metal_stdlib>
#include <SwiftUI/SwiftUI_Metal.h>
using namespace metal;

// MARK: - Color Tint Effect
// Basic color tinting shader to verify pipeline works

[[ stitchable ]] half4 colorTint(
    float2 position,
    half4 color,
    half4 tintColor,
    float intensity
) {
    // Blend original color with tint based on intensity
    half4 tinted = mix(color, tintColor * color.a, half(intensity));
    return tinted;
}

// MARK: - Brightness Adjustment
// Simple brightness shader for glow preparation

[[ stitchable ]] half4 brightness(
    float2 position,
    half4 color,
    float amount
) {
    half4 result = color;
    result.rgb *= half(1.0 + amount);
    return result;
}

// MARK: - Saturation Adjustment

[[ stitchable ]] half4 saturation(
    float2 position,
    half4 color,
    float amount
) {
    // Luminance weights for perceived brightness
    half3 luminance = half3(0.2126, 0.7152, 0.0722);
    half gray = dot(color.rgb, luminance);
    half3 result = mix(half3(gray), color.rgb, half(amount));
    return half4(result, color.a);
}

// MARK: - Obsidian Glass Effect
// Creates a depth-based glass effect with inner glow and subtle noise

// Simple hash function for noise generation
float hash(float2 p) {
    return fract(sin(dot(p, float2(127.1, 311.7))) * 43758.5453);
}

// Smooth noise function for texture
float noise(float2 p) {
    float2 i = floor(p);
    float2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f); // Smoothstep

    float a = hash(i);
    float b = hash(i + float2(1.0, 0.0));
    float c = hash(i + float2(0.0, 1.0));
    float d = hash(i + float2(1.0, 1.0));

    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

[[ stitchable ]] half4 obsidianGlass(
    float2 position,
    half4 color,
    float2 size,           // View size for normalization
    float depth,           // Glass depth level (0-1)
    half4 glowColor,       // Inner glow color
    float glowIntensity,   // Glow strength (0-1)
    float noiseAmount      // Noise texture amount (0-1)
) {
    // Normalize position to 0-1 range
    float2 uv = position / size;

    // Calculate edge distance for inner glow
    float2 edgeDist = min(uv, 1.0 - uv);
    float edge = min(edgeDist.x, edgeDist.y);

    // Inner glow based on edge proximity
    float glowFactor = 1.0 - smoothstep(0.0, 0.15, edge);
    glowFactor *= glowIntensity;

    // Subtle noise texture
    float n = noise(position * 0.5) * noiseAmount * 0.03;

    // Depth-based darkening at center
    float centerDist = length(uv - 0.5) * 2.0;
    float depthDarken = mix(1.0, 0.95, depth * (1.0 - centerDist * 0.3));

    // Combine effects
    half4 result = color;
    result.rgb *= half(depthDarken);
    result.rgb += half3(n);
    result.rgb = mix(result.rgb, glowColor.rgb * result.a, half(glowFactor));

    return result;
}

// MARK: - Glass Highlight Effect
// Adds a subtle highlight sweep across the glass

[[ stitchable ]] half4 glassHighlight(
    float2 position,
    half4 color,
    float2 size,
    float angle,           // Highlight angle in radians
    float width,           // Highlight band width (0-1)
    float intensity        // Highlight intensity (0-1)
) {
    float2 uv = position / size;

    // Create angled highlight band
    float2 dir = float2(cos(angle), sin(angle));
    float proj = dot(uv - 0.5, dir) + 0.5;

    // Soft highlight band
    float highlight = smoothstep(0.5 - width, 0.5, proj) *
                      smoothstep(0.5 + width, 0.5, proj);
    highlight *= intensity;

    // Add subtle highlight
    half4 result = color;
    result.rgb += half(highlight * 0.1);

    return result;
}
