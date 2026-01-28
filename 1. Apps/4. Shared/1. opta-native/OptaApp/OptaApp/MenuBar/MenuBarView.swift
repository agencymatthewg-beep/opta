//
//  MenuBarView.swift
//  OptaApp
//
//  Menu bar popover view with live stats, agent mode, and contextual actions
//

import SwiftUI

// MARK: - Menu Bar Popover View

struct MenuBarPopoverView: View {

    // MARK: - Properties

    @ObservedObject var coordinator: RenderCoordinator
    var agentModeManager: AgentModeManager
    @Environment(\.openWindow) private var openWindow
    @Environment(\.colorTemperature) private var colorTemp

    // MARK: - Body

    var body: some View {
        VStack(spacing: 0) {
            // Header with optimization score
            header

            Divider()
                .background(Color.white.opacity(0.1))

            // Agent Mode Section (when active)
            if agentModeManager.isAgentMode {
                agentModeStatusSection
                    .padding(.vertical, 8)

                Divider()
                    .background(Color.white.opacity(0.1))
            }

            // Stats Grid
            statsGrid
                .padding(.vertical, 12)

            Divider()
                .background(Color.white.opacity(0.1))

            // Contextual Quick Actions
            contextualActions
                .padding(.vertical, 12)

            Divider()
                .background(Color.white.opacity(0.1))

            // Agent Mode Toggle Row
            agentModeRow
                .padding(.vertical, 8)

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

            // Mini Optimization Score / FPS Counter
            HStack(spacing: 4) {
                statusIndicator

                if agentModeManager.isAgentMode {
                    Text("Agent")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundColor(colorTemp.violetColor.opacity(max(colorTemp.glowOpacity, 0.4)))
                } else {
                    Text("\(Int(coordinator.currentFPS)) FPS")
                        .font(.system(size: 11, weight: .medium, design: .monospaced))
                        .foregroundColor(.white.opacity(0.8))
                }
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

    private var statusIndicator: some View {
        Circle()
            .fill(agentModeManager.systemStatus.color)
            .frame(width: 6, height: 6)
    }

    // MARK: - Agent Mode Status Section

    private var agentModeStatusSection: some View {
        VStack(spacing: 8) {
            HStack {
                Image(systemName: agentModeManager.systemStatus.icon)
                    .foregroundColor(agentModeManager.systemStatus.color)

                Text(statusMessage)
                    .font(.system(size: 12))
                    .foregroundColor(.white.opacity(0.8))

                Spacer()
            }

            // Progress bar for monitoring
            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    Capsule()
                        .fill(Color.white.opacity(0.1))
                        .frame(height: 4)

                    Capsule()
                        .fill(agentModeManager.systemStatus.color)
                        .frame(width: geometry.size.width * monitoringProgress, height: 4)
                }
            }
            .frame(height: 4)
        }
        .padding(.horizontal, 16)
    }

    private var statusMessage: String {
        switch agentModeManager.systemStatus {
        case .normal: return "System healthy - monitoring"
        case .warning: return "Optimization recommended"
        case .critical: return "Action needed"
        case .agent: return "Background monitoring active"
        case .paused: return "Monitoring paused"
        }
    }

    private var monitoringProgress: CGFloat {
        // Placeholder - would be based on actual monitoring cycle
        return 0.6
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
            .organicAppear(index: 0, total: 4)

            StatCard(
                icon: "memorychip",
                label: "Memory",
                value: memoryUsageString,
                color: .green
            )
            .organicAppear(index: 1, total: 4)

            StatCard(
                icon: "gpu",
                label: "GPU",
                value: gpuLoadString,
                color: .purple
            )
            .organicAppear(index: 2, total: 4)

            StatCard(
                icon: "thermometer.medium",
                label: "Temp",
                value: temperatureString,
                color: temperatureColor
            )
            .organicAppear(index: 3, total: 4)
        }
        .padding(.horizontal, 12)
    }

    // MARK: - Contextual Quick Actions

    private var contextualActions: some View {
        VStack(spacing: 8) {
            // Show contextual action based on status
            if agentModeManager.systemStatus == .critical {
                ContextualActionRow(
                    icon: "exclamationmark.triangle.fill",
                    title: "System Running Hot",
                    subtitle: "Tap to reduce workload",
                    color: .red
                ) {
                    performOptimize()
                }
            } else if agentModeManager.systemStatus == .warning {
                ContextualActionRow(
                    icon: "bolt.fill",
                    title: "Optimization Available",
                    subtitle: "Tap to free up resources",
                    color: .orange
                ) {
                    performOptimize()
                }
            }

            // Standard quick actions
            HStack(spacing: 12) {
                if agentModeManager.isAgentMode {
                    MenuBarActionButton(
                        icon: "macwindow",
                        label: "Dashboard",
                        color: .blue
                    ) {
                        openMainWindow()
                    }
                } else {
                    MenuBarActionButton(
                        icon: "bolt.fill",
                        label: "Optimize",
                        color: .blue
                    ) {
                        performOptimize()
                    }
                }

                MenuBarActionButton(
                    icon: "chart.bar.fill",
                    label: "Stats",
                    color: .green
                ) {
                    openMainWindow()
                }

                MenuBarActionButton(
                    icon: "gearshape.fill",
                    label: "Settings",
                    color: .gray
                ) {
                    openSettings()
                }
            }
        }
        .padding(.horizontal, 12)
    }

    // MARK: - Agent Mode Toggle Row

    private var agentModeRow: some View {
        HStack {
            Image(systemName: agentModeManager.isAgentMode ? "eye.slash.fill" : "eye.fill")
                .foregroundColor(agentModeManager.isAgentMode ? colorTemp.violetColor.opacity(max(colorTemp.glowOpacity, 0.4)) : .white.opacity(0.6))
                .frame(width: 20)

            VStack(alignment: .leading, spacing: 2) {
                Text(agentModeManager.isAgentMode ? "Agent Mode Active" : "Agent Mode")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(.white)

                Text("Minimize to menu bar")
                    .font(.system(size: 10))
                    .foregroundColor(.white.opacity(0.5))
            }

            Spacer()

            Toggle("", isOn: Binding(
                get: { agentModeManager.isAgentMode },
                set: { newValue in
                    if newValue {
                        agentModeManager.enterAgentMode()
                    } else {
                        agentModeManager.exitAgentMode()
                    }
                }
            ))
            .toggleStyle(.switch)
            .scaleEffect(0.8)
        }
        .padding(.horizontal, 16)
    }

    // MARK: - Notifications Toggle Row

    private var notificationsRow: some View {
        HStack {
            Image(systemName: agentModeManager.showNotifications ? "bell.fill" : "bell.slash.fill")
                .foregroundColor(agentModeManager.showNotifications ? .blue : .white.opacity(0.6))
                .frame(width: 20)

            Text("Notifications")
                .font(.system(size: 12, weight: .medium))
                .foregroundColor(.white)

            Spacer()

            Toggle("", isOn: Binding(
                get: { agentModeManager.showNotifications },
                set: { agentModeManager.showNotifications = $0 }
            ))
            .toggleStyle(.switch)
            .scaleEffect(0.8)
        }
        .padding(.horizontal, 16)
    }

    // MARK: - Footer

    private var footer: some View {
        HStack {
            // Version + Agent badge
            HStack(spacing: 6) {
                Text("v1.0.0")
                    .font(.system(size: 10))
                    .foregroundColor(.white.opacity(0.4))

                if agentModeManager.isAgentMode {
                    Text("AGENT")
                        .font(.system(size: 8, weight: .bold))
                        .foregroundColor(colorTemp.violetColor.opacity(max(colorTemp.glowOpacity, 0.4)))
                        .padding(.horizontal, 4)
                        .padding(.vertical, 2)
                        .background(
                            Capsule()
                                .fill(colorTemp.violetColor.opacity(max(colorTemp.glowOpacity, 0.4) * 0.2))
                        )
                }
            }

            Spacer()

            // Notification bell with badge
            if agentModeManager.pendingOptimizationCount > 0 {
                notificationBellButton
            }

            // Open Dashboard / Quit button
            if agentModeManager.isAgentMode {
                Button(action: openMainWindow) {
                    HStack(spacing: 4) {
                        Image(systemName: "macwindow")
                            .font(.system(size: 10))
                        Text("Open")
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
            } else {
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
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
    }

    private var notificationBellButton: some View {
        Button {
            agentModeManager.clearPendingOptimizations()
        } label: {
            ZStack(alignment: .topTrailing) {
                Image(systemName: "bell.fill")
                    .font(.system(size: 12))
                    .foregroundColor(.white.opacity(0.6))

                Circle()
                    .fill(Color.red)
                    .frame(width: 8, height: 8)
                    .overlay(
                        Text("\(agentModeManager.pendingOptimizationCount)")
                            .font(.system(size: 6, weight: .bold))
                            .foregroundColor(.white)
                    )
                    .offset(x: 4, y: -4)
            }
        }
        .buttonStyle(.plain)
        .padding(.trailing, 8)
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
        if agentModeManager.isAgentMode {
            agentModeManager.exitAgentMode()
        }
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

struct MenuBarActionButton: View {
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
        .organicHover(isHovered: isHovered, id: "menuBarAction-\(label)")
        .onHover { hovering in
            withAnimation(.easeInOut(duration: 0.15)) {
                isHovered = hovering
            }
        }
    }
}

// MARK: - Contextual Action Row

struct ContextualActionRow: View {
    let icon: String
    let title: String
    let subtitle: String
    let color: Color
    let action: () -> Void

    @State private var isHovered = false

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: icon)
                    .font(.system(size: 16))
                    .foregroundColor(color)

                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(.white)

                    Text(subtitle)
                        .font(.system(size: 10))
                        .foregroundColor(.white.opacity(0.6))
                }

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.system(size: 10))
                    .foregroundColor(.white.opacity(0.4))
            }
            .padding(12)
            .background(
                RoundedRectangle(cornerRadius: 8)
                    .fill(isHovered ? color.opacity(0.2) : color.opacity(0.1))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .strokeBorder(color.opacity(0.3), lineWidth: 1)
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
        MenuBarPopoverView(
            coordinator: RenderCoordinator(),
            agentModeManager: AgentModeManager.shared
        )
            .frame(width: 280, height: 500)
    }
}
#endif
