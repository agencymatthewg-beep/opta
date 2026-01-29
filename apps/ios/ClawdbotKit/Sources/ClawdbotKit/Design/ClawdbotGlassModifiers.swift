//
//  ClawdbotGlassModifiers.swift
//  ClawdbotKit
//
//  3-level glass depth system ported from Opta Life Manager DESIGN_SYSTEM.md v5.0.
//  Implements glassmorphism with obsidian variants for dormant/interactive/active states.
//
//  Created by Matthew Byrden
//

import SwiftUI

// MARK: - Glass Level Enum

public enum GlassLevel {
    case subtle    // Level 1: Background
    case content   // Level 2: Cards, sheets
    case overlay   // Level 3: Modals, hero
}

// MARK: - Glass Modifiers

public extension View {
    /// Level 1: Subtle glass for background elements
    /// Blur: ~8pt, Opacity: 0.3-0.4
    func glassSubtle() -> some View {
        self
            .background(.ultraThinMaterial)
            .background(Color.clawdbotSurface.opacity(0.3))
    }

    /// Level 2: Content glass for cards and sheets
    /// Blur: ~12pt, Opacity: 0.5
    func glassContent() -> some View {
        self
            .background(.thinMaterial)
            .background(Color.clawdbotSurface.opacity(0.5))
    }

    /// Level 3: Overlay glass for modals and hero elements
    /// Blur: ~16-20pt, Opacity: 0.6
    func glassOverlay() -> some View {
        self
            .background(.regularMaterial)
            .background(Color.clawdbotSurface.opacity(0.6))
    }

    /// Generic glass modifier with level parameter
    @ViewBuilder
    func glass(_ level: GlassLevel) -> some View {
        switch level {
        case .subtle: self.glassSubtle()
        case .content: self.glassContent()
        case .overlay: self.glassOverlay()
        }
    }
}

// MARK: - Obsidian Glass System

/// Obsidian activation state
public enum ObsidianState {
    case dormant      // 0% - Default resting state
    case interactive  // 0% to 50% transition on hover
    case active       // Sustained 50% glow
}

public extension View {
    /// Base obsidian glass - dormant 0% state
    /// Dark, minimal glow, resting
    func obsidian() -> some View {
        self
            .background(Color.clawdbotSurface.opacity(0.4))
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(Color.clawdbotBorder.opacity(0.3), lineWidth: 1)
            )
    }

    /// Interactive obsidian - transitions 0% to 50% on hover
    /// Use with @State isHovered binding
    func obsidianInteractive(isHovered: Bool) -> some View {
        self
            .background(
                Color.clawdbotSurface.opacity(isHovered ? 0.6 : 0.4)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(
                        isHovered ? Color.clawdbotPurple.opacity(0.5) : Color.clawdbotBorder.opacity(0.3),
                        lineWidth: isHovered ? 1.5 : 1
                    )
            )
            .shadow(
                color: isHovered ? Color.clawdbotPurple.opacity(0.3) : .clear,
                radius: isHovered ? 20 : 0
            )
            .animation(.clawdbotSpring, value: isHovered)
    }

    /// Active obsidian - sustained 50% glow state
    func obsidianActive() -> some View {
        self
            .background(Color.clawdbotSurface.opacity(0.6))
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(Color.clawdbotPurple.opacity(0.5), lineWidth: 1.5)
            )
            .shadow(color: Color.clawdbotPurple.opacity(0.3), radius: 20)
    }

    /// Obsidian with explicit state parameter
    @ViewBuilder
    func obsidian(_ state: ObsidianState, isHovered: Bool = false) -> some View {
        switch state {
        case .dormant: self.obsidian()
        case .interactive: self.obsidianInteractive(isHovered: isHovered)
        case .active: self.obsidianActive()
        }
    }
}

// MARK: - Glass Card Component

/// A glass card container with configurable depth level
public struct GlassCard<Content: View>: View {
    let level: GlassLevel
    let cornerRadius: CGFloat
    let padding: CGFloat
    let content: Content

    public init(
        level: GlassLevel = .content,
        cornerRadius: CGFloat = 16,
        padding: CGFloat = 16,
        @ViewBuilder content: () -> Content
    ) {
        self.level = level
        self.cornerRadius = cornerRadius
        self.padding = padding
        self.content = content()
    }

    public var body: some View {
        content
            .padding(padding)
            .glass(level)
            .clipShape(RoundedRectangle(cornerRadius: cornerRadius))
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius)
                    .stroke(Color.clawdbotBorder.opacity(0.5), lineWidth: 1)
            )
    }
}

// MARK: - Preview

#if DEBUG
struct ClawdbotGlassModifiers_Previews: PreviewProvider {
    static var previews: some View {
        ZStack {
            // Background gradient to show glass effect
            LinearGradient(
                colors: [Color.clawdbotPurple.opacity(0.3), Color.clawdbotBlue.opacity(0.2)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            ScrollView {
                VStack(spacing: 20) {
                    // Level 1: Subtle
                    Text("Subtle Glass")
                        .padding()
                        .glassSubtle()
                        .clipShape(RoundedRectangle(cornerRadius: 12))

                    // Level 2: Content
                    Text("Content Glass")
                        .padding()
                        .glassContent()
                        .clipShape(RoundedRectangle(cornerRadius: 12))

                    // Level 3: Overlay
                    Text("Overlay Glass")
                        .padding()
                        .glassOverlay()
                        .clipShape(RoundedRectangle(cornerRadius: 12))

                    // GlassCard component
                    GlassCard {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Glass Card")
                                .font(.headline)
                            Text("With built-in padding and border")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }

                    Divider()
                        .padding(.vertical)

                    // Obsidian variants
                    Text("Obsidian Dormant")
                        .padding()
                        .obsidian()
                        .clipShape(RoundedRectangle(cornerRadius: 16))

                    Text("Obsidian Active")
                        .padding()
                        .obsidianActive()
                        .clipShape(RoundedRectangle(cornerRadius: 16))
                }
                .foregroundColor(.clawdbotTextPrimary)
                .padding()
            }
        }
        .preferredColorScheme(.dark)
    }
}
#endif
