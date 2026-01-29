//
//  ClawdbotTypography.swift
//  ClawdbotKit
//
//  Sora font integration with Moonlight gradient text.
//  Based on Opta Typography Official Font Specification.
//
//  Created by Matthew Byrden
//

import SwiftUI
import CoreText

// MARK: - Font Registration

/// Typography system for Clawdbot apps using Sora font
public enum ClawdbotTypography {
    /// Register custom fonts on app launch
    /// Call this in your App's init or AppDelegate
    public static func registerFonts() {
        let fonts = ["Sora-Light", "Sora-Regular", "Sora-Medium", "Sora-SemiBold", "Sora-Bold"]
        for font in fonts {
            registerFont(named: font)
        }
    }

    private static func registerFont(named name: String) {
        guard let url = Bundle.module.url(forResource: name, withExtension: "ttf"),
              let provider = CGDataProvider(url: url as CFURL),
              let font = CGFont(provider) else {
            print("ClawdbotKit: Failed to load font \(name)")
            return
        }

        var error: Unmanaged<CFError>?
        if !CTFontManagerRegisterGraphicsFont(font, &error) {
            if let error = error?.takeRetainedValue() {
                print("ClawdbotKit: Failed to register font \(name): \(error)")
            }
        }
    }
}

// MARK: - Font Extensions

public extension Font {
    /// Sora font with specified size and weight
    static func sora(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
        let fontName: String
        switch weight {
        case .light: fontName = "Sora-Light"
        case .regular: fontName = "Sora-Regular"
        case .medium: fontName = "Sora-Medium"
        case .semibold: fontName = "Sora-SemiBold"
        case .bold: fontName = "Sora-Bold"
        default: fontName = "Sora-Regular"
        }
        return .custom(fontName, size: size)
    }

    /// Hero display font (34pt bold) - iOS equivalent of 56px web
    static var soraHero: Font { .sora(34, weight: .bold) }

    /// Section header font (28pt semibold) - iOS equivalent of 1.75rem
    static var soraSectionHeader: Font { .sora(28, weight: .semibold) }

    /// Subsection title font (20pt semibold) - iOS equivalent of 1.25rem
    static var soraSubsection: Font { .sora(20, weight: .semibold) }

    /// Subtitle font (17pt light) - iOS equivalent of 1.1rem
    static var soraSubtitle: Font { .sora(17, weight: .light) }

    /// Body font (15pt regular) - iOS equivalent of 1rem
    static var soraBody: Font { .sora(15, weight: .regular) }

    /// Caption font (13pt regular) - iOS equivalent of 0.875rem
    static var soraCaption: Font { .sora(13, weight: .regular) }

    /// Badge font (12pt regular) - iOS equivalent of 0.8rem
    static var soraBadge: Font { .sora(12, weight: .regular) }
}

// MARK: - Moonlight Gradient Text

/// Gradient text view matching Opta Life Manager hero style
///
/// Displays text with the signature Moonlight gradient (white -> violet -> indigo)
/// and atmospheric purple glow shadow.
///
/// Usage:
/// ```swift
/// MoonlightText("OPTA")
/// MoonlightText("Custom", size: 24, weight: .semibold)
/// ```
public struct MoonlightText: View {
    let text: String
    let size: CGFloat
    let weight: Font.Weight
    let tracking: CGFloat

    /// Create a MoonlightText view
    /// - Parameters:
    ///   - text: The text to display
    ///   - size: Font size in points (default: 34pt for hero)
    ///   - weight: Font weight (default: .bold)
    ///   - tracking: Letter spacing as em ratio (default: 0.12 for hero style)
    public init(
        _ text: String,
        size: CGFloat = 34,
        weight: Font.Weight = .bold,
        tracking: CGFloat = 0.12
    ) {
        self.text = text
        self.size = size
        self.weight = weight
        self.tracking = tracking
    }

    public var body: some View {
        Text(text)
            .font(.sora(size, weight: weight))
            .tracking(size * tracking)
            .foregroundStyle(LinearGradient.moonlight)
            .shadow(color: .clawdbotPurple.opacity(0.5), radius: 40, x: 0, y: 0)
    }
}

// MARK: - Moonlight Gradient Definition

public extension LinearGradient {
    /// The signature Opta moonlight gradient (white -> violet -> indigo)
    ///
    /// Gradient stops:
    /// - 0%: #fafafa (White)
    /// - 50%: #a855f7 (Electric Violet)
    /// - 100%: #6366f1 (Indigo)
    ///
    /// Direction: top to bottom (180deg), mimicking overhead lighting
    static var moonlight: LinearGradient {
        LinearGradient(
            colors: [
                Color(hex: "fafafa"),
                Color(hex: "a855f7"),
                Color(hex: "6366f1")
            ],
            startPoint: .top,
            endPoint: .bottom
        )
    }
}

// MARK: - Tracking Modifiers

/// View modifiers for Opta Typography letter-spacing presets
///
/// CSS `letter-spacing: 0.12em` translates to SwiftUI tracking = fontSize * 0.12
public extension View {
    /// Hero tracking (0.12em equivalent)
    /// - Parameter fontSize: The font size for tracking calculation (default: 34pt hero size)
    func trackingHero(fontSize: CGFloat = 34) -> some View {
        self.tracking(fontSize * 0.12)
    }

    /// Subtitle tracking (0.25em equivalent)
    /// - Parameter fontSize: The font size for tracking calculation (default: 17pt subtitle size)
    func trackingSubtitle(fontSize: CGFloat = 17) -> some View {
        self.tracking(fontSize * 0.25)
    }

    /// Section header tracking (0.08em equivalent)
    /// - Parameter fontSize: The font size for tracking calculation (default: 28pt header size)
    func trackingSectionHeader(fontSize: CGFloat = 28) -> some View {
        self.tracking(fontSize * 0.08)
    }

    /// Badge tracking (0.15em equivalent)
    /// - Parameter fontSize: The font size for tracking calculation (default: 12pt badge size)
    func trackingBadge(fontSize: CGFloat = 12) -> some View {
        self.tracking(fontSize * 0.15)
    }

    /// Subsection tracking (0.05em equivalent)
    /// - Parameter fontSize: The font size for tracking calculation (default: 20pt subsection size)
    func trackingSubsection(fontSize: CGFloat = 20) -> some View {
        self.tracking(fontSize * 0.05)
    }
}

// MARK: - Typography Style Modifiers

/// Compound modifiers that apply complete Opta typography styles
///
/// These modifiers combine font, tracking, and color in a single call,
/// matching the Opta Typography Specification exactly.
public extension View {
    /// Apply hero style: Sora Bold 34pt, 0.12em tracking, primary text color
    ///
    /// Use for page titles and brand moments.
    /// For gradient hero text, use `MoonlightText` instead.
    func optaHeroStyle() -> some View {
        self
            .font(.soraHero)
            .tracking(34 * 0.12)
            .foregroundColor(.clawdbotTextPrimary)
    }

    /// Apply subtitle style: Sora Light 17pt, 0.25em tracking, uppercase, secondary color
    ///
    /// Use for descriptive subtitles under hero headings.
    func optaSubtitleStyle() -> some View {
        self
            .font(.soraSubtitle)
            .tracking(17 * 0.25)
            .textCase(.uppercase)
            .foregroundColor(.clawdbotTextSecondary)
    }

    /// Apply section header style: Sora SemiBold 28pt, 0.08em tracking, primary color
    ///
    /// Use for major section headings in content.
    func optaSectionHeaderStyle() -> some View {
        self
            .font(.soraSectionHeader)
            .tracking(28 * 0.08)
            .foregroundColor(.clawdbotTextPrimary)
    }

    /// Apply subsection style: Sora SemiBold 20pt, 0.05em tracking, primary color
    ///
    /// Use for subsection titles within sections.
    func optaSubsectionStyle() -> some View {
        self
            .font(.soraSubsection)
            .tracking(20 * 0.05)
            .foregroundColor(.clawdbotTextPrimary)
    }

    /// Apply body style: Sora Regular 15pt, normal tracking, primary color
    ///
    /// Use for paragraph text and content.
    func optaBodyStyle() -> some View {
        self
            .font(.soraBody)
            .foregroundColor(.clawdbotTextPrimary)
    }

    /// Apply caption style: Sora Regular 13pt, normal tracking, secondary color
    ///
    /// Use for captions and metadata.
    func optaCaptionStyle() -> some View {
        self
            .font(.soraCaption)
            .foregroundColor(.clawdbotTextSecondary)
    }

    /// Apply badge style: Sora Regular 12pt, 0.15em tracking, purple color
    ///
    /// Use for version tags and status badges.
    func optaBadgeStyle() -> some View {
        self
            .font(.soraBadge)
            .tracking(12 * 0.15)
            .foregroundColor(.clawdbotPurple)
    }
}
