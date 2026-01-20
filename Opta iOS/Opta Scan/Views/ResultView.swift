//
//  ResultView.swift
//  Opta Scan
//
//  Optimization result display with rankings and shareable cards
//  Created by Matthew Byrden
//

import SwiftUI

struct ResultView: View {

    let result: OptimizationResult
    let prompt: String
    var onNewScan: () -> Void
    var onShare: () -> Void

    @State private var showShareSheet = false
    @State private var isVisible = false

    var body: some View {
        ZStack {
            Color.optaBackground
                .ignoresSafeArea()

            ScrollView {
                VStack(spacing: OptaDesign.Spacing.lg) {
                    // Header
                    ResultHeader(prompt: prompt)
                        .opacity(isVisible ? 1 : 0)
                        .offset(y: isVisible ? 0 : 20)

                    // Highlights
                    if !result.highlights.isEmpty {
                        HighlightsCard(highlights: result.highlights)
                            .staggeredAppear(index: 1, isVisible: isVisible)
                    }

                    // Rankings
                    if let rankings = result.rankings, !rankings.isEmpty {
                        RankingsCard(rankings: rankings)
                            .staggeredAppear(index: 2, isVisible: isVisible)
                    }

                    // Full analysis
                    AnalysisCard(markdown: result.markdown)
                        .staggeredAppear(index: 3, isVisible: isVisible)

                    // Action buttons
                    HStack(spacing: OptaDesign.Spacing.md) {
                        Button {
                            OptaHaptics.shared.tap()
                            onShare()
                        } label: {
                            HStack {
                                Image(systemName: "square.and.arrow.up")
                                Text("Share")
                            }
                            .font(.optaBody)
                            .foregroundStyle(Color.optaTextPrimary)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, OptaDesign.Spacing.md)
                            .glassContent()
                        }
                        .accessibilityLabel("Share results")
                        .accessibilityHint("Opens sharing options for your optimization results")

                        Button {
                            OptaHaptics.shared.buttonPress()
                            onNewScan()
                        } label: {
                            HStack {
                                Image(systemName: "camera.fill")
                                Text("New Scan")
                            }
                            .font(.optaBody)
                            .fontWeight(.semibold)
                            .foregroundStyle(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, OptaDesign.Spacing.md)
                            .background(
                                LinearGradient(
                                    colors: [Color.optaPurple, Color.optaBlue],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .clipShape(RoundedRectangle(cornerRadius: OptaDesign.CornerRadius.medium, style: .continuous))
                        }
                        .accessibilityLabel("Start new scan")
                        .accessibilityHint("Returns to camera to capture a new image")
                    }
                    .padding(.top, OptaDesign.Spacing.md)
                    .staggeredAppear(index: 4, isVisible: isVisible)
                }
                .padding(OptaDesign.Spacing.lg)
            }
        }
        .onAppear {
            // Success haptic
            OptaHaptics.shared.success()

            // Stagger in content
            withAnimation(.optaSpringGentle) {
                isVisible = true
            }
        }
    }
}

// MARK: - Result Header

private struct ResultHeader: View {
    let prompt: String

    var body: some View {
        VStack(spacing: OptaDesign.Spacing.sm) {
            Image(systemName: "sparkles")
                .font(.system(size: 40))
                .foregroundStyle(
                    LinearGradient(
                        colors: [Color.optaPurple, Color.optaBlue],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )

            Text("Optimized!")
                .font(.optaTitle)
                .foregroundStyle(Color.optaTextPrimary)

            Text(prompt)
                .font(.optaCaption)
                .foregroundStyle(Color.optaTextSecondary)
                .multilineTextAlignment(.center)
        }
        .padding(.vertical, OptaDesign.Spacing.lg)
    }
}

// MARK: - Highlights Card

private struct HighlightsCard: View {
    let highlights: [String]

    var body: some View {
        VStack(alignment: .leading, spacing: OptaDesign.Spacing.md) {
            HStack {
                Image(systemName: "star.fill")
                    .foregroundStyle(Color.optaAmber)
                Text("Key Takeaways")
                    .font(.optaHeadline)
                    .foregroundStyle(Color.optaTextPrimary)
            }

            VStack(alignment: .leading, spacing: OptaDesign.Spacing.sm) {
                ForEach(highlights, id: \.self) { highlight in
                    HStack(alignment: .top, spacing: OptaDesign.Spacing.sm) {
                        Circle()
                            .fill(Color.optaPurple)
                            .frame(width: 6, height: 6)
                            .padding(.top, 6)

                        Text(highlight)
                            .font(.optaBody)
                            .foregroundStyle(Color.optaTextPrimary)
                    }
                }
            }
        }
        .padding(OptaDesign.Spacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .glassContent()
    }
}

// MARK: - Rankings Card

private struct RankingsCard: View {
    let rankings: [RankingItem]

    var body: some View {
        VStack(alignment: .leading, spacing: OptaDesign.Spacing.md) {
            HStack {
                Image(systemName: "list.number")
                    .foregroundStyle(Color.optaPurple)
                Text("Recommendations")
                    .font(.optaHeadline)
                    .foregroundStyle(Color.optaTextPrimary)
            }

            VStack(spacing: OptaDesign.Spacing.sm) {
                ForEach(Array(rankings.enumerated()), id: \.element.rank) { index, item in
                    RankingRow(rank: index + 1, item: item)
                }
            }
        }
        .padding(OptaDesign.Spacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .glassContent()
    }
}

// MARK: - Ranking Row

private struct RankingRow: View {
    let rank: Int
    let item: RankingItem

    private var medalColor: Color {
        switch rank {
        case 1: return Color.optaAmber
        case 2: return Color.optaTextSecondary
        case 3: return Color(red: 0.8, green: 0.5, blue: 0.2)
        default: return Color.optaTextMuted
        }
    }

    var body: some View {
        HStack(spacing: OptaDesign.Spacing.md) {
            // Rank badge
            ZStack {
                Circle()
                    .fill(medalColor.opacity(0.2))
                    .frame(width: 32, height: 32)

                Text("\(rank)")
                    .font(.optaCaption)
                    .fontWeight(.bold)
                    .foregroundStyle(medalColor)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(item.title)
                    .font(.optaBody)
                    .foregroundStyle(Color.optaTextPrimary)

                if let description = item.description {
                    Text(description)
                        .font(.optaCaption)
                        .foregroundStyle(Color.optaTextSecondary)
                }
            }

            Spacer()
        }
        .padding(OptaDesign.Spacing.sm)
        .background(rank == 1 ? Color.optaAmber.opacity(0.05) : Color.clear)
        .clipShape(RoundedRectangle(cornerRadius: OptaDesign.CornerRadius.small, style: .continuous))
    }
}

// MARK: - Analysis Card

private struct AnalysisCard: View {
    let markdown: String

    var body: some View {
        VStack(alignment: .leading, spacing: OptaDesign.Spacing.md) {
            HStack {
                Image(systemName: "doc.text")
                    .foregroundStyle(Color.optaBlue)
                Text("Full Analysis")
                    .font(.optaHeadline)
                    .foregroundStyle(Color.optaTextPrimary)
            }

            // Simplified markdown rendering
            Text(markdown)
                .font(.optaBody)
                .foregroundStyle(Color.optaTextPrimary)
                .lineSpacing(4)
        }
        .padding(OptaDesign.Spacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .glassContent()
    }
}

#Preview {
    ResultView(
        result: OptimizationResult(
            markdown: "Based on your criteria...",
            highlights: ["Best value", "Most nutritious"],
            rankings: [
                RankingItem(rank: 1, title: "Option A", description: "Best overall"),
                RankingItem(rank: 2, title: "Option B", description: "Good value")
            ]
        ),
        prompt: "best value for money",
        onNewScan: {},
        onShare: {}
    )
}
