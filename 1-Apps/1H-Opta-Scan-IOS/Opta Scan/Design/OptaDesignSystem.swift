//
//  OptaDesignSystem.swift
//  Opta Scan
//
//  Central export for the Opta Design System
//  Import this file to access all design primitives
//
//  Created by Matthew Byrden
//

import SwiftUI

// MARK: - Design System Documentation

/*
 # Opta Scan Design System

 This design system implements the IOS_AESTHETIC_GUIDE.md specifications.

 ## Components

 ### Colors (OptaColors.swift)
 - optaBackground: #09090b (OLED optimized, NOT true black)
 - optaSurface, optaSurfaceElevated, optaBorder
 - optaTextPrimary, optaTextSecondary, optaTextMuted
 - optaPurple, optaPurpleGlow (brand)
 - optaBlue, optaGreen, optaAmber, optaRed (semantic)
 - optaMoonlight (gradient)

 ### Animations (OptaAnimations.swift)
 - .optaSpring: Quick interactions (0.3, 0.7)
 - .optaSpringGentle: Page transitions (0.5, 0.8)
 - .optaSpringPage: Sheets (0.6, 0.85)
 - .optaSpringBounce: Success states (0.4, 0.5)
 - NEVER use duration-based animations

 ### Haptics (OptaHaptics.swift)
 - OptaHaptics.shared.tap(): Light interactions
 - OptaHaptics.shared.buttonPress(): Primary actions
 - OptaHaptics.shared.success(): Positive outcomes
 - OptaHaptics.shared.processingStart(): Heavy operations

 ### Typography (OptaTypography.swift)
 - .optaDisplay: Hero text (34pt bold rounded)
 - .optaTitle: Section headers (22pt semibold)
 - .optaHeadline: Card titles (17pt semibold)
 - .optaBody: Body content (15pt regular)
 - .optaCaption: Secondary text (13pt medium)
 - .optaLabel: Tiny labels (11pt medium)
 - GradientText: For emphasis

 ### Glass Effects (GlassModifiers.swift)
 - .glassSubtle(): Background elements (ultraThinMaterial)
 - .glassContent(): Cards, sheets (thinMaterial)
 - .glassOverlay(): Modals (regularMaterial)

 ## Usage

 ```swift
 import SwiftUI

 struct ExampleView: View {
     var body: some View {
         ZStack {
             Color.optaBackground.ignoresSafeArea()

             VStack {
                 GradientText(text: "Optimized")

                 Text("Your result")
                     .optaBodyStyle()
             }
             .padding()
             .glassContent()
         }
         .animation(.optaSpring, value: someValue)
     }
 }
 ```

 ## Quick Reference

 ### Do's
 - Use #09090b for backgrounds (OLED optimized)
 - Use spring animations exclusively
 - Use SF Symbols for all icons
 - Use .material for glass effects
 - Trigger haptics at animation start
 - Support Dynamic Type

 ### Don'ts
 - Don't use true black #000000
 - Don't use duration-based animations
 - Don't use custom icon images
 - Don't hardcode font sizes
 - Don't skip haptic feedback
 */

// MARK: - Design System Namespace

/// Namespace for design system constants and utilities
enum OptaDesign {
    // MARK: Corner Radii

    /// Standard corner radii used throughout the app
    enum CornerRadius {
        static let small: CGFloat = 8
        static let medium: CGFloat = 12
        static let large: CGFloat = 16
        static let extraLarge: CGFloat = 24
    }

    // MARK: Spacing

    /// Standard spacing values
    enum Spacing {
        static let xxs: CGFloat = 4
        static let xs: CGFloat = 8
        static let sm: CGFloat = 12
        static let md: CGFloat = 16
        static let lg: CGFloat = 24
        static let xl: CGFloat = 32
        static let xxl: CGFloat = 48
    }

    // MARK: Animation Durations (for reference only)

    /// Spring response times for documentation
    /// Note: Use Animation extensions, not these values directly
    enum AnimationTiming {
        static let quick: Double = 0.3
        static let gentle: Double = 0.5
        static let page: Double = 0.6
    }
}

// MARK: - Preview Helpers

#if DEBUG
/// Preview container with Opta dark background
struct OptaPreviewContainer<Content: View>: View {
    let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        ZStack {
            Color.optaBackground.ignoresSafeArea()
            content
        }
        .preferredColorScheme(.dark)
    }
}
#endif
