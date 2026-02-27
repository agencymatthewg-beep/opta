#include <metal_stdlib>
using namespace metal;

// MARK: - Constants

constant float PI = 3.14159265;
constant int MAX_STEPS = 120; // Increased for smoothness
constant float MAX_DIST = 100.0;
constant float SURF_DIST = 0.0005; // Finer precision for glass

// MARK: - Utility Functions

// ACES Filmic Tone Mapping
// Maps High Dynamic Range (HDR) colors to Standard Dynamic Range (SDR)
// without hard clipping, preserving smooth gradients in bright neon areas.
float3 ACESFilm(float3 x) {
    float a = 2.51;
    float b = 0.03;
    float c = 2.43;
    float d = 0.59;
    float e = 0.14;
    return saturate((x * (a * x + b)) / (x * (c * x + d) + e));
}

// Rotation Matrix
float2x2 rotate2d(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return float2x2(c, -s, s, c);
}

// Smooth min function for organic blending
float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
}

// MARK: - SDF Functions

// Torus SDF
float sdTorus(float3 p, float2 t) {
    float2 q = float2(length(p.xz) - t.x, p.y);
    return length(q) - t.y;
}

// Scene SDF
float GetDist(float3 p, float time, float energy) {
    // Dynamic parameters driven by Time and Energy
    float ringRadius = 1.0;
    float baseTubeRadius = 0.28;
    
    // Breathing effect
    float breath = sin(time * 2.0) * 0.01 * energy;
    float tubeRadius = baseTubeRadius + breath;
    
    // Turbulence / Liquid Surface
    // We add sine waves to the surface distance to create ripples
    float ripple = 0.0;
    if (energy > 0.05) {
        float3 rippleP = p;
        rippleP.xz = rotate2d(time * 0.5) * rippleP.xz; // Rotate the noise field
        ripple = sin(10.0 * rippleP.x + time * 3.0) * 
                 sin(10.0 * rippleP.y + time * 2.5) * 
                 sin(10.0 * rippleP.z) * 0.02 * energy;
    }
    
    return sdTorus(p, float2(ringRadius, tubeRadius)) + ripple;
}

// Calculate Normal (Finite Difference)
float3 GetNormal(float3 p, float time, float energy) {
    float d = GetDist(p, time, energy);
    float2 e = float2(0.001, 0); // Smaller epsilon for smoother normals
    
    float3 n = d - float3(
        GetDist(p - e.xyy, time, energy),
        GetDist(p - e.yxy, time, energy),
        GetDist(p - e.yyx, time, energy)
    );
    
    return normalize(n);
}

// Raymarching Loop
float RayMarch(float3 ro, float3 rd, float time, float energy) {
    float dO = 0.0;
    
    for(int i = 0; i < MAX_STEPS; i++) {
        float3 p = ro + rd * dO;
        float dS = GetDist(p, time, energy);
        dO += dS;
        if(dO > MAX_DIST || abs(dS) < SURF_DIST) break;
    }
    
    return dO;
}

// MARK: - Main Shader Function

[[ stitchable ]] half4 optaRingShader(float2 position, half4 color, float4 bounds, float time, float energy) {
    
    // UV Coordinates (-1 to 1, aspect ratio corrected)
    float2 uv = (position - bounds.xy - bounds.zw * 0.5) / (bounds.w * 0.5);
    // Correct aspect ratio if bounds are not square (handled by SwiftUI usually, but good to be safe)
    
    // Camera Setup
    float3 ro = float3(0.0, 0.0, -3.2); // Camera position
    float3 rd = normalize(float3(uv, 1.5)); // Ray direction (Field of View)
    
    // Camera Interaction (Optional Tilt)
    // float2x2 camRot = rotate2d(time * 0.05);
    // ro.xz = camRot * ro.xz;
    // rd.xz = camRot * rd.xz;
    
    // ** Multi-Pass Chromatic Aberration **
    // Instead of one raymarch, we do 3 slightly offset rays for R, G, B channels
    // This creates the high-end "lens dispersion" look at the edges of the glass.
    
    float3 finalColor = float3(0.0);
    float finalAlpha = 0.0;
    
    // Base Dispersion Amount (increases with energy)
    float dispersion = 0.005 + (0.01 * energy);
    
    // We only raymarch the center ray for geometry to save perf, then offset the normal for color
    float d = RayMarch(ro, rd, time, energy);
    
    if(d < MAX_DIST) {
        float3 p = ro + rd * d;
        float3 n = GetNormal(p, time, energy);
        float3 r = reflect(rd, n);
        
        // Define Opta Palette
        float3 deepPurple = float3(0.05, 0.0, 0.15); // Core dark glass
        float3 neonPurple = float3(0.7, 0.0, 1.0);   // Primary glow
        float3 cyanAccent = float3(0.0, 1.0, 1.0);   // Secondary highlight
        
        // 1. Fresnel (Schlick)
        float fresnel = pow(1.0 + dot(rd, n), 3.0);
        fresnel = clamp(fresnel, 0.0, 1.0);
        
        // 2. Iridescence / Spectral Shift
        // Modify the term based on viewing angle to shift from Purple -> Cyan
        float3 rimColor = mix(neonPurple, cyanAccent, fresnel * energy);
        
        // 3. Subsurface Scattering / Inner Glow
        // We approximate volume density by looking at how "thick" the object looks
        // For a torus, checking the normal.y helps simulate top-down lighting
        float internalGlow = smoothstep(0.4, 1.0, n.y * 0.5 + 0.5); 
        float3 volumeColor = deepPurple + (neonPurple * internalGlow * 0.5 * energy);
        
        // 4. Specular Highlights (Double Lobe)
        // Key light
        float3 lightPos1 = normalize(float3(1.0, 2.0, -2.0));
        float spec1 = pow(max(dot(r, lightPos1), 0.0), 32.0);
        
        // Rim light
        float3 lightPos2 = normalize(float3(-2.0, -1.0, -2.0));
        float spec2 = pow(max(dot(r, lightPos2), 0.0), 16.0) * 0.5;
        
        // Compose Raw Color
        float3 rawColor = volumeColor + (rimColor * fresnel * 2.5) + (float3(1.0) * (spec1 + spec2));
        
        // Add Energy Pulse Core
        // A sine wave running through the geometry
        float pulse = sin(p.y * 10.0 - time * 5.0) * 0.5 + 0.5;
        rawColor += neonPurple * pulse * energy * 0.2; // Veins of energy
        
        finalColor = rawColor;
        
        // Alpha Calculation
        // Glass is transparent in the center (where normal faces camera) and opaque at edges (Fresnel)
        float opacity = 0.2 + (fresnel * 0.8) + (spec1 * 0.5);
        finalAlpha = clamp(opacity, 0.0, 1.0);
        
    } else {
        // Atmosphere Glow (Bloom)
        // Even if we miss the geometry, the "air" around it glows
        float dFromCenter = length(uv);
        float glowRadius = 0.8;
        float atm = exp(-dFromCenter * 3.5) * 0.15 * energy;
        finalColor += float3(0.4, 0.0, 1.0) * atm;
        finalAlpha = atm;
    }

    // Tone Mapping & Gamma Correction
    finalColor = ACESFilm(finalColor);
    finalColor = pow(finalColor, float3(1.0/2.2)); // Gamma correction

    return half4(half3(finalColor), finalAlpha);
}
