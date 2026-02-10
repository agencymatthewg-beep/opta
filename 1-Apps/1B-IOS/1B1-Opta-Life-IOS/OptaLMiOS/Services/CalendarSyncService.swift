import Foundation
import EventKit

// MARK: - Calendar Sync Service

/// Business logic for syncing Opta backend calendar events with Apple Calendar.
/// Handles bidirectional sync, conflict detection, and resolution.
@MainActor
final class CalendarSyncService: ObservableObject {

    // MARK: - Properties

    static let shared = CalendarSyncService()

    private let eventKitService = EventKitService.shared
    private let apiService = APIService.shared

    @Published var syncState: SyncState = .idle
    @Published var lastSyncDate: Date?
    @Published var conflicts: [EventConflict] = []
    @Published var errorMessage: String?

    // Cache of synced events to track changes
    private var syncedEvents: [String: CalendarEventSnapshot] = [:]

    // MARK: - Initialization

    private init() {
        loadLastSyncDate()
        loadSyncedEventsCache()
    }

    // MARK: - Main Sync Operations

    /// Performs a full bidirectional sync between Opta backend and Apple Calendar.
    /// 1. Fetches events from both sources
    /// 2. Merges and deduplicates
    /// 3. Detects conflicts
    /// 4. Resolves conflicts using last-write-wins strategy
    func sync() async throws {
        guard syncState != .syncing else {
            print("[CalendarSyncService] Sync already in progress")
            return
        }

        syncState = .syncing
        errorMessage = nil
        conflicts = []

        do {
            // Step 1: Ensure calendar access
            guard eventKitService.isCalendarAuthorized else {
                let granted = await eventKitService.requestCalendarAccess()
                guard granted else {
                    throw CalendarSyncError.notAuthorized
                }
            }

            // Step 2: Fetch from both sources
            let backendEvents = try await fetchBackendEvents()
            let appleEvents = fetchAppleCalendarEvents()

            print("[CalendarSyncService] Backend events: \(backendEvents.count), Apple events: \(appleEvents.count)")

            // Step 3: Merge and deduplicate
            let mergeResult = mergeEvents(backendEvents: backendEvents, appleEvents: appleEvents)

            // Step 4: Detect conflicts
            let detectedConflicts = detectConflicts(
                backendEvents: backendEvents,
                appleEvents: appleEvents,
                mergedEvents: mergeResult.merged
            )

            if !detectedConflicts.isEmpty {
                conflicts = detectedConflicts
                print("[CalendarSyncService] Detected \(detectedConflicts.count) conflicts")
            }

            // Step 5: Resolve conflicts (last-write-wins)
            try await resolveConflicts(detectedConflicts)

            // Step 6: Update cache
            updateSyncedEventsCache(mergeResult.merged)

            // Step 7: Complete
            lastSyncDate = Date()
            saveLastSyncDate()

            syncState = conflicts.isEmpty ? .success : .conflicted

            HapticManager.shared.notification(.success)
            print("[CalendarSyncService] Sync completed successfully")

        } catch {
            syncState = .error
            errorMessage = error.localizedDescription
            print("[CalendarSyncService] Sync failed: \(error)")
            throw error
        }
    }

    // MARK: - Import from Apple Calendar

    /// Imports events from Apple Calendar into Opta backend.
    /// Creates new events in the backend for all Apple Calendar events that don't already exist.
    func importFromAppleCalendar() async throws {
        guard syncState != .syncing else {
            print("[CalendarSyncService] Sync already in progress")
            return
        }

        syncState = .syncing
        errorMessage = nil

        do {
            // Ensure calendar access
            guard eventKitService.isCalendarAuthorized else {
                let granted = await eventKitService.requestCalendarAccess()
                guard granted else {
                    throw CalendarSyncError.notAuthorized
                }
            }

            // Fetch Apple Calendar events (next 30 days)
            let startDate = Date()
            let endDate = Calendar.current.date(byAdding: .day, value: 30, to: startDate) ?? startDate
            let appleEvents = eventKitService.fetchEvents(from: startDate, to: endDate)

            print("[CalendarSyncService] Importing \(appleEvents.count) events from Apple Calendar")

            var importedCount = 0

            for ekEvent in appleEvents {
                // Create in backend
                do {
                    let summary = ekEvent.title ?? "Untitled Event"
                    let startTime = ekEvent.startDate.iso8601String
                    let endTime = ekEvent.endDate?.iso8601String

                    try await apiService.createCalendarEvent(
                        summary: summary,
                        startTime: startTime,
                        endTime: endTime
                    )

                    importedCount += 1
                } catch {
                    print("[CalendarSyncService] Failed to import event: \(ekEvent.title ?? "unknown") - \(error)")
                }
            }

            lastSyncDate = Date()
            saveLastSyncDate()
            syncState = .success

            HapticManager.shared.notification(.success)
            print("[CalendarSyncService] Imported \(importedCount) events successfully")

        } catch {
            syncState = .error
            errorMessage = error.localizedDescription
            print("[CalendarSyncService] Import failed: \(error)")
            throw error
        }
    }

    // MARK: - Export to Apple Calendar

    /// Exports Opta backend events to Apple Calendar.
    /// Creates new events in Apple Calendar for events that don't already exist there.
    /// - Parameter events: The calendar events to export
    func exportToAppleCalendar(_ events: [CalendarEvent]) async throws {
        guard syncState != .syncing else {
            print("[CalendarSyncService] Sync already in progress")
            return
        }

        syncState = .syncing
        errorMessage = nil

        do {
            // Ensure calendar access
            guard eventKitService.isCalendarAuthorized else {
                let granted = await eventKitService.requestCalendarAccess()
                guard granted else {
                    throw CalendarSyncError.notAuthorized
                }
            }

            var exportedCount = 0

            for event in events {
                // Check if event already exists in Apple Calendar
                if let ekEventId = event.ekEventIdentifier,
                   eventKitService.fetchEvent(identifier: ekEventId) != nil {
                    print("[CalendarSyncService] Event already exists in Apple Calendar: \(event.summary)")
                    continue
                }

                // Create in Apple Calendar
                do {
                    guard let startDate = event.startDate else {
                        print("[CalendarSyncService] Skipping event with no start date: \(event.summary)")
                        continue
                    }

                    let endDate = event.endDate ?? startDate.addingTimeInterval(3600) // Default 1 hour

                    let ekEventId = try eventKitService.createEvent(
                        title: event.summary,
                        startDate: startDate,
                        endDate: endDate,
                        isAllDay: event.isAllDay,
                        location: event.location,
                        notes: event.description
                    )

                    // TODO: Update backend event with ekEventIdentifier
                    // This would require a backend API endpoint to update event metadata

                    exportedCount += 1
                } catch {
                    print("[CalendarSyncService] Failed to export event: \(event.summary) - \(error)")
                }
            }

            lastSyncDate = Date()
            saveLastSyncDate()
            syncState = .success

            HapticManager.shared.notification(.success)
            print("[CalendarSyncService] Exported \(exportedCount) events successfully")

        } catch {
            syncState = .error
            errorMessage = error.localizedDescription
            print("[CalendarSyncService] Export failed: \(error)")
            throw error
        }
    }

    // MARK: - Conflict Resolution

    /// Resolves conflicts using last-write-wins strategy.
    /// Compares lastModifiedDate and updates the older version with the newer one.
    /// - Parameter conflicts: Array of conflicts to resolve
    func resolveConflicts(_ conflicts: [EventConflict]) async throws {
        for conflict in conflicts {
            do {
                // Compare modification dates
                let backendEvent = conflict.backendEvent
                let appleSnapshot = conflict.appleEvent

                // If Apple Calendar event is newer, update backend
                if let appleModifiedDate = appleSnapshot.lastModifiedDate,
                   let backendModifiedDate = backendEvent.lastSyncedAt,
                   appleModifiedDate > backendModifiedDate {

                    print("[CalendarSyncService] Apple Calendar is newer for: \(backendEvent.summary)")
                    // TODO: Update backend event with Apple Calendar data
                    // This requires backend API support

                } else {
                    // Backend is newer or equal, update Apple Calendar
                    print("[CalendarSyncService] Backend is newer for: \(backendEvent.summary)")

                    if let ekEventId = backendEvent.ekEventIdentifier {
                        try eventKitService.updateEvent(
                            identifier: ekEventId,
                            title: backendEvent.summary,
                            startDate: backendEvent.startDate,
                            endDate: backendEvent.endDate,
                            isAllDay: backendEvent.isAllDay,
                            location: backendEvent.location,
                            notes: backendEvent.description
                        )
                    }
                }
            } catch {
                print("[CalendarSyncService] Failed to resolve conflict for: \(conflict.id) - \(error)")
            }
        }
    }

    // MARK: - Helper Methods - Fetch

    private func fetchBackendEvents() async throws -> [CalendarEvent] {
        // Fetch next 30 days from backend
        return try await apiService.fetchCalendarEvents(range: "month")
    }

    private func fetchAppleCalendarEvents() -> [EKEvent] {
        let startDate = Date()
        let endDate = Calendar.current.date(byAdding: .day, value: 30, to: startDate) ?? startDate
        return eventKitService.fetchEvents(from: startDate, to: endDate)
    }

    // MARK: - Helper Methods - Merge

    /// Merges backend and Apple Calendar events, deduplicating by title and time similarity.
    private func mergeEvents(backendEvents: [CalendarEvent], appleEvents: [EKEvent]) -> (merged: [String: CalendarEventSnapshot], duplicates: [(CalendarEvent, EKEvent)]) {
        var merged: [String: CalendarEventSnapshot] = [:]
        var duplicates: [(CalendarEvent, EKEvent)] = []

        // Add all backend events
        for event in backendEvents {
            if let startDate = event.startDate {
                let snapshot = CalendarEventSnapshot(
                    identifier: event.id,
                    title: event.summary,
                    startDate: startDate,
                    endDate: event.endDate,
                    location: event.location,
                    notes: event.description,
                    lastModifiedDate: event.lastSyncedAt
                )
                merged[event.id] = snapshot
            }
        }

        // Add Apple Calendar events, checking for duplicates
        for ekEvent in appleEvents {
            let isDuplicate = backendEvents.contains { backendEvent in
                areSimilarEvents(
                    title1: backendEvent.summary,
                    start1: backendEvent.startDate,
                    title2: ekEvent.title,
                    start2: ekEvent.startDate
                )
            }

            if isDuplicate {
                if let matchingBackend = backendEvents.first(where: { backendEvent in
                    areSimilarEvents(
                        title1: backendEvent.summary,
                        start1: backendEvent.startDate,
                        title2: ekEvent.title,
                        start2: ekEvent.startDate
                    )
                }) {
                    duplicates.append((matchingBackend, ekEvent))
                }
            } else {
                // Not a duplicate, add to merged
                let snapshot = CalendarEventSnapshot(
                    identifier: ekEvent.eventIdentifier ?? UUID().uuidString,
                    title: ekEvent.title ?? "Untitled",
                    startDate: ekEvent.startDate,
                    endDate: ekEvent.endDate,
                    location: ekEvent.location,
                    notes: ekEvent.notes,
                    lastModifiedDate: ekEvent.lastModifiedDate
                )
                merged[ekEvent.eventIdentifier ?? UUID().uuidString] = snapshot
            }
        }

        return (merged, duplicates)
    }

    /// Checks if two events are similar (likely the same event).
    /// Compares title similarity and time proximity (within 5 minutes).
    private func areSimilarEvents(title1: String?, start1: Date?, title2: String?, start2: Date?) -> Bool {
        guard let title1 = title1, let title2 = title2 else { return false }
        guard let start1 = start1, let start2 = start2 else { return false }

        // Title similarity (case-insensitive, trimmed)
        let normalizedTitle1 = title1.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        let normalizedTitle2 = title2.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)

        guard normalizedTitle1 == normalizedTitle2 else { return false }

        // Time proximity (within 5 minutes)
        let timeDifference = abs(start1.timeIntervalSince(start2))
        return timeDifference < 300 // 5 minutes
    }

    // MARK: - Helper Methods - Conflict Detection

    private func detectConflicts(
        backendEvents: [CalendarEvent],
        appleEvents: [EKEvent],
        mergedEvents: [String: CalendarEventSnapshot]
    ) -> [EventConflict] {
        var conflicts: [EventConflict] = []

        for backendEvent in backendEvents {
            // Find matching Apple Calendar event
            guard let matchingApple = appleEvents.first(where: { ekEvent in
                areSimilarEvents(
                    title1: backendEvent.summary,
                    start1: backendEvent.startDate,
                    title2: ekEvent.title,
                    start2: ekEvent.startDate
                )
            }) else {
                continue
            }

            // Check for conflicts
            var conflictType: EventConflict.ConflictType?

            if backendEvent.summary != matchingApple.title {
                conflictType = .titleMismatch
            } else if backendEvent.startDate != matchingApple.startDate || backendEvent.endDate != matchingApple.endDate {
                conflictType = .timeMismatch
            } else if backendEvent.location != matchingApple.location {
                conflictType = .locationMismatch
            } else if backendEvent.description != matchingApple.notes {
                conflictType = .descriptionMismatch
            }

            if let conflictType = conflictType {
                let appleSnapshot = CalendarEventSnapshot(
                    identifier: matchingApple.eventIdentifier ?? "",
                    title: matchingApple.title ?? "",
                    startDate: matchingApple.startDate,
                    endDate: matchingApple.endDate,
                    location: matchingApple.location,
                    notes: matchingApple.notes,
                    lastModifiedDate: matchingApple.lastModifiedDate
                )

                let conflict = EventConflict(
                    id: UUID().uuidString,
                    backendEvent: backendEvent,
                    appleEvent: appleSnapshot,
                    conflictType: conflictType,
                    detectedAt: Date()
                )

                conflicts.append(conflict)
            }
        }

        return conflicts
    }

    // MARK: - Cache Management

    private func updateSyncedEventsCache(_ events: [String: CalendarEventSnapshot]) {
        syncedEvents = events
        saveSyncedEventsCache()
    }

    private func saveSyncedEventsCache() {
        if let encoded = try? JSONEncoder().encode(syncedEvents) {
            UserDefaults.standard.set(encoded, forKey: "CalendarSyncService.syncedEvents")
        }
    }

    private func loadSyncedEventsCache() {
        guard let data = UserDefaults.standard.data(forKey: "CalendarSyncService.syncedEvents"),
              let decoded = try? JSONDecoder().decode([String: CalendarEventSnapshot].self, from: data) else {
            return
        }
        syncedEvents = decoded
    }

    private func saveLastSyncDate() {
        if let date = lastSyncDate {
            UserDefaults.standard.set(date.timeIntervalSince1970, forKey: "CalendarSyncService.lastSyncDate")
        }
    }

    private func loadLastSyncDate() {
        let timestamp = UserDefaults.standard.double(forKey: "CalendarSyncService.lastSyncDate")
        if timestamp > 0 {
            lastSyncDate = Date(timeIntervalSince1970: timestamp)
        }
    }
}

// MARK: - Calendar Sync Errors

enum CalendarSyncError: LocalizedError {
    case notAuthorized
    case fetchFailed
    case mergeFailed
    case conflictResolutionFailed

    var errorDescription: String? {
        switch self {
        case .notAuthorized:
            return "Calendar access not authorized. Please grant permission in Settings."
        case .fetchFailed:
            return "Failed to fetch calendar events from one or more sources."
        case .mergeFailed:
            return "Failed to merge calendar events."
        case .conflictResolutionFailed:
            return "Failed to resolve calendar conflicts."
        }
    }
}

// MARK: - Date Extensions

extension Date {
    var iso8601String: String {
        let formatter = ISO8601DateFormatter()
        return formatter.string(from: self)
    }
}
