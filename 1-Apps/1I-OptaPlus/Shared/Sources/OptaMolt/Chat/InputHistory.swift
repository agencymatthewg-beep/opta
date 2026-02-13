//
//  InputHistory.swift
//  OptaMolt
//
//  Stores last 50 sent messages per bot. Up/down arrow in empty input cycles through history.
//

import Foundation

public final class InputHistory: ObservableObject {
    private let maxSize = 50
    private let storageKeyPrefix = "optaplus.inputHistory."
    
    private var history: [String] = []
    @Published public var currentIndex: Int = -1  // -1 = not browsing
    private var draftText: String = ""  // saves what user was typing before browsing
    
    public let botId: String
    
    public init(botId: String) {
        self.botId = botId
        if let data = UserDefaults.standard.data(forKey: storageKeyPrefix + botId),
           let saved = try? JSONDecoder().decode([String].self, from: data) {
            self.history = saved
        }
    }
    
    public func record(_ text: String) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        // Remove duplicate if exists
        history.removeAll { $0 == trimmed }
        history.append(trimmed)
        if history.count > maxSize { history.removeFirst(history.count - maxSize) }
        currentIndex = -1
        save()
    }
    
    /// Navigate up (older). Returns text to show, or nil if no history.
    public func up(currentText: String) -> String? {
        guard !history.isEmpty else { return nil }
        if currentIndex == -1 {
            draftText = currentText
            currentIndex = history.count - 1
        } else if currentIndex > 0 {
            currentIndex -= 1
        } else {
            return history[currentIndex]
        }
        return history[currentIndex]
    }
    
    /// Navigate down (newer). Returns text to show, or nil.
    public func down() -> String? {
        guard currentIndex >= 0 else { return nil }
        if currentIndex < history.count - 1 {
            currentIndex += 1
            return history[currentIndex]
        } else {
            currentIndex = -1
            return draftText
        }
    }
    
    public func reset() {
        currentIndex = -1
    }
    
    private func save() {
        if let data = try? JSONEncoder().encode(history) {
            UserDefaults.standard.set(data, forKey: storageKeyPrefix + botId)
        }
    }
}
