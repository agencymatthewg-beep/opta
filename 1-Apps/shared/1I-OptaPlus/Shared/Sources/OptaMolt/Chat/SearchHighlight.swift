//
//  SearchHighlight.swift
//  OptaMolt
//
//  Text view with highlighted search matches using AttributedString.
//  Matched segments are rendered with optaViolet background.
//

import SwiftUI

// MARK: - Highlighted Text View

/// A text view that highlights all occurrences of a search term.
/// Uses AttributedString for rich text rendering without disrupting markdown.
public struct HighlightedText: View {
    let text: String
    let highlight: String
    var highlightColor: Color = .optaPrimary
    var textColor: Color = .optaTextPrimary

    public init(
        text: String,
        highlight: String,
        highlightColor: Color = .optaPrimary,
        textColor: Color = .optaTextPrimary
    ) {
        self.text = text
        self.highlight = highlight
        self.highlightColor = highlightColor
        self.textColor = textColor
    }

    public var body: some View {
        if highlight.isEmpty {
            Text(text)
                .foregroundColor(textColor)
        } else {
            Text(attributedText)
        }
    }

    private var attributedText: AttributedString {
        var attributed = AttributedString(text)
        attributed.foregroundColor = textColor

        let lowerText = text.lowercased()
        let lowerHighlight = highlight.lowercased()

        guard !lowerHighlight.isEmpty else { return attributed }

        var searchStart = lowerText.startIndex
        while searchStart < lowerText.endIndex,
              let range = lowerText.range(of: lowerHighlight, range: searchStart..<lowerText.endIndex) {
            // Convert String.Index range to AttributedString range
            if let attrRange = Range(NSRange(range, in: text), in: attributed) {
                attributed[attrRange].backgroundColor = highlightColor.opacity(0.35)
                attributed[attrRange].foregroundColor = .white
            }
            searchStart = range.upperBound
        }

        return attributed
    }
}

// MARK: - Search Match Glow Modifier

/// Applies a glow overlay to a view when it matches a search query.
public struct SearchMatchGlow: ViewModifier {
    let isMatch: Bool
    let isCurrent: Bool

    public func body(content: Content) -> some View {
        content
            .overlay(
                RoundedRectangle(cornerRadius: 18)
                    .stroke(
                        isCurrent ? Color.optaPrimary : Color.optaPrimary.opacity(0.4),
                        lineWidth: isCurrent ? 2 : 1
                    )
                    .shadow(
                        color: Color.optaPrimary.opacity(isCurrent ? 0.5 : 0.2),
                        radius: isCurrent ? 8 : 4
                    )
                    .opacity(isMatch ? 1 : 0)
            )
            .animation(.spring(response: 0.3, dampingFraction: 0.8), value: isMatch)
            .animation(.spring(response: 0.3, dampingFraction: 0.8), value: isCurrent)
    }
}

public extension View {
    /// Applies a search match glow effect.
    func searchMatchGlow(isMatch: Bool, isCurrent: Bool = false) -> some View {
        modifier(SearchMatchGlow(isMatch: isMatch, isCurrent: isCurrent))
    }
}

// MARK: - Search Snippet View

/// Displays a search result snippet with highlighted match text.
public struct SearchSnippetView: View {
    let result: SearchResult
    let query: String

    public init(result: SearchResult, query: String) {
        self.result = result
        self.query = query
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            // Sender and timestamp
            HStack(spacing: 6) {
                if let sender = result.sender {
                    Text(sender.accessibleName)
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundColor(.optaTextSecondary)
                }

                if let sessionKey = result.sessionKey {
                    Text(sessionKey)
                        .font(.system(size: 10, design: .monospaced))
                        .foregroundColor(.optaTextMuted)
                        .lineLimit(1)
                }

                Spacer()

                if let timestamp = result.timestamp {
                    Text(OptaFormatting.relativeTime(timestamp))
                        .font(.system(size: 10))
                        .foregroundColor(.optaTextMuted)
                }
            }

            // Highlighted snippet
            HighlightedText(
                text: result.snippet,
                highlight: query,
                textColor: .optaTextSecondary
            )
            .font(.system(size: 13))
            .lineLimit(2)
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Preview

#if DEBUG
struct SearchHighlight_Previews: PreviewProvider {
    static var previews: some View {
        VStack(spacing: 16) {
            HighlightedText(
                text: "Hello world, this is a test message about searching.",
                highlight: "test"
            )

            HighlightedText(
                text: "Multiple matches: test one test two test three.",
                highlight: "test",
                highlightColor: .optaPrimary
            )

            HighlightedText(
                text: "No matches here.",
                highlight: "xyz"
            )
        }
        .padding()
        .background(Color.optaVoid)
    }
}
#endif
