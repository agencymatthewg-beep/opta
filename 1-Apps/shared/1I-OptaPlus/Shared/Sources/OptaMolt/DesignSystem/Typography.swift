//
//  Typography.swift
//  OptaMolt
//
//  Opta design system typography tokens.
//  Sora is the brand typeface — falls back to system rounded font when not installed.
//

import SwiftUI
#if os(iOS)
import UIKit
#elseif os(macOS)
import AppKit
#endif

// MARK: - Sora Font Extensions

public extension Font {

    /// Custom Sora font at the given size and weight.
    ///
    /// Falls back to the system rounded design font if Sora is not installed.
    static func sora(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
        let weightName: String
        switch weight {
        case .ultraLight: weightName = "Sora-ExtraLight"
        case .thin:       weightName = "Sora-Thin"
        case .light:      weightName = "Sora-Light"
        case .regular:    weightName = "Sora-Regular"
        case .medium:     weightName = "Sora-Medium"
        case .semibold:   weightName = "Sora-SemiBold"
        case .bold:       weightName = "Sora-Bold"
        case .heavy:      weightName = "Sora-ExtraBold"
        case .black:      weightName = "Sora-ExtraBold"
        default:          weightName = "Sora-Regular"
        }

        #if os(iOS)
        if UIFont(name: weightName, size: size) != nil {
            return .custom(weightName, size: size)
        }
        #elseif os(macOS)
        if NSFont(name: weightName, size: size) != nil {
            return .custom(weightName, size: size)
        }
        #endif

        return .system(size: size, weight: weight, design: .rounded)
    }

    // MARK: - Complete Type Scale

    /// Large title — 34pt bold Sora. Hero banners, splash screens.
    static let soraLargeTitle: Font = .sora(34, weight: .bold)
    /// Title 1 — 28pt semibold Sora. Primary page titles.
    static let soraTitle1: Font = .sora(28, weight: .semibold)
    /// Title 2 — 22pt semibold Sora. Section titles.
    static let soraTitle2: Font = .sora(22, weight: .semibold)
    /// Title 3 — 18pt semibold Sora. Subsection titles.
    static let soraTitle3: Font = .sora(18, weight: .semibold)
    /// Headline — 16pt semibold Sora. Prominent headers.
    static let soraHeadline: Font = .sora(16, weight: .semibold)
    /// Subhead — 15pt medium Sora. Secondary headers.
    static let soraSubhead: Font = .sora(15, weight: .medium)
    /// Callout — 14pt regular Sora. Callout text.
    static let soraCallout: Font = .sora(14, weight: .regular)
    /// Body — 13pt regular Sora. Default prose and chat messages.
    static let soraBody: Font = .sora(13, weight: .regular)
    /// Footnote — 11pt regular Sora. Footnotes, secondary metadata.
    static let soraFootnote: Font = .sora(11, weight: .regular)
    /// Caption — 10pt regular Sora. Timestamps, hints, metadata.
    static let soraCaption: Font = .sora(10, weight: .regular)
}

// MARK: - Convenience View Modifiers

public extension View {
    /// Apply caption typography (10pt Sora, muted text color).
    func optaCaption() -> some View {
        self.font(.soraCaption)
            .foregroundStyle(Color.optaTextMuted)
    }

    /// Apply body typography (13pt Sora, primary text color).
    func optaBody() -> some View {
        self.font(.soraBody)
            .foregroundStyle(Color.optaTextPrimary)
    }

    /// Apply headline typography (16pt Sora semibold, primary text color).
    func optaHeadline() -> some View {
        self.font(.soraHeadline)
            .foregroundStyle(Color.optaTextPrimary)
    }

    /// Apply title typography (28pt Sora semibold, primary text color).
    func optaTitle() -> some View {
        self.font(.soraTitle1)
            .foregroundStyle(Color.optaTextPrimary)
    }
}
