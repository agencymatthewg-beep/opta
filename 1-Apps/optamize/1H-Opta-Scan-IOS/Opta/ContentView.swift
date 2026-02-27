//
//  ContentView.swift
//  Opta
//
//  Created by Matthew Byrden
//

import SwiftUI

struct ContentView: View {
    var body: some View {
        ZStack {
            // Background gradient matching Opta's design system
            LinearGradient(
                colors: [
                    Color(red: 0.05, green: 0.04, blue: 0.10),
                    Color(red: 0.08, green: 0.06, blue: 0.14)
                ],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()

            VStack(spacing: 24) {
                // Opta Ring placeholder
                OptaRingView()

                Text("Opta")
                    .font(.system(size: 48, weight: .bold, design: .rounded))
                    .foregroundStyle(
                        LinearGradient(
                            colors: [
                                Color(red: 0.55, green: 0.36, blue: 0.98),
                                Color(red: 0.34, green: 0.65, blue: 1.0)
                            ],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )

                Text("System Optimization")
                    .font(.system(size: 18, weight: .medium))
                    .foregroundColor(.white.opacity(0.6))
            }
        }
    }
}

struct OptaRingView: View {
    @State private var rotation: Double = 0

    var body: some View {
        ZStack {
            // Outer glow
            Circle()
                .stroke(
                    LinearGradient(
                        colors: [
                            Color(red: 0.55, green: 0.36, blue: 0.98).opacity(0.3),
                            Color(red: 0.34, green: 0.65, blue: 1.0).opacity(0.3)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    lineWidth: 20
                )
                .frame(width: 200, height: 200)
                .blur(radius: 10)

            // Main ring
            Circle()
                .stroke(
                    AngularGradient(
                        colors: [
                            Color(red: 0.55, green: 0.36, blue: 0.98),
                            Color(red: 0.34, green: 0.65, blue: 1.0),
                            Color(red: 0.05, green: 0.85, blue: 0.65),
                            Color(red: 0.55, green: 0.36, blue: 0.98)
                        ],
                        center: .center
                    ),
                    style: StrokeStyle(lineWidth: 8, lineCap: .round)
                )
                .frame(width: 180, height: 180)
                .rotationEffect(.degrees(rotation))

            // Score display
            VStack(spacing: 4) {
                Text("92")
                    .font(.system(size: 56, weight: .bold, design: .rounded))
                    .foregroundColor(.white)

                Text("Optimal")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(.green)
            }
        }
        .onAppear {
            withAnimation(.linear(duration: 20).repeatForever(autoreverses: false)) {
                rotation = 360
            }
        }
    }
}

#Preview {
    ContentView()
}
