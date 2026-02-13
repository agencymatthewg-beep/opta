//
//  CodeBlockView.swift
//  OptaMolt
//
//  Renders fenced code blocks with syntax highlighting hints and auto-collapse
//  for long code. Uses monospace font and design system styling.
//
//  Features:
//  - Language hint badge in header
//  - Copy button for quick code copying
//  - Auto-collapse for code blocks > 15 lines
//  - Spring animations for expand/collapse
//  - Streaming indicator for partial code blocks
//

import SwiftUI
#if os(iOS)
import UIKit
#elseif os(macOS)
import AppKit
#endif

// MARK: - CodeBlockView

/// Renders a fenced code block with optional language hint and auto-collapse
///
/// Usage:
/// ```swift
/// CodeBlockView(code: "print(\"Hello\")", language: "swift")
///
/// // With streaming state
/// CodeBlockView(code: "partial code...", language: nil, isStreaming: true)
/// ```
public struct CodeBlockView: View {
    /// The code content to display
    let code: String

    /// Optional language hint (e.g., "swift", "python")
    let language: String?

    /// Whether this code block is still streaming content
    let isStreaming: Bool

    /// Threshold for auto-collapse (lines)
    private let autoCollapseThreshold: Int = 15

    /// Expansion state for long code blocks
    @State private var isExpanded: Bool = false

    /// Initialize a code block view
    /// - Parameters:
    ///   - code: The code content
    ///   - language: Optional language identifier for syntax hint
    ///   - isStreaming: Whether content is still being received
    public init(code: String, language: String?, isStreaming: Bool = false) {
        self.code = code
        self.language = language
        self.isStreaming = isStreaming
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header with language and actions
            header

            // Code content
            codeContent
                .padding(.horizontal, 12)
                .padding(.vertical, 8)

            // Show more/less button for long code
            if shouldAutoCollapse {
                expandFooter
            }
        }
        .background(Color.optaSurface)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.optaBorder.opacity(0.5), lineWidth: 1)
        )
    }

    // MARK: - Computed Properties

    /// Whether the code should be auto-collapsed
    private var shouldAutoCollapse: Bool {
        lineCount > autoCollapseThreshold && !isStreaming
    }

    /// Total line count
    private var lineCount: Int {
        code.components(separatedBy: .newlines).count
    }

    /// Code to display (truncated or full)
    private var displayedCode: String {
        if shouldAutoCollapse && !isExpanded {
            return truncatedCode
        }
        return code
    }

    /// Truncated code for collapsed view
    private var truncatedCode: String {
        let lines = code.components(separatedBy: .newlines)
        return lines.prefix(autoCollapseThreshold).joined(separator: "\n")
    }

    /// Lines hidden when collapsed
    private var hiddenLineCount: Int {
        lineCount - autoCollapseThreshold
    }

    // MARK: - Header View

    private var header: some View {
        HStack(spacing: 8) {
            // Language badge
            if let lang = language, !lang.isEmpty {
                Text(lang)
                    .font(.caption.weight(.medium))
                    .foregroundColor(.optaTextSecondary)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.optaSurfaceElevated)
                    .clipShape(RoundedRectangle(cornerRadius: 6))
            }

            Spacer()

            // Streaming indicator
            if isStreaming {
                HStack(spacing: 4) {
                    ProgressView()
                        .scaleEffect(0.6)
                        .tint(.optaPurple)
                    Text("Streaming...")
                        .font(.caption)
                        .foregroundColor(.optaTextMuted)
                }
            }

            // Copy button
            if !isStreaming {
                copyButton
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(Color.optaSurfaceElevated)
    }

    // MARK: - Copy Button

    @State private var copied = false

    private var copyButton: some View {
        Button(action: copyToClipboard) {
            HStack(spacing: 4) {
                Image(systemName: copied ? "checkmark" : "doc.on.doc")
                    .font(.caption)
                Text(copied ? "Copied!" : "Copy")
                    .font(.caption)
            }
            .foregroundColor(copied ? .optaGreen : .optaTextSecondary)
        }
        .buttonStyle(.plain)
    }

    private func copyToClipboard() {
        #if os(iOS)
        UIPasteboard.general.string = code
        #elseif os(macOS)
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(code, forType: .string)
        #endif

        withAnimation(.optaSpring) {
            copied = true
        }

        // Reset after delay
        Task { @MainActor in
            try? await Task.sleep(for: .seconds(2))
            withAnimation(.optaSpring) {
                copied = false
            }
        }
    }

    // MARK: - Code Content

    private var codeContent: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            Text(highlightedCode)
                .textSelection(.enabled)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    /// Get syntax-highlighted attributed string for the displayed code
    private var highlightedCode: AttributedString {
        let effectiveLanguage = language ?? SyntaxHighlighter.detectLanguage(from: code)
        return SyntaxHighlighter.highlight(displayedCode, language: effectiveLanguage)
    }

    // MARK: - Expand Footer

    private var expandFooter: some View {
        Button(action: toggleExpand) {
            HStack(spacing: 4) {
                Text(isExpanded ? "Show less" : "Show \(hiddenLineCount) more lines")
                Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
            }
            .font(.caption)
            .foregroundColor(.optaPurple)
        }
        .buttonStyle(.plain)
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .frame(maxWidth: .infinity, alignment: .center)
        .background(Color.optaSurfaceElevated)
    }

    private func toggleExpand() {
        withAnimation(.optaSpring) {
            isExpanded.toggle()
        }
    }
}

// MARK: - Preview

#if DEBUG
struct CodeBlockView_Previews: PreviewProvider {
    static var previews: some View {
        ScrollView {
            VStack(spacing: 16) {
                // Short code block
                CodeBlockView(
                    code: "print(\"Hello, World!\")",
                    language: "swift"
                )

                // Code block with no language
                CodeBlockView(
                    code: "npm install\nnpm run dev",
                    language: nil
                )

                // Long code block (auto-collapse)
                CodeBlockView(
                    code: (1...25).map { "// Line \($0)\nlet value\($0) = \($0)" }.joined(separator: "\n"),
                    language: "swift"
                )

                // Streaming code block
                CodeBlockView(
                    code: "func calculate() {\n    // still typing...",
                    language: "swift",
                    isStreaming: true
                )
            }
            .padding()
        }
        .background(Color.optaBackground)
    }
}
#endif
