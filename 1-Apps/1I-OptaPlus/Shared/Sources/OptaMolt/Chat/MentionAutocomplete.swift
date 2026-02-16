//
//  MentionAutocomplete.swift
//  OptaMolt
//
//  Observable autocomplete controller for @mention bot suggestions.
//  Detects when the user types @ and filters the bot list in real time.
//

import SwiftUI

// MARK: - Mention Autocomplete

@MainActor
public final class MentionAutocomplete: ObservableObject {

    /// Filtered list of bots matching the current @query.
    @Published public var suggestions: [BotConfig] = []

    /// Whether the autocomplete popup should be visible.
    @Published public var isActive: Bool = false

    /// The partial query text after the @ symbol (for highlighting).
    @Published public var query: String = ""

    /// The index of the @ symbol in the input text (for replacement).
    private var tokenStart: String.Index?

    /// All available bots.
    private var allBots: [BotConfig] = []

    public init() {}

    // MARK: - Public API

    /// Call this whenever the input text or cursor position changes.
    ///
    /// - Parameters:
    ///   - text: The full input text.
    ///   - cursorOffset: The character offset of the cursor.
    ///   - bots: The list of known bots.
    public func update(text: String, cursorOffset: Int, bots: [BotConfig]) {
        allBots = bots

        guard let partial = MentionParser.detectPartialMention(in: text, cursorOffset: cursorOffset) else {
            dismiss()
            return
        }

        tokenStart = partial.tokenStart
        query = partial.query

        if partial.query.isEmpty {
            // Just typed "@" — show all bots
            suggestions = bots
        } else {
            // Filter by partial name (case-insensitive prefix + contains)
            let q = partial.query.lowercased()
            suggestions = bots.filter { bot in
                bot.name.lowercased().hasPrefix(q) || bot.name.lowercased().contains(q)
            }.sorted { a, b in
                // Prefer prefix matches
                let aPrefix = a.name.lowercased().hasPrefix(q)
                let bPrefix = b.name.lowercased().hasPrefix(q)
                if aPrefix != bPrefix { return aPrefix }
                return a.name < b.name
            }
        }

        isActive = !suggestions.isEmpty
    }

    /// Accept a bot suggestion. Returns the updated text with the full bot name inserted.
    ///
    /// - Parameters:
    ///   - bot: The selected bot.
    ///   - text: The current input text.
    /// - Returns: The text with @botname inserted, and the cursor offset after the insertion.
    public func accept(bot: BotConfig, in text: String) -> (newText: String, cursorOffset: Int) {
        guard let start = tokenStart else { return (text, text.count) }

        var result = text
        // Find the end of the current partial token (from tokenStart to the next space or end)
        var tokenEnd = text.endIndex
        let afterAt = text.index(after: start)
        if afterAt < text.endIndex {
            if let spaceIndex = text[afterAt...].firstIndex(where: { $0.isWhitespace }) {
                tokenEnd = spaceIndex
            }
        }

        let replacement = "@\(bot.name) "
        result.replaceSubrange(start..<tokenEnd, with: replacement)

        let cursorOffset = text.distance(from: text.startIndex, to: start) + replacement.count

        dismiss()
        return (newText: result, cursorOffset: cursorOffset)
    }

    /// Dismiss the autocomplete popup.
    public func dismiss() {
        isActive = false
        suggestions = []
        query = ""
        tokenStart = nil
    }
}
