//
//  ProcessingView.swift
//  Opta Scan
//
//  Animated processing state while Claude analyzes
//  Created by Matthew Byrden
//

import SwiftUI

struct ProcessingView: View {

    let prompt: String
    @State private var dotCount = 0
    @State private var pulseScale: CGFloat = 1.0

    private let timer = Timer.publish(every: 0.5, on: .main, in: .common).autoconnect()

    var body: some View {
        ZStack {
            Color.optaBackground
                .ignoresSafeArea()

            VStack(spacing: OptaDesign.Spacing.xl) {
                Spacer()

                // Animated Opta logo
                ZStack {
                    // Outer glow
                    Circle()
                        .fill(Color.optaPurpleGlow)
                        .frame(width: 120, height: 120)
                        .blur(radius: 30)
                        .scaleEffect(pulseScale)

                    // Inner circle
                    Circle()
                        .fill(
                            LinearGradient(
                                colors: [Color.optaPurple, Color.optaBlue],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .frame(width: 80, height: 80)

                    // Sparkle icon
                    Image(systemName: "sparkles")
                        .font(.system(size: 32, weight: .medium))
                        .foregroundStyle(.white)
                }
                .onAppear {
                    withAnimation(.easeInOut(duration: 1.5).repeatForever(autoreverses: true)) {
                        pulseScale = 1.2
                    }
                }

                // Processing text
                VStack(spacing: OptaDesign.Spacing.sm) {
                    Text("Optimizing\(String(repeating: ".", count: dotCount))")
                        .font(.optaHeadline)
                        .foregroundStyle(Color.optaTextPrimary)
                        .animation(.none, value: dotCount)

                    Text(prompt)
                        .font(.optaCaption)
                        .foregroundStyle(Color.optaTextSecondary)
                        .multilineTextAlignment(.center)
                        .lineLimit(2)
                }

                Spacer()

                // Tip text
                Text("Opta is analyzing your request and preparing clarifying questions...")
                    .font(.optaLabel)
                    .foregroundStyle(Color.optaTextMuted)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, OptaDesign.Spacing.xl)
                    .padding(.bottom, OptaDesign.Spacing.xxl)
            }
        }
        .onReceive(timer) { _ in
            dotCount = (dotCount + 1) % 4
        }
    }
}

#Preview {
    ProcessingView(prompt: "best value for money")
}
