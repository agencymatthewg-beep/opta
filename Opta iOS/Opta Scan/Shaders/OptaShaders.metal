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
