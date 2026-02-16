//
//  SearchEngine.swift
//  OptaMolt
//
//  Client-side message search engine with debounced input,
//  local (in-session) and global (across-sessions) search,
//  and match navigation.
//

import Foundation
import SwiftUI
import Combine

// MARK: - Search Result

public struct SearchResult: Identifiable, Equatable {
    public let id: String
    public let messageId: String
    public let sessionKey: String?
    public let matchRange: Range<String.Index>
    public let snippet: String
    public let timestamp: Date?
    public let sender: MessageSender?

    public init(
        messageId: String,
        sessionKey: String? = nil,
        matchRange: Range<String.Index>,
        snippet: String,
        timestamp: Date? = nil,
        sender: MessageSender? = nil
    ) {
        self.id = "\(messageId)-\(matchRange.lowerBound)"
        self.messageId = messageId
        self.sessionKey = sessionKey
        self.matchRange = matchRange
        self.snippet = snippet
        self.timestamp = timestamp
        self.sender = sender
    }
}

// MARK: - Search Scope

public enum SearchScope: String, CaseIterable, Sendable {
    case thisChat = "This chat"
    case allChats = "All chats"
}

// MARK: - Search Engine

@MainActor
public final class SearchEngine: ObservableObject {
    @Published public var query: String = ""
    @Published public var results: [SearchResult] = []
    @Published public var currentIndex: Int = 0
    @Published public var isSearching: Bool = false
    @Published public var scope: SearchScope = .thisChat

    /// The result at the current navigation index.
    public var currentResult: SearchResult? {
        guard !results.isEmpty, currentIndex >= 0, currentIndex < results.count else { return nil }
        return results[currentIndex]
    }

    private var debounceCancellable: AnyCancellable?
    private var searchTask: Task<Void, Never>?

    // Performance limits
    private static let maxMessagesPerSession = 1000
    private static let maxGlobalSessions = 20
    private static let maxMessagesPerGlobalSession = 50

    public init() {
        // Debounce query changes by 300ms
        debounceCancellable = $query
            .removeDuplicates()
            .debounce(for: .milliseconds(300), scheduler: DispatchQueue.main)
            .sink { [weak self] newQuery in
                guard let self else { return }
                let trimmed = newQuery.trimmingCharacters(in: .whitespacesAndNewlines)
                if trimmed.isEmpty {
                    self.results = []
                    self.currentIndex = 0
                    self.isSearching = false
                } else {
                    // Notify that a debounced query is ready
                    NotificationCenter.default.post(
                        name: .searchEngineQueryReady,
                        object: nil,
                        userInfo: ["query": trimmed]
                    )
                }
            }
    }

    // MARK: - Local Search

    /// Search within a given array of messages (current session).
    public func searchLocal(messages: [ChatMessage]) {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            results = []
            currentIndex = 0
            isSearching = false
            return
        }

        isSearching = true
        let q = trimmed.lowercased()
        let capped = Array(messages.suffix(Self.maxMessagesPerSession))

        var found: [SearchResult] = []
        for message in capped {
            let content = message.content
            let lower = content.lowercased()
            var searchStart = lower.startIndex

            while searchStart < lower.endIndex,
                  let range = lower.range(of: q, range: searchStart..<lower.endIndex) {
                // Build a snippet: up to 40 chars before and after
                let snippetStart = content.index(range.lowerBound, offsetBy: -40, limitedBy: content.startIndex) ?? content.startIndex
                let snippetEnd = content.index(range.upperBound, offsetBy: 40, limitedBy: content.endIndex) ?? content.endIndex
                let snippet = String(content[snippetStart..<snippetEnd])

                // Map range back to original string indices
                let originalRange = Range(uncheckedBounds: (range.lowerBound, range.upperBound))

                found.append(SearchResult(
                    messageId: message.id,
                    matchRange: originalRange,
                    snippet: snippet,
                    timestamp: message.timestamp,
                    sender: message.sender
                ))

                searchStart = range.upperBound
            }
        }

        // Sort by recency (newest first)
        results = found.sorted { ($0.timestamp ?? .distantPast) > ($1.timestamp ?? .distantPast) }
        currentIndex = results.isEmpty ? 0 : 0
        isSearching = false
    }

    /// Search across multiple sessions using the gateway client.
    public func searchGlobal(viewModel: ChatViewModel) {
        searchTask?.cancel()
        isSearching = true

        searchTask = Task { [weak self] in
            guard let self else { return }
            let trimmed = self.query.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmed.isEmpty else {
                self.results = []
                self.currentIndex = 0
                self.isSearching = false
                return
            }

            let q = trimmed.lowercased()

            // First search local messages
            var allResults: [SearchResult] = []
            let localMessages = Array(viewModel.messages.suffix(Self.maxMessagesPerSession))
            allResults.append(contentsOf: searchInMessages(localMessages, query: q, sessionKey: viewModel.activeSession?.sessionKey))

            // Then fetch other sessions
            do {
                let sessions = try await viewModel.call("sessions.list", params: [:])
                guard !Task.isCancelled else { return }

                if let sessionsList = sessions?.dict?["sessions"] as? [[String: Any]] {
                    let activeKey = viewModel.activeSession?.sessionKey ?? ""
                    let otherSessions = sessionsList
                        .compactMap { $0["sessionKey"] as? String ?? $0["key"] as? String }
                        .filter { $0 != activeKey }
                        .prefix(Self.maxGlobalSessions)

                    for sessionKey in otherSessions {
                        guard !Task.isCancelled else { return }
                        do {
                            let historyResult = try await viewModel.call("chat.history", params: [
                                "sessionKey": sessionKey,
                                "limit": Self.maxMessagesPerGlobalSession
                            ])
                            if let rawMessages = historyResult?.dict?["messages"] as? [[String: Any]] {
                                let messages = rawMessages.compactMap { msg -> ChatMessage? in
                                    guard let role = msg["role"] as? String else { return nil }
                                    let content: String
                                    if let text = msg["content"] as? String {
                                        content = text
                                    } else if let blocks = msg["content"] as? [[String: Any]] {
                                        content = blocks.compactMap { ($0["type"] as? String == "text") ? $0["text"] as? String : nil }.joined()
                                    } else {
                                        content = ""
                                    }
                                    var timestamp: Date? = nil
                                    if let ts = msg["timestamp"] as? Double { timestamp = Date(timeIntervalSince1970: ts / 1000) }
                                    else if let ts = msg["ts"] as? Double { timestamp = Date(timeIntervalSince1970: ts / 1000) }
                                    let id = msg["id"] as? String ?? UUID().uuidString
                                    return ChatMessage(
                                        id: id,
                                        content: content,
                                        sender: role == "user" ? .user : .bot(name: "Bot"),
                                        timestamp: timestamp ?? Date(),
                                        status: .delivered
                                    )
                                }
                                allResults.append(contentsOf: searchInMessages(messages, query: q, sessionKey: sessionKey))
                            }
                        } catch {
                            // Skip sessions that fail to load
                            continue
                        }
                    }
                }
            } catch {
                // Fall back to local-only results
            }

            guard !Task.isCancelled else { return }

            // Sort by recency (newest first)
            self.results = allResults.sorted { ($0.timestamp ?? .distantPast) > ($1.timestamp ?? .distantPast) }
            self.currentIndex = self.results.isEmpty ? 0 : 0
            self.isSearching = false
        }
    }

    // MARK: - Navigation

    /// Move to the next match, wrapping around.
    public func nextMatch() {
        guard !results.isEmpty else { return }
        currentIndex = (currentIndex + 1) % results.count
    }

    /// Move to the previous match, wrapping around.
    public func previousMatch() {
        guard !results.isEmpty else { return }
        currentIndex = (currentIndex - 1 + results.count) % results.count
    }

    // MARK: - Reset

    /// Clear all search state.
    public func reset() {
        searchTask?.cancel()
        query = ""
        results = []
        currentIndex = 0
        isSearching = false
        scope = .thisChat
    }

    // MARK: - Private Helpers

    private func searchInMessages(_ messages: [ChatMessage], query: String, sessionKey: String?) -> [SearchResult] {
        var found: [SearchResult] = []
        for message in messages {
            let content = message.content
            let lower = content.lowercased()
            var searchStart = lower.startIndex

            while searchStart < lower.endIndex,
                  let range = lower.range(of: query, range: searchStart..<lower.endIndex) {
                let snippetStart = content.index(range.lowerBound, offsetBy: -40, limitedBy: content.startIndex) ?? content.startIndex
                let snippetEnd = content.index(range.upperBound, offsetBy: 40, limitedBy: content.endIndex) ?? content.endIndex
                let snippet = String(content[snippetStart..<snippetEnd])

                found.append(SearchResult(
                    messageId: message.id,
                    sessionKey: sessionKey,
                    matchRange: Range(uncheckedBounds: (range.lowerBound, range.upperBound)),
                    snippet: snippet,
                    timestamp: message.timestamp,
                    sender: message.sender
                ))

                searchStart = range.upperBound
            }
        }
        return found
    }
}

// MARK: - Notification

public extension Notification.Name {
    static let searchEngineQueryReady = Notification.Name("searchEngineQueryReady")
}
