//
//  QuickStatRow.swift
//  OptaNative
//
//  A compact row component for displaying telemetry stats in the menu bar.
//  Shows label, value, and optional usage percentage with severity-colored progress bar.
//  Created for Opta Native macOS - Plan 19-06
//

import SwiftUI

/// A row component displaying a metric with label, value, and optional progress indicator.
/// Progress bar color changes based on severity thresholds.
struct QuickStatRow: View {
    let label: String
    let value: String
    let percentage: Double?
    let icon: String?

    init(
        label: String,
        value: String,
        percentage: Double? = nil,
        icon: String? = nil
    ) {
        self.label = label
        self.value = value
        self.percentage = percentage
        self.icon = icon
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            // Label and Value Row
            HStack {
                if let icon = icon {
                    Image(systemName: icon)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(Color.optaMutedForeground)
                        .frame(width: 16)
                }

                Text(label)
                    .font(.optaBody)
                    .foregroundStyle(Color.optaMutedForeground)

                Spacer()

                Text(value)
                    .font(.optaBodyMedium)
                    .foregroundStyle(Color.optaForeground)
            }

            // Progress Bar (if percentage provided)
            if let percentage = percentage {
                GeometryReader { geometry in
                    ZStack(alignment: .leading) {
                        // Background track
                        RoundedRectangle(cornerRadius: 2)
                            .fill(Color.optaMuted)
                            .frame(height: 4)

                        // Fill bar
                        RoundedRectangle(cornerRadius: 2)
                            .fill(severityColor(for: percentage))
                            .frame(width: geometry.size.width * min(percentage / 100, 1.0), height: 4)
                    }
                }
                .frame(height: 4)
            }
        }
        .padding(.vertical, 4)
    }

    /// Returns the appropriate color based on percentage severity.
    /// - Green: 0-60% (normal)
    /// - Yellow: 60-80% (warning)
    /// - Red: 80%+ (danger)
    private func severityColor(for percentage: Double) -> Color {
        if percentage >= 80 {
            return Color.optaDanger
        } else if percentage >= 60 {
            return Color.optaWarning
        } else {
            return Color.optaSuccess
        }
    }
}

// MARK: - Temperature Variant

/// A specialized row for temperature display with thermal severity coloring.
struct QuickStatTempRow: View {
    let label: String
    let temperature: Double
    let icon: String?

    init(
        label: String,
        temperature: Double,
        icon: String? = nil
    ) {
        self.label = label
        self.temperature = temperature
        self.icon = icon
    }

    var body: some View {
        HStack {
            if let icon = icon {
                Image(systemName: icon)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(thermalColor)
                    .frame(width: 16)
            }

            Text(label)
                .font(.optaBody)
                .foregroundStyle(Color.optaMutedForeground)

            Spacer()

            Text(String(format: "%.1f°C", temperature))
                .font(.optaBodyMedium)
                .foregroundStyle(thermalColor)
        }
        .padding(.vertical, 4)
    }

    /// Returns the appropriate color based on temperature severity.
    /// - Green: < 60°C (cool)
    /// - Yellow: 60-80°C (warm)
    /// - Red: 80°C+ (hot)
    private var thermalColor: Color {
        if temperature >= 80 {
            return Color.optaDanger
        } else if temperature >= 60 {
            return Color.optaWarning
        } else {
            return Color.optaSuccess
        }
    }
}

// MARK: - Preview

#Preview("QuickStatRow") {
    ZStack {
        Color.optaBackground
            .ignoresSafeArea()

        VStack(spacing: 16) {
            GlassCard {
                VStack(spacing: 8) {
                    QuickStatRow(
                        label: "CPU Usage",
                        value: "45.2%",
                        percentage: 45.2,
                        icon: "cpu"
                    )

                    Divider()
                        .background(Color.optaBorder)

                    QuickStatRow(
                        label: "Memory",
                        value: "12.4 / 32 GB",
                        percentage: 75.0,
                        icon: "memorychip"
                    )

                    Divider()
                        .background(Color.optaBorder)

                    QuickStatRow(
                        label: "GPU Usage",
                        value: "92.3%",
                        percentage: 92.3,
                        icon: "rectangle.3.group"
                    )

                    Divider()
                        .background(Color.optaBorder)

                    QuickStatTempRow(
                        label: "CPU Temp",
                        temperature: 45.5,
                        icon: "thermometer.medium"
                    )

                    Divider()
                        .background(Color.optaBorder)

                    QuickStatTempRow(
                        label: "GPU Temp",
                        temperature: 82.3,
                        icon: "thermometer.high"
                    )
                }
                .padding(16)
            }
            .frame(width: 260)
        }
        .padding()
    }
    .frame(width: 300, height: 400)
}
