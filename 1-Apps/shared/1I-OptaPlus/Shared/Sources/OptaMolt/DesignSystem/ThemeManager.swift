//
//  ThemeManager.swift
//  OptaMolt
//
//  Theme system for OptaPlus — supports built-in themes and custom accent colors.
//  All preferences are persisted to UserDefaults and observed by views.
//

import SwiftUI
import Combine

// MARK: - App Theme

/// A complete color theme definition.
public struct AppTheme: Identifiable, Equatable, Hashable {
    public let id: String
    public let name: String
    public let backgroundColor: Color
    public let surfaceColor: Color
    public let elevatedColor: Color
    public let accentColor: Color
    public let accentGlow: Color

    public init(
        id: String,
        name: String,
        backgroundColor: Color,
        surfaceColor: Color,
        elevatedColor: Color,
        accentColor: Color,
        accentGlow: Color
    ) {
        self.id = id
        self.name = name
        self.backgroundColor = backgroundColor
        self.surfaceColor = surfaceColor
        self.elevatedColor = elevatedColor
        self.accentColor = accentColor
        self.accentGlow = accentGlow
    }
}

// MARK: - Built-in Themes

public extension AppTheme {
    /// Cinematic Void — default. Deep black OLED background, electric violet accent.
    static let cinematicVoid = AppTheme(
        id: "cinematic-void",
        name: "Cinematic Void",
        backgroundColor: Color(hex: "#050505"),
        surfaceColor: Color(hex: "#0A0A0A"),
        elevatedColor: Color(hex: "#121212"),
        accentColor: Color(hex: "#8B5CF6"),
        accentGlow: Color(hex: "#A78BFA")
    )

    /// Midnight Blue — deep navy background, blue accent.
    static let midnightBlue = AppTheme(
        id: "midnight-blue",
        name: "Midnight Blue",
        backgroundColor: Color(hex: "#0A0E1A"),
        surfaceColor: Color(hex: "#0F1424"),
        elevatedColor: Color(hex: "#161C30"),
        accentColor: Color(hex: "#3B82F6"),
        accentGlow: Color(hex: "#60A5FA")
    )

    /// Carbon — near-black with green accent, Matrix-inspired.
    static let carbon = AppTheme(
        id: "carbon",
        name: "Carbon",
        backgroundColor: Color(hex: "#0C0C0C"),
        surfaceColor: Color(hex: "#111111"),
        elevatedColor: Color(hex: "#1A1A1A"),
        accentColor: Color(hex: "#22C55E"),
        accentGlow: Color(hex: "#4ADE80")
    )

    /// All built-in themes.
    static let allBuiltIn: [AppTheme] = [.cinematicVoid, .midnightBlue, .carbon]
}

// MARK: - Font Scale

/// User-configurable font size scaling.
public enum FontScale: String, CaseIterable, Sendable {
    case small = "small"
    case `default` = "default"
    case large = "large"
    case extraLarge = "extraLarge"

    public var label: String {
        switch self {
        case .small: return "Small"
        case .default: return "Default"
        case .large: return "Large"
        case .extraLarge: return "Extra Large"
        }
    }

    /// Point offset from the base font size.
    public var offset: CGFloat {
        switch self {
        case .small: return -2
        case .default: return 0
        case .large: return 2
        case .extraLarge: return 4
        }
    }

    /// Slider index (0-3).
    public var index: Double {
        switch self {
        case .small: return 0
        case .default: return 1
        case .large: return 2
        case .extraLarge: return 3
        }
    }

    public init(index: Double) {
        switch Int(index.rounded()) {
        case 0: self = .small
        case 2: self = .large
        case 3: self = .extraLarge
        default: self = .default
        }
    }
}

// MARK: - Chat Density

/// User-configurable chat message density.
public enum ChatDensity: String, CaseIterable, Sendable {
    case compact = "compact"
    case comfortable = "comfortable"
    case spacious = "spacious"

    public var label: String {
        switch self {
        case .compact: return "Compact"
        case .comfortable: return "Comfortable"
        case .spacious: return "Spacious"
        }
    }

    /// Vertical spacing between messages.
    public var messageSpacing: CGFloat {
        switch self {
        case .compact: return 4
        case .comfortable: return 10
        case .spacious: return 18
        }
    }

    /// Padding inside message bubbles.
    public var bubblePadding: CGFloat {
        switch self {
        case .compact: return 8
        case .comfortable: return 12
        case .spacious: return 18
        }
    }

    /// Max width fraction for message bubbles (0-1).
    public var bubbleMaxWidthFraction: CGFloat {
        switch self {
        case .compact: return 0.85
        case .comfortable: return 0.75
        case .spacious: return 0.65
        }
    }
}

// MARK: - Background Mode

/// Ambient background rendering mode.
public enum BackgroundMode: String, CaseIterable, Sendable {
    case on = "on"
    case off = "off"
    case subtle = "subtle"

    public var label: String {
        switch self {
        case .on: return "On"
        case .off: return "Off"
        case .subtle: return "Subtle"
        }
    }
}

// MARK: - Theme Manager

/// Central manager for all appearance settings. Observed by views for live updates.
@MainActor
public final class ThemeManager: ObservableObject {

    public static let shared = ThemeManager()

    // MARK: - Published Properties

    /// Currently selected theme.
    @Published public var currentTheme: AppTheme {
        didSet { UserDefaults.standard.set(currentTheme.id, forKey: Keys.themeId) }
    }

    /// Custom accent color override (nil = use theme default).
    @Published public var customAccentColor: Color? {
        didSet { persistCustomAccent() }
    }

    /// Font size scale.
    @Published public var fontScale: FontScale {
        didSet { UserDefaults.standard.set(fontScale.rawValue, forKey: Keys.fontScale) }
    }

    /// Chat message density.
    @Published public var chatDensity: ChatDensity {
        didSet { UserDefaults.standard.set(chatDensity.rawValue, forKey: Keys.chatDensity) }
    }

    /// Background rendering mode.
    @Published public var backgroundMode: BackgroundMode {
        didSet { UserDefaults.standard.set(backgroundMode.rawValue, forKey: Keys.backgroundMode) }
    }

    /// Per-bot custom accent colors (botId → hex string).
    @Published public var botAccentOverrides: [String: String] {
        didSet {
            if let data = try? JSONEncoder().encode(botAccentOverrides) {
                UserDefaults.standard.set(data, forKey: Keys.botAccentOverrides)
            }
        }
    }

    // MARK: - Computed

    /// Effective accent color (custom override or theme default).
    public var effectiveAccent: Color {
        customAccentColor ?? currentTheme.accentColor
    }

    /// Effective background color from current theme.
    public var effectiveBackground: Color {
        currentTheme.backgroundColor
    }

    /// Effective surface color from current theme.
    public var effectiveSurface: Color {
        currentTheme.surfaceColor
    }

    /// Effective elevated color from current theme.
    public var effectiveElevated: Color {
        currentTheme.elevatedColor
    }

    /// Scaled body font size.
    public var scaledBodySize: CGFloat { 13 + fontScale.offset }

    /// Scaled input font size.
    public var scaledInputSize: CGFloat { 14 + fontScale.offset }

    /// Get accent color for a specific bot, with override support.
    public func accentColor(forBotId botId: String, fallback: Color) -> Color {
        if let hex = botAccentOverrides[botId] {
            return Color(hex: hex)
        }
        return fallback
    }

    /// Set a custom accent color for a bot.
    public func setBotAccent(_ color: Color, forBotId botId: String) {
        botAccentOverrides[botId] = color.hexString
    }

    /// Clear a bot's custom accent color.
    public func clearBotAccent(forBotId botId: String) {
        botAccentOverrides.removeValue(forKey: botId)
    }

    // MARK: - Init

    private init() {
        // Restore theme
        let savedThemeId = UserDefaults.standard.string(forKey: Keys.themeId) ?? "cinematic-void"
        self.currentTheme = AppTheme.allBuiltIn.first { $0.id == savedThemeId } ?? .cinematicVoid

        // Restore custom accent
        if let components = UserDefaults.standard.array(forKey: Keys.customAccent) as? [Double],
           components.count == 3 {
            self.customAccentColor = Color(red: components[0], green: components[1], blue: components[2])
        } else {
            self.customAccentColor = nil
        }

        // Restore font scale
        let savedScale = UserDefaults.standard.string(forKey: Keys.fontScale) ?? "default"
        self.fontScale = FontScale(rawValue: savedScale) ?? .default

        // Restore density
        let savedDensity = UserDefaults.standard.string(forKey: Keys.chatDensity) ?? "comfortable"
        self.chatDensity = ChatDensity(rawValue: savedDensity) ?? .comfortable

        // Restore background mode
        let savedBg = UserDefaults.standard.string(forKey: Keys.backgroundMode) ?? "on"
        self.backgroundMode = BackgroundMode(rawValue: savedBg) ?? .on

        // Restore bot accent overrides
        if let data = UserDefaults.standard.data(forKey: Keys.botAccentOverrides),
           let decoded = try? JSONDecoder().decode([String: String].self, from: data) {
            self.botAccentOverrides = decoded
        } else {
            self.botAccentOverrides = [:]
        }
    }

    // MARK: - Persistence Helpers

    private func persistCustomAccent() {
        if let color = customAccentColor {
            let components = color.rgbComponents
            UserDefaults.standard.set([components.r, components.g, components.b], forKey: Keys.customAccent)
        } else {
            UserDefaults.standard.removeObject(forKey: Keys.customAccent)
        }
    }

    private enum Keys {
        static let themeId = "optaplus.theme.id"
        static let customAccent = "optaplus.theme.customAccent"
        static let fontScale = "optaplus.fontScale"
        static let chatDensity = "optaplus.chatDensity"
        static let backgroundMode = "optaplus.backgroundMode"
        static let botAccentOverrides = "optaplus.botAccentOverrides"
    }
}

// MARK: - Color Helpers

public extension Color {
    /// Extract approximate RGB components (works for static colors).
    var rgbComponents: (r: Double, g: Double, b: Double) {
        #if canImport(AppKit)
        let nsColor = NSColor(self).usingColorSpace(.deviceRGB) ?? NSColor(self)
        return (nsColor.redComponent, nsColor.greenComponent, nsColor.blueComponent)
        #elseif canImport(UIKit)
        var r: CGFloat = 0; var g: CGFloat = 0; var b: CGFloat = 0
        UIColor(self).getRed(&r, green: &g, blue: &b, alpha: nil)
        return (r, g, b)
        #endif
    }

    /// Convert to hex string.
    var hexString: String {
        let c = rgbComponents
        let r = Int(c.r * 255)
        let g = Int(c.g * 255)
        let b = Int(c.b * 255)
        return String(format: "#%02X%02X%02X", r, g, b)
    }
}

// MARK: - Environment Keys

private struct ThemeManagerKey: EnvironmentKey {
    @MainActor static let defaultValue: ThemeManager = .shared
}

private struct FontScaleOffsetKey: EnvironmentKey {
    static let defaultValue: CGFloat = 0
}

private struct ChatDensityKey: EnvironmentKey {
    static let defaultValue: ChatDensity = .comfortable
}

private struct BackgroundModeKey: EnvironmentKey {
    static let defaultValue: BackgroundMode = .on
}

public extension EnvironmentValues {
    var themeManager: ThemeManager {
        get { self[ThemeManagerKey.self] }
        set { self[ThemeManagerKey.self] = newValue }
    }

    var fontScaleOffset: CGFloat {
        get { self[FontScaleOffsetKey.self] }
        set { self[FontScaleOffsetKey.self] = newValue }
    }

    var chatDensity: ChatDensity {
        get { self[ChatDensityKey.self] }
        set { self[ChatDensityKey.self] = newValue }
    }

    var backgroundMode: BackgroundMode {
        get { self[BackgroundModeKey.self] }
        set { self[BackgroundModeKey.self] = newValue }
    }
}

// MARK: - Scaled Font Modifier

/// Applies font scale offset to a base font size.
public struct ScaledFontModifier: ViewModifier {
    let baseSize: CGFloat
    let weight: Font.Weight

    @Environment(\.fontScaleOffset) private var offset

    public func body(content: Content) -> some View {
        content.font(.sora(baseSize + offset, weight: weight))
    }
}

public extension View {
    /// Apply a scaled Sora font that responds to the user's font scale preference.
    func scaledFont(baseSize: CGFloat = 13, weight: Font.Weight = .regular) -> some View {
        modifier(ScaledFontModifier(baseSize: baseSize, weight: weight))
    }
}
