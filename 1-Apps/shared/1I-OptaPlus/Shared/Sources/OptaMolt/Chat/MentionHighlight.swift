//
//  MentionHighlight.swift
//  OptaMolt
//
//  Provides an AttributedString rendering of @mentions with optaPrimary color.
//  Used by MessageBubble to highlight @botname tokens in message text.
//

import SwiftUI

// MARK: - Mention Highlight

public enum MentionHighlight {

    /// Returns an AttributedString with @mentions highlighted in the given color.
    /// Non-mention text retains the provided `baseColor`.
    public static func attributedString(
        from text: String,
        knownBots: [BotConfig],
        baseColor: Color = .primary,
        mentionColor: Color = .optaPrimary
    ) -> AttributedString {
        let mentions = MentionParser.extractMentions(from: text, knownBots: knownBots)
        guard !mentions.isEmpty else {
            var plain = AttributedString(text)
            plain.foregroundColor = baseColor
            return plain
        }

        var result = AttributedString()
        var currentIndex = text.startIndex

        for mention in mentions {
            // Add text before this mention
            if currentIndex < mention.range.lowerBound {
                var segment = AttributedString(text[currentIndex..<mention.range.lowerBound])
                segment.foregroundColor = baseColor
                result.append(segment)
            }

            // Add the mention with highlight
            var mentionText = AttributedString(text[mention.range])
            mentionText.foregroundColor = mentionColor
            mentionText.font = .system(size: 14, weight: .semibold)
            result.append(mentionText)

            currentIndex = mention.range.upperBound
        }

        // Add remaining text after last mention
        if currentIndex < text.endIndex {
            var segment = AttributedString(text[currentIndex...])
            segment.foregroundColor = baseColor
            result.append(segment)
        }

        return result
    }

    /// Check if text contains any @mentions for known bots.
    public static func containsMentions(in text: String, knownBots: [BotConfig]) -> Bool {
        !MentionParser.extractMentions(from: text, knownBots: knownBots).isEmpty
    }
}
