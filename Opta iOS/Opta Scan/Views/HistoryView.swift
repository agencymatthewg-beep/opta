//
//  HistoryView.swift
//  Opta Scan
//
//  History screen showing past scans with search and detail view
//  Created by Matthew Byrden
//

import SwiftUI

// MARK: - History View

/// Main history screen displaying past optimization scans
struct HistoryView: View {

    // MARK: - State

    @StateObject private var historyManager = HistoryManager()
    @State private var selectedScan: ScanEntity?

    // MARK: - Body

    var body: some View {
        NavigationStack {
            ZStack {
                Color.optaBackground
                    .ignoresSafeArea()

                if historyManager.scans.isEmpty && historyManager.searchText.isEmpty {
                    // Empty State
                    EmptyHistoryView()
                } else {
                    // Scan List
                    scanList
                }
            }
            .navigationTitle("History")
            .navigationBarTitleDisplayMode(.large)
            .toolbarBackground(Color.optaBackground, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .searchable(text: $historyManager.searchText, prompt: "Search scans")
            .onChange(of: historyManager.searchText) { _, _ in
                historyManager.fetchScans()
            }
            .sheet(item: $selectedScan) { scan in
                HistoryDetailView(scan: scan)
            }
        }
    }

    // MARK: - Subviews

    private var scanList: some View {
        ScrollView {
            LazyVStack(spacing: OptaDesign.Spacing.md) {
                ForEach(Array(historyManager.scans.enumerated()), id: \.element.id) { index, scan in
                    HistoryCard(scan: scan) {
                        OptaHaptics.shared.tap()
                        selectedScan = scan
                    }
                    .swipeActions(
                        leading: [
                            SwipeAction(
                                icon: scan.isFavorite ? "star.fill" : "star",
                                color: .optaAmber,
                                action: { historyManager.toggleFavorite(scan) }
                            )
                        ],
                        trailing: [
                            SwipeAction(
                                icon: "trash.fill",
                                color: .optaRed,
                                isDestructive: true,
                                action: { historyManager.deleteScan(scan) }
                            )
                        ]
                    )
                    .staggeredAppear(index: index, isVisible: true)
                    .contextMenu {
                        Button {
                            OptaHaptics.shared.success()
                            historyManager.toggleFavorite(scan)
                        } label: {
                            Label(
                                scan.isFavorite ? "Remove from Favorites" : "Add to Favorites",
                                systemImage: scan.isFavorite ? "star.slash" : "star"
                            )
                        }

                        Button(role: .destructive) {
                            OptaHaptics.shared.warning()
                            historyManager.deleteScan(scan)
                        } label: {
                            Label("Delete", systemImage: "trash")
                        }
                    }
                    .accessibilityLabel("Scan: \(scan.prompt ?? "Untitled")\(scan.isFavorite ? ", favorited" : "")")
                    .accessibilityHint("Double tap to view scan details. Swipe right to favorite. Swipe left to delete.")
                    .accessibilityActions {
                        Button(scan.isFavorite ? "Remove from favorites" : "Add to favorites") {
                            historyManager.toggleFavorite(scan)
                        }
                        Button("Delete", role: .destructive) {
                            historyManager.deleteScan(scan)
                        }
                    }
                }
            }
            .padding(OptaDesign.Spacing.lg)
        }
    }
}

// MARK: - Empty History View

/// Placeholder view shown when no scans exist
private struct EmptyHistoryView: View {

    private enum Layout {
        static let iconSize: CGFloat = 48
    }

    var body: some View {
        VStack(spacing: OptaDesign.Spacing.lg) {
            Image(systemName: "clock")
                .font(.system(size: Layout.iconSize, weight: .light))
                .foregroundStyle(Color.optaTextMuted)
                .accessibilityHidden(true)

            VStack(spacing: OptaDesign.Spacing.xs) {
                Text("No scans yet")
                    .optaHeadlineStyle()

                Text("Your optimization history will appear here")
                    .optaCaptionStyle()
                    .multilineTextAlignment(.center)
            }
        }
        .padding(.horizontal, OptaDesign.Spacing.xl)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("No scans yet. Your optimization history will appear here.")
    }
}

// MARK: - History Card

/// Card displaying a single scan in the history list
private struct HistoryCard: View {

    let scan: ScanEntity
    let onTap: () -> Void

    private enum Layout {
        static let thumbnailSize: CGFloat = 60
        static let placeholderIconSize: CGFloat = 24
        static let chevronSize: CGFloat = 14
    }

    /// Display title with fallback
    private var displayTitle: String {
        scan.prompt ?? "Untitled"
    }

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: OptaDesign.Spacing.md) {
                // Thumbnail
                thumbnail

                // Content
                scanContent

                Spacer()

                // Chevron
                Image(systemName: "chevron.right")
                    .font(.system(size: Layout.chevronSize, weight: .medium))
                    .foregroundStyle(Color.optaTextMuted)
                    .accessibilityHidden(true)
            }
            .padding(OptaDesign.Spacing.md)
            .glassContent()
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private var thumbnail: some View {
        if let image = scan.image {
            Image(uiImage: image)
                .resizable()
                .aspectRatio(contentMode: .fill)
                .frame(width: Layout.thumbnailSize, height: Layout.thumbnailSize)
                .clipShape(RoundedRectangle(cornerRadius: OptaDesign.CornerRadius.small, style: .continuous))
                .accessibilityHidden(true)
        } else {
            ZStack {
                RoundedRectangle(cornerRadius: OptaDesign.CornerRadius.small, style: .continuous)
                    .fill(Color.optaSurface)
                    .frame(width: Layout.thumbnailSize, height: Layout.thumbnailSize)

                Image(systemName: "text.cursor")
                    .font(.system(size: Layout.placeholderIconSize))
                    .foregroundStyle(Color.optaTextMuted)
            }
            .accessibilityHidden(true)
        }
    }

    private var scanContent: some View {
        VStack(alignment: .leading, spacing: OptaDesign.Spacing.xxs) {
            Text(displayTitle)
                .font(.optaBody)
                .foregroundStyle(Color.optaTextPrimary)
                .lineLimit(1)

            if let firstHighlight = scan.highlights.first {
                Text(firstHighlight)
                    .font(.optaCaption)
                    .foregroundStyle(Color.optaTextSecondary)
                    .lineLimit(1)
            }

            if let date = scan.createdAt {
                Text(date, style: .relative)
                    .font(.optaLabel)
                    .foregroundStyle(Color.optaTextMuted)
            }
        }
    }
}

// MARK: - History Detail View

/// Detail view showing full scan information in a sheet
struct HistoryDetailView: View {

    // MARK: - Properties

    let scan: ScanEntity

    // MARK: - Environment

    @Environment(\.dismiss) private var dismiss

    // MARK: - Constants

    private enum Layout {
        static let imageMaxHeight: CGFloat = 300
        static let lineSpacing: CGFloat = 4
        static let bulletSize: CGFloat = 6
        static let bulletTopPadding: CGFloat = 6
    }

    // MARK: - Body

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: OptaDesign.Spacing.lg) {
                    // Image Section
                    if let image = scan.image {
                        Image(uiImage: image)
                            .resizable()
                            .aspectRatio(contentMode: .fit)
                            .frame(maxHeight: Layout.imageMaxHeight)
                            .clipShape(RoundedRectangle(cornerRadius: OptaDesign.CornerRadius.large, style: .continuous))
                            .accessibilityLabel("Scan image")
                    }

                    // Prompt Section
                    promptSection

                    // Highlights Section
                    if !scan.highlights.isEmpty {
                        highlightsSection
                    }

                    // Full Analysis Section
                    if let markdown = scan.resultMarkdown, !markdown.isEmpty {
                        analysisSection(markdown: markdown)
                    }
                }
                .padding(OptaDesign.Spacing.lg)
            }
            .background(Color.optaBackground)
            .navigationTitle("Scan Details")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }

    // MARK: - Subviews

    private var promptSection: some View {
        VStack(alignment: .leading, spacing: OptaDesign.Spacing.sm) {
            Text("Prompt")
                .font(.optaCaption)
                .foregroundStyle(Color.optaTextSecondary)

            Text(scan.prompt ?? "")
                .font(.optaHeadline)
                .foregroundStyle(Color.optaTextPrimary)
                .textSelection(.enabled)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(OptaDesign.Spacing.lg)
        .glassContent()
    }

    private var highlightsSection: some View {
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
                ForEach(scan.highlights, id: \.self) { highlight in
                    HStack(alignment: .top, spacing: OptaDesign.Spacing.sm) {
                        Circle()
                            .fill(Color.optaPurple)
                            .frame(width: Layout.bulletSize, height: Layout.bulletSize)
                            .padding(.top, Layout.bulletTopPadding)
                            .accessibilityHidden(true)

                        Text(highlight)
                            .font(.optaBody)
                            .foregroundStyle(Color.optaTextPrimary)
                            .textSelection(.enabled)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(OptaDesign.Spacing.lg)
        .glassContent()
    }

    private func analysisSection(markdown: String) -> some View {
        VStack(alignment: .leading, spacing: OptaDesign.Spacing.md) {
            // Header
            HStack(spacing: OptaDesign.Spacing.xs) {
                Image(systemName: "doc.text")
                    .foregroundStyle(Color.optaBlue)
                Text("Full Analysis")
                    .font(.optaHeadline)
                    .foregroundStyle(Color.optaTextPrimary)
            }

            // Content
            Text(markdown)
                .font(.optaBody)
                .foregroundStyle(Color.optaTextPrimary)
                .lineSpacing(Layout.lineSpacing)
                .textSelection(.enabled)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(OptaDesign.Spacing.lg)
        .glassContent()
    }
}

#Preview {
    HistoryView()
        .environment(\.managedObjectContext, PersistenceController.preview.container.viewContext)
}
