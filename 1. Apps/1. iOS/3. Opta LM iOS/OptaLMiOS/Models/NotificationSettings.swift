import Foundation
import SwiftUI
import UserNotifications

// MARK: - Notification Type Enum

enum OptaNotificationType: String, CaseIterable, Codable, Identifiable {
    case taskReminder = "task-reminder"
    case eventReminder = "event-reminder"
    case dailyBriefing = "daily-briefing"
    case aiInsight = "ai-insight"
    case goalMilestone = "goal-milestone"
    case habitStreak = "habit-streak"
    case focusSession = "focus-session"
    case weatherUpdate = "weather-update"
    case lowPriority = "low-priority"

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .taskReminder: return "Task Reminders"
        case .eventReminder: return "Event Reminders"
        case .dailyBriefing: return "Daily Briefing"
        case .aiInsight: return "AI Insights"
        case .goalMilestone: return "Goal Milestones"
        case .habitStreak: return "Habit Streaks"
        case .focusSession: return "Focus Sessions"
        case .weatherUpdate: return "Weather Updates"
        case .lowPriority: return "Low Priority"
        }
    }

    var description: String {
        switch self {
        case .taskReminder: return "Reminders for upcoming tasks"
        case .eventReminder: return "Alerts for calendar events"
        case .dailyBriefing: return "Morning summary of your day"
        case .aiInsight: return "AI-generated suggestions"
        case .goalMilestone: return "Progress on your goals"
        case .habitStreak: return "Habit streak celebrations"
        case .focusSession: return "Focus and break reminders"
        case .weatherUpdate: return "Location-based weather alerts"
        case .lowPriority: return "Background updates"
        }
    }

    var icon: String {
        switch self {
        case .taskReminder: return "checklist"
        case .eventReminder: return "calendar.badge.clock"
        case .dailyBriefing: return "sun.horizon.fill"
        case .aiInsight: return "sparkles"
        case .goalMilestone: return "flag.checkered"
        case .habitStreak: return "flame.fill"
        case .focusSession: return "hourglass"
        case .weatherUpdate: return "cloud.sun.fill"
        case .lowPriority: return "bell.badge"
        }
    }

    var color: Color {
        switch self {
        case .taskReminder: return .optaPrimary
        case .eventReminder: return .optaNeonBlue
        case .dailyBriefing: return .optaNeonCyan
        case .aiInsight: return .purple
        case .goalMilestone: return .green
        case .habitStreak: return .orange
        case .focusSession: return .blue
        case .weatherUpdate: return .cyan
        case .lowPriority: return .gray
        }
    }

    var defaultCategory: String {
        switch self {
        case .taskReminder: return "TASK"
        case .eventReminder: return "EVENT"
        case .dailyBriefing: return "BRIEFING"
        case .aiInsight: return "AI_INSIGHT"
        case .goalMilestone, .habitStreak: return "ACHIEVEMENT"
        case .focusSession: return "FOCUS"
        case .weatherUpdate: return "WEATHER"
        case .lowPriority: return "UPDATE"
        }
    }

    var isCritical: Bool {
        switch self {
        case .taskReminder, .eventReminder: return true
        default: return false
        }
    }
}

// MARK: - Per-Type Settings

struct NotificationTypeSettings: Codable, Equatable {
    var isEnabled: Bool
    var soundEnabled: Bool
    var debounceInterval: TimeInterval // seconds
    var deliveryStyle: DeliveryStyle

    enum DeliveryStyle: String, Codable {
        case banner = "Banner"
        case alert = "Alert"
        case none = "None"
    }

    static func `default`(for type: OptaNotificationType) -> NotificationTypeSettings {
        switch type {
        case .taskReminder, .eventReminder:
            return NotificationTypeSettings(
                isEnabled: true,
                soundEnabled: true,
                debounceInterval: 0,
                deliveryStyle: .alert
            )
        case .dailyBriefing:
            return NotificationTypeSettings(
                isEnabled: true,
                soundEnabled: true,
                debounceInterval: 0,
                deliveryStyle: .banner
            )
        case .aiInsight, .goalMilestone, .habitStreak:
            return NotificationTypeSettings(
                isEnabled: true,
                soundEnabled: false,
                debounceInterval: 300, // 5 minutes
                deliveryStyle: .banner
            )
        case .focusSession:
            return NotificationTypeSettings(
                isEnabled: false,
                soundEnabled: true,
                debounceInterval: 0,
                deliveryStyle: .banner
            )
        case .weatherUpdate:
            return NotificationTypeSettings(
                isEnabled: true,
                soundEnabled: false,
                debounceInterval: 3600, // 1 hour
                deliveryStyle: .banner
            )
        case .lowPriority:
            return NotificationTypeSettings(
                isEnabled: false,
                soundEnabled: false,
                debounceInterval: 600, // 10 minutes
                deliveryStyle: .none
            )
        }
    }
}

// MARK: - Quiet Hours Configuration

struct QuietHoursConfig: Codable, Equatable {
    var enabled: Bool
    var startHour: Int  // 0-23
    var startMinute: Int // 0-59
    var endHour: Int
    var endMinute: Int
    var allowCritical: Bool // Allow critical alerts during quiet hours

    static let `default` = QuietHoursConfig(
        enabled: false,
        startHour: 22,  // 10 PM
        startMinute: 0,
        endHour: 7,     // 7 AM
        endMinute: 0,
        allowCritical: true
    )

    func isQuietTime() -> Bool {
        guard enabled else { return false }

        let calendar = Calendar.current
        let now = Date()
        let components = calendar.dateComponents([.hour, .minute], from: now)

        guard let currentHour = components.hour,
              let currentMinute = components.minute else {
            return false
        }

        let currentMinutes = currentHour * 60 + currentMinute
        let startMinutes = startHour * 60 + startMinute
        let endMinutes = endHour * 60 + endMinute

        if startMinutes < endMinutes {
            // Same day range (e.g., 9 AM - 5 PM)
            return currentMinutes >= startMinutes && currentMinutes < endMinutes
        } else {
            // Overnight range (e.g., 10 PM - 7 AM)
            return currentMinutes >= startMinutes || currentMinutes < endMinutes
        }
    }

    func shouldAllow(_ type: OptaNotificationType) -> Bool {
        if !enabled { return true }
        if !isQuietTime() { return true }
        return allowCritical && type.isCritical
    }
}

// MARK: - Main Settings Model

@Observable
final class NotificationSettings: Codable {

    // Per-type settings
    var typeSettings: [String: NotificationTypeSettings]

    // Global settings
    var masterEnabled: Bool
    var badgeEnabled: Bool
    var quietHours: QuietHoursConfig
    var foregroundNotifications: Bool // Show notifications when app is in foreground

    // MARK: - Initialization

    init() {
        // Initialize with defaults
        self.masterEnabled = true
        self.badgeEnabled = true
        self.quietHours = .default
        self.foregroundNotifications = true

        // Create default settings for each notification type
        var settings: [String: NotificationTypeSettings] = [:]
        for type in OptaNotificationType.allCases {
            settings[type.rawValue] = .default(for: type)
        }
        self.typeSettings = settings
    }

    // MARK: - Codable

    enum CodingKeys: String, CodingKey {
        case typeSettings
        case masterEnabled
        case badgeEnabled
        case quietHours
        case foregroundNotifications
    }

    required init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        typeSettings = try container.decode([String: NotificationTypeSettings].self, forKey: .typeSettings)
        masterEnabled = try container.decode(Bool.self, forKey: .masterEnabled)
        badgeEnabled = try container.decode(Bool.self, forKey: .badgeEnabled)
        quietHours = try container.decode(QuietHoursConfig.self, forKey: .quietHours)
        foregroundNotifications = try container.decode(Bool.self, forKey: .foregroundNotifications)
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(typeSettings, forKey: .typeSettings)
        try container.encode(masterEnabled, forKey: .masterEnabled)
        try container.encode(badgeEnabled, forKey: .badgeEnabled)
        try container.encode(quietHours, forKey: .quietHours)
        try container.encode(foregroundNotifications, forKey: .foregroundNotifications)
    }

    // MARK: - Helpers

    func settings(for type: OptaNotificationType) -> NotificationTypeSettings {
        typeSettings[type.rawValue] ?? .default(for: type)
    }

    func updateSettings(for type: OptaNotificationType, _ settings: NotificationTypeSettings) {
        typeSettings[type.rawValue] = settings
    }

    func shouldShowNotification(for type: OptaNotificationType) -> Bool {
        guard masterEnabled else { return false }
        guard settings(for: type).isEnabled else { return false }
        guard quietHours.shouldAllow(type) else { return false }
        return true
    }
}
