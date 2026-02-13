//
//  Colors.swift
//  OptaMolt
//
//  Opta design system color tokens — Obsidian Glassmorphism theme.
//  Near-black backgrounds, transparent surfaces, and neon accent palette.
//
//  Usage:
//  ```swift
//  Text("Hello")
//      .foregroundColor(.optaTextPrimary)
//      .background(Color.optaBackground)
//  ```
//

import SwiftUI

// MARK: - Opta Color Tokens

public extension Color {

    // MARK: Accent Colors (Neon Palette)

    /// Primary brand purple — neon purple used for keywords, accents, and primary actions.
    /// Hex: #A855F7
    static let optaPurple = Color(red: 0xA8 / 255.0, green: 0x55 / 255.0, blue: 0xF7 / 255.0)

    /// Accent cyan — used for line charts, links, and informational highlights.
    /// Hex: #06B6D4
    static let optaCyan = Color(red: 0x06 / 255.0, green: 0xB6 / 255.0, blue: 0xD4 / 255.0)

    /// Success green — delivered status, positive indicators.
    /// Hex: #22C55E
    static let optaGreen = Color(red: 0x22 / 255.0, green: 0xC5 / 255.0, blue: 0x5E / 255.0)

    /// Info blue — strings in syntax highlighting, informational badges.
    /// Hex: #3B82F6
    static let optaBlue = Color(red: 0x3B / 255.0, green: 0x82 / 255.0, blue: 0xF6 / 255.0)

    /// Warning amber — numbers in syntax highlighting, caution indicators.
    /// Hex: #F59E0B
    static let optaAmber = Color(red: 0xF5 / 255.0, green: 0x9E / 255.0, blue: 0x0B / 255.0)

    /// Error red — failure states, destructive actions.
    /// Hex: #EF4444
    static let optaRed = Color(red: 0xEF / 255.0, green: 0x44 / 255.0, blue: 0x44 / 255.0)

    /// Accent pink — chart palette, decorative highlights.
    /// Hex: #EC4899
    static let optaPink = Color(red: 0xEC / 255.0, green: 0x48 / 255.0, blue: 0x99 / 255.0)

    /// Accent coral — chart palette, warm accent.
    /// Hex: #F97316
    static let optaCoral = Color(red: 0xF9 / 255.0, green: 0x73 / 255.0, blue: 0x16 / 255.0)

    /// Accent indigo — chart palette, secondary cool accent.
    /// Hex: #6366F1
    static let optaIndigo = Color(red: 0x63 / 255.0, green: 0x66 / 255.0, blue: 0xF1 / 255.0)

    // MARK: Backgrounds & Surfaces

    /// Main background — near-black OLED-optimized base.
    /// Hex: #09090B
    static let optaBackground = Color(red: 0x09 / 255.0, green: 0x09 / 255.0, blue: 0x0B / 255.0)

    /// Elevated surface — cards, bubbles, panels. Slightly lighter than background with subtle opacity.
    /// Hex: #18181B at 85% opacity
    static let optaSurface = Color(.sRGB, red: 0x18 / 255.0, green: 0x18 / 255.0, blue: 0x1B / 255.0, opacity: 0.85)

    /// Higher-elevation surface — headers, footers, elevated containers.
    /// Hex: #27272A at 90% opacity
    static let optaSurfaceElevated = Color(.sRGB, red: 0x27 / 255.0, green: 0x27 / 255.0, blue: 0x2A / 255.0, opacity: 0.90)

    /// Subtle border — dividers and outlines at low opacity.
    /// Hex: #3F3F46
    static let optaBorder = Color(red: 0x3F / 255.0, green: 0x3F / 255.0, blue: 0x46 / 255.0)

    // MARK: Text Colors

    /// Primary text — near-white for maximum readability on dark backgrounds.
    /// Hex: #FAFAFA
    static let optaTextPrimary = Color(red: 0xFA / 255.0, green: 0xFA / 255.0, blue: 0xFA / 255.0)

    /// Secondary text — muted for labels, descriptions, and less-prominent content.
    /// Hex: #A1A1AA
    static let optaTextSecondary = Color(red: 0xA1 / 255.0, green: 0xA1 / 255.0, blue: 0xAA / 255.0)

    /// Most muted text — timestamps, hints, disabled content.
    /// Hex: #71717A
    static let optaTextMuted = Color(red: 0x71 / 255.0, green: 0x71 / 255.0, blue: 0x7A / 255.0)
}

// MARK: - Hex Color Initializer

public extension Color {
    /// Initialize a Color from a hex string.
    ///
    /// Supports formats: `#RGB`, `#RRGGBB`, `#RRGGBBAA`, and variants without `#`.
    ///
    /// Usage:
    /// ```swift
    /// let color = Color(hex: "#FF5733")
    /// let color = Color(hex: "3B82F6")
    /// ```
    ///
    /// - Parameter hex: A hex color string, optionally prefixed with `#`.
    init(hex: String) {
        let cleaned = hex.trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "#", with: "")

        var rgb: UInt64 = 0
        Scanner(string: cleaned).scanHexInt64(&rgb)

        let r: Double
        let g: Double
        let b: Double
        let a: Double

        switch cleaned.count {
        case 3: // RGB (4-bit per channel)
            r = Double((rgb >> 8) & 0xF) / 15.0
            g = Double((rgb >> 4) & 0xF) / 15.0
            b = Double(rgb & 0xF) / 15.0
            a = 1.0
        case 6: // RRGGBB
            r = Double((rgb >> 16) & 0xFF) / 255.0
            g = Double((rgb >> 8) & 0xFF) / 255.0
            b = Double(rgb & 0xFF) / 255.0
            a = 1.0
        case 8: // RRGGBBAA
            r = Double((rgb >> 24) & 0xFF) / 255.0
            g = Double((rgb >> 16) & 0xFF) / 255.0
            b = Double((rgb >> 8) & 0xFF) / 255.0
            a = Double(rgb & 0xFF) / 255.0
        default:
            r = 0; g = 0; b = 0; a = 1.0
        }

        self.init(red: r, green: g, blue: b, opacity: a)
    }
}
