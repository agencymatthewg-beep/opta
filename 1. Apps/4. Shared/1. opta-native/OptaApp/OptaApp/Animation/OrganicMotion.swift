//
//  OrganicMotion.swift
//  OptaApp
//
//  Organic motion foundation providing per-element phase offsets, varied duration ranges,
//  organic spring physics, and system-state-responsive timing.
//  No two elements should pulse in sync — hash-based identity creates unique motion per element.
//

import SwiftUI

// MARK: - OrganicIntensity

/// Intensity levels for organic motion, controlling duration and damping characteristics.
///
/// - `.subtle`: Gentle ambient movement — long durations, high damping, minimal displacement
/// - `.medium`: Standard UI interactions — balanced timing and response
/// - `.energetic`: Responsive feedback — short durations, lower damping, snappy feel
enum OrganicIntensity {
    case subtle
    case medium
    case energetic

    /// Base response range (lower bound) for spring animation
    var responseRange: ClosedRange<Double> {
        switch self {
        case .subtle: return 0.45...0.60
        case .medium: return 0.30...0.45
        case .energetic: return 0.20...0.35
        }
    }

    /// Base damping range for spring animation
    var dampingRange: ClosedRange<Double> {
        switch self {
        case .subtle: return 0.75...0.85
        case .medium: return 0.60...0.75
        case .energetic: return 0.50...0.65
        }
    }

    /// Scale amplitude range for pulse effects
    var scaleRange: ClosedRange<Double> {
        switch self {
        case .subtle: return 0.98...1.02
        case .medium: return 0.96...1.04
        case .energetic: return 0.94...1.06
        }
    }
}

// MARK: - OrganicMotion

/// Namespace providing organic motion utilities.
///
/// All functions use element identity (String) to derive deterministic but varied
/// timing parameters. This ensures:
/// - No two elements pulse in sync
/// - Each element has unique spring physics
/// - Motion feels organic and natural across the UI
enum OrganicMotion {

    // MARK: - Phase Offset

    /// Returns a deterministic phase offset in range 0...1 based on element identity.
    ///
    /// Uses the string's hash value to produce a fractional offset so that
    /// no two elements with different IDs will start their animation at the same phase.
    ///
    /// - Parameter id: Unique string identifier for the element
    /// - Returns: A value in 0...1 representing the phase offset
    static func phaseOffset(for id: String) -> Double {
        let hash = abs(id.hashValue)
        let fractional = Double(hash % 10000) / 10000.0
        return fractional
    }

    // MARK: - Duration Functions

    /// Returns an ambient duration in range 3-7 seconds, unique per element.
    ///
    /// Ambient animations are slow, breathing-like motions used for idle states.
    /// Each element gets a different duration to prevent synchronized pulsing.
    ///
    /// - Parameter id: Unique string identifier for the element
    /// - Returns: Duration in seconds (3.0-7.0)
    static func ambientDuration(for id: String) -> Double {
        let hash = abs(id.hashValue)
        let normalized = Double(hash % 4001) / 4000.0 // 0...1
        return 3.0 + normalized * 4.0 // 3...7
    }

    /// Returns an interaction duration in range 0.5-1.5 seconds, unique per element.
    ///
    /// Interaction durations are used for user-triggered animations like
    /// hover, tap, or state changes.
    ///
    /// - Parameter id: Unique string identifier for the element
    /// - Returns: Duration in seconds (0.5-1.5)
    static func interactionDuration(for id: String) -> Double {
        let hash = abs(id.hashValue)
        let normalized = Double(hash % 1001) / 1000.0 // 0...1
        return 0.5 + normalized * 1.0 // 0.5...1.5
    }

    // MARK: - Spring Physics

    /// Returns an organic spring animation with varied response/damping derived from element identity.
    ///
    /// Each element gets unique spring characteristics based on its ID hash,
    /// creating natural variation across the UI.
    ///
    /// - Parameters:
    ///   - id: Unique string identifier for the element
    ///   - intensity: The motion intensity level (default: `.medium`)
    /// - Returns: A SwiftUI spring Animation
    static func organicSpring(for id: String, intensity: OrganicIntensity = .medium) -> Animation {
        let hash = abs(id.hashValue)

        // Derive response within intensity range
        let responseNorm = Double((hash >> 4) % 1001) / 1000.0
        let responseRange = intensity.responseRange
        let response = responseRange.lowerBound + responseNorm * (responseRange.upperBound - responseRange.lowerBound)

        // Derive damping within intensity range
        let dampingNorm = Double((hash >> 8) % 1001) / 1000.0
        let dampingRange = intensity.dampingRange
        let damping = dampingRange.lowerBound + dampingNorm * (dampingRange.upperBound - dampingRange.lowerBound)

        return .spring(response: response, dampingFraction: damping)
    }

    // MARK: - Stagger Delay

    /// Returns a non-linear stagger delay using a sine curve for organic entrance timing.
    ///
    /// Unlike linear stagger (equal delay between elements), this uses a sine curve
    /// to create acceleration/deceleration in the sequence — elements in the middle
    /// appear faster than those at the edges.
    ///
    /// - Parameters:
    ///   - index: The element's position in the sequence (0-based)
    ///   - total: Total number of elements in the sequence
    ///   - spread: Total time spread in seconds (default: 0.6)
    /// - Returns: Delay in seconds for this element
    static func staggerDelay(index: Int, total: Int, spread: Double = 0.6) -> Double {
        guard total > 1 else { return 0.0 }

        let progress = Double(index) / Double(total - 1) // 0...1
        // Sine curve creates non-linear timing: slower start, faster middle, slower end
        let curved = sin(progress * .pi / 2.0) // ease-in curve
        return curved * spread
    }

    // MARK: - System-Responsive Animation

    /// Returns a timing multiplier based on the current thermal state.
    ///
    /// - `.nominal`: Normal timing (1.0x)
    /// - `.fair`: Slightly faster animations (0.85x) to reduce GPU load
    /// - `.serious`: Minimal animation (0.5x, reduced amplitude)
    /// - `.critical`: No animation (returns 0, callers should use nil animation)
    ///
    /// - Parameter thermalState: The current system thermal state
    /// - Returns: A multiplier for animation duration (0.0 means no animation)
    static func thermalMultiplier(for thermalState: ProcessInfo.ThermalState) -> Double {
        switch thermalState {
        case .nominal: return 1.0
        case .fair: return 0.85
        case .serious: return 0.5
        case .critical: return 0.0
        @unknown default: return 1.0
        }
    }

    /// Returns an amplitude multiplier based on the current thermal state.
    ///
    /// At higher thermal pressure, animation amplitude is reduced to conserve resources.
    ///
    /// - Parameter thermalState: The current system thermal state
    /// - Returns: A multiplier for animation amplitude (0.0 means no movement)
    static func amplitudeMultiplier(for thermalState: ProcessInfo.ThermalState) -> Double {
        switch thermalState {
        case .nominal: return 1.0
        case .fair: return 0.9
        case .serious: return 0.4
        case .critical: return 0.0
        @unknown default: return 1.0
        }
    }

    /// Returns an appropriate animation combining organic spring physics with system state awareness.
    ///
    /// This is the primary entry point for creating system-responsive organic animations.
    /// Returns `nil` when animation should be skipped entirely (critical thermal or reduce-motion).
    ///
    /// - Parameters:
    ///   - id: Unique string identifier for the element
    ///   - intensity: The motion intensity level (default: `.medium`)
    ///   - thermalState: Current system thermal state
    ///   - reduceMotion: Whether accessibility reduce-motion is enabled
    /// - Returns: An Animation, or nil if animation should be skipped
    static func animation(
        for id: String,
        intensity: OrganicIntensity = .medium,
        thermalState: ProcessInfo.ThermalState = .nominal,
        reduceMotion: Bool = false
    ) -> Animation? {
        // No animation for reduce-motion or critical thermal
        guard !reduceMotion else { return nil }
        guard thermalState != .critical else { return nil }

        let multiplier = thermalMultiplier(for: thermalState)
        guard multiplier > 0 else { return nil }

        let spring = organicSpring(for: id, intensity: intensity)

        // Scale speed based on thermal state
        if multiplier < 1.0 {
            return spring.speed(1.0 / multiplier)
        }
        return spring
    }
}

// MARK: - SystemResponsiveModifier

/// A view modifier that applies system-state-responsive animation timing.
///
/// Reads the current thermal state from ThermalStateManager and adjusts
/// animation behavior accordingly. At critical thermal, animations are disabled entirely.
struct SystemResponsiveModifier: ViewModifier {

    /// The unique identifier for this element's animation
    let id: String

    /// The desired motion intensity
    let intensity: OrganicIntensity

    /// Whether accessibility reduce-motion is enabled
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        let thermalState = ThermalStateManager.shared.thermalState

        content
            .transaction { transaction in
                if let anim = OrganicMotion.animation(
                    for: id,
                    intensity: intensity,
                    thermalState: thermalState,
                    reduceMotion: reduceMotion
                ) {
                    transaction.animation = anim
                } else {
                    transaction.disablesAnimations = true
                }
            }
    }
}

// MARK: - View Extension

extension View {
    /// Applies system-responsive organic animation timing to this view.
    ///
    /// Automatically adjusts animation based on thermal state and accessibility preferences.
    ///
    /// - Parameters:
    ///   - id: Unique string identifier for the element
    ///   - intensity: The motion intensity level (default: `.medium`)
    /// - Returns: A view with system-responsive animation applied
    func systemResponsiveAnimation(id: String, intensity: OrganicIntensity = .medium) -> some View {
        modifier(SystemResponsiveModifier(id: id, intensity: intensity))
    }
}
