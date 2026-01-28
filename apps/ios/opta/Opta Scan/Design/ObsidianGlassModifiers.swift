//
//  ObsidianGlassModifiers.swift
//  Opta Scan
//
//  Enhanced glass modifiers using Metal shaders
//  Part of Phase 10: Metal Shaders
//
//  Created by Matthew Byrden
//

import SwiftUI
import UIKit

// MARK: - Obsidian Glass Levels

/// Enhanced glass modifiers that layer Metal shaders over SwiftUI materials
enum ObsidianGlassLevel {
    case subtle     // Background elements
    case content    // Cards, sheets
    case overlay    // Modals, popovers

    var depth: Double {
        switch self {
        case .subtle: return 0.3
        case .content: return 0.5
        case .overlay: return 0.7
        }
    }

    var glowIntensity: Double {
        switch self {
        case .subtle: return 0.15
        case .content: return 0.25
        case .overlay: return 0.35
        }
    }

    var cornerRadius: CGFloat {
        switch self {
        case .subtle: return 12
        case .content: return 16
        case .overlay: return 24
        }
    }
}

// MARK: - Obsidian Glass Modifier

@available(iOS 17.0, *)
struct ObsidianGlassModifier: ViewModifier {
    let level: ObsidianGlassLevel
    let glowColor: Color

    func body(content: Content) -> some View {
        content
            // Base material layer
            .background(materialForLevel)
            .background(Color.optaSurface.opacity(opacityForLevel))
            // Metal shader enhancement
            .obsidianGlass(
                depth: level.depth,
                glowColor: glowColor,
                glowIntensity: level.glowIntensity,
                isEnabled: !UIAccessibility.isReduceMotionEnabled
            )
            // Border with gradient
            .overlay(
                RoundedRectangle(cornerRadius: level.cornerRadius, style: .continuous)
                    .stroke(
                        LinearGradient(
                            colors: [glowColor.opacity(0.15), glowColor.opacity(0.02)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        lineWidth: 1
                    )
            )
            .clipShape(RoundedRectangle(cornerRadius: level.cornerRadius, style: .continuous))
            .shadow(color: .black.opacity(shadowOpacityForLevel), radius: shadowRadiusForLevel, y: shadowYForLevel)
    }

    @ViewBuilder
    private var materialForLevel: some View {
        switch level {
        case .subtle: Color.clear.background(.ultraThinMaterial)
        case .content: Color.clear.background(.thinMaterial)
        case .overlay: Color.clear.background(.regularMaterial)
        }
    }

    private var opacityForLevel: Double {
        switch level {
        case .subtle: return 0.3
        case .content: return 0.5
        case .overlay: return 0.7
        }
    }

    private var shadowOpacityForLevel: Double {
        switch level {
        case .subtle: return 0.2
        case .content: return 0.3
        case .overlay: return 0.5
        }
    }

    private var shadowRadiusForLevel: CGFloat {
        switch level {
        case .subtle: return 10
        case .content: return 20
        case .overlay: return 40
        }
    }

    private var shadowYForLevel: CGFloat {
        switch level {
        case .subtle: return 5
        case .content: return 10
        case .overlay: return 20
        }
    }
}

// MARK: - View Extensions

extension View {
    /// Apply obsidian glass effect with Metal shader enhancement (iOS 17+)
    /// Falls back to standard glass on iOS 16
    @ViewBuilder
    func obsidianGlassStyle(
        _ level: ObsidianGlassLevel = .content,
        glowColor: Color = .optaPurple
    ) -> some View {
        if #available(iOS 17.0, *) {
            modifier(ObsidianGlassModifier(level: level, glowColor: glowColor))
        } else {
            // Fallback to existing glass modifiers
            switch level {
            case .subtle: self.glassSubtle()
            case .content: self.glassContent()
            case .overlay: self.glassOverlay()
            }
        }
    }
}
