//
//  OptaColors.swift
//  Opta Scan
//
//  Color system with OLED optimization following IOS_AESTHETIC_GUIDE.md
//  Created by Matthew Byrden
//

import SwiftUI

// MARK: - Hex Color Extension

extension Color {
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

extension Color {
    // CRITICAL: Use #09090b, NOT #000000
    // True black causes OLED smear on scroll
    static let optaBackground = Color(hex: "09090b")

    // Surface hierarchy (darkest to lightest)
    static let optaSurface = Color(hex: "18181b")          // Cards, containers
    static let optaSurfaceElevated = Color(hex: "27272a")  // Elevated elements
    static let optaBorder = Color(hex: "3f3f46")           // Subtle borders

    // Text hierarchy
    static let optaTextPrimary = Color(hex: "fafafa")      // Primary content
    static let optaTextSecondary = Color(hex: "a1a1aa")    // Secondary content
    static let optaTextMuted = Color(hex: "52525b")        // Disabled/hints
}

// MARK: - Neon Accent Colors

extension Color {
    // Primary brand
    static let optaPurple = Color(hex: "8b5cf6")
    static let optaPurpleGlow = Color(hex: "a855f7")

    // Semantic accents
    static let optaBlue = Color(hex: "3b82f6")       // Information, links
    static let optaGreen = Color(hex: "22c55e")      // Success, positive
    static let optaAmber = Color(hex: "f59e0b")      // Warning, attention
    static let optaRed = Color(hex: "ef4444")        // Error, destructive
}

// MARK: - Gradients

extension Color {
    /// Moonlight gradient for text/icons emphasis (not backgrounds)
    static let optaMoonlight = LinearGradient(
        colors: [Color(hex: "a855f7"), Color(hex: "8b5cf6"), Color(hex: "6366f1")],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )
}

// MARK: - Usage Rules Reference
/*
 | Element           | Color                 | Notes                    |
 |-------------------|-----------------------|--------------------------|
 | App background    | optaBackground        | Always #09090b           |
 | Cards/containers  | optaSurface           | With glass blur          |
 | Active states     | optaPurple            | Buttons, selections      |
 | Processing/loading| optaPurpleGlow        | Animated glow            |
 | Success results   | optaGreen             | Completion states        |
 | Inactive          | optaTextMuted         | Never pure gray          |
 */
