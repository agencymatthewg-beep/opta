//
//  ScoreDetailView.swift
//  OptaApp
//
//  Full-page score breakdown with category cards, history chart,
//  and optimization impact. Accessible from OptimizeView score section.
//

import SwiftUI
import Charts

// MARK: - ScoreDetailView

/// Detailed score breakdown page showing:
/// - Total score hero with ring and grade
/// - Category breakdown cards (Performance, Stability, Gaming)
/// - Score history chart (last 30 days)
/// - Optimization delta indicator
///
/// # Usage
///
/// ```swift
/// ScoreDetailView(coreManager: coreManager)
/// ```
struct ScoreDetailView: View {

    // MARK: - Properties

    /// The core manager for state and events
    @Bindable var coreManager: OptaCoreManager

    /// Color temperature state from environment
    @Environment(\.colorTemperature) private var colorTemp

    /// Reduce motion preference
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// Score history manager
    @State private var historyManager = ScoreHistoryManager.shared

    /// Current computed breakdown
    @State private var breakdown: ScoreBreakdown?

    /// Obsidian base color
    private let obsidianBase = Color(hex: "0A0A0F")

    /// Electric Violet accent
    private let electricViolet = Color(hex: "8B5CF6")

    // MARK: - Body

    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(spacing: 24) {
                // Header with back navigation
                headerSection

                // Hero score ring
                heroScoreSection

                // Optimization delta (if available)
                if let delta = historyManager.lastOptimizationDelta {
                    optimizationDeltaSection(delta: delta)
                }

                // Category breakdown cards
                categorySection

                // Score history chart
                historyChartSection
            }
            .padding(.horizontal, 24)
            .padding(.vertical, 24)
        }
        .background(Color(hex: "09090B"))
        .onAppear {
            computeBreakdown()
        }
    }

    // MARK: - Header

    private var headerSection: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("Score Breakdown")
                    .font(.system(size: 28, weight: .bold))
                    .foregroundStyle(.white)

                Text("Detailed system analysis")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(.white.opacity(0.5))
            }

            Spacer()

            Button {
                coreManager.navigate(to: .optimize)
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

    // MARK: - Hero Score

    private var heroScoreSection: some View {
        VStack(spacing: 16) {
            ScoreDisplay(
                score: coreManager.viewModel.optaScore,
                grade: coreManager.viewModel.scoreGrade,
                isCalculating: coreManager.viewModel.scoreCalculating,
                animation: coreManager.viewModel.scoreAnimation
            )

            if let breakdown = breakdown {
                Text("Overall: \(breakdown.totalGrade) Grade")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(.white.opacity(0.6))
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
    }

    // MARK: - Optimization Delta

    private func optimizationDeltaSection(delta: Int) -> some View {
        HStack(spacing: 12) {
            Image(systemName: delta > 0 ? "arrow.up.circle.fill" : "arrow.down.circle.fill")
                .font(.system(size: 20))
                .foregroundStyle(delta > 0 ? Color(hex: "22C55E") : Color(hex: "EF4444"))

            VStack(alignment: .leading, spacing: 2) {
                Text("Last Optimization")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(.white.opacity(0.5))

                Text(delta > 0 ? "+\(delta) points" : "\(delta) points")
                    .font(.system(size: 16, weight: .bold, design: .rounded))
                    .foregroundStyle(delta > 0 ? Color(hex: "22C55E") : Color(hex: "EF4444"))
            }

            Spacer()
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 14)
                .fill(obsidianBase)
                .overlay(
                    RoundedRectangle(cornerRadius: 14)
                        .stroke(colorTemp.violetColor.opacity(colorTemp.glowOpacity * 0.15), lineWidth: 1)
                )
        )
    }

    // MARK: - Category Section

    private var categorySection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Category Breakdown")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(.white.opacity(0.8))

            if let breakdown = breakdown {
                ForEach(breakdown.categories, id: \.id) { category in
                    ScoreCategoryCard(categoryScore: category, colorTemp: colorTemp)
                }
            } else {
                // Loading state
                ForEach(ScoreCategory.allCases) { category in
                    ScoreCategoryCardPlaceholder(category: category, colorTemp: colorTemp)
                }
            }
        }
    }

    // MARK: - History Chart Section

    private var historyChartSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Score History")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(.white.opacity(0.8))

            ScoreHistoryChart(
                history: historyManager.history,
                colorTemp: colorTemp
            )
        }
    }

    // MARK: - Helpers

    private func computeBreakdown() {
        let computed = ScoreBreakdown.calculate(from: coreManager.viewModel)
        breakdown = computed
        historyManager.currentBreakdown = computed

        // Record the snapshot
        let categoryScores: [ScoreCategory: Int] = Dictionary(
            uniqueKeysWithValues: computed.categories.map { ($0.category, $0.score) }
        )
        historyManager.recordScore(
            total: computed.totalScore,
            categories: categoryScores,
            afterOptimization: false
        )
    }
}

// MARK: - Preview

#if DEBUG
#Preview {
    ScoreDetailView(coreManager: OptaCoreManager())
        .withColorTemperature()
        .preferredColorScheme(.dark)
}
#endif
