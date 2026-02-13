//
//  MotionModifiers.swift
//  OptaMolt
//
//  Cinematic Void motion modifiers — continuous ambient animations
//  that bring the UI to life. All modifiers respect accessibilityReduceMotion.
//
//  Usage:
//  ```swift
//  BotAvatar()
//      .ambientFloat()
//      .breathe()
//
//  ChatList()
//      .gradientFade(edges: [.top, .bottom])
//  ```
//

import SwiftUI

// MARK: - Edge Set for Gradient Fade

/// Edges where gradient fade can be applied.
public struct FadeEdge: OptionSet, Sendable {
    public let rawValue: Int
    public init(rawValue: Int) { self.rawValue = rawValue }

    public static let top      = FadeEdge(rawValue: 1 << 0)
    public static let bottom   = FadeEdge(rawValue: 1 << 1)
    public static let leading  = FadeEdge(rawValue: 1 << 2)
    public static let trailing = FadeEdge(rawValue: 1 << 3)

    /// Fade both vertical edges.
    public static let vertical: FadeEdge = [.top, .bottom]
    /// Fade both horizontal edges.
    public static let horizontal: FadeEdge = [.leading, .trailing]
    /// Fade all edges.
    public static let all: FadeEdge = [.top, .bottom, .leading, .trailing]
}

// MARK: - Ambient Float

/// Subtle continuous Y oscillation using a sine wave (~3-4px amplitude, ~4s cycle).
///
/// Creates the "floating in void" effect for elements that should feel alive.
/// Uses `TimelineView(.animation)` for smooth continuous motion.
public struct AmbientFloatModifier: ViewModifier {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// Amplitude in points (half the total travel).
    let amplitude: CGFloat
    /// Duration of one full cycle in seconds.
    let period: Double

    public init(amplitude: CGFloat = 3.5, period: Double = 4.0) {
        self.amplitude = amplitude
        self.period = period
    }

    public func body(content: Content) -> some View {
        if reduceMotion {
            content
        } else {
            TimelineView(.animation) { timeline in
                let elapsed = timeline.date.timeIntervalSinceReferenceDate
                let phase = elapsed.remainder(dividingBy: period) / period
                let offset = sin(phase * .pi * 2) * amplitude

                content
                    .offset(y: offset)
            }
        }
    }
}

// MARK: - Hover Glow

/// On macOS hover, applies a soft colored glow shadow behind the element.
///
/// The glow fades in/out with `.optaSnap` spring timing.
public struct HoverGlowModifier: ViewModifier {
    let color: Color
    let radius: CGFloat
    @State private var isHovered = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    public init(color: Color, radius: CGFloat = 20) {
        self.color = color
        self.radius = radius
    }

    public func body(content: Content) -> some View {
        content
            .shadow(
                color: color.opacity(isHovered ? 0.6 : 0),
                radius: isHovered ? radius : radius * 0.5
            )
            .onHover { hovering in
                if reduceMotion {
                    isHovered = hovering
                } else {
                    withAnimation(.optaSnap) {
                        isHovered = hovering
                    }
                }
            }
    }
}

// MARK: - Breathe

/// Subtle continuous scale pulse (0.98 → 1.02) on a sine wave (~3s cycle).
///
/// Gives elements a living, breathing quality while idle.
public struct BreatheModifier: ViewModifier {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    let minScale: CGFloat
    let maxScale: CGFloat
    let period: Double

    public init(minScale: CGFloat = 0.98, maxScale: CGFloat = 1.02, period: Double = 3.0) {
        self.minScale = minScale
        self.maxScale = maxScale
        self.period = period
    }

    public func body(content: Content) -> some View {
        if reduceMotion {
            content
        } else {
            TimelineView(.animation) { timeline in
                let elapsed = timeline.date.timeIntervalSinceReferenceDate
                let phase = elapsed.remainder(dividingBy: period) / period
                let t = (sin(phase * .pi * 2) + 1) / 2 // normalize 0→1
                let scale = minScale + (maxScale - minScale) * t

                content
                    .scaleEffect(scale)
            }
        }
    }
}

// MARK: - Gradient Fade

/// Applies a gradient mask that fades content to transparent at specified edges.
///
/// Creates the "gradient-to-void" dissolve effect — content emerges from
/// and disappears into the void rather than having hard boundaries.
public struct GradientFadeModifier: ViewModifier {
    let edges: FadeEdge
    /// How far the fade extends inward (in fraction of view size, 0→1).
    let fadeLength: CGFloat

    public init(edges: FadeEdge, fadeLength: CGFloat = 0.08) {
        self.edges = edges
        self.fadeLength = fadeLength
    }

    public func body(content: Content) -> some View {
        content
            .mask {
                // Vertical gradient
                let verticalMask = LinearGradient(
                    stops: verticalStops(),
                    startPoint: .top,
                    endPoint: .bottom
                )
                // Horizontal gradient
                let horizontalMask = LinearGradient(
                    stops: horizontalStops(),
                    startPoint: .leading,
                    endPoint: .trailing
                )

                Rectangle()
                    .fill(verticalMask)
                    .mask { Rectangle().fill(horizontalMask) }
            }
    }

    private func verticalStops() -> [Gradient.Stop] {
        let fadeTop = edges.contains(.top)
        let fadeBottom = edges.contains(.bottom)
        return [
            .init(color: fadeTop ? .clear : .white, location: 0),
            .init(color: .white, location: fadeTop ? fadeLength : 0),
            .init(color: .white, location: fadeBottom ? 1 - fadeLength : 1),
            .init(color: fadeBottom ? .clear : .white, location: 1),
        ]
    }

    private func horizontalStops() -> [Gradient.Stop] {
        let fadeLead = edges.contains(.leading)
        let fadeTrail = edges.contains(.trailing)
        return [
            .init(color: fadeLead ? .clear : .white, location: 0),
            .init(color: .white, location: fadeLead ? fadeLength : 0),
            .init(color: .white, location: fadeTrail ? 1 - fadeLength : 1),
            .init(color: fadeTrail ? .clear : .white, location: 1),
        ]
    }
}

// MARK: - Motion Config (Reduce Motion Support)

/// Shared configuration for motion throughout the app.
/// All views should reference this to respect reduce motion settings.
public struct MotionConfig {
    /// Whether to use full animations (false when reduce motion is on).
    public let animationsEnabled: Bool
    /// Whether ambient/continuous animations should run.
    public let ambientEnabled: Bool
    /// Whether repeating animations (pulse, breathe) should run.
    public let repeatingEnabled: Bool

    /// Full motion — all animations enabled.
    public static let full = MotionConfig(animationsEnabled: true, ambientEnabled: true, repeatingEnabled: true)
    /// Reduced motion — opacity-only transitions, no ambient or repeating.
    public static let reduced = MotionConfig(animationsEnabled: false, ambientEnabled: false, repeatingEnabled: false)

    /// Create from the accessibility reduce motion setting.
    public static func from(reduceMotion: Bool) -> MotionConfig {
        reduceMotion ? .reduced : .full
    }
}

// MARK: - Opta Entrance

/// Standard view entrance: fade + slide up + scale with spring.
public struct OptaEntranceModifier: ViewModifier {
    @State private var appeared = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let delay: Double

    public init(delay: Double = 0) { self.delay = delay }

    public func body(content: Content) -> some View {
        content
            .opacity(appeared ? 1 : 0)
            .offset(y: appeared ? 0 : 20)
            .scaleEffect(appeared ? 1 : 0.95)
            .onAppear {
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

// MARK: - Opta Exit

/// Standard view exit: fade + slide down + scale.
public struct OptaExitModifier: ViewModifier {
    let isPresented: Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    public init(isPresented: Bool) { self.isPresented = isPresented }

    public func body(content: Content) -> some View {
        content
            .opacity(isPresented ? 1 : 0)
            .offset(y: isPresented ? 0 : 10)
            .scaleEffect(isPresented ? 1 : 0.97)
            .animation(reduceMotion ? .none : .optaSpring, value: isPresented)
    }
}

// MARK: - Opta Pulse

/// Gentle repeating opacity pulse for loading/active states.
public struct OptaPulseModifier: ViewModifier {
    @State private var isPulsing = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    public func body(content: Content) -> some View {
        content
            .opacity(isPulsing && !reduceMotion ? 0.5 : 1.0)
            .onAppear {
                guard !reduceMotion else { return }
                withAnimation(.optaPulse) {
                    isPulsing = true
                }
            }
    }
}

// MARK: - View Extension

public extension View {

    /// Subtle continuous Y oscillation — elements float in the void.
    ///
    /// - Parameters:
    ///   - amplitude: Peak offset in points (default 3.5).
    ///   - period: Full cycle duration in seconds (default 4).
    func ambientFloat(amplitude: CGFloat = 3.5, period: Double = 4.0) -> some View {
        modifier(AmbientFloatModifier(amplitude: amplitude, period: period))
    }

    /// On hover, add a soft colored glow shadow behind the element.
    ///
    /// - Parameters:
    ///   - color: The glow color (typically the bot's accent color).
    ///   - radius: Blur radius of the glow (default 20).
    func hoverGlow(color: Color = .optaPrimary, radius: CGFloat = 20) -> some View {
        modifier(HoverGlowModifier(color: color, radius: radius))
    }

    /// Subtle continuous scale pulse — the element breathes.
    ///
    /// - Parameters:
    ///   - minScale: Minimum scale (default 0.98).
    ///   - maxScale: Maximum scale (default 1.02).
    ///   - period: Full cycle in seconds (default 3).
    func breathe(minScale: CGFloat = 0.98, maxScale: CGFloat = 1.02, period: Double = 3.0) -> some View {
        modifier(BreatheModifier(minScale: minScale, maxScale: maxScale, period: period))
    }

    /// Fade content to transparent at the specified edges (gradient-to-void dissolve).
    func gradientFade(edges: FadeEdge = .vertical, fadeLength: CGFloat = 0.08) -> some View {
        modifier(GradientFadeModifier(edges: edges, fadeLength: fadeLength))
    }

    /// Standard view entrance — fade + slide up + scale with spring.
    func optaEntrance(delay: Double = 0) -> some View {
        modifier(OptaEntranceModifier(delay: delay))
    }

    /// Standard view exit — fade + slide down + scale (bind to presentation state).
    func optaExit(isPresented: Bool) -> some View {
        modifier(OptaExitModifier(isPresented: isPresented))
    }

    /// Gentle repeating opacity pulse for loading/active states.
    func optaPulse() -> some View {
        modifier(OptaPulseModifier())
    }
}
