# Plan 10-03: Animated Gradient & Glow Effects

## Overview

**Phase**: 10 - Metal Shaders
**Plan**: 03 of 03
**Goal**: Create animated shader effects including flowing gradients, pulsing glow, and processing state indicators

## Context

This plan adds time-based animations to Metal shaders for premium visual polish. Key use cases:
- **Processing states**: Animated glow while Claude is analyzing
- **Ambient effects**: Subtle gradient flow on hero elements
- **Attention states**: Pulsing borders for important UI elements

**Current state**: Static shader effects from Plans 10-01 and 10-02
**Target state**: Animated shader effects with TimelineView integration

## Dependencies

- Plan 10-01 complete (shader foundation)
- Plan 10-02 complete (glass shaders)
- `OptaShaders.metal` exists
- `ShaderEffects.swift` exists

## Tasks

### Task 1: Add Animated Shaders to Metal File

Add to `Opta Scan/Shaders/OptaShaders.metal`:

```metal
// MARK: - Animated Gradient Flow
// Creates a flowing gradient effect driven by time

[[ stitchable ]] half4 gradientFlow(
    float2 position,
    half4 color,
    float2 size,
    float time,            // Time in seconds
    half4 color1,          // Start gradient color
    half4 color2,          // End gradient color
    float speed,           // Flow speed
    float angle            // Flow direction in radians
) {
    float2 uv = position / size;

    // Create flowing pattern
    float2 dir = float2(cos(angle), sin(angle));
    float flow = dot(uv, dir) + time * speed;

    // Smooth oscillating gradient
    float t = sin(flow * 3.14159) * 0.5 + 0.5;

    // Mix gradient colors
    half4 gradientColor = mix(color1, color2, half(t));

    // Blend with original color
    half4 result = color;
    result.rgb = mix(result.rgb, gradientColor.rgb * result.a, half(0.3));

    return result;
}

// MARK: - Pulsing Glow Effect
// Creates a pulsing glow effect for processing states

[[ stitchable ]] half4 pulsingGlow(
    float2 position,
    half4 color,
    float2 size,
    float time,
    half4 glowColor,
    float pulseSpeed,      // Pulses per second
    float minIntensity,    // Minimum glow (0-1)
    float maxIntensity     // Maximum glow (0-1)
) {
    float2 uv = position / size;

    // Calculate edge distance for glow
    float2 edgeDist = min(uv, 1.0 - uv);
    float edge = min(edgeDist.x, edgeDist.y);

    // Pulsing intensity
    float pulse = sin(time * pulseSpeed * 6.28318) * 0.5 + 0.5;
    float intensity = mix(minIntensity, maxIntensity, pulse);

    // Edge glow with pulse
    float glowFactor = (1.0 - smoothstep(0.0, 0.12, edge)) * intensity;

    // Apply glow
    half4 result = color;
    result.rgb = mix(result.rgb, glowColor.rgb * result.a, half(glowFactor));

    return result;
}

// MARK: - Shimmer Effect
// Creates a shimmer/shine sweep across the view

[[ stitchable ]] half4 shimmer(
    float2 position,
    half4 color,
    float2 size,
    float time,
    float width,           // Shimmer band width (0-1)
    float speed,           // Sweep speed
    float intensity        // Shimmer brightness
) {
    float2 uv = position / size;

    // Moving shimmer position (loops every cycle)
    float shimmerPos = fract(time * speed);

    // Distance from shimmer band (diagonal sweep)
    float diagPos = (uv.x + uv.y) * 0.5;
    float dist = abs(diagPos - shimmerPos);

    // Soft shimmer band
    float shimmerFactor = 1.0 - smoothstep(0.0, width, dist);
    shimmerFactor *= intensity;

    // Add shimmer highlight
    half4 result = color;
    result.rgb += half(shimmerFactor * 0.15);

    return result;
}

// MARK: - Breathing Glow
// Smooth, slow pulsing for ambient effects

[[ stitchable ]] half4 breathingGlow(
    float2 position,
    half4 color,
    float time,
    half4 glowColor,
    float breathSpeed      // Breath cycles per second
) {
    // Smooth sine wave breathing
    float breath = sin(time * breathSpeed * 6.28318) * 0.5 + 0.5;
    breath = breath * breath; // Ease in-out

    // Subtle color shift
    half4 result = color;
    result.rgb = mix(result.rgb, glowColor.rgb * result.a, half(breath * 0.15));

    return result;
}
```

**Verification**: Metal file compiles without errors

### Task 2: Create Animated Shader Extensions

Add to `Opta Scan/Design/ShaderEffects.swift`:

```swift
// MARK: - Animated Shader Effects

@available(iOS 17.0, *)
extension View {
    /// Apply animated flowing gradient effect
    /// - Parameters:
    ///   - time: Current animation time (from TimelineView)
    ///   - color1: First gradient color
    ///   - color2: Second gradient color
    ///   - speed: Flow speed (default: 0.5)
    ///   - angle: Flow direction in degrees (default: 45)
    func gradientFlow(
        time: Double,
        color1: Color = .optaPurple,
        color2: Color = .optaBlue,
        speed: Double = 0.5,
        angle: Double = 45,
        isEnabled: Bool = true
    ) -> some View {
        let resolved1 = color1.resolve(in: EnvironmentValues())
        let resolved2 = color2.resolve(in: EnvironmentValues())
        return GeometryReader { geometry in
            self.colorEffect(
                ShaderLibrary.gradientFlow(
                    .float2(geometry.size.width, geometry.size.height),
                    .float(time),
                    .color(resolved1),
                    .color(resolved2),
                    .float(speed),
                    .float(angle * .pi / 180)
                ),
                isEnabled: isEnabled && OptaShaderEffects.isEnabled
            )
        }
    }

    /// Apply pulsing glow effect for processing states
    /// - Parameters:
    ///   - time: Current animation time
    ///   - glowColor: Glow color (default: purple)
    ///   - pulseSpeed: Pulses per second (default: 1.5)
    ///   - minIntensity: Minimum glow 0-1 (default: 0.2)
    ///   - maxIntensity: Maximum glow 0-1 (default: 0.6)
    func pulsingGlow(
        time: Double,
        glowColor: Color = .optaPurpleGlow,
        pulseSpeed: Double = 1.5,
        minIntensity: Double = 0.2,
        maxIntensity: Double = 0.6,
        isEnabled: Bool = true
    ) -> some View {
        let resolved = glowColor.resolve(in: EnvironmentValues())
        return GeometryReader { geometry in
            self.colorEffect(
                ShaderLibrary.pulsingGlow(
                    .float2(geometry.size.width, geometry.size.height),
                    .float(time),
                    .color(resolved),
                    .float(pulseSpeed),
                    .float(minIntensity),
                    .float(maxIntensity)
                ),
                isEnabled: isEnabled && OptaShaderEffects.isEnabled
            )
        }
    }

    /// Apply shimmer sweep effect
    /// - Parameters:
    ///   - time: Current animation time
    ///   - width: Shimmer band width 0-1 (default: 0.2)
    ///   - speed: Sweep speed (default: 0.3)
    ///   - intensity: Shimmer brightness 0-1 (default: 0.5)
    func shimmer(
        time: Double,
        width: Double = 0.2,
        speed: Double = 0.3,
        intensity: Double = 0.5,
        isEnabled: Bool = true
    ) -> some View {
        GeometryReader { geometry in
            self.colorEffect(
                ShaderLibrary.shimmer(
                    .float2(geometry.size.width, geometry.size.height),
                    .float(time),
                    .float(width),
                    .float(speed),
                    .float(intensity)
                ),
                isEnabled: isEnabled && OptaShaderEffects.isEnabled
            )
        }
    }

    /// Apply subtle breathing glow for ambient effects
    /// - Parameters:
    ///   - time: Current animation time
    ///   - glowColor: Glow color
    ///   - speed: Breath cycles per second (default: 0.5)
    func breathingGlow(
        time: Double,
        glowColor: Color = .optaPurple,
        speed: Double = 0.5,
        isEnabled: Bool = true
    ) -> some View {
        let resolved = glowColor.resolve(in: EnvironmentValues())
        return self.colorEffect(
            ShaderLibrary.breathingGlow(
                .float(time),
                .color(resolved),
                .float(speed)
            ),
            isEnabled: isEnabled && OptaShaderEffects.isEnabled
        )
    }
}
```

**Verification**: Extensions compile correctly

### Task 3: Create Processing State Component

Create `Opta Scan/Views/Components/ProcessingGlowView.swift`:

```swift
//
//  ProcessingGlowView.swift
//  Opta Scan
//
//  Animated glow effect for processing/loading states
//  Part of Phase 10: Metal Shaders
//

import SwiftUI

/// Wraps content with an animated pulsing glow when processing
@available(iOS 17.0, *)
struct ProcessingGlowView<Content: View>: View {
    let isProcessing: Bool
    let glowColor: Color
    @ViewBuilder let content: () -> Content

    @State private var animationTime: Double = 0

    init(
        isProcessing: Bool,
        glowColor: Color = .optaPurpleGlow,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.isProcessing = isProcessing
        self.glowColor = glowColor
        self.content = content
    }

    var body: some View {
        TimelineView(.animation(minimumInterval: 1/60, paused: !isProcessing)) { timeline in
            content()
                .pulsingGlow(
                    time: timeline.date.timeIntervalSinceReferenceDate,
                    glowColor: glowColor,
                    pulseSpeed: 1.5,
                    minIntensity: 0.15,
                    maxIntensity: 0.5,
                    isEnabled: isProcessing
                )
        }
    }
}

/// Convenience modifier for processing glow
@available(iOS 17.0, *)
extension View {
    /// Add processing glow animation when condition is true
    func processingGlow(
        _ isProcessing: Bool,
        color: Color = .optaPurpleGlow
    ) -> some View {
        ProcessingGlowView(isProcessing: isProcessing, glowColor: color) {
            self
        }
    }
}

// MARK: - iOS 16 Fallback

extension View {
    /// Processing glow with iOS 16 fallback (uses opacity animation)
    @ViewBuilder
    func optaProcessingGlow(_ isProcessing: Bool) -> some View {
        if #available(iOS 17.0, *) {
            self.processingGlow(isProcessing)
        } else {
            // Fallback: simple opacity pulse
            self.overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(Color.optaPurpleGlow, lineWidth: 2)
                    .opacity(isProcessing ? 0.6 : 0)
                    .animation(
                        isProcessing ?
                            .easeInOut(duration: 0.8).repeatForever(autoreverses: true) :
                            .default,
                        value: isProcessing
                    )
            )
        }
    }
}
```

**Verification**: Component compiles and provides fallback

### Task 4: Create Ambient Gradient Component

Create `Opta Scan/Views/Components/AmbientGradientView.swift`:

```swift
//
//  AmbientGradientView.swift
//  Opta Scan
//
//  Animated ambient gradient for hero/highlight elements
//  Part of Phase 10: Metal Shaders
//

import SwiftUI

/// Adds subtle animated gradient flow to content
@available(iOS 17.0, *)
struct AmbientGradientView<Content: View>: View {
    let isAnimating: Bool
    let color1: Color
    let color2: Color
    let speed: Double
    @ViewBuilder let content: () -> Content

    init(
        isAnimating: Bool = true,
        color1: Color = .optaPurple,
        color2: Color = .optaBlue,
        speed: Double = 0.3,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.isAnimating = isAnimating
        self.color1 = color1
        self.color2 = color2
        self.speed = speed
        self.content = content
    }

    var body: some View {
        TimelineView(.animation(minimumInterval: 1/30, paused: !isAnimating)) { timeline in
            content()
                .gradientFlow(
                    time: timeline.date.timeIntervalSinceReferenceDate,
                    color1: color1,
                    color2: color2,
                    speed: speed,
                    isEnabled: isAnimating
                )
        }
    }
}

/// Convenience modifier for ambient gradient
@available(iOS 17.0, *)
extension View {
    /// Add ambient flowing gradient effect
    func ambientGradient(
        _ isAnimating: Bool = true,
        colors: (Color, Color) = (.optaPurple, .optaBlue),
        speed: Double = 0.3
    ) -> some View {
        AmbientGradientView(
            isAnimating: isAnimating,
            color1: colors.0,
            color2: colors.1,
            speed: speed
        ) {
            self
        }
    }
}
```

**Verification**: Component compiles correctly

### Task 5: Update Demo View with Animated Effects

Update `Opta Scan/Views/Debug/ShaderDemoView.swift` to add animated effect section:

```swift
// Add state variables
@State private var isProcessing = false
@State private var animationTime: Double = 0

// Add to body VStack:
private var animatedSection: some View {
    VStack(alignment: .leading, spacing: OptaDesign.Spacing.md) {
        Text("Animated Effects")
            .font(.optaHeadline)
            .foregroundStyle(Color.optaTextPrimary)

        // Processing glow demo
        VStack(spacing: OptaDesign.Spacing.sm) {
            Text("Processing Glow")
                .font(.optaCaption)
                .foregroundStyle(Color.optaTextSecondary)

            HStack(spacing: OptaDesign.Spacing.md) {
                VStack {
                    Image(systemName: "brain.head.profile")
                        .font(.system(size: 32))
                        .foregroundStyle(Color.optaPurple)
                    Text("Analyzing...")
                        .font(.optaCaption)
                }
                .frame(maxWidth: .infinity)
                .padding(OptaDesign.Spacing.lg)
                .glassContent()
                .optaProcessingGlow(isProcessing)

                Toggle("", isOn: $isProcessing)
                    .labelsHidden()
                    .tint(.optaPurple)
            }
        }

        // Gradient flow demo
        TimelineView(.animation(minimumInterval: 1/30)) { timeline in
            VStack(spacing: OptaDesign.Spacing.sm) {
                Text("Gradient Flow")
                    .font(.optaCaption)
                    .foregroundStyle(Color.optaTextSecondary)

                HStack(spacing: OptaDesign.Spacing.md) {
                    gradientDemoCard(
                        time: timeline.date.timeIntervalSinceReferenceDate,
                        colors: (.optaPurple, .optaBlue),
                        label: "Purple-Blue"
                    )
                    gradientDemoCard(
                        time: timeline.date.timeIntervalSinceReferenceDate,
                        colors: (.optaGreen, .optaBlue),
                        label: "Green-Blue"
                    )
                }
            }
        }

        // Shimmer demo
        TimelineView(.animation(minimumInterval: 1/60)) { timeline in
            VStack(spacing: OptaDesign.Spacing.sm) {
                Text("Shimmer Effect")
                    .font(.optaCaption)
                    .foregroundStyle(Color.optaTextSecondary)

                HStack {
                    Image(systemName: "sparkle")
                        .font(.system(size: 24))
                    Text("Premium Feature")
                        .font(.optaBody)
                }
                .foregroundStyle(Color.optaTextPrimary)
                .frame(maxWidth: .infinity)
                .padding(OptaDesign.Spacing.lg)
                .glassContent()
                .shimmer(
                    time: timeline.date.timeIntervalSinceReferenceDate,
                    width: 0.15,
                    speed: 0.4,
                    intensity: 0.6
                )
            }
        }
    }
    .padding(OptaDesign.Spacing.lg)
    .glassContent()
}

private func gradientDemoCard(
    time: Double,
    colors: (Color, Color),
    label: String
) -> some View {
    VStack {
        Circle()
            .fill(colors.0)
            .frame(width: 24, height: 24)
        Text(label)
            .font(.optaLabel)
    }
    .frame(maxWidth: .infinity)
    .padding(OptaDesign.Spacing.md)
    .glassContent()
    .gradientFlow(
        time: time,
        color1: colors.0,
        color2: colors.1,
        speed: 0.3
    )
}
```

**Verification**: Demo shows all animated effects working

### Task 6: Build Verification and Performance Test

1. Build project: `xcodebuild -project "Opta Scan.xcodeproj" -scheme "w" build`
2. Run on iOS 17+ simulator
3. Open ShaderDemoView and verify:
   - Processing glow pulses smoothly
   - Gradient flow animates without stuttering
   - Shimmer sweeps across cards
4. Check CPU/GPU usage in Instruments (should be minimal)
5. Verify effects pause when TimelineView is paused

## Acceptance Criteria

- [ ] `gradientFlow` shader animates smoothly
- [ ] `pulsingGlow` shader creates processing effect
- [ ] `shimmer` shader creates sweep effect
- [ ] `breathingGlow` shader creates ambient effect
- [ ] `ProcessingGlowView` component works with TimelineView
- [ ] `AmbientGradientView` component works with TimelineView
- [ ] iOS 16 fallback uses opacity animation
- [ ] Animations pause when view is not visible
- [ ] Performance: < 5% CPU on animation, 60fps maintained
- [ ] Accessibility: Effects disabled with Reduce Motion

## Estimated Scope

- **Files created**: 2 (ProcessingGlowView.swift, AmbientGradientView.swift)
- **Files modified**: 2 (OptaShaders.metal, ShaderEffects.swift)
- **Complexity**: Medium (TimelineView integration, performance tuning)
- **Risk**: Low (additive, no breaking changes)

## Notes

- TimelineView drives animations efficiently (pauses when not visible)
- Animation frame rate can be throttled (1/30 for gradients, 1/60 for glow)
- All animated shaders accept `isEnabled` parameter for conditional use
- Shimmer effect is great for skeleton loading states
- Consider using `breathingGlow` for idle states, `pulsingGlow` for active processing
