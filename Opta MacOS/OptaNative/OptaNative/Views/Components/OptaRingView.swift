//
//  OptaRingView.swift
//  OptaNative
//
//  Native implementation of the signature "Opta Ring" visual.
//  Uses SwiftUI Gradients and Rotations to simulate the premium 3D look.
//  Created for Opta Native macOS - Plan 101-01 (v12.0)
//

import SwiftUI

struct OptaRingView: View {
    // Animation States
    @State private var rotateInner = 0.0
    @State private var rotateOuter = 0.0
    @State private var isAnimating = false

    var body: some View {
        ZStack {
            // 0. Ambient Glow (Deep Purple Backlight)
            Circle()
                .fill(Color(hex: 0x581C87).opacity(0.5))
                .blur(radius: 60)
                .scaleEffect(1.2)

            // 1. Obsidian Body (The Ring Itself)
            Circle()
                .strokeBorder(
                    LinearGradient(
                        colors: [
                            Color(hex: 0x1a1a20), // Light catch
                            Color(hex: 0x050507), // Shadow
                            Color(hex: 0x0a0a0c)  // Mid
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    lineWidth: 48
                )
                .shadow(color: .black.opacity(0.8), radius: 20, x: 0, y: 15)

            // 2. Inner Purple Glow (The "Plasma" Filament)
            Circle()
                .strokeBorder(
                    AngularGradient(
                        gradient: Gradient(colors: [
                            .clear,
                            Color(hex: 0xA855F7).opacity(0.1),
                            Color(hex: 0xA855F7).opacity(0.9),
                            Color.white.opacity(0.8),
                            Color(hex: 0xA855F7).opacity(0.9),
                            .clear
                        ]),
                        center: .center,
                        startAngle: .degrees(0),
                        endAngle: .degrees(360)
                    ),
                    lineWidth: 6
                )
                .padding(24)
                .rotationEffect(.degrees(rotateInner))
                .blur(radius: 4)
                .blendMode(.screen)

            // 3. Glass Shell Effect (Top Reflection)
            Circle()
                .strokeBorder(
                    LinearGradient(
                        colors: [
                            .white.opacity(0.15),
                            .white.opacity(0.0),
                            .white.opacity(0.02)
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    ),
                    lineWidth: 48
                )

            // 4. Specular Highlight (The "Wet" Look)
            Circle()
                .strokeBorder(
                    AngularGradient(
                        stops: [
                            .init(color: .white.opacity(0.9), location: 0.12),
                            .init(color: .clear, location: 0.25)
                        ],
                        center: .center
                    ),
                    lineWidth: 4
                )
                .padding(2)
                .rotationEffect(.degrees(-45))
                .blur(radius: 2)
                .blendMode(.overlay)
        }
        .frame(width: 300, height: 300)
        .rotation3DEffect(
            .degrees(25),
            axis: (x: 1.0, y: 0.0, z: 0.0)
        )
        .onAppear {
            guard !isAnimating else { return }
            isAnimating = true

            withAnimation(.linear(duration: 8).repeatForever(autoreverses: false)) {
                rotateInner = 360
            }

            withAnimation(.linear(duration: 12).repeatForever(autoreverses: false)) {
                rotateOuter = -360
            }
        }
    }
}

#Preview {
    ZStack {
        Color.black.ignoresSafeArea()
        OptaRingView()
    }
}
