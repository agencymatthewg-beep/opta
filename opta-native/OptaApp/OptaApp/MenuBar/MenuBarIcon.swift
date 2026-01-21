//
//  MenuBarIcon.swift
//  OptaApp
//
//  Animated menu bar icon with dynamic status states based on system status
//

import SwiftUI

// MARK: - Menu Bar Icon

struct MenuBarIcon: View {

    // MARK: - Properties

    @ObservedObject var coordinator: RenderCoordinator
    var agentModeManager: AgentModeManager

    @State private var pulseAnimation = false
    @State private var rotationAngle: Double = 0
    @State private var statusChangeScale: CGFloat = 1.0

    // MARK: - Body

    var body: some View {
        ZStack {
            // Base ring with angular gradient
            Circle()
                .strokeBorder(
                    AngularGradient(
                        gradient: Gradient(colors: ringGradientColors),
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
                .scaleEffect(statusChangeScale)

            // Notification badge (when pending optimizations)
            if agentModeManager.pendingOptimizationCount > 0 {
                notificationBadge
            }
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
        .onChange(of: agentModeManager.systemStatus) { oldStatus, newStatus in
            animateStatusChange()
        }
    }

    // MARK: - Notification Badge

    private var notificationBadge: some View {
        ZStack {
            Circle()
                .fill(Color.red)
                .frame(width: 8, height: 8)

            if agentModeManager.pendingOptimizationCount < 10 {
                Text("\(agentModeManager.pendingOptimizationCount)")
                    .font(.system(size: 6, weight: .bold))
                    .foregroundColor(.white)
            }
        }
        .offset(x: 6, y: -6)
    }

    // MARK: - Computed Properties

    private var isRendering: Bool {
        !coordinator.isPaused && coordinator.currentFPS > 0
    }

    /// Gradient colors based on system status
    private var ringGradientColors: [Color] {
        let status = agentModeManager.systemStatus

        switch status {
        case .normal:
            return [.blue, .purple, .pink, .blue]
        case .warning:
            return [.orange, .yellow, .orange, .yellow]
        case .critical:
            return [.red, .orange, .red, .orange]
        case .agent:
            return [Color(hex: "8B5CF6") ?? .purple, .purple, Color(hex: "8B5CF6") ?? .purple, .purple]
        case .paused:
            return [.gray, .gray.opacity(0.6), .gray, .gray.opacity(0.6)]
        }
    }

    private var glowColor: Color {
        if coordinator.isPaused {
            return .gray
        }

        // Use agent mode status color when in agent mode
        if agentModeManager.isAgentMode {
            return agentModeManager.systemStatus.color
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

        // Use system status color
        return agentModeManager.systemStatus.color
    }

    // MARK: - Animations

    private func startAnimations() {
        startRotationAnimation()
        if !coordinator.isPaused {
            startPulseAnimation()
        }
    }

    private func startRotationAnimation() {
        // Adjust rotation speed based on status
        let duration: Double = agentModeManager.systemStatus == .critical ? 4.0 : 8.0

        withAnimation(
            .linear(duration: duration)
            .repeatForever(autoreverses: false)
        ) {
            rotationAngle = 360
        }
    }

    private func startPulseAnimation() {
        // Faster pulse for warning/critical states
        let duration: Double
        switch agentModeManager.systemStatus {
        case .critical: duration = 0.5
        case .warning: duration = 1.0
        default: duration = 1.5
        }

        withAnimation(
            .easeInOut(duration: duration)
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

    private func animateStatusChange() {
        // Subtle scale pop when status changes
        withAnimation(.spring(response: 0.3, dampingFraction: 0.6)) {
            statusChangeScale = 1.3
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
            withAnimation(.spring(response: 0.3, dampingFraction: 0.6)) {
                statusChangeScale = 1.0
            }
        }

        // Restart pulse with new timing
        if !coordinator.isPaused {
            pulseAnimation = false
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                startPulseAnimation()
            }
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
            MenuBarIcon(
                coordinator: RenderCoordinator(),
                agentModeManager: AgentModeManager.shared
            )
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
