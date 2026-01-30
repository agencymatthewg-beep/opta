//
//  CollapsibleSection.swift
//  OptaMolt
//
//  An expandable/collapsible content section with spring animations.
//  Used for <details>/<summary> HTML-style blocks in markdown content.
//
//  Design patterns:
//  - Uses optaSpring animation (0.3s response, 0.7 damping)
//  - SF Symbol chevron.right rotates 90 degrees on expand
//  - Full header area tappable via contentShape(Rectangle())
//

import SwiftUI

// MARK: - CollapsibleSection View

/// An expandable/collapsible content section with animated disclosure
///
/// Usage:
/// ```swift
/// CollapsibleSection(summary: "Click to expand") {
///     Text("Hidden content here")
/// }
///
/// // With default expanded state
/// CollapsibleSection(summary: "Already open", defaultExpanded: true) {
///     VStack {
///         Text("Line 1")
///         Text("Line 2")
///     }
/// }
/// ```
public struct CollapsibleSection<Content: View>: View {
    /// The summary text displayed in the header
    let summary: String

    /// Whether the section starts expanded
    let defaultExpanded: Bool

    /// Whether content is still streaming (disables collapse)
    let isStreaming: Bool

    /// The content to show when expanded
    @ViewBuilder let content: () -> Content

    /// Current expansion state
    @State private var isExpanded: Bool

    /// Initialize a collapsible section
    /// - Parameters:
    ///   - summary: Text to display in the header
    ///   - defaultExpanded: Whether section starts expanded (default: false)
    ///   - isStreaming: Whether content is streaming (disables collapse)
    ///   - content: ViewBuilder for the expandable content
    public init(
        summary: String,
        defaultExpanded: Bool = false,
        isStreaming: Bool = false,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.summary = summary
        self.defaultExpanded = defaultExpanded
        self.isStreaming = isStreaming
        self._isExpanded = State(initialValue: defaultExpanded)
        self.content = content
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Tappable header
            header
                .onTapGesture { toggle() }

            // Animated content reveal
            if isExpanded {
                content()
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .transition(.asymmetric(
                        insertion: .opacity.combined(with: .move(edge: .top)),
                        removal: .opacity
                    ))
            }
        }
        .background(Color.optaSurface)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.optaBorder.opacity(0.5), lineWidth: 1)
        )
    }

    // MARK: - Header View

    private var header: some View {
        HStack(spacing: 8) {
            // Rotating chevron indicator
            Image(systemName: "chevron.right")
                .font(.caption.weight(.semibold))
                .foregroundColor(.optaTextSecondary)
                .rotationEffect(.degrees(isExpanded ? 90 : 0))

            // Summary text
            Text(summary)
                .font(.subheadline.weight(.medium))
                .foregroundColor(.optaTextPrimary)
                .lineLimit(2)

            Spacer()

            // Expansion hint when collapsed
            if !isExpanded && !isStreaming {
                Text("Tap to expand")
                    .font(.caption)
                    .foregroundColor(.optaTextMuted)
            }

            // Streaming indicator
            if isStreaming {
                ProgressView()
                    .scaleEffect(0.7)
                    .tint(.optaPurple)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(Color.optaSurfaceElevated)
        .contentShape(Rectangle())  // Full area tappable
    }

    // MARK: - Actions

    /// Toggle expansion state with spring animation
    private func toggle() {
        // Don't allow collapse during streaming
        if isStreaming && isExpanded {
            return
        }

        withAnimation(.optaSpring) {
            isExpanded.toggle()
        }
    }
}

// MARK: - Streaming-Aware Variant

/// Collapsible section that shows loading state for incomplete content
public struct StreamingCollapsibleSection<Content: View>: View {
    let summary: String
    let defaultExpanded: Bool
    let isStreaming: Bool
    let hasContent: Bool
    @ViewBuilder let content: () -> Content

    @State private var isExpanded: Bool

    public init(
        summary: String,
        defaultExpanded: Bool = false,
        isStreaming: Bool = false,
        hasContent: Bool = true,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.summary = summary
        self.defaultExpanded = defaultExpanded
        self.isStreaming = isStreaming
        self.hasContent = hasContent
        self._isExpanded = State(initialValue: defaultExpanded || isStreaming)
        self.content = content
    }

    public var body: some View {
        CollapsibleSection(
            summary: summary,
            defaultExpanded: isExpanded,
            isStreaming: isStreaming
        ) {
            if hasContent {
                content()
            } else if isStreaming {
                // Show loading state for incomplete content
                HStack(spacing: 8) {
                    ProgressView()
                        .scaleEffect(0.8)
                        .tint(.optaTextMuted)
                    Text("Content loading...")
                        .font(.caption)
                        .foregroundColor(.optaTextMuted)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.vertical, 8)
            }
        }
    }
}

// MARK: - CollapsibleBlockView (MarkdownContent Integration)

/// A specialized collapsible view for rendering nested ContentBlocks
/// Used by MarkdownContent to render .collapsible cases
struct CollapsibleBlockView: View {
    let summary: String
    let content: [ContentBlock]
    let initiallyOpen: Bool
    let textColor: Color
    let isStreaming: Bool

    @State private var isExpanded: Bool

    init(
        summary: String,
        content: [ContentBlock],
        initiallyOpen: Bool,
        textColor: Color,
        isStreaming: Bool
    ) {
        self.summary = summary
        self.content = content
        self.initiallyOpen = initiallyOpen
        self.textColor = textColor
        self.isStreaming = isStreaming
        self._isExpanded = State(initialValue: initiallyOpen || isStreaming)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Tappable header
            header
                .onTapGesture { toggle() }

            // Animated content reveal
            if isExpanded {
                VStack(alignment: .leading, spacing: 8) {
                    if content.isEmpty && isStreaming {
                        // Show loading state for incomplete content
                        HStack(spacing: 8) {
                            ProgressView()
                                .scaleEffect(0.8)
                                .tint(.optaTextMuted)
                            Text("Content loading...")
                                .font(.caption)
                                .foregroundColor(.optaTextMuted)
                        }
                        .padding(.vertical, 8)
                    } else {
                        ForEach(content.indices, id: \.self) { index in
                            renderNestedBlock(content[index])
                        }
                    }
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .transition(.asymmetric(
                    insertion: .opacity.combined(with: .move(edge: .top)),
                    removal: .opacity
                ))
            }
        }
        .background(Color.optaSurface)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.optaBorder.opacity(0.5), lineWidth: 1)
        )
    }

    // MARK: - Header View

    private var header: some View {
        HStack(spacing: 8) {
            // Rotating chevron indicator
            Image(systemName: "chevron.right")
                .font(.caption.weight(.semibold))
                .foregroundColor(.optaTextSecondary)
                .rotationEffect(.degrees(isExpanded ? 90 : 0))

            // Summary text
            Text(summary)
                .font(.subheadline.weight(.medium))
                .foregroundColor(.optaTextPrimary)
                .lineLimit(2)

            Spacer()

            // Expansion hint when collapsed
            if !isExpanded && !isStreaming {
                Text("Tap to expand")
                    .font(.caption)
                    .foregroundColor(.optaTextMuted)
            }

            // Streaming indicator
            if isStreaming {
                ProgressView()
                    .scaleEffect(0.7)
                    .tint(.optaPurple)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(Color.optaSurfaceElevated)
        .contentShape(Rectangle())
    }

    // MARK: - Nested Block Rendering

    @ViewBuilder
    private func renderNestedBlock(_ block: ContentBlock) -> some View {
        switch block {
        case .paragraph(let text):
            Text(text)
                .foregroundColor(textColor)

        case .bulletList(let items):
            VStack(alignment: .leading, spacing: 4) {
                ForEach(items.indices, id: \.self) { index in
                    HStack(alignment: .top, spacing: 8) {
                        Circle()
                            .fill(textColor.opacity(0.6))
                            .frame(width: 6, height: 6)
                            .padding(.top, 7)
                        Text(items[index])
                            .foregroundColor(textColor)
                    }
                }
            }

        case .codeBlock(let code, let language):
            CodeBlockView(code: code, language: language, isStreaming: false)

        case .collapsible(let nestedSummary, let nestedContent, let nestedIsOpen):
            // Recursive nested collapsible
            CollapsibleBlockView(
                summary: nestedSummary,
                content: nestedContent,
                initiallyOpen: nestedIsOpen,
                textColor: textColor,
                isStreaming: isStreaming
            )

        case .table(let tableData):
            TableView(data: tableData, textColor: textColor)
        }
    }

    // MARK: - Actions

    private func toggle() {
        // Don't allow collapse during streaming
        if isStreaming && isExpanded {
            return
        }

        withAnimation(.optaSpring) {
            isExpanded.toggle()
        }
    }
}

// MARK: - Preview

#if DEBUG
struct CollapsibleSection_Previews: PreviewProvider {
    static var previews: some View {
        ScrollView {
            VStack(spacing: 16) {
                // Collapsed by default
                CollapsibleSection(summary: "Click to expand") {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("This is hidden content that appears when expanded.")
                            .foregroundColor(.optaTextPrimary)
                        Text("It can contain any SwiftUI views.")
                            .foregroundColor(.optaTextSecondary)
                    }
                }

                // Expanded by default
                CollapsibleSection(summary: "Already expanded section", defaultExpanded: true) {
                    VStack(alignment: .leading, spacing: 4) {
                        ForEach(1...5, id: \.self) { i in
                            Text("Line \(i)")
                                .foregroundColor(.optaTextPrimary)
                        }
                    }
                }

                // Streaming state
                CollapsibleSection(summary: "Streaming content", defaultExpanded: true, isStreaming: true) {
                    Text("Content is being loaded...")
                        .foregroundColor(.optaTextSecondary)
                }

                // Long summary
                CollapsibleSection(summary: "This is a very long summary that might wrap to multiple lines on smaller screens") {
                    Text("Short content")
                        .foregroundColor(.optaTextPrimary)
                }

                // Nested collapsible
                CollapsibleSection(summary: "Outer section") {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Outer content")
                            .foregroundColor(.optaTextPrimary)

                        CollapsibleSection(summary: "Nested section") {
                            Text("Nested content")
                                .foregroundColor(.optaTextSecondary)
                        }
                    }
                }
            }
            .padding()
        }
        .background(Color.optaBackground)
    }
}
#endif
