//
//  MarkdownContent.swift
//  OptaMolt
//
//  Renders markdown content with support for inline formatting and lists.
//  Designed for streaming resilience - handles incomplete markdown gracefully.
//
//  Block parsing is in MarkdownParser.swift.
//  Inline formatting is in MarkdownInline.swift.
//

import SwiftUI

// MARK: - MarkdownContent View

/// Renders markdown content with support for inline formatting and lists
///
/// Supported markdown:
/// - **Bold**: `**text**` or `__text__`
/// - *Italic*: `*text*` or `_text_`
/// - `Inline code`: `` `code` ``
/// - [Links](url): `[text](url)`
/// - Bullet lists: lines starting with `- `, `* `, or `+ `
///
/// Usage:
/// ```swift
/// MarkdownContent(content: "**Bold** and *italic* text", textColor: .optaTextPrimary)
/// ```
public struct MarkdownContent: View {
    /// The raw markdown content to render
    let content: String

    /// Base text color for non-formatted text
    let baseTextColor: Color

    /// Whether the content is currently streaming (affects code block rendering)
    let isStreaming: Bool

    /// Per-instance parse cache — avoids redundant parsing when content hasn't changed.
    /// Using a reference-type cache so @State isn't needed (it survives view re-init
    /// as long as SwiftUI reuses the same identity, which it does for streaming updates).
    let parseCache = MarkdownParseCache()

    /// Initialize with markdown content
    /// - Parameters:
    ///   - content: The markdown string to render
    ///   - textColor: Base color for text (default: optaTextPrimary)
    ///   - isStreaming: Whether content is actively streaming (default: false)

    public init(content: String, textColor: Color = .optaTextPrimary, isStreaming: Bool = false) {
        self.content = content
        self.baseTextColor = textColor
        self.isStreaming = isStreaming
    }

    @State private var blocks: [ContentBlock] = []

    public var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(Array(blocks.enumerated()), id: \.offset) { _, block in
                renderBlock(block)
            }
        }
        .textSelection(.enabled)
        .onAppear {
            blocks = cachedParseBlocks(content)
        }
        .onChange(of: content) { _, newContent in
            blocks = cachedParseBlocks(newContent)
        }
    }

    /// Parse blocks with caching — returns cached result if content hasn't changed.
    private func cachedParseBlocks(_ content: String) -> [ContentBlock] {
        if let cached = parseCache.lookup(content) {
            return cached
        }
        let result = parseBlocks(content)
        parseCache.store(content, blocks: result)
        return result
    }

    // MARK: - Block Rendering

    /// Render a content block
    @ViewBuilder
    private func renderBlock(_ block: ContentBlock) -> some View {
        switch block {
        case .paragraph(let text):
            renderParagraph(text)
        case .bulletList(let items):
            renderBulletList(items)
        case .numberedList(let items):
            renderNumberedList(items)
        case .blockQuote(let text):
            renderBlockQuote(text)
        case .heading(let level, let text):
            renderHeading(level: level, text: text)
        case .horizontalRule:
            renderHorizontalRule()
        case .codeBlock(let code, let language):
            let isPartialBlock = isStreaming && MarkdownContent.hasPartialCodeBlock(content)
            CodeBlockView(code: code, language: language, isStreaming: isPartialBlock)
                .padding(.vertical, 4)
        case .collapsible(let summary, let nestedContent, let isOpen):
            CollapsibleBlockView(
                summary: summary,
                content: nestedContent,
                initiallyOpen: isOpen,
                textColor: baseTextColor,
                isStreaming: isStreaming
            )
            .padding(.vertical, 4)
        case .table(let data):
            TableView(data: data, textColor: baseTextColor)
                .padding(.vertical, 4)
        case .chart(let chartData):
            ChartView(data: chartData)
                .padding(.vertical, 8)
        case .image(let data):
            AsyncImageView(data: data)
                .padding(.vertical, 4)
        }
    }

    /// Render a paragraph with inline formatting
    private func renderParagraph(_ text: String) -> some View {
        styledText(text)
            .foregroundColor(baseTextColor)
    }

    /// Render a heading
    private func renderHeading(level: Int, text: String) -> some View {
        let fontSize: CGFloat = level == 1 ? 24 : level == 2 ? 20 : level == 3 ? 17 : level == 4 ? 15 : 14
        let weight: Font.Weight = level <= 2 ? .bold : level <= 4 ? .semibold : .medium
        return styledText(text)
            .font(.system(size: fontSize, weight: weight))
            .foregroundColor(baseTextColor)
            .padding(.top, level <= 2 ? 4 : 2)
    }

    /// Render a horizontal rule
    private func renderHorizontalRule() -> some View {
        Rectangle()
            .fill(Color.optaBorder)
            .frame(height: 1)
            .padding(.vertical, 8)
    }

    /// Render a block quote with left border bar
    private func renderBlockQuote(_ text: String) -> some View {
        HStack(alignment: .top, spacing: 0) {
            RoundedRectangle(cornerRadius: 1.5)
                .fill(Color.optaPrimary)
                .frame(width: 3)

            styledText(text)
                .italic()
                .foregroundColor(baseTextColor.opacity(0.85))
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 6)
                .fill(Color.optaElevated.opacity(0.6))
        )
        .padding(.vertical, 2)
    }

    /// Render a bullet list with proper nesting and styled bullets
    private func renderBulletList(_ items: [BulletItem]) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                renderBulletItem(item)
            }
        }
    }

    /// Render a single bullet item with indent and styled bullet
    private func renderBulletItem(_ item: BulletItem) -> some View {
        HStack(alignment: .top, spacing: 8) {
            // Bullet dot — optaPrimary colored
            Circle()
                .fill(item.indentLevel == 0 ? Color.optaPrimary : Color.optaPrimary.opacity(0.6))
                .frame(width: item.indentLevel == 0 ? 6 : 5, height: item.indentLevel == 0 ? 6 : 5)
                .padding(.top, 7)

            styledText(item.content)
                .foregroundColor(baseTextColor)
        }
        .padding(.leading, CGFloat(item.indentLevel) * 16)
    }

    /// Render a numbered list with aligned numbers
    private func renderNumberedList(_ items: [NumberedItem]) -> some View {
        let maxNum = items.map(\.number).max() ?? 1
        let numWidth: CGFloat = maxNum >= 10 ? 24 : 16

        return VStack(alignment: .leading, spacing: 5) {
            ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                HStack(alignment: .top, spacing: 6) {
                    Text("\(item.number).")
                        .font(.system(size: 14, weight: .medium, design: .default))
                        .foregroundColor(.optaPrimary)
                        .frame(width: numWidth, alignment: .trailing)
                        .padding(.top, 1)

                    styledText(item.content)
                        .foregroundColor(baseTextColor)
                }
            }
        }
    }
}

// MARK: - Preview

#if DEBUG
struct MarkdownContent_Previews: PreviewProvider {
    static var previews: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // Basic formatting
                MarkdownContent(content: "**Bold** and *italic* text")

                // Strikethrough
                MarkdownContent(content: "This is ~~deleted~~ updated text")

                // Inline code
                MarkdownContent(content: "Use `print()` to debug and `let x = 42`")

                // Links
                MarkdownContent(content: "Visit [Apple](https://apple.com) for more")

                // Headings
                MarkdownContent(content: "# Heading 1\n## Heading 2\n### Heading 3")

                // Block quote
                MarkdownContent(content: "> This is a block quote with some **bold** text.\n> It can span multiple lines.")

                // Horizontal rule
                MarkdownContent(content: "Above the line\n\n---\n\nBelow the line")

                // Bullet list with nesting
                MarkdownContent(content: """
                    Features:
                    - Fast rendering
                      - Sub-feature one
                      - Sub-feature two
                    - Streaming support
                    - Beautiful styling
                    """)

                // Numbered list
                MarkdownContent(content: "1. First item\n2. Second item\n3. Third item")

                // Code block with language
                MarkdownContent(content: """
                    Here's some Swift code:

                    ```swift
                    func greet(name: String) -> String {
                        return "Hello, \\(name)!"
                    }
                    ```

                    That's it!
                    """)

                // Mixed content
                MarkdownContent(content: """
                    Here's a **bold** statement with `code`.

                    Key points:
                    - First *important* item
                    - Second item with `inline code`
                    - Third item

                    > Remember: always test your code!

                    That's all!
                    """)

                // Streaming code block (incomplete)
                MarkdownContent(
                    content: "```python\nprint('streaming",
                    isStreaming: true
                )

                // Streaming incomplete (shouldn't crash)
                MarkdownContent(content: "This is **incomplete bold")
                MarkdownContent(content: "This is [incomplete link](http://")
            }
            .padding()
        }
        .background(Color.optaBackground)
        .previewLayout(.sizeThatFits)
    }
}
#endif
