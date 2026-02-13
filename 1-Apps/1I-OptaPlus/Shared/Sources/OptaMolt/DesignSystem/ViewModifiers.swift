//
//  ViewModifiers.swift
//  OptaMolt
//
//  Opta design system view modifiers — glassmorphism effects and ignition
//  entrance animations. Provides the signature Cinematic Void glassmorphism look
//  with gradient-to-void edges instead of hard borders.
//
//  Usage:
//  ```swift
//  VStack { ... }
//      .glassSubtle()
//
//  MessageBubble(message: msg)
//      .staggeredIgnition(index: 3, isVisible: true)
//
//  Panel()
//      .glass()
//      .glassGlow(color: .optaCoral)
//  ```
//

import SwiftUI

// MARK: - Glassmorphism Modifiers

/// Subtle glassmorphism — thin material with soft gradient border and rounded corners.
///
/// Use on secondary containers such as table headers, chart panels, and
/// card surfaces that sit above `.optaBackground`.
public struct GlassSubtleModifier: ViewModifier {
    public func body(content: Content) -> some View {
        content
            .background {
                RoundedRectangle(cornerRadius: 12)
                    .fill(.ultraThinMaterial)
            }
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(Color.optaGlassBorder.opacity(0.15), lineWidth: 0.5)
            )
    }
}

/// Standard glassmorphism — regular material with soft gradient border.
///
/// Use on primary containers like message bubbles, dialogs, and modal panels.
public struct GlassModifier: ViewModifier {
    public func body(content: Content) -> some View {
        content
            .background {
                RoundedRectangle(cornerRadius: 16)
                    .fill(.thinMaterial)
            }
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(Color.optaGlassBorder.opacity(0.20), lineWidth: 0.5)
            )
    }
}

/// Strong glassmorphism — thicker material with inner glow and prominent shadow.
///
/// Use sparingly on hero elements, popovers, and elements that need maximum
/// depth separation from the background. Features a subtle `optaPrimary` inner glow.
public struct GlassStrongModifier: ViewModifier {
    public func body(content: Content) -> some View {
        content
            .background {
                ZStack {
                    RoundedRectangle(cornerRadius: 20)
                        .fill(.regularMaterial)

                    // Inner glow — subtle primary tint radiating from center
                    RoundedRectangle(cornerRadius: 20)
                        .fill(
                            RadialGradient(
                                colors: [
                                    Color.optaPrimary.opacity(0.06),
                                    Color.clear
                                ],
                                center: .center,
                                startRadius: 0,
                                endRadius: 200
                            )
                        )
                }
            }
            .overlay(
                RoundedRectangle(cornerRadius: 20)
                    .stroke(Color.optaGlassBorder.opacity(0.25), lineWidth: 0.5)
            )
            // Inner shadow effect via inset overlay
            .overlay(
                RoundedRectangle(cornerRadius: 20)
                    .stroke(Color.optaPrimary.opacity(0.08), lineWidth: 1)
                    .blur(radius: 4)
                    .clipShape(RoundedRectangle(cornerRadius: 20))
            )
            .shadow(color: .black.opacity(0.25), radius: 16, y: 8)
    }
}

/// Colored glow modifier — applies a colored shadow behind a glass element.
///
/// Use to give glass panels the bot's accent color glow, creating depth
/// and visual identity per-bot.
public struct GlassGlowModifier: ViewModifier {
    let color: Color
    let radius: CGFloat
    let opacity: Double

    public init(color: Color, radius: CGFloat = 24, opacity: Double = 0.3) {
        self.color = color
        self.radius = radius
        self.opacity = opacity
    }

    public func body(content: Content) -> some View {
        content
            .shadow(color: color.opacity(opacity), radius: radius, y: 4)
            .shadow(color: color.opacity(opacity * 0.4), radius: radius * 2, y: 8)
    }
}

// MARK: - Glass View Extension

public extension View {

    /// Apply subtle glassmorphism (thin material, soft border, 12pt corners).
    func glassSubtle() -> some View {
        modifier(GlassSubtleModifier())
    }

    /// Apply standard glassmorphism (thin material, soft border, 16pt corners).
    func glass() -> some View {
        modifier(GlassModifier())
    }

    /// Apply strong glassmorphism (regular material, inner glow + shadow, 20pt corners).
    func glassStrong() -> some View {
        modifier(GlassStrongModifier())
    }

    /// Apply a colored glow behind a glass element (bot accent shadow).
    ///
    /// - Parameters:
    ///   - color: The glow color (typically the bot's accent color).
    ///   - radius: Blur radius (default 24).
    ///   - opacity: Base opacity of the glow (default 0.3).
    func glassGlow(color: Color = .optaPrimary, radius: CGFloat = 24, opacity: Double = 0.3) -> some View {
        modifier(GlassGlowModifier(color: color, radius: radius, opacity: opacity))
    }
}

// MARK: - Ignition Entrance Animation

/// A wake-from-darkness entrance modifier.
///
/// Elements start fully transparent and translated downward, then spring into
/// position. Respects the system Reduce Motion accessibility setting.
///
/// Parameters:
/// - `delay`: Seconds before the animation starts (default 0).
///
/// Usage:
/// ```swift
/// view.ignition()
/// view.ignition(delay: 0.15)
/// ```
public struct IgnitionModifier: ViewModifier {
    /// Delay before the entrance animation starts.
    let delay: Double

    /// Whether the element has finished animating in.
    @State private var isVisible: Bool = false

    /// Accessibility: skip animation if Reduce Motion is enabled.
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    public init(delay: Double = 0) {
        self.delay = delay
    }

    public func body(content: Content) -> some View {
        content
            .opacity(isVisible ? 1 : 0)
            .offset(y: isVisible ? 0 : 12)
            .onAppear {
                if reduceMotion {
                    isVisible = true
                } else {
                    withAnimation(.optaSpring.delay(delay)) {
                        isVisible = true
                    }
                }
            }
    }
}

/// A staggered version of the ignition modifier for use in lists.
///
/// Each item receives a progressively longer delay based on its index,
/// creating a cascading entrance effect.
///
/// Parameters:
/// - `index`: The item's position in the list (0-based).
/// - `isVisible`: External visibility flag (e.g. from a parent `onAppear`).
/// - `staggerInterval`: Seconds between each item's entrance (default 0.05).
///
/// Usage:
/// ```swift
/// ForEach(items.indices, id: \.self) { i in
///     ItemView(items[i])
///         .staggeredIgnition(index: i, isVisible: true)
/// }
/// ```
public struct StaggeredIgnitionModifier: ViewModifier {
    /// The item's position in the list.
    let index: Int
    /// External visibility trigger.
    let isVisible: Bool
    /// Seconds between each successive item's entrance.
    let staggerInterval: Double

    /// Internal animated state.
    @State private var appeared: Bool = false

    /// Accessibility: skip animation if Reduce Motion is enabled.
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    public init(index: Int, isVisible: Bool, staggerInterval: Double = 0.05) {
        self.index = index
        self.isVisible = isVisible
        self.staggerInterval = staggerInterval
    }

    public func body(content: Content) -> some View {
        content
            .opacity(appeared ? 1 : 0)
            .offset(y: appeared ? 0 : 16)
            .onChange(of: isVisible) { _, visible in
                guard visible else { return }
                let delay = Double(index) * staggerInterval
                if reduceMotion {
                    appeared = true
                } else {
                    withAnimation(.optaSpring.delay(delay)) {
                        appeared = true
                    }
                }
            }
            .onAppear {
                guard isVisible else { return }
                let delay = Double(index) * staggerInterval
                if reduceMotion {
                    appeared = true
                } else {
                    withAnimation(.optaSpring.delay(delay)) {
                        appeared = true
                    }
                }
            }
    }
}

// MARK: - Ignition View Extension

public extension View {

    /// Apply the ignition entrance animation (fade + slide up with spring).
    ///
    /// - Parameter delay: Seconds before the animation starts (default 0).
    /// - Returns: Modified view with entrance animation.
    func ignition(delay: Double = 0) -> some View {
        modifier(IgnitionModifier(delay: delay))
    }

    /// Apply staggered ignition for list items (cascading entrance).
    ///
    /// - Parameters:
    ///   - index: The item's position in the list (0-based).
    ///   - isVisible: External visibility flag triggering the animation.
    ///   - staggerInterval: Seconds between each item's entrance (default 0.05).
    /// - Returns: Modified view with staggered entrance animation.
    func staggeredIgnition(
        index: Int,
        isVisible: Bool,
        staggerInterval: Double = 0.05
    ) -> some View {
        modifier(StaggeredIgnitionModifier(
            index: index,
            isVisible: isVisible,
            staggerInterval: staggerInterval
        ))
    }
}
