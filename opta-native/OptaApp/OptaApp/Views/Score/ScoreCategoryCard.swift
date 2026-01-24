//
//  ScoreCategoryCard.swift
//  OptaApp
//
//  Expandable card showing a score category with mini ring,
//  grade, and detail breakdowns. Uses obsidian styling with violet accents.
//

import SwiftUI

// MARK: - ScoreCategoryCard

/// A card displaying a score category with its mini ring, grade, and expandable details.
///
/// Features:
/// - Mini progress ring showing category score
/// - Category icon and grade badge
/// - Expandable detail rows with impact indicators
/// - Obsidian styling with violet accents
///
/// # Usage
///
/// ```swift
/// ScoreCategoryCard(categoryScore: performanceScore, colorTemp: colorTemp)
/// ```
struct ScoreCategoryCard: View {

    // MARK: - Properties

    /// The category score data to display
    let categoryScore: CategoryScore

    /// Color temperature state
    let colorTemp: ColorTemperatureState

    /// Whether the detail breakdown is expanded
    @State private var isExpanded: Bool = false

    /// Reduce motion preference
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// Obsidian base color
    private let obsidianBase = Color(hex: "0A0A0F")

    /// Electric Violet accent
    private let electricViolet = Color(hex: "8B5CF6")

    // MARK: - Body

    var body: some View {
        VStack(spacing: 0) {
            // Main card header (tappable to expand)
            Button {
                withAnimation(reduceMotion ? .none : .easeInOut(duration: 0.25)) {
                    isExpanded.toggle()
                }
            } label: {
                cardHeader
            }
            .buttonStyle(.plain)

            // Expandable detail section
            if isExpanded {
                detailSection
                    .transition(.asymmetric(
                        insertion: .opacity.combined(with: .move(edge: .top)),
                        removal: .opacity
                    ))
            }
        }
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(obsidianBase)
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .stroke(colorTemp.violetColor.opacity(colorTemp.glowOpacity * 0.2), lineWidth: 1)
                )
        )
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    // MARK: - Card Header

    private var cardHeader: some View {
        HStack(spacing: 14) {
            // Mini score ring
            miniRing

            // Category info
            VStack(alignment: .leading, spacing: 3) {
                Text(categoryScore.category.displayName)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(.white)

                Text(categoryScore.category.description)
                    .font(.system(size: 11, weight: .regular))
                    .foregroundStyle(.white.opacity(0.45))
                    .lineLimit(1)
            }

            Spacer()

            // Grade badge
            Text(categoryScore.grade)
                .font(.system(size: 14, weight: .bold, design: .rounded))
                .foregroundStyle(gradeColor)
                .frame(width: 32, height: 32)
                .background(
                    RoundedRectangle(cornerRadius: 8)
                        .fill(obsidianBase)
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(gradeColor.opacity(0.4), lineWidth: 1.5)
                        )
                )

            // Expand indicator
            Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(.white.opacity(0.4))
        }
        .padding(16)
    }

    // MARK: - Mini Ring

    private var miniRing: some View {
        ZStack {
            Circle()
                .stroke(Color.white.opacity(0.1), lineWidth: 3)

            Circle()
                .trim(from: 0, to: CGFloat(categoryScore.score) / 100.0)
                .stroke(
                    LinearGradient(
                        colors: [colorTemp.tintColor, colorTemp.tintColor.opacity(0.5)],
                        startPoint: .leading,
                        endPoint: .trailing
                    ),
                    style: StrokeStyle(lineWidth: 3, lineCap: .round)
                )
                .rotationEffect(.degrees(-90))

            // Category icon
            Image(systemName: categoryScore.category.icon)
                .font(.system(size: 12))
                .foregroundStyle(colorTemp.violetColor)
        }
        .frame(width: 40, height: 40)
    }

    // MARK: - Detail Section

    private var detailSection: some View {
        VStack(spacing: 0) {
            Divider()
                .frame(height: 1)
                .overlay(colorTemp.violetColor.opacity(0.1))

            VStack(spacing: 10) {
                ForEach(categoryScore.details) { detail in
                    detailRow(detail: detail)
                }
            }
            .padding(16)
        }
    }

    /// A single detail factor row
    private func detailRow(detail: ScoreDetail) -> some View {
        HStack(spacing: 10) {
            // Impact indicator dot
            Circle()
                .fill(impactColor(detail.impact))
                .frame(width: 8, height: 8)

            // Factor name
            Text(detail.name)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(.white.opacity(0.8))

            Spacer()

            // Factor value
            Text("\(detail.value)")
                .font(.system(size: 14, weight: .bold, design: .rounded))
                .foregroundStyle(impactColor(detail.impact))
        }
    }

    // MARK: - Computed Properties

    /// Grade color based on grade value
    private var gradeColor: Color {
        switch categoryScore.grade {
        case "S": return Color(hex: "A78BFA")
        case "A": return Color(hex: "22C55E")
        case "B": return Color(hex: "3B82F6")
        case "C": return Color(hex: "F59E0B")
        case "D": return Color(hex: "EF4444")
        default: return Color(hex: "6B7280")
        }
    }

    /// Color for impact indicator
    private func impactColor(_ impact: ScoreImpact) -> Color {
        switch impact {
        case .positive: return Color(hex: "22C55E")
        case .neutral: return Color(hex: "F59E0B")
        case .negative: return Color(hex: "EF4444")
        }
    }
}

// MARK: - Placeholder Card

/// Placeholder for loading state before breakdown is computed
struct ScoreCategoryCardPlaceholder: View {

    let category: ScoreCategory
    let colorTemp: ColorTemperatureState

    private let obsidianBase = Color(hex: "0A0A0F")

    var body: some View {
        HStack(spacing: 14) {
            // Placeholder ring
            Circle()
                .stroke(Color.white.opacity(0.1), lineWidth: 3)
                .frame(width: 40, height: 40)

            VStack(alignment: .leading, spacing: 4) {
                Text(category.displayName)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(.white)

                RoundedRectangle(cornerRadius: 3)
                    .fill(.white.opacity(0.1))
                    .frame(width: 120, height: 10)
            }

            Spacer()

            RoundedRectangle(cornerRadius: 6)
                .fill(.white.opacity(0.08))
                .frame(width: 32, height: 32)
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
}

// MARK: - Preview

#if DEBUG
#Preview {
    VStack(spacing: 16) {
        ScoreCategoryCard(
            categoryScore: CategoryScore(
                category: .performance,
                score: 78,
                grade: "B",
                details: [
                    ScoreDetail(name: "CPU Idle Efficiency", value: 82, impact: .positive),
                    ScoreDetail(name: "GPU Efficiency", value: 65, impact: .neutral),
                    ScoreDetail(name: "Memory Efficiency", value: 88, impact: .positive)
                ]
            ),
            colorTemp: .idle
        )

        ScoreCategoryCard(
            categoryScore: CategoryScore(
                category: .stability,
                score: 45,
                grade: "C",
                details: [
                    ScoreDetail(name: "Thermal Management", value: 40, impact: .negative),
                    ScoreDetail(name: "Memory Pressure", value: 50, impact: .neutral),
                    ScoreDetail(name: "System Stability", value: 40, impact: .negative)
                ]
            ),
            colorTemp: .idle
        )
    }
    .padding()
    .background(Color(hex: "09090B"))
    .preferredColorScheme(.dark)
}
#endif
