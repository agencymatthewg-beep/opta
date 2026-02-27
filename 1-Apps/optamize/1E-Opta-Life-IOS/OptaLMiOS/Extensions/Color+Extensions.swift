import SwiftUI

// MARK: - Color Extensions
// Cinematic Void Design System - matches Opta Life web app exactly

extension Color {
    // MARK: - Base Colors (Void Palette)
    
    /// Main background - deepest black (OLED-optimized)
    /// Hex: #050505
    static let optaVoid = Color(hex: "050505")
    
    /// Surface - slightly elevated
    /// Hex: #0a0a0a
    static let optaSurface = Color(hex: "0a0a0a")
    
    /// Elevated surface - raised elements
    /// Hex: #121212
    static let optaElevated = Color(hex: "121212")
    
    /// Border color - subtle outlines
    /// Hex: rgba(255,255,255,0.06)
    static let optaBorder = Color.white.opacity(0.06)
    
    // MARK: - Primary (Electric Violet)
    
    /// Primary brand color - electric violet
    /// Hex: #8B5CF6
    static let optaPrimary = Color(hex: "8B5CF6")
    
    /// Primary glow - brighter accent
    /// Hex: #A78BFA
    static let optaPrimaryGlow = Color(hex: "A78BFA")
    
    /// Primary dim - transparent overlay
    /// Hex: rgba(139,92,246,0.1)
    static let optaPrimaryDim = Color(hex: "8B5CF6").opacity(0.1)
    
    // MARK: - Neon Accents
    
    /// Success green - positive indicators
    /// Hex: #22C55E
    static let optaNeonGreen = Color(hex: "22C55E")
    
    /// Info blue - informational elements
    /// Hex: #3B82F6
    static let optaNeonBlue = Color(hex: "3B82F6")
    
    /// Warning amber - caution indicators
    /// Hex: #F59E0B
    static let optaNeonAmber = Color(hex: "F59E0B")
    
    /// Accent cyan - cool accent
    /// Hex: #06B6D4
    static let optaNeonCyan = Color(hex: "06B6D4")
    
    /// Error red - failure states
    /// Hex: #EF4444
    static let optaNeonRed = Color(hex: "EF4444")
    
    /// Accent purple - secondary purple (different from primary)
    /// Hex: #A855F7
    static let optaNeonPurple = Color(hex: "A855F7")
    
    // MARK: - Text Colors
    
    /// Primary text - high contrast
    /// Hex: #EDEDED
    static let optaTextPrimary = Color(hex: "EDEDED")
    
    /// Secondary text - reduced emphasis
    /// Hex: #A1A1AA
    static let optaTextSecondary = Color(hex: "A1A1AA")
    
    /// Muted text - minimal emphasis
    /// Hex: #52525B
    static let optaTextMuted = Color(hex: "52525B")
    
    // MARK: - Glass Effects
    
    /// Glass border - subtle white outline
    /// Hex: rgba(255,255,255,0.05)
    static let optaGlassBorder = Color.white.opacity(0.05)
    
    /// Glass highlight - top edge highlight
    /// Hex: rgba(255,255,255,0.03)
    static let optaGlassHighlight = Color.white.opacity(0.03)
    
    /// Glass background - dark translucent
    /// Hex: rgba(10,10,10,0.4)
    static let optaGlassBackground = Color(red: 10/255, green: 10/255, blue: 10/255).opacity(0.4)
    
    // MARK: - Hex Initializer
    
    /// Initialize a Color from a hex string
    /// Supports: #RGB, #RRGGBB, #RRGGBBAA (with or without #)
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
    /// Apply glassmorphism effect matching web app (Cinematic Void style)
    /// Default corner radius: 24px for large panels (web standard)
    func glassPanel(cornerRadius: CGFloat = 24) -> some View {
        self
            .background(.ultraThinMaterial.opacity(0.5))
            .background(Color.optaGlassBackground)
            .clipShape(RoundedRectangle(cornerRadius: cornerRadius))
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius)
                    .strokeBorder(
                        LinearGradient(
                            stops: [
                                .init(color: Color.optaGlassHighlight, location: 0),
                                .init(color: Color.optaGlassBorder, location: 0.5),
                                .init(color: Color.optaGlassBorder, location: 1)
                            ],
                            startPoint: .top,
                            endPoint: .bottom
                        ),
                        lineWidth: 1
                    )
            )
            .shadow(color: Color.black.opacity(0.3), radius: 8, x: 0, y: 8)
    }
    
    /// Small glass panel (buttons, cards)
    func glassCard(cornerRadius: CGFloat = 16) -> some View {
        self.glassPanel(cornerRadius: cornerRadius)
    }
    
    /// Glow effect for accent elements (matches web 400ms transition)
    func optaGlow(_ color: Color = .optaPrimary, radius: CGFloat = 15) -> some View {
        self
            .shadow(color: color.opacity(0.3), radius: radius, x: 0, y: 0)
            .animation(.easeInOut(duration: 0.4), value: color)
    }
    
    /// Hover elevation effect (for interactive elements)
    func optaElevate(isPressed: Bool = false) -> some View {
        self
            .scaleEffect(isPressed ? 0.98 : 1.0)
            .animation(.easeInOut(duration: 0.4), value: isPressed)
    }
}

// MARK: - Animation Timing (Web Standard)
// Duration: 400ms
// Easing: cubic-bezier(0.2, 0.8, 0.2, 1)
// Note: SwiftUI doesn't support exact cubic-bezier, using .easeInOut as closest match

// Note: Additional animation extensions can be defined in Animations.swift if needed
