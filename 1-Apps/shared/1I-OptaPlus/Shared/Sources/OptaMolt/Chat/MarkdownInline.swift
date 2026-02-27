//
//  MarkdownInline.swift
//  OptaMolt
//
//  Inline formatting logic extracted from MarkdownContent.
//  Handles inline code, bold, italic, strikethrough, links,
//  and @mention parsing within text segments.
//

import SwiftUI

// MARK: - Inline Segment Type

/// Segment type for inline code parsing
enum TextSegment {
    case text(String)
    case code(String)
    case mention(String) // @botname token
}

// MARK: - MarkdownContent Inline Formatting Extension

extension MarkdownContent {

    // MARK: - Inline Formatting

    /// Create styled text with inline markdown formatting
    /// Uses AttributedString for bold, italic, strikethrough, and links
    /// Handles inline code separately with custom styling
    func styledText(_ text: String) -> Text {
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
    func extractMentionSegments(from segments: [TextSegment]) -> [TextSegment] {
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
    func processStrikethrough(_ text: String) -> Text {
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

    /// Parse inline code blocks from text
    func parseInlineCode(_ text: String) -> [TextSegment] {
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
}
