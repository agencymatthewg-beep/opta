//
//  Typography.swift
//  OptaMolt
//
//  Opta design system typography tokens.
//  Sora is the brand typeface — falls back to system font when not installed.
//
//  Usage:
//  ```swift
//  Text("Title")
//      .font(.sora(18, weight: .bold))
//
//  Text("Body text")
//      .font(.soraBody)
//  ```
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
    /// Falls back to the system rounded design font if Sora is not installed on
    /// the device. This keeps the visual language close even without the custom
    /// typeface bundled.
    ///
    /// - Parameters:
    ///   - size: Point size of the font.
    ///   - weight: Font weight (e.g. `.regular`, `.medium`, `.semibold`, `.bold`).
    /// - Returns: A `Font` configured with Sora or a system fallback.
    static func sora(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
        // Attempt to use the installed Sora font family.
        // Sora weight names map to their PostScript identifiers.
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

        // On both iOS and macOS, `Font.custom` will silently fall back to the
        // system font if the named font is not found — but we prefer the rounded
        // system design as a closer visual match to Sora's geometric style.
        #if os(iOS)
        if UIFont(name: weightName, size: size) != nil {
            return .custom(weightName, size: size)
        }
        #elseif os(macOS)
        if NSFont(name: weightName, size: size) != nil {
            return .custom(weightName, size: size)
        }
        #endif

        // Fallback: system rounded design at the same size and weight.
        return .system(size: size, weight: weight, design: .rounded)
    }

    // MARK: Presets

    /// Body preset — 15pt regular Sora. The default for prose and chat messages.
    static let soraBody: Font = .sora(15, weight: .regular)

    /// Caption preset — 12pt regular Sora. Timestamps, hints, metadata.
    static let soraCaption: Font = .sora(12, weight: .regular)

    /// Headline preset — 20pt semibold Sora. Section titles and prominent headers.
    static let soraHeadline: Font = .sora(20, weight: .semibold)
}
