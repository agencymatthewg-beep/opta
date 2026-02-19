import Foundation

// MARK: - Calendar Event Model

struct CalendarEvent: Identifiable, Codable, Hashable {
    let id: String
    let summary: String
    let description: String?
    let start: String?
    let end: String?
    let isAllDay: Bool
    let location: String?
    let htmlLink: String?

    // EventKit sync tracking fields (will be enabled when EventSource.swift compiles correctly)
    var ekEventIdentifier: String?
    var source: EventSource?
    var lastSyncedAt: Date?
    
    var startDate: Date? {
        start?.isoDate
    }
    
    var endDate: Date? {
        end?.isoDate
    }
    
    var displayTime: String {
        if isAllDay {
            return "All Day"
        }
        guard let date = startDate else {
            return "TBD"
        }
        return date.timeString
    }
    
    var displayDate: String {
        guard let date = startDate else {
            return "TBD"
        }
        if date.isToday {
            return "Today, \(date.timeString)"
        }
        if date.isTomorrow {
            return "Tomorrow, \(date.timeString)"
        }
        return date.shortDateString + ", " + date.timeString
    }
}

// MARK: - Calendar Response

struct CalendarResponse: Codable {
    let success: Bool
    let events: [CalendarEvent]
    let count: Int
}
