//
//  ResultView.swift
//  Opta Scan
//
//  Optimization result display with rankings and shareable cards
//  Created by Matthew Byrden
//

import SwiftUI

// MARK: - Result View

/// Displays optimization results with highlights, rankings, and full analysis
struct ResultView: View {

    // MARK: - Properties

    let result: OptimizationResult
    let prompt: String
    let sourceImage: UIImage?
    let onNewScan: () -> Void
    let onShare: () -> Void

    // MARK: - State

    @State private var showShareSheet = false
    @State private var isVisible = false

    // MARK: - Constants

    private enum Layout {
        static let sourceImageMaxHeight: CGFloat = 200
    }

    // MARK: - Body

    var body: some View {
        ZStack {
            Color.optaBackground
                .ignoresSafeArea()

            ScrollView {
                VStack(spacing: OptaDesign.Spacing.lg) {
                    // Header Section
                    ResultHeader(prompt: prompt)
                        .opacity(isVisible ? 1 : 0)
                        .offset(y: isVisible ? 0 : 20)

                    // Source Image Section with pinch-to-zoom
                    if let image = sourceImage {
                        SourceImageCard(image: image, maxHeight: Layout.sourceImageMaxHeight)
                            .staggeredAppear(index: 1, isVisible: isVisible)
                    }

                    // Highlights Section
                    if !result.highlights.isEmpty {
                        HighlightsCard(highlights: result.highlights)
                            .staggeredAppear(index: sourceImage != nil ? 2 : 1, isVisible: isVisible)
                    }

                    // Rankings Section
                    if let rankings = result.rankings, !rankings.isEmpty {
                        RankingsCard(rankings: rankings)
                            .staggeredAppear(index: sourceImage != nil ? 3 : 2, isVisible: isVisible)
                    }

                    // Full Analysis Section
                    AnalysisCard(markdown: result.markdown)
                        .staggeredAppear(index: sourceImage != nil ? 4 : 3, isVisible: isVisible)

                    // Action Buttons
                    actionButtons
                        .padding(.top, OptaDesign.Spacing.md)
                        .staggeredAppear(index: sourceImage != nil ? 5 : 4, isVisible: isVisible)
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

    // MARK: - Subviews

    private var actionButtons: some View {
        HStack(spacing: OptaDesign.Spacing.md) {
            // Share Button
            Button {
                OptaHaptics.shared.tap()
                onShare()
            } label: {
                HStack(spacing: OptaDesign.Spacing.xs) {
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

            // New Scan Button
            Button {
                OptaHaptics.shared.buttonPress()
                onNewScan()
            } label: {
                HStack(spacing: OptaDesign.Spacing.xs) {
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
    }
}

// MARK: - Result Header

/// Header view displaying success icon and prompt
private struct ResultHeader: View {

    let prompt: String

    private enum Layout {
        static let iconSize: CGFloat = 40
    }

    var body: some View {
        VStack(spacing: OptaDesign.Spacing.sm) {
            Image(systemName: "sparkles")
                .font(.system(size: Layout.iconSize))
                .foregroundStyle(
                    LinearGradient(
                        colors: [Color.optaPurple, Color.optaBlue],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .accessibilityHidden(true)

            Text("Optimized!")
                .font(.optaTitle)
                .foregroundStyle(Color.optaTextPrimary)

            Text(prompt)
                .font(.optaCaption)
                .foregroundStyle(Color.optaTextSecondary)
                .multilineTextAlignment(.center)
        }
        .padding(.vertical, OptaDesign.Spacing.lg)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Optimization complete for: \(prompt)")
    }
}

// MARK: - Highlights Card

/// Card displaying key takeaways from the optimization
private struct HighlightsCard: View {

    let highlights: [String]

    private enum Layout {
        static let bulletSize: CGFloat = 6
        static let bulletTopPadding: CGFloat = 6
    }

    /// Combined text of all highlights for copy/share
    private var combinedHighlightsText: String {
        highlights.map { "- \($0)" }.joined(separator: "\n")
    }

    var body: some View {
        VStack(alignment: .leading, spacing: OptaDesign.Spacing.md) {
            // Header
            HStack(spacing: OptaDesign.Spacing.xs) {
                Image(systemName: "star.fill")
                    .foregroundStyle(Color.optaAmber)
                Text("Key Takeaways")
                    .font(.optaHeadline)
                    .foregroundStyle(Color.optaTextPrimary)
            }

            // Highlights List
            VStack(alignment: .leading, spacing: OptaDesign.Spacing.sm) {
                ForEach(Array(highlights.enumerated()), id: \.offset) { index, highlight in
                    HighlightRow(highlight: highlight, index: index)
                }
            }
        }
        .padding(OptaDesign.Spacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .glassContent()
        .contextMenu {
            Button {
                copyToClipboard(combinedHighlightsText)
            } label: {
                Label("Copy All", systemImage: "doc.on.doc")
            }

            Button {
                shareText("Key Takeaways:\n\(combinedHighlightsText)")
            } label: {
                Label("Share", systemImage: "square.and.arrow.up")
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Key Takeaways section with \(highlights.count) items")
    }
}

// MARK: - Highlight Row

/// Individual highlight row with context menu
private struct HighlightRow: View {

    let highlight: String
    let index: Int

    private enum Layout {
        static let bulletSize: CGFloat = 6
        static let bulletTopPadding: CGFloat = 6
    }

    var body: some View {
        HStack(alignment: .top, spacing: OptaDesign.Spacing.sm) {
            Circle()
                .fill(Color.optaPurple)
                .frame(width: Layout.bulletSize, height: Layout.bulletSize)
                .padding(.top, Layout.bulletTopPadding)
                .accessibilityHidden(true)

            Text(highlight)
                .font(.optaBody)
                .foregroundStyle(Color.optaTextPrimary)
        }
        .contextMenu {
            Button {
                copyToClipboard(highlight)
            } label: {
                Label("Copy", systemImage: "doc.on.doc")
            }

            Button {
                shareText(highlight)
            } label: {
                Label("Share", systemImage: "square.and.arrow.up")
            }
        }
        .accessibilityLabel("Takeaway \(index + 1): \(highlight)")
        .accessibilityActions {
            Button("Copy") {
                copyToClipboard(highlight)
            }
        }
    }
}

// MARK: - Rankings Card

/// Card displaying ranked recommendations
private struct RankingsCard: View {

    let rankings: [RankingItem]

    var body: some View {
        VStack(alignment: .leading, spacing: OptaDesign.Spacing.md) {
            // Header
            HStack(spacing: OptaDesign.Spacing.xs) {
                Image(systemName: "list.number")
                    .foregroundStyle(Color.optaPurple)
                Text("Recommendations")
                    .font(.optaHeadline)
                    .foregroundStyle(Color.optaTextPrimary)
            }

            // Rankings List
            VStack(spacing: OptaDesign.Spacing.sm) {
                ForEach(Array(rankings.enumerated()), id: \.offset) { index, item in
                    RankingRow(rank: index + 1, item: item)
                }
            }
        }
        .padding(OptaDesign.Spacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .glassContent()
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Recommendations section with \(rankings.count) ranked items")
    }
}

// MARK: - Ranking Row

/// Individual ranking row with medal-style badge and context menu
private struct RankingRow: View {

    let rank: Int
    let item: RankingItem

    private enum Layout {
        static let badgeSize: CGFloat = 32
        static let topRankHighlightOpacity: Double = 0.05
    }

    /// Medal color based on rank position
    private var medalColor: Color {
        switch rank {
        case 1: return Color.optaAmber           // Gold
        case 2: return Color.optaTextSecondary   // Silver
        case 3: return Color("BronzeMedal", bundle: nil) // Bronze fallback
        default: return Color.optaTextMuted
        }
    }

    /// Whether this is the top-ranked item
    private var isTopRank: Bool { rank == 1 }

    /// Full text representation for copying
    private var fullText: String {
        if let description = item.description {
            return "\(item.title): \(description)"
        }
        return item.title
    }

    var body: some View {
        HStack(spacing: OptaDesign.Spacing.md) {
            // Rank Badge
            ZStack {
                Circle()
                    .fill(medalColor.opacity(0.2))
                    .frame(width: Layout.badgeSize, height: Layout.badgeSize)

                Text("\(rank)")
                    .font(.optaCaption)
                    .fontWeight(.bold)
                    .foregroundStyle(medalColor)
            }
            .accessibilityHidden(true)

            // Content
            VStack(alignment: .leading, spacing: OptaDesign.Spacing.xxs) {
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
        .background(isTopRank ? Color.optaAmber.opacity(Layout.topRankHighlightOpacity) : Color.clear)
        .clipShape(RoundedRectangle(cornerRadius: OptaDesign.CornerRadius.small, style: .continuous))
        .contextMenu {
            Button {
                copyToClipboard(item.title)
            } label: {
                Label("Copy Name", systemImage: "doc.on.doc")
            }

            if item.description != nil {
                Button {
                    copyToClipboard(fullText)
                } label: {
                    Label("Copy All", systemImage: "doc.on.doc.fill")
                }
            }

            Button {
                shareText("#\(rank) \(fullText)")
            } label: {
                Label("Share", systemImage: "square.and.arrow.up")
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Rank \(rank): \(item.title). \(item.description ?? "")")
        .accessibilityActions {
            Button("Copy name") {
                copyToClipboard(item.title)
            }
        }
    }
}

// MARK: - Source Image Card

/// Card displaying the source image with pinch-to-zoom capability
private struct SourceImageCard: View {

    let image: UIImage
    let maxHeight: CGFloat

    var body: some View {
        VStack(alignment: .leading, spacing: OptaDesign.Spacing.md) {
            // Header
            HStack(spacing: OptaDesign.Spacing.xs) {
                Image(systemName: "photo")
                    .foregroundStyle(Color.optaPurple)
                Text("Source Image")
                    .font(.optaHeadline)
                    .foregroundStyle(Color.optaTextPrimary)
            }

            // Zoomable Image
            ZoomableImageView(
                image: image,
                cornerRadius: OptaDesign.CornerRadius.medium,
                maxHeight: maxHeight
            )
            .accessibilityLabel("Source image, double tap to zoom")
        }
        .padding(OptaDesign.Spacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .glassContent()
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Source Image section")
    }
}

// MARK: - Analysis Card

/// Card displaying the full markdown analysis with context menu
private struct AnalysisCard: View {

    let markdown: String

    private enum Layout {
        static let lineSpacing: CGFloat = 4
    }

    var body: some View {
        VStack(alignment: .leading, spacing: OptaDesign.Spacing.md) {
            // Header
            HStack(spacing: OptaDesign.Spacing.xs) {
                Image(systemName: "doc.text")
                    .foregroundStyle(Color.optaBlue)
                Text("Full Analysis")
                    .font(.optaHeadline)
                    .foregroundStyle(Color.optaTextPrimary)
            }

            // Markdown Content
            Text(markdown)
                .font(.optaBody)
                .foregroundStyle(Color.optaTextPrimary)
                .lineSpacing(Layout.lineSpacing)
                .textSelection(.enabled)
        }
        .padding(OptaDesign.Spacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .glassContent()
        .contextMenu {
            Button {
                copyToClipboard(markdown)
            } label: {
                Label("Copy Analysis", systemImage: "doc.on.doc")
            }

            Button {
                shareText("Full Analysis:\n\n\(markdown)")
            } label: {
                Label("Share", systemImage: "square.and.arrow.up")
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Full Analysis")
        .accessibilityActions {
            Button("Copy analysis") {
                copyToClipboard(markdown)
            }
        }
    }
}

// MARK: - Copy & Share Helpers

/// Copy text to the system clipboard with haptic feedback
private func copyToClipboard(_ text: String) {
    UIPasteboard.general.string = text
    OptaHaptics.shared.success()
}

/// Share text via the system share sheet
private func shareText(_ text: String) {
    OptaHaptics.shared.tap()

    let activityVC = UIActivityViewController(activityItems: [text], applicationActivities: nil)

    if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
       let rootVC = windowScene.windows.first?.rootViewController {
        // Handle iPad presentation
        activityVC.popoverPresentationController?.sourceView = rootVC.view
        activityVC.popoverPresentationController?.sourceRect = CGRect(
            x: rootVC.view.bounds.midX,
            y: rootVC.view.bounds.midY,
            width: 0,
            height: 0
        )
        activityVC.popoverPresentationController?.permittedArrowDirections = []

        rootVC.present(activityVC, animated: true)
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
        sourceImage: nil,
        onNewScan: {},
        onShare: {}
    )
}
