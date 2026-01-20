//
//  HistoryView.swift
//  Opta Scan
//
//  History screen showing past scans with search and detail view
//  Created by Matthew Byrden
//

import SwiftUI

struct HistoryView: View {

    @StateObject private var historyManager = HistoryManager()
    @State private var selectedScan: ScanEntity?

    var body: some View {
        NavigationStack {
            ZStack {
                Color.optaBackground
                    .ignoresSafeArea()

                if historyManager.scans.isEmpty && historyManager.searchText.isEmpty {
                    // Empty state
                    EmptyHistoryView()
                } else {
                    // Scan list
                    ScrollView {
                        LazyVStack(spacing: OptaDesign.Spacing.md) {
                            ForEach(Array(historyManager.scans.enumerated()), id: \.element.id) { index, scan in
                                HistoryCard(scan: scan) {
                                    OptaHaptics.shared.tap()
                                    selectedScan = scan
                                }
                                .staggeredAppear(index: index, isVisible: true)
                                .contextMenu {
                                    Button(role: .destructive) {
                                        OptaHaptics.shared.warning()
                                        historyManager.deleteScan(scan)
                                    } label: {
                                        Label("Delete", systemImage: "trash")
                                    }
                                }
                                .accessibilityLabel("Scan: \(scan.prompt ?? "Untitled")")
                                .accessibilityHint("Double tap to view scan details")
                            }
                        }
                        .padding(OptaDesign.Spacing.lg)
                    }
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
}

// MARK: - Empty History View

private struct EmptyHistoryView: View {
    var body: some View {
        VStack(spacing: OptaDesign.Spacing.lg) {
            Image(systemName: "clock")
                .font(.system(size: 48, weight: .light))
                .foregroundStyle(Color.optaTextMuted)

            VStack(spacing: OptaDesign.Spacing.xs) {
                Text("No scans yet")
                    .optaHeadlineStyle()

                Text("Your optimization history will appear here")
                    .optaCaptionStyle()
                    .multilineTextAlignment(.center)
            }
        }
        .padding(.horizontal, OptaDesign.Spacing.xl)
    }
}

// MARK: - History Card

private struct HistoryCard: View {
    let scan: ScanEntity
    var onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: OptaDesign.Spacing.md) {
                // Thumbnail or icon
                if let image = scan.image {
                    Image(uiImage: image)
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                        .frame(width: 60, height: 60)
                        .clipShape(RoundedRectangle(cornerRadius: OptaDesign.CornerRadius.small, style: .continuous))
                } else {
                    ZStack {
                        RoundedRectangle(cornerRadius: OptaDesign.CornerRadius.small, style: .continuous)
                            .fill(Color.optaSurface)
                            .frame(width: 60, height: 60)

                        Image(systemName: "text.cursor")
                            .font(.system(size: 24))
                            .foregroundStyle(Color.optaTextMuted)
                    }
                }

                // Content
                VStack(alignment: .leading, spacing: OptaDesign.Spacing.xxs) {
                    Text(scan.prompt ?? "Untitled")
                        .font(.optaBody)
                        .foregroundStyle(Color.optaTextPrimary)
                        .lineLimit(1)

                    if !scan.highlights.isEmpty {
                        Text(scan.highlights.first ?? "")
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

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(Color.optaTextMuted)
            }
            .padding(OptaDesign.Spacing.md)
            .glassContent()
        }
        .buttonStyle(.plain)
    }
}

// MARK: - History Detail View

struct HistoryDetailView: View {
    let scan: ScanEntity
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: OptaDesign.Spacing.lg) {
                    // Image if present
                    if let image = scan.image {
                        Image(uiImage: image)
                            .resizable()
                            .aspectRatio(contentMode: .fit)
                            .frame(maxHeight: 300)
                            .clipShape(RoundedRectangle(cornerRadius: OptaDesign.CornerRadius.large, style: .continuous))
                    }

                    // Prompt
                    VStack(alignment: .leading, spacing: OptaDesign.Spacing.sm) {
                        Text("Prompt")
                            .font(.optaCaption)
                            .foregroundStyle(Color.optaTextSecondary)

                        Text(scan.prompt ?? "")
                            .font(.optaHeadline)
                            .foregroundStyle(Color.optaTextPrimary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(OptaDesign.Spacing.lg)
                    .glassContent()

                    // Highlights
                    if !scan.highlights.isEmpty {
                        VStack(alignment: .leading, spacing: OptaDesign.Spacing.md) {
                            HStack {
                                Image(systemName: "star.fill")
                                    .foregroundStyle(Color.optaAmber)
                                Text("Key Takeaways")
                                    .font(.optaHeadline)
                                    .foregroundStyle(Color.optaTextPrimary)
                            }

                            VStack(alignment: .leading, spacing: OptaDesign.Spacing.sm) {
                                ForEach(scan.highlights, id: \.self) { highlight in
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
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(OptaDesign.Spacing.lg)
                        .glassContent()
                    }

                    // Full result
                    if let markdown = scan.resultMarkdown {
                        VStack(alignment: .leading, spacing: OptaDesign.Spacing.md) {
                            HStack {
                                Image(systemName: "doc.text")
                                    .foregroundStyle(Color.optaBlue)
                                Text("Full Analysis")
                                    .font(.optaHeadline)
                                    .foregroundStyle(Color.optaTextPrimary)
                            }

                            Text(markdown)
                                .font(.optaBody)
                                .foregroundStyle(Color.optaTextPrimary)
                                .lineSpacing(4)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(OptaDesign.Spacing.lg)
                        .glassContent()
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
}

#Preview {
    HistoryView()
        .environment(\.managedObjectContext, PersistenceController.preview.container.viewContext)
}
