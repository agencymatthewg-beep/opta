//
//  MenuBarView.swift
//  OptaApp
//
//  Menu bar popover view with live stats and quick actions
//

import SwiftUI

// MARK: - Menu Bar Popover View

struct MenuBarPopoverView: View {

    // MARK: - Properties

    @ObservedObject var coordinator: RenderCoordinator
    @Environment(\.openWindow) private var openWindow

    // MARK: - Body

    var body: some View {
        VStack(spacing: 0) {
            // Header
            header

            Divider()
                .background(Color.white.opacity(0.1))

            // Stats Grid
            statsGrid
                .padding(.vertical, 12)

            Divider()
                .background(Color.white.opacity(0.1))

            // Quick Actions
            quickActions
                .padding(.vertical, 12)

            Divider()
                .background(Color.white.opacity(0.1))

            // Footer
            footer
        }
        .frame(width: 280)
        .background(.ultraThinMaterial)
        .preferredColorScheme(.dark)
    }

    // MARK: - Header

    private var header: some View {
        HStack {
            // Opta Logo/Name
            HStack(spacing: 8) {
                Image(systemName: "waveform.circle.fill")
                    .font(.system(size: 20))
                    .foregroundStyle(
                        LinearGradient(
                            colors: [.blue, .purple],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )

                Text("Opta")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(.white)
            }

            Spacer()

            // FPS Counter
            HStack(spacing: 4) {
                Circle()
                    .fill(fpsStatusColor)
                    .frame(width: 6, height: 6)

                Text("\(Int(coordinator.currentFPS)) FPS")
                    .font(.system(size: 11, weight: .medium, design: .monospaced))
                    .foregroundColor(.white.opacity(0.8))
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(
                Capsule()
                    .fill(Color.white.opacity(0.1))
            )
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
    }

    // MARK: - Stats Grid

    private var statsGrid: some View {
        LazyVGrid(columns: [
            GridItem(.flexible()),
            GridItem(.flexible())
        ], spacing: 8) {
            StatCard(
                icon: "cpu",
                label: "CPU",
                value: cpuUsageString,
                color: .blue
            )

            StatCard(
                icon: "memorychip",
                label: "Memory",
                value: memoryUsageString,
                color: .green
            )

            StatCard(
                icon: "gpu",
                label: "GPU",
                value: gpuLoadString,
                color: .purple
            )

            StatCard(
                icon: "thermometer.medium",
                label: "Temp",
                value: temperatureString,
                color: temperatureColor
            )
        }
        .padding(.horizontal, 12)
    }

    // MARK: - Quick Actions

    private var quickActions: some View {
        HStack(spacing: 12) {
            QuickActionButton(
                icon: "bolt.fill",
                label: "Optimize",
                color: .blue
            ) {
                performOptimize()
            }

            QuickActionButton(
                icon: "chart.bar.fill",
                label: "Stats",
                color: .green
            ) {
                openMainWindow()
            }

            QuickActionButton(
                icon: "gearshape.fill",
                label: "Settings",
                color: .gray
            ) {
                openSettings()
            }
        }
        .padding(.horizontal, 12)
    }

    // MARK: - Footer

    private var footer: some View {
        HStack {
            Text("v1.0.0")
                .font(.system(size: 10))
                .foregroundColor(.white.opacity(0.4))

            Spacer()

            Button(action: quitApp) {
                HStack(spacing: 4) {
                    Image(systemName: "power")
                        .font(.system(size: 10))
                    Text("Quit")
                        .font(.system(size: 11, weight: .medium))
                }
                .foregroundColor(.white.opacity(0.6))
            }
            .buttonStyle(.plain)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(
                Capsule()
                    .fill(Color.white.opacity(0.05))
            )
            .contentShape(Capsule())
            .onHover { hovering in
                if hovering {
                    NSCursor.pointingHand.push()
                } else {
                    NSCursor.pop()
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
    }

    // MARK: - Computed Properties

    private var fpsStatusColor: Color {
        let fps = coordinator.currentFPS
        let target = Float(coordinator.targetRefreshRate)

        if fps >= target * 0.95 {
            return .green
        } else if fps >= target * 0.8 {
            return .yellow
        } else if fps >= target * 0.5 {
            return .orange
        } else {
            return .red
        }
    }

    private var cpuUsageString: String {
        // In a real implementation, this would come from system monitoring
        // For now, derive from frame time
        let usage = min(100, Int(coordinator.frameTimeMs * 3))
        return "\(usage)%"
    }

    private var memoryUsageString: String {
        if let status = coordinator.getStatus() {
            let mb = status.gpuMemoryUsage / (1024 * 1024)
            return "\(mb) MB"
        }
        return "-- MB"
    }

    private var gpuLoadString: String {
        // Estimate GPU load from FPS vs target
        let ratio = coordinator.currentFPS / Float(coordinator.targetRefreshRate)
        let load = Int((1.0 - min(1.0, ratio)) * 100 + 30)
        return "\(min(100, load))%"
    }

    private var temperatureString: String {
        // Placeholder - would need system integration
        return "45C"
    }

    private var temperatureColor: Color {
        // Color based on temperature thresholds
        return .orange
    }

    // MARK: - Actions

    private func performOptimize() {
        // Trigger optimization routine
        coordinator.qualityLevel = .adaptive
        NotificationCenter.default.post(name: .performQuickOptimize, object: nil)
    }

    private func openMainWindow() {
        openWindow(id: "main")
    }

    private func openSettings() {
        openWindow(id: "settings")
    }

    private func quitApp() {
        NSApplication.shared.terminate(nil)
    }
}

// MARK: - Stat Card

struct StatCard: View {
    let icon: String
    let label: String
    let value: String
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.system(size: 12))
                    .foregroundColor(color)

                Text(label)
                    .font(.system(size: 10, weight: .medium))
                    .foregroundColor(.white.opacity(0.6))
            }

            Text(value)
                .font(.system(size: 16, weight: .semibold, design: .monospaced))
                .foregroundColor(.white)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(Color.white.opacity(0.05))
        )
    }
}

// MARK: - Quick Action Button

struct QuickActionButton: View {
    let icon: String
    let label: String
    let color: Color
    let action: () -> Void

    @State private var isHovered = false

    var body: some View {
        Button(action: action) {
            VStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.system(size: 18))
                    .foregroundColor(color)

                Text(label)
                    .font(.system(size: 10, weight: .medium))
                    .foregroundColor(.white.opacity(0.8))
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(
                RoundedRectangle(cornerRadius: 8)
                    .fill(isHovered ? Color.white.opacity(0.1) : Color.white.opacity(0.05))
            )
        }
        .buttonStyle(.plain)
        .onHover { hovering in
            withAnimation(.easeInOut(duration: 0.15)) {
                isHovered = hovering
            }
        }
    }
}

// MARK: - Notifications

extension Notification.Name {
    static let performQuickOptimize = Notification.Name("performQuickOptimize")
}

// MARK: - Preview

#if DEBUG
struct MenuBarPopoverView_Previews: PreviewProvider {
    static var previews: some View {
        MenuBarPopoverView(coordinator: RenderCoordinator())
            .frame(width: 280, height: 400)
    }
}
#endif
