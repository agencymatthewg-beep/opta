//
//  MenuBarIcon.swift
//  OptaApp
//
//  Animated menu bar icon with pulsing glow based on render state
//

import SwiftUI

// MARK: - Menu Bar Icon

struct MenuBarIcon: View {

    // MARK: - Properties

    @ObservedObject var coordinator: RenderCoordinator

    @State private var pulseAnimation = false
    @State private var rotationAngle: Double = 0

    // MARK: - Body

    var body: some View {
        ZStack {
            // Base ring with angular gradient
            Circle()
                .strokeBorder(
                    AngularGradient(
                        gradient: Gradient(colors: [
                            .blue,
                            .purple,
                            .pink,
                            .blue
                        ]),
                        center: .center,
                        startAngle: .degrees(rotationAngle),
                        endAngle: .degrees(rotationAngle + 360)
                    ),
                    lineWidth: 2
                )
                .frame(width: 16, height: 16)

            // Inner glow circle
            Circle()
                .fill(
                    RadialGradient(
                        gradient: Gradient(colors: [
                            glowColor.opacity(pulseAnimation ? 0.8 : 0.4),
                            glowColor.opacity(pulseAnimation ? 0.3 : 0.1),
                            Color.clear
                        ]),
                        center: .center,
                        startRadius: 0,
                        endRadius: 8
                    )
                )
                .frame(width: 12, height: 12)
                .scaleEffect(pulseAnimation ? 1.2 : 1.0)

            // Center dot indicator
            Circle()
                .fill(statusColor)
                .frame(width: 4, height: 4)
        }
        .onAppear {
            startAnimations()
        }
        .onChange(of: coordinator.isPaused) { _, newValue in
            if newValue {
                stopPulseAnimation()
            } else {
                startPulseAnimation()
            }
        }
    }

    // MARK: - Computed Properties

    private var isRendering: Bool {
        !coordinator.isPaused && coordinator.currentFPS > 0
    }

    private var glowColor: Color {
        if coordinator.isPaused {
            return .gray
        }

        let fps = coordinator.currentFPS
        let target = Float(coordinator.targetRefreshRate)

        if fps >= target * 0.95 {
            return .green
        } else if fps >= target * 0.8 {
            return .blue
        } else if fps >= target * 0.5 {
            return .orange
        } else {
            return .red
        }
    }

    private var statusColor: Color {
        if coordinator.isPaused {
            return .gray
        }
        return isRendering ? .green : .orange
    }

    // MARK: - Animations

    private func startAnimations() {
        startRotationAnimation()
        if !coordinator.isPaused {
            startPulseAnimation()
        }
    }

    private func startRotationAnimation() {
        withAnimation(
            .linear(duration: 8)
            .repeatForever(autoreverses: false)
        ) {
            rotationAngle = 360
        }
    }

    private func startPulseAnimation() {
        withAnimation(
            .easeInOut(duration: 1.5)
            .repeatForever(autoreverses: true)
        ) {
            pulseAnimation = true
        }
    }

    private func stopPulseAnimation() {
        withAnimation(.easeOut(duration: 0.3)) {
            pulseAnimation = false
        }
    }
}

// MARK: - Static Menu Bar Icon (For when no coordinator is available)

struct StaticMenuBarIcon: View {

    var body: some View {
        ZStack {
            Circle()
                .strokeBorder(
                    LinearGradient(
                        colors: [.blue, .purple],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    lineWidth: 2
                )
                .frame(width: 16, height: 16)

            Circle()
                .fill(Color.blue.opacity(0.3))
                .frame(width: 8, height: 8)
        }
    }
}

// MARK: - Preview

#if DEBUG
struct MenuBarIcon_Previews: PreviewProvider {
    static var previews: some View {
        VStack(spacing: 20) {
            MenuBarIcon(coordinator: RenderCoordinator())
                .frame(width: 22, height: 22)
                .background(Color.black)

            StaticMenuBarIcon()
                .frame(width: 22, height: 22)
                .background(Color.black)
        }
        .padding()
        .background(Color.gray.opacity(0.3))
    }
}
#endif
