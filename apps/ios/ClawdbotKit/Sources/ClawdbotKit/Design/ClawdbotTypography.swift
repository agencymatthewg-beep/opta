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
