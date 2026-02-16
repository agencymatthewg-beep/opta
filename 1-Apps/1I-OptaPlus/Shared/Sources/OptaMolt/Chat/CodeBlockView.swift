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
        .background(Color.optaCodeBackground)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(Color.optaBorder.opacity(0.3), lineWidth: 0.5)
        )
        .shadow(color: Color.black.opacity(0.2), radius: 8, y: 2)
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
            // Language badge with icon
            if let lang = language, !lang.isEmpty {
                HStack(spacing: 4) {
                    Image(systemName: languageIcon(for: lang))
                        .font(.system(size: 10))
                        .foregroundColor(.optaPrimary.opacity(0.7))
                    Text(lang.lowercased())
                        .font(.system(size: 11, weight: .medium, design: .monospaced))
                        .foregroundColor(.optaTextSecondary)
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(
                    RoundedRectangle(cornerRadius: 6)
                        .fill(Color.optaPrimary.opacity(0.08))
                        .overlay(
                            RoundedRectangle(cornerRadius: 6)
                                .stroke(Color.optaPrimary.opacity(0.12), lineWidth: 0.5)
                        )
                )
            }

            // Line numbers toggle
            if lineCount > 3 && !isStreaming {
                Button(action: { withAnimation(.optaSnap) { showLineNumbers.toggle() } }) {
                    Image(systemName: "list.number")
                        .font(.caption)
                        .foregroundColor(showLineNumbers ? .optaPrimary : .optaTextMuted)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(showLineNumbers ? "Hide line numbers" : "Show line numbers")
            }

            Spacer()

            // Line count badge (for non-trivial blocks)
            if lineCount > 5 && !isStreaming {
                Text("\(lineCount) lines")
                    .font(.system(size: 10))
                    .foregroundColor(.optaTextMuted)
            }

            // Streaming indicator
            if isStreaming {
                HStack(spacing: 4) {
                    ProgressView()
                        .scaleEffect(0.6)
                        .tint(.optaPrimary)
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

    /// SF Symbol icon for common languages
    private func languageIcon(for language: String) -> String {
        switch language.lowercased() {
        case "swift": return "swift"
        case "python", "py": return "chevron.left.forwardslash.chevron.right"
        case "javascript", "js", "typescript", "ts": return "curlybraces"
        case "html", "xml": return "chevron.left.slash.chevron.right"
        case "css", "scss": return "paintbrush"
        case "json": return "doc.text"
        case "bash", "sh", "shell", "zsh": return "terminal"
        case "rust", "rs": return "gearshape"
        case "go", "golang": return "arrow.right.arrow.left"
        case "sql": return "cylinder"
        case "markdown", "md": return "text.document"
        default: return "chevron.left.forwardslash.chevron.right"
        }
    }

    // MARK: - Copy Button

    @State private var copied = false
    @State private var copyScale: CGFloat = 1.0

    private var copyButton: some View {
        Button(action: {
            OptaFormatting.copyToClipboard(code)
            withAnimation(.optaSpring) {
                copied = true
                copyScale = 1.2
            }
            // Bounce back
            withAnimation(.optaSpring.delay(0.1)) {
                copyScale = 1.0
            }
            Task { @MainActor in
                try? await Task.sleep(for: .seconds(2.0))
                withAnimation(.optaSpring) {
                    copied = false
                }
            }
        }) {
            HStack(spacing: 4) {
                Image(systemName: copied ? "checkmark.circle.fill" : "doc.on.doc")
                    .font(.caption)
                    .contentTransition(.symbolEffect(.replace))
                Text(copied ? "Copied" : "Copy")
                    .font(.caption.weight(.medium))
            }
            .foregroundColor(copied ? .optaGreen : .optaTextSecondary)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(
                RoundedRectangle(cornerRadius: 6)
                    .fill(copied ? Color.optaGreen.opacity(0.12) : Color.clear)
            )
            .scaleEffect(copyScale)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(copied ? "Copied to clipboard" : "Copy code")
    }

    // MARK: - Code Content

    @State private var showLineNumbers: Bool = false

    private var codeLines: [String] {
        displayedCode.components(separatedBy: "\n")
    }

    private var codeContent: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(alignment: .top, spacing: 0) {
                if showLineNumbers {
                    VStack(alignment: .trailing, spacing: 0) {
                        ForEach(Array(codeLines.enumerated()), id: \.offset) { index, _ in
                            Text("\(index + 1)")
                                .font(.system(size: 11, design: .monospaced))
                                .foregroundColor(.optaTextMuted.opacity(0.3))
                                .frame(minWidth: lineCount >= 100 ? 36 : 28, alignment: .trailing)
                                .frame(height: 18)
                        }
                    }
                    .padding(.trailing, 10)
                    .padding(.leading, 4)
                    .overlay(alignment: .trailing) {
                        Rectangle()
                            .fill(Color.optaBorder.opacity(0.2))
                            .frame(width: 0.5)
                    }
                }

                Text(highlightedCode)
                    .font(.system(size: 13, design: .monospaced))
                    .textSelection(.enabled)
                    .fixedSize(horizontal: false, vertical: true)
            }
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
            .foregroundColor(.optaPrimary)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(isExpanded ? "Show less code" : "Show \(hiddenLineCount) more lines")
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
