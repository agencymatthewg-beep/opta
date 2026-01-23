//
//  OptaTextStyle.swift
//  OptaApp
//
//  Comprehensive text design system for Opta branding.
//  Provides colors, fonts, glow effects, and animation timing constants.
//

import SwiftUI

// MARK: - OptaTextStyle

/// Design system for Opta branded text components.
///
/// Includes:
/// - Color palette with dormant, active, and glow variants
/// - Font styles for different text hierarchies
/// - Glow modifiers for neon text effects
/// - State-based styling for semantic colors
/// - Animation timing constants for coordinated motion
///
/// # Usage
///
/// ```swift
/// Text("OPTA")
///     .font(OptaTextStyle.hero)
///     .foregroundStyle(OptaTextStyle.activeViolet)
///     .textGlow(color: OptaTextStyle.glowPurple, intensity: 0.8)
/// ```
enum OptaTextStyle {

    // MARK: - Color Palette

    /// Deep violet for inactive/dormant state
    static let dormantViolet = Color(hex: "3B1D5A")

    /// Electric violet for active state
    static let activeViolet = Color(hex: "9333EA")

    /// Primary purple glow color
    static let glowPurple = Color(hex: "8B5CF6")

    /// Blue glow variant
    static let glowBlue = Color(hex: "3B82F6")

    /// Green glow variant
    static let glowGreen = Color(hex: "22C55E")

    /// Amber glow variant (warning)
    static let glowAmber = Color(hex: "F59E0B")

    /// Red glow variant (error/danger)
    static let glowRed = Color(hex: "EF4444")

    /// Cyan glow variant
    static let glowCyan = Color(hex: "06B6D4")

    // MARK: - Font Styles

    /// Hero font for main "OPTA" display (32pt bold, tight tracking)
    static var hero: Font {
        .system(size: 32, weight: .bold, design: .default)
    }

    /// Title font for section headers (24pt semibold)
    static var title: Font {
        .system(size: 24, weight: .semibold, design: .default)
    }

    /// Body font for text zone messages (14pt medium)
    static var body: Font {
        .system(size: 14, weight: .medium, design: .default)
    }

    /// Caption font for hints and timestamps (12pt regular)
    static var caption: Font {
        .system(size: 12, weight: .regular, design: .default)
    }

    // MARK: - Animation Timing Constants

    /// Duration for ignition animation (opacity, y, brightness, blur)
    static let ignitionDuration: Double = 0.8

    /// Stagger delay between items (40ms)
    static let staggerDelay: Double = 0.04

    /// Spring response time
    static let springResponse: Double = 0.5

    /// Spring damping fraction
    static let springDamping: Double = 0.7

    // MARK: - State-Based Styling

    /// Returns the glow color for a given text state
    /// - Parameter state: The semantic text state
    /// - Returns: Appropriate glow color
    static func glowColor(for state: TextState) -> Color {
        switch state {
        case .neutral:
            return glowPurple
        case .positive:
            return glowGreen
        case .warning:
            return glowAmber
        case .error:
            return glowRed
        }
    }

    /// Returns the foreground color for a given text state
    /// - Parameter state: The semantic text state
    /// - Returns: Appropriate foreground color
    static func stateColor(for state: TextState) -> Color {
        switch state {
        case .neutral:
            return .white
        case .positive:
            return glowGreen
        case .warning:
            return glowAmber
        case .error:
            return glowRed
        }
    }
}

// MARK: - TextState

/// Semantic states for text styling
enum TextState {
    /// Neutral/default state
    case neutral
    /// Positive/success state
    case positive
    /// Warning state
    case warning
    /// Error/danger state
    case error
}

// MARK: - GlowModifier

/// View modifier that applies a glowing text shadow effect
struct GlowModifier: ViewModifier {

    /// The glow color
    let color: Color

    /// Intensity from 0.0 (none) to 1.0 (maximum)
    let intensity: Double

    func body(content: Content) -> some View {
        // Intensity maps to:
        // - Shadow radius: 0-20px
        // - Shadow opacity: 0.0-0.6
        let radius = intensity * 20.0
        let opacity = intensity * 0.6

        content
            .shadow(color: color.opacity(opacity), radius: radius, x: 0, y: 0)
            // Double shadow for more glow effect
            .shadow(color: color.opacity(opacity * 0.5), radius: radius * 0.5, x: 0, y: 0)
    }
}

// MARK: - View Extension

extension View {
    /// Applies a glowing effect to text or any view.
    ///
    /// The glow is achieved through layered shadow effects that create
    /// a neon-like appearance. Higher intensity creates a more prominent glow.
    ///
    /// - Parameters:
    ///   - color: The glow color
    ///   - intensity: Intensity from 0.0 (none) to 1.0 (maximum)
    /// - Returns: A view with the glow effect applied
    ///
    /// # Example
    ///
    /// ```swift
    /// Text("OPTA")
    ///     .font(.largeTitle)
    ///     .foregroundStyle(.white)
    ///     .textGlow(color: .purple, intensity: 0.8)
    /// ```
    func textGlow(color: Color, intensity: Double = 0.5) -> some View {
        modifier(GlowModifier(color: color, intensity: intensity.clamped(to: 0...1)))
    }
}

// MARK: - Comparable Extension

private extension Comparable {
    /// Clamps the value to the given range
    func clamped(to range: ClosedRange<Self>) -> Self {
        return min(max(self, range.lowerBound), range.upperBound)
    }
}

// MARK: - Preview

#if DEBUG
struct OptaTextStyle_Previews: PreviewProvider {
    static var previews: some View {
        VStack(spacing: 32) {
            // Hero text with glow
            Text("OPTA")
                .font(OptaTextStyle.hero)
                .foregroundStyle(OptaTextStyle.activeViolet)
                .textGlow(color: OptaTextStyle.glowPurple, intensity: 0.8)

            // Title text
            Text("System Status")
                .font(OptaTextStyle.title)
                .foregroundStyle(.white)

            // Body text with state colors
            VStack(spacing: 8) {
                Text("Neutral message")
                    .font(OptaTextStyle.body)
                    .foregroundStyle(OptaTextStyle.stateColor(for: .neutral))
                    .textGlow(color: OptaTextStyle.glowColor(for: .neutral), intensity: 0.3)

                Text("Optimization complete")
                    .font(OptaTextStyle.body)
                    .foregroundStyle(OptaTextStyle.stateColor(for: .positive))
                    .textGlow(color: OptaTextStyle.glowColor(for: .positive), intensity: 0.5)

                Text("High temperature detected")
                    .font(OptaTextStyle.body)
                    .foregroundStyle(OptaTextStyle.stateColor(for: .warning))
                    .textGlow(color: OptaTextStyle.glowColor(for: .warning), intensity: 0.5)

                Text("Critical error")
                    .font(OptaTextStyle.body)
                    .foregroundStyle(OptaTextStyle.stateColor(for: .error))
                    .textGlow(color: OptaTextStyle.glowColor(for: .error), intensity: 0.5)
            }

            // Caption text
            Text("Last updated: 2 minutes ago")
                .font(OptaTextStyle.caption)
                .foregroundStyle(.white.opacity(0.6))

            // Color palette showcase
            HStack(spacing: 16) {
                colorSwatch(OptaTextStyle.glowPurple, label: "Purple")
                colorSwatch(OptaTextStyle.glowBlue, label: "Blue")
                colorSwatch(OptaTextStyle.glowGreen, label: "Green")
                colorSwatch(OptaTextStyle.glowCyan, label: "Cyan")
                colorSwatch(OptaTextStyle.glowAmber, label: "Amber")
                colorSwatch(OptaTextStyle.glowRed, label: "Red")
            }
        }
        .padding(32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(hex: "09090B"))
        .preferredColorScheme(.dark)
    }

    private static func colorSwatch(_ color: Color, label: String) -> some View {
        VStack(spacing: 4) {
            Circle()
                .fill(color)
                .frame(width: 24, height: 24)
                .shadow(color: color.opacity(0.6), radius: 8)

            Text(label)
                .font(.system(size: 10))
                .foregroundStyle(.white.opacity(0.6))
        }
    }
}
#endif
