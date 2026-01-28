//
//  ColorTemperature.swift
//  OptaApp
//
//  Color temperature state machine mapping ring phase + energy into discrete
//  visual states (dormant/idle/active/processing/alert), each providing
//  computed color properties for consistent app-wide theming.
//

import SwiftUI

// MARK: - ColorTemperatureState

/// Discrete color temperature states representing the app's visual energy level.
///
/// Each state provides computed color properties that views consume to render
/// appropriate violet intensity, glow opacity, ambient brightness, and tint.
///
/// - `.dormant`: Pure obsidian, no energy visible, monochrome
/// - `.idle`: Faint branch glow, very dim purple
/// - `.active`: Full branch extension, bright Electric Violet
/// - `.processing`: Rapid branch pulsing, increased brightness
/// - `.alert`: Maximum extension, warm amber tint (thermal/memory pressure)
enum ColorTemperatureState: Equatable, Hashable {
    case dormant
    case idle
    case active
    case processing
    case alert

    // MARK: - Computed Color Properties

    /// Primary violet color for the current temperature state
    var violetColor: Color {
        switch self {
        case .dormant: return Color(hex: "1A0A2E")     // Near-black purple
        case .idle: return Color(hex: "3B1D5A")         // Deep dormant violet
        case .active: return Color(hex: "8B5CF6")       // Electric Violet
        case .processing: return Color(hex: "A78BFA")   // Brighter violet
        case .alert: return Color(hex: "F59E0B")        // Amber
        }
    }

    /// Glow opacity for branch and ring effects
    var glowOpacity: Double {
        switch self {
        case .dormant: return 0.0
        case .idle: return 0.15
        case .active: return 0.6
        case .processing: return 0.9
        case .alert: return 0.8
        }
    }

    /// Ambient brightness contribution to surrounding elements
    var ambientBrightness: Double {
        switch self {
        case .dormant: return 0.0
        case .idle: return 0.02
        case .active: return 0.05
        case .processing: return 0.08
        case .alert: return 0.06
        }
    }

    /// Branch energy intensity (0-1) for branch extension/width
    var branchIntensity: Double {
        switch self {
        case .dormant: return 0.0
        case .idle: return 0.2
        case .active: return 0.7
        case .processing: return 1.0
        case .alert: return 0.9
        }
    }

    /// Tint color for UI elements responding to temperature
    var tintColor: Color {
        switch self {
        case .dormant: return Color(hex: "1A0A2E")
        case .idle: return Color(hex: "3B1D5A")
        case .active: return Color(hex: "8B5CF6")
        case .processing: return Color(hex: "A78BFA")
        case .alert: return Color(hex: "F59E0B")
        }
    }

    /// Pulse animation speed multiplier
    var pulseSpeed: Double {
        switch self {
        case .dormant: return 0.0
        case .idle: return 0.3
        case .active: return 0.6
        case .processing: return 1.2
        case .alert: return 0.8
        }
    }
}

// MARK: - ColorTemperature Namespace

/// Namespace providing color temperature resolution, interpolation, and transition utilities.
///
/// Maps ring phase + energy level + system state into a `ColorTemperatureState`,
/// and provides smooth transitions between states using organic spring physics.
enum ColorTemperature {

    // MARK: - State Resolution

    /// Resolves the current color temperature from ring phase, energy, and system state.
    ///
    /// Priority order:
    /// 1. Alert (thermal serious/critical OR memory pressure) overrides all
    /// 2. Ring phase maps to temperature (sleeping->dormant, idle->idle, active->active, optimizing->processing)
    /// 3. Energy level provides fine-grained override within phase
    ///
    /// - Parameters:
    ///   - ringPhase: Current ring animation phase
    ///   - energy: Current energy level (0.0 - 1.0)
    ///   - thermalState: Current system thermal state
    ///   - memoryPressure: Whether memory pressure is elevated
    /// - Returns: The resolved color temperature state
    static func resolve(
        ringPhase: RingPhaseViewModel,
        energy: Float,
        thermalState: ProcessInfo.ThermalState,
        memoryPressure: Bool
    ) -> ColorTemperatureState {
        // Alert takes priority: serious/critical thermal or high memory pressure
        if thermalState == .serious || thermalState == .critical {
            return .alert
        }
        if memoryPressure {
            return .alert
        }

        // Map ring phase + energy to temperature state
        switch ringPhase {
        case .sleeping:
            return .dormant
        case .idle:
            if energy < 0.1 {
                return .dormant
            } else if energy < 0.3 {
                return .idle
            } else {
                return .active
            }
        case .wakingUp:
            return .active
        case .active:
            if energy < 0.3 {
                return .idle
            } else {
                return .active
            }
        case .optimizing, .celebrating:
            return .processing
        }
    }

    // MARK: - Color Interpolation

    /// Interpolates between two temperature state colors for smooth transitions.
    ///
    /// Blends the violet colors of two states based on progress (0 = from, 1 = to).
    /// Uses linear interpolation in RGB space for predictable results.
    ///
    /// - Parameters:
    ///   - from: The starting temperature state
    ///   - to: The ending temperature state
    ///   - progress: Blend progress (0.0 - 1.0)
    /// - Returns: Interpolated color between the two states
    static func interpolatedColor(
        from: ColorTemperatureState,
        to: ColorTemperatureState,
        progress: Double
    ) -> Color {
        let clampedProgress = min(max(progress, 0.0), 1.0)

        // Extract components from both colors
        let fromComponents = colorComponents(from.violetColor)
        let toComponents = colorComponents(to.violetColor)

        // Linear interpolation
        let r = fromComponents.red + (toComponents.red - fromComponents.red) * clampedProgress
        let g = fromComponents.green + (toComponents.green - fromComponents.green) * clampedProgress
        let b = fromComponents.blue + (toComponents.blue - fromComponents.blue) * clampedProgress

        return Color(red: r, green: g, blue: b)
    }

    // MARK: - Transition Spring

    /// Returns an organic spring animation for transitioning between temperature states.
    ///
    /// Uses the OrganicMotion.organicSpring pattern with intensity based on
    /// the distance between states. Larger state jumps get more energetic springs.
    /// Returns nil when accessibility reduce-motion is enabled (instant transitions).
    ///
    /// - Parameters:
    ///   - from: The departing temperature state
    ///   - to: The arriving temperature state
    ///   - reduceMotion: Whether accessibility reduce-motion is enabled
    /// - Returns: A spring Animation for the transition, or nil for instant
    static func transitionSpring(
        from: ColorTemperatureState,
        to: ColorTemperatureState,
        reduceMotion: Bool = false
    ) -> Animation? {
        // Reduce-motion: instant transitions, no spring
        guard !reduceMotion else { return nil }

        // Same state: no animation needed
        guard from != to else { return nil }

        // Determine intensity based on state distance
        let intensity = transitionIntensity(from: from, to: to)

        // Use OrganicMotion pattern: hash-based spring with appropriate intensity
        let id = "colorTemp_\(from)_\(to)"
        return OrganicMotion.organicSpring(for: id, intensity: intensity)
    }

    // MARK: - Private Helpers

    /// Determines the organic motion intensity for a state transition.
    ///
    /// Larger jumps (dormant->processing) get energetic springs.
    /// Small steps (idle->active) get subtle springs.
    private static func transitionIntensity(
        from: ColorTemperatureState,
        to: ColorTemperatureState
    ) -> OrganicIntensity {
        let fromOrder = stateOrder(from)
        let toOrder = stateOrder(to)
        let distance = abs(fromOrder - toOrder)

        switch distance {
        case 0...1: return .subtle
        case 2: return .medium
        default: return .energetic
        }
    }

    /// Returns a numeric order for state distance calculation.
    private static func stateOrder(_ state: ColorTemperatureState) -> Int {
        switch state {
        case .dormant: return 0
        case .idle: return 1
        case .active: return 2
        case .processing: return 3
        case .alert: return 4
        }
    }

    /// Extracts RGB components from a SwiftUI Color.
    private static func colorComponents(_ color: Color) -> (red: Double, green: Double, blue: Double) {
        // Use NSColor on macOS for reliable component extraction
        #if os(macOS)
        let nsColor = NSColor(color)
        let converted = nsColor.usingColorSpace(.sRGB) ?? nsColor
        return (
            red: Double(converted.redComponent),
            green: Double(converted.greenComponent),
            blue: Double(converted.blueComponent)
        )
        #else
        // Fallback: Use resolved color values (iOS 17+ / macOS 14+)
        var r: CGFloat = 0
        var g: CGFloat = 0
        var b: CGFloat = 0
        var a: CGFloat = 0
        UIColor(color).getRed(&r, green: &g, blue: &b, alpha: &a)
        return (red: Double(r), green: Double(g), blue: Double(b))
        #endif
    }
}
