//
//  OrganicMotionModifiers.swift
//  OptaApp
//
//  SwiftUI view modifiers for organic motion: pulse, appear, and hover effects.
//  All modifiers respect accessibility reduce-motion and thermal state.
//  Uses OrganicMotion utilities for per-element unique timing.
//

import SwiftUI

// MARK: - OrganicPulseModifier

/// Applies a subtle, continuous scale oscillation unique to each element.
///
/// The pulse phase, duration, and amplitude are derived from the element's ID,
/// ensuring no two elements pulse in synchronization.
///
/// - Reduce-motion: Returns content unchanged (no-op)
/// - Critical thermal: Returns content unchanged (no-op)
private struct OrganicPulseModifier: ViewModifier {

    /// Unique identifier for deriving unique phase/timing
    let id: String

    /// Intensity level controlling amplitude
    let intensity: OrganicIntensity

    /// Accessibility preference
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// Animation state
    @State private var isAnimating = false

    func body(content: Content) -> some View {
        let thermalState = ThermalStateManager.shared.thermalState

        // No-op for reduce-motion or critical thermal
        if reduceMotion || thermalState == .critical {
            content
        } else {
            let phaseOffset = OrganicMotion.phaseOffset(for: id)
            let duration = OrganicMotion.ambientDuration(for: id)
            let amplitudeMultiplier = OrganicMotion.amplitudeMultiplier(for: thermalState)
            let thermalMultiplier = OrganicMotion.thermalMultiplier(for: thermalState)

            // Calculate scale range based on intensity and thermal state
            let scaleRange = intensity.scaleRange
            let minScale = 1.0 - (1.0 - scaleRange.lowerBound) * amplitudeMultiplier
            let maxScale = 1.0 + (scaleRange.upperBound - 1.0) * amplitudeMultiplier

            let targetScale = isAnimating ? maxScale : minScale

            content
                .scaleEffect(targetScale)
                .onAppear {
                    // Delay start by phase offset to prevent sync
                    let initialDelay = phaseOffset * duration * thermalMultiplier
                    DispatchQueue.main.asyncAfter(deadline: .now() + initialDelay) {
                        withAnimation(
                            .easeInOut(duration: duration * thermalMultiplier)
                            .repeatForever(autoreverses: true)
                        ) {
                            isAnimating = true
                        }
                    }
                }
        }
    }
}

// MARK: - OrganicAppearModifier

/// Applies a staggered entrance animation with opacity and vertical translation.
///
/// Elements fade in (0->1) and slide up (8pt -> 0pt) with organic spring physics.
/// Stagger timing uses a sine curve for non-linear, natural-feeling sequences.
///
/// - Reduce-motion: Instant appear (full opacity, no translation)
private struct OrganicAppearModifier: ViewModifier {

    /// Position in the stagger sequence (0-based)
    let index: Int

    /// Total number of elements in the sequence
    let total: Int

    /// Total time spread for the stagger sequence
    let spread: Double

    /// Accessibility preference
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// Animation state
    @State private var hasAppeared = false

    func body(content: Content) -> some View {
        let thermalState = ThermalStateManager.shared.thermalState

        if reduceMotion || thermalState == .critical {
            // Instant appear for accessibility or critical thermal
            content
                .opacity(1.0)
                .offset(y: 0)
        } else {
            let delay = OrganicMotion.staggerDelay(index: index, total: total, spread: spread)
            let springId = "appear-\(index)-\(total)"
            let spring = OrganicMotion.organicSpring(for: springId, intensity: .medium)

            content
                .opacity(hasAppeared ? 1.0 : 0.0)
                .offset(y: hasAppeared ? 0 : 8)
                .onAppear {
                    DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
                        withAnimation(spring) {
                            hasAppeared = true
                        }
                    }
                }
        }
    }
}

// MARK: - OrganicHoverModifier

/// Applies an organic hover effect with scale and brightness changes.
///
/// On hover: scales to 1.02 with subtle brightness increase (0.03).
/// Spring physics are unique per element for natural variation.
///
/// - Reduce-motion: Only subtle brightness change, no scale animation
private struct OrganicHoverModifier: ViewModifier {

    /// Whether the element is currently hovered
    let isHovered: Bool

    /// Unique identifier for deriving spring parameters
    let id: String

    /// Accessibility preference
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        let thermalState = ThermalStateManager.shared.thermalState

        if reduceMotion {
            // Only brightness change for reduce-motion
            content
                .brightness(isHovered ? 0.03 : 0.0)
        } else if thermalState == .critical {
            // No animation at all for critical thermal
            content
        } else {
            let spring = OrganicMotion.organicSpring(for: id, intensity: .medium)
            let amplitudeMultiplier = OrganicMotion.amplitudeMultiplier(for: thermalState)

            let hoverScale = 1.0 + 0.02 * amplitudeMultiplier
            let hoverBrightness = 0.03 * amplitudeMultiplier

            content
                .scaleEffect(isHovered ? hoverScale : 1.0)
                .brightness(isHovered ? hoverBrightness : 0.0)
                .animation(spring, value: isHovered)
        }
    }
}

// MARK: - View Extensions

extension View {

    /// Applies a continuous organic pulse animation unique to this element.
    ///
    /// The pulse uses per-element phase offsets and durations so that
    /// no two elements with different IDs pulse in synchronization.
    ///
    /// - Parameters:
    ///   - id: Unique string identifier for the element
    ///   - intensity: Motion intensity level (default: `.subtle`)
    /// - Returns: A view with organic pulse animation applied
    func organicPulse(id: String, intensity: OrganicIntensity = .subtle) -> some View {
        modifier(OrganicPulseModifier(id: id, intensity: intensity))
    }

    /// Applies a staggered organic entrance animation.
    ///
    /// Elements appear with opacity and vertical translation, using a sine-curve
    /// stagger for non-linear timing.
    ///
    /// - Parameters:
    ///   - index: Position in the stagger sequence (0-based)
    ///   - total: Total number of elements in the sequence
    ///   - spread: Total time spread in seconds (default: 0.6)
    /// - Returns: A view with staggered entrance animation applied
    func organicAppear(index: Int, total: Int, spread: Double = 0.6) -> some View {
        modifier(OrganicAppearModifier(index: index, total: total, spread: spread))
    }

    /// Applies an organic hover effect with scale and brightness.
    ///
    /// Uses per-element spring physics for natural variation.
    /// Respects reduce-motion (brightness-only) and thermal state.
    ///
    /// - Parameters:
    ///   - isHovered: Whether the element is currently hovered
    ///   - id: Unique string identifier for spring parameters (default: generated UUID)
    /// - Returns: A view with organic hover effect applied
    func organicHover(isHovered: Bool, id: String = UUID().uuidString) -> some View {
        modifier(OrganicHoverModifier(isHovered: isHovered, id: id))
    }
}
