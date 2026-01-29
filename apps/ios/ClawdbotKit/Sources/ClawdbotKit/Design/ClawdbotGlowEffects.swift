//
//  ClawdbotGlowEffects.swift
//  ClawdbotKit
//
//  Glow effect utilities for the Opta aesthetic.
//  Provides colored shadow effects at various intensities.
//
//  Created by Matthew Byrden
//

import SwiftUI

// MARK: - Glow Intensity

public enum GlowIntensity {
    case sm       // 8pt radius
    case md       // 16pt radius
    case lg       // 24pt radius
    case intense  // 40pt radius
}

// MARK: - Glow Effect Modifiers

public extension View {
    /// Purple glow effect
    func glowPurple(_ intensity: GlowIntensity = .md) -> some View {
        self.shadow(color: Color.clawdbotPurple.opacity(glowOpacity(intensity)), radius: glowRadius(intensity))
    }

    /// Cyan glow effect
    func glowCyan(_ intensity: GlowIntensity = .md) -> some View {
        self.shadow(color: Color.clawdbotCyan.opacity(glowOpacity(intensity)), radius: glowRadius(intensity))
    }

    /// Green glow effect
    func glowGreen(_ intensity: GlowIntensity = .md) -> some View {
        self.shadow(color: Color.clawdbotGreen.opacity(glowOpacity(intensity)), radius: glowRadius(intensity))
    }

    /// Amber glow effect
    func glowAmber(_ intensity: GlowIntensity = .md) -> some View {
        self.shadow(color: Color.clawdbotAmber.opacity(glowOpacity(intensity)), radius: glowRadius(intensity))
    }

    /// Red glow effect
    func glowRed(_ intensity: GlowIntensity = .md) -> some View {
        self.shadow(color: Color.clawdbotRed.opacity(glowOpacity(intensity)), radius: glowRadius(intensity))
    }

    /// Custom color glow effect
    func glow(color: Color, intensity: GlowIntensity = .md) -> some View {
        self.shadow(color: color.opacity(glowOpacity(intensity)), radius: glowRadius(intensity))
    }

    // MARK: - Helper Functions

    private func glowRadius(_ intensity: GlowIntensity) -> CGFloat {
        switch intensity {
        case .sm: return 8
        case .md: return 16
        case .lg: return 24
        case .intense: return 40
        }
    }

    private func glowOpacity(_ intensity: GlowIntensity) -> Double {
        switch intensity {
        case .sm: return 0.3
        case .md: return 0.4
        case .lg: return 0.5
        case .intense: return 0.5
        }
    }
}

// MARK: - Multi-Layer Glow

public extension View {
    /// Layered glow effect for intense prominence
    func glowLayered(color: Color = .clawdbotPurple) -> some View {
        self
            .shadow(color: color.opacity(0.3), radius: 8)
            .shadow(color: color.opacity(0.2), radius: 16)
            .shadow(color: color.opacity(0.1), radius: 24)
    }
}

// MARK: - Preview

#if DEBUG
struct ClawdbotGlowEffects_Previews: PreviewProvider {
    static var previews: some View {
        VStack(spacing: 30) {
            // Single intensity glows
            HStack(spacing: 20) {
                Circle()
                    .fill(Color.clawdbotPurple)
                    .frame(width: 40, height: 40)
                    .glowPurple(.sm)

                Circle()
                    .fill(Color.clawdbotPurple)
                    .frame(width: 40, height: 40)
                    .glowPurple(.md)

                Circle()
                    .fill(Color.clawdbotPurple)
                    .frame(width: 40, height: 40)
                    .glowPurple(.lg)

                Circle()
                    .fill(Color.clawdbotPurple)
                    .frame(width: 40, height: 40)
                    .glowPurple(.intense)
            }

            // Different colors
            HStack(spacing: 20) {
                Circle()
                    .fill(Color.clawdbotCyan)
                    .frame(width: 40, height: 40)
                    .glowCyan()

                Circle()
                    .fill(Color.clawdbotGreen)
                    .frame(width: 40, height: 40)
                    .glowGreen()

                Circle()
                    .fill(Color.clawdbotAmber)
                    .frame(width: 40, height: 40)
                    .glowAmber()

                Circle()
                    .fill(Color.clawdbotRed)
                    .frame(width: 40, height: 40)
                    .glowRed()
            }

            // Layered glow
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.clawdbotSurface)
                .frame(width: 120, height: 60)
                .glowLayered()
                .overlay(
                    Text("Layered")
                        .foregroundColor(.clawdbotTextPrimary)
                )
        }
        .padding(40)
        .background(Color.clawdbotBackground)
        .preferredColorScheme(.dark)
    }
}
#endif
