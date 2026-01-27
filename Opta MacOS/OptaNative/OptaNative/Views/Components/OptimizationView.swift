//
//  OptimizationView.swift
//  OptaNative
//
//  View for Advanced Optimization settings (Power & Network).
//  Redesigned with Obsidian design system.
//  Created for Opta Native macOS - Plan 98-01 (v12.0)
//

import SwiftUI

struct OptimizationView: View {
    @State private var viewModel = OptimizationViewModel()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: OptaSpacing.xxl) {

                // MARK: - Header
                HStack(alignment: .center) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Optimization")
                            .font(.optaSectionHeader())
                            .foregroundStyle(Color.optaTextPrimary)

                        Text("Power profiles and network diagnostics")
                            .font(.optaSmall)
                            .foregroundStyle(Color.optaTextSecondary)
                    }

                    Spacer()

                    // Battery indicator (if present)
                    if let battery = viewModel.batteryStatus, battery.isPresent {
                        BatteryIndicator(status: battery)
                    }
                }
                .padding(.horizontal, OptaSpacing.lg)
                .padding(.top, OptaSpacing.lg)

                // MARK: - Power Section
                VStack(alignment: .leading, spacing: OptaSpacing.md) {
                    SectionHeader(title: "Power Profile", icon: "bolt.fill")

                    // Profile Grid
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 140))], spacing: OptaSpacing.md) {
                        ForEach(PowerProfile.allCases) { profile in
                            PowerProfileCard(
                                profile: profile,
                                isActive: viewModel.activePowerProfile == profile,
                                estimatedRuntime: viewModel.estimatedRuntime(for: profile)
                            ) {
                                withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                                    viewModel.setPowerProfile(profile)
                                }
                            }
                        }
                    }

                    // Auto-Switch Toggle
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Smart Auto-Switch")
                                .font(.optaBodyMedium)
                                .foregroundStyle(Color.optaTextPrimary)

                            Text("Automatically switch profiles based on your usage patterns")
                                .font(.optaSmall)
                                .foregroundStyle(Color.optaTextSecondary)
                        }

                        Spacer()

                        Toggle("", isOn: Binding(
                            get: { viewModel.autoSwitchEnabled },
                            set: { _ in viewModel.toggleAutoSwitch() }
                        ))
                        .toggleStyle(.switch)
                        .tint(Color.optaNeonPurple)
                    }
                    .padding(OptaSpacing.lg)
                    .background(Color.optaSurface)
                    .overlay(
                        RoundedRectangle(cornerRadius: OptaSpacing.radius)
                            .strokeBorder(Color.optaGlassBorder, lineWidth: 1)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: OptaSpacing.radius))

                    // High Power Mode Recommendation
                    if let status = viewModel.highPowerModeStatus,
                       let recommendation = status.recommendation {
                        HStack(spacing: OptaSpacing.md) {
                            Image(systemName: "info.circle.fill")
                                .font(.title3)
                                .foregroundStyle(Color.optaElectricBlue)

                            Text(recommendation)
                                .font(.optaSmall)
                                .foregroundStyle(Color.optaTextSecondary)
                        }
                        .padding(OptaSpacing.lg)
                        .background(Color.optaElectricBlue.opacity(0.1))
                        .overlay(
                            RoundedRectangle(cornerRadius: OptaSpacing.radius)
                                .strokeBorder(Color.optaElectricBlue.opacity(0.3), lineWidth: 1)
                        )
                        .clipShape(RoundedRectangle(cornerRadius: OptaSpacing.radius))
                    }
                }
                .padding(.horizontal, OptaSpacing.lg)

                Divider()
                    .background(Color.optaBorder)
                    .padding(.horizontal, OptaSpacing.lg)

                // MARK: - Network Section
                VStack(alignment: .leading, spacing: OptaSpacing.md) {
                    HStack {
                        SectionHeader(title: "Network Analysis", icon: "network")

                        Spacer()

                        Button(action: { viewModel.analyzeNetwork() }) {
                            if viewModel.isAnalyzingNetwork {
                                ProgressView()
                                    .scaleEffect(0.7)
                                    .tint(Color.optaNeonPurple)
                            } else {
                                Image(systemName: "arrow.clockwise")
                                    .font(.system(size: 14, weight: .medium))
                                    .foregroundStyle(Color.optaNeonPurple)
                            }
                        }
                        .buttonStyle(.plain)
                        .padding(8)
                        .background(Color.optaNeonPurple.opacity(0.1))
                        .clipShape(Circle())
                        .disabled(viewModel.isAnalyzingNetwork)
                    }

                    if let analysis = viewModel.networkAnalysis {
                        // Overall Status Card
                        NetworkOverviewCard(analysis: analysis)

                        // Recommendation Card
                        RecommendationCard(recommendation: analysis.recommendation)

                        // Latency Results Grid
                        LazyVGrid(columns: [GridItem(.adaptive(minimum: 140))], spacing: OptaSpacing.sm) {
                            ForEach(analysis.results) { result in
                                LatencyResultCard(result: result)
                            }
                        }

                        if let date = viewModel.lastAnalysisDate {
                            Text("Last analyzed: \(date.formatted(date: .omitted, time: .standard))")
                                .font(.optaSmall)
                                .foregroundStyle(Color.optaTextMuted)
                                .frame(maxWidth: .infinity, alignment: .trailing)
                        }
                    } else {
                        // Empty State
                        VStack(spacing: OptaSpacing.md) {
                            Image(systemName: "network.slash")
                                .font(.largeTitle)
                                .foregroundStyle(Color.optaTextMuted)

                            Text("No network data")
                                .font(.optaBodyMedium)
                                .foregroundStyle(Color.optaTextSecondary)

                            Button(action: { viewModel.analyzeNetwork() }) {
                                Text("Run Analysis")
                                    .font(.optaBodyMedium)
                                    .foregroundStyle(Color.optaVoid)
                                    .padding(.horizontal, OptaSpacing.lg)
                                    .padding(.vertical, OptaSpacing.sm)
                                    .background(Color.optaNeonPurple)
                                    .clipShape(Capsule())
                            }
                            .buttonStyle(.plain)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(OptaSpacing.xxl)
                        .background(Color.optaSurface)
                        .clipShape(RoundedRectangle(cornerRadius: OptaSpacing.radius))
                    }
                }
                .padding(.horizontal, OptaSpacing.lg)

                Spacer(minLength: OptaSpacing.xxl)
            }
        }
        .frame(minWidth: 500, minHeight: 700)
        .background(Color.optaVoid)
        .onAppear {
            viewModel.refreshBatteryStatus()
        }
    }
}

// MARK: - Section Header

private struct SectionHeader: View {
    let title: String
    let icon: String

    var body: some View {
        HStack(spacing: OptaSpacing.sm) {
            Image(systemName: icon)
                .font(.body)
                .foregroundStyle(Color.optaNeonPurple)

            Text(title)
                .font(.optaBodyMedium)
                .foregroundStyle(Color.optaTextPrimary)
        }
    }
}

// MARK: - Battery Indicator

private struct BatteryIndicator: View {
    let status: BatteryStatus

    private var batteryColor: Color {
        if status.currentCapacity > 50 { return Color.optaSuccess }
        if status.currentCapacity > 20 { return Color.optaWarning }
        return Color.optaDanger
    }

    var body: some View {
        HStack(spacing: 6) {
            if status.isCharging {
                Image(systemName: "bolt.fill")
                    .font(.caption)
                    .foregroundStyle(Color.optaSuccess)
            }

            Text("\(status.currentCapacity)%")
                .font(.optaBadge())
                .foregroundStyle(batteryColor)

            Image(systemName: status.currentCapacity > 50 ? "battery.100" : "battery.50")
                .font(.caption)
                .foregroundStyle(batteryColor)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(Color.optaSurface)
        .clipShape(Capsule())
    }
}

// MARK: - Power Profile Card

private struct PowerProfileCard: View {
    let profile: PowerProfile
    let isActive: Bool
    let estimatedRuntime: String
    let onSelect: () -> Void

    private var borderColor: Color {
        isActive ? Color.optaNeonPurple : Color.optaGlassBorder
    }

    private var batteryImpactColor: Color {
        switch profile.batteryImpact {
        case .minimal: return Color.optaSuccess
        case .moderate: return Color.optaElectricBlue
        case .significant: return Color.optaWarning
        case .heavy: return Color.optaDanger
        }
    }

    var body: some View {
        Button(action: onSelect) {
            VStack(alignment: .leading, spacing: OptaSpacing.sm) {
                HStack {
                    Image(systemName: profile.icon)
                        .font(.title2)
                        .foregroundStyle(isActive ? Color.optaNeonPurple : Color.optaTextSecondary)

                    Spacer()

                    if isActive {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.caption)
                            .foregroundStyle(Color.optaNeonPurple)
                    }
                }

                Text(profile.rawValue)
                    .font(.optaBodyMedium)
                    .foregroundStyle(Color.optaTextPrimary)
                    .lineLimit(1)

                // Impact indicators
                HStack(spacing: 4) {
                    Image(systemName: profile.batteryImpact.icon)
                        .font(.caption2)
                        .foregroundStyle(batteryImpactColor)

                    Text(estimatedRuntime)
                        .font(.system(size: 10))
                        .foregroundStyle(Color.optaTextMuted)
                }

                // Thermal indicator
                HStack(spacing: 4) {
                    Image(systemName: profile.thermalImpact.icon)
                        .font(.caption2)
                        .foregroundStyle(Color.optaTextMuted)

                    Text(profile.thermalImpact.rawValue)
                        .font(.system(size: 10))
                        .foregroundStyle(Color.optaTextMuted)
                }
            }
            .padding(OptaSpacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(isActive ? Color.optaNeonPurple.opacity(0.1) : Color.optaSurface)
            .overlay(
                RoundedRectangle(cornerRadius: OptaSpacing.radius)
                    .strokeBorder(borderColor, lineWidth: isActive ? 2 : 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: OptaSpacing.radius))
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Network Overview Card

private struct NetworkOverviewCard: View {
    let analysis: NetworkAnalysis

    private var qosColor: Color {
        switch analysis.overallQoS {
        case .excellent: return Color.optaSuccess
        case .good: return Color.optaElectricBlue
        case .fair: return Color.optaWarning
        case .poor: return Color.optaDanger
        }
    }

    var body: some View {
        HStack(spacing: OptaSpacing.lg) {
            // QoS Badge
            VStack(spacing: 4) {
                Image(systemName: analysis.overallQoS.icon)
                    .font(.title)
                    .foregroundStyle(qosColor)

                Text(analysis.overallQoS.rawValue)
                    .font(.optaBadge())
                    .foregroundStyle(qosColor)
            }
            .frame(width: 70)

            // Metrics
            VStack(alignment: .leading, spacing: OptaSpacing.sm) {
                HStack {
                    MetricPill(label: "Avg Latency", value: String(format: "%.0f ms", analysis.averageLatency))
                    MetricPill(label: "Jitter", value: String(format: "%.1f ms", analysis.averageJitter))
                }

                Text("Best region: \(analysis.bestRegion)")
                    .font(.optaSmall)
                    .foregroundStyle(Color.optaTextSecondary)
            }

            Spacer()
        }
        .padding(OptaSpacing.lg)
        .background(qosColor.opacity(0.1))
        .overlay(
            RoundedRectangle(cornerRadius: OptaSpacing.radius)
                .strokeBorder(qosColor.opacity(0.3), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: OptaSpacing.radius))
    }
}

// MARK: - Metric Pill

private struct MetricPill: View {
    let label: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.system(size: 9))
                .foregroundStyle(Color.optaTextMuted)
                .textCase(.uppercase)

            Text(value)
                .font(.optaBodyMedium)
                .foregroundStyle(Color.optaTextPrimary)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(Color.optaSurface)
        .clipShape(RoundedRectangle(cornerRadius: 6))
    }
}

// MARK: - Recommendation Card

private struct RecommendationCard: View {
    let recommendation: NetworkRecommendation

    private var priorityColor: Color {
        switch recommendation.priority {
        case 1: return Color.optaDanger
        case 2: return Color.optaWarning
        default: return Color.optaSuccess
        }
    }

    var body: some View {
        HStack(spacing: OptaSpacing.md) {
            Image(systemName: "lightbulb.fill")
                .font(.title3)
                .foregroundStyle(priorityColor)

            VStack(alignment: .leading, spacing: 2) {
                Text("Buffer Recommendation: \(recommendation.bufferSizeKB) KB")
                    .font(.optaBodyMedium)
                    .foregroundStyle(Color.optaTextPrimary)

                Text(recommendation.description)
                    .font(.optaSmall)
                    .foregroundStyle(Color.optaTextSecondary)
            }

            Spacer()
        }
        .padding(OptaSpacing.lg)
        .background(Color.optaSurface)
        .overlay(
            RoundedRectangle(cornerRadius: OptaSpacing.radius)
                .strokeBorder(Color.optaGlassBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: OptaSpacing.radius))
    }
}

// MARK: - Latency Result Card

private struct LatencyResultCard: View {
    let result: LatencyResult

    private var statusColor: Color {
        switch result.qosClass {
        case .excellent: return Color.optaSuccess
        case .good: return Color.optaElectricBlue
        case .fair: return Color.optaWarning
        case .poor: return Color.optaDanger
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: OptaSpacing.sm) {
            HStack {
                Text(result.targetName)
                    .font(.optaBadge())
                    .foregroundStyle(Color.optaTextMuted)
                    .textCase(.uppercase)

                Spacer()

                Image(systemName: result.qosClass.icon)
                    .font(.caption2)
                    .foregroundStyle(statusColor)
            }

            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text(String(format: "%.0f", result.rttMs))
                    .font(.optaHero(size: 24))
                    .foregroundStyle(statusColor)

                Text("ms")
                    .font(.optaSmall)
                    .foregroundStyle(Color.optaTextMuted)
            }

            // DNS + Jitter
            HStack(spacing: 8) {
                HStack(spacing: 2) {
                    Text("DNS")
                        .font(.system(size: 8))
                    Text(String(format: "%.0f", result.dnsMs))
                        .font(.system(size: 9, weight: .medium))
                }

                HStack(spacing: 2) {
                    Text("±")
                        .font(.system(size: 8))
                    Text(String(format: "%.1f", result.jitterMs))
                        .font(.system(size: 9, weight: .medium))
                }
            }
            .foregroundStyle(Color.optaTextMuted)

            Text(result.region)
                .font(.system(size: 9))
                .foregroundStyle(Color.optaTextMuted)
        }
        .padding(OptaSpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(statusColor.opacity(0.08))
        .overlay(
            RoundedRectangle(cornerRadius: OptaSpacing.radius)
                .strokeBorder(statusColor.opacity(0.2), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: OptaSpacing.radius))
    }
}

// MARK: - Preview

#Preview {
    OptimizationView()
        .frame(width: 550, height: 800)
}
