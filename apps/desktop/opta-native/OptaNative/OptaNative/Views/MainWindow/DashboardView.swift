//
//  DashboardView.swift
//  OptaNative
//
//  Main dashboard view displaying telemetry cards and process list.
//  Created for Opta Native macOS - Plan 19-07
//

import SwiftUI

/// The main dashboard view showing system telemetry and running processes.
/// Uses Environment to access the shared TelemetryViewModel.
struct DashboardView: View {

    // MARK: - Environment

    @Environment(TelemetryViewModel.self) private var telemetry

    // MARK: - State

    @State private var processViewModel = ProcessViewModel()

    // MARK: - Body

    var body: some View {
        ScrollView {
            VStack(spacing: OptaSpacing.xl) {
                // System Telemetry Cards
                telemetrySection

                // Process List
                ProcessListSection(viewModel: processViewModel)
            }
            .padding(OptaSpacing.xl)
        }
        .background(Color.optaBackground)
        .onAppear {
            processViewModel.refreshProcesses()
        }
    }

    // MARK: - Telemetry Section

    @ViewBuilder
    private var telemetrySection: some View {
        VStack(alignment: .leading, spacing: OptaSpacing.md) {
            // Section Header
            HStack {
                Text("System Status")
                    .font(.optaH3)
                    .foregroundStyle(Color.optaForeground)

                Spacer()

                // Monitoring indicator
                if telemetry.isMonitoring {
                    HStack(spacing: 6) {
                        Circle()
                            .fill(Color.optaSuccess)
                            .frame(width: 8, height: 8)
                        Text("Live")
                            .font(.optaSmall)
                            .foregroundStyle(Color.optaMutedForeground)
                    }
                }
            }

            // Telemetry Cards Grid
            HStack(spacing: OptaSpacing.md) {
                // CPU Card
                TelemetryCard(
                    title: "CPU",
                    value: telemetry.cpuUsageFormatted,
                    usage: telemetry.cpuUsage,
                    icon: "cpu"
                )

                // GPU Card (Temperature)
                TelemetryCard(
                    title: "GPU",
                    value: telemetry.gpuTempFormatted,
                    icon: "gpu"
                )

                // Memory Card
                TelemetryCard(
                    title: "Memory",
                    value: telemetry.memoryFormatted,
                    usage: telemetry.memoryPercent,
                    icon: "memorychip"
                )
            }
        }
    }
}

// MARK: - Preview

#Preview("Dashboard View") {
    DashboardView()
        .environment(TelemetryViewModel.preview)
        .frame(width: 600, height: 800)
}
