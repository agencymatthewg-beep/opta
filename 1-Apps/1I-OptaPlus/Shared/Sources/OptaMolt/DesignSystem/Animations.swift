//
//  Animations.swift
//  OptaMolt
//
//  Opta design system animation tokens.
//  Standardised spring and timing curves for consistent motion language.
//
//  Usage:
//  ```swift
//  withAnimation(.optaSpring) {
//      isExpanded.toggle()
//  }
//  ```
//

import SwiftUI

// MARK: - Opta Animation Tokens

public extension Animation {

    /// Standard Opta spring animation.
    ///
    /// A responsive spring with moderate bounce — used for toggles, expansion,
    /// copy confirmations, and interactive transitions throughout the design system.
    ///
    /// Parameters: response 0.3s, dampingFraction 0.7 (slight bounce).
    static let optaSpring: Animation = .spring(response: 0.3, dampingFraction: 0.7)

    /// Snappy Opta spring — slightly faster with more damping.
    ///
    /// Good for small state changes like button presses and icon swaps.
    ///
    /// Parameters: response 0.2, dampingFraction 0.8.
    static let optaSnap: Animation = .spring(response: 0.2, dampingFraction: 0.8)

    /// Gentle Opta spring — slower with less bounce.
    ///
    /// Suited for large-scale layout shifts and full-screen transitions.
    ///
    /// Parameters: response 0.5, dampingFraction 0.85.
    static let optaGentle: Animation = .spring(response: 0.5, dampingFraction: 0.85)

    /// Pulse animation — gentle spring-based repeating for loading/active states.
    /// Uses an underdamped spring that naturally oscillates, approximating a breathing feel.
    static let optaPulse: Animation = .spring(response: 0.6, dampingFraction: 0.4).repeatForever(autoreverses: true)

    /// Continuous rotation — the one case where linear is physics-correct
    /// (constant angular velocity has no acceleration to spring toward).
    static let optaSpin: Animation = .linear(duration: 1.0).repeatForever(autoreverses: false)
}

// MARK: - Breathing Modifier (Spring-Based Repeating)

/// A PhaseAnimator-based breathing effect using spring physics.
/// Replaces all `.easeInOut(duration: X).repeatForever(autoreverses: true)` patterns.
public struct OptaBreathingModifier: ViewModifier {
    let minOpacity: Double
    let maxOpacity: Double
    let minScale: CGFloat
    let maxScale: CGFloat

    public init(
        minOpacity: Double = 0.4,
        maxOpacity: Double = 1.0,
        minScale: CGFloat = 1.0,
        maxScale: CGFloat = 1.0
    ) {
        self.minOpacity = minOpacity
        self.maxOpacity = maxOpacity
        self.minScale = minScale
        self.maxScale = maxScale
    }

    public func body(content: Content) -> some View {
        content
            .phaseAnimator([false, true]) { view, phase in
                view
                    .opacity(phase ? maxOpacity : minOpacity)
                    .scaleEffect(phase ? maxScale : minScale)
            } animation: { _ in
                .spring(response: 1.2, dampingFraction: 0.5)
            }
    }
}

public extension View {
    /// Spring-physics breathing effect — replaces easeInOut.repeatForever patterns.
    func optaBreathing(
        minOpacity: Double = 0.4,
        maxOpacity: Double = 1.0,
        minScale: CGFloat = 1.0,
        maxScale: CGFloat = 1.0
    ) -> some View {
        modifier(OptaBreathingModifier(
            minOpacity: minOpacity,
            maxOpacity: maxOpacity,
            minScale: minScale,
            maxScale: maxScale
        ))
    }
}
