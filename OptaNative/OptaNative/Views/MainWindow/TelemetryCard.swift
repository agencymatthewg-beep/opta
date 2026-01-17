//
//  TelemetryCard.swift
//  OptaNative
//
//  A glass-styled card displaying telemetry metrics with progress visualization.
//  Created for Opta Native macOS - Plan 19-07
//

import SwiftUI

/// A telemetry display card showing a metric with optional usage bar.
/// Uses GlassCard for consistent Opta aesthetic.
struct TelemetryCard: View {

    // MARK: - Properties

    /// Card title (e.g., "CPU", "Memory")
    let title: String

    /// Main value display (e.g., "45.2%", "12.4 GB")
    let value: String

    /// Optional usage percentage (0-100) for progress bar
    let usage: Double?

    /// SF Symbol icon name
    let icon: String

    // MARK: - Initialization

    init(
        title: String,
        value: String,
        usage: Double? = nil,
        icon: String
    ) {
        self.title = title
        self.value = value
        self.usage = usage
        self.icon = icon
    }

    // MARK: - Body

    var body: some View {
        GlassCard(cornerRadius: OptaSpacing.radiusLarge) {
            VStack(alignment: .leading, spacing: OptaSpacing.md) {
                // Header: Icon + Title
                HStack(spacing: OptaSpacing.sm) {
                    Image(systemName: icon)
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(Color.optaPrimary)

                    Text(title)
                        .font(.optaBodyMedium)
                        .foregroundStyle(Color.optaMutedForeground)

                    Spacer()
                }

                // Main Value
                Text(value)
                    .font(.optaH2)
                    .foregroundStyle(Color.optaForeground)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)

                // Progress Bar (if usage provided)
                if let usage = usage {
                    UsageProgressBar(usage: usage)
                }
            }
            .padding(OptaSpacing.lg)
        }
    }
}

// MARK: - Usage Progress Bar

/// A progress bar that changes color based on usage level:
/// - Green: < 60%
/// - Yellow: 60-79%
/// - Red: >= 80%
struct UsageProgressBar: View {
    let usage: Double

    /// Color based on usage threshold
    private var barColor: Color {
        if usage < 60 {
            return Color.optaSuccess
        } else if usage < 80 {
            return Color.optaWarning
        } else {
            return Color.optaDanger
        }
    }

    var body: some View {
        GeometryReader { geometry in
            ZStack(alignment: .leading) {
                // Background track
                RoundedRectangle(cornerRadius: 3)
                    .fill(Color.optaMuted)
                    .frame(height: 6)

                // Progress fill
                RoundedRectangle(cornerRadius: 3)
                    .fill(barColor)
                    .frame(
                        width: geometry.size.width * min(max(usage / 100, 0), 1),
                        height: 6
                    )
                    .animation(.easeOut(duration: 0.3), value: usage)
            }
        }
        .frame(height: 6)
    }
}

// MARK: - Preview

#Preview("Telemetry Card") {
    ZStack {
        Color.optaBackground
            .ignoresSafeArea()

        HStack(spacing: 16) {
            TelemetryCard(
                title: "CPU",
                value: "23.5%",
                usage: 23.5,
                icon: "cpu"
            )
            .frame(width: 150)

            TelemetryCard(
                title: "Memory",
                value: "12.4 GB",
                usage: 65,
                icon: "memorychip"
            )
            .frame(width: 150)

            TelemetryCard(
                title: "GPU",
                value: "85%",
                usage: 85,
                icon: "gpu"
            )
            .frame(width: 150)
        }
        .padding(40)
    }
    .frame(width: 600, height: 200)
}

#Preview("Telemetry Card - Temperature") {
    ZStack {
        Color.optaBackground
            .ignoresSafeArea()

        TelemetryCard(
            title: "CPU Temp",
            value: "45.2°C",
            icon: "thermometer.medium"
        )
        .frame(width: 150)
        .padding(40)
    }
    .frame(width: 300, height: 200)
}
