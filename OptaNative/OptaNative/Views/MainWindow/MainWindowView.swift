//
//  MainWindowView.swift
//  OptaNative
//
//  Main window container view that displays the Opta dashboard.
//  Placeholder implementation that will be expanded in Plan 19-07.
//  Created for Opta Native macOS - Plan 19-06
//

import SwiftUI

/// The main window view container for the Opta dashboard.
/// This placeholder will be expanded with full dashboard functionality in Plan 19-07.
struct MainWindowView: View {
    @Environment(TelemetryViewModel.self) private var telemetry

    var body: some View {
        ZStack {
            // Background
            Color.optaBackground
                .ignoresSafeArea()

            VStack(spacing: 24) {
                // Header
                headerSection

                // Quick Stats Preview
                quickStatsSection

                Spacer()

                // Footer
                footerSection
            }
            .padding(24)
        }
        .frame(minWidth: 400, minHeight: 500)
        .onAppear {
            telemetry.startMonitoring()
        }
    }

    // MARK: - Header Section

    private var headerSection: some View {
        HStack {
            // Logo and Title
            HStack(spacing: 12) {
                Image(systemName: "bolt.fill")
                    .font(.system(size: 28, weight: .semibold))
                    .foregroundStyle(
                        LinearGradient(
                            colors: [Color.optaPrimary, Color.optaAccent],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )

                VStack(alignment: .leading, spacing: 2) {
                    Text("Opta Dashboard")
                        .font(.optaH2)
                        .foregroundStyle(Color.optaForeground)

                    Text(telemetry.chipName)
                        .font(.optaSmall)
                        .foregroundStyle(Color.optaMutedForeground)
                }
            }

            Spacer()

            // Status Indicator
            HStack(spacing: 8) {
                Circle()
                    .fill(telemetry.isMonitoring ? Color.optaSuccess : Color.optaMuted)
                    .frame(width: 8, height: 8)

                Text(telemetry.isMonitoring ? "Live" : "Paused")
                    .font(.optaSmall)
                    .foregroundStyle(Color.optaMutedForeground)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(
                RoundedRectangle(cornerRadius: 8)
                    .fill(Color.optaMuted.opacity(0.5))
            )
        }
    }

    // MARK: - Quick Stats Section

    private var quickStatsSection: some View {
        GlassCard {
            VStack(spacing: 16) {
                // Section Title
                HStack {
                    Text("System Overview")
                        .font(.optaH3)
                        .foregroundStyle(Color.optaForeground)
                    Spacer()
                }

                // Stats Grid
                HStack(spacing: 20) {
                    // CPU
                    statItem(
                        icon: "cpu",
                        label: "CPU",
                        value: telemetry.cpuUsageFormatted,
                        subvalue: telemetry.cpuTempFormatted,
                        isWarning: telemetry.isCPUHot || telemetry.isCPUUsageHigh
                    )

                    Divider()
                        .frame(height: 60)
                        .background(Color.optaBorder)

                    // GPU
                    statItem(
                        icon: "rectangle.3.group",
                        label: "GPU",
                        value: telemetry.gpuTempFormatted,
                        subvalue: nil,
                        isWarning: telemetry.isGPUHot
                    )

                    Divider()
                        .frame(height: 60)
                        .background(Color.optaBorder)

                    // Memory
                    statItem(
                        icon: "memorychip",
                        label: "RAM",
                        value: telemetry.memoryPercentFormatted,
                        subvalue: telemetry.memoryFormatted,
                        isWarning: telemetry.isMemoryHigh
                    )
                }
            }
            .padding(20)
        }
    }

    private func statItem(
        icon: String,
        label: String,
        value: String,
        subvalue: String?,
        isWarning: Bool
    ) -> some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .font(.system(size: 24, weight: .medium))
                .foregroundStyle(isWarning ? Color.optaWarning : Color.optaPrimary)

            Text(label)
                .font(.optaSmall)
                .foregroundStyle(Color.optaMutedForeground)

            Text(value)
                .font(.optaH3)
                .foregroundStyle(isWarning ? Color.optaWarning : Color.optaForeground)

            if let subvalue = subvalue {
                Text(subvalue)
                    .font(.optaSmall)
                    .foregroundStyle(Color.optaMutedForeground)
            }
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Footer Section

    private var footerSection: some View {
        HStack {
            if let lastUpdate = telemetry.lastUpdate {
                Text("Last updated: \(lastUpdate, style: .time)")
                    .font(.optaSmall)
                    .foregroundStyle(Color.optaMutedForeground)
            }

            Spacer()

            Text("Opta Native v0.1")
                .font(.optaSmall)
                .foregroundStyle(Color.optaMutedForeground)
        }
    }
}

// MARK: - Preview

#Preview("Main Window") {
    MainWindowView()
        .environment(TelemetryViewModel.preview)
        .frame(width: 500, height: 600)
}
