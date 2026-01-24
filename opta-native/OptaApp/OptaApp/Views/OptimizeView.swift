//
//  OptimizeView.swift
//  OptaApp
//
//  Core optimization page displaying system health, one-click Stealth Mode,
//  before/after comparison, and resource breakdown.
//  Features obsidian depth hierarchy with branch-energy violet accents.
//

import SwiftUI

// MARK: - OptimizeView

/// The main optimization view showing system health and one-click optimize.
///
/// Layout:
/// - Header: "Optimize" title with system health status
/// - Hero: Large "Optimize Now" button with violet glow
/// - Health Grid: 2x2 system health cards (CPU, Memory, GPU, Thermal)
/// - Results: Before/after stealth mode comparison
/// - Score: Current Opta Score with grade badge
/// - Processes: Process count summary with navigation link
///
/// # Usage
///
/// ```swift
/// OptimizeView(coreManager: coreManager)
/// ```
struct OptimizeView: View {

    // MARK: - Properties

    /// The core manager for state and events
    @Bindable var coreManager: OptaCoreManager

    /// Color temperature state from environment
    @Environment(\.colorTemperature) private var colorTemp

    /// Reduce motion preference
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// Obsidian base color
    private let obsidianBase = Color(hex: "0A0A0F")

    /// Electric Violet accent
    private let electricViolet = Color(hex: "8B5CF6")

    /// Horizontal content padding
    private let horizontalPadding: CGFloat = 24

    // MARK: - Body

    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(spacing: 24) {
                // Header
                headerSection

                // Hero Optimize Button
                optimizeButtonSection
                    .padding(.vertical, 8)

                // System Health Grid
                healthGridSection

                // Before/After Results
                if coreManager.viewModel.lastStealthResult != nil {
                    resultSection
                        .transition(.asymmetric(
                            insertion: .opacity.combined(with: .move(edge: .bottom)),
                            removal: .opacity
                        ))
                }

                // Score Impact
                scoreSection

                // Process Summary
                processSummarySection
            }
            .padding(.horizontal, horizontalPadding)
            .padding(.vertical, 24)
        }
        .background(Color(hex: "09090B"))
        .animation(
            reduceMotion ? .none : OrganicMotion.organicSpring(for: "optimize-results", intensity: .medium),
            value: coreManager.viewModel.lastStealthResult != nil
        )
    }

    // MARK: - Header Section

    private var headerSection: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("Optimize")
                    .font(.system(size: 28, weight: .bold))
                    .foregroundStyle(.white)

                Text(systemHealthStatus)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(healthStatusColor)
            }

            Spacer()

            // Back button
            Button {
                coreManager.navigate(to: .dashboard)
            } label: {
                Image(systemName: "arrow.left")
                    .font(.system(size: 16, weight: .medium))
                    .foregroundStyle(.white.opacity(0.6))
                    .frame(width: 36, height: 36)
                    .background(
                        RoundedRectangle(cornerRadius: 10)
                            .fill(obsidianBase)
                            .overlay(
                                RoundedRectangle(cornerRadius: 10)
                                    .stroke(colorTemp.violetColor.opacity(colorTemp.glowOpacity * 0.2), lineWidth: 1)
                            )
                    )
            }
            .buttonStyle(.plain)
        }
    }

    // MARK: - Optimize Button Section

    private var optimizeButtonSection: some View {
        OptimizeActionButton(
            isOptimizing: coreManager.viewModel.stealthModeActive,
            hasResult: coreManager.viewModel.lastStealthResult != nil,
            colorTemp: colorTemp,
            reduceMotion: reduceMotion
        ) {
            coreManager.executeStealthMode()
        }
    }

    // MARK: - Health Grid Section

    private var healthGridSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("System Health")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(.white.opacity(0.8))

            LazyVGrid(columns: [
                GridItem(.flexible(), spacing: 12),
                GridItem(.flexible(), spacing: 12)
            ], spacing: 12) {
                HealthCard(
                    title: "CPU",
                    value: "\(Int(coreManager.viewModel.cpuUsage))%",
                    icon: "cpu",
                    status: healthStatus(for: coreManager.viewModel.cpuUsage),
                    colorTemp: colorTemp
                )

                HealthCard(
                    title: "Memory",
                    value: "\(Int(coreManager.viewModel.memoryUsage))%",
                    icon: "memorychip",
                    status: healthStatus(for: coreManager.viewModel.memoryUsage),
                    colorTemp: colorTemp
                )

                HealthCard(
                    title: "GPU",
                    value: gpuDisplayValue,
                    icon: "gpu",
                    status: gpuHealthStatus,
                    colorTemp: colorTemp
                )

                HealthCard(
                    title: "Thermal",
                    value: coreManager.viewModel.thermalState.rawValue,
                    icon: "thermometer.medium",
                    status: thermalHealthStatus,
                    colorTemp: colorTemp
                )
            }
        }
    }

    // MARK: - Result Section

    private var resultSection: some View {
        OptimizeResultView(
            result: coreManager.viewModel.lastStealthResult!,
            colorTemp: colorTemp
        )
    }

    // MARK: - Score Section

    private var scoreSection: some View {
        HStack(spacing: 16) {
            // Score value
            VStack(alignment: .leading, spacing: 4) {
                Text("Opta Score")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(.white.opacity(0.6))

                Text("\(coreManager.viewModel.optaScore)")
                    .font(.system(size: 36, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
            }

            Spacer()

            // Grade badge
            Text(coreManager.viewModel.scoreGrade)
                .font(.system(size: 20, weight: .bold, design: .rounded))
                .foregroundStyle(gradeColor)
                .frame(width: 48, height: 48)
                .background(
                    RoundedRectangle(cornerRadius: 12)
                        .fill(obsidianBase)
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(gradeColor.opacity(0.4), lineWidth: 2)
                        )
                )
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(obsidianBase)
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .stroke(colorTemp.violetColor.opacity(colorTemp.glowOpacity * 0.2), lineWidth: 1)
                )
        )
    }

    // MARK: - Process Summary Section

    private var processSummarySection: some View {
        Button {
            coreManager.navigate(to: .processes)
        } label: {
            HStack(spacing: 12) {
                Image(systemName: "gearshape.2.fill")
                    .font(.system(size: 18))
                    .foregroundStyle(colorTemp.violetColor)

                VStack(alignment: .leading, spacing: 2) {
                    Text("\(coreManager.viewModel.processCount) Processes Running")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(.white)

                    Text("Tap to view process list")
                        .font(.system(size: 12))
                        .foregroundStyle(.white.opacity(0.5))
                }

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(.white.opacity(0.4))
            }
            .padding(16)
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(obsidianBase)
                    .overlay(
                        RoundedRectangle(cornerRadius: 16)
                            .stroke(colorTemp.violetColor.opacity(colorTemp.glowOpacity * 0.15), lineWidth: 1)
                    )
            )
        }
        .buttonStyle(.plain)
    }

    // MARK: - Computed Properties

    /// System health status text
    private var systemHealthStatus: String {
        if coreManager.viewModel.thermalState == .critical || coreManager.viewModel.memoryPressure == .critical {
            return "Needs Optimization"
        } else if coreManager.viewModel.thermalState == .serious || coreManager.viewModel.memoryPressure == .warning {
            return "Could Improve"
        } else {
            return "Running Well"
        }
    }

    /// Color for the health status text
    private var healthStatusColor: Color {
        if coreManager.viewModel.thermalState == .critical || coreManager.viewModel.memoryPressure == .critical {
            return Color(hex: "EF4444")
        } else if coreManager.viewModel.thermalState == .serious || coreManager.viewModel.memoryPressure == .warning {
            return Color(hex: "F59E0B")
        } else {
            return Color(hex: "22C55E")
        }
    }

    /// GPU display value
    private var gpuDisplayValue: String {
        if let gpu = coreManager.viewModel.gpuUsage {
            return "\(Int(gpu))%"
        }
        return "N/A"
    }

    /// GPU health status
    private var gpuHealthStatus: HealthCardStatus {
        guard let gpu = coreManager.viewModel.gpuUsage else { return .good }
        return healthStatus(for: gpu)
    }

    /// Thermal health status
    private var thermalHealthStatus: HealthCardStatus {
        switch coreManager.viewModel.thermalState {
        case .nominal, .fair:
            return .good
        case .serious:
            return .warning
        case .critical:
            return .critical
        }
    }

    /// Grade color based on score grade
    private var gradeColor: Color {
        switch coreManager.viewModel.scoreGrade {
        case "S": return Color(hex: "A78BFA")
        case "A": return Color(hex: "22C55E")
        case "B": return Color(hex: "3B82F6")
        case "C": return Color(hex: "F59E0B")
        case "D": return Color(hex: "EF4444")
        default: return Color(hex: "6B7280")
        }
    }

    /// Determine health status from a usage percentage
    private func healthStatus(for usage: Float) -> HealthCardStatus {
        if usage > 85 { return .critical }
        if usage > 60 { return .warning }
        return .good
    }
}

// MARK: - Health Card Status

/// Status levels for health cards
enum HealthCardStatus {
    case good
    case warning
    case critical

    var color: Color {
        switch self {
        case .good: return Color(hex: "22C55E")
        case .warning: return Color(hex: "F59E0B")
        case .critical: return Color(hex: "EF4444")
        }
    }
}

// MARK: - Health Card

/// A compact system health card showing a metric with status indicator.
private struct HealthCard: View {

    let title: String
    let value: String
    let icon: String
    let status: HealthCardStatus
    let colorTemp: ColorTemperatureState

    private let obsidianBase = Color(hex: "0A0A0F")

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: icon)
                    .font(.system(size: 14))
                    .foregroundStyle(colorTemp.violetColor)

                Spacer()

                Circle()
                    .fill(status.color)
                    .frame(width: 8, height: 8)
            }

            Text(value)
                .font(.system(size: 22, weight: .bold, design: .rounded))
                .foregroundStyle(.white)

            Text(title)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(.white.opacity(0.5))
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 14)
                .fill(obsidianBase)
                .overlay(
                    RoundedRectangle(cornerRadius: 14)
                        .stroke(colorTemp.violetColor.opacity(colorTemp.glowOpacity * 0.2), lineWidth: 1)
                )
        )
    }
}

// MARK: - Optimize Action Button

/// Large hero button for triggering optimization with state feedback.
private struct OptimizeActionButton: View {

    let isOptimizing: Bool
    let hasResult: Bool
    let colorTemp: ColorTemperatureState
    let reduceMotion: Bool
    let action: () -> Void

    private let obsidianBase = Color(hex: "0A0A0F")
    private let electricViolet = Color(hex: "8B5CF6")

    /// Pulse animation state for idle glow
    @State private var pulsePhase: Bool = false

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                if isOptimizing {
                    ProgressView()
                        .progressViewStyle(.circular)
                        .scaleEffect(0.9)
                        .tint(.white)
                } else if hasResult {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 24))
                        .foregroundStyle(Color(hex: "22C55E"))
                } else {
                    Image(systemName: "bolt.fill")
                        .font(.system(size: 24))
                        .foregroundStyle(electricViolet)
                }

                Text(buttonLabel)
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(.white)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 64)
            .background(
                RoundedRectangle(cornerRadius: 18)
                    .fill(obsidianBase)
                    .overlay(
                        RoundedRectangle(cornerRadius: 18)
                            .stroke(
                                borderGradient,
                                lineWidth: 2
                            )
                    )
                    .shadow(
                        color: electricViolet.opacity(glowOpacity),
                        radius: reduceMotion ? 8 : (pulsePhase ? 16 : 10),
                        x: 0,
                        y: 0
                    )
            )
        }
        .buttonStyle(.plain)
        .disabled(isOptimizing)
        .opacity(isOptimizing ? 0.8 : 1.0)
        .onAppear {
            guard !reduceMotion else { return }
            withAnimation(.easeInOut(duration: 2.0).repeatForever(autoreverses: true)) {
                pulsePhase = true
            }
        }
    }

    /// Button label based on current state
    private var buttonLabel: String {
        if isOptimizing { return "Optimizing..." }
        if hasResult { return "Optimized" }
        return "Optimize Now"
    }

    /// Border gradient for the button
    private var borderGradient: LinearGradient {
        LinearGradient(
            colors: [
                electricViolet.opacity(0.8),
                electricViolet.opacity(0.4),
                electricViolet.opacity(0.8)
            ],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    /// Glow opacity based on state
    private var glowOpacity: Double {
        if isOptimizing { return 0.3 }
        if hasResult { return 0.1 }
        return colorTemp.glowOpacity * 0.5
    }
}

// MARK: - Optimize Result View

/// Before/After comparison showing stealth mode results.
private struct OptimizeResultView: View {

    let result: StealthResultViewModel
    let colorTemp: ColorTemperatureState

    private let obsidianBase = Color(hex: "0A0A0F")
    private let electricViolet = Color(hex: "8B5CF6")

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Optimization Results")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(.white.opacity(0.8))

            HStack(spacing: 16) {
                // Processes Terminated
                resultMetric(
                    label: "Processes Terminated",
                    value: "\(result.terminatedCount)",
                    icon: "xmark.circle.fill"
                )

                // Divider
                Rectangle()
                    .fill(colorTemp.violetColor.opacity(0.2))
                    .frame(width: 1)

                // Memory Freed
                resultMetric(
                    label: "Memory Freed",
                    value: "\(result.memoryFreedMb) MB",
                    icon: "arrow.down.circle.fill"
                )
            }
            .padding(16)
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(obsidianBase)
                    .overlay(
                        RoundedRectangle(cornerRadius: 16)
                            .stroke(electricViolet.opacity(colorTemp.glowOpacity * 0.3), lineWidth: 1.5)
                    )
                    .shadow(
                        color: electricViolet.opacity(colorTemp.glowOpacity * 0.15),
                        radius: 12,
                        x: 0,
                        y: 0
                    )
            )
        }
    }

    /// A single result metric column
    private func resultMetric(label: String, value: String, icon: String) -> some View {
        VStack(spacing: 6) {
            Image(systemName: icon)
                .font(.system(size: 20))
                .foregroundStyle(electricViolet)

            Text(value)
                .font(.system(size: 24, weight: .bold, design: .rounded))
                .foregroundStyle(.white)

            Text(label)
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(.white.opacity(0.5))
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
    }
}

// MARK: - Preview

#Preview {
    OptimizeView(coreManager: OptaCoreManager())
        .withColorTemperature()
        .preferredColorScheme(.dark)
}
