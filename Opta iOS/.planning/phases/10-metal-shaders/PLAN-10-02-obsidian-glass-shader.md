# Plan 10-02: Obsidian Glass Shader

## Overview

**Phase**: 10 - Metal Shaders
**Plan**: 02 of 03
**Goal**: Create custom obsidian glass shader with depth-based effects to enhance the existing glass system

## Context

The current glass system uses SwiftUI's built-in materials (`.ultraThinMaterial`, `.thinMaterial`, `.regularMaterial`). This plan creates a custom Metal shader that adds depth, inner glow, and subtle noise texture to create a more premium "obsidian" glass aesthetic.

**Current state**: Glass effects use standard SwiftUI materials
**Target state**: Custom obsidian glass shader with depth simulation and inner glow

## Dependencies

- Plan 10-01 complete (shader foundation in place)
- `OptaShaders.metal` exists with basic shaders
- `ShaderEffects.swift` exists with view extensions

## Tasks

### Task 1: Add Obsidian Glass Shader to Metal File

Add to `Opta Scan/Shaders/OptaShaders.metal`:

```metal
// MARK: - Obsidian Glass Effect
// Creates a depth-based glass effect with inner glow and subtle noise

// Simple noise function for texture
float hash(float2 p) {
    return fract(sin(dot(p, float2(127.1, 311.7))) * 43758.5453);
}

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
```

**Verification**: Metal file compiles without errors

### Task 2: Create Obsidian Glass View Extensions

Add to `Opta Scan/Design/ShaderEffects.swift`:

```swift
// MARK: - Obsidian Glass Effect

@available(iOS 17.0, *)
extension View {
    /// Apply obsidian glass shader effect
    /// - Parameters:
    ///   - depth: Glass depth level (0 = shallow, 1 = deep)
    ///   - glowColor: Inner glow color (default: purple)
    ///   - glowIntensity: Glow strength 0-1 (default: 0.3)
    ///   - noiseAmount: Subtle noise texture 0-1 (default: 0.5)
    ///   - isEnabled: Whether the effect is active
    func obsidianGlass(
        depth: Double = 0.5,
        glowColor: Color = .optaPurple,
        glowIntensity: Double = 0.3,
        noiseAmount: Double = 0.5,
        isEnabled: Bool = true
    ) -> some View {
        let resolvedGlow = glowColor.resolve(in: EnvironmentValues())
        return GeometryReader { geometry in
            self.colorEffect(
                ShaderLibrary.obsidianGlass(
                    .float2(geometry.size.width, geometry.size.height),
                    .float(depth),
                    .color(resolvedGlow),
                    .float(glowIntensity),
                    .float(noiseAmount)
                ),
                isEnabled: isEnabled && OptaShaderEffects.isEnabled
            )
        }
    }

    /// Apply glass highlight sweep effect
    /// - Parameters:
    ///   - angle: Highlight angle in degrees (default: 45)
    ///   - width: Highlight band width 0-1 (default: 0.3)
    ///   - intensity: Highlight brightness 0-1 (default: 0.5)
    ///   - isEnabled: Whether the effect is active
    func glassHighlight(
        angle: Double = 45,
        width: Double = 0.3,
        intensity: Double = 0.5,
        isEnabled: Bool = true
    ) -> some View {
        GeometryReader { geometry in
            self.colorEffect(
                ShaderLibrary.glassHighlight(
                    .float2(geometry.size.width, geometry.size.height),
                    .float(angle * .pi / 180), // Convert to radians
                    .float(width),
                    .float(intensity)
                ),
                isEnabled: isEnabled && OptaShaderEffects.isEnabled
            )
        }
    }
}
```

**Verification**: Extensions compile and are accessible

### Task 3: Create Enhanced Glass Modifiers

Create `Opta Scan/Design/ObsidianGlassModifiers.swift`:

```swift
//
//  ObsidianGlassModifiers.swift
//  Opta Scan
//
//  Enhanced glass modifiers using Metal shaders
//  Part of Phase 10: Metal Shaders
//

import SwiftUI

// MARK: - Obsidian Glass Levels

/// Enhanced glass modifiers that layer Metal shaders over SwiftUI materials
enum ObsidianGlassLevel {
    case subtle     // Background elements
    case content    // Cards, sheets
    case overlay    // Modals, popovers

    var depth: Double {
        switch self {
        case .subtle: return 0.3
        case .content: return 0.5
        case .overlay: return 0.7
        }
    }

    var glowIntensity: Double {
        switch self {
        case .subtle: return 0.15
        case .content: return 0.25
        case .overlay: return 0.35
        }
    }

    var cornerRadius: CGFloat {
        switch self {
        case .subtle: return 12
        case .content: return 16
        case .overlay: return 24
        }
    }
}

// MARK: - Obsidian Glass Modifier

@available(iOS 17.0, *)
struct ObsidianGlassModifier: ViewModifier {
    let level: ObsidianGlassLevel
    let glowColor: Color

    func body(content: Content) -> some View {
        content
            // Base material layer
            .background(materialForLevel)
            .background(Color.optaSurface.opacity(opacityForLevel))
            // Metal shader enhancement
            .obsidianGlass(
                depth: level.depth,
                glowColor: glowColor,
                glowIntensity: level.glowIntensity
            )
            // Border with gradient
            .overlay(
                RoundedRectangle(cornerRadius: level.cornerRadius, style: .continuous)
                    .stroke(
                        LinearGradient(
                            colors: [glowColor.opacity(0.15), glowColor.opacity(0.02)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        lineWidth: 1
                    )
            )
            .clipShape(RoundedRectangle(cornerRadius: level.cornerRadius, style: .continuous))
            .shadow(color: .black.opacity(shadowOpacityForLevel), radius: shadowRadiusForLevel, y: shadowYForLevel)
    }

    @ViewBuilder
    private var materialForLevel: some View {
        switch level {
        case .subtle: Color.clear.background(.ultraThinMaterial)
        case .content: Color.clear.background(.thinMaterial)
        case .overlay: Color.clear.background(.regularMaterial)
        }
    }

    private var opacityForLevel: Double {
        switch level {
        case .subtle: return 0.3
        case .content: return 0.5
        case .overlay: return 0.7
        }
    }

    private var shadowOpacityForLevel: Double {
        switch level {
        case .subtle: return 0.2
        case .content: return 0.3
        case .overlay: return 0.5
        }
    }

    private var shadowRadiusForLevel: CGFloat {
        switch level {
        case .subtle: return 10
        case .content: return 20
        case .overlay: return 40
        }
    }

    private var shadowYForLevel: CGFloat {
        switch level {
        case .subtle: return 5
        case .content: return 10
        case .overlay: return 20
        }
    }
}

// MARK: - View Extensions

extension View {
    /// Apply obsidian glass effect with Metal shader enhancement (iOS 17+)
    /// Falls back to standard glass on iOS 16
    @ViewBuilder
    func obsidianGlassStyle(
        _ level: ObsidianGlassLevel = .content,
        glowColor: Color = .optaPurple
    ) -> some View {
        if #available(iOS 17.0, *) {
            modifier(ObsidianGlassModifier(level: level, glowColor: glowColor))
        } else {
            // Fallback to existing glass modifiers
            switch level {
            case .subtle: self.glassSubtle()
            case .content: self.glassContent()
            case .overlay: self.glassOverlay()
            }
        }
    }
}
```

**Verification**: Modifiers compile and fall back correctly on iOS 16

### Task 4: Update Shader Demo View

Update `Opta Scan/Views/Debug/ShaderDemoView.swift` to include glass shader controls:

Add a new section to the demo view:

```swift
// Add to ShaderDemoView
@State private var glassDepth: Double = 0.5
@State private var glassGlowIntensity: Double = 0.3

// Add to body VStack after existing controls:
private var glassSection: some View {
    VStack(alignment: .leading, spacing: OptaDesign.Spacing.md) {
        Text("Obsidian Glass")
            .font(.optaHeadline)
            .foregroundStyle(Color.optaTextPrimary)

        // Sample cards with different glass levels
        HStack(spacing: OptaDesign.Spacing.md) {
            glassLevelCard("Subtle", level: .subtle)
            glassLevelCard("Content", level: .content)
            glassLevelCard("Overlay", level: .overlay)
        }

        VStack(alignment: .leading, spacing: OptaDesign.Spacing.sm) {
            Text("Custom Glass")
                .font(.optaCaption)
                .foregroundStyle(Color.optaTextSecondary)

            Text("Depth: \(glassDepth, specifier: "%.2f")")
                .font(.optaLabel)
                .foregroundStyle(Color.optaTextMuted)
            Slider(value: $glassDepth, in: 0...1)
                .tint(.optaPurple)

            Text("Glow: \(glassGlowIntensity, specifier: "%.2f")")
                .font(.optaLabel)
                .foregroundStyle(Color.optaTextMuted)
            Slider(value: $glassGlowIntensity, in: 0...1)
                .tint(.optaPurple)
        }

        // Custom glass preview
        VStack {
            Image(systemName: "diamond.fill")
                .font(.system(size: 32))
                .foregroundStyle(Color.optaPurple)
            Text("Custom")
                .font(.optaCaption)
        }
        .frame(maxWidth: .infinity)
        .padding(OptaDesign.Spacing.lg)
        .obsidianGlass(
            depth: glassDepth,
            glowColor: .optaPurple,
            glowIntensity: glassGlowIntensity
        )
        .background(.thinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
    .padding(OptaDesign.Spacing.lg)
    .glassContent()
}

private func glassLevelCard(_ title: String, level: ObsidianGlassLevel) -> some View {
    VStack {
        Image(systemName: "cube.fill")
            .font(.system(size: 24))
            .foregroundStyle(Color.optaPurple)
        Text(title)
            .font(.optaLabel)
    }
    .frame(maxWidth: .infinity)
    .padding(OptaDesign.Spacing.md)
    .obsidianGlassStyle(level)
}
```

**Verification**: Demo view shows all three glass levels and custom controls

### Task 5: Integration Test

1. Build project and verify no errors
2. Run on iOS 17+ simulator
3. Navigate to ShaderDemoView
4. Verify:
   - All three glass levels render correctly
   - Custom sliders affect glass appearance
   - Effects are smooth (no frame drops)
   - Effects disabled with Reduce Motion on

## Acceptance Criteria

- [ ] `obsidianGlass` shader function added to Metal file
- [ ] `glassHighlight` shader function added for future use
- [ ] `ObsidianGlassModifier` provides three depth levels
- [ ] `obsidianGlassStyle()` view extension works with fallback
- [ ] Demo view shows interactive glass controls
- [ ] Performance: No frame drops on glass-heavy views
- [ ] Accessibility: Shader effects respect Reduce Motion

## Estimated Scope

- **Files created**: 1 (ObsidianGlassModifiers.swift)
- **Files modified**: 2 (OptaShaders.metal, ShaderEffects.swift)
- **Complexity**: Medium (shader math, geometry reader)
- **Risk**: Low (additive, existing glass still works)

## Notes

- The obsidian effect layers ON TOP of SwiftUI materials (not replacing them)
- Noise amount should be subtle (< 0.05 visible effect) to avoid graininess
- Inner glow uses edge distance calculation for smooth falloff
- GeometryReader is required to pass view size to shader
