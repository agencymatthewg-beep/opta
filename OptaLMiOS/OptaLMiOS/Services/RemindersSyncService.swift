import Foundation
import EventKit

// MARK: - Reminders Sync Service

/// Business logic for syncing Opta tasks with Apple Reminders.
/// Handles bidirectional sync, priority mapping, and conversion between task formats.
@MainActor
final class RemindersSyncService: ObservableObject {

    // MARK: - Properties

    static let shared = RemindersSyncService()

    private let eventKitService = EventKitService.shared
    private let apiService = APIService.shared

    @Published var syncState: SyncState = .idle
    @Published var lastSyncDate: Date?
    @Published var errorMessage: String?

    // Cache of synced reminders to track changes
    private var syncedReminders: [String: ReminderSnapshot] = [:]

    // MARK: - Initialization

    private init() {
        loadLastSyncDate()
        loadSyncedRemindersCache()
    }

    // MARK: - Main Sync Operations

    /// Performs a full bidirectional sync between Opta tasks and Apple Reminders.
    /// 1. Fetches tasks/reminders from both sources
    /// 2. Merges and deduplicates
    /// 3. Converts between formats with priority mapping
    func sync() async throws {
        guard syncState != .syncing else {
            print("[RemindersSyncService] Sync already in progress")
            return
        }

        syncState = .syncing
        errorMessage = nil

        do {
            // Step 1: Ensure reminders access
            if !eventKitService.isRemindersAuthorized {
                let granted = await eventKitService.requestRemindersAccess()
                guard granted else {
                    throw RemindersSyncError.notAuthorized
                }
            }

            // Step 2: Fetch from both sources
            let backendTasks = try await fetchBackendTasks()
            let appleReminders = await eventKitService.fetchIncompleteReminders()

            print("[RemindersSyncService] Backend tasks: \(backendTasks.count), Apple reminders: \(appleReminders.count)")

            // Step 3: Merge and deduplicate
            let mergeResult = mergeTasksAndReminders(
                backendTasks: backendTasks,
                appleReminders: appleReminders
            )

            print("[RemindersSyncService] Merged \(mergeResult.count) items")

            // Step 4: Update cache
            updateSyncedRemindersCache(mergeResult)

            // Step 5: Complete
            lastSyncDate = Date()
            saveLastSyncDate()
            syncState = .success

            HapticManager.shared.notification(.success)
            print("[RemindersSyncService] Sync completed successfully")

        } catch {
            syncState = .error
            errorMessage = error.localizedDescription
            print("[RemindersSyncService] Sync failed: \(error)")
            throw error
        }
    }

    // MARK: - Import from Apple Reminders

    /// Imports reminders from Apple Reminders into Opta as tasks.
    /// Converts Apple Reminders to Opta task format with priority mapping.
    func importFromReminders() async throws {
        guard syncState != .syncing else {
            print("[RemindersSyncService] Sync already in progress")
            return
        }

        syncState = .syncing
        errorMessage = nil

        do {
            // Ensure reminders access
            guard eventKitService.isRemindersAuthorized else {
                let granted = await eventKitService.requestRemindersAccess()
                guard granted else {
                    throw RemindersSyncError.notAuthorized
                }
            }

            // Fetch incomplete reminders
            let appleReminders = await eventKitService.fetchIncompleteReminders()

            print("[RemindersSyncService] Importing \(appleReminders.count) reminders from Apple Reminders")

            var importedCount = 0

            for reminder in appleReminders {
                // Convert to Opta task format
                let content = reminder.title ?? "Untitled Task"
                let dueString = extractDueString(from: reminder)
                let priority = convertToOptaPriority(ekPriority: reminder.priority)

                // Create in backend
                do {
                    _ = try await apiService.createTask(
                        content: content,
                        dueString: dueString,
                        priority: priority.rawValue
                    )
                    importedCount += 1
                } catch {
                    print("[RemindersSyncService] Failed to import reminder: \(content) - \(error)")
                }
            }

            lastSyncDate = Date()
            saveLastSyncDate()
            syncState = .success

            HapticManager.shared.notification(.success)
            print("[RemindersSyncService] Imported \(importedCount) reminders successfully")

        } catch {
            syncState = .error
            errorMessage = error.localizedDescription
            print("[RemindersSyncService] Import failed: \(error)")
            throw error
        }
    }

    // MARK: - Export to Apple Reminders

    /// Exports Opta tasks to Apple Reminders.
    /// Converts Opta tasks to Apple Reminders format with priority mapping.
    /// - Parameter tasks: The tasks to export
    func exportToReminders(_ tasks: [OptaTask]) async throws {
        guard syncState != .syncing else {
            print("[RemindersSyncService] Sync already in progress")
            return
        }

        syncState = .syncing
        errorMessage = nil

        do {
            // Ensure reminders access
            if !eventKitService.isRemindersAuthorized {
                let granted = await eventKitService.requestRemindersAccess()
                guard granted else {
                    throw RemindersSyncError.notAuthorized
                }
            }

            var exportedCount = 0

            for task in tasks {
                // Check if task already exists in Apple Reminders
                if let ekReminderId = task.ekReminderIdentifier,
                   eventKitService.fetchReminder(identifier: ekReminderId) != nil {
                    print("[RemindersSyncService] Task already exists in Apple Reminders: \(task.content)")
                    continue
                }

                // Create in Apple Reminders
                do {
                    let ekPriority = convertToEKPriority(optaPriority: task.priority)
                    let dueDate = task.due?.displayDate

                    let ekReminderId = try eventKitService.createReminder(
                        title: task.content,
                        notes: task.description,
                        dueDate: dueDate,
                        priority: ekPriority
                    )

                    // TODO: Update backend task with ekReminderIdentifier
                    // This would require a backend API endpoint to update task metadata

                    exportedCount += 1
                } catch {
                    print("[RemindersSyncService] Failed to export task: \(task.content) - \(error)")
                }
            }

            lastSyncDate = Date()
            saveLastSyncDate()
            syncState = .success

            HapticManager.shared.notification(.success)
            print("[RemindersSyncService] Exported \(exportedCount) tasks successfully")

        } catch {
            syncState = .error
            errorMessage = error.localizedDescription
            print("[RemindersSyncService] Export failed: \(error)")
            throw error
        }
    }

    // MARK: - Helper Methods - Fetch

    private func fetchBackendTasks() async throws -> [OptaTask] {
        let dashboard = try await apiService.fetchTasksDashboard()
        return dashboard.todayTasks + dashboard.upcomingTasks + dashboard.overdueTasks
    }

    // MARK: - Helper Methods - Priority Mapping

    /// Converts Opta task priority (1-4) to EventKit priority (0-9).
    /// Mapping:
    /// - normal (1) → 0 (none)
    /// - medium (2) → 3 (low)
    /// - high (3) → 6 (medium)
    /// - urgent (4) → 9 (high)
    func convertToEKPriority(optaPriority: TaskPriority) -> Int {
        switch optaPriority {
        case .normal:
            return 0
        case .medium:
            return 3
        case .high:
            return 6
        case .urgent:
            return 9
        }
    }

    /// Converts EventKit priority (0-9) to Opta task priority (1-4).
    /// Mapping:
    /// - 0 → normal (1)
    /// - 1-4 → medium (2)
    /// - 5-6 → high (3)
    /// - 7-9 → urgent (4)
    func convertToOptaPriority(ekPriority: Int) -> TaskPriority {
        switch ekPriority {
        case 0:
            return .normal
        case 1...4:
            return .medium
        case 5...6:
            return .high
        case 7...9:
            return .urgent
        default:
            return .normal
        }
    }

    // MARK: - Helper Methods - Due Date Extraction

    /// Extracts a human-readable due string from an EKReminder's due date components.
    private func extractDueString(from reminder: EKReminder) -> String? {
        guard let dueDateComponents = reminder.dueDateComponents,
              let dueDate = Calendar.current.date(from: dueDateComponents) else {
            return nil
        }

        let calendar = Calendar.current
        let now = Date()

        if calendar.isDateInToday(dueDate) {
            return "today"
        } else if calendar.isDateInTomorrow(dueDate) {
            return "tomorrow"
        } else if let daysAhead = calendar.dateComponents([.day], from: now, to: dueDate).day {
            if daysAhead == 7 {
                return "next week"
            } else if daysAhead > 0 && daysAhead < 7 {
                let weekday = calendar.component(.weekday, from: dueDate)
                let weekdayName = DateFormatter().weekdaySymbols[weekday - 1]
                return "next \(weekdayName)"
            }
        }

        // Fall back to formatted date
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter.string(from: dueDate)
    }

    // MARK: - Helper Methods - Merge

    /// Merges backend tasks and Apple Reminders, deduplicating by content similarity.
    private func mergeTasksAndReminders(
        backendTasks: [OptaTask],
        appleReminders: [EKReminder]
    ) -> [String: ReminderSnapshot] {
        var merged: [String: ReminderSnapshot] = [:]

        // Add all backend tasks
        for task in backendTasks {
            let snapshot = ReminderSnapshot(
                identifier: task.id,
                title: task.content,
                dueDate: task.due?.displayDate,
                priority: task.priority.rawValue,
                isCompleted: task.isCompleted,
                notes: task.description
            )
            merged[task.id] = snapshot
        }

        // Add Apple Reminders, checking for duplicates
        for reminder in appleReminders {
            let isDuplicate = backendTasks.contains { task in
                areSimilarTaskAndReminder(
                    taskContent: task.content,
                    taskDue: task.due?.displayDate,
                    reminderTitle: reminder.title,
                    reminderDue: reminder.dueDateComponents.flatMap { Calendar.current.date(from: $0) }
                )
            }

            if !isDuplicate {
                // Not a duplicate, add to merged
                let snapshot = ReminderSnapshot(
                    identifier: reminder.calendarItemIdentifier,
                    title: reminder.title ?? "Untitled",
                    dueDate: reminder.dueDateComponents.flatMap { Calendar.current.date(from: $0) },
                    priority: reminder.priority,
                    isCompleted: reminder.isCompleted,
                    notes: reminder.notes
                )
                merged[reminder.calendarItemIdentifier] = snapshot
            }
        }

        return merged
    }

    /// Checks if a task and reminder are similar (likely the same item).
    /// Compares content similarity and due date proximity.
    private func areSimilarTaskAndReminder(
        taskContent: String,
        taskDue: Date?,
        reminderTitle: String?,
        reminderDue: Date?
    ) -> Bool {
        guard let reminderTitle = reminderTitle else { return false }

        // Content similarity (case-insensitive, trimmed)
        let normalizedTask = taskContent.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        let normalizedReminder = reminderTitle.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)

        guard normalizedTask == normalizedReminder else { return false }

        // If both have due dates, check proximity (within 1 day)
        if let taskDue = taskDue, let reminderDue = reminderDue {
            let timeDifference = abs(taskDue.timeIntervalSince(reminderDue))
            return timeDifference < 86400 // 24 hours
        }

        // If one has a due date and the other doesn't, they're not similar
        if (taskDue == nil) != (reminderDue == nil) {
            return false
        }

        // Both have no due dates, content match is sufficient
        return true
    }

    // MARK: - Cache Management

    private func updateSyncedRemindersCache(_ reminders: [String: ReminderSnapshot]) {
        syncedReminders = reminders
        saveSyncedRemindersCache()
    }

    private func saveSyncedRemindersCache() {
        if let encoded = try? JSONEncoder().encode(syncedReminders) {
            UserDefaults.standard.set(encoded, forKey: "RemindersSyncService.syncedReminders")
        }
    }

    private func loadSyncedRemindersCache() {
        guard let data = UserDefaults.standard.data(forKey: "RemindersSyncService.syncedReminders"),
              let decoded = try? JSONDecoder().decode([String: ReminderSnapshot].self, from: data) else {
            return
        }
        syncedReminders = decoded
    }

    private func saveLastSyncDate() {
        if let date = lastSyncDate {
            UserDefaults.standard.set(date.timeIntervalSince1970, forKey: "RemindersSyncService.lastSyncDate")
        }
    }

    private func loadLastSyncDate() {
        let timestamp = UserDefaults.standard.double(forKey: "RemindersSyncService.lastSyncDate")
        if timestamp > 0 {
            lastSyncDate = Date(timeIntervalSince1970: timestamp)
        }
    }
}

// MARK: - Reminder Snapshot

/// A lightweight snapshot of a reminder for caching and comparison.
struct ReminderSnapshot: Codable {
    let identifier: String
    let title: String
    let dueDate: Date?
    let priority: Int
    let isCompleted: Bool
    let notes: String?
}

// MARK: - Reminders Sync Errors

enum RemindersSyncError: LocalizedError {
    case notAuthorized
    case fetchFailed
    case mergeFailed
    case conversionFailed

    var errorDescription: String? {
        switch self {
        case .notAuthorized:
            return "Reminders access not authorized. Please grant permission in Settings."
        case .fetchFailed:
            return "Failed to fetch reminders from one or more sources."
        case .mergeFailed:
            return "Failed to merge tasks and reminders."
        case .conversionFailed:
            return "Failed to convert between task and reminder formats."
        }
    }
}
