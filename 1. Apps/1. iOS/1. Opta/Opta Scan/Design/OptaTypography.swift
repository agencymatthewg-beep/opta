//
//  OptaTypography.swift
//  Opta Scan
//
//  Font system following IOS_AESTHETIC_GUIDE.md
//  Uses SF Pro (system font) with Dynamic Type support
//
//  Created by Matthew Byrden
//

import SwiftUI

// MARK: - Font Extensions

extension Font {
    /// Hero/Display text - 34pt bold rounded
    static let optaDisplay = Font.system(size: 34, weight: .bold, design: .rounded)

    /// Section headers - 22pt semibold
    static let optaTitle = Font.system(size: 22, weight: .semibold)

    /// Card titles - 17pt semibold
    static let optaHeadline = Font.system(size: 17, weight: .semibold)

    /// Body content - 15pt regular
    static let optaBody = Font.system(size: 15, weight: .regular)

    /// Secondary/captions - 13pt medium
    static let optaCaption = Font.system(size: 13, weight: .medium)

    /// Tiny labels - 11pt medium
    static let optaLabel = Font.system(size: 11, weight: .medium)
}

// MARK: - Dynamic Type Style Modifiers

extension View {
    /// Apply display text style (primary text color)
    func optaDisplayStyle() -> some View {
        self
            .font(.optaDisplay)
            .foregroundStyle(Color.optaTextPrimary)
    }

    /// Apply title text style (primary text color)
    func optaTitleStyle() -> some View {
        self
            .font(.optaTitle)
            .foregroundStyle(Color.optaTextPrimary)
    }

    /// Apply headline text style (primary text color)
    func optaHeadlineStyle() -> some View {
        self
            .font(.optaHeadline)
            .foregroundStyle(Color.optaTextPrimary)
    }

    /// Apply body text style (secondary text color)
    func optaBodyStyle() -> some View {
        self
            .font(.optaBody)
            .foregroundStyle(Color.optaTextSecondary)
    }

    /// Apply caption text style (secondary text color)
    func optaCaptionStyle() -> some View {
        self
            .font(.optaCaption)
            .foregroundStyle(Color.optaTextSecondary)
    }

    /// Apply label text style (muted text color)
    func optaLabelStyle() -> some View {
        self
            .font(.optaLabel)
            .foregroundStyle(Color.optaTextMuted)
    }
}

// MARK: - Gradient Text View

/// Text view with gradient foreground for emphasis
struct GradientText: View {
    let text: String
    var font: Font = .optaDisplay

    var body: some View {
        Text(text)
            .font(font)
            .foregroundStyle(Color.optaMoonlight)
    }
}

// MARK: - Gradient Text Modifier

extension View {
    /// Apply moonlight gradient to text/icons
    func optaGradientStyle() -> some View {
        self.foregroundStyle(Color.optaMoonlight)
    }
}

// MARK: - Usage Examples Reference
/*
 // Display text
 Text("Opta Scan")
     .optaDisplayStyle()

 // Title with gradient
 GradientText(text: "Optimized")

 // Body text
 Text("Your result is ready")
     .optaBodyStyle()

 // Caption text
 Text("Tap to see details")
     .optaCaptionStyle()
 */
