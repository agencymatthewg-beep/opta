# Plan 10-01: Metal Shader Foundation

## Overview

**Phase**: 10 - Metal Shaders
**Plan**: 01 of 03
**Goal**: Establish Metal shader infrastructure with SwiftUI integration and a basic color effect

## Context

This plan creates the foundation for GPU-accelerated visual effects in Opta Scan. SwiftUI (iOS 17+) provides native Metal shader integration through `colorEffect()`, `distortionEffect()`, and `layerEffect()` view modifiers. Metal functions must be marked with `[[stitchable]]` attribute.

**Current state**: No Metal shaders exist. Glass effects use SwiftUI materials (`.thinMaterial`, etc.)
**Target state**: Metal shader library with basic infrastructure and proof-of-concept color effect

## Dependencies

- Phase 9 complete (gesture system in place)
- iOS 17+ target (already set)
- Xcode with Metal compiler support

## Tasks

### Task 1: Create Metal Shader Library File

Create `Opta Scan/Shaders/OptaShaders.metal` with:

```metal
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
```

**Verification**: File compiles without errors when building project

### Task 2: Create SwiftUI Shader Extensions

Create `Opta Scan/Design/ShaderEffects.swift` with:

```swift
//
//  ShaderEffects.swift
//  Opta Scan
//
//  SwiftUI extensions for Metal shader effects
//  Part of Phase 10: Metal Shaders
//

import SwiftUI

// MARK: - Shader Effect Availability

/// Check if Metal shaders are available (iOS 17+)
@available(iOS 17.0, *)
enum OptaShaderEffects {
    /// Whether shader effects should be enabled (respects reduce motion)
    static var isEnabled: Bool {
        !UIAccessibility.isReduceMotionEnabled
    }
}

// MARK: - Color Tint Effect

@available(iOS 17.0, *)
extension View {
    /// Apply a color tint shader effect
    /// - Parameters:
    ///   - color: The tint color to apply
    ///   - intensity: Tint intensity from 0 (none) to 1 (full)
    ///   - isEnabled: Whether the effect is active
    func shaderTint(
        _ color: Color,
        intensity: Double = 0.3,
        isEnabled: Bool = true
    ) -> some View {
        let resolved = color.resolve(in: EnvironmentValues())
        return self.colorEffect(
            ShaderLibrary.colorTint(
                .color(resolved),
                .float(intensity)
            ),
            isEnabled: isEnabled && OptaShaderEffects.isEnabled
        )
    }

    /// Apply brightness adjustment shader
    /// - Parameters:
    ///   - amount: Brightness adjustment (-1 to 1, 0 = no change)
    ///   - isEnabled: Whether the effect is active
    func shaderBrightness(
        _ amount: Double,
        isEnabled: Bool = true
    ) -> some View {
        self.colorEffect(
            ShaderLibrary.brightness(.float(amount)),
            isEnabled: isEnabled && OptaShaderEffects.isEnabled
        )
    }

    /// Apply saturation adjustment shader
    /// - Parameters:
    ///   - amount: Saturation level (0 = grayscale, 1 = normal, >1 = oversaturated)
    ///   - isEnabled: Whether the effect is active
    func shaderSaturation(
        _ amount: Double,
        isEnabled: Bool = true
    ) -> some View {
        self.colorEffect(
            ShaderLibrary.saturation(.float(amount)),
            isEnabled: isEnabled && OptaShaderEffects.isEnabled
        )
    }
}

// MARK: - Fallback for iOS 16

extension View {
    /// Conditional shader tint with iOS 16 fallback
    @ViewBuilder
    func optaTint(_ color: Color, intensity: Double = 0.3) -> some View {
        if #available(iOS 17.0, *) {
            self.shaderTint(color, intensity: intensity)
        } else {
            self.colorMultiply(color.opacity(intensity))
        }
    }
}
```

**Verification**: Build succeeds, no compiler errors

### Task 3: Add Metal File to Xcode Project

Ensure the `.metal` file is:
1. Added to the Xcode project
2. Included in the app target's "Compile Sources" build phase
3. Metal compiler settings are correct (default should work)

**Verification**: Project builds without Metal compiler errors

### Task 4: Create Shader Demo View (Development Only)

Create `Opta Scan/Views/Debug/ShaderDemoView.swift` for testing:

```swift
//
//  ShaderDemoView.swift
//  Opta Scan
//
//  Development view for testing Metal shader effects
//

import SwiftUI

#if DEBUG
@available(iOS 17.0, *)
struct ShaderDemoView: View {
    @State private var tintIntensity: Double = 0.3
    @State private var brightness: Double = 0.0
    @State private var saturation: Double = 1.0

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: OptaDesign.Spacing.lg) {
                    // Sample content to apply shaders to
                    sampleCard
                        .shaderTint(.optaPurple, intensity: tintIntensity)
                        .shaderBrightness(brightness)
                        .shaderSaturation(saturation)

                    // Controls
                    controlsSection
                }
                .padding(OptaDesign.Spacing.lg)
            }
            .background(Color.optaBackground)
            .navigationTitle("Shader Demo")
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    private var sampleCard: some View {
        VStack(spacing: OptaDesign.Spacing.md) {
            Image(systemName: "sparkles")
                .font(.system(size: 48))
                .foregroundStyle(Color.optaPurple)

            Text("Metal Shader Test")
                .font(.optaHeadline)
                .foregroundStyle(Color.optaTextPrimary)

            Text("Adjust sliders to see shader effects")
                .font(.optaCaption)
                .foregroundStyle(Color.optaTextSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(OptaDesign.Spacing.xl)
        .glassContent()
    }

    private var controlsSection: some View {
        VStack(alignment: .leading, spacing: OptaDesign.Spacing.md) {
            Text("Shader Parameters")
                .font(.optaHeadline)
                .foregroundStyle(Color.optaTextPrimary)

            VStack(alignment: .leading, spacing: OptaDesign.Spacing.sm) {
                Text("Tint Intensity: \(tintIntensity, specifier: "%.2f")")
                    .font(.optaCaption)
                    .foregroundStyle(Color.optaTextSecondary)
                Slider(value: $tintIntensity, in: 0...1)
                    .tint(.optaPurple)
            }

            VStack(alignment: .leading, spacing: OptaDesign.Spacing.sm) {
                Text("Brightness: \(brightness, specifier: "%.2f")")
                    .font(.optaCaption)
                    .foregroundStyle(Color.optaTextSecondary)
                Slider(value: $brightness, in: -0.5...0.5)
                    .tint(.optaPurple)
            }

            VStack(alignment: .leading, spacing: OptaDesign.Spacing.sm) {
                Text("Saturation: \(saturation, specifier: "%.2f")")
                    .font(.optaCaption)
                    .foregroundStyle(Color.optaTextSecondary)
                Slider(value: $saturation, in: 0...2)
                    .tint(.optaPurple)
            }
        }
        .padding(OptaDesign.Spacing.lg)
        .glassContent()
    }
}

#Preview {
    if #available(iOS 17.0, *) {
        ShaderDemoView()
    }
}
#endif
```

**Verification**: Demo view renders and shader controls function

### Task 5: Verify Build and Document

1. Run full build: `xcodebuild -project "Opta Scan.xcodeproj" -scheme "w" build`
2. Verify no warnings related to Metal shaders
3. Test on simulator (iOS 17+) that shaders render

## Acceptance Criteria

- [ ] `OptaShaders.metal` file created and compiles
- [ ] `ShaderEffects.swift` provides SwiftUI view extensions
- [ ] Basic color tint, brightness, saturation shaders work
- [ ] Accessibility: Effects disabled when Reduce Motion is on
- [ ] iOS 16 fallback exists for `optaTint`
- [ ] Build succeeds on iPhone 17 Pro simulator

## Estimated Scope

- **Files created**: 3 (OptaShaders.metal, ShaderEffects.swift, ShaderDemoView.swift)
- **Files modified**: 0
- **Complexity**: Medium (new technology introduction)
- **Risk**: Low (additive, no breaking changes)

## Notes

- Metal shaders require iOS 17+ for SwiftUI integration
- `[[stitchable]]` attribute is mandatory for SwiftUI shader functions
- Color resolved values must use `EnvironmentValues()` for correct color space
- Future plans will build on this foundation for glass and glow effects
