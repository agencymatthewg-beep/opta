//
//  MenuBarView.swift
//  OptaNative
//
//  Menu bar popover view displaying real-time hardware telemetry.
//  Uses GlassBackground for native macOS vibrancy and integrates
//  with TelemetryViewModel for live data updates.
//  Created for Opta Native macOS - Plan 19-06
//

import SwiftUI

/// The main menu bar popover view showing system telemetry at a glance.
struct MenuBarView: View {
    @Environment(TelemetryViewModel.self) private var telemetry

    var body: some View {
        ZStack {
            // Glass background for native macOS aesthetic
            GlassBackground(
                material: .hudWindow,
                blendingMode: .behindWindow,
                cornerRadius: 12
            )

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
        .onAppear {
            telemetry.startMonitoring()
        }
        .onDisappear {
            telemetry.stopMonitoring()
        }
    }

    // MARK: - Header Section

    private var headerSection: some View {
        HStack {
            // Opta Logo/Title
            HStack(spacing: 8) {
                Image(systemName: "bolt.fill")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(
                        LinearGradient(
                            colors: [Color.optaPrimary, Color.optaAccent],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )

                Text("Opta")
                    .font(.optaH3)
                    .foregroundStyle(Color.optaForeground)
            }

            Spacer()

            // Chip Name Badge
            Text(telemetry.chipName)
                .font(.optaSmall)
                .foregroundStyle(Color.optaPrimary)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(
                    RoundedRectangle(cornerRadius: 6)
                        .fill(Color.optaPrimary.opacity(0.15))
                        .overlay(
                            RoundedRectangle(cornerRadius: 6)
                                .stroke(Color.optaPrimary.opacity(0.3), lineWidth: 1)
                        )
                )
        }
        .padding(.bottom, 12)
    }

    // MARK: - Stats Section

    private var statsSection: some View {
        VStack(spacing: 4) {
            // CPU Temperature
            QuickStatTempRow(
                label: "CPU Temp",
                temperature: telemetry.cpuTemperature,
                icon: "cpu"
            )

            // GPU Temperature
            QuickStatTempRow(
                label: "GPU Temp",
                temperature: telemetry.gpuTemperature,
                icon: "rectangle.3.group"
            )

            Divider()
                .background(Color.optaBorder.opacity(0.3))
                .padding(.vertical, 4)

            // CPU Usage
            QuickStatRow(
                label: "CPU Usage",
                value: telemetry.cpuUsageFormatted,
                percentage: telemetry.cpuUsage,
                icon: "waveform.path.ecg"
            )

            // Memory Usage
            QuickStatRow(
                label: "Memory",
                value: telemetry.memoryFormatted,
                percentage: telemetry.memoryPercent,
                icon: "memorychip"
            )

            // Fan Speed (if available)
            if !telemetry.fanSpeeds.isEmpty {
                Divider()
                    .background(Color.optaBorder.opacity(0.3))
                    .padding(.vertical, 4)

                HStack {
                    Image(systemName: "fan")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(Color.optaMutedForeground)
                        .frame(width: 16)

                    Text("Fans")
                        .font(.optaBody)
                        .foregroundStyle(Color.optaMutedForeground)

                    Spacer()

                    Text(telemetry.fanSpeedsFormatted)
                        .font(.optaSmall)
                        .foregroundStyle(Color.optaForeground)
                        .lineLimit(1)
                }
                .padding(.vertical, 4)
            }

            // Connection Status
            if !telemetry.isSensorConnected {
                HStack {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .font(.system(size: 12))
                        .foregroundStyle(Color.optaWarning)

                    Text("Sensors unavailable")
                        .font(.optaSmall)
                        .foregroundStyle(Color.optaWarning)
                }
                .padding(.top, 8)
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
                        .font(.optaBodyMedium)
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
            .onHover { isHovered in
                if isHovered {
                    NSCursor.pointingHand.set()
                } else {
                    NSCursor.arrow.set()
                }
            }

            // Quit Button
            Button {
                quitApp()
            } label: {
                HStack {
                    Image(systemName: "power")
                        .font(.system(size: 12, weight: .medium))
                    Text("Quit Opta")
                        .font(.optaBody)
                }
                .foregroundStyle(Color.optaMutedForeground)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 6)
            }
            .buttonStyle(.plain)
            .onHover { isHovered in
                if isHovered {
                    NSCursor.pointingHand.set()
                } else {
                    NSCursor.arrow.set()
                }
            }
        }
        .padding(.top, 12)
    }

    // MARK: - Actions

    private func openDashboard() {
        NSApp.activate(ignoringOtherApps: true)
        // Bring the main window to front
        if let window = NSApp.windows.first(where: { $0.title.contains("Opta") || $0.isKeyWindow == false }) {
            window.makeKeyAndOrderFront(nil)
        }
    }

    private func quitApp() {
        NSApp.terminate(nil)
    }
}

// MARK: - Preview

#Preview("MenuBarView") {
    MenuBarView()
        .environment(TelemetryViewModel.preview)
        .frame(width: 280, height: 400)
}
