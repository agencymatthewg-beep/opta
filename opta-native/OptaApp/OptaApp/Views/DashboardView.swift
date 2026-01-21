//
//  DashboardView.swift
//  OptaApp
//
//  Main dashboard view displaying telemetry, Opta Score, and quick actions.
//  The primary optimization interface for the app.
//

import SwiftUI

// MARK: - DashboardView

/// The main dashboard displaying real-time system health via OptaCoreManager.
///
/// Layout:
/// - Top: OptaRing centerpiece with score overlay
/// - Middle: 3-column telemetry cards (CPU, Memory, GPU)
/// - Bottom: QuickActions bar
///
/// # Usage
///
/// ```swift
/// DashboardView(coreManager: coreManager, renderCoordinator: coordinator)
/// ```
struct DashboardView: View {

    // MARK: - Properties

    /// The core manager for state and events
    @Bindable var coreManager: OptaCoreManager

    /// The render coordinator for the OptaRing (shared from app level)
    @ObservedObject var renderCoordinator: RenderCoordinator

    /// Reduce motion preference
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    // MARK: - Constants

    private let horizontalPadding: CGFloat = 24
    private let verticalSpacing: CGFloat = 24
    private let ringSize: CGFloat = 300

    // MARK: - Body

    var body: some View {
        GeometryReader { geometry in
            ScrollView(showsIndicators: false) {
                VStack(spacing: verticalSpacing) {
                    // Top section: OptaRing with score overlay
                    ringSection

                    // Middle section: Telemetry cards
                    telemetrySection(width: geometry.size.width)

                    // Bottom section: Quick actions
                    QuickActions(coreManager: coreManager)
                        .padding(.horizontal, horizontalPadding)

                    // Additional info
                    statusSection
                }
                .padding(.vertical, verticalSpacing)
            }
        }
        .background(Color(hex: "09090B"))
        .onAppear {
            coreManager.appStarted()
        }
    }

    // MARK: - Subviews

    /// OptaRing centerpiece with score overlay
    private var ringSection: some View {
        ZStack {
            // The 3D OptaRing as visual centerpiece
            OptaRingView(
                coordinator: renderCoordinator,
                phase: coreManager.viewModel.ring.phase,
                intensity: coreManager.viewModel.ring.energy,
                explodeProgress: coreManager.viewModel.ring.progress,
                onTap: {
                    // Toggle ring expanded state on tap
                    coreManager.dispatch(.toggleRingExpanded)
                }
            )
            .frame(width: ringSize, height: ringSize)

            // Score display overlaid in the center of the ring
            VStack(spacing: 4) {
                // Large score number
                Text("\(coreManager.viewModel.optaScore)")
                    .font(.system(size: 56, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                    .contentTransition(.numericText())

                // Grade badge
                Text(coreManager.viewModel.scoreGrade)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(gradeColor)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 4)
                    .background(
                        Capsule()
                            .fill(gradeColor.opacity(0.15))
                    )

                // Calculating indicator
                if coreManager.viewModel.scoreCalculating {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: .white))
                        .scaleEffect(0.6)
                        .padding(.top, 4)
                }
            }
        }
        .padding(.top, 16)
    }

    /// Legacy score section (for reference, now integrated into ringSection)
    private var scoreSection: some View {
        ScoreDisplay(
            score: coreManager.viewModel.optaScore,
            grade: coreManager.viewModel.scoreGrade,
            isCalculating: coreManager.viewModel.scoreCalculating,
            animation: coreManager.viewModel.scoreAnimation
        )
        .padding(.top, 16)
    }

    // MARK: - Computed Properties

    /// Color for grade badge based on grade letter
    private var gradeColor: Color {
        switch coreManager.viewModel.scoreGrade {
        case "S":
            return Color(hex: "F59E0B")  // Gold
        case "A":
            return Color(hex: "10B981")  // Emerald
        case "B":
            return Color(hex: "3B82F6")  // Blue
        case "C":
            return Color(hex: "8B5CF6")  // Purple
        case "D":
            return Color(hex: "F97316")  // Orange
        default:
            return Color(hex: "EF4444")  // Red for F
        }
    }

    /// Telemetry cards section
    private func telemetrySection(width: CGFloat) -> some View {
        let cardSpacing: CGFloat = 12
        let totalPadding = horizontalPadding * 2
        let availableWidth = width - totalPadding - (cardSpacing * 2)
        let cardWidth = availableWidth / 3

        return HStack(spacing: cardSpacing) {
            // CPU Card
            TelemetryCard(
                title: "CPU",
                value: coreManager.viewModel.cpuUsage,
                icon: "cpu",
                color: .blue,
                history: coreManager.viewModel.cpuHistory
            )
            .frame(width: cardWidth)

            // Memory Card
            TelemetryCard(
                title: "Memory",
                value: coreManager.viewModel.memoryUsage,
                icon: "memorychip",
                color: Color(hex: "8B5CF6"),
                history: coreManager.viewModel.memoryHistory
            )
            .frame(width: cardWidth)

            // GPU Card
            TelemetryCard(
                title: "GPU",
                value: coreManager.viewModel.gpuUsage ?? 0,
                icon: "gpu",
                color: .orange,
                history: coreManager.viewModel.gpuHistory
            )
            .frame(width: cardWidth)
        }
        .padding(.horizontal, horizontalPadding)
    }

    /// Status information section
    private var statusSection: some View {
        VStack(spacing: 8) {
            // Thermal state
            HStack(spacing: 8) {
                Circle()
                    .fill(thermalColor)
                    .frame(width: 8, height: 8)

                Text("Thermal: \(coreManager.viewModel.thermalState.rawValue)")
                    .font(.system(size: 12))
                    .foregroundStyle(.white.opacity(0.6))

                Spacer()

                // Memory pressure
                Circle()
                    .fill(memoryPressureColor)
                    .frame(width: 8, height: 8)

                Text("Memory: \(coreManager.viewModel.memoryPressure.rawValue)")
                    .font(.system(size: 12))
                    .foregroundStyle(.white.opacity(0.6))
            }

            // Process count
            HStack {
                Image(systemName: "gearshape.2")
                    .font(.system(size: 10))
                    .foregroundStyle(.white.opacity(0.5))

                Text("\(coreManager.viewModel.processCount) processes")
                    .font(.system(size: 11))
                    .foregroundStyle(.white.opacity(0.5))

                Spacer()

                // Game count
                Image(systemName: "gamecontroller")
                    .font(.system(size: 10))
                    .foregroundStyle(.white.opacity(0.5))

                Text("\(coreManager.viewModel.gameCount) games")
                    .font(.system(size: 11))
                    .foregroundStyle(.white.opacity(0.5))
            }

            // Stealth mode status
            if coreManager.viewModel.stealthModeActive {
                stealthModeIndicator
            }

            // Last stealth result
            if let result = coreManager.viewModel.lastStealthResult {
                lastStealthResultView(result)
            }
        }
        .padding(.horizontal, horizontalPadding)
        .padding(.vertical, 16)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.white.opacity(0.03))
        )
        .padding(.horizontal, horizontalPadding)
    }

    /// Stealth mode active indicator
    private var stealthModeIndicator: some View {
        HStack(spacing: 8) {
            ProgressView()
                .progressViewStyle(CircularProgressViewStyle(tint: Color(hex: "8B5CF6")))
                .scaleEffect(0.6)

            Text("Stealth Mode Active")
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(Color(hex: "8B5CF6"))

            Spacer()
        }
        .padding(.top, 8)
    }

    /// Last stealth result view
    private func lastStealthResultView(_ result: StealthResultViewModel) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 12))
                .foregroundStyle(.green)

            Text("Last optimization: \(result.terminatedCount) processes, \(result.memoryFreedMb)MB freed")
                .font(.system(size: 11))
                .foregroundStyle(.white.opacity(0.5))

            Spacer()
        }
        .padding(.top, 4)
    }

    // MARK: - Computed Properties

    /// Color for thermal state indicator
    private var thermalColor: Color {
        switch coreManager.viewModel.thermalState {
        case .nominal:
            return .green
        case .fair:
            return .yellow
        case .serious:
            return .orange
        case .critical:
            return .red
        }
    }

    /// Color for memory pressure indicator
    private var memoryPressureColor: Color {
        switch coreManager.viewModel.memoryPressure {
        case .normal:
            return .green
        case .warning:
            return .yellow
        case .critical:
            return .red
        }
    }
}

// MARK: - Preview

#if DEBUG
struct DashboardView_Previews: PreviewProvider {
    static var previews: some View {
        // Note: Preview requires OptaCoreManager which needs Rust FFI
        // This preview will only work when the full app is built
        Text("DashboardView Preview - Requires OptaCoreManager")
            .frame(width: 800, height: 600)
            .background(Color(hex: "09090B"))
            .preferredColorScheme(.dark)
    }
}
#endif
