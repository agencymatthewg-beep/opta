import SwiftUI

// MARK: - Color Extensions

extension Color {
    // Primary palette
    static let optaVoid = Color(hex: "0a0a0c")
    static let optaPrimary = Color(hex: "8B5CF6")
    static let optaPrimaryGlow = Color(hex: "A78BFA")
    static let optaPrimaryDim = Color(hex: "6D28D9")
    
    // Neon accents
    static let optaNeonGreen = Color(hex: "22C55E")
    static let optaNeonBlue = Color(hex: "3B82F6")
    static let optaNeonAmber = Color(hex: "F59E0B")
    static let optaNeonCyan = Color(hex: "06B6D4")
    static let optaNeonRed = Color(hex: "EF4444")
    
    // Glass effects
    static let optaGlassBorder = Color.white.opacity(0.1)
    static let optaGlassBackground = Color.white.opacity(0.05)
    
    // Text colors
    static let optaTextPrimary = Color.white
    static let optaTextSecondary = Color.white.opacity(0.7)
    static let optaTextMuted = Color.white.opacity(0.4)
    
    // Helper to create color from hex
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
            (a, r, g, b) = (1, 1, 1, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue:  Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}

// MARK: - View Modifiers

extension View {
    /// Apply glassmorphism effect matching web app
    func glassPanel(cornerRadius: CGFloat = 16) -> some View {
        self
            .background(.ultraThinMaterial.opacity(0.5))
            .background(Color.optaGlassBackground)
            .clipShape(RoundedRectangle(cornerRadius: cornerRadius))
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius)
                    .stroke(Color.optaGlassBorder, lineWidth: 1)
            )
    }
    
    /// Glow effect for accent elements
    func optaGlow(_ color: Color = .optaPrimary, radius: CGFloat = 15) -> some View {
        self.shadow(color: color.opacity(0.3), radius: radius, x: 0, y: 0)
    }
}

// Note: Animation extensions are defined in Animations.swift
