//
//  Colors.swift
//  OptaMolt
//
//  Opta design system color tokens — Cinematic Void theme (updated to match web app).
//  Deep black backgrounds, glass surfaces, electric violet primary, and neon accent palette.
//
//  Usage:
//  ```swift
//  Text("Hello")
//      .foregroundColor(.optaTextPrimary)
//      .background(Color.optaVoid)
//  ```
//

import SwiftUI

// MARK: - Opta Color Tokens (Cinematic Void)

public extension Color {

    // MARK: Base Colors (Void Palette)
    
    /// Main background — deepest black (OLED-optimized, "void")
    /// Hex: #050505
    static let optaVoid = Color(red: 0x05 / 255.0, green: 0x05 / 255.0, blue: 0x05 / 255.0)
    
    /// Alias for optaVoid (backwards compatibility)
    static let optaBackground = optaVoid
    
    /// Surface — slightly elevated
    /// Hex: #0a0a0a
    static let optaSurface = Color(red: 0x0a / 255.0, green: 0x0a / 255.0, blue: 0x0a / 255.0)
    
    /// Elevated surface — raised elements
    /// Hex: #121212
    static let optaElevated = Color(red: 0x12 / 255.0, green: 0x12 / 255.0, blue: 0x12 / 255.0)
    
    /// Alias for optaElevated (backwards compatibility)
    static let optaSurfaceElevated = optaElevated
    
    /// Border color — subtle outlines
    /// Hex: rgba(255,255,255,0.06)
    static let optaBorder = Color.white.opacity(0.06)

    // MARK: Primary (Electric Violet)
    
    /// Primary brand color — electric violet
    /// Hex: #8B5CF6
    static let optaPrimary = Color(red: 0x8B / 255.0, green: 0x5C / 255.0, blue: 0xF6 / 255.0)
    
    /// Primary glow — brighter accent
    /// Hex: #A78BFA
    static let optaPrimaryGlow = Color(red: 0xA7 / 255.0, green: 0x8B / 255.0, blue: 0xFA / 255.0)
    
    /// Primary dim — transparent overlay
    /// Hex: rgba(139,92,246,0.1)
    static let optaPrimaryDim = Color(.sRGB, red: 0x8B / 255.0, green: 0x5C / 255.0, blue: 0xF6 / 255.0, opacity: 0.1)
    
    // MARK: Neon Accents
    
    /// Success green — delivered status, positive indicators
    /// Hex: #22C55E
    static let optaGreen = Color(red: 0x22 / 255.0, green: 0xC5 / 255.0, blue: 0x5E / 255.0)
    
    /// Info blue — strings in syntax highlighting, informational badges
    /// Hex: #3B82F6
    static let optaBlue = Color(red: 0x3B / 255.0, green: 0x82 / 255.0, blue: 0xF6 / 255.0)
    
    /// Warning amber — numbers in syntax highlighting, caution indicators
    /// Hex: #F59E0B
    static let optaAmber = Color(red: 0xF5 / 255.0, green: 0x9E / 255.0, blue: 0x0B / 255.0)
    
    /// Error red — failure states, destructive actions
    /// Hex: #EF4444
    static let optaRed = Color(red: 0xEF / 255.0, green: 0x44 / 255.0, blue: 0x44 / 255.0)
    
    /// Accent cyan — used for line charts, links, and informational highlights
    /// Hex: #06B6D4
    static let optaCyan = Color(red: 0x06 / 255.0, green: 0xB6 / 255.0, blue: 0xD4 / 255.0)
    
    /// Accent purple — secondary purple (different from primary)
    /// Hex: #A855F7
    static let optaNeonPurple = Color(red: 0xA8 / 255.0, green: 0x55 / 255.0, blue: 0xF7 / 255.0)

    /// Accent pink — chart palette, decorative highlights
    /// Hex: #EC4899
    static let optaPink = Color(red: 0xEC / 255.0, green: 0x48 / 255.0, blue: 0x99 / 255.0)

    /// Accent coral — chart palette, warm accent
    /// Hex: #F97316
    static let optaCoral = Color(red: 0xF9 / 255.0, green: 0x73 / 255.0, blue: 0x16 / 255.0)

    /// Accent indigo — chart palette, secondary cool accent
    /// Hex: #6366F1
    static let optaIndigo = Color(red: 0x63 / 255.0, green: 0x66 / 255.0, blue: 0xF1 / 255.0)

    // MARK: Text Colors

    /// Primary text — high contrast for maximum readability on dark backgrounds
    /// Hex: #EDEDED
    static let optaTextPrimary = Color(red: 0xED / 255.0, green: 0xED / 255.0, blue: 0xED / 255.0)

    /// Secondary text — muted for labels, descriptions, and less-prominent content
    /// Hex: #A1A1AA
    static let optaTextSecondary = Color(red: 0xA1 / 255.0, green: 0xA1 / 255.0, blue: 0xAA / 255.0)

    /// Most muted text — timestamps, hints, disabled content
    /// Hex: #52525B
    static let optaTextMuted = Color(red: 0x52 / 255.0, green: 0x52 / 255.0, blue: 0x5B / 255.0)
    
    // MARK: Glass Effects
    
    /// Glass background — dark translucent
    /// Hex: rgba(10,10,10,0.4)
    static let optaGlassBackground = Color(.sRGB, red: 0x0a / 255.0, green: 0x0a / 255.0, blue: 0x0a / 255.0, opacity: 0.4)
    
    /// Glass border — subtle white outline
    /// Hex: rgba(255,255,255,0.05)
    static let optaGlassBorder = Color.white.opacity(0.05)
    
    /// Glass highlight — top edge highlight
    /// Hex: rgba(255,255,255,0.03)
    static let optaGlassHighlight = Color.white.opacity(0.03)

    // MARK: Code / Syntax Highlighting

    /// Code block background — slightly lighter than void
    /// Hex: #080808
    static let optaCodeBackground = Color(red: 0x08 / 255.0, green: 0x08 / 255.0, blue: 0x08 / 255.0)

    /// Syntax: keywords — violet
    static let optaSyntaxKeyword = Color(red: 0.68, green: 0.45, blue: 1.0)
    /// Syntax: strings — emerald green
    static let optaSyntaxString = Color(red: 0.45, green: 0.85, blue: 0.55)
    /// Syntax: numbers — warm amber
    static let optaSyntaxNumber = Color(red: 0.95, green: 0.75, blue: 0.30)
    /// Syntax: types — cyan-tinted
    static let optaSyntaxType = Color(red: 0.40, green: 0.78, blue: 0.90)
    /// Syntax: comments — muted gray
    static let optaSyntaxComment = Color(white: 0.45)
    /// Syntax: decorators — light violet
    static let optaSyntaxDecorator = Color(red: 0.85, green: 0.55, blue: 0.95)
    /// Syntax: variables — teal
    static let optaSyntaxVariable = Color(red: 0.55, green: 0.85, blue: 0.75)
    /// Syntax: operators — soft violet
    static let optaSyntaxOperator = Color(red: 0.75, green: 0.65, blue: 0.90)
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

// MARK: - Color Scheme Note
//
// This design system implements the "Cinematic Void" theme:
// - Deep black void background (#050505)
// - Electric violet primary (#8B5CF6)
// - Glass effects with 24px blur (platform-dependent implementation)
// - Neon accent palette for status/actions
// - Near-white text (#EDEDED) for maximum readability
//
// Transitions: 400ms cubic-bezier(0.2, 0.8, 0.2, 1)
// Border radius: 24px (large panels), 16px (cards), 12px (small elements)
//
