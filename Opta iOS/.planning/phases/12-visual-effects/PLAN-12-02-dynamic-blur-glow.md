# Plan 12-02: Dynamic Blur and Glow Effects

## Goal

Create dynamic blur intensity, vibrancy overlays, and glow/bloom effects that respond to scroll position and view state.

## Context

Building on the shader and physics systems, this adds:
- Scroll-driven blur intensity
- Vibrancy overlays for glass effects
- Glow and bloom effects for highlights
- State-driven visual feedback

## Implementation

### Step 1: Create Dynamic Blur Modifier

Create `Opta Scan/Design/DynamicBlurEffects.swift`:

```swift
//
//  DynamicBlurEffects.swift
//  Opta Scan
//
//  Dynamic blur and glow effects based on scroll and state
//  Part of Phase 12: Visual Effects
//

import SwiftUI

// MARK: - Scroll-Driven Blur

/// Tracks scroll position for blur effects
@Observable
class ScrollBlurState {
    var scrollOffset: CGFloat = 0
    var maxBlurOffset: CGFloat = 200

    /// Current blur amount based on scroll
    var blurAmount: CGFloat {
        let normalized = min(abs(scrollOffset) / maxBlurOffset, 1.0)
        return normalized * 20 // Max 20pt blur
    }

    /// Opacity for fading elements during scroll
    var fadeOpacity: CGFloat {
        let normalized = min(abs(scrollOffset) / maxBlurOffset, 1.0)
        return 1.0 - (normalized * 0.5) // Fade to 50%
    }
}

/// Modifier for scroll-driven blur
struct ScrollBlurModifier: ViewModifier {
    @Bindable var state: ScrollBlurState
    let isEnabled: Bool

    func body(content: Content) -> some View {
        content
            .blur(radius: isEnabled ? state.blurAmount : 0)
            .opacity(isEnabled ? state.fadeOpacity : 1.0)
            .animation(.optaSpring, value: state.scrollOffset)
    }
}

extension View {
    /// Apply scroll-driven blur effect
    func scrollBlur(_ state: ScrollBlurState, isEnabled: Bool = true) -> some View {
        modifier(ScrollBlurModifier(state: state, isEnabled: isEnabled))
    }
}

// MARK: - Preference Key for Scroll Offset

struct ScrollOffsetPreferenceKey: PreferenceKey {
    static var defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = nextValue()
    }
}

extension View {
    /// Track scroll offset and update blur state
    func trackScrollOffset(_ state: ScrollBlurState, coordinateSpace: CoordinateSpace = .global) -> some View {
        self.background(
            GeometryReader { geometry in
                Color.clear
                    .preference(
                        key: ScrollOffsetPreferenceKey.self,
                        value: geometry.frame(in: coordinateSpace).minY
                    )
            }
        )
        .onPreferenceChange(ScrollOffsetPreferenceKey.self) { offset in
            state.scrollOffset = offset
        }
    }
}
```

### Step 2: Create Glow Effect System

Add to DynamicBlurEffects.swift:

```swift
// MARK: - Glow Effects

/// Configuration for glow effect
struct GlowConfig {
    let color: Color
    let radius: CGFloat
    let opacity: Double
    let layers: Int

    static let subtle = GlowConfig(
        color: .optaPurple,
        radius: 8,
        opacity: 0.3,
        layers: 2
    )

    static let medium = GlowConfig(
        color: .optaPurple,
        radius: 15,
        opacity: 0.4,
        layers: 3
    )

    static let intense = GlowConfig(
        color: .optaPurple,
        radius: 25,
        opacity: 0.5,
        layers: 4
    )

    static let success = GlowConfig(
        color: .optaGreen,
        radius: 20,
        opacity: 0.5,
        layers: 3
    )
}

/// Multi-layer glow effect modifier
struct GlowModifier: ViewModifier {
    let config: GlowConfig
    let isActive: Bool

    func body(content: Content) -> some View {
        content
            .background {
                if isActive {
                    ForEach(0..<config.layers, id: \.self) { layer in
                        content
                            .blur(radius: config.radius * CGFloat(layer + 1) / CGFloat(config.layers))
                            .opacity(config.opacity / Double(layer + 1))
                    }
                }
            }
    }
}

extension View {
    /// Apply multi-layer glow effect
    func optaGlow(_ config: GlowConfig = .medium, isActive: Bool = true) -> some View {
        modifier(GlowModifier(config: config, isActive: isActive))
    }

    /// Animated glow that pulses
    func pulsingGlowEffect(
        color: Color = .optaPurple,
        isActive: Bool
    ) -> some View {
        self.modifier(AnimatedGlowModifier(color: color, isActive: isActive))
    }
}

/// Animated pulsing glow
struct AnimatedGlowModifier: ViewModifier {
    let color: Color
    let isActive: Bool

    @State private var glowIntensity: Double = 0.3

    func body(content: Content) -> some View {
        content
            .shadow(color: color.opacity(isActive ? glowIntensity : 0), radius: 15)
            .shadow(color: color.opacity(isActive ? glowIntensity * 0.5 : 0), radius: 30)
            .onAppear {
                if isActive {
                    withAnimation(.easeInOut(duration: 1.5).repeatForever(autoreverses: true)) {
                        glowIntensity = 0.6
                    }
                }
            }
            .onChange(of: isActive) { _, newValue in
                if newValue {
                    withAnimation(.easeInOut(duration: 1.5).repeatForever(autoreverses: true)) {
                        glowIntensity = 0.6
                    }
                } else {
                    withAnimation(.easeOut(duration: 0.3)) {
                        glowIntensity = 0.3
                    }
                }
            }
    }
}
```

### Step 3: Create Vibrancy Overlay

Add to DynamicBlurEffects.swift:

```swift
// MARK: - Vibrancy Overlays

/// Vibrancy effect for glass-like overlays
struct VibrancyOverlay: ViewModifier {
    let intensity: Double
    let isEnabled: Bool

    func body(content: Content) -> some View {
        content
            .overlay {
                if isEnabled {
                    Rectangle()
                        .fill(.ultraThinMaterial)
                        .opacity(intensity)
                        .blendMode(.overlay)
                        .allowsHitTesting(false)
                }
            }
    }
}

extension View {
    /// Add vibrancy overlay effect
    func vibrancyOverlay(intensity: Double = 0.3, isEnabled: Bool = true) -> some View {
        modifier(VibrancyOverlay(intensity: intensity, isEnabled: isEnabled))
    }
}

// MARK: - Bloom Effect

/// Bloom/HDR-like effect for bright elements
struct BloomModifier: ViewModifier {
    let threshold: Double
    let intensity: Double
    let radius: CGFloat

    func body(content: Content) -> some View {
        content
            .background {
                content
                    .blur(radius: radius)
                    .opacity(intensity)
                    .blendMode(.screen)
            }
    }
}

extension View {
    /// Apply bloom effect to bright areas
    func bloom(intensity: Double = 0.5, radius: CGFloat = 10) -> some View {
        modifier(BloomModifier(threshold: 0.8, intensity: intensity, radius: radius))
    }
}
```

### Step 4: Add Files to Xcode Project

Add DynamicBlurEffects.swift to Design group.

## Files to Create/Modify

| File | Action |
|------|--------|
| `Opta Scan/Design/DynamicBlurEffects.swift` | Create |
| `Opta Scan.xcodeproj/project.pbxproj` | Modify - add new file |

## Verification

1. Build succeeds
2. Scroll blur responds smoothly to scroll position
3. Glow effects render with multiple layers
4. Vibrancy overlays enhance glass effects

## Dependencies

- Phase 11 complete
- SwiftUI blur and blend modes
