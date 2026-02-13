import SwiftUI
import AppKit

/// Opta brand colors for consistent styling
enum OptaColors {
    /// Primary accent color - Opta blue
    static let accent = Color(red: 0.2, green: 0.6, blue: 1.0)

    /// Success/running state - vibrant green
    static let success = Color(red: 0.2, green: 0.8, blue: 0.4)

    /// Warning state - orange
    static let warning = Color(red: 1.0, green: 0.6, blue: 0.2)

    /// Danger/stop state - red
    static let danger = Color(red: 0.9, green: 0.3, blue: 0.3)

    /// Surface background
    static let surface = Color(NSColor.windowBackgroundColor)

    /// Primary text color
    static let textPrimary = Color.primary

    /// Secondary text color
    static let textSecondary = Color.secondary

    /// Inactive/stopped state
    static let inactive = Color.gray.opacity(0.3)

    /// Hover highlight
    static let hover = Color.primary.opacity(0.1)
}

/// Opta typography for consistent fonts
enum OptaFonts {
    /// Title font - semibold 14pt
    static let title = Font.system(size: 14, weight: .semibold)

    /// Body font - regular 13pt
    static let body = Font.system(size: 13)

    /// Caption font - regular 11pt
    static let caption = Font.system(size: 11)

    /// Small font - regular 10pt
    static let small = Font.system(size: 10)

    /// Button font - regular 12pt
    static let button = Font.system(size: 12)
}

/// Animation durations for consistent motion
enum OptaAnimations {
    /// Quick state change (hover, press)
    static let quick: Double = 0.15

    /// Standard transition
    static let standard: Double = 0.3

    /// Slow/subtle animation
    static let slow: Double = 0.5
}
