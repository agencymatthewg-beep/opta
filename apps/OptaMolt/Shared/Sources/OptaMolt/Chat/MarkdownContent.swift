//
//  MarkdownContent.swift
//  OptaMolt
//
//  Renders markdown content with support for inline formatting and lists.
//  Designed for streaming resilience - handles incomplete markdown gracefully.
//

import SwiftUI

// MARK: - Content Block Types

/// Represents a parsed block of markdown content
public enum ContentBlock: Equatable {
    /// A paragraph of text (may contain inline formatting)
    case paragraph(String)
    /// A bullet list with items
    case bulletList([String])
}

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

    /// Initialize with markdown content
    /// - Parameters:
    ///   - content: The markdown string to render
    ///   - textColor: Base color for text (default: optaTextPrimary)
    public init(content: String, textColor: Color = .optaTextPrimary) {
        self.content = content
        self.baseTextColor = textColor
    }

    public var body: some View {
        let blocks = parseBlocks(content)

        VStack(alignment: .leading, spacing: 8) {
            ForEach(Array(blocks.enumerated()), id: \.offset) { _, block in
                renderBlock(block)
            }
        }
    }

    // MARK: - Block Parsing

    /// Parse content into blocks (paragraphs and lists)
    /// - Parameter content: Raw markdown content
    /// - Returns: Array of ContentBlock
    func parseBlocks(_ content: String) -> [ContentBlock] {
        let sanitized = sanitizeForStreaming(content)
        let lines = sanitized.components(separatedBy: "\n")
        var blocks: [ContentBlock] = []
        var currentParagraph: [String] = []
        var currentBulletList: [String] = []

        for line in lines {
            let trimmed = line.trimmingCharacters(in: .whitespaces)

            if isBulletLine(trimmed) {
                // Flush any pending paragraph
                if !currentParagraph.isEmpty {
                    blocks.append(.paragraph(currentParagraph.joined(separator: "\n")))
                    currentParagraph = []
                }
                // Add to bullet list
                let bulletContent = extractBulletContent(trimmed)
                currentBulletList.append(bulletContent)
            } else {
                // Flush any pending bullet list
                if !currentBulletList.isEmpty {
                    blocks.append(.bulletList(currentBulletList))
                    currentBulletList = []
                }
                // Add to paragraph (or keep empty line as separator)
                if !trimmed.isEmpty {
                    currentParagraph.append(line)
                } else if !currentParagraph.isEmpty {
                    // Empty line ends paragraph
                    blocks.append(.paragraph(currentParagraph.joined(separator: "\n")))
                    currentParagraph = []
                }
            }
        }

        // Flush remaining content
        if !currentBulletList.isEmpty {
            blocks.append(.bulletList(currentBulletList))
        }
        if !currentParagraph.isEmpty {
            blocks.append(.paragraph(currentParagraph.joined(separator: "\n")))
        }

        // Handle empty content
        if blocks.isEmpty && !content.isEmpty {
            blocks.append(.paragraph(content))
        }

        return blocks
    }

    /// Check if a line is a bullet list item
    private func isBulletLine(_ line: String) -> Bool {
        line.hasPrefix("- ") || line.hasPrefix("* ") || line.hasPrefix("+ ")
    }

    /// Extract content after bullet marker
    private func extractBulletContent(_ line: String) -> String {
        if line.hasPrefix("- ") {
            return String(line.dropFirst(2))
        } else if line.hasPrefix("* ") {
            return String(line.dropFirst(2))
        } else if line.hasPrefix("+ ") {
            return String(line.dropFirst(2))
        }
        return line
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
        }
    }

    /// Render a paragraph with inline formatting
    private func renderParagraph(_ text: String) -> some View {
        styledText(text)
            .foregroundColor(baseTextColor)
    }

    /// Render a bullet list
    private func renderBulletList(_ items: [String]) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                renderBulletItem(item)
            }
        }
    }

    /// Render a single bullet item
    private func renderBulletItem(_ text: String) -> some View {
        HStack(alignment: .top, spacing: 8) {
            Circle()
                .fill(baseTextColor.opacity(0.6))
                .frame(width: 6, height: 6)
                .padding(.top, 7)  // Align with text baseline

            styledText(text)
                .foregroundColor(baseTextColor)
        }
    }

    // MARK: - Inline Formatting

    /// Create styled text with inline markdown formatting
    /// Uses AttributedString for bold, italic, and links
    /// Handles inline code separately with custom styling
    private func styledText(_ text: String) -> Text {
        // First, handle inline code blocks which need special styling
        let segments = parseInlineCode(text)

        var result = Text("")
        for segment in segments {
            switch segment {
            case .text(let content):
                // Use AttributedString for bold/italic/links
                if let attributed = try? AttributedString(markdown: content) {
                    result = result + Text(attributed)
                } else {
                    result = result + Text(content)
                }
            case .code(let code):
                // Monospace styling for inline code
                result = result + Text(code)
                    .font(.system(.body, design: .monospaced))
                    .foregroundColor(.optaPurple)
            }
        }

        return result
    }

    /// Segment type for inline code parsing
    private enum TextSegment {
        case text(String)
        case code(String)
    }

    /// Parse inline code blocks from text
    private func parseInlineCode(_ text: String) -> [TextSegment] {
        var segments: [TextSegment] = []
        var remaining = text

        while !remaining.isEmpty {
            // Find opening backtick
            if let openRange = remaining.range(of: "`") {
                // Add text before backtick
                let beforeText = String(remaining[..<openRange.lowerBound])
                if !beforeText.isEmpty {
                    segments.append(.text(beforeText))
                }

                // Look for closing backtick
                let afterOpen = remaining[openRange.upperBound...]
                if let closeRange = afterOpen.range(of: "`") {
                    // Found matching backtick - extract code
                    let codeContent = String(afterOpen[..<closeRange.lowerBound])
                    segments.append(.code(codeContent))
                    remaining = String(afterOpen[closeRange.upperBound...])
                } else {
                    // No closing backtick - treat as text (streaming resilience)
                    segments.append(.text("`" + String(afterOpen)))
                    remaining = ""
                }
            } else {
                // No more backticks - add remaining as text
                segments.append(.text(remaining))
                remaining = ""
            }
        }

        return segments
    }

    // MARK: - Streaming Resilience

    /// Sanitize content for streaming - handle incomplete markdown gracefully
    /// - Parameter content: Raw content that may have incomplete markdown
    /// - Returns: Content safe for rendering
    func sanitizeForStreaming(_ content: String) -> String {
        var result = content

        // Handle incomplete bold markers
        result = handleIncompleteMarkers(result, marker: "**")
        result = handleIncompleteMarkers(result, marker: "__")

        // Handle incomplete italic markers (single)
        // Note: single asterisks/underscores are tricky - only handle obvious cases
        result = handleSingleMarker(result, marker: "*")
        result = handleSingleMarker(result, marker: "_")

        // Handle incomplete links [text](url
        result = handleIncompleteLinks(result)

        return result
    }

    /// Handle markers that should appear in pairs (bold)
    private func handleIncompleteMarkers(_ text: String, marker: String) -> String {
        let count = text.components(separatedBy: marker).count - 1
        if count % 2 != 0 {
            // Odd number of markers - escape the last one
            if let lastRange = text.range(of: marker, options: .backwards) {
                var modified = text
                modified.replaceSubrange(lastRange, with: "")
                return modified
            }
        }
        return text
    }

    /// Handle single character markers (italic)
    private func handleSingleMarker(_ text: String, marker: String) -> String {
        // Count markers that aren't part of double markers
        let doubleMarker = marker + marker
        let withoutDouble = text.replacingOccurrences(of: doubleMarker, with: "")

        var count = 0
        var i = withoutDouble.startIndex
        while i < withoutDouble.endIndex {
            if withoutDouble[i] == Character(marker) {
                // Check it's not escaped
                if i == withoutDouble.startIndex || withoutDouble[withoutDouble.index(before: i)] != "\\" {
                    count += 1
                }
            }
            i = withoutDouble.index(after: i)
        }

        // If odd count in original (accounting for doubles), we have incomplete italic
        // For simplicity, just let AttributedString handle it gracefully
        return text
    }

    /// Handle incomplete link syntax
    private func handleIncompleteLinks(_ text: String) -> String {
        // Check for incomplete link pattern [text](url...
        // If we have [ without matching ], or [text]( without ), show as plain text

        var result = text

        // Find unmatched [ that starts a link
        var openBrackets = 0
        var lastOpenIndex: String.Index?
        var i = result.startIndex

        while i < result.endIndex {
            let char = result[i]
            if char == "[" {
                openBrackets += 1
                lastOpenIndex = i
            } else if char == "]" {
                if openBrackets > 0 {
                    openBrackets -= 1
                    // Check if this is followed by incomplete link
                    let nextIndex = result.index(after: i)
                    if nextIndex < result.endIndex && result[nextIndex] == "(" {
                        // Look for closing )
                        var parenIndex = result.index(after: nextIndex)
                        var foundClose = false
                        while parenIndex < result.endIndex {
                            if result[parenIndex] == ")" {
                                foundClose = true
                                break
                            }
                            parenIndex = result.index(after: parenIndex)
                        }
                        if !foundClose {
                            // Incomplete link - escape the opening bracket
                            if let openIdx = lastOpenIndex {
                                result.insert(contentsOf: "\\", at: openIdx)
                                // Reset iteration
                                i = result.startIndex
                                openBrackets = 0
                                lastOpenIndex = nil
                                continue
                            }
                        }
                    }
                }
            }
            i = result.index(after: i)
        }

        return result
    }
}

// MARK: - Preview

#if DEBUG
struct MarkdownContent_Previews: PreviewProvider {
    static var previews: some View {
        VStack(alignment: .leading, spacing: 20) {
            // Basic formatting
            MarkdownContent(content: "**Bold** and *italic* text")

            // Inline code
            MarkdownContent(content: "Use `print()` to debug")

            // Links
            MarkdownContent(content: "Visit [Apple](https://apple.com) for more")

            // Bullet list
            MarkdownContent(content: """
                Features:
                - Fast rendering
                - Streaming support
                - Beautiful styling
                """)

            // Mixed content
            MarkdownContent(content: """
                Here's a **bold** statement with `code`.

                Key points:
                - First *important* item
                - Second item with `inline code`
                - Third item

                That's all!
                """)

            // Streaming incomplete (shouldn't crash)
            MarkdownContent(content: "This is **incomplete bold")
            MarkdownContent(content: "This is [incomplete link](http://")
        }
        .padding()
        .background(Color.optaBackground)
        .previewLayout(.sizeThatFits)
    }
}
#endif
