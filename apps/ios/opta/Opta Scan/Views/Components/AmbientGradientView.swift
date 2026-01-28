//
//  AmbientGradientView.swift
//  Opta Scan
//
//  Animated ambient gradient for hero/highlight elements
//  Part of Phase 10: Metal Shaders
//
//  Created by Matthew Byrden
//

import SwiftUI

/// Adds subtle animated gradient flow to content
@available(iOS 17.0, *)
struct AmbientGradientView<Content: View>: View {
    let isAnimating: Bool
    let color1: Color
    let color2: Color
    let speed: Double
    @ViewBuilder let content: () -> Content

    init(
        isAnimating: Bool = true,
        color1: Color = .optaPurple,
        color2: Color = .optaBlue,
        speed: Double = 0.3,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.isAnimating = isAnimating
        self.color1 = color1
        self.color2 = color2
        self.speed = speed
        self.content = content
    }

    var body: some View {
        TimelineView(.animation(minimumInterval: 1/30, paused: !isAnimating)) { timeline in
            content()
                .gradientFlow(
                    time: timeline.date.timeIntervalSinceReferenceDate,
                    color1: color1,
                    color2: color2,
                    speed: speed,
                    isEnabled: isAnimating
                )
        }
    }
}

/// Convenience modifier for ambient gradient
@available(iOS 17.0, *)
extension View {
    /// Add ambient flowing gradient effect
    func ambientGradient(
        _ isAnimating: Bool = true,
        colors: (Color, Color) = (.optaPurple, .optaBlue),
        speed: Double = 0.3
    ) -> some View {
        AmbientGradientView(
            isAnimating: isAnimating,
            color1: colors.0,
            color2: colors.1,
            speed: speed
        ) {
            self
        }
    }
}
