//
//  GlassModifiers.swift
//  Opta Scan
//
//  Glass depth system following IOS_AESTHETIC_GUIDE.md
//  Three distinct levels of glass create spatial hierarchy
//
//  Created by Matthew Byrden
//

import SwiftUI

// MARK: - Level 1: Subtle (Background Elements)

/// Glass modifier for background elements - most subtle blur
struct GlassSubtle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .background(.ultraThinMaterial)
            .background(Color.optaSurface.opacity(0.3))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(Color.white.opacity(0.05), lineWidth: 1)
            )
            .cornerRadius(12)
    }
}

// MARK: - Level 2: Content (Cards, Sheets)

/// Glass modifier for content elements - standard glass effect
struct GlassContent: ViewModifier {
    func body(content: Content) -> some View {
        content
            .background(.thinMaterial)
            .background(Color.optaSurface.opacity(0.5))
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(
                        LinearGradient(
                            colors: [Color.white.opacity(0.1), Color.white.opacity(0.02)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        lineWidth: 1
                    )
            )
            .cornerRadius(16)
            .shadow(color: .black.opacity(0.3), radius: 20, y: 10)
    }
}

// MARK: - Level 3: Overlay (Modals, Popovers)

/// Glass modifier for overlay elements - most prominent blur
struct GlassOverlay: ViewModifier {
    func body(content: Content) -> some View {
        content
            .background(.regularMaterial)
            .background(Color.optaSurface.opacity(0.7))
            .overlay(
                RoundedRectangle(cornerRadius: 24)
                    .stroke(Color.optaPurple.opacity(0.15), lineWidth: 1)
            )
            .cornerRadius(24)
            .shadow(color: .black.opacity(0.5), radius: 40, y: 20)
    }
}

// MARK: - View Extensions

extension View {
    /// Apply subtle glass effect (background elements)
    /// Uses .ultraThinMaterial with 12pt corner radius
    func glassSubtle() -> some View {
        modifier(GlassSubtle())
    }

    /// Apply content glass effect (cards, sheets)
    /// Uses .thinMaterial with 16pt corner radius and shadow
    func glassContent() -> some View {
        modifier(GlassContent())
    }

    /// Apply overlay glass effect (modals, popovers)
    /// Uses .regularMaterial with 24pt corner radius and purple accent
    func glassOverlay() -> some View {
        modifier(GlassOverlay())
    }
}

// MARK: - Glass Level Reference
/*
 | Level   | Use Case           | Material           | Corner Radius |
 |---------|--------------------|--------------------|---------------|
 | Subtle  | Background elements| .ultraThinMaterial | 12pt          |
 | Content | Cards, sheets      | .thinMaterial      | 16pt          |
 | Overlay | Modals, popovers   | .regularMaterial   | 24pt          |

 Usage:
 - glassSubtle() for tab bars, background containers
 - glassContent() for result cards, info cards
 - glassOverlay() for modal sheets, confirmation dialogs
 */
