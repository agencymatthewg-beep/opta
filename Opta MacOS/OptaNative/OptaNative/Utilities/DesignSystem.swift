import SwiftUI

// MARK: - Opta Color Palette

/// Opta's design system colors ported from CSS variables to SwiftUI.
/// Based on The Obsidian Standard - living artifact aesthetic.
extension Color {
    // MARK: - Core Colors (The Void)

    /// Deep void black with purple hint - main background
    /// CSS: --background: 270 50% 3%
    static let optaBackground = Color(hex: "#09090B")

    /// Stark white for contrast - primary text
    /// CSS: --foreground: 270 10% 98%
    static let optaForeground = Color(hex: "#FAFAFA")

    // MARK: - Obsidian Surfaces

    /// Slightly lighter, glossy card background
    /// CSS: --card: 270 30% 5%
    static let optaCard = Color(hex: "#18181B")

    /// Card text color
    static let optaCardForeground = Color(hex: "#E4E4E7")

    /// Popover background (same as card)
    static let optaPopover = Color(hex: "#18181B")

    // MARK: - The Energy (Primary Brand)

    /// Electric Violet - The Core Glow (50% state)
    /// CSS: --primary: 265 90% 65%
    static let optaPrimary = Color(hex: "#8B5CF6")

    /// Dormant Violet - The 0% State
    /// CSS: --secondary: 265 50% 20%
    static let optaSecondary = Color(hex: "#3730A3")

    /// Accent color for highlights
    /// CSS: --accent: 265 80% 60%
    static let optaAccent = Color(hex: "#6366F1")

    // MARK: - Functional States

    /// Green for positive states
    /// CSS: --success: 160 70% 45%
    static let optaSuccess = Color(hex: "#10B981")

    /// Amber for caution/warnings
    /// CSS: --warning: 45 90% 55%
    static let optaWarning = Color(hex: "#F59E0B")

    /// Red for errors/destructive actions
    /// CSS: --danger: 0 75% 55%
    static let optaDanger = Color(hex: "#EF4444")

    // MARK: - Muted Colors

    /// Muted background
    /// CSS: --muted: 270 20% 10%
    static let optaMuted = Color(hex: "#27272A")

    /// Muted text color
    /// CSS: --muted-foreground: 270 10% 50%
    static let optaMutedForeground = Color(hex: "#71717A")

    // MARK: - Borders

    /// Subtle border color
    /// CSS: --border: 270 30% 15%
    static let optaBorder = Color(hex: "#3F3F46")

    /// Input border color
    static let optaInput = Color(hex: "#3F3F46")

    /// Focus ring color (same as primary)
    static let optaRing = Color(hex: "#8B5CF6")
}

// MARK: - Hex Color Initializer

extension Color {
    /// Initialize a Color from a hex string (e.g., "#8B5CF6" or "8B5CF6")
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

// MARK: - Opta Gradients

extension LinearGradient {
    /// Primary brand gradient - Electric Violet to Indigo
    static let optaPrimaryGradient = LinearGradient(
        colors: [Color.optaPrimary, Color.optaAccent],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )

    /// Moonlight gradient for headings - white to primary
    static let optaMoonlight = LinearGradient(
        colors: [.white, .white, Color.optaPrimary.opacity(0.5)],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )

    /// Success gradient
    static let optaSuccessGradient = LinearGradient(
        colors: [Color.optaSuccess, Color.optaSuccess.opacity(0.7)],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )
}

// MARK: - Opta Typography

/// Typography scale matching The Obsidian Standard.
/// Uses SF Pro (system font) which matches Sora's clean aesthetic.
extension Font {
    // MARK: - Display & Headings

    /// Display - Hero text, large counters (3rem+ / 48pt, weight 700)
    static let optaDisplay = Font.system(size: 48, weight: .bold, design: .default)

    /// H1 - Page Titles (2.25rem / 36pt, weight 600)
    static let optaH1 = Font.system(size: 36, weight: .semibold, design: .default)

    /// H2 - Section Headers (1.5rem / 24pt, weight 600)
    static let optaH2 = Font.system(size: 24, weight: .semibold, design: .default)

    /// H3 - Card Titles (1.125rem / 18pt, weight 600)
    static let optaH3 = Font.system(size: 18, weight: .semibold, design: .default)

    // MARK: - Body Text

    /// Body - Standard text (0.875rem / 14pt, weight 400)
    static let optaBody = Font.system(size: 14, weight: .regular, design: .default)

    /// Body Medium - Emphasized body text (14pt, weight 500)
    static let optaBodyMedium = Font.system(size: 14, weight: .medium, design: .default)

    /// Small - Captions (0.75rem / 12pt, weight 400)
    static let optaSmall = Font.system(size: 12, weight: .regular, design: .default)

    // MARK: - Additional Sizes

    /// Extra Small (12pt)
    static let optaXS = Font.system(size: 12, weight: .regular, design: .default)

    /// Small (14pt)
    static let optaSM = Font.system(size: 14, weight: .regular, design: .default)

    /// Base (16pt)
    static let optaBase = Font.system(size: 16, weight: .regular, design: .default)

    /// Large (18pt)
    static let optaLG = Font.system(size: 18, weight: .regular, design: .default)

    /// Extra Large (20pt)
    static let optaXL = Font.system(size: 20, weight: .regular, design: .default)

    /// 2XL (24pt)
    static let opta2XL = Font.system(size: 24, weight: .regular, design: .default)
}

// MARK: - Opta Spacing & Layout

enum OptaSpacing {
    /// Standard border radius (12pt / 0.75rem)
    static let radius: CGFloat = 12

    /// Small border radius (8pt)
    static let radiusSmall: CGFloat = 8

    /// Large border radius (16pt)
    static let radiusLarge: CGFloat = 16

    /// Extra large border radius (24pt)
    static let radiusXL: CGFloat = 24

    // MARK: - Padding Scale

    static let xs: CGFloat = 4
    static let sm: CGFloat = 8
    static let md: CGFloat = 12
    static let lg: CGFloat = 16
    static let xl: CGFloat = 20
    static let xxl: CGFloat = 24
}

// MARK: - Opta Shadow Presets

extension View {
    /// Applies the standard Opta glow shadow
    func optaGlow(intensity: GlowIntensity = .subtle) -> some View {
        self.shadow(
            color: Color.optaPrimary.opacity(intensity.opacity),
            radius: intensity.radius,
            x: 0,
            y: intensity.yOffset
        )
    }

    /// Applies a card shadow
    func optaCardShadow() -> some View {
        self.shadow(
            color: Color.black.opacity(0.3),
            radius: 10,
            x: 0,
            y: 4
        )
    }
}

enum GlowIntensity {
    case subtle
    case strong
    case intense
    case beam

    var opacity: Double {
        switch self {
        case .subtle: return 0.2
        case .strong: return 0.4
        case .intense: return 0.5
        case .beam: return 0.3
        }
    }

    var radius: CGFloat {
        switch self {
        case .subtle: return 15
        case .strong: return 20
        case .intense: return 30
        case .beam: return 60
        }
    }

    var yOffset: CGFloat {
        switch self {
        case .subtle: return 3
        case .strong: return 5
        case .intense: return 8
        case .beam: return 15
        }
    }
}

// MARK: - Easing Curves

/// Animation easing curves matching The Obsidian Standard
enum OptaEasing {
    /// Smooth deceleration (default UI) - [0.22, 1, 0.36, 1]
    static let smoothOut = Animation.timingCurve(0.22, 1, 0.36, 1, duration: 0.3)

    /// Heavy/weighty (ring movements) - [0.16, 1, 0.3, 1]
    static let heavy = Animation.timingCurve(0.16, 1, 0.3, 1, duration: 0.5)

    /// Snappy (hover states) - [0.34, 1.56, 0.64, 1]
    static let snappy = Animation.timingCurve(0.34, 1.56, 0.64, 1, duration: 0.2)

    /// Cinematic (page entrances) - [0.77, 0, 0.175, 1]
    static let cinematic = Animation.timingCurve(0.77, 0, 0.175, 1, duration: 0.8)
}

// MARK: - Preview

#Preview("Design System Colors") {
    ZStack {
        Color.optaBackground
            .ignoresSafeArea()

        ScrollView {
            VStack(spacing: 24) {
                // Typography
                VStack(alignment: .leading, spacing: 12) {
                    Text("Typography")
                        .font(.optaH2)
                        .foregroundStyle(Color.optaForeground)

                    Text("Display Text")
                        .font(.optaDisplay)
                        .foregroundStyle(Color.optaForeground)

                    Text("Heading 1")
                        .font(.optaH1)
                        .foregroundStyle(Color.optaForeground)

                    Text("Heading 2")
                        .font(.optaH2)
                        .foregroundStyle(Color.optaForeground)

                    Text("Heading 3")
                        .font(.optaH3)
                        .foregroundStyle(Color.optaForeground)

                    Text("Body text for standard content")
                        .font(.optaBody)
                        .foregroundStyle(Color.optaForeground)

                    Text("Small caption text")
                        .font(.optaSmall)
                        .foregroundStyle(Color.optaMutedForeground)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding()

                // Colors
                VStack(alignment: .leading, spacing: 12) {
                    Text("Colors")
                        .font(.optaH2)
                        .foregroundStyle(Color.optaForeground)

                    HStack(spacing: 8) {
                        colorSwatch(color: .optaPrimary, name: "Primary")
                        colorSwatch(color: .optaAccent, name: "Accent")
                        colorSwatch(color: .optaSecondary, name: "Secondary")
                    }

                    HStack(spacing: 8) {
                        colorSwatch(color: .optaSuccess, name: "Success")
                        colorSwatch(color: .optaWarning, name: "Warning")
                        colorSwatch(color: .optaDanger, name: "Danger")
                    }

                    HStack(spacing: 8) {
                        colorSwatch(color: .optaCard, name: "Card")
                        colorSwatch(color: .optaMuted, name: "Muted")
                        colorSwatch(color: .optaBorder, name: "Border")
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding()

                // Glow Effects
                VStack(alignment: .leading, spacing: 12) {
                    Text("Glow Effects")
                        .font(.optaH2)
                        .foregroundStyle(Color.optaForeground)

                    HStack(spacing: 16) {
                        RoundedRectangle(cornerRadius: 12)
                            .fill(Color.optaPrimary)
                            .frame(width: 60, height: 60)
                            .optaGlow(intensity: .subtle)

                        RoundedRectangle(cornerRadius: 12)
                            .fill(Color.optaPrimary)
                            .frame(width: 60, height: 60)
                            .optaGlow(intensity: .strong)

                        RoundedRectangle(cornerRadius: 12)
                            .fill(Color.optaPrimary)
                            .frame(width: 60, height: 60)
                            .optaGlow(intensity: .intense)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding()
            }
            .padding()
        }
    }
    .frame(width: 400, height: 700)
}

@ViewBuilder
private func colorSwatch(color: Color, name: String) -> some View {
    VStack(spacing: 4) {
        RoundedRectangle(cornerRadius: 8)
            .fill(color)
            .frame(width: 60, height: 40)
        Text(name)
            .font(.optaSmall)
            .foregroundStyle(Color.optaMutedForeground)
    }
}
