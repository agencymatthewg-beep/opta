//
//  PopoverView.swift
//  OptaMenuBar
//
//  Popover content view displayed when clicking the menu bar icon.
//  Shows system metrics with the Opta glass aesthetic.
//  Created for Opta - Plan 20-08
//

import SwiftUI

// MARK: - Popover View

/// Main popover view showing system metrics at a glance.
/// Mirrors the design from OptaNative/MenuBarView.swift with Opta styling.
struct PopoverView: View {
    /// Current system metrics
    let metrics: SystemMetrics?

    /// Current momentum state
    let momentum: MomentumState

    var body: some View {
        ZStack {
            // Glass background
            VisualEffectBlur(material: .hudWindow, blendingMode: .behindWindow)
                .clipShape(RoundedRectangle(cornerRadius: 12))

            VStack(spacing: 0) {
                // Header
                headerSection

                Divider()
                    .background(Color.optaBorder.opacity(0.5))

                // Stats Section
                statsSection

                Divider()
                    .background(Color.optaBorder.opacity(0.5))

                // Actions Section
                actionsSection
            }
            .padding(12)
        }
        .frame(width: 280)
    }

    // MARK: - Header Section

    private var headerSection: some View {
        HStack {
            // Opta Logo with animated glow
            HStack(spacing: 8) {
                RiveLogoView(momentum: momentum, size: 18)

                Text("Opta")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(Color.optaForeground)
            }

            Spacer()

            // Momentum indicator
            momentumBadge
        }
        .padding(.bottom, 12)
    }

    private var momentumBadge: some View {
        HStack(spacing: 4) {
            Circle()
                .fill(momentum.color.swiftUIColor)
                .frame(width: 8, height: 8)

            Text(momentumLabel)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(momentum.color.swiftUIColor)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(
            RoundedRectangle(cornerRadius: 6)
                .fill(momentum.color.swiftUIColor.opacity(0.15))
                .overlay(
                    RoundedRectangle(cornerRadius: 6)
                        .stroke(momentum.color.swiftUIColor.opacity(0.3), lineWidth: 1)
                )
        )
    }

    private var momentumLabel: String {
        switch momentum.color {
        case .idle: return "Idle"
        case .active: return "Active"
        case .critical: return "Critical"
        }
    }

    // MARK: - Stats Section

    private var statsSection: some View {
        VStack(spacing: 8) {
            // CPU Usage
            QuickStatRow(
                icon: "waveform.path.ecg",
                label: "CPU",
                value: cpuFormatted,
                percentage: Double(metrics?.cpuUsage ?? 0),
                color: cpuColor
            )

            // Memory Usage
            QuickStatRow(
                icon: "memorychip",
                label: "Memory",
                value: memoryFormatted,
                percentage: Double(metrics?.memoryUsage ?? 0),
                color: memoryColor
            )

            // CPU Temperature
            if let temp = metrics?.cpuTemperature, temp > 0 {
                QuickStatRow(
                    icon: "thermometer",
                    label: "CPU Temp",
                    value: String(format: "%.0f°C", temp),
                    percentage: Double(temp),
                    maxPercentage: 100,
                    color: tempColor(temp)
                )
            }

            // GPU Temperature
            if let temp = metrics?.gpuTemperature, temp > 0 {
                QuickStatRow(
                    icon: "rectangle.3.group",
                    label: "GPU Temp",
                    value: String(format: "%.0f°C", temp),
                    percentage: Double(temp),
                    maxPercentage: 100,
                    color: tempColor(temp)
                )
            }
        }
        .padding(.vertical, 12)
    }

    // MARK: - Actions Section

    private var actionsSection: some View {
        VStack(spacing: 8) {
            // Open Dashboard Button
            Button {
                openDashboard()
            } label: {
                HStack {
                    Image(systemName: "macwindow")
                        .font(.system(size: 12, weight: .medium))
                    Text("Open Dashboard")
                        .font(.system(size: 14, weight: .medium))
                }
                .foregroundStyle(Color.optaForeground)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
                .background(
                    RoundedRectangle(cornerRadius: 8)
                        .fill(Color.optaMuted.opacity(0.5))
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(Color.optaBorder.opacity(0.5), lineWidth: 1)
                        )
                )
            }
            .buttonStyle(.plain)

            // Quit Button
            Button {
                NSApp.terminate(nil)
            } label: {
                HStack {
                    Image(systemName: "power")
                        .font(.system(size: 12, weight: .medium))
                    Text("Quit Opta")
                        .font(.system(size: 14, weight: .regular))
                }
                .foregroundStyle(Color.optaMutedForeground)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 6)
            }
            .buttonStyle(.plain)
        }
        .padding(.top, 12)
    }

    // MARK: - Computed Properties

    private var cpuFormatted: String {
        String(format: "%.1f%%", metrics?.cpuUsage ?? 0)
    }

    private var memoryFormatted: String {
        let usedGB = Double(metrics?.memoryUsed ?? 0) / (1024 * 1024 * 1024)
        let totalGB = Double(metrics?.memoryTotal ?? 0) / (1024 * 1024 * 1024)
        return String(format: "%.1f / %.1f GB", usedGB, totalGB)
    }

    private var cpuColor: Color {
        let usage = metrics?.cpuUsage ?? 0
        if usage > 80 { return Color.optaDanger }
        if usage > 60 { return Color.optaWarning }
        return Color.optaSuccess
    }

    private var memoryColor: Color {
        let usage = metrics?.memoryUsage ?? 0
        if usage > 85 { return Color.optaDanger }
        if usage > 70 { return Color.optaWarning }
        return Color.optaSuccess
    }

    private func tempColor(_ temp: Float) -> Color {
        if temp > 85 { return Color.optaDanger }
        if temp > 70 { return Color.optaWarning }
        return Color.optaSuccess
    }

    // MARK: - Actions

    private func openDashboard() {
        NSApp.activate(ignoringOtherApps: true)
        // This would communicate with Tauri to open main window
        // For now, just activate the app
    }
}

// MARK: - Quick Stat Row

/// Individual stat row with icon, label, value, and progress bar
struct QuickStatRow: View {
    let icon: String
    let label: String
    let value: String
    let percentage: Double
    var maxPercentage: Double = 100
    var color: Color = Color.optaSuccess

    var body: some View {
        HStack(spacing: 8) {
            // Icon
            Image(systemName: icon)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(Color.optaMutedForeground)
                .frame(width: 16)

            // Label
            Text(label)
                .font(.system(size: 14, weight: .regular))
                .foregroundStyle(Color.optaMutedForeground)

            Spacer()

            // Value
            Text(value)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(Color.optaForeground)
        }
        .padding(.vertical, 4)
        .background(
            GeometryReader { geometry in
                // Progress bar background
                RoundedRectangle(cornerRadius: 4)
                    .fill(color.opacity(0.1))
                    .frame(width: geometry.size.width * CGFloat(min(percentage / maxPercentage, 1.0)))
            }
        )
    }
}

// MARK: - Visual Effect Blur

/// NSVisualEffectView wrapper for native macOS blur
struct VisualEffectBlur: NSViewRepresentable {
    let material: NSVisualEffectView.Material
    let blendingMode: NSVisualEffectView.BlendingMode

    func makeNSView(context: Context) -> NSVisualEffectView {
        let view = NSVisualEffectView()
        view.material = material
        view.blendingMode = blendingMode
        view.state = .active
        return view
    }

    func updateNSView(_ nsView: NSVisualEffectView, context: Context) {
        nsView.material = material
        nsView.blendingMode = blendingMode
    }
}

// MARK: - Design System Colors

extension Color {
    // Core colors from Opta design system
    static let optaBackground = Color(hex: "#09090B")
    static let optaForeground = Color(hex: "#FAFAFA")
    static let optaCard = Color(hex: "#18181B")
    static let optaPrimary = Color(hex: "#8B5CF6")
    static let optaSecondary = Color(hex: "#3730A3")
    static let optaAccent = Color(hex: "#6366F1")
    static let optaSuccess = Color(hex: "#10B981")
    static let optaWarning = Color(hex: "#F59E0B")
    static let optaDanger = Color(hex: "#EF4444")
    static let optaMuted = Color(hex: "#27272A")
    static let optaMutedForeground = Color(hex: "#71717A")
    static let optaBorder = Color(hex: "#3F3F46")

    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)

        let r, g, b: UInt64
        switch hex.count {
        case 6:
            (r, g, b) = (int >> 16, int >> 8 & 0xFF, int & 0xFF)
        default:
            (r, g, b) = (0, 0, 0)
        }

        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: 1
        )
    }
}

// MARK: - Preview

#Preview("PopoverView") {
    PopoverView(
        metrics: SystemMetrics(
            cpuUsage: 45.5,
            memoryUsage: 62.3,
            memoryTotal: 32 * 1024 * 1024 * 1024,
            memoryUsed: UInt64(20.0 * 1024 * 1024 * 1024),
            diskUsage: 55.0,
            cpuTemperature: 52.0,
            gpuTemperature: 48.0,
            timestamp: UInt64(Date().timeIntervalSince1970 * 1000)
        ),
        momentum: MomentumState(intensity: 0.5, color: .active, rotationSpeed: 1.0, pulseFrequency: 1.0)
    )
    .frame(height: 350)
}
