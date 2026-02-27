import Foundation

// MARK: - Sync State

/// Represents the current state of the sync operation for calendar events and reminders.
/// Used to provide UI feedback and track sync progress.
enum SyncState: String, Codable, Equatable {
    /// No sync operation in progress
    case idle

    /// Sync operation is currently running
    case syncing

    /// Sync completed successfully
    case success

    /// Sync failed with an error
    case error

    /// Sync completed but conflicts were detected
    case conflicted

    var displayName: String {
        switch self {
        case .idle:
            return "Idle"
        case .syncing:
            return "Syncing..."
        case .success:
            return "Synced"
        case .error:
            return "Error"
        case .conflicted:
            return "Conflicts Detected"
        }
    }

    var icon: String {
        switch self {
        case .idle:
            return "pause.circle"
        case .syncing:
            return "arrow.triangle.2.circlepath"
        case .success:
            return "checkmark.circle"
        case .error:
            return "exclamationmark.triangle"
        case .conflicted:
            return "exclamationmark.arrow.triangle.2.circlepath"
        }
    }

    var color: String {
        switch self {
        case .idle:
            return "optaTextMuted"
        case .syncing:
            return "optaNeonBlue"
        case .success:
            return "optaNeonGreen"
        case .error:
            return "optaNeonRed"
        case .conflicted:
            return "optaNeonAmber"
        }
    }

    var isActive: Bool {
        self == .syncing
    }

    var hasError: Bool {
        self == .error || self == .conflicted
    }
}

// MARK: - Event Conflict

/// Represents a conflict between an Opta backend event and an Apple Calendar event.
/// Conflicts occur when the same event is modified in both systems.
struct EventConflict: Identifiable, Codable {
    let id: String
    let backendEvent: CalendarEvent
    let appleEvent: CalendarEventSnapshot
    let conflictType: ConflictType
    let detectedAt: Date

    enum ConflictType: String, Codable {
        case titleMismatch
        case timeMismatch
        case locationMismatch
        case descriptionMismatch
        case multipleMismatches

        var displayName: String {
            switch self {
            case .titleMismatch:
                return "Title Changed"
            case .timeMismatch:
                return "Time Changed"
            case .locationMismatch:
                return "Location Changed"
            case .descriptionMismatch:
                return "Description Changed"
            case .multipleMismatches:
                return "Multiple Changes"
            }
        }
    }
}

// MARK: - Calendar Event Snapshot

/// A lightweight snapshot of a calendar event for conflict comparison.
/// This avoids directly storing EKEvent objects which can't be persisted.
struct CalendarEventSnapshot: Codable {
    let identifier: String
    let title: String
    let startDate: Date?
    let endDate: Date?
    let location: String?
    let notes: String?
    let lastModifiedDate: Date?
}
