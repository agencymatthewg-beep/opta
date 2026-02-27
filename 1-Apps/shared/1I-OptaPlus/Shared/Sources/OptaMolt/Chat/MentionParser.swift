//
//  MentionParser.swift
//  OptaMolt
//
//  Parses @botname mentions from message text and matches them against known bots.
//

import Foundation

// MARK: - Mention

/// A resolved @mention found in message text.
public struct Mention: Equatable, Sendable {
    /// The bot's unique identifier.
    public let botId: String
    /// The bot's display name as matched.
    public let botName: String
    /// The range of the full @mention token (including the @ symbol) in the original text.
    public let range: Range<String.Index>
}

// MARK: - Mention Parser

/// Stateless utility for extracting @mentions from text.
public enum MentionParser {

    /// Extract all @mentions from `text` that match a known bot in `bots`.
    ///
    /// Matching is case-insensitive and greedy — if multiple bots could match,
    /// the longest name wins (e.g. "@Opta Max" beats "@Opta").
    ///
    /// - Parameters:
    ///   - text: The raw message text.
    ///   - bots: Known bot configurations to match against.
    /// - Returns: Array of resolved mentions, ordered by their position in the text.
    public static func extractMentions(from text: String, knownBots: [BotConfig]) -> [Mention] {
        guard !text.isEmpty, !knownBots.isEmpty else { return [] }

        var mentions: [Mention] = []
        var searchStart = text.startIndex

        while searchStart < text.endIndex {
            // Find the next '@' character
            guard let atIndex = text[searchStart...].firstIndex(of: "@") else { break }

            let afterAt = text.index(after: atIndex)
            guard afterAt < text.endIndex else { break }

            // Try to match bot names (longest match first)
            let remainder = text[afterAt...]
            var bestMatch: (bot: BotConfig, endIndex: String.Index)?

            for bot in knownBots {
                let name = bot.name
                guard !name.isEmpty else { continue }

                if remainder.prefix(name.count).localizedCaseInsensitiveCompare(name) == .orderedSame {
                    let candidateEnd = text.index(afterAt, offsetBy: name.count, limitedBy: text.endIndex) ?? text.endIndex

                    // Ensure the match is at a word boundary (next char is space, punctuation, or end)
                    let atBoundary = candidateEnd == text.endIndex
                        || text[candidateEnd].isWhitespace
                        || text[candidateEnd].isPunctuation
                        || text[candidateEnd] == ","

                    if atBoundary {
                        if let existing = bestMatch {
                            // Keep the longer match
                            if name.count > text.distance(from: afterAt, to: existing.endIndex) {
                                bestMatch = (bot, candidateEnd)
                            }
                        } else {
                            bestMatch = (bot, candidateEnd)
                        }
                    }
                }
            }

            if let match = bestMatch {
                mentions.append(Mention(
                    botId: match.bot.id,
                    botName: match.bot.name,
                    range: atIndex..<match.endIndex
                ))
                searchStart = match.endIndex
            } else {
                searchStart = afterAt
            }
        }

        return mentions
    }

    /// Returns the first mentioned bot ID, if any.
    public static func firstMentionedBotId(from text: String, knownBots: [BotConfig]) -> String? {
        extractMentions(from: text, knownBots: knownBots).first?.botId
    }

    /// Strips @mention tokens from the text, returning clean message content.
    public static func stripMentions(from text: String, mentions: [Mention]) -> String {
        guard !mentions.isEmpty else { return text }
        var result = text
        // Process in reverse order to preserve indices
        for mention in mentions.reversed() {
            result.removeSubrange(mention.range)
        }
        return result.trimmingCharacters(in: .whitespaces)
    }

    // MARK: - Autocomplete Support

    /// Detect whether the cursor is currently inside an @mention token being typed.
    /// Returns the partial text after @ if so, nil otherwise.
    ///
    /// - Parameters:
    ///   - text: The full input text.
    ///   - cursorOffset: Character offset of the cursor position.
    /// - Returns: A tuple of (partial query string, range of the @token so far) or nil.
    public static func detectPartialMention(in text: String, cursorOffset: Int) -> (query: String, tokenStart: String.Index)? {
        guard cursorOffset > 0, cursorOffset <= text.count else { return nil }

        let cursorIndex = text.index(text.startIndex, offsetBy: cursorOffset)
        let beforeCursor = text[text.startIndex..<cursorIndex]

        // Walk backwards from cursor to find the @ sign
        guard let atIndex = beforeCursor.lastIndex(of: "@") else { return nil }

        // Ensure there's no space between @ and cursor (contiguous token)
        let tokenText = String(beforeCursor[text.index(after: atIndex)...])
        if tokenText.contains(" ") { return nil }

        // Ensure @ is at the start of text or preceded by whitespace
        if atIndex > text.startIndex {
            let charBefore = text[text.index(before: atIndex)]
            if !charBefore.isWhitespace { return nil }
        }

        return (query: tokenText, tokenStart: atIndex)
    }
}
