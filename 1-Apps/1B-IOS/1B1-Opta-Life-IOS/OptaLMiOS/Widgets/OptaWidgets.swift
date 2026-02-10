import WidgetKit
import SwiftUI

// MARK: - Widget Bundle
// Note: This should be in a separate Widget Extension target with @main
// For now, we define the bundle without @main for use in the main app

struct OptaLMWidgetBundle {
    static var widgets: [any Widget.Type] {
        [TasksWidget.self, BriefingWidget.self, CalendarWidget.self, QuickActionsWidget.self]
    }
}

// MARK: - Shared Widget Extensions
// Using colors from Color+Extensions.swift (init(hex:) defined there)

extension Color {
    static let widgetVoid = Color(hex: "0a0a0c")
    static let widgetPrimary = Color(hex: "8B5CF6")
    static let widgetNeonGreen = Color(hex: "22C55E")
    static let widgetNeonBlue = Color(hex: "3B82F6")
    static let widgetNeonAmber = Color(hex: "F59E0B")
}

// MARK: - Widget Data Models

struct WidgetTaskData: Codable {
    let content: String
    let priority: Int
    let dueString: String?
}

struct WidgetEventData: Codable {
    let summary: String
    let time: String
    let isAllDay: Bool
}

struct WidgetBriefingData: Codable {
    let greeting: String
    let tasksToday: Int
    let eventsCount: Int
    let unreadEmails: Int
    let summary: String
}
