import SwiftUI

/// Opta design system colors.
enum OptaColors {
    static let void_ = Color(hex: 0x09090b)
    static let surface = Color(hex: 0x18181b)
    static let elevated = Color(hex: 0x27272a)
    static let border = Color(hex: 0x3f3f46)
    static let textPrimary = Color(hex: 0xfafafa)
    static let textSecondary = Color(hex: 0xa1a1aa)
    static let textMuted = Color(hex: 0x52525b)
    static let primary = Color(hex: 0x8b5cf6)
    static let primaryGlow = Color(hex: 0xa855f7)
    static let neonBlue = Color(hex: 0x3b82f6)
    static let neonGreen = Color(hex: 0x22c55e)
    static let neonAmber = Color(hex: 0xf59e0b)
    static let neonRed = Color(hex: 0xef4444)
}

extension Color {
    init(hex: UInt, opacity: Double = 1.0) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255.0,
            green: Double((hex >> 8) & 0xFF) / 255.0,
            blue: Double(hex & 0xFF) / 255.0,
            opacity: opacity
        )
    }
}
