//
//  ChatViewModel+Sessions.swift
//  OptaMolt
//
//  Session management logic extracted from ChatViewModel.
//  Handles creating, switching, deleting, renaming, pinning sessions,
//  and session persistence.
//

import Foundation
import SwiftUI

// MARK: - ChatViewModel Session Management

extension ChatViewModel {

    // MARK: - Session Management

    /// Switch to a different session.
    public func switchSession(_ session: ChatSession) {
        // Save current session's messages
        if let current = activeSession {
            sessionMessages[current.id] = messages
            sessionStreamContent[current.id] = streamingContent
        }

        activeSession = session
        UserDefaults.standard.set(session.id, forKey: activeSessionKey)

        // Restore cached messages or load fresh
        if let cached = sessionMessages[session.id] {
            messages = cached
            streamingContent = sessionStreamContent[session.id] ?? ""
        } else {
            messages = []
            streamingContent = ""
            Task { await loadHistory() }
        }

        // Reset bot state for new session view
        if sessionStreamContent[session.id]?.isEmpty ?? true {
            botState = .idle
        }
    }

    /// Maximum sessions per bot.
    public static var maxSessionsPerBot: Int { 5 }

    /// Create a new session. Returns nil if the limit is reached.
    public func createSession(name: String, mode: SessionMode, channelType: ChannelType? = nil) -> ChatSession? {
        guard sessions.count < Self.maxSessionsPerBot else { return nil }

        let sessionKey: String
        switch mode {
        case .synced:
            sessionKey = "main"
        case .direct:
            sessionKey = "main"
        case .isolated:
            sessionKey = "optaplus-\(UUID().uuidString.prefix(8).lowercased())"
        }

        // Assign color from remaining palette
        let usedColors = Set(sessions.compactMap(\.colorTag))
        let nextColor = ChatSessionColor.allCases.first { !usedColors.contains($0.swiftUIColor) }

        let session = ChatSession(
            name: name,
            sessionKey: sessionKey,
            mode: mode,
            channelType: channelType,
            colorTag: channelType?.accentColor ?? nextColor?.swiftUIColor
        )
        sessions.append(session)
        persistSessions()
        return session
    }

    /// Delete a session (cannot delete the last session).
    public func deleteSession(_ session: ChatSession) {
        guard sessions.count > 1 else { return }
        sessions.removeAll { $0.id == session.id }
        sessionMessages.removeValue(forKey: session.id)
        sessionStreamContent.removeValue(forKey: session.id)
        persistSessions()

        // If deleted the active session, switch to first
        if activeSession?.id == session.id {
            if let first = sessions.first {
                switchSession(first)
            }
        }
    }

    /// Rename a session.
    public func renameSession(_ session: ChatSession, to name: String) {
        if let idx = sessions.firstIndex(where: { $0.id == session.id }) {
            sessions[idx].name = name
            if activeSession?.id == session.id {
                activeSession = sessions[idx]
            }
            persistSessions()
        }
    }

    /// Toggle pin state.
    public func togglePin(_ session: ChatSession) {
        if let idx = sessions.firstIndex(where: { $0.id == session.id }) {
            sessions[idx].isPinned.toggle()
            if activeSession?.id == session.id {
                activeSession = sessions[idx]
            }
            persistSessions()
        }
    }

    // MARK: - Session Persistence

    func persistSessions() {
        if let data = try? JSONEncoder().encode(sessions) {
            UserDefaults.standard.set(data, forKey: sessionListKey)
        }
        if let activeId = activeSession?.id {
            UserDefaults.standard.set(activeId, forKey: activeSessionKey)
        }
    }
}
