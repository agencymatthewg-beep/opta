//
//  ClawdbotColors.swift
//  ClawdbotKit
//
//  Color system with OLED optimization ported from Opta iOS design system.
//  Created by Matthew Byrden
//

@_exported import SwiftUI

// MARK: - Hex Color Extension

public extension Color {
    /// Initialize a Color from a hex string (e.g., "09090b" or "#09090b")
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }

        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}

// MARK: - Base Colors (OLED Optimized)

public extension Color {
    // CRITICAL: Use #09090b, NOT #000000
    // True black causes OLED smear on scroll
    static let clawdbotBackground = Color(hex: "09090b")

    // Surface hierarchy (darkest to lightest)
    static let clawdbotSurface = Color(hex: "18181b")          // Cards, containers
    static let clawdbotSurfaceElevated = Color(hex: "27272a")  // Elevated elements
    static let clawdbotBorder = Color(hex: "3f3f46")           // Subtle borders

    // Text hierarchy
    static let clawdbotTextPrimary = Color(hex: "fafafa")      // Primary content
    static let clawdbotTextSecondary = Color(hex: "a1a1aa")    // Secondary content
    static let clawdbotTextMuted = Color(hex: "52525b")        // Disabled/hints
}

// MARK: - Neon Accent Colors

public extension Color {
    // Primary brand
    static let clawdbotPurple = Color(hex: "8b5cf6")
    static let clawdbotPurpleGlow = Color(hex: "a855f7")

    // Semantic accents
    static let clawdbotBlue = Color(hex: "3b82f6")       // Information, links
    static let clawdbotGreen = Color(hex: "22c55e")      // Success, positive
    static let clawdbotAmber = Color(hex: "f59e0b")      // Warning, attention
    static let clawdbotRed = Color(hex: "ef4444")        // Error, destructive

    // Extended palette
    /// Cyan accent color (info/cool accent)
    static let clawdbotCyan = Color(red: 6/255, green: 182/255, blue: 212/255)  // #06b6d4

    /// Indigo color (gradient end)
    static let clawdbotIndigo = Color(red: 99/255, green: 102/255, blue: 241/255)  // #6366f1

    /// Pink accent (optional highlights)
    static let clawdbotPink = Color(red: 236/255, green: 72/255, blue: 153/255)  // #ec4899

    /// Coral accent (warm highlights)
    static let clawdbotCoral = Color(red: 251/255, green: 113/255, blue: 133/255)  // #fb7185
}

// MARK: - Gradients

public extension Color {
    /// Moonlight gradient for text/icons emphasis (not backgrounds)
    static let clawdbotMoonlight = LinearGradient(
        colors: [Color(hex: "a855f7"), Color(hex: "8b5cf6"), Color(hex: "6366f1")],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )
}

// MARK: - Usage Rules Reference
/*
 | Element           | Color                   | Notes                    |
 |-------------------|-------------------------|--------------------------|
 | App background    | clawdbotBackground      | Always #09090b           |
 | Cards/containers  | clawdbotSurface         | With glass blur          |
 | Active states     | clawdbotPurple          | Buttons, selections      |
 | Processing/loading| clawdbotPurpleGlow      | Animated glow            |
 | Success results   | clawdbotGreen           | Completion states        |
 | Inactive          | clawdbotTextMuted       | Never pure gray          |
 */
