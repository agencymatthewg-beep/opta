//
//  DesignSystem.swift
//  OptaNative
//
//  Premium "Void" Design System for Opta Native.
//  Replaces the standard system colors with a deep, mysterious palette.
//  Created for Opta Native macOS - Plan 101-01 (v12.0)
//

import SwiftUI

// MARK: - Color Palette

extension Font {
    // MARK: - Official Opta Typography (Sora)
    // Reference: OPTA_TYPOGRAPHY_SPECIFICATION.md

    /// Primary Opta font - Sora (Google Fonts)
    /// Falls back to SF Pro if Sora not bundled
    static func opta(size: CGFloat, weight: Font.Weight = .regular) -> Font {
        // Try Sora first (if bundled), fall back to system
        return Font.custom("Sora", size: size)
            .weight(weight)
    }

    /// Hero heading style - Bold, large, for major titles
    /// Size: 44pt (3.5rem equivalent), Weight: Bold, Tracking: 0.12em (~5pt)
    static func optaHero(size: CGFloat = 44) -> Font {
        return Font.custom("Sora", size: size)
            .weight(.bold)
    }

    /// Subtitle style - Light weight, uppercase, wide tracking
    /// Size: 13pt, Weight: Light, Tracking: 0.25em (~3pt)
    static func optaSubtitle(size: CGFloat = 13) -> Font {
        return Font.custom("Sora", size: size)
            .weight(.light)
    }

    /// Badge style - Regular weight, medium tracking
    /// Size: 11pt, Weight: Regular, Tracking: 0.15em
    static func optaBadge(size: CGFloat = 11) -> Font {
        return Font.custom("Sora", size: size)
            .weight(.regular)
    }

    /// Section header style - Semibold, for panel headers
    /// Size: 18pt, Weight: Semibold, Tracking: 0.08em
    static func optaSectionHeader(size: CGFloat = 18) -> Font {
        return Font.custom("Sora", size: size)
            .weight(.semibold)
    }

    // MARK: - Semantic Typography
    static let optaDisplay = Font.optaHero(size: 32)
    static let optaTitle = Font.optaSectionHeader(size: 24)
    static let optaBody = Font.opta(size: 15, weight: .medium)
    static let optaMono = Font.system(size: 12, weight: .bold, design: .monospaced)

    // MARK: - Legacy Typography (referenced by existing views)
    static let optaH1 = Font.optaHero(size: 36)
    static let optaH2 = Font.optaSectionHeader(size: 24)
    static let optaH3 = Font.optaSectionHeader(size: 18)
    static let optaBodyMedium = Font.opta(size: 14, weight: .medium)
    static let optaSmall = Font.opta(size: 12, weight: .regular)
}

// MARK: - Opta Typography Constants

enum OptaTypography {
    // Hero heading specifications
    static let heroSize: CGFloat = 44
    static let heroTracking: CGFloat = 5  // 0.12em at 44pt ≈ 5pt

    // Subtitle specifications
    static let subtitleSize: CGFloat = 13
    static let subtitleTracking: CGFloat = 3  // 0.25em at 13pt ≈ 3pt

    // Badge specifications
    static let badgeSize: CGFloat = 11
    static let badgeTracking: CGFloat = 1.5  // 0.15em at 11pt

    // Section header specifications
    static let sectionSize: CGFloat = 18
    static let sectionTracking: CGFloat = 1.5  // 0.08em at 18pt
}

// MARK: - Moonlight Gradient

extension LinearGradient {
    /// The signature Opta "Moonlight" gradient for hero text
    /// Direction: Top to bottom (mimics overhead lighting)
    /// Stops: White (0%) → Electric Violet (50%) → Indigo (100%)
    static let optaMoonlight = LinearGradient(
        colors: [
            Color(hex: 0xFAFAFA),  // White
            Color(hex: 0xA855F7),  // Electric Violet
            Color(hex: 0x6366F1)   // Indigo
        ],
        startPoint: .top,
        endPoint: .bottom
    )

    /// Dynamic moonlight gradient that can be tinted with a color
    static func optaMoonlightTinted(with color: Color) -> LinearGradient {
        return LinearGradient(
            colors: [
                Color.white,
                color,
                color.opacity(0.7)
            ],
            startPoint: .top,
            endPoint: .bottom
        )
    }
}

extension Color {
    // MARK: - Void Palette (New)
    static let optaVoid = Color(hex: 0x050507) // Deepest black/purple
    static let optaSurface = Color(hex: 0x0A0A0C) // Slightly lighter panel background
    static let optaGlassBorder = Color.white.opacity(0.08)

    // Accents (New)
    static let optaNeonPurple = Color(hex: 0xA855F7) // Primary Glow
    static let optaDeepPurple = Color(hex: 0x581C87) // Secondary
    static let optaElectricBlue = Color(hex: 0x3B82F6) // Info/secondary
    static let optaNeonAmber = Color(hex: 0xF59E0B) // Warning/Inbox
    static let optaNeonRed = Color(hex: 0xEF4444) // Danger

    // Text (New)
    static let optaTextPrimary = Color.white.opacity(0.95)
    static let optaTextSecondary = Color.white.opacity(0.6)
    static let optaTextMuted = Color.white.opacity(0.4)

    // MARK: - Legacy Compatibility (referenced by existing views)

    /// Deep void background color
    static let optaBackground = Color(hex: 0x09090B)
    /// Primary text color
    static let optaForeground = Color(hex: 0xFAFAFA)
    /// Card background
    static let optaCard = Color(hex: 0x18181B)
    /// Card text color
    static let optaCardForeground = Color(hex: 0xE4E4E7)
    /// Primary brand color - Electric Violet
    static let optaPrimary = Color(hex: 0x8B5CF6)
    /// Secondary brand color
    static let optaSecondary = Color(hex: 0x3730A3)
    /// Accent color for highlights
    static let optaAccent = Color(hex: 0x6366F1)
    /// Success state - green
    static let optaSuccess = Color(hex: 0x10B981)
    /// Warning state - amber
    static let optaWarning = Color(hex: 0xF59E0B)
    /// Danger state - red
    static let optaDanger = Color(hex: 0xEF4444)
    /// Muted background
    static let optaMuted = Color(hex: 0x27272A)
    /// Muted text color
    static let optaMutedForeground = Color(hex: 0x71717A)
    /// Border color
    static let optaBorder = Color(hex: 0x3F3F46)
    /// Input border color
    static let optaInput = Color(hex: 0x3F3F46)
    /// Focus ring color
    static let optaRing = Color(hex: 0x8B5CF6)
    /// Popover background
    static let optaPopover = Color(hex: 0x18181B)

    // MARK: - Hex Init Helpers

    init(hex: UInt, alpha: Double = 1) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xff) / 255,
            green: Double((hex >> 08) & 0xff) / 255,
            blue: Double((hex >> 00) & 0xff) / 255,
            opacity: alpha
        )
    }

    /// Initialize from hex string (e.g., "#8B5CF6" or "8B5CF6")
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)

        let a, r, g, b: UInt64
        switch hex.count {
        case 3:
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6:
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8:
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

// MARK: - Spacing & Layout

enum OptaSpacing {
    static let radius: CGFloat = 12
    static let radiusSmall: CGFloat = 8
    static let radiusLarge: CGFloat = 16
    static let radiusXL: CGFloat = 24

    static let xs: CGFloat = 4
    static let sm: CGFloat = 8
    static let md: CGFloat = 12
    static let lg: CGFloat = 16
    static let xl: CGFloat = 20
    static let xxl: CGFloat = 24
}

// MARK: - Gradients

extension LinearGradient {
    static let optaPrimaryGradient = LinearGradient(
        colors: [Color.optaPrimary, Color.optaAccent],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )
}

// MARK: - View Modifiers

struct GlassPanelModifier: ViewModifier {
    var padding: CGFloat = 24
    
    func body(content: Content) -> some View {
        content
            .padding(padding)
            .background(
                ZStack {
                    // Base dark layer
                    Color.optaSurface.opacity(0.6)
                    // Blur
                    Rectangle()
                        .fill(.ultraThinMaterial)
                        .opacity(0.1)
                }
            )
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .strokeBorder(
                        LinearGradient(
                            colors: [.white.opacity(0.1), .white.opacity(0.02)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        lineWidth: 1
                    )
            )
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .shadow(color: .black.opacity(0.4), radius: 10, x: 0, y: 10)
    }
}

struct PrimaryButtonModifier: ViewModifier {
    func body(content: Content) -> some View {
        content
            .font(.system(size: 13, weight: .semibold, design: .default))
            .foregroundStyle(.white)
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(
                ZStack {
                    Color.optaNeonPurple.opacity(0.8)
                    LinearGradient(
                        colors: [.white.opacity(0.2), .clear],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                }
            )
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .shadow(color: Color.optaNeonPurple.opacity(0.4), radius: 8, x: 0, y: 0)
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .strokeBorder(Color.white.opacity(0.2), lineWidth: 1)
            )
    }
}

// MARK: - Extensions

extension View {
    func glassPanel(padding: CGFloat = 24) -> some View {
        modifier(GlassPanelModifier(padding: padding))
    }
    
    func premiumButtonStyle() -> some View {
        modifier(PrimaryButtonModifier())
    }
    
    /// Applies the "Void" atmospheric background to any view
    func optaBackground() -> some View {
        self.background(
            ZStack {
                Color.optaVoid.ignoresSafeArea()
                
                // Fog/Glow layers
                RadialGradient(
                    colors: [Color.optaNeonPurple.opacity(0.15), .clear],
                    center: .topLeading,
                    startRadius: 0,
                    endRadius: 800
                )
                .ignoresSafeArea()
                .blur(radius: 50)
                
                RadialGradient(
                    colors: [Color.optaElectricBlue.opacity(0.05), .clear],
                    center: .bottomTrailing,
                    startRadius: 0,
                    endRadius: 600
                )
                .ignoresSafeArea()
            }
        )
    }
}
