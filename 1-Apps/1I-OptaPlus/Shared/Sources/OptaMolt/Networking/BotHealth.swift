//
//  BotHealth.swift
//  OptaMolt
//
//  Bot health scoring based on connection stability, latency, and error rate.
//

import Foundation
import SwiftUI

// MARK: - Bot Health

/// Health score for a bot connection (0–100).
public struct BotHealth: Sendable {
    public let score: Int
    public let reconnectCount: Int
    public let errorCount: Int
    public let averageLatency: Double? // seconds

    public init(reconnectCount: Int, errorCount: Int, averageLatency: Double?, uptimeSeconds: TimeInterval) {
        self.reconnectCount = reconnectCount
        self.errorCount = errorCount
        self.averageLatency = averageLatency

        // Stability: lose 8 points per reconnect (max -40)
        let stabilityPenalty = min(40, reconnectCount * 8)
        // Errors: lose 5 points per error (max -30)
        let errorPenalty = min(30, errorCount * 5)
        // Latency: lose points for slow responses (max -30)
        let latencyPenalty: Int
        if let lat = averageLatency {
            if lat < 1.0 { latencyPenalty = 0 }
            else if lat < 3.0 { latencyPenalty = 10 }
            else if lat < 8.0 { latencyPenalty = 20 }
            else { latencyPenalty = 30 }
        } else {
            latencyPenalty = 0
        }

        self.score = max(0, 100 - stabilityPenalty - errorPenalty - latencyPenalty)
    }

    public var color: Color {
        if score >= 70 { return .green }
        if score >= 40 { return .orange }
        return .red
    }

    public var label: String {
        if score >= 70 { return "Healthy" }
        if score >= 40 { return "Degraded" }
        return "Unhealthy"
    }

    public static let unknown = BotHealth(reconnectCount: 0, errorCount: 0, averageLatency: nil, uptimeSeconds: 0)
}

// MARK: - Activity Event

/// A single activity event for the dashboard feed.
public struct ActivityEvent: Identifiable {
    public let id = UUID()
    public let timestamp: Date
    public let botName: String
    public let botEmoji: String
    public let message: String
    public let kind: Kind

    public enum Kind {
        case connected, disconnected, messageSent, messageReceived, error
    }

    public init(timestamp: Date = Date(), botName: String, botEmoji: String, message: String, kind: Kind) {
        self.timestamp = timestamp
        self.botName = botName
        self.botEmoji = botEmoji
        self.message = message
        self.kind = kind
    }

    public var icon: String {
        switch kind {
        case .connected: return "wifi"
        case .disconnected: return "wifi.slash"
        case .messageSent: return "arrow.up.circle"
        case .messageReceived: return "arrow.down.circle"
        case .error: return "exclamationmark.triangle"
        }
    }

    public var iconColor: Color {
        switch kind {
        case .connected: return .green
        case .disconnected: return .gray
        case .messageSent: return .blue
        case .messageReceived: return .purple
        case .error: return .red
        }
    }

    /// Relative timestamp string.
    public var relativeTime: String {
        let interval = Date().timeIntervalSince(timestamp)
        if interval < 5 { return "just now" }
        if interval < 60 { return "\(Int(interval))s ago" }
        if interval < 3600 { return "\(Int(interval / 60))m ago" }
        if interval < 86400 { return "\(Int(interval / 3600))h ago" }
        return "\(Int(interval / 86400))d ago"
    }
}

// MARK: - Activity Feed Manager

/// Manages a shared activity feed across all bots.
@MainActor
public final class ActivityFeedManager: ObservableObject {
    public static let shared = ActivityFeedManager()

    @Published public var events: [ActivityEvent] = []
    private let maxEvents = 20

    private init() {}

    public func add(_ event: ActivityEvent) {
        events.insert(event, at: 0)
        if events.count > maxEvents {
            events = Array(events.prefix(maxEvents))
        }
    }

    public func addEvent(botName: String, botEmoji: String, message: String, kind: ActivityEvent.Kind) {
        add(ActivityEvent(botName: botName, botEmoji: botEmoji, message: message, kind: kind))
    }
}

// MARK: - Uptime Formatter

public struct UptimeFormatter {
    public static func format(_ seconds: TimeInterval) -> String {
        if seconds < 60 { return "\(Int(seconds))s" }
        let minutes = Int(seconds) / 60
        if minutes < 60 { return "\(minutes)m" }
        let hours = minutes / 60
        let remainMinutes = minutes % 60
        if hours < 24 { return "\(hours)h \(remainMinutes)m" }
        let days = hours / 24
        let remainHours = hours % 24
        return "\(days)d \(remainHours)h"
    }
}
