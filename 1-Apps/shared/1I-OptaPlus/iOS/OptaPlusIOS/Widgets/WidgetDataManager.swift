//
//  WidgetDataManager.swift
//  OptaPlusIOS
//
//  Shared data bridge between the main app and widget extension.
//  Uses App Groups UserDefaults for cross-process communication.
//

import Foundation
import WidgetKit

// MARK: - Widget Bot Info

/// Lightweight bot snapshot for widget display (Codable for App Group sharing).
struct WidgetBotInfo: Codable, Identifiable {
    let id: String
    let name: String
    let emoji: String
    let isConnected: Bool
    let lastMessage: String?
    let lastMessageDate: Date?
    let accentColorHex: String
    
    var statusDot: String {
        isConnected ? "🟢" : "🔴"
    }
}

// MARK: - Widget Quick Action

/// A preset message that can be triggered from the quick action widget.
struct WidgetQuickAction: Codable, Identifiable {
    let id: String
    let label: String
    let emoji: String
    let botId: String
    let message: String
}

// MARK: - Widget Data Manager

/// Manages shared data between the app and widget extension via App Group UserDefaults.
@MainActor
final class WidgetDataManager {
    static let shared = WidgetDataManager()
    
    // App Group identifier — must match entitlements
    private let appGroupId = "group.com.optamolt.optaplus"
    private let botsKey = "widget.bots"
    private let quickActionsKey = "widget.quickActions"
    private let lastUpdateKey = "widget.lastUpdate"
    
    private var userDefaults: UserDefaults? {
        UserDefaults(suiteName: appGroupId)
    }
    
    // MARK: - Write (from main app)
    
    /// Update widget data with current bot states.
    func updateBotStatuses(_ bots: [WidgetBotInfo]) {
        guard let defaults = userDefaults else { return }
        if let data = try? JSONEncoder().encode(bots) {
            defaults.set(data, forKey: botsKey)
            defaults.set(Date(), forKey: lastUpdateKey)
        }
        // Tell WidgetKit to refresh
        WidgetCenter.shared.reloadAllTimelines()
    }
    
    /// Update quick actions.
    func updateQuickActions(_ actions: [WidgetQuickAction]) {
        guard let defaults = userDefaults else { return }
        if let data = try? JSONEncoder().encode(actions) {
            defaults.set(data, forKey: quickActionsKey)
        }
    }
    
    // MARK: - Read (from widget extension)
    
    /// Load bot info snapshots.
    func loadBots() -> [WidgetBotInfo] {
        guard let defaults = userDefaults,
              let data = defaults.data(forKey: botsKey),
              let bots = try? JSONDecoder().decode([WidgetBotInfo].self, from: data) else {
            return []
        }
        return bots
    }
    
    /// Load quick actions.
    func loadQuickActions() -> [WidgetQuickAction] {
        guard let defaults = userDefaults,
              let data = defaults.data(forKey: quickActionsKey),
              let actions = try? JSONDecoder().decode([WidgetQuickAction].self, from: data) else {
            return defaultQuickActions()
        }
        return actions
    }
    
    /// Last update timestamp.
    func lastUpdate() -> Date? {
        userDefaults?.object(forKey: lastUpdateKey) as? Date
    }
    
    // MARK: - Defaults
    
    private func defaultQuickActions() -> [WidgetQuickAction] {
        [
            WidgetQuickAction(id: "status", label: "Status", emoji: "📊", botId: "", message: "status"),
            WidgetQuickAction(id: "hello", label: "Hello", emoji: "👋", botId: "", message: "Hello!"),
            WidgetQuickAction(id: "tasks", label: "Tasks", emoji: "📋", botId: "", message: "What tasks are running?"),
            WidgetQuickAction(id: "summary", label: "Summary", emoji: "📝", botId: "", message: "Give me a summary of today"),
        ]
    }
}
