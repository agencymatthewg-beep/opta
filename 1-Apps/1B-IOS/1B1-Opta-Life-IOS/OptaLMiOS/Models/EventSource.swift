import Foundation

// MARK: - Event Source

/// Represents the source of a calendar event or task in the hybrid sync system.
/// Events and tasks can originate from the Opta backend (Google Calendar/Tasks),
/// native Apple Calendar/Reminders, or exist in both systems simultaneously.
enum EventSource: String, Codable, CaseIterable {
    /// Event/task exists only in Opta backend (Google Calendar/Tasks)
    case backend

    /// Event/task exists only in Apple Calendar/Reminders
    case appleCalendar

    /// Event/task exists in both Opta backend and Apple Calendar/Reminders
    /// This indicates successful two-way sync
    case both

    var displayName: String {
        switch self {
        case .backend:
            return "Opta Backend"
        case .appleCalendar:
            return "Apple Calendar"
        case .both:
            return "Synced"
        }
    }

    var badge: String {
        switch self {
        case .backend:
            return "Backend"
        case .appleCalendar:
            return "Apple"
        case .both:
            return "Synced"
        }
    }

    var icon: String {
        switch self {
        case .backend:
            return "cloud"
        case .appleCalendar:
            return "calendar"
        case .both:
            return "arrow.triangle.2.circlepath"
        }
    }
}
