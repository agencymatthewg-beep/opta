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
    /// A fenced code block with optional language hint
    case codeBlock(code: String, language: String?)
    /// A collapsible/expandable section with nested content
    case collapsible(summary: String, content: [ContentBlock], isOpen: Bool)
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

    /// Parse content into blocks (paragraphs, lists, code blocks, and collapsible sections)
    /// - Parameter content: Raw markdown content
    /// - Returns: Array of ContentBlock
    func parseBlocks(_ content: String) -> [ContentBlock] {
        // First, extract collapsible sections and replace with placeholders
        let (processedContent, collapsibleBlocks) = extractCollapsibleBlocks(content)

        let sanitized = sanitizeForStreaming(processedContent)
        let lines = sanitized.components(separatedBy: "\n")
        var blocks: [ContentBlock] = []
        var currentParagraph: [String] = []
        var currentBulletList: [String] = []
        var inCodeBlock = false
        var codeBlockLines: [String] = []
        var codeBlockLanguage: String?

        for line in lines {
            let trimmed = line.trimmingCharacters(in: .whitespaces)

            // Check for collapsible placeholder
            if trimmed.hasPrefix("__COLLAPSIBLE_PLACEHOLDER_") && trimmed.hasSuffix("__") {
                // Flush any pending content
                if !currentParagraph.isEmpty {
                    blocks.append(.paragraph(currentParagraph.joined(separator: "\n")))
                    currentParagraph = []
                }
                if !currentBulletList.isEmpty {
                    blocks.append(.bulletList(currentBulletList))
                    currentBulletList = []
                }

                // Extract index from placeholder
                let startIndex = trimmed.index(trimmed.startIndex, offsetBy: 26)
                let endIndex = trimmed.index(trimmed.endIndex, offsetBy: -2)
                if startIndex < endIndex,
                   let index = Int(trimmed[startIndex..<endIndex]),
                   index < collapsibleBlocks.count {
                    blocks.append(collapsibleBlocks[index])
                }
                continue
            }

            // Check for code block fences
            if trimmed.hasPrefix("```") {
                if inCodeBlock {
                    // End of code block
                    // Flush any pending content first
                    if !currentParagraph.isEmpty {
                        blocks.append(.paragraph(currentParagraph.joined(separator: "\n")))
                        currentParagraph = []
                    }
                    if !currentBulletList.isEmpty {
                        blocks.append(.bulletList(currentBulletList))
                        currentBulletList = []
                    }

                    blocks.append(.codeBlock(code: codeBlockLines.joined(separator: "\n"), language: codeBlockLanguage))
                    codeBlockLines = []
                    codeBlockLanguage = nil
                    inCodeBlock = false
                } else {
                    // Start of code block
                    // Flush any pending content
                    if !currentParagraph.isEmpty {
                        blocks.append(.paragraph(currentParagraph.joined(separator: "\n")))
                        currentParagraph = []
                    }
                    if !currentBulletList.isEmpty {
                        blocks.append(.bulletList(currentBulletList))
                        currentBulletList = []
                    }

                    inCodeBlock = true
                    let langPart = String(trimmed.dropFirst(3)).trimmingCharacters(in: .whitespaces)
                    codeBlockLanguage = langPart.isEmpty ? nil : langPart
                }
                continue
            }

            if inCodeBlock {
                codeBlockLines.append(line)
                continue
            }

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
        if inCodeBlock {
            // Unclosed code block during streaming - render what we have
            blocks.append(.codeBlock(code: codeBlockLines.joined(separator: "\n"), language: codeBlockLanguage))
        }
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

    /// Extract collapsible blocks from content and replace with placeholders
    /// - Parameter content: Raw content potentially containing <details> tags
    /// - Returns: Tuple of (processed content with placeholders, array of collapsible blocks)
    private func extractCollapsibleBlocks(_ content: String) -> (String, [ContentBlock]) {
        var result = content
        var collapsibleBlocks: [ContentBlock] = []

        // Pattern: <details>\s*<summary>Title</summary>Content</details>
        // Also handles optional "open" attribute: <details open>
        let pattern = #"<details(\s+open)?>\s*<summary>(.*?)</summary>([\s\S]*?)</details>"#

        guard let regex = try? NSRegularExpression(pattern: pattern, options: []) else {
            return (content, [])
        }

        // Find all matches (process from end to avoid index shifts)
        let range = NSRange(content.startIndex..., in: content)
        let matches = regex.matches(in: content, options: [], range: range)

        // Process matches in reverse order to maintain correct indices
        for match in matches.reversed() {
            guard let fullRange = Range(match.range, in: result),
                  let openAttrRange = Range(match.range(at: 1), in: result),
                  let summaryRange = Range(match.range(at: 2), in: result),
                  let contentRange = Range(match.range(at: 3), in: result) else {
                // Try without open attribute
                guard let fullRange = Range(match.range, in: result),
                      let summaryRange = Range(match.range(at: 2), in: result),
                      let contentRange = Range(match.range(at: 3), in: result) else {
                    continue
                }

                let summary = String(result[summaryRange]).trimmingCharacters(in: .whitespacesAndNewlines)
                let innerContent = String(result[contentRange]).trimmingCharacters(in: .whitespacesAndNewlines)

                // Parse nested content recursively
                let nestedBlocks = parseNestedContent(innerContent)

                let collapsibleBlock = ContentBlock.collapsible(
                    summary: summary,
                    content: nestedBlocks,
                    isOpen: false
                )

                let placeholderIndex = collapsibleBlocks.count
                collapsibleBlocks.insert(collapsibleBlock, at: 0)
                result.replaceSubrange(fullRange, with: "__COLLAPSIBLE_PLACEHOLDER_\(placeholderIndex)__")
                continue
            }

            let isOpen = !result[openAttrRange].isEmpty
            let summary = String(result[summaryRange]).trimmingCharacters(in: .whitespacesAndNewlines)
            let innerContent = String(result[contentRange]).trimmingCharacters(in: .whitespacesAndNewlines)

            // Parse nested content recursively
            let nestedBlocks = parseNestedContent(innerContent)

            let collapsibleBlock = ContentBlock.collapsible(
                summary: summary,
                content: nestedBlocks,
                isOpen: isOpen
            )

            let placeholderIndex = collapsibleBlocks.count
            collapsibleBlocks.insert(collapsibleBlock, at: 0)
            result.replaceSubrange(fullRange, with: "__COLLAPSIBLE_PLACEHOLDER_\(placeholderIndex)__")
        }

        return (result, collapsibleBlocks)
    }

    /// Parse nested content within collapsible sections
    /// - Parameter content: Inner content of collapsible block
    /// - Returns: Array of ContentBlock parsed from the content
    private func parseNestedContent(_ content: String) -> [ContentBlock] {
        // Create a temporary MarkdownContent to parse nested blocks
        // This handles recursive collapsible sections
        let tempView = MarkdownContent(content: content, textColor: baseTextColor)
        return tempView.parseBlocks(content)
    }

    /// Check if content has incomplete/partial collapsible blocks (during streaming)
    /// - Parameter content: Content to check
    /// - Returns: True if there's an unclosed <details> tag
    func isPartialCollapsible(_ content: String) -> Bool {
        let openCount = content.components(separatedBy: "<details").count - 1
        let closeCount = content.components(separatedBy: "</details>").count - 1
        return openCount > closeCount
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
