//
//  MarkdownContent.swift
//  OptaMolt
//
//  Renders markdown content with support for inline formatting and lists.
//  Designed for streaming resilience - handles incomplete markdown gracefully.
//

import os
import SwiftUI

// MARK: - Parse Cache

/// Thread-safe cache for parsed markdown blocks.
/// Avoids redundant parsing during streaming where onChange fires
/// on every keystroke but the content may not have meaningfully changed.
///
/// Uses `OSAllocatedUnfairLock` to protect mutable state so that concurrent
/// streaming updates from multiple bots cannot corrupt the dictionary.
/// This is preferred over `actor` because the cache is accessed synchronously
/// during view rendering (onAppear / onChange).
private final class MarkdownParseCache: @unchecked Sendable {
    /// Cache entry: the input string's identity (count + hash) and the parsed result
    private struct Entry {
        let count: Int
        let hash: Int
        let blocks: [ContentBlock]
    }

    private let lock = OSAllocatedUnfairLock<Entry?>(initialState: nil)

    /// Returns cached blocks if the content matches, otherwise nil.
    func lookup(_ content: String) -> [ContentBlock]? {
        lock.withLock { entry in
            guard let e = entry,
                  e.count == content.count,
                  e.hash == content.hashValue else {
                return nil
            }
            return e.blocks
        }
    }

    /// Stores a parsed result for the given content.
    func store(_ content: String, blocks: [ContentBlock]) {
        lock.withLock { entry in
            entry = Entry(count: content.count, hash: content.hashValue, blocks: blocks)
        }
    }
}

// MARK: - Cached Regex Helpers

/// Pre-compiled regexes used by MarkdownContent parsing.
/// Compiled once as static lets to avoid re-creation on every parse call.
private enum MarkdownRegexCache {
    /// Collapsible <details> block pattern
    static let collapsible: NSRegularExpression? = {
        let pattern = #"<details(\s+open)?>\s*<summary>(.*?)</summary>([\s\S]*?)</details>"#
        return try? NSRegularExpression(pattern: pattern, options: [])
    }()

    /// Markdown image pattern: ![alt](url "title")
    static let image: NSRegularExpression? = {
        let pattern = #"!\[(.*?)\]\((\S+?)(?:\s+["\'](.+?)["\']\s*)?\)"#
        return try? NSRegularExpression(pattern: pattern, options: [])
    }()
}

// MARK: - Image Data Model

/// Represents parsed image data from markdown
public struct ImageData: Equatable, Sendable {
    /// The image URL (remote URL or data URL)
    public let url: URL
    /// Alternative text for accessibility
    public let altText: String
    /// Optional caption (from markdown title)
    public let caption: String?

    public init(url: URL, altText: String, caption: String? = nil) {
        self.url = url
        self.altText = altText
        self.caption = caption
    }
}

// MARK: - Table Data Model

/// Represents parsed table data from markdown
public struct TableData: Equatable, Sendable {
    /// Column headers
    public let headers: [String]
    /// Table rows (each row is an array of cell values)
    public let rows: [[String]]
    /// Column alignments (one per column)
    public let alignments: [TableAlignment]

    /// Column alignment options
    public enum TableAlignment: Equatable, Sendable {
        case left
        case center
        case right
    }

    public init(headers: [String], rows: [[String]], alignments: [TableAlignment]) {
        self.headers = headers
        self.rows = rows
        self.alignments = alignments
    }
}

// MARK: - Chart Data Model

/// Represents parsed chart data from JSON in code blocks
public struct ChartData: Equatable, Codable, Sendable {
    /// The type of chart to render
    public let type: ChartType
    /// Optional chart title
    public let title: String?
    /// Data points for the chart
    public let data: [ChartDataPoint]

    /// Chart type options
    public enum ChartType: String, Codable, Equatable, Sendable {
        case bar
        case line
        case pie
    }

    /// A single data point in the chart
    public struct ChartDataPoint: Equatable, Codable, Sendable {
        /// Label for this data point (category name)
        public let label: String
        /// Numeric value for this data point
        public let value: Double
        /// Optional hex color (e.g., "#FF5733")
        public let color: String?

        public init(label: String, value: Double, color: String? = nil) {
            self.label = label
            self.value = value
            self.color = color
        }
    }

    public init(type: ChartType, title: String?, data: [ChartDataPoint]) {
        self.type = type
        self.title = title
        self.data = data
    }
}

// MARK: - Content Block Types

/// Represents a parsed block of markdown content
public enum ContentBlock: Equatable, Sendable {
    /// A paragraph of text (may contain inline formatting)
    case paragraph(String)
    /// A bullet list with items and indent levels
    case bulletList([BulletItem])
    /// A numbered list with items
    case numberedList([NumberedItem])
    /// A block quote
    case blockQuote(String)
    /// A heading (level 1-6)
    case heading(level: Int, text: String)
    /// A horizontal rule (---, ***, ___)
    case horizontalRule
    /// A fenced code block with optional language hint
    case codeBlock(code: String, language: String?)
    /// A collapsible/expandable section with nested content
    case collapsible(summary: String, content: [ContentBlock], isOpen: Bool)
    /// A markdown table with headers, rows, and column alignments
    case table(TableData)
    /// An interactive chart (bar, line, or pie)
    case chart(ChartData)
    /// An inline image with URL, alt text, and optional caption
    case image(ImageData)
}

/// A bullet list item with indent level for nesting
public struct BulletItem: Equatable, Sendable {
    public let content: String
    public let indentLevel: Int

    public init(content: String, indentLevel: Int = 0) {
        self.content = content
        self.indentLevel = indentLevel
    }
}

/// A numbered list item
public struct NumberedItem: Equatable, Sendable {
    public let number: Int
    public let content: String

    public init(number: Int, content: String) {
        self.number = number
        self.content = content
    }
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

    /// Whether the content is currently streaming (affects code block rendering)
    let isStreaming: Bool

    /// Per-instance parse cache — avoids redundant parsing when content hasn't changed.
    /// Using a reference-type cache so @State isn't needed (it survives view re-init
    /// as long as SwiftUI reuses the same identity, which it does for streaming updates).
    private let parseCache = MarkdownParseCache()

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

        // Table parsing state
        var inTable = false
        var tableHeaderLine: String?
        var tableSeparatorLine: String?
        var tableDataLines: [String] = []

        // List parsing state
        var currentBulletItems: [BulletItem] = []
        var currentNumberedItems: [NumberedItem] = []
        var currentBlockQuoteLines: [String] = []

        /// Flush all pending accumulators into blocks
        func flushPending() {
            if !currentParagraph.isEmpty {
                blocks.append(.paragraph(currentParagraph.joined(separator: "\n")))
                currentParagraph = []
            }
            if !currentBulletList.isEmpty {
                // Legacy path — convert to BulletItem
                blocks.append(.bulletList(currentBulletList.map { BulletItem(content: $0) }))
                currentBulletList = []
            }
            if !currentBulletItems.isEmpty {
                blocks.append(.bulletList(currentBulletItems))
                currentBulletItems = []
            }
            if !currentNumberedItems.isEmpty {
                blocks.append(.numberedList(currentNumberedItems))
                currentNumberedItems = []
            }
            if !currentBlockQuoteLines.isEmpty {
                blocks.append(.blockQuote(currentBlockQuoteLines.joined(separator: "\n")))
                currentBlockQuoteLines = []
            }
        }

        for line in lines {
            let trimmed = line.trimmingCharacters(in: .whitespaces)

            // Check for collapsible placeholder
            if trimmed.hasPrefix("__COLLAPSIBLE_PLACEHOLDER_") && trimmed.hasSuffix("__") {
                flushPending()

                // Extract index from placeholder
                // "__COLLAPSIBLE_PLACEHOLDER_" is 26 chars, "__" suffix is 2 chars, need at least 29 (26 + 1 digit + 2)
                guard trimmed.count >= 29 else { continue }
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
                    flushPending()

                    // Check if this is a chart code block
                    if codeBlockLanguage?.lowercased() == "chart" {
                        let code = codeBlockLines.joined(separator: "\n")
                        if let chartData = parseChartJSON(code) {
                            blocks.append(.chart(chartData))
                        } else {
                            blocks.append(.codeBlock(code: code, language: codeBlockLanguage))
                        }
                    } else {
                        blocks.append(.codeBlock(code: codeBlockLines.joined(separator: "\n"), language: codeBlockLanguage))
                    }
                    codeBlockLines = []
                    codeBlockLanguage = nil
                    inCodeBlock = false
                } else {
                    // Start of code block
                    flushPending()

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

            // Table detection
            if isTableRow(trimmed) {
                // Flush any pending content before starting table
                if !inTable {
                    flushPending()
                }

                if tableHeaderLine == nil {
                    tableHeaderLine = trimmed
                    inTable = true
                } else if tableSeparatorLine == nil && isTableSeparator(trimmed) {
                    tableSeparatorLine = trimmed
                } else if tableSeparatorLine == nil {
                    if let header = tableHeaderLine {
                        currentParagraph.append(header)
                    }
                    currentParagraph.append(trimmed)
                    tableHeaderLine = nil
                    inTable = false
                } else {
                    tableDataLines.append(trimmed)
                }
                continue
            } else if inTable {
                if let header = tableHeaderLine,
                   let tableData = parseTable(headerLine: header, separatorLine: tableSeparatorLine, dataLines: tableDataLines) {
                    blocks.append(.table(tableData))
                } else if let header = tableHeaderLine {
                    currentParagraph.append(header)
                    if let sep = tableSeparatorLine {
                        currentParagraph.append(sep)
                    }
                    currentParagraph.append(contentsOf: tableDataLines)
                }
                tableHeaderLine = nil
                tableSeparatorLine = nil
                tableDataLines = []
                inTable = false
            }

            // Check for standalone image line
            if isImageLine(trimmed) {
                flushPending()
                if let imageData = parseImageFromLine(trimmed) {
                    blocks.append(.image(imageData))
                }
                continue
            }

            // Horizontal rule
            if isHorizontalRule(trimmed) {
                flushPending()
                blocks.append(.horizontalRule)
                continue
            }

            // Headings
            if isHeadingLine(trimmed) {
                flushPending()
                let (level, text) = extractHeading(trimmed)
                blocks.append(.heading(level: level, text: text))
                continue
            }

            // Block quotes
            if isBlockQuoteLine(line) {
                // Flush non-blockquote pending content
                if !currentParagraph.isEmpty {
                    blocks.append(.paragraph(currentParagraph.joined(separator: "\n")))
                    currentParagraph = []
                }
                if !currentBulletItems.isEmpty {
                    blocks.append(.bulletList(currentBulletItems))
                    currentBulletItems = []
                }
                if !currentNumberedItems.isEmpty {
                    blocks.append(.numberedList(currentNumberedItems))
                    currentNumberedItems = []
                }
                currentBlockQuoteLines.append(extractBlockQuoteContent(line))
                continue
            } else if !currentBlockQuoteLines.isEmpty {
                blocks.append(.blockQuote(currentBlockQuoteLines.joined(separator: "\n")))
                currentBlockQuoteLines = []
            }

            // Numbered lists (check before bullet to avoid conflicts)
            if isNumberedLine(line) {
                // Flush paragraph and bullet lists
                if !currentParagraph.isEmpty {
                    blocks.append(.paragraph(currentParagraph.joined(separator: "\n")))
                    currentParagraph = []
                }
                if !currentBulletItems.isEmpty {
                    blocks.append(.bulletList(currentBulletItems))
                    currentBulletItems = []
                }
                let (number, content) = extractNumberedContent(line)
                currentNumberedItems.append(NumberedItem(number: number, content: content))
                continue
            } else if !currentNumberedItems.isEmpty {
                blocks.append(.numberedList(currentNumberedItems))
                currentNumberedItems = []
            }

            // Bullet lists
            if isBulletLine(line) {
                // Flush any pending paragraph
                if !currentParagraph.isEmpty {
                    blocks.append(.paragraph(currentParagraph.joined(separator: "\n")))
                    currentParagraph = []
                }
                if !currentNumberedItems.isEmpty {
                    blocks.append(.numberedList(currentNumberedItems))
                    currentNumberedItems = []
                }
                let bulletContent = extractBulletContent(line)
                let indent = bulletIndentLevel(line)
                currentBulletItems.append(BulletItem(content: bulletContent, indentLevel: indent))
                continue
            } else if !currentBulletItems.isEmpty {
                blocks.append(.bulletList(currentBulletItems))
                currentBulletItems = []
            }

            // Regular text
            if !trimmed.isEmpty {
                currentParagraph.append(line)
            } else if !currentParagraph.isEmpty {
                blocks.append(.paragraph(currentParagraph.joined(separator: "\n")))
                currentParagraph = []
            }
        }

        // Flush remaining content
        if inCodeBlock {
            blocks.append(.codeBlock(code: codeBlockLines.joined(separator: "\n"), language: codeBlockLanguage))
        }
        if inTable {
            if let header = tableHeaderLine,
               let tableData = parseTable(headerLine: header, separatorLine: tableSeparatorLine, dataLines: tableDataLines) {
                blocks.append(.table(tableData))
            } else if let header = tableHeaderLine {
                if let tableData = parseTable(headerLine: header, separatorLine: tableSeparatorLine, dataLines: []) {
                    blocks.append(.table(tableData))
                }
            }
        }
        if !currentBulletList.isEmpty {
            blocks.append(.bulletList(currentBulletList.map { BulletItem(content: $0) }))
        }
        if !currentBulletItems.isEmpty {
            blocks.append(.bulletList(currentBulletItems))
        }
        if !currentNumberedItems.isEmpty {
            blocks.append(.numberedList(currentNumberedItems))
        }
        if !currentBlockQuoteLines.isEmpty {
            blocks.append(.blockQuote(currentBlockQuoteLines.joined(separator: "\n")))
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
        // Guard against regex DoS on very large inputs
        guard content.count < 50_000 else { return (content, []) }

        var result = content
        var collapsibleBlocks: [ContentBlock] = []

        // Pattern: <details>\s*<summary>Title</summary>Content</details>
        // Also handles optional "open" attribute: <details open>
        guard let regex = MarkdownRegexCache.collapsible else {
            return (content, [])
        }

        // Find all matches (process from end to avoid index shifts)
        let range = NSRange(content.startIndex..., in: content)
        let matches = regex.matches(in: content, options: [], range: range)

        // Process matches in reverse order to maintain correct indices
        // Track original match index for correct placeholder numbering
        for (reverseIndex, match) in matches.reversed().enumerated() {
            // Calculate the original forward index for the placeholder
            let placeholderIndex = matches.count - 1 - reverseIndex

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
        let tempView = MarkdownContent(content: content, textColor: baseTextColor, isStreaming: isStreaming)
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

    /// Check if content has an unclosed code block (for streaming detection)
    /// - Parameter content: Content to check
    /// - Returns: True if there's an unclosed ``` marker
    static func hasPartialCodeBlock(_ content: String) -> Bool {
        let openCount = content.components(separatedBy: "```").count - 1
        return openCount % 2 == 1  // Odd number means unclosed
    }

    /// Check if a line is a bullet list item (supports nesting with indentation)
    private func isBulletLine(_ line: String) -> Bool {
        let trimmed = line.trimmingCharacters(in: .init(charactersIn: " "))
        return trimmed.hasPrefix("- ") || trimmed.hasPrefix("* ") || trimmed.hasPrefix("+ ")
    }

    /// Check if a line is a numbered list item (e.g., "1. ", "2. ")
    private func isNumberedLine(_ line: String) -> Bool {
        let trimmed = line.trimmingCharacters(in: .init(charactersIn: " "))
        guard let dotIndex = trimmed.firstIndex(of: ".") else { return false }
        let prefix = trimmed[trimmed.startIndex..<dotIndex]
        guard !prefix.isEmpty, prefix.allSatisfy(\.isNumber) else { return false }
        let afterDot = trimmed.index(after: dotIndex)
        return afterDot < trimmed.endIndex && trimmed[afterDot] == " "
    }

    /// Extract content after bullet marker
    private func extractBulletContent(_ line: String) -> String {
        let trimmed = line.trimmingCharacters(in: .init(charactersIn: " "))
        if trimmed.hasPrefix("- ") {
            return String(trimmed.dropFirst(2))
        } else if trimmed.hasPrefix("* ") {
            return String(trimmed.dropFirst(2))
        } else if trimmed.hasPrefix("+ ") {
            return String(trimmed.dropFirst(2))
        }
        return trimmed
    }

    /// Get indent level of a bullet line (number of leading spaces / 2)
    private func bulletIndentLevel(_ line: String) -> Int {
        let leadingSpaces = line.prefix(while: { $0 == " " }).count
        return leadingSpaces / 2
    }

    /// Extract number and content from a numbered list item
    private func extractNumberedContent(_ line: String) -> (number: Int, content: String) {
        let trimmed = line.trimmingCharacters(in: .init(charactersIn: " "))
        guard let dotIndex = trimmed.firstIndex(of: ".") else { return (1, trimmed) }
        let prefix = trimmed[trimmed.startIndex..<dotIndex]
        let number = Int(prefix) ?? 1
        let afterDot = trimmed.index(after: dotIndex)
        guard afterDot < trimmed.endIndex else { return (number, "") }
        return (number, String(trimmed[trimmed.index(after: afterDot)...]))
    }

    /// Check if a line is a block quote (starts with > )
    private func isBlockQuoteLine(_ line: String) -> Bool {
        let trimmed = line.trimmingCharacters(in: .init(charactersIn: " "))
        return trimmed.hasPrefix("> ") || trimmed == ">"
    }

    /// Extract content after block quote marker
    private func extractBlockQuoteContent(_ line: String) -> String {
        let trimmed = line.trimmingCharacters(in: .init(charactersIn: " "))
        if trimmed.hasPrefix("> ") {
            return String(trimmed.dropFirst(2))
        }
        if trimmed == ">" {
            return ""
        }
        return trimmed
    }

    /// Check if a line is a heading (starts with # )
    private func isHeadingLine(_ line: String) -> Bool {
        let trimmed = line.trimmingCharacters(in: .whitespaces)
        return trimmed.hasPrefix("# ") || trimmed.hasPrefix("## ") || trimmed.hasPrefix("### ")
            || trimmed.hasPrefix("#### ") || trimmed.hasPrefix("##### ") || trimmed.hasPrefix("###### ")
    }

    /// Extract heading level and content
    private func extractHeading(_ line: String) -> (level: Int, content: String) {
        let trimmed = line.trimmingCharacters(in: .whitespaces)
        var level = 0
        var idx = trimmed.startIndex
        while idx < trimmed.endIndex && trimmed[idx] == "#" {
            level += 1
            idx = trimmed.index(after: idx)
        }
        // Skip the space after #
        if idx < trimmed.endIndex && trimmed[idx] == " " {
            idx = trimmed.index(after: idx)
        }
        return (level, String(trimmed[idx...]))
    }

    /// Check if a line is a horizontal rule (---, ***, ___)
    private func isHorizontalRule(_ line: String) -> Bool {
        let trimmed = line.trimmingCharacters(in: .whitespaces)
        if trimmed.count < 3 { return false }
        let chars = Set(trimmed)
        return (chars == ["-"] || chars == ["*"] || chars == ["_"]) && trimmed.count >= 3
    }

    // MARK: - Image Parsing

    /// Check if a line is a standalone markdown image
    /// Pattern: ![alt text](url) or ![alt text](url "title")
    private func isImageLine(_ line: String) -> Bool {
        let trimmed = line.trimmingCharacters(in: .whitespaces)
        // Must start with ![ and contain ]( and end with )
        guard trimmed.hasPrefix("![") && trimmed.contains("](") && trimmed.hasSuffix(")") else {
            return false
        }
        // Simple validation - should have balanced brackets
        return parseImageFromLine(trimmed) != nil
    }

    /// Parse a markdown image from a line
    /// - Parameter line: The line containing ![alt](url) or ![alt](url "title")
    /// - Returns: ImageData if successfully parsed, nil otherwise
    private func parseImageFromLine(_ line: String) -> ImageData? {
        let trimmed = line.trimmingCharacters(in: .whitespaces)

        // Pattern: ![alt text](url) or ![alt text](url "title")
        // Use cached pre-compiled regex for robust parsing
        guard let regex = MarkdownRegexCache.image else {
            return nil
        }

        let range = NSRange(trimmed.startIndex..., in: trimmed)
        guard let match = regex.firstMatch(in: trimmed, options: [], range: range) else {
            return nil
        }

        // Extract alt text
        let altText: String
        if let altRange = Range(match.range(at: 1), in: trimmed) {
            altText = String(trimmed[altRange])
        } else {
            altText = ""
        }

        // Extract URL
        guard let urlRange = Range(match.range(at: 2), in: trimmed) else {
            return nil
        }
        let urlString = String(trimmed[urlRange])
        guard let url = URL(string: urlString) else {
            return nil
        }

        // Extract optional title/caption
        let caption: String?
        if match.range(at: 3).location != NSNotFound,
           let captionRange = Range(match.range(at: 3), in: trimmed) {
            caption = String(trimmed[captionRange])
        } else {
            caption = nil
        }

        return ImageData(url: url, altText: altText, caption: caption)
    }

    /// Extract all inline images from a paragraph and return as separate blocks
    /// - Parameter text: Paragraph text that may contain inline images
    /// - Returns: Array of ContentBlocks (paragraphs and images interleaved)
    private func extractImagesFromParagraph(_ text: String) -> [ContentBlock] {
        guard let regex = MarkdownRegexCache.image else {
            return [.paragraph(text)]
        }

        var blocks: [ContentBlock] = []
        var lastEnd = text.startIndex
        let nsRange = NSRange(text.startIndex..., in: text)
        let matches = regex.matches(in: text, options: [], range: nsRange)

        for match in matches {
            guard let fullRange = Range(match.range, in: text) else { continue }

            // Add preceding text as paragraph if not empty
            let precedingText = String(text[lastEnd..<fullRange.lowerBound])
                .trimmingCharacters(in: .whitespacesAndNewlines)
            if !precedingText.isEmpty {
                blocks.append(.paragraph(precedingText))
            }

            // Parse the image
            if let imageData = parseImageFromLine(String(text[fullRange])) {
                blocks.append(.image(imageData))
            }

            lastEnd = fullRange.upperBound
        }

        // Add remaining text after last image
        let remainingText = String(text[lastEnd...])
            .trimmingCharacters(in: .whitespacesAndNewlines)
        if !remainingText.isEmpty {
            blocks.append(.paragraph(remainingText))
        }

        return blocks.isEmpty ? [.paragraph(text)] : blocks
    }

    // MARK: - Chart Parsing

    /// Parse JSON content as ChartData
    /// - Parameter json: JSON string from a chart code block
    /// - Returns: ChartData if parsing succeeds, nil otherwise
    private func parseChartJSON(_ json: String) -> ChartData? {
        let trimmed = json.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }

        do {
            let decoder = JSONDecoder()
            let data = Data(trimmed.utf8)
            return try decoder.decode(ChartData.self, from: data)
        } catch {
            // Failed to parse - return nil to fall back to code block
            return nil
        }
    }

    // MARK: - Table Parsing

    /// Check if a line looks like a table row (contains pipes)
    private func isTableRow(_ line: String) -> Bool {
        let trimmed = line.trimmingCharacters(in: .whitespaces)
        return trimmed.hasPrefix("|") && trimmed.hasSuffix("|") && trimmed.count > 2
    }

    /// Check if a line is a table separator row (e.g., |---|:---:|---:|)
    private func isTableSeparator(_ line: String) -> Bool {
        let trimmed = line.trimmingCharacters(in: .whitespaces)
        guard trimmed.hasPrefix("|") && trimmed.hasSuffix("|") else { return false }

        // Split by | and check each cell
        let cells = trimmed.split(separator: "|", omittingEmptySubsequences: false)
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }

        guard !cells.isEmpty else { return false }

        // Each cell should match the pattern: :?-+:? (dashes with optional colons)
        for cell in cells {
            let pattern = #"^:?-{1,}:?$"#
            guard cell.range(of: pattern, options: .regularExpression) != nil else {
                return false
            }
        }
        return true
    }

    /// Parse a table row into cell values
    private func parseTableRow(_ line: String) -> [String] {
        let trimmed = line.trimmingCharacters(in: .whitespaces)

        // Remove leading and trailing pipes
        var inner = trimmed
        if inner.hasPrefix("|") { inner = String(inner.dropFirst()) }
        if inner.hasSuffix("|") { inner = String(inner.dropLast()) }

        // Split by | and trim each cell
        return inner.split(separator: "|", omittingEmptySubsequences: false)
            .map { $0.trimmingCharacters(in: .whitespaces) }
    }

    /// Parse alignment from separator row
    /// - Parameter line: The separator row (e.g., |:---|:---:|---:|)
    /// - Returns: Array of TableAlignment values
    private func parseTableAlignments(_ line: String) -> [TableData.TableAlignment] {
        let cells = parseTableRow(line)
        return cells.map { cell in
            let hasLeftColon = cell.hasPrefix(":")
            let hasRightColon = cell.hasSuffix(":")
            if hasLeftColon && hasRightColon {
                return .center
            } else if hasRightColon {
                return .right
            } else {
                return .left
            }
        }
    }

    /// Parse table lines into TableData
    /// - Parameters:
    ///   - headerLine: The header row
    ///   - separatorLine: The separator row (for alignments)
    ///   - dataLines: The data rows
    /// - Returns: TableData if valid, nil otherwise
    private func parseTable(headerLine: String, separatorLine: String?, dataLines: [String]) -> TableData? {
        let headers = parseTableRow(headerLine)
        guard !headers.isEmpty else { return nil }

        let alignments: [TableData.TableAlignment]
        if let sep = separatorLine {
            alignments = parseTableAlignments(sep)
        } else {
            // Default to left alignment for all columns
            alignments = Array(repeating: .left, count: headers.count)
        }

        // Parse data rows, ensuring column count matches headers
        let rows = dataLines.compactMap { line -> [String]? in
            let cells = parseTableRow(line)
            guard !cells.isEmpty else { return nil }
            // Pad or truncate to match header count
            if cells.count < headers.count {
                return cells + Array(repeating: "", count: headers.count - cells.count)
            } else if cells.count > headers.count {
                return Array(cells.prefix(headers.count))
            }
            return cells
        }

        return TableData(headers: headers, rows: rows, alignments: alignments)
    }

    /// Check if a line looks like a partial table row (starts with | but doesn't end with |)
    /// Used for streaming detection
    private func isPartialTableRow(_ line: String) -> Bool {
        let trimmed = line.trimmingCharacters(in: .whitespaces)
        return trimmed.hasPrefix("|") && !trimmed.hasSuffix("|") && trimmed.count > 1
    }

    /// Check if content has an incomplete table (for streaming detection)
    /// - Parameter content: Content to check
    /// - Returns: True if there's a table header without complete data
    static func hasPartialTable(_ content: String) -> Bool {
        let lines = content.components(separatedBy: "\n")
        var foundHeader = false
        var foundSeparator = false

        for line in lines {
            let trimmed = line.trimmingCharacters(in: .whitespaces)

            // Check for partial row (incomplete during streaming)
            if trimmed.hasPrefix("|") && !trimmed.hasSuffix("|") && trimmed.count > 1 {
                return true  // Partial row being typed
            }

            if trimmed.hasPrefix("|") && trimmed.hasSuffix("|") {
                if !foundHeader {
                    foundHeader = true
                } else if !foundSeparator {
                    // Check if this is a separator
                    let pattern = #"^\|(\s*:?-+:?\s*\|)+$"#
                    if trimmed.range(of: pattern, options: .regularExpression) != nil {
                        foundSeparator = true
                    }
                }
            } else if foundHeader && !foundSeparator {
                // Non-table line after header but before separator - likely incomplete
                return true
            }
        }

        return foundHeader && !foundSeparator
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

    // MARK: - Inline Formatting

    /// Create styled text with inline markdown formatting
    /// Uses AttributedString for bold, italic, strikethrough, and links
    /// Handles inline code separately with custom styling
    private func styledText(_ text: String) -> Text {
        let segments = parseInlineCode(text)
        // Post-process text segments to extract @mentions
        let finalSegments = extractMentionSegments(from: segments)

        var result = Text("")
        for segment in finalSegments {
            switch segment {
            case .text(let content):
                // Handle strikethrough manually since AttributedString(markdown:) may not handle ~~
                let processed = processStrikethrough(content)
                result = result + processed
            case .code(let code):
                // Inline code pill: monospace + optaPrimary on optaElevated background
                // SwiftUI Text doesn't support inline background, so we use visual cues:
                // space padding + monospace + distinct color
                result = result + Text("\u{2009}\(code)\u{2009}")
                    .font(.system(size: 13, design: .monospaced))
                    .foregroundColor(.optaPrimary)
            case .mention(let name):
                // @mention highlighted in optaPrimary with semibold weight
                result = result + Text("@\(name)")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(.optaPrimary)
            }
        }

        return result
    }

    /// Extract @mention tokens from text segments.
    /// Only processes `.text` segments — code and existing mentions are left untouched.
    private func extractMentionSegments(from segments: [TextSegment]) -> [TextSegment] {
        var result: [TextSegment] = []
        for segment in segments {
            guard case .text(let content) = segment else {
                result.append(segment)
                continue
            }
            // Split text on @mention patterns
            var remaining = content[content.startIndex...]
            while !remaining.isEmpty {
                guard let atIndex = remaining.firstIndex(of: "@") else {
                    result.append(.text(String(remaining)))
                    break
                }
                // Check that @ is at start or preceded by whitespace
                let validStart = atIndex == remaining.startIndex
                    || remaining[remaining.index(before: atIndex)].isWhitespace
                let afterAt = remaining.index(after: atIndex)
                if validStart && afterAt < remaining.endIndex && remaining[afterAt].isLetter {
                    // Extract the mention word (letters, digits, spaces between capitalized words)
                    var endIndex = afterAt
                    while endIndex < remaining.endIndex && !remaining[endIndex].isNewline {
                        let nextChar = remaining[endIndex]
                        if nextChar.isLetter || nextChar.isNumber {
                            endIndex = remaining.index(after: endIndex)
                        } else if nextChar == " " {
                            // Allow space for multi-word bot names like "Opta Max"
                            let afterSpace = remaining.index(after: endIndex)
                            if afterSpace < remaining.endIndex && remaining[afterSpace].isUppercase {
                                endIndex = remaining.index(after: endIndex)
                            } else {
                                break
                            }
                        } else {
                            break
                        }
                    }
                    let mentionName = String(remaining[afterAt..<endIndex])
                    if !mentionName.isEmpty {
                        // Add text before @
                        if atIndex > remaining.startIndex {
                            result.append(.text(String(remaining[remaining.startIndex..<atIndex])))
                        }
                        result.append(.mention(mentionName))
                        remaining = remaining[endIndex...]
                    } else {
                        result.append(.text(String(remaining[remaining.startIndex...atIndex])))
                        remaining = remaining[afterAt...]
                    }
                } else {
                    // @ not at valid word boundary, include up to and past @
                    let nextIndex = remaining.index(after: atIndex)
                    result.append(.text(String(remaining[remaining.startIndex..<nextIndex])))
                    remaining = remaining[nextIndex...]
                }
            }
        }
        return result
    }

    /// Process text that may contain ~~strikethrough~~ markers
    private func processStrikethrough(_ text: String) -> Text {
        var result = Text("")
        var remaining = text

        while !remaining.isEmpty {
            if let openRange = remaining.range(of: "~~") {
                // Text before ~~
                let before = String(remaining[..<openRange.lowerBound])
                if !before.isEmpty {
                    if let attributed = try? AttributedString(markdown: before) {
                        result = result + Text(attributed)
                    } else {
                        result = result + Text(before)
                    }
                }

                let afterOpen = remaining[openRange.upperBound...]
                if let closeRange = afterOpen.range(of: "~~") {
                    // Found closing ~~ — apply strikethrough
                    let struck = String(afterOpen[..<closeRange.lowerBound])
                    result = result + Text(struck).strikethrough()
                    remaining = String(afterOpen[closeRange.upperBound...])
                } else {
                    // No closing ~~ — treat as plain text
                    if let attributed = try? AttributedString(markdown: String(remaining)) {
                        result = result + Text(attributed)
                    } else {
                        result = result + Text(remaining)
                    }
                    remaining = ""
                }
            } else {
                // No ~~ — render with AttributedString for bold/italic/links
                if let attributed = try? AttributedString(markdown: remaining) {
                    result = result + Text(attributed)
                } else {
                    result = result + Text(remaining)
                }
                remaining = ""
            }
        }

        return result
    }

    /// Segment type for inline code parsing
    private enum TextSegment {
        case text(String)
        case code(String)
        case mention(String) // @botname token
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
                    let codeContent = String(afterOpen[..<closeRange.lowerBound])
                    segments.append(.code(codeContent))
                    remaining = String(afterOpen[closeRange.upperBound...])
                } else {
                    // No closing backtick - treat as text (streaming resilience)
                    segments.append(.text("`" + String(afterOpen)))
                    remaining = ""
                }
            } else {
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
