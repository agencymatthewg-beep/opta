//
//  AutomationModels.swift
//  OptaMolt
//
//  Shared data models for cron job automations.
//  Used by both iOS BotAutomationsPage and macOS AutomationsView.
//

import Foundation

// MARK: - Cron Job Model

/// A cron job item representing a scheduled automation task for a bot.
public struct CronJobItem: Identifiable {
    public let id: String
    public let name: String
    public var enabled: Bool
    public let scheduleText: String
    public let scheduleKind: String
    public let sessionTarget: String
    public let payloadKind: String
    public let model: String?
    public let lastRunAt: Date?
    public let nextRunAt: Date?
    public let botName: String
    public let botEmoji: String
    public let botId: String
    public let rawSchedule: [String: Any]?
    public let rawPayload: [String: Any]?

    public var displayName: String {
        name.isEmpty ? id : name
    }

    public init(
        id: String,
        name: String,
        enabled: Bool,
        scheduleText: String,
        scheduleKind: String,
        sessionTarget: String,
        payloadKind: String,
        model: String?,
        lastRunAt: Date?,
        nextRunAt: Date?,
        botName: String,
        botEmoji: String,
        botId: String,
        rawSchedule: [String: Any]?,
        rawPayload: [String: Any]?
    ) {
        self.id = id
        self.name = name
        self.enabled = enabled
        self.scheduleText = scheduleText
        self.scheduleKind = scheduleKind
        self.sessionTarget = sessionTarget
        self.payloadKind = payloadKind
        self.model = model
        self.lastRunAt = lastRunAt
        self.nextRunAt = nextRunAt
        self.botName = botName
        self.botEmoji = botEmoji
        self.botId = botId
        self.rawSchedule = rawSchedule
        self.rawPayload = rawPayload
    }
}

// MARK: - Scheduler Status

/// Status of the cron scheduler for a bot.
public struct SchedulerStatus {
    public let running: Bool
    public let jobCount: Int
    public let activeCount: Int

    public init(running: Bool, jobCount: Int, activeCount: Int) {
        self.running = running
        self.jobCount = jobCount
        self.activeCount = activeCount
    }
}
